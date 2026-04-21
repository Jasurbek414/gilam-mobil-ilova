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
import '../core/chat_service.dart';

class ChatPage extends StatefulWidget {
  final Map<String, dynamic> currentUser;
  const ChatPage({super.key, required this.currentUser});
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  // ── State ────────────────────────────────────────────────────────────────────
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _operator;
  bool _loading = true;
  bool _connected = ChatService.instance.isConnected;
  bool _sendingMedia = false;

  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  final FocusNode _focusNode = FocusNode();
  final ImagePicker _picker = ImagePicker();

  @override
  void initState() {
    super.initState();

    ChatService.instance.onNewMessage = _onNewMessage;
    ChatService.instance.onMessageSent = _onMessageSent;
    ChatService.instance.onConnectionChange = _onConnectionChange;

    ChatService.instance.connect();
    _init();
  }

  @override
  void dispose() {
    ChatService.instance.stopPolling();
    ChatService.instance.onNewMessage = null;
    ChatService.instance.onMessageSent = null;
    ChatService.instance.onConnectionChange = null;
    _ctrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  // ── Init ─────────────────────────────────────────────────────────────────────
  Future<void> _init() async {
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
      ChatService.instance.startPolling(
        partnerId: _operator!['id'].toString(),
        companyId: widget.currentUser['companyId']?.toString(),
      );
    }

    if (mounted) setState(() => _loading = false);
  }

  // ── ChatService Listeners ───────────────────────────────────────────────────
  void _onNewMessage(Map<String, dynamic> msg) {
    if (!mounted) return;
    // Har qanday jo'natuvchidan kelgan yangi xabarni qo'shamiz
    // (Bu ekran faqat support contact bilan chat, shuning uchun
    //  barcha kiruvchi xabarlar shu suhbatga tegishli)
    final senderId = msg['senderId']?.toString() ?? '';
    final myId = widget.currentUser['id']?.toString() ?? '';
    // Faqat boshqadan kelgan xabarlarni qo'shamiz (o'zimiznikini messageSent orqali olamiz)
    if (senderId != myId) {
      // Dublikatni tekshirish
      final alreadyExists = _messages.any((m) => m['id']?.toString() == msg['id']?.toString() && msg['id'] != null);
      if (!alreadyExists) {
        setState(() => _messages.add(msg));
        _scrollToBottom();
      }
    }
  }

  void _onMessageSent(Map<String, dynamic> msg) {
    if (!mounted) return;
    setState(() {
      final idx = _messages.indexWhere((m) => m['_temp'] == true);
      if (idx >= 0) _messages[idx] = msg;
      else _messages.add(msg);
    });
    _scrollToBottom();
  }

  void _onConnectionChange(bool connected) {
    if (!mounted) return;
    setState(() => _connected = connected);
  }

  // ── Send text ────────────────────────────────────────────────────────────────
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

    ChatService.instance.sendMessage(
      recipientId: _operator!['id'].toString(),
      text: text,
      companyId: widget.currentUser['companyId']?.toString(),
    );
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

