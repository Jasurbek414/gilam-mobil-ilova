/// ChatService — Flutter uchun oddiy REST polling chat
/// Socket.IO Cloudflare orqali ishlamaydi, shuning uchun:
/// - Yuborish: POST /api/messages
/// - Olish: har 3 soniyada GET /api/messages/history/:partnerId

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'api.dart';

typedef MessageCallback = void Function(Map<String, dynamic> msg);
typedef ConnectionCallback = void Function(bool isOnline);

class ChatService {
  // Singleton
  static final ChatService instance = ChatService._internal();
  factory ChatService() => instance;
  ChatService._internal();

  // State
  bool _active = false;
  String? _partnerId;
  String? _companyId;
  Timer? _timer;
  final Set<String> _seenIds = {};

  // Callbacks
  MessageCallback? onNewMessage;
  MessageCallback? onMessageSent;
  ConnectionCallback? onConnectionChange;

  bool get isConnected => _active;

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  void connect() {
    if (_active) return;
    _active = true;
    _notify(true);
    debugPrint('[Chat] Ishga tushdi');
  }

  void disconnect() {
    _active = false;
    _timer?.cancel();
    _timer = null;
    _seenIds.clear();
    _partnerId = null;
    _notify(false);
    debugPrint('[Chat] To\'xtatildi');
  }

  Future<void> reconnect() async {
    disconnect();
    await Future.delayed(const Duration(milliseconds: 300));
    connect();
  }

  // ─── Polling ────────────────────────────────────────────────────────────────

  /// Chat ochilganda chaqiriladi.
  /// [existingIds] — tarixdan yuklangan xabar IDlari (dublikat bo'lmasin)
  void startPolling({
    required String partnerId,
    String? companyId,
    Set<String>? existingIds,
  }) {
    _partnerId = partnerId;
    _companyId = companyId;
    _seenIds.clear();
    if (existingIds != null) _seenIds.addAll(existingIds);

    _timer?.cancel();
    _timer = Timer.periodic(const Duration(seconds: 3), (_) => _poll());
    debugPrint('[Chat] Polling: partnerId=$partnerId, boshlangich IDlar=${_seenIds.length}');
  }

  /// Chat yopilganda chaqiriladi.
  void stopPolling() {
    _timer?.cancel();
    _timer = null;
    _seenIds.clear();
    _partnerId = null;
    debugPrint('[Chat] Polling to\'xtatildi');
  }

  // ─── Send ───────────────────────────────────────────────────────────────────

  /// Xabar yuborish. Muvaffaqiyatli bo'lsa [onMessageSent] chaqiriladi.
  Future<Map<String, dynamic>?> sendMessage({
    required String recipientId,
    required String text,
    String? companyId,
  }) async {
    try {
      debugPrint('[Chat] Yuborilmoqda → recipientId=$recipientId');
      final result = await apiRequest(
        '/messages',
        method: 'POST',
        body: {
          'recipientId': recipientId,
          'text': text,
          if (companyId != null) 'companyId': companyId,
        },
      );

      if (result != null) {
        final msg = Map<String, dynamic>.from(result as Map);
        final id = msg['id']?.toString();
        if (id != null) {
          _seenIds.add(id); // Bu xabar keyingi pollda "yangi" sifatida ko'rinmasin
        }
        debugPrint('[Chat] ✅ Yuborildi id=$id');
        onMessageSent?.call(msg);
        return msg;
      }
    } catch (e) {
      debugPrint('[Chat] ❌ Yuborish xatosi: $e');
    }
    return null;
  }

  /// socket_io_client bilan moslik uchun (eski kod chaqirib qolishi mumkin)
  void send(String event, Map<String, dynamic> data) {
    if (event == 'sendMessage') {
      sendMessage(
        recipientId: data['recipientId']?.toString() ?? '',
        text: data['text']?.toString() ?? '',
        companyId: data['companyId']?.toString(),
      );
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  Future<void> _poll() async {
    if (_partnerId == null) return;

    try {
      final raw = await apiRequest('/messages/history/$_partnerId');
      if (raw == null) return;

      final list = raw as List;
      for (final item in list) {
        final msg = Map<String, dynamic>.from(item as Map);
        final id = msg['id']?.toString();
        if (id == null) continue;

        if (!_seenIds.contains(id)) {
          _seenIds.add(id);
          debugPrint('[Chat] 📩 Yangi xabar id=$id, senderId=${msg['senderId']}');
          onNewMessage?.call(msg);
        }
      }

      if (!_active) {
        _active = true;
        _notify(true);
      }
    } catch (e) {
      debugPrint('[Chat] Poll xatosi: $e');
    }
  }

  void _notify(bool online) {
    onConnectionChange?.call(online);
  }
}
