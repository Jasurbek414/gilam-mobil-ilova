import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';

class ProfileScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  const ProfileScreen({super.key, required this.user, required this.onLogout});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  List<dynamic> _expenses = [];
  bool _loading = true;
  String? _modalType; // 'INCOME' | 'EXPENSE' | null
  String? _editingId;
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _amountCtrl = TextEditingController();
  final TextEditingController _commentCtrl = TextEditingController();
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _titleCtrl.dispose();
    _amountCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final data = await getDriverExpenses(widget.user['id']);
      if (mounted) setState(() { _expenses = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _openModal(String type, [Map<String, dynamic>? exp]) {
    _editingId = exp?['id'];
    _titleCtrl.text = exp?['title'] ?? '';
    _amountCtrl.text = exp?['amount']?.toString() ?? '';
    final rawComment = exp?['comment'] as String? ?? '';
    _commentCtrl.text = rawComment.replaceFirst(RegExp(r"^(Kirim|Xarajat): Haydovchi mobil ilovasidan qo'shildi\.\s*"), '');
    setState(() => _modalType = type);
  }

  void _closeModal() {
    setState(() { _modalType = null; _editingId = null; });
    _titleCtrl.clear(); _amountCtrl.clear(); _commentCtrl.clear();
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty || _amountCtrl.text.trim().isEmpty) {
      _showSnack('Nom va summani kiriting!', Colors.red.shade900);
      return;
    }
    setState(() => _saving = true);
    final isIncome = _modalType == 'INCOME';
    final comment = '${isIncome ? 'Kirim' : 'Xarajat'}: Haydovchi mobil ilovasidan qo\'shildi. ${_commentCtrl.text}';
    try {
      if (_editingId != null) {
        await updateExpense(_editingId!, {
          'title': _titleCtrl.text.trim(),
          'amount': num.parse(_amountCtrl.text),
          'type': _modalType,
          'comment': comment,
        });
      } else {
        await createExpense({
          'companyId': widget.user['companyId'],
          'userId': widget.user['id'],
          'title': _titleCtrl.text.trim(),
          'amount': num.parse(_amountCtrl.text),
          'type': _modalType,
          'category': 'Logistika',
          'comment': comment,
          'date': DateTime.now().toIso8601String().split('T')[0],
        });
      }
      _closeModal();
      await _load();
    } catch (e) {
      _showSnack(e.toString().replaceFirst('Exception: ', ''), Colors.red.shade900);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete(String id, String title) async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: const Text("O'chirish", style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.w800)),
        content: Text('"$title" ni o\'chirmoqchimisiz?', style: const TextStyle(color: kTextSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor', style: TextStyle(color: kTextMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("O'chirish"),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try {
      await deleteExpense(id);
      await _load();
    } catch (e) {
      _showSnack(e.toString(), Colors.red.shade900);
    }
  }

  void _showSnack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: color));
  }

  Future<void> _confirmLogout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: const Text('Ishonchingiz komilmi?', style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.w800)),
        content: const Text('Hisobingizdan chiqib ketsangiz buyurtmalar qabul qila olmaysiz.', style: TextStyle(color: kTextSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Bekor', style: TextStyle(color: kTextMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('Ha, chiqish'),
          ),
        ],
      ),
    );
    if (ok == true) widget.onLogout();
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final name = user['fullName'] ?? 'Foydalanuvchi';

    return Stack(
      children: [
        Scaffold(
          backgroundColor: kBackground,
          body: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _buildHeader(name, user)),
              SliverToBoxAdapter(child: _buildInfoCard(user)),
              SliverToBoxAdapter(child: _buildActionRow()),
              SliverToBoxAdapter(child: _buildExpensesHeader()),
              if (_loading)
                const SliverToBoxAdapter(child: Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: kPrimary))))
              else if (_expenses.isEmpty)
                SliverToBoxAdapter(child: _EmptyExpenses())
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (_, i) => _ExpenseCard(
                      exp: _expenses[i],
                      onTap: () => _openModal(_expenses[i]['type'] as String? ?? 'EXPENSE', _expenses[i]),
                      onDelete: () => _delete(_expenses[i]['id'] as String, _expenses[i]['title'] as String? ?? ''),
                    ),
                    childCount: _expenses.length,
                  ),
                ),
              const SliverToBoxAdapter(child: SizedBox(height: 100)),
            ],
          ),
        ),
        if (_modalType != null)
          _ExpenseModal(
            type: _modalType!,
            editingId: _editingId,
            titleCtrl: _titleCtrl,
            amountCtrl: _amountCtrl,
            commentCtrl: _commentCtrl,
            saving: _saving,
            onClose: _closeModal,
            onSave: _save,
          ),
      ],
    );
  }

  Widget _buildHeader(String name, Map<String, dynamic> user) {
    return Container(
      padding: EdgeInsets.fromLTRB(24, MediaQuery.of(context).padding.top + 16, 24, 24),
      child: Stack(
        children: [
          Column(
            children: [
              Container(
                width: 90, height: 90,
                decoration: BoxDecoration(shape: BoxShape.circle, color: kPrimary.withOpacity(0.1), border: Border.all(color: kPrimary.withOpacity(0.3), width: 2)),
                child: Center(child: Text(name.isNotEmpty ? name[0].toUpperCase() : 'U', style: const TextStyle(fontSize: 40, color: kPrimary, fontWeight: FontWeight.w900))),
              ),
              const SizedBox(height: 12),
              Text(name, style: const TextStyle(color: kTextPrimary, fontSize: 24, fontWeight: FontWeight.w800)),
              Text(user['appRole'] == 'FACILITY' ? 'Sex xodimi' : 'Gilam Haydovchisi', style: const TextStyle(color: kTextSecondary, fontSize: 13, letterSpacing: 1)),
            ],
          ),
          Positioned(
            top: 0, right: 0,
            child: GestureDetector(
              onTap: _confirmLogout,
              child: Container(
                width: 44, height: 44,
                decoration: BoxDecoration(shape: BoxShape.circle, color: Colors.red.withOpacity(0.1)),
                child: const Icon(Icons.logout, color: Colors.red, size: 22),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(Map<String, dynamic> user) {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 0, 24, 24),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(24), border: Border.all(color: kSurface2)),
      child: Column(
        children: [
          _InfoRow(icon: Icons.call, label: 'Aloqa', value: user['phone'] ?? '—'),
          _InfoRow(icon: Icons.business, label: 'Kompaniya', value: (user['company'] as Map?)?['name'] ?? user['companyId'] ?? '—'),
          _InfoRow(icon: Icons.fingerprint, label: 'ID Raqam', value: user['id'] ?? '—', isLast: true),
        ],
      ),
    );
  }

  Widget _buildActionRow() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 0, 24, 8),
      child: Row(
        children: [
          Expanded(child: _ActionCard(type: 'INCOME', onTap: () => _openModal('INCOME'))),
          const SizedBox(width: 16),
          Expanded(child: _ActionCard(type: 'EXPENSE', onTap: () => _openModal('EXPENSE'))),
        ],
      ),
    );
  }

  Widget _buildExpensesHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(24, 16, 24, 12),
      child: Row(children: [
        const Text("Mening o'tkazmalarim", style: TextStyle(color: kTextPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
        const Spacer(),
        if (_loading) const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary)),
      ]),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label, value;
  final bool isLast;
  const _InfoRow({required this.icon, required this.label, required this.value, this.isLast = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(border: isLast ? null : const Border(bottom: BorderSide(color: kSurface2))),
      child: Row(
        children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: kPrimary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)), child: Icon(icon, color: kPrimary, size: 18)),
          const SizedBox(width: 16),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(label, style: const TextStyle(color: kTextMuted, fontSize: 12, fontWeight: FontWeight.w600)),
            Text(value, style: const TextStyle(color: kTextPrimary, fontSize: 15, fontWeight: FontWeight.w700)),
          ]),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  final String type;
  final VoidCallback onTap;
  const _ActionCard({required this.type, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final isIncome = type == 'INCOME';
    final color = isIncome ? const Color(0xFF3b82f6) : const Color(0xFFef4444);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(24)),
        child: Column(
          children: [
            Container(width: 48, height: 48, decoration: BoxDecoration(shape: BoxShape.circle, color: color.withOpacity(0.15)), child: Icon(isIncome ? Icons.arrow_downward : Icons.arrow_upward, color: color, size: 26)),
            const SizedBox(height: 12),
            Text(isIncome ? 'Kirim\nqilish' : "Xarajat\nqo'shish", style: const TextStyle(color: kTextPrimary, fontSize: 13, fontWeight: FontWeight.w700), textAlign: TextAlign.center),
          ],
        ),
      ),
    );
  }
}

