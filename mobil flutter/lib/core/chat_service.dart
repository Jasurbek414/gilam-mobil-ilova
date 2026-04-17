/// Custom Socket.IO polling client.
/// socket_io_client ^3.x dart paketida polling transport bilan onConnect
/// chaqirilmasligi taniqli bug. Shu sababli o'z polling implementatsiyamizni
/// yozamiz — bu to'g'ridan-to'g'ri HTTP so'rovlar orqali ishlaydi.

import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'api.dart';

typedef MsgCallback = void Function(Map<String, dynamic> msg);
typedef ConnCallback = void Function(bool connected);

class ChatService {
  static final ChatService _instance = ChatService._();
  static ChatService get instance => _instance;
  ChatService._();

  // ── config ──────────────────────────────────────────────────────────────────
  static const String _baseUrl = 'https://gilam-api.ecos.uz';
  static const String _socketPath = '/socket.io/';
  static const String _ns = '/chat';

  // ── state ───────────────────────────────────────────────────────────────────
  String? _sid;       // socket session id
  String? _token;     // JWT
  bool _running = false;
  bool _connected = false;
  int _failCount = 0;

  // callbacks
  MsgCallback? onNewMessage;
  MsgCallback? onMessageSent;
  ConnCallback? onConnectionChange;

  bool get isConnected => _connected;

  // ── public api ───────────────────────────────────────────────────────────────
  Future<void> connect() async {
    if (_running) return;
    _token = await getToken();
    if (_token == null) {
      debugPrint('[Chat] Token yo\'q');
      return;
    }
    _running = true;
    _failCount = 0;
    _loop();
  }

  void disconnect() {
    _running = false;
    _sid = null;
    _setConnected(false);
  }

  void emit(String event, Map<String, dynamic> data) {
    if (!_connected || _sid == null) return;
    _sendPacket(event, data);
  }

  // ── internal loop ────────────────────────────────────────────────────────────
  Future<void> _loop() async {
    while (_running) {
      try {
        if (_sid == null) {
          await _handshake();
        } else {
          await _poll();
        }
        _failCount = 0;
      } catch (e) {
        _failCount++;
        debugPrint('[Chat] Poll error ($e), fail=$_failCount');
        if (_failCount > 3) {
          _setConnected(false);
          _sid = null;
        }
        // Backoff
        final waitSec = (_failCount * 2).clamp(2, 30);
        await Future.delayed(Duration(seconds: waitSec));
      }
    }
  }

