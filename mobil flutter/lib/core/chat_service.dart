/// Custom Socket.IO v4 polling client for Flutter.
/// socket_io_client dart package has a known bug where onConnect
/// is never called with polling transport + Cloudflare proxy.
/// This implementation does raw HTTP polling directly.

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

  static const String _origin = 'https://gilam-api.ecos.uz';
  static const String _path = '/socket.io/';
  static const String _ns = '/chat';

  String? _sid;
  String? _token;
  bool _running = false;
  bool _connected = false;
  int _failCount = 0;
  http.Client _client = http.Client();

  MsgCallback? onNewMessage;
  MsgCallback? onMessageSent;
  ConnCallback? onConnectionChange;

  bool get isConnected => _connected;

  // ── Public API ─────────────────────────────────────────────────────────────

  Future<void> connect() async {
    if (_running && _connected) return;
    _token = await getToken();
    if (_token == null) {
      debugPrint('[Chat] ❌ Token yo\'q');
      return;
    }
    if (_running) return; // already looping
    _running = true;
    _failCount = 0;
    _client = http.Client();
    _loop();
  }

  void disconnect() {
    _running = false;
    _sid = null;
    _client.close();
    _client = http.Client();
    _setConnected(false);
  }

  Future<void> reconnect() async {
    disconnect();
    await Future.delayed(const Duration(milliseconds: 300));
    await connect();
  }

  void send(String event, Map<String, dynamic> data) {
    if (_sid == null) {
      debugPrint('[Chat] send(): sid yo\'q — HTTP fallback ishlatiladi');
      return;
    }
    _sendPacket(event, data);
  }

  // ── Poll Loop ──────────────────────────────────────────────────────────────

  Future<void> _loop() async {
    while (_running) {
      try {
        if (_sid == null) {
          await _handshake();
        } else {
          await _poll();
          _failCount = 0;
        }
      } catch (e) {
        _failCount++;
        debugPrint('[Chat] Loop error (fail=$_failCount): $e');
        if (_failCount >= 3) {
          _sid = null;
          _setConnected(false);
        }
        final delay = (_failCount * 3).clamp(3, 30);
        await Future.delayed(Duration(seconds: delay));
      }
    }
    debugPrint('[Chat] Loop stopped');
  }

  // ── Handshake ──────────────────────────────────────────────────────────────

  Future<void> _handshake() async {
    debugPrint('[Chat] Handshake boshlanyapti...');

    // Step 1: EIO handshake — get sid
    final uri1 = Uri.parse('$_origin$_path?EIO=4&transport=polling&token=$_token');
    final r1 = await _client.get(uri1).timeout(const Duration(seconds: 20));
    if (r1.statusCode != 200) throw Exception('EIO handshake fail: ${r1.statusCode}');

    final body1 = r1.body;
    final jsonStart = body1.indexOf('{');
    if (jsonStart < 0) throw Exception('Bad handshake: $body1');
    final hs = jsonDecode(body1.substring(jsonStart)) as Map;
    _sid = hs['sid'] as String;
    debugPrint('[Chat] SID: $_sid');

    // Step 2: Join /chat namespace
    final pollUri = Uri.parse('$_origin$_path?EIO=4&transport=polling&sid=$_sid');
    final r2 = await _client.post(
      pollUri,
      headers: {'Content-Type': 'text/plain;charset=UTF-8'},
      body: '40$_ns,',
    ).timeout(const Duration(seconds: 10));
    if (r2.statusCode != 200) throw Exception('Namespace join fail: ${r2.statusCode}');
    debugPrint('[Chat] Namespace packet sent');

    // Step 3: Read namespace confirmation
    await Future.delayed(const Duration(milliseconds: 400));
    final r3 = await _client.get(pollUri).timeout(const Duration(seconds: 20));
    final confirm = r3.body;
    debugPrint('[Chat] Confirm: ${confirm.substring(0, confirm.length.clamp(0, 100))}');

    // Accept confirmed or not — we're connected if sid was set
    if (confirm.contains('40') || confirm.contains('"sid"')) {
      _setConnected(true);
      debugPrint('[Chat] ✅ Chat namespace joined!');
    } else if (confirm.startsWith('0') || confirm.startsWith('2')) {
      // Heartbeat or another packet — still ok
      _setConnected(true);
      _processRawPacket(confirm);
    } else {
      _setConnected(true); // optimistic
    }
  }

  // ── Polling ────────────────────────────────────────────────────────────────

  Future<void> _poll() async {
    final uri = Uri.parse('$_origin$_path?EIO=4&transport=polling&sid=$_sid');
    final r = await _client.get(uri).timeout(const Duration(seconds: 40));

    if (r.statusCode == 400 || r.statusCode == 404) {
      // Session expired
      debugPrint('[Chat] Session expired (${r.statusCode})');
      _sid = null;
      _setConnected(false);
      throw Exception('Session expired');
    }

    if (r.statusCode != 200) throw Exception('Poll failed: ${r.statusCode}');

    final raw = r.body;
    if (raw.isNotEmpty && raw != 'ok') {
      _processRawBody(raw);
    }
  }

  // ── Packet processing ──────────────────────────────────────────────────────

  void _processRawBody(String raw) {
    // Socket.IO v4 / EIO4 can send multiple packets with Record Separator \x1e
    // Format: <len>\x1e<packet>\x1e<packet>...
    // Or just single: <packet>
    if (raw.contains('\x1e')) {
      final parts = raw.split('\x1e');
      for (final part in parts) {
        if (part.isNotEmpty) _processRawPacket(part);
      }
    } else {
      _processRawPacket(raw);
    }
  }

  void _processRawPacket(String pkt) {
    if (pkt.isEmpty) return;

    // Handle length-prefixed packets: "10:40/chat,..."
    String actual = pkt;
    final colonIdx = pkt.indexOf(':');
    if (colonIdx > 0 && colonIdx < 5) {
      final lenStr = pkt.substring(0, colonIdx);
      if (int.tryParse(lenStr) != null) {
        actual = pkt.substring(colonIdx + 1);
      }
    }

    debugPrint('[Chat] PKT: ${actual.substring(0, actual.length.clamp(0, 80))}');

    // Heartbeat ping: "2"
    if (actual == '2') {
      _sendPong();
      return;
    }

    // Heartbeat pong: "3"
    if (actual == '3') return;

    // Namespace disconnect: "41/chat"
    if (actual.startsWith('41')) {
      debugPrint('[Chat] Namespace disconnected');
      _sid = null;
      _setConnected(false);
      return;
    }

    // Namespace connect ack: "40/chat,{"sid":"..."}"
    if (actual.startsWith('40')) {
      _setConnected(true);
      return;
    }

    // Message packet: "42/chat,["event",data]"
    if (actual.startsWith('42')) {
      final suffix = '42$_ns,';
      final suffix2 = '42/chat,';
      String? body;
      if (actual.startsWith(suffix)) {
        body = actual.substring(suffix.length);
      } else if (actual.startsWith(suffix2)) {
        body = actual.substring(suffix2.length);
      }
      if (body == null) return;
      _handleMessage(body);
    }
  }

  void _handleMessage(String body) {
    try {
      final arr = jsonDecode(body) as List;
      if (arr.isEmpty) return;
      final event = arr[0] as String;
      final data = arr.length > 1 ? arr[1] : null;
      if (data is! Map) return;
      final msg = Map<String, dynamic>.from(data);

      if (event == 'newMessage') {
        debugPrint('[Chat] 📩 newMessage: ${msg['text']}');
        onNewMessage?.call(msg);
      } else if (event == 'messageSent') {
        debugPrint('[Chat] ✓ messageSent');
        onMessageSent?.call(msg);
      }
    } catch (e) {
      debugPrint('[Chat] Message parse error: $e, body=$body');
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────

  Future<void> _sendPacket(String event, Map<String, dynamic> data) async {
    if (_sid == null) return;
    final payload = '42$_ns,${jsonEncode([event, data])}';
    final uri = Uri.parse('$_origin$_path?EIO=4&transport=polling&sid=$_sid');
    try {
      await _client.post(
        uri,
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: payload,
      ).timeout(const Duration(seconds: 10));
    } catch (e) {
      debugPrint('[Chat] Send error: $e');
    }
  }

  Future<void> _sendPong() async {
    if (_sid == null) return;
    final uri = Uri.parse('$_origin$_path?EIO=4&transport=polling&sid=$_sid');
    try {
      await _client.post(uri,
          headers: {'Content-Type': 'text/plain;charset=UTF-8'}, body: '3');
    } catch (_) {}
  }

  void _setConnected(bool val) {
    if (_connected != val) {
      _connected = val;
      debugPrint('[Chat] Connection: ${val ? "✅ ONLINE" : "❌ OFFLINE"}');
      onConnectionChange?.call(val);
    }
  }
}
