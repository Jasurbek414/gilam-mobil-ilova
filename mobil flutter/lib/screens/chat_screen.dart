import 'dart:async';
import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/api.dart';
import '../core/theme.dart';

class ChatPage extends StatefulWidget {
  final Map<String, dynamic> currentUser;
  const ChatPage({super.key, required this.currentUser});

  @override
  State<ChatPage> createState() => _ChatPageState();
}

class _ChatPageState extends State<ChatPage> {
  IO.Socket? _socket;
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _operator;
  bool _loading = true;
  bool _connected = false;
  bool _reconnecting = false;
  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();
  Timer? _reconnectTimer;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    try {
      _operator = await getSupportContact();
    } catch (_) {}

    if (_operator != null) {
      try {
        final history = await getMessageHistory(_operator!['id']);
        if (mounted) setState(() => _messages = history.cast<Map<String, dynamic>>());
        _scrollToBottom();
      } catch (_) {}
    }

    _connectSocket();
    if (mounted) setState(() => _loading = false);
  }

  void _connectSocket() async {
    final token = await getToken();
    if (token == null) return;

    // Correct: base URL + namespace via path
    _socket = IO.io(
      'https://gilam-api.ecos.uz/chat',
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setPath('/socket.io/')
          .setQuery({'token': token})
          .setExtraHeaders({'authorization': 'Bearer $token'})
          .disableAutoConnect()
          .setTimeout(10000)
          .setReconnectionAttempts(5)
          .setReconnectionDelay(2000)
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('[Chat] ✅ Connected to chat namespace');
      if (mounted) setState(() { _connected = true; _reconnecting = false; });
    });

    _socket!.onConnectError((err) {
      debugPrint('[Chat] ❌ Connect error: $err');
      if (mounted) setState(() { _connected = false; _reconnecting = true; });
    });

    _socket!.onDisconnect((_) {
      debugPrint('[Chat] ⚠️ Disconnected');
      if (mounted) setState(() => _connected = false);
    });

    _socket!.onError((err) {
      debugPrint('[Chat] Error: $err');
    });

    _socket!.on('newMessage', (data) {
      debugPrint('[Chat] New message: $data');
      final msg = (data is Map) ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      if (mounted) {
        setState(() => _messages.add(msg));
        _scrollToBottom();
      }
    });

    _socket!.on('messageSent', (data) {
      final msg = (data is Map) ? Map<String, dynamic>.from(data) : <String, dynamic>{};
      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m['_temp'] == true);
          if (idx >= 0) _messages[idx] = msg;
          else _messages.add(msg);
        });
        _scrollToBottom();
      }
    });

    _socket!.connect();
  }

  void _send() {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _operator == null) return;

    final tempMsg = {
      'id': DateTime.now().millisecondsSinceEpoch.toString(),
      'text': text,
      'senderId': widget.currentUser['id'],
      'recipientId': _operator!['id'],
      'createdAt': DateTime.now().toIso8601String(),
      '_temp': true,
    };
    setState(() => _messages.add(tempMsg));
    _ctrl.clear();
    _scrollToBottom();

    if (_connected) {
      _socket?.emit('sendMessage', {
        'recipientId': _operator!['id'],
        'text': text,
        'companyId': widget.currentUser['companyId'],
      });
    } else {
      // Retry via HTTP if socket not connected
      _sendViaHttp(text);
    }
  }

  Future<void> _sendViaHttp(String text) async {
    try {
      await apiRequest('/messages', method: 'POST', body: {
        'recipientId': _operator!['id'],
        'text': text,
        'companyId': widget.currentUser['companyId'],
      });
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

  @override
  void dispose() {
    _reconnectTimer?.cancel();
    _socket?.disconnect();
    _socket?.dispose();
    _ctrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      appBar: _buildAppBar(),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : _operator == null
              ? _buildNoOperator()
              : Column(
                  children: [
                    if (!_connected) _buildBanner(),
                    Expanded(child: _buildMessages()),
                    _buildInput(),
                  ],
                ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: kSurface,
      elevation: 0,
      leading: IconButton(
        icon: const Icon(Icons.arrow_back_ios_new, color: kTextPrimary),
        onPressed: () => Navigator.pop(context),
      ),
      title: _operator != null
          ? Row(children: [
              _Avatar(name: _operator!['fullName'] ?? 'O', size: 38),
              const SizedBox(width: 10),
              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  _operator!['fullName'] ?? 'Operator',
                  style: const TextStyle(color: kTextPrimary, fontSize: 15, fontWeight: FontWeight.w800),
                ),
                Row(children: [
                  Container(
                    width: 7, height: 7,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: _connected ? kPrimary : Colors.red,
                    ),
                  ),
                  const SizedBox(width: 5),
                  Text(
                    _connected ? 'Online' : (_reconnecting ? 'Ulanmoqda...' : 'Offline'),
                    style: TextStyle(
                      color: _connected ? kPrimary : kTextMuted,
                      fontSize: 11, fontWeight: FontWeight.w600,
                    ),
                  ),
                ]),
              ]),
            ])
          : const Text('Operator', style: TextStyle(color: kTextPrimary)),
      actions: [
        if (_operator?['phone'] != null)
          Container(
            margin: const EdgeInsets.only(right: 8),
            child: IconButton(
              icon: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(color: kPrimary.withAlpha(30), shape: BoxShape.circle),
                child: const Icon(Icons.call, color: kPrimary, size: 20),
              ),
              onPressed: () => launchUrl(Uri.parse('tel:${_operator!['phone']}')),
            ),
          ),
      ],
    );
  }

  Widget _buildBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 16),
      color: Colors.orange.withAlpha(30),
      child: Row(children: [
        const Icon(Icons.wifi_off, color: Colors.orange, size: 16),
        const SizedBox(width: 8),
        Expanded(child: Text(
          _reconnecting ? 'Serverga ulanmoqda...' : 'Oflayn rejim — xabarlar yuborilmaydi',
          style: const TextStyle(color: Colors.orange, fontSize: 12, fontWeight: FontWeight.w600),
        )),
        if (_reconnecting) const SizedBox(
          width: 14, height: 14,
          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.orange),
        ),
      ]),
    );
  }

  Widget _buildMessages() {
    if (_messages.isEmpty) {
      return Center(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            width: 80, height: 80,
            decoration: BoxDecoration(color: kPrimary.withAlpha(20), shape: BoxShape.circle),
            child: const Icon(Icons.chat_bubble_outline_rounded, size: 38, color: kPrimary),
          ),
          const SizedBox(height: 16),
          const Text("Suhbat boshlang", style: TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          const Text("Operator sizga yordam beradi", style: TextStyle(color: kTextMuted)),
        ]),
      );
    }
    return ListView.builder(
      controller: _scrollCtrl,
      padding: const EdgeInsets.fromLTRB(12, 16, 12, 8),
      itemCount: _messages.length,
      itemBuilder: (_, i) {
        final msg = _messages[i];
        final isMe = msg['senderId'] == widget.currentUser['id'];
        return _MessageBubble(msg: msg, isMe: isMe, isTemp: msg['_temp'] == true);
      },
    );
  }

  Widget _buildInput() {
    return Container(
      padding: EdgeInsets.fromLTRB(12, 10, 12, MediaQuery.of(context).padding.bottom + 10),
      decoration: BoxDecoration(
        color: kSurface,
        border: Border(top: BorderSide(color: kSurface2, width: 1)),
      ),
      child: Row(children: [
        Expanded(
          child: TextField(
            controller: _ctrl,
            style: const TextStyle(color: kTextPrimary, fontSize: 15),
            minLines: 1, maxLines: 4,
            textCapitalization: TextCapitalization.sentences,
            decoration: InputDecoration(
              hintText: 'Xabar yozing...',
              hintStyle: const TextStyle(color: kTextMuted),
              filled: true,
              fillColor: kSurface2,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(26),
                borderSide: BorderSide.none,
              ),
              contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            ),
            onSubmitted: (_) => _send(),
          ),
        ),
        const SizedBox(width: 8),
        GestureDetector(
          onTap: _send,
          child: Container(
            width: 50, height: 50,
            decoration: const BoxDecoration(color: kPrimary, shape: BoxShape.circle),
            child: const Icon(Icons.send_rounded, color: Colors.black, size: 22),
          ),
        ),
      ]),
    );
  }

  Widget _buildNoOperator() {
    return Center(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(20)),
          child: const Icon(Icons.support_agent_outlined, size: 64, color: kTextMuted),
        ),
        const SizedBox(height: 20),
        const Text("Operator topilmadi", style: TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text("Administrator bilan bog'laning", style: TextStyle(color: kTextMuted)),
      ]),
    );
  }
}