class _EmptyExpenses extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(16), border: Border.all(color: kSurface2)),
      child: const Column(children: [
        Icon(Icons.receipt_long_outlined, size: 32, color: Color(0xFF27272a)),
        SizedBox(height: 12),
        Text("Hali hech narsa kiritmagansiz", style: TextStyle(color: kTextMuted, fontWeight: FontWeight.w600)),
      ]),
    );
  }
}

class _ExpenseCard extends StatelessWidget {
  final Map<String, dynamic> exp;
  final VoidCallback onTap, onDelete;
  const _ExpenseCard({required this.exp, required this.onTap, required this.onDelete});

  @override
  Widget build(BuildContext context) {
    final isIncome = exp['type'] == 'INCOME';
    final color = isIncome ? const Color(0xFF3b82f6) : const Color(0xFFef4444);
    String dateStr = '';
    try {
      final dt = DateTime.parse(exp['createdAt']).toLocal();
      dateStr = '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {}

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.fromLTRB(24, 0, 24, 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(12), border: Border.all(color: kSurface2)),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(exp['title'] ?? '', style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 14)),
            Text(dateStr, style: const TextStyle(color: kTextMuted, fontSize: 11)),
          ])),
          Text('${isIncome ? '+ ' : '- '}${exp['amount']} so\'m', style: TextStyle(color: color, fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(width: 8),
          GestureDetector(
            onTap: onDelete,
            child: Container(width: 36, height: 36, decoration: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(8)), child: const Icon(Icons.delete_outline, size: 18, color: kTextMuted)),
          ),
        ]),
      ),
    );
  }
}