  // ── handshake ────────────────────────────────────────────────────────────────
  Future<void> _handshake() async {
    // Step 1: Get sid from default namespace
    final url = '$_baseUrl$_socketPath?EIO=4&transport=polling&token=$_token';
    final r1 = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 15));
    if (r1.statusCode != 200) throw Exception('Handshake ${r1.statusCode}');

    // Parse: 0{"sid":"..."}
    final body = r1.body;
    final jsonStart = body.indexOf('{');
    if (jsonStart < 0) throw Exception('Bad handshake body: $body');
    final data = jsonDecode(body.substring(jsonStart)) as Map;
    _sid = data['sid'] as String;
    debugPrint('[Chat] SID: $_sid');

    // Step 2: Join /chat namespace — send "40/chat,"
    final joinUrl = '$_baseUrl$_socketPath?EIO=4&transport=polling&sid=$_sid';
    final r2 = await http.post(
      Uri.parse(joinUrl),
      headers: {'Content-Type': 'text/plain'},
      body: '40$_ns,',
    ).timeout(const Duration(seconds: 10));
    if (r2.statusCode != 200) throw Exception('Namespace join ${r2.statusCode}');
    debugPrint('[Chat] Namespace join sent');

    // Step 3: Read namespace confirm "40/chat,{"sid":"..."}"
    await Future.delayed(const Duration(milliseconds: 300));
    final r3 = await http.get(Uri.parse(joinUrl)).timeout(const Duration(seconds: 15));
    debugPrint('[Chat] Namespace confirm: ${r3.body.substring(0, r3.body.length.clamp(0, 100))}');

    if (r3.body.contains('40$_ns') || r3.body.contains('40/chat')) {
      _setConnected(true);
      debugPrint('[Chat] ✅ Namespace confirmed — connected!');
    } else {
      // Maybe auth error
      debugPrint('[Chat] ⚠️ Unexpected confirm: ${r3.body}');
      _setConnected(true); // optimistically connected
    }
  }

  // ── poll ─────────────────────────────────────────────────────────────────────
  Future<void> _poll() async {
    if (_sid == null) return;
    final url = '$_baseUrl$_socketPath?EIO=4&transport=polling&sid=$_sid';
    final r = await http.get(Uri.parse(url)).timeout(const Duration(seconds: 35));
    if (r.statusCode != 200) {
      _sid = null;
      throw Exception('Poll ${r.statusCode}');
    }

    if (r.body.isNotEmpty && r.body != 'ok') {
      _parsePackets(r.body);
    }
  }

  // ── send packet ──────────────────────────────────────────────────────────────
  Future<void> _sendPacket(String event, Map<String, dynamic> data) async {
    if (_sid == null) return;
    // Socket.IO v4 message format: 42/chat,["event",{...}]
    final payload = '42$_ns,${jsonEncode([event, data])}';
    final url = '$_baseUrl$_socketPath?EIO=4&transport=polling&sid=$_sid';
    try {
      await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'text/plain'},
        body: payload,
      ).timeout(const Duration(seconds: 10));
    } catch (e) {
      debugPrint('[Chat] Send error: $e');
    }
  }

  // ── parse incoming packets ────────────────────────────────────────────────────
  void _parsePackets(String raw) {
    // Multiple packets can come at once, separated by length prefix
    // Format: <length>\x1e<packet><length>\x1e<packet>...
    // Or just single packet
    List<String> packets = [];

    if (raw.contains('\x1e')) {
      // Multiple packets
      final parts = raw.split('\x1e');
      for (int i = 0; i + 1 < parts.length; i += 2) {
        packets.add(parts[i + 1]);
      }
      if (parts.length % 2 == 1) packets.add(parts.last);
    } else {
      packets.add(raw);
    }

    for (final pkt in packets) {
      _processPacket(pkt.trim());
    }
  }

  void _processPacket(String pkt) {
    if (pkt.isEmpty) return;
    debugPrint('[Chat] PKT: ${pkt.substring(0, pkt.length.clamp(0, 80))}');

    // Heartbeat ping from server: "2"
    if (pkt == '2') {
      _sendPong();
      return;
    }

    // Message packet: "42/chat,["event",{...}]"
    if (pkt.startsWith('42')) {
      final body = pkt.startsWith('42$_ns,')
          ? pkt.substring('42$_ns,'.length)
          : (pkt.startsWith('42/chat,') ? pkt.substring('42/chat,'.length) : null);

      if (body == null) return;

      try {
        final arr = jsonDecode(body) as List;
        final event = arr[0] as String;
        final data = arr.length > 1 ? arr[1] : null;

        if (event == 'newMessage' && data is Map) {
          final msg = Map<String, dynamic>.from(data);
          debugPrint('[Chat] 📩 newMessage: ${msg['text']}');
          onNewMessage?.call(msg);
        } else if (event == 'messageSent' && data is Map) {
          final msg = Map<String, dynamic>.from(data);
          debugPrint('[Chat] ✓ messageSent');
          onMessageSent?.call(msg);
        }
      } catch (e) {
        debugPrint('[Chat] Parse error: $e, pkt=$pkt');
      }
    }

    // Namespace connect ack: "40/chat,{...}"
    if (pkt.startsWith('40')) {
      _setConnected(true);
    }

    // Disconnect: "41/chat"
    if (pkt.startsWith('41')) {
      _sid = null;
      _setConnected(false);
    }
  }

  Future<void> _sendPong() async {
    if (_sid == null) return;
    final url = '$_baseUrl$_socketPath?EIO=4&transport=polling&sid=$_sid';
    try {
      await http.post(Uri.parse(url),
          headers: {'Content-Type': 'text/plain'}, body: '3');
    } catch (_) {}
  }

  void _setConnected(bool val) {
    if (_connected != val) {
      _connected = val;
      onConnectionChange?.call(val);
    }
  }
}