// ── Avatar ────────────────────────────────────────────────────────────────────
class _Avatar extends StatelessWidget {
  final String name;
  final double size;
  const _Avatar({required this.name, required this.size});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: kPrimary.withAlpha(30)),
      child: Center(child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(color: kPrimary, fontWeight: FontWeight.w900, fontSize: size * 0.42),
      )),
    );
  }
}

// ── Message Bubble ────────────────────────────────────────────────────────────
class _MessageBubble extends StatelessWidget {
  final Map<String, dynamic> msg;
  final bool isMe, isTemp;
  const _MessageBubble({required this.msg, required this.isMe, required this.isTemp});

  @override
  Widget build(BuildContext context) {
    final text = msg['text'] as String? ?? '';
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Align(
        alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
        child: Container(
          constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.72),
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
          decoration: BoxDecoration(
            color: isMe ? kPrimary : kSurface,
            borderRadius: BorderRadius.only(
              topLeft: const Radius.circular(18),
              topRight: const Radius.circular(18),
              bottomLeft: Radius.circular(isMe ? 18 : 4),
              bottomRight: Radius.circular(isMe ? 4 : 18),
            ),
            boxShadow: [BoxShadow(color: Colors.black.withAlpha(20), blurRadius: 4, offset: const Offset(0, 2))],
          ),
          child: Column(
            crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
            children: [
              Text(text, style: TextStyle(
                color: isMe ? Colors.black : kTextPrimary,
                fontSize: 15, fontWeight: FontWeight.w500, height: 1.3,
              )),
              const SizedBox(height: 4),
              Row(mainAxisSize: MainAxisSize.min, children: [
                Text(
                  _fmt(msg['createdAt'] as String?),
                  style: TextStyle(color: isMe ? Colors.black54 : kTextMuted, fontSize: 10),
                ),
                if (isMe) ...[
                  const SizedBox(width: 3),
                  Icon(
                    isTemp ? Icons.access_time : Icons.done_all,
                    size: 12,
                    color: isTemp ? Colors.black38 : Colors.black54,
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