class _ExpenseModal extends StatelessWidget {
  final String type;
  final String? editingId;
  final TextEditingController titleCtrl, amountCtrl, commentCtrl;
  final bool saving;
  final VoidCallback onClose, onSave;

  const _ExpenseModal({
    required this.type, this.editingId,
    required this.titleCtrl, required this.amountCtrl, required this.commentCtrl,
    required this.saving, required this.onClose, required this.onSave,
  });

  @override
  Widget build(BuildContext context) {
    final isIncome = type == 'INCOME';
    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black.withOpacity(0.6),
        child: GestureDetector(
          onTap: () {},
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 24),
              decoration: const BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(32)),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(width: 40, height: 4, decoration: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(2))),
                  const SizedBox(height: 20),
                  Text(
                    editingId != null
                        ? (isIncome ? 'Kirimni tahrirlash' : 'Xarajatni tahrirlash')
                        : (isIncome ? 'Yangi Kirim' : 'Yangi Xarajat'),
                    style: const TextStyle(color: kTextPrimary, fontSize: 22, fontWeight: FontWeight.w800),
                  ),
                  const SizedBox(height: 20),
                  _field('Nom', isIncome ? 'Masalan: Mijozdan olindi...' : "Masalan: Yoqilg'i...", titleCtrl),
                  const SizedBox(height: 12),
                  _field("Summa (so'm)", '250 000', amountCtrl, isNumber: true),
                  const SizedBox(height: 12),
                  _field('Izoh (ixtiyoriy)', 'Shamol bo\'lib qolsin...', commentCtrl, maxLines: 3),
                  const SizedBox(height: 20),
                  Row(children: [
                    Expanded(child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: kSurface2, foregroundColor: kTextPrimary),
                      onPressed: onClose,
                      child: const Text('Bekor'),
                    )),
                    const SizedBox(width: 12),
                    Expanded(child: ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: isIncome ? const Color(0xFF3b82f6) : const Color(0xFFef4444),
                      ),
                      onPressed: saving ? null : onSave,
                      child: saving
                          ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                          : const Text('Saqlash', style: TextStyle(color: Colors.white)),
                    )),
                  ]),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(String label, String hint, TextEditingController ctrl, {bool isNumber = false, int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 1)),
        const SizedBox(height: 6),
        TextField(
          controller: ctrl,
          keyboardType: isNumber ? TextInputType.number : TextInputType.multiline,
          maxLines: maxLines,
          style: const TextStyle(color: kTextPrimary, fontSize: 15, fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: hint, hintStyle: const TextStyle(color: kTextMuted),
            filled: true, fillColor: kSurface2,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          ),
        ),
      ],
    );
  }
}
