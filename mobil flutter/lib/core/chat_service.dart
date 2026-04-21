/// Gilam Chat Service — REST polling yondashuvi.
/// Socket.IO Cloudflare orqali bloklangani uchun, bu servis:
///   1. Xabar yuborish: POST /api/messages (REST)
///   2. Yangi xabarlar: GET /api/messages/history/:id ni har 4 soniyada tekshirish
/// Bu yondashuv 100% ishonchli va Cloudflare bilan muammo chiqarmaydi.

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'api.dart';

typedef MsgCallback = void Function(Map<String, dynamic> msg);
typedef ConnCallback = void Function(bool connected);

class ChatService {
  static final ChatService _instance = ChatService._();
  static ChatService get instance => _instance;
  ChatService._();

  Timer? _pollTimer;
  bool _running = false;
  bool _connected = false;
  String? _currentPartnerId;
  String? _currentCompanyId;
  DateTime? _lastMessageTime;
  final List<String> _knownIds = [];

  MsgCallback? onNewMessage;
  MsgCallback? onMessageSent;
  ConnCallback? onConnectionChange;

  bool get isConnected => _connected;

  // ── Public API ─────────────────────────────────────────────────────────────

  Future<void> connect() async {
    if (_running) return;
    _running = true;
    _setConnected(true);
    debugPrint('[Chat] ✅ REST polling rejimi ishga tushdi');
  }

  void disconnect() {
    _running = false;
    _pollTimer?.cancel();
    _pollTimer = null;
    _setConnected(false);
    debugPrint('[Chat] Uzildi');
  }

  Future<void> reconnect() async {
    disconnect();
    await Future.delayed(const Duration(milliseconds: 200));
    await connect();
  }

  /// Polling ni boshlash — chat ekrani ochilganda chaqiriladi
  void startPolling({required String partnerId, required String? companyId}) {
    _currentPartnerId = partnerId;
    _currentCompanyId = companyId;
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 4), (_) => _pollNewMessages());
    debugPrint('[Chat] Polling boshlandi: partnerId=$partnerId');
  }

  void stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
    _currentPartnerId = null;
    debugPrint('[Chat] Polling to\'xtatildi');
  }

  /// Xabar yuborish — REST orqali
  Future<bool> sendMessage({
    required String recipientId,
    required String text,
    String? companyId,
  }) async {
    try {
      final res = await apiRequest(
        '/messages',
        method: 'POST',
        body: {
          'recipientId': recipientId,
          'text': text,
          if (companyId != null) 'companyId': companyId,
        },
      );
      if (res != null) {
        final msg = Map<String, dynamic>.from(res as Map);
        _trackId(msg['id']?.toString());
        onMessageSent?.call(msg);
        debugPrint('[Chat] ✅ Xabar yuborildi');
        return true;
      }
    } catch (e) {
      debugPrint('[Chat] ❌ Yuborish xatoligi: $e');
    }
    return false;
  }

  /// send() — eski interfeys bilan moslik uchun
  void send(String event, Map<String, dynamic> data) {
    if (event == 'sendMessage') {
      sendMessage(
        recipientId: data['recipientId']?.toString() ?? '',
        text: data['text']?.toString() ?? '',
        companyId: data['companyId']?.toString(),
      );
    }
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  Future<void> _pollNewMessages() async {
    if (_currentPartnerId == null) return;
    try {
      final history = await apiRequest('/messages/history/$_currentPartnerId');
      if (history == null || history is! List) return;

      final messages = List<Map<String, dynamic>>.from(
        history.map((e) => Map<String, dynamic>.from(e as Map)),
      );

      // Oxirgi vaqtdan keyin kelgan yangi xabarlarni topamiz
      for (final msg in messages) {
        final id = msg['id']?.toString();
        if (id != null && !_knownIds.contains(id)) {
          _knownIds.add(id);
          onNewMessage?.call(msg);
          debugPrint('[Chat] 📩 Yangi xabar: ${msg['text']?.toString().substring(0, (msg['text']?.toString().length ?? 0).clamp(0, 30))}');
        }
      }

      if (!_connected) _setConnected(true);
    } catch (e) {
      debugPrint('[Chat] Poll xatoligi: $e');
      if (_connected) _setConnected(false);
    }
  }

  void _trackId(String? id) {
    if (id != null && !_knownIds.contains(id)) {
      _knownIds.add(id);
    }
  }

  void _setConnected(bool val) {
    if (_connected != val) {
      _connected = val;
      debugPrint('[Chat] Holat: ${val ? "✅ ONLINE" : "❌ OFFLINE"}');
      onConnectionChange?.call(val);
    }
  }
}