      ChatService.instance.sendMessage(
        recipientId: _operator!['id'].toString(),
        text: text,
        companyId: widget.currentUser['companyId']?.toString(),
      );
    } catch (e) {
      debugPrint('[Chat] Image error: $e');
      if (mounted) setState(() => _sendingMedia = false);
    }
  }

  // OBSOLETE MENU REMOVED

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

      ChatService.instance.sendMessage(
        recipientId: _operator!['id'].toString(),
        text: text,
        companyId: widget.currentUser['companyId']?.toString(),
      );
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
    ChatService.instance.reconnect();
  }

  // ── UI ───────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF0F1621), // Telegram-like dark mode
      appBar: _buildAppBar(),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFF5288C1), strokeWidth: 2.5))
          : _operator == null
              ? _buildNoOperator()
              : Column(children: [
                  if (!_connected) _buildBanner(),
                  Expanded(
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Color(0xFF0F1621),
                      ),
                      child: _buildMessages(),
                    ),
                  ),
                  _buildInput(),
                ]),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    final name = _operator?['fullName'] as String? ?? 'Operator';
    return AppBar(
      backgroundColor: const Color(0xFF18222D),
      elevation: 1,
      shadowColor: Colors.black45,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new_rounded, color: Colors.white, size: 20),
        onPressed: () => Navigator.pop(context),
      ),
      titleSpacing: 0,
      title: Row(children: [
        Container(
          width: 38, height: 38,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: const Color(0xFF5288C1),
          ),
          child: Center(child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : 'O',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 16),
          )),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(name, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600)),
            Text(_connected ? 'online' : 'bog\'lanmoqda...',
                style: TextStyle(
                  color: _connected ? const Color(0xFF43A047) : Colors.orange,
                  fontSize: 12, fontWeight: FontWeight.w400,
                )),
          ],
        )),
      ]),
      actions: [
        if (_operator?['phone'] != null)
          IconButton(
            icon: const Icon(Icons.call_rounded, color: Colors.white, size: 22),
            onPressed: () => launchUrl(Uri.parse('tel:${_operator!['phone']}')),
          ),
        IconButton(
          icon: const Icon(Icons.refresh_rounded, color: Colors.white70, size: 22),
          onPressed: _reconnect,
        ),
      ],
    );
  }

  Widget _buildBanner() => Container(
    width: double.infinity,
    padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 14),
    color: Colors.orange.withOpacity(0.9),
    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
      const SizedBox(width: 12, height: 12,
          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white)),
      const SizedBox(width: 10),
      const Text('Tarmoq kutilmoqda...', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w500)),
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
        final isMe = msg['senderId'].toString() == widget.currentUser['id'].toString();
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
      padding: EdgeInsets.only(left: 6, right: 6, bottom: MediaQuery.of(context).padding.bottom + 6, top: 4),
      decoration: const BoxDecoration(
        color: Color(0xFF18222D),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        IconButton(
          icon: const Icon(Icons.attach_file_rounded, color: Colors.white54, size: 26),
          onPressed: _sendingMedia ? null : () => _showAttachmentMenu(),
        ),
        Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            constraints: const BoxConstraints(minHeight: 46, maxHeight: 120),
            margin: const EdgeInsets.only(bottom: 2),
            decoration: BoxDecoration(
              color: const Color(0xFF0F1621),
              borderRadius: BorderRadius.circular(24),
            ),
            child: TextField(
              controller: _ctrl,
              focusNode: _focusNode,
              style: const TextStyle(color: Colors.white, fontSize: 16, height: 1.2),
              minLines: 1, maxLines: 5,
              textCapitalization: TextCapitalization.sentences,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Xabar...',
                hintStyle: TextStyle(color: Colors.white38, fontSize: 16),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              ),
            ),
          ),
        ),
        const SizedBox(width: 6),
        Container(
          margin: const EdgeInsets.only(bottom: 2),
          child: GestureDetector(
            onTap: hasText ? _send : null,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              width: 48, height: 48,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: hasText ? const Color(0xFF4C8CD6) : const Color(0xFF242F3D),
              ),
              child: Icon(Icons.send_rounded,
                  color: hasText ? Colors.white : Colors.white38, size: 22),
            ),
          ),
        ),
      ]),
    );
  }

  void _showAttachmentMenu() {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF18222D),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (_) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20),
          child: Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
            _AttachMenuBtn(
              icon: Icons.camera_alt_rounded,
              color: Colors.pinkAccent,
              label: 'Kamera',
              onTap: () { Navigator.pop(context); _pickAndSendImage(ImageSource.camera); }
            ),
            _AttachMenuBtn(
              icon: Icons.photo_library_rounded,
              color: Colors.purpleAccent,
              label: 'Galereya',
              onTap: () { Navigator.pop(context); _pickAndSendImage(ImageSource.gallery); }
            ),
            _AttachMenuBtn(
              icon: Icons.location_on_rounded,
              color: Colors.greenAccent,
              label: 'Lokatsiya',
              onTap: () { Navigator.pop(context); _sendLocation(); }
            ),
          ]),
        ),
      ),
    );
  }

  Widget _buildNoOperator() {
    return Center(child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.support_agent_rounded, size: 60, color: Colors.white24),
        const SizedBox(height: 16),
        const Text('Operator topilmadi', style: TextStyle(color: Colors.white70, fontSize: 18, fontWeight: FontWeight.w600)),
        const SizedBox(height: 28),
        TextButton.icon(
          onPressed: _init,
          icon: const Icon(Icons.refresh_rounded, color: Color(0xFF4C8CD6)),
          label: const Text('Qayta urinish', style: TextStyle(color: Color(0xFF4C8CD6), fontSize: 16)),
        ),
      ]),
    ));
  }
}

class _AttachMenuBtn extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String label;
  final VoidCallback onTap;
  const _AttachMenuBtn({required this.icon, required this.color, required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          width: 56, height: 56,
          decoration: BoxDecoration(shape: BoxShape.circle, color: color.withOpacity(0.15)),
          child: Icon(icon, color: color, size: 28),
        ),
        const SizedBox(height: 8),
        Text(label, style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.w500)),
      ]),
    );
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
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
          decoration: BoxDecoration(color: const Color(0xFF18222D), borderRadius: BorderRadius.circular(20)),
          child: Text(label, style: const TextStyle(color: Colors.white60, fontSize: 12, fontWeight: FontWeight.w500)),
        ),
      ),
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
      child: Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Text(text, style: const TextStyle(
          color: Colors.white,
          fontSize: 16, fontWeight: FontWeight.w400, height: 1.3,
        )),
        const SizedBox(height: 2),
        _timeRow(time),
      ]),
    );
  }

  Widget _buildWrapper({required Widget child, bool isPadded = true}) {
    return Padding(
      padding: EdgeInsets.only(bottom: 6, left: isMe ? 60 : 0, right: isMe ? 0 : 60),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          padding: isPadded ? const EdgeInsets.symmetric(horizontal: 14, vertical: 8) : EdgeInsets.zero,
          decoration: BoxDecoration(
            color: isMe ? const Color(0xFF2B5278) : const Color(0xFF182533),
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(16),
              topRight: const Radius.circular(16),
              bottomLeft: Radius.circular(isMe ? 16 : 4),
              bottomRight: Radius.circular(isMe ? 4 : 16),
            ),
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _timeRow(String time) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      Text(time, style: const TextStyle(color: Colors.white54, fontSize: 11)),
      if (isMe) ...[
        const SizedBox(width: 4),
        Icon(isTemp ? Icons.access_time_rounded : Icons.done_all_rounded,
            size: 14, color: isTemp ? Colors.white54 : const Color(0xFF64B5F6)),
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
