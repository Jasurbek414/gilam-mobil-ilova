import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../core/api.dart';
import '../core/theme.dart';

class ChatPage extends StatefulWidget {
  final Map<String, dynamic> currentUser;
  const ChatPage({super.key, required this.currentUser});
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> with WidgetsBindingObserver {
  // ── State ────────────────────────────────────────────────────────────────────
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _operator;
  bool _loading = true;
  bool _connected = false;
  bool _reconnecting = false;
  String _statusText = 'Ulanmoqda...';
  bool _sendingMedia = false;

  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  final FocusNode _focusNode = FocusNode();
  final ImagePicker _picker = ImagePicker();

  // ── Socket polling state ──────────────────────────────────────────────────────
  String? _sid;
  String? _jwtToken;
  bool _polling = false;
  int _failCount = 0;
  static const String _origin = 'https://gilam-api.ecos.uz';
  static const String _sockPath = '/socket.io/';
  static const String _ns = '/chat';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void dispose() {
    _polling = false;
    WidgetsBinding.instance.removeObserver(this);
    _ctrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_connected && !_polling) {
      _startPolling();
    }
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  Future<void> _init() async {
    _jwtToken = await getToken();

    try {
      final op = await getSupportContact();
      if (mounted && op != null) setState(() => _operator = op);
    } catch (e) {
      debugPrint('[Chat] Operator error: $e');
    }

    if (_operator != null) {
      try {
        final h = await getMessageHistory(_operator!['id'].toString());
        if (mounted) {
          setState(() => _messages = List<Map<String, dynamic>>.from(h));
          _scrollToBottom();
        }
      } catch (e) {
        debugPrint('[Chat] History error: $e');
      }
    }

    _startPolling();
    if (mounted) setState(() => _loading = false);
  }

  // ── Socket.IO polling ─────────────────────────────────────────────────────────
  Future<void> _startPolling() async {
    if (_polling || _jwtToken == null) return;
    _polling = true;
    _failCount = 0;
    _setConnected(false);
    setState(() { _reconnecting = true; _statusText = 'Ulanmoqda...'; });

    while (_polling && mounted) {
      try {
        if (_sid == null) {
          await _handshake();
        } else {
          await _poll();
          _failCount = 0;
        }
      } catch (e) {
        _failCount++;
        debugPrint('[Chat] Poll error ($e) fail=$_failCount');
        _sid = null;
        _setConnected(false);
        if (mounted) setState(() => _reconnecting = true);
        final wait = (_failCount * 3).clamp(3, 30);
        await Future.delayed(Duration(seconds: wait));
      }
    }
  }

  Future<void> _handshake() async {
    final u1 = Uri.parse('$_origin$_sockPath?EIO=4&transport=polling&token=$_jwtToken');
    final r1 = await http.get(u1).timeout(const Duration(seconds: 20));
    if (r1.statusCode != 200) throw Exception('Handshake ${r1.statusCode}');
    final jIdx = r1.body.indexOf('{');
    if (jIdx < 0) throw Exception('Bad handshake');
    final hs = jsonDecode(r1.body.substring(jIdx)) as Map;
    _sid = hs['sid'] as String;

    final pu = Uri.parse('$_origin$_sockPath?EIO=4&transport=polling&sid=$_sid');
    final r2 = await http.post(pu,
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: '40$_ns,').timeout(const Duration(seconds: 10));
    if (r2.statusCode != 200) throw Exception('Join ${r2.statusCode}');

    await Future.delayed(const Duration(milliseconds: 500));
    await http.get(pu).timeout(const Duration(seconds: 20));
    _setConnected(true);
    if (mounted) setState(() { _reconnecting = false; _statusText = 'Online'; });
  }

  Future<void> _poll() async {
    if (_sid == null || !mounted) return;
    final pu = Uri.parse('$_origin$_sockPath?EIO=4&transport=polling&sid=$_sid');
    final r = await http.get(pu).timeout(const Duration(seconds: 40));
    if (r.statusCode == 400 || r.statusCode == 404) {
      _sid = null;
      throw Exception('Session ended');
    }
    if (r.statusCode != 200) throw Exception('Poll ${r.statusCode}');
    if (r.body.isNotEmpty && r.body != 'ok') _parseBody(r.body);
  }

  void _parseBody(String raw) {
    final parts = raw.contains('\x1e') ? raw.split('\x1e') : [raw];
    for (final p in parts) {
      if (p.isNotEmpty) _parsePkt(p);
    }
  }

  void _parsePkt(String pkt) {
    if (pkt.isEmpty) return;
    String p = pkt;
    final ci = pkt.indexOf(':');
    if (ci > 0 && ci < 5 && int.tryParse(pkt.substring(0, ci)) != null) {
      p = pkt.substring(ci + 1);
    }
    if (p == '2') { _pong(); return; }
    if (p.startsWith('41')) { _sid = null; _setConnected(false); return; }
    if (p.startsWith('40')) { _setConnected(true); return; }
    if (p.startsWith('42')) {
      String? body;
      if (p.startsWith('42$_ns,')) body = p.substring('42$_ns,'.length);
      else if (p.startsWith('42/chat,')) body = p.substring('42/chat,'.length);
      if (body == null) return;
      try {
        final arr = jsonDecode(body) as List;
        if (arr.isEmpty) return;
        final event = arr[0] as String;
        final data = arr.length > 1 ? arr[1] : null;
        if (data is! Map) return;
        _onEvent(event, Map<String, dynamic>.from(data));
      } catch (e) { debugPrint('[Chat] Parse err: $e'); }
    }
  }

  void _onEvent(String event, Map<String, dynamic> msg) {
    if (!mounted) return;
    if (event == 'newMessage') {
      final fromOp = _operator != null && msg['senderId'] == _operator!['id'];
      if (fromOp) { setState(() => _messages.add(msg)); _scrollToBottom(); }
    } else if (event == 'messageSent') {
      setState(() {
        final idx = _messages.indexWhere((m) => m['_temp'] == true);
        if (idx >= 0) _messages[idx] = msg;
        else _messages.add(msg);
      });
      _scrollToBottom();
    }
  }

  Future<void> _pong() async {
    if (_sid == null) return;
    try {
      await http.post(
        Uri.parse('$_origin$_sockPath?EIO=4&transport=polling&sid=$_sid'),
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: '3',
      ).timeout(const Duration(seconds: 5));
    } catch (_) {}
  }

  void _setConnected(bool val) {
    if (_connected != val) {
      _connected = val;
      if (mounted) setState(() {
        _connected = val;
        _reconnecting = !val;
        _statusText = val ? 'Online' : 'Qayta ulanmoqda...';
      });
    }
  }

  // ── Send text ────────────────────────────────────────────────────────────────
  Future<void> _sendSocket(String text) async {
    if (_sid == null) return;
    final payload = '42$_ns,${jsonEncode(['sendMessage', {
      'recipientId': _operator!['id'],
      'text': text,
      'companyId': widget.currentUser['companyId'],
    }])}';
    try {
      await http.post(
        Uri.parse('$_origin$_sockPath?EIO=4&transport=polling&sid=$_sid'),
        headers: {'Content-Type': 'text/plain;charset=UTF-8'},
        body: payload,
      ).timeout(const Duration(seconds: 10));
    } catch (e) { debugPrint('[Chat] Send error: $e'); }
  }

  Future<void> _sendHttp(String text, String tempId) async {
    try {
      final res = await apiRequest('/messages', method: 'POST', body: {
        'recipientId': _operator!['id'],
        'text': text,
        'companyId': widget.currentUser['companyId'],
      });
      if (res != null && mounted) {
        final confirmed = Map<String, dynamic>.from(res as Map);
        setState(() {
          final idx = _messages.indexWhere((m) => m['id'] == tempId);
          if (idx >= 0) _messages[idx] = confirmed;
        });
      }
    } catch (e) { debugPrint('[Chat] HTTP send err: $e'); }
  }

  void _send() {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _operator == null) return;
    HapticFeedback.lightImpact();

    final tempId = 'tmp_${DateTime.now().millisecondsSinceEpoch}';
    final tempMsg = <String, dynamic>{
      'id': tempId,
      'text': text,
      'senderId': widget.currentUser['id'],
      'recipientId': _operator!['id'],
      'createdAt': DateTime.now().toIso8601String(),
      '_temp': true,
    };
    setState(() => _messages.add(tempMsg));
    _ctrl.clear();
    _focusNode.requestFocus();
    _scrollToBottom();

    if (_connected && _sid != null) {
      _sendSocket(text);
    } else {
      _sendHttp(text, tempId);
    }
  }

  // ── Send image ───────────────────────────────────────────────────────────────
  Future<void> _pickAndSendImage(ImageSource source) async {
    if (_operator == null) return;
    try {
      final xfile = await _picker.pickImage(
        source: source,
        maxWidth: 1080,
        maxHeight: 1080,
        imageQuality: 75,
      );
      if (xfile == null || !mounted) return;

      final bytes = await File(xfile.path).readAsBytes();
      if (bytes.length > 5 * 1024 * 1024) {
        if (mounted) _showSnack('Rasm 5MB dan katta bo\'lmasin');
        return;
      }

      setState(() => _sendingMedia = true);
      final base64Img = 'data:image/jpeg;base64,${base64Encode(bytes)}';
      final text = '[IMAGE]:$base64Img';

      final tempId = 'tmp_img_${DateTime.now().millisecondsSinceEpoch}';
      final tempMsg = <String, dynamic>{
        'id': tempId,
        'text': text,
        'senderId': widget.currentUser['id'],
        'createdAt': DateTime.now().toIso8601String(),
        '_temp': true,
      };
      setState(() { _messages.add(tempMsg); _sendingMedia = false; });
      _scrollToBottom();

      if (_connected && _sid != null) {
        await _sendSocket(text);
      } else {
        await _sendHttp(text, tempId);
      }
    } catch (e) {
      debugPrint('[Chat] Image error: $e');
      if (mounted) setState(() => _sendingMedia = false);
    }
  }

  void _showImageSourceDialog() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF111827),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 16),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 40, height: 4,
                decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(2))),
            const SizedBox(height: 16),
            const Text('Rasm tanlash', style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w700)),
            const SizedBox(height: 12),
            ListTile(
              leading: Container(
                width: 44, height: 44,
                decoration: BoxDecoration(color: kPrimary.withAlpha(30), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.camera_alt_rounded, color: kPrimary),
              ),
              title: const Text('Kamera', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              subtitle: Text('Yangi rasm olish', style: TextStyle(color: Colors.white.withAlpha(100), fontSize: 12)),
              onTap: () { Navigator.pop(context); _pickAndSendImage(ImageSource.camera); },
            ),
            ListTile(
              leading: Container(
                width: 44, height: 44,
                decoration: BoxDecoration(color: Colors.purple.withAlpha(40), borderRadius: BorderRadius.circular(12)),
                child: const Icon(Icons.photo_library_rounded, color: Colors.purpleAccent),
              ),
              title: const Text('Galereya', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
              subtitle: Text('Mavjud rasmni yuborish', style: TextStyle(color: Colors.white.withAlpha(100), fontSize: 12)),
              onTap: () { Navigator.pop(context); _pickAndSendImage(ImageSource.gallery); },
            ),
          ]),
        ),
      ),
    );
  }

  // ── Send location ─────────────────────────────────────────────────────────────
  Future<void> _sendLocation() async {
    if (_operator == null) return;
    try {
      // Ruxsat so'rash
      LocationPermission perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.deniedForever) {
        if (mounted) _showSnack('Lokatsiya ruxsati berilmagan');
        return;
      }

      setState(() => _sendingMedia = true);
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );

      final text = '[LOCATION]:${pos.latitude.toStringAsFixed(6)},${pos.longitude.toStringAsFixed(6)}';
      final tempId = 'tmp_loc_${DateTime.now().millisecondsSinceEpoch}';
      final tempMsg = <String, dynamic>{
        'id': tempId,
        'text': text,
        'senderId': widget.currentUser['id'],
        'createdAt': DateTime.now().toIso8601String(),
        '_temp': true,
      };
      setState(() { _messages.add(tempMsg); _sendingMedia = false; });
      _scrollToBottom();

      if (_connected && _sid != null) {
        await _sendSocket(text);
      } else {
        await _sendHttp(text, tempId);
      }
    } catch (e) {
      debugPrint('[Chat] Location error: $e');
      if (mounted) {
        setState(() => _sendingMedia = false);
        _showSnack('Lokatsiya olinmadi: $e');
      }
    }
  }

  void _showSnack(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.red.shade700),
    );
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollCtrl.hasClients) {
        _scrollCtrl.animateTo(
          _scrollCtrl.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  void _reconnect() {
    _polling = false;
    _sid = null;
    _setConnected(false);
    Future.delayed(const Duration(milliseconds: 300), _startPolling);
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1E),
      appBar: _buildAppBar(),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary, strokeWidth: 2.5))
          : _operator == null
              ? _buildNoOperator()
              : Column(children: [
                  if (!_connected) _buildBanner(),
                  Expanded(child: _buildMessages()),
                  _buildInput(),
                ]),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    final name = _operator?['fullName'] as String? ?? 'Operator';
    return AppBar(
      backgroundColor: const Color(0xFF111827),
      elevation: 0,
      leading: GestureDetector(
        onTap: () => Navigator.pop(context),
        child: Container(
          margin: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white.withAlpha(12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 17),
        ),
      ),
      title: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(
              colors: [Color(0xFF22D3EE), Color(0xFF6366F1)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          child: Center(child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : 'O',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 17),
          )),
        ),
        const SizedBox(width: 11),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
            Row(children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 400),
                width: 7, height: 7,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _connected
                      ? const Color(0xFF22C55E)
                      : (_reconnecting ? Colors.orange : Colors.red),
                ),
              ),
              const SizedBox(width: 5),
              Text(_statusText,
                  style: TextStyle(
                    color: _connected ? const Color(0xFF22C55E) : Colors.orange,
                    fontSize: 11, fontWeight: FontWeight.w600,
                  )),
            ]),
          ],
        )),
      ]),
      actions: [
        if (_operator?['phone'] != null)
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(color: Colors.white.withAlpha(12), shape: BoxShape.circle),
              child: const Icon(Icons.call_rounded, color: Color(0xFF22C55E), size: 19),
            ),
            onPressed: () => launchUrl(Uri.parse('tel:${_operator!['phone']}')),
          ),
        IconButton(
          icon: Container(
            padding: const EdgeInsets.all(7),
            decoration: BoxDecoration(color: Colors.white.withAlpha(12), shape: BoxShape.circle),
            child: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 19),
          ),
          onPressed: _reconnect,
        ),
      ],
    );
  }

  Widget _buildBanner() => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 14),
    color: Colors.orange.withAlpha(25),
    child: Row(children: [
      if (_reconnecting)
        const SizedBox(width: 14, height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange))
      else
        const Icon(Icons.wifi_off_rounded, color: Colors.red, size: 15),
      const SizedBox(width: 10),
      Expanded(child: Text(
        _reconnecting ? 'Serverga ulanmoqda...' : 'Oflayn — HTTP orqali yuboriladi',
        style: TextStyle(
            color: _reconnecting ? Colors.orange : Colors.red,
            fontSize: 11, fontWeight: FontWeight.w600),
      )),
      if (!_reconnecting)
        GestureDetector(
          onTap: _reconnect,
          child: const Text('Qayta', style: TextStyle(color: Colors.orange, fontSize: 11, fontWeight: FontWeight.w700)),
        ),
    ]),
  );

  Widget _buildMessages() {
    if (_messages.isEmpty) {
      return Center(child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 88, height: 88,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: LinearGradient(colors: [kPrimary.withAlpha(50), const Color(0xFF6366F1).withAlpha(30)]),
            border: Border.all(color: kPrimary.withAlpha(80), width: 1.5),
          ),
          child: const Icon(Icons.support_agent_rounded, size: 44, color: kPrimary),
        ),
        const SizedBox(height: 18),
        const Text('Suhbat boshlang', style: TextStyle(color: Colors.white, fontSize: 19, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        Text('Operator 24/7 yordam beradi',
            style: TextStyle(color: Colors.white.withAlpha(100), fontSize: 13)),
      ]));
    }
    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 8),
      itemCount: _messages.length,
      itemBuilder: (_, i) {
        final msg = _messages[i];
        final isMe = msg['senderId'] == widget.currentUser['id'];
        final showDate = i == 0 || _diffDay(_messages[i - 1], msg);
        return Column(mainAxisSize: MainAxisSize.min, children: [
          if (showDate) _DateLabel(msg['createdAt'] as String?),
          _Bubble(
            msg: msg,
            isMe: isMe,
            isTemp: msg['_temp'] == true,
            onImageTap: (src) => _openImageFullscreen(src),
          ),
        ]);
      },
    );
  }

  bool _diffDay(Map a, Map b) {
    try {
      final da = DateTime.parse(a['createdAt']).toLocal();
      final db = DateTime.parse(b['createdAt']).toLocal();
      return da.day != db.day || da.month != db.month;
    } catch (_) { return false; }
  }

  void _openImageFullscreen(String src) {
    Navigator.push(context, MaterialPageRoute(
      fullscreenDialog: true,
      builder: (_) => _ImageViewer(src: src),
    ));
  }

  Widget _buildInput() {
    final hasText = _ctrl.text.trim().isNotEmpty;
    return Container(
      padding: EdgeInsets.fromLTRB(12, 8, 12, MediaQuery.of(context).padding.bottom + 8),
      decoration: const BoxDecoration(
        color: Color(0xFF111827),
        border: Border(top: BorderSide(color: Color(0xFF1F2937))),
      ),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        // Toolbar: rasm + lokatsiya
        Row(children: [
          _ToolBtn(
            icon: Icons.image_rounded,
            color: Colors.purpleAccent,
            label: 'Rasm',
            onTap: _sendingMedia ? null : _showImageSourceDialog,
          ),
          const SizedBox(width: 6),
          _ToolBtn(
            icon: Icons.location_on_rounded,
            color: const Color(0xFF22C55E),
            label: 'Lokatsiya',
            onTap: _sendingMedia ? null : _sendLocation,
          ),
          if (_sendingMedia) ...[
            const SizedBox(width: 10),
            const SizedBox(width: 14, height: 14,
                child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary)),
            const SizedBox(width: 6),
            Text('Yuborilmoqda...', style: TextStyle(color: Colors.white.withAlpha(120), fontSize: 11)),
          ],
        ]),
        const SizedBox(height: 8),
        // Text input + send
        Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
          Expanded(
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              constraints: const BoxConstraints(minHeight: 46, maxHeight: 120),
              decoration: BoxDecoration(
                color: const Color(0xFF0A0F1E),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(
                  color: hasText ? kPrimary.withAlpha(150) : const Color(0xFF1F2937),
                ),
              ),
              child: TextField(
                controller: _ctrl,
                focusNode: _focusNode,
                style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
                minLines: 1, maxLines: 5,
                textCapitalization: TextCapitalization.sentences,
                onChanged: (_) => setState(() {}),
                onSubmitted: (_) => _send(),
                decoration: const InputDecoration(
                  hintText: 'Xabar yozing...',
                  hintStyle: TextStyle(color: Color(0xFF4B5563), fontSize: 15),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                ),
              ),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: hasText ? _send : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 48, height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: hasText ? const LinearGradient(
                  colors: [Color(0xFF22D3EE), Color(0xFF6366F1)],
                  begin: Alignment.topLeft, end: Alignment.bottomRight,
                ) : null,
                color: hasText ? null : const Color(0xFF1F2937),
              ),
              child: Icon(Icons.send_rounded,
                  color: hasText ? Colors.white : const Color(0xFF4B5563), size: 22),
            ),
          ),
        ]),
      ]),
    );
  }

  Widget _buildNoOperator() {
    return Center(child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 100, height: 100,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Colors.white.withAlpha(8),
            border: Border.all(color: Colors.white.withAlpha(18)),
          ),
          child: const Icon(Icons.support_agent_outlined, size: 50, color: Colors.white38),
        ),
        const SizedBox(height: 24),
        const Text('Operator topilmadi', style: TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 10),
        Text('Kompaniyangizda operator\nro\'yxatdan o\'tmagan',
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white.withAlpha(100), fontSize: 14, height: 1.5)),
        const SizedBox(height: 28),
        TextButton.icon(
          onPressed: _init,
          icon: const Icon(Icons.refresh_rounded, color: kPrimary),
          label: const Text('Qayta urinish', style: TextStyle(color: kPrimary, fontWeight: FontWeight.w700)),
        ),
      ]),
    ));
  }
}

