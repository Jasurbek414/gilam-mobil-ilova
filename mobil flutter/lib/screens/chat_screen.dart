import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../core/chat_service.dart';

class ChatPage extends StatefulWidget {
  final Map<String, dynamic> currentUser;
  const ChatPage({super.key, required this.currentUser});
  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> with WidgetsBindingObserver {
  final _chat = ChatService.instance;
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _operator;
  bool _loading = true;
  bool _connected = false;
  String _statusText = 'Ulanmoqda...';
  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _init();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _chat.onNewMessage = null;
    _chat.onMessageSent = null;
    _chat.onConnectionChange = null;
    _ctrl.dispose();
    _scrollCtrl.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && !_connected) {
      _chat.disconnect();
      _chat.connect();
    }
  }

  // ── Init ───────────────────────────────────────────────────────────────────
  Future<void> _init() async {
    // Operator
    try {
      final op = await getSupportContact();
      if (mounted && op != null) setState(() => _operator = op);
    } catch (e) {
      debugPrint('[Chat] Operator error: $e');
    }

    // Tarix
    if (_operator != null) {
      try {
        final history = await getMessageHistory(_operator!['id']);
        if (mounted) {
          setState(() => _messages = List<Map<String, dynamic>>.from(history));
          _scrollToBottom();
        }
      } catch (e) {
        debugPrint('[Chat] History error: $e');
      }
    }

    // Chat service callbacks
    _chat.onConnectionChange = (connected) {
      if (mounted) {
        setState(() {
          _connected = connected;
          _statusText = connected ? 'Online' : 'Qayta ulanmoqda...';
        });
      }
    };

    _chat.onNewMessage = (msg) {
      // Faqat shu operatordan kelgan xabarlar
      if (_operator != null && msg['senderId'] == _operator!['id'] && mounted) {
        setState(() => _messages.add(msg));
        _scrollToBottom();
      }
    };

    _chat.onMessageSent = (confirmed) {
      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m['_temp'] == true);
          if (idx >= 0) _messages[idx] = confirmed;
          else _messages.add(confirmed);
        });
        _scrollToBottom();
      }
    };

    // Ulanish
    await _chat.connect();
    if (mounted) {
      setState(() {
        _loading = false;
        _connected = _chat.isConnected;
        _statusText = _connected ? 'Online' : 'Ulanmoqda...';
      });
    }
  }

  // ── Send ───────────────────────────────────────────────────────────────────
  void _send() {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _operator == null) return;
    HapticFeedback.lightImpact();

    final tempMsg = <String, dynamic>{
      'id': 'tmp_${DateTime.now().millisecondsSinceEpoch}',
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

    if (_chat.isConnected) {
      _chat.send('sendMessage', {
        'recipientId': _operator!['id'],
        'text': text,
        'companyId': widget.currentUser['companyId'],
      });
    } else {
      _sendHttp(text, tempMsg['id'] as String);
    }
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
    } catch (_) {}
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

  // ── Build ──────────────────────────────────────────────────────────────────
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
              begin: Alignment.topLeft, end: Alignment.bottomRight,
            ),
          ),
          child: Center(child: Text(
            name.isNotEmpty ? name[0].toUpperCase() : 'O',
            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 17),
          )),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(name, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
          Row(children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 500),
              width: 7, height: 7,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: _connected ? const Color(0xFF22C55E) : Colors.orange,
              ),
            ),
            const SizedBox(width: 5),
            Text(_statusText,
                style: TextStyle(
                  color: _connected ? const Color(0xFF22C55E) : Colors.orange,
                  fontSize: 11, fontWeight: FontWeight.w600,
                )),
          ]),
        ])),
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
          onPressed: () {
            _chat.disconnect();
            Future.delayed(const Duration(milliseconds: 500), () => _chat.connect());
          },
        ),
      ],
    );
  }

  Widget _buildBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 7, horizontal: 14),
      color: Colors.orange.withAlpha(25),
      child: Row(children: [
        const SizedBox(width: 14, height: 14,
            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange)),
        const SizedBox(width: 10),
        const Expanded(child: Text(
          'Serverga ulanmoqda... Xabar HTTP orqali yuboriladi',
          style: TextStyle(color: Colors.orange, fontSize: 11, fontWeight: FontWeight.w600),
        )),
      ]),
    );
  }

  Widget _buildMessages() {
    if (_messages.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
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
        ]),
      );
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
          _Bubble(msg: msg, isMe: isMe, isTemp: msg['_temp'] == true),
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

  Widget _buildInput() {
    final hasText = _ctrl.text.trim().isNotEmpty;
    return Container(
      padding: EdgeInsets.fromLTRB(12, 10, 12, MediaQuery.of(context).padding.bottom + 10),
      decoration: const BoxDecoration(
        color: Color(0xFF111827),
        border: Border(top: BorderSide(color: Color(0xFF1F2937))),
      ),
      child: Row(crossAxisAlignment: CrossAxisAlignment.end, children: [
        Expanded(
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            constraints: const BoxConstraints(minHeight: 46, maxHeight: 120),
            decoration: BoxDecoration(
              color: const Color(0xFF0A0F1E),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: hasText ? kPrimary.withAlpha(150) : const Color(0xFF1F2937),
                width: 1.5,
              ),
            ),
            child: TextField(
              controller: _ctrl,
              focusNode: _focusNode,
              style: const TextStyle(color: Colors.white, fontSize: 15, height: 1.4),
              minLines: 1, maxLines: 5,
              textCapitalization: TextCapitalization.sentences,
              onChanged: (_) => setState(() {}),
              decoration: const InputDecoration(
                hintText: 'Xabar yozing...',
                hintStyle: TextStyle(color: Color(0xFF4B5563), fontSize: 15),
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: 18, vertical: 12),
              ),
              onSubmitted: (_) => _send(),
            ),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: _send,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            width: 48, height: 48,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: hasText
                  ? const LinearGradient(
                      colors: [Color(0xFF22D3EE), Color(0xFF6366F1)],
                      begin: Alignment.topLeft, end: Alignment.bottomRight,
                    )
                  : null,
              color: hasText ? null : const Color(0xFF1F2937),
            ),
            child: Icon(Icons.send_rounded,
                color: hasText ? Colors.white : const Color(0xFF4B5563), size: 22),
          ),
        ),
      ]),
    );
  }

  Widget _buildNoOperator() {
    return Center(
      child: Padding(
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
          Text('Kompaniyangizda operator\nro\'yxatdan o\'tmagan bo\'lishi mumkin',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white.withAlpha(100), fontSize: 14, height: 1.5)),
          const SizedBox(height: 28),
          TextButton.icon(
            onPressed: _init,
            icon: const Icon(Icons.refresh_rounded, color: kPrimary),
            label: const Text('Qayta urinish', style: TextStyle(color: kPrimary, fontWeight: FontWeight.w700)),
          ),
        ]),
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
  const _Bubble({required this.msg, required this.isMe, required this.isTemp});

  @override
  Widget build(BuildContext context) {
    final text = msg['text'] as String? ?? '';
    final time = _fmt(msg['createdAt'] as String?);
    return Padding(
      padding: EdgeInsets.only(
        bottom: 4, left: isMe ? 56 : 0, right: isMe ? 0 : 56,
      ),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
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
          child: Column(
            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Text(text, style: TextStyle(
                color: isMe ? Colors.white : Colors.white.withAlpha(220),
                fontSize: 15, fontWeight: FontWeight.w500, height: 1.4,
              )),
              const SizedBox(height: 4),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Text(time, style: TextStyle(color: Colors.white.withAlpha(isMe ? 160 : 100), fontSize: 10)),
                if (isMe) ...[
                  const SizedBox(width: 4),
                  Icon(
                    isTemp ? Icons.access_time_rounded : Icons.done_all_rounded,
                    size: 13,
                    color: Colors.white.withAlpha(isTemp ? 120 : 200),
                  ),
                ],
              ]),
            ],
          ),
        ),
      ),
    );
  }

  String _fmt(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) { return ''; }
  }
}
