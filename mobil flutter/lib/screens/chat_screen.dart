import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;
import '../core/api.dart';
import '../core/theme.dart';

class ChatScreen extends StatefulWidget {
  final Map<String, dynamic> currentUser;
  final Map<String, dynamic>? operator0; // pre-loaded operator info

  const ChatScreen({super.key, required this.currentUser, this.operator0});

  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  IO.Socket? _socket;
  List<Map<String, dynamic>> _messages = [];
  Map<String, dynamic>? _operator;
  bool _loading = true;
  bool _connected = false;
  final TextEditingController _ctrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    // Load support contact
    if (widget.operator0 != null) {
      _operator = widget.operator0;
    } else {
      try {
        _operator = await getSupportContact();
      } catch (_) {}
    }

    if (_operator != null) {
      // Load message history
      try {
        final history = await getMessageHistory(_operator!['id']);
        if (mounted) {
          setState(() => _messages = history.cast<Map<String, dynamic>>());
          _scrollToBottom();
        }
      } catch (_) {}
    }

    // Connect WebSocket
    _connectSocket();
    setState(() => _loading = false);
  }

  void _connectSocket() async {
    final token = await getToken();
    if (token == null) return;

    _socket = IO.io(
      'https://gilam-api.ecos.uz/chat',
      IO.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setPath('/socket.io/')
          .setExtraHeaders({'authorization': 'Bearer $token'})
          .disableAutoConnect()
          .build(),
    );

    _socket!.onConnect((_) {
      if (mounted) setState(() => _connected = true);
    });

    _socket!.onDisconnect((_) {
      if (mounted) setState(() => _connected = false);
    });

    _socket!.on('newMessage', (data) {
      final msg = data as Map<String, dynamic>;
      if (mounted) {
        setState(() => _messages.add(msg));
        _scrollToBottom();
      }
    });

    _socket!.on('messageSent', (data) {
      final msg = data as Map<String, dynamic>;
      if (mounted) {
        // Update the temporary message with real one from server
        setState(() {
          final idx = _messages.indexWhere((m) => m['_temp'] == true);
          if (idx >= 0) {
            _messages[idx] = msg;
          } else {
            _messages.add(msg);
          }
        });
        _scrollToBottom();
      }
    });

    _socket!.connect();
  }

  void _send() {
    final text = _ctrl.text.trim();
    if (text.isEmpty || _operator == null) return;

    // Optimistic UI
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

    _socket?.emit('sendMessage', {
      'recipientId': _operator!['id'],
      'text': text,
      'companyId': widget.currentUser['companyId'],
    });
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
    _socket?.disconnect();
    _ctrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      appBar: AppBar(
        title: _operator != null
            ? Row(children: [
                _Avatar(name: _operator!['fullName'] ?? 'Operator', size: 36),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(_operator!['fullName'] ?? 'Operator',
                      style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                  Text(_connected ? '🟢 Ulanildi' : '🔴 Uzildi',
                      style: const TextStyle(fontSize: 11, color: kTextMuted)),
                ]),
              ])
            : const Text('Operator bilan bog\'lanish'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          if (_operator?['phone'] != null)
            IconButton(
              icon: const Icon(Icons.call, color: kPrimary),
              onPressed: () => launchUrl(Uri.parse('tel:${_operator!['phone']}')),
            ),
        ],
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : _operator == null
              ? _NoOperator()
              : Column(
                  children: [
                    Expanded(
                      child: _messages.isEmpty
                          ? _EmptyChat()
                          : ListView.builder(
                              controller: _scrollCtrl,
                              padding: const EdgeInsets.all(16),
                              itemCount: _messages.length,
                              itemBuilder: (_, i) {
                                final msg = _messages[i];
                                final isMe = msg['senderId'] == widget.currentUser['id'];
                                final isTemp = msg['_temp'] == true;
                                return _MessageBubble(
                                  msg: msg, isMe: isMe, isTemp: isTemp);
                              },
                            ),
                    ),
                    _InputBar(ctrl: _ctrl, onSend: _send),
                  ],
                ),
    );
  }
}

class _Avatar extends StatelessWidget {
  final String name;
  final double size;
  const _Avatar({required this.name, required this.size});
  @override
  Widget build(BuildContext context) {
    return Container(
      width: size, height: size,
      decoration: BoxDecoration(shape: BoxShape.circle, color: kPrimary.withOpacity(0.15)),
      child: Center(child: Text(
        name.isNotEmpty ? name[0].toUpperCase() : '?',
        style: TextStyle(color: kPrimary, fontWeight: FontWeight.w800, fontSize: size * 0.4),
      )),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Map<String, dynamic> msg;
  final bool isMe, isTemp;
  const _MessageBubble({required this.msg, required this.isMe, required this.isTemp});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        decoration: BoxDecoration(
          color: isMe ? kPrimary : kSurface,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(20),
            topRight: const Radius.circular(20),
            bottomLeft: Radius.circular(isMe ? 20 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 20),
          ),
        ),
        child: Column(
          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(msg['text'] ?? '', style: TextStyle(color: isMe ? kBackground : kTextPrimary, fontSize: 15, fontWeight: FontWeight.w500)),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(msg['createdAt']),
                  style: TextStyle(color: isMe ? kBackground.withOpacity(0.6) : kTextMuted, fontSize: 10),
                ),
                if (isMe && isTemp) ...[
                  const SizedBox(width: 4),
                  Icon(Icons.access_time, size: 10, color: kBackground.withOpacity(0.6)),
                ] else if (isMe) ...[
                  const SizedBox(width: 4),
                  Icon(Icons.done_all, size: 11, color: kBackground.withOpacity(0.7)),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(String? iso) {
    if (iso == null) return '';
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}

class _InputBar extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onSend;
  const _InputBar({required this.ctrl, required this.onSend});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.of(context).padding.bottom + 8),
      decoration: const BoxDecoration(
        color: kSurface,
        border: Border(top: BorderSide(color: kSurface2)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: ctrl,
              style: const TextStyle(color: kTextPrimary),
              minLines: 1,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'Xabar yozing...',
                hintStyle: const TextStyle(color: kTextMuted),
                filled: true,
                fillColor: kSurface2,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(24), borderSide: BorderSide.none),
                contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              ),
              onSubmitted: (_) => onSend(),
            ),
          ),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onSend,
            child: Container(
              width: 48, height: 48,
              decoration: const BoxDecoration(color: kPrimary, shape: BoxShape.circle),
              child: const Icon(Icons.send_rounded, color: kBackground, size: 22),
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyChat extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 80, height: 80, decoration: BoxDecoration(color: kPrimary.withOpacity(0.1), shape: BoxShape.circle), child: const Icon(Icons.chat_bubble_outline, size: 36, color: kPrimary)),
          const SizedBox(height: 16),
          const Text("Operator bilan bog'laning", style: TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          const Text("Savollaringizni yozing", style: TextStyle(color: kTextSecondary), textAlign: TextAlign.center),
        ],
      ),
    );
  }
}

class _NoOperator extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return const Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.support_agent_outlined, size: 64, color: Color(0xFF27272a)),
          SizedBox(height: 16),
          Text("Operator topilmadi", style: TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
          SizedBox(height: 8),
          Text("Administrator bilan bog'laning", style: TextStyle(color: kTextSecondary)),
        ],
      ),
    );
  }
}