// ── Toolbar button ────────────────────────────────────────────────────────────
class _ToolBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback? onTap;
  const _ToolBtn({required this.icon, required this.color, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedOpacity(
        duration: const Duration(milliseconds: 200),
        opacity: onTap == null ? 0.4 : 1.0,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: color.withAlpha(25),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: color.withAlpha(60)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Icon(icon, color: color, size: 16),
            const SizedBox(width: 5),
            Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w600)),
          ]),
        ),
      ),
    );
  }
}

// ── Date Label ────────────────────────────────────────────────────────────────
class _DateLabel extends StatelessWidget {
  final String? iso;
  const _DateLabel(this.iso);
  @override
  Widget build(BuildContext context) {
    String label = 'Bugun';
    if (iso != null) {
      try {
        final dt = DateTime.parse(iso!).toLocal();
        final now = DateTime.now();
        if (dt.year == now.year && dt.month == now.month && dt.day == now.day) label = 'Bugun';
        else if (dt.year == now.year && dt.month == now.month && now.day - dt.day == 1) label = 'Kecha';
        else label = '${dt.day.toString().padLeft(2,'0')}.${dt.month.toString().padLeft(2,'0')}.${dt.year}';
      } catch (_) {}
    }
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(children: [
        Expanded(child: Divider(color: Colors.white.withAlpha(18))),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 10),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(color: Colors.white.withAlpha(10), borderRadius: BorderRadius.circular(20)),
          child: Text(label, style: TextStyle(color: Colors.white.withAlpha(80), fontSize: 11, fontWeight: FontWeight.w600)),
        ),
        Expanded(child: Divider(color: Colors.white.withAlpha(18))),
      ]),
    );
  }
}

// ── Message Bubble ────────────────────────────────────────────────────────────
class _Bubble extends StatelessWidget {
  final Map<String, dynamic> msg;
  final bool isMe, isTemp;
  final void Function(String src)? onImageTap;
  const _Bubble({required this.msg, required this.isMe, required this.isTemp, this.onImageTap});

  @override
  Widget build(BuildContext context) {
    final text = msg['text'] as String? ?? '';
    final time = _fmt(msg['createdAt'] as String?);

    // ── Rasm xabari
    if (text.startsWith('[IMAGE]:')) {
      final src = text.substring(8);
      return _buildWrapper(
        child: Column(crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: GestureDetector(
              onTap: () => onImageTap?.call(src),
              child: Image.memory(
                base64Decode(src.contains(',') ? src.split(',')[1] : src),
                width: 220,
                height: 180,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  width: 220, height: 100,
                  color: Colors.white10,
                  child: const Icon(Icons.broken_image, color: Colors.white38, size: 40),
                ),
              ),
            ),
          ),
          const SizedBox(height: 5),
          _timeRow(time),
        ]),
        isPadded: false,
      );
    }

    // ── Lokatsiya xabari
    if (text.startsWith('[LOCATION]:')) {
      final coords = text.substring(11).split(',');
      if (coords.length >= 2) {
        final lat = double.tryParse(coords[0]) ?? 0;
        final lng = double.tryParse(coords[1]) ?? 0;
        final googleUrl = 'https://www.google.com/maps?q=$lat,$lng';
        return _buildWrapper(
          isPadded: false,
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              child: SizedBox(
                height: 150, width: 240,
                child: FlutterMap(
                  options: MapOptions(
                    initialCenter: LatLng(lat, lng),
                    initialZoom: 14,
                    interactionOptions: const InteractionOptions(flags: InteractiveFlag.none),
                  ),
                  children: [
                    TileLayer(
                      urlTemplate: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
                      subdomains: const ['a', 'b', 'c', 'd'],
                    ),
                    MarkerLayer(markers: [
                      Marker(
                        point: LatLng(lat, lng),
                        child: const Icon(Icons.location_pin, color: Colors.red, size: 36),
                      ),
                    ]),
                  ],
                ),
              ),
            ),
            GestureDetector(
              onTap: () => launchUrl(Uri.parse(googleUrl)),
              child: Container(
                width: 240,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                child: Row(children: [
                  const Icon(Icons.open_in_new_rounded, color: kPrimary, size: 14),
                  const SizedBox(width: 6),
                  Expanded(child: Text(
                    '${lat.toStringAsFixed(4)}, ${lng.toStringAsFixed(4)}',
                    style: const TextStyle(color: kPrimary, fontSize: 12, fontWeight: FontWeight.w600),
                  )),
                ]),
              ),
            ),
            Padding(
              padding: const EdgeInsets.only(left: 12, right: 12, bottom: 8),
              child: _timeRow(time),
            ),
          ]),
        );
      }
    }

    // ── Oddiy matn
    return _buildWrapper(
      child: Column(crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start, children: [
        Text(text, style: TextStyle(
          color: isMe ? Colors.white : Colors.white.withAlpha(220),
          fontSize: 15, fontWeight: FontWeight.w500, height: 1.4,
        )),
        const SizedBox(height: 4),
        _timeRow(time),
      ]),
    );
  }

  Widget _buildWrapper({required Widget child, bool isPadded = true}) {
    return Padding(
      padding: EdgeInsets.only(bottom: 4, left: isMe ? 56 : 0, right: isMe ? 0 : 56),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          padding: isPadded ? const EdgeInsets.symmetric(horizontal: 14, vertical: 10) : EdgeInsets.zero,
          decoration: BoxDecoration(
            gradient: isMe ? const LinearGradient(
              colors: [Color(0xFF22D3EE), Color(0xFF6366F1)],
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ) : null,
            color: isMe ? null : const Color(0xFF1F2937),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(isMe ? 18 : 4),
              bottomRight: Radius.circular(isMe ? 4 : 18),
            ),
            boxShadow: [BoxShadow(
              color: isMe ? const Color(0xFF6366F1).withAlpha(50) : Colors.black.withAlpha(30),
              blurRadius: 8, offset: const Offset(0, 3),
            )],
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _timeRow(String time) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Text(time, style: TextStyle(color: Colors.white.withAlpha(isMe ? 160 : 100), fontSize: 10)),
      if (isMe) ...[
        const SizedBox(width: 4),
        Icon(isTemp ? Icons.access_time_rounded : Icons.done_all_rounded,
            size: 13, color: Colors.white.withAlpha(isTemp ? 120 : 200)),
      ],
    ]);
  }

  String _fmt(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) { return ''; }
  }
}

// ── Image Fullscreen Viewer ───────────────────────────────────────────────────
class _ImageViewer extends StatelessWidget {
  final String src;
  const _ImageViewer({required this.src});

  @override
  Widget build(BuildContext context) {
    final bytes = base64Decode(src.contains(',') ? src.split(',')[1] : src);
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.download_rounded, color: Colors.white),
            onPressed: () {},
            tooltip: 'Saqlash',
          ),
        ],
      ),
      body: InteractiveViewer(
        minScale: 0.5,
        maxScale: 5.0,
        child: Center(
          child: Image.memory(bytes, fit: BoxFit.contain),
        ),
      ),
    );
  }
}
