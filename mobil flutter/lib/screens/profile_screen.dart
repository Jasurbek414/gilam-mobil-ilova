import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../core/constants.dart';

class ProfileScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  const ProfileScreen({super.key, required this.user, required this.onLogout});
  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tab;

  // ── Finance state ────────────────────────────────────────────────────────
  List<dynamic> _expenses = [];
  bool _loadingExp = true;
  String? _modalType;
  String? _editingId;
  final TextEditingController _titleCtrl = TextEditingController();
  final TextEditingController _amountCtrl = TextEditingController();
  final TextEditingController _commentCtrl = TextEditingController();
  bool _saving = false;

  // ── History state ────────────────────────────────────────────────────────
  List<dynamic> _history = [];
  bool _loadingHist = true;

  bool get _isFac => widget.user['appRole'] == 'FACILITY';

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _tab.addListener(() { if (!_tab.indexIsChanging) setState(() {}); });
    _loadExpenses();
    _loadHistory();
  }

  @override
  void dispose() {
    _tab.dispose();
    _titleCtrl.dispose();
    _amountCtrl.dispose();
    _commentCtrl.dispose();
    super.dispose();
  }

  // ── Data loading ─────────────────────────────────────────────────────────
  Future<void> _loadExpenses() async {
    try {
      final data = await getDriverExpenses(widget.user['id']);
      if (mounted) setState(() { _expenses = data; _loadingExp = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingExp = false);
    }
  }

  Future<void> _loadHistory() async {
    try {
      final List<dynamic> data;
      if (_isFac) {
        data = await getFacilityOrderHistory(widget.user['companyId']);
      } else {
        data = await getDriverOrderHistory(widget.user['id']);
      }
      if (mounted) setState(() { _history = data; _loadingHist = false; });
    } catch (_) {
      if (mounted) setState(() => _loadingHist = false);
    }
  }

  // ── Finance actions ────────────────────────────────────────────────────────
  void _openModal(String type, [Map<String, dynamic>? exp]) {
    _editingId = exp?['id'];
    _titleCtrl.text = exp?['title'] ?? '';
    _amountCtrl.text = exp?['amount']?.toString() ?? '';
    final raw = exp?['comment'] as String? ?? '';
    _commentCtrl.text = raw.replaceFirst(
        RegExp(r"^(Kirim|Xarajat): Haydovchi mobil ilovasidan qo'shildi\.\s*"), '');
    setState(() => _modalType = type);
  }

  void _closeModal() {
    setState(() { _modalType = null; _editingId = null; });
    _titleCtrl.clear(); _amountCtrl.clear(); _commentCtrl.clear();
  }

  Future<void> _save() async {
    if (_titleCtrl.text.trim().isEmpty || _amountCtrl.text.trim().isEmpty) {
      _snack('Nom va summani kiriting!', Colors.red.shade800);
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
      await _loadExpenses();
    } catch (e) {
      _snack(e.toString().replaceFirst('Exception: ', ''), Colors.red.shade800);
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
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Bekor', style: TextStyle(color: kTextMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text("O'chirish"),
          ),
        ],
      ),
    );
    if (ok != true) return;
    try { await deleteExpense(id); await _loadExpenses(); } catch (e) {
      _snack(e.toString(), Colors.red.shade800);
    }
  }

  Future<void> _confirmLogout() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: const Text('Ishonchingiz komilmi?', style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.w800)),
        content: const Text('Hisobingizdan chiqib ketsangiz buyurtmalar qabul qila olmaysiz.', style: TextStyle(color: kTextSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Bekor', style: TextStyle(color: kTextMuted))),
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

  void _snack(String msg, Color color) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: color, behavior: SnackBarBehavior.floating),
    );
  }

  // ────────────────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final name = user['fullName'] as String? ?? 'Foydalanuvchi';
    final company = (user['company'] as Map?)?['name'] ?? user['companyId'] ?? '—';

    return Stack(
      children: [
        Scaffold(
          backgroundColor: kBackground,
          body: NestedScrollView(
            headerSliverBuilder: (_, __) => [
              SliverToBoxAdapter(child: _buildHeader(name, user, company)),
              SliverToBoxAdapter(child: _buildStats()),
              SliverToBoxAdapter(child: _buildTabBar()),
            ],
            body: TabBarView(
              controller: _tab,
              children: [
                _buildFinanceTab(),
                _buildHistoryTab(),
              ],
            ),
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

  // ── Header ──────────────────────────────────────────────────────────────────
  Widget _buildHeader(String name, Map<String, dynamic> user, String company) {
    return Column(children: [
      Padding(
        padding: EdgeInsets.fromLTRB(24, MediaQuery.of(context).padding.top + 16, 16, 0),
        child: Row(mainAxisAlignment: MainAxisAlignment.end, children: [
          GestureDetector(
            onTap: _confirmLogout,
            child: Row(children: const [
              Icon(Icons.logout_rounded, color: kTextMuted, size: 20),
              SizedBox(width: 6),
              Text('Chiqish', style: TextStyle(color: kTextMuted, fontSize: 13, fontWeight: FontWeight.w600)),
            ]),
          ),
        ]),
      ),
      const SizedBox(height: 10),
      Container(
        width: 90, height: 90,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: LinearGradient(
            colors: [Color(0xFF34D399), Color(0xFF059669)],
            begin: Alignment.topLeft, end: Alignment.bottomRight,
          ),
        ),
        child: Center(child: Text(
          name.isNotEmpty ? name[0].toUpperCase() : 'U',
          style: const TextStyle(fontSize: 40, color: Colors.white, fontWeight: FontWeight.w800),
        )),
      ),
      const SizedBox(height: 16),
      Text(name, style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: -0.5)),
      const SizedBox(height: 6),
      Text(
        _isFac ? 'Sex xodimi · $company' : 'Haydovchi · $company',
        style: const TextStyle(color: kTextMuted, fontSize: 13, fontWeight: FontWeight.w500),
      ),
      const SizedBox(height: 14),
      Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(Icons.phone_rounded, size: 14, color: kTextMuted.withAlpha(180)),
        const SizedBox(width: 6),
        Text(user['phone'] ?? '—', style: const TextStyle(color: kTextSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
        const SizedBox(width: 14),
        Container(width: 4, height: 4, decoration: const BoxDecoration(color: kTextMuted, shape: BoxShape.circle)),
        const SizedBox(width: 14),
        Icon(Icons.fingerprint_rounded, size: 14, color: kTextMuted.withAlpha(180)),
        const SizedBox(width: 6),
        Text((user['id'] as String? ?? '').substring(0, 8), style: const TextStyle(color: kTextSecondary, fontSize: 13, fontWeight: FontWeight.w600)),
      ]),
      const SizedBox(height: 24),
    ]);
  }

  // ── Stats (income summary) ──────────────────────────────────────────────────
  Widget _buildStats() {
    final income = _expenses
        .where((e) => e['type'] == 'INCOME')
        .fold<num>(0, (s, e) => s + (num.tryParse(e['amount'].toString()) ?? 0));
    final expense = _expenses
        .where((e) => e['type'] == 'EXPENSE')
        .fold<num>(0, (s, e) => s + (num.tryParse(e['amount'].toString()) ?? 0));
    final net = income - expense;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 8),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 18),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Row(children: [
          _summaryBlock("Kirim", income, const Color(0xFF60A5FA)),
          Container(width: 1, height: 36, color: kSurface2),
          _summaryBlock("Xarajat", expense, const Color(0xFFF87171)),
          Container(width: 1, height: 36, color: kSurface2),
          _summaryBlock("Sof", net, net >= 0 ? const Color(0xFF34D399) : Colors.orange),
        ]),
      ),
    );
  }

  Widget _summaryBlock(String label, num value, Color color) => Expanded(
    child: Column(children: [
      Text(label, style: const TextStyle(color: kTextMuted, fontSize: 12, fontWeight: FontWeight.w600)),
      const SizedBox(height: 6),
      Text(
        '${value >= 0 ? '' : '-'}${value.abs().round()}',
        style: TextStyle(color: color, fontSize: 15, fontWeight: FontWeight.w800, letterSpacing: -0.3),
        overflow: TextOverflow.ellipsis,
      ),
    ]),
  );

  // ── Tab bar ─────────────────────────────────────────────────────────────────
  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.fromLTRB(24, 12, 24, 8),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(16)),
      child: TabBar(
        controller: _tab,
        dividerColor: Colors.transparent,
        indicator: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(12)),
        indicatorSize: TabBarIndicatorSize.tab,
        labelColor: Colors.white,
        unselectedLabelColor: kTextMuted,
        labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        tabs: [
          const Tab(height: 40, child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [Icon(Icons.account_balance_wallet_rounded, size: 16), SizedBox(width: 6), Text('Moliya')])),
          Tab(height: 40, child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [const Icon(Icons.history_rounded, size: 16), const SizedBox(width: 6), Text('Tarixi (${_history.length})')])),
        ],
      ),
    );
  }

  // ── Finance tab ──────────────────────────────────────────────────────────────
  Widget _buildFinanceTab() {
    return CustomScrollView(slivers: [
      SliverToBoxAdapter(child: _buildActionRow()),
      if (_loadingExp)
        const SliverFillRemaining(child: Center(child: CircularProgressIndicator(color: kPrimary)))
      else if (_expenses.isEmpty)
        SliverFillRemaining(child: _buildEmpty('Hali pul harakati kiritilmagan', Icons.receipt_long_outlined))
      else
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(24, 0, 24, 100),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (_, i) => _ExpenseCard(
                exp: _expenses[i],
                onTap: () => _openModal(_expenses[i]['type'] as String? ?? 'EXPENSE', _expenses[i]),
                onDelete: () => _delete(_expenses[i]['id'] as String, _expenses[i]['title'] as String? ?? ''),
              ),
              childCount: _expenses.length,
            ),
          ),
        ),
    ]);
  }

  Widget _buildActionRow() => Padding(
    padding: const EdgeInsets.fromLTRB(24, 12, 24, 16),
    child: Row(children: [
      Expanded(child: _ActionBtn(
        icon: Icons.add_circle_outline_rounded, label: 'Kirim qilish',
        color: const Color(0xFF60A5FA), onTap: () => _openModal('INCOME'),
      )),
      const SizedBox(width: 12),
      Expanded(child: _ActionBtn(
        icon: Icons.remove_circle_outline_rounded, label: "Xarajat",
        color: const Color(0xFFF87171), onTap: () => _openModal('EXPENSE'),
      )),
    ]),
  );

  // ── History tab ──────────────────────────────────────────────────────────────
  Widget _buildHistoryTab() {
    if (_loadingHist) {
      return const Center(child: CircularProgressIndicator(color: kPrimary));
    }
    if (_history.isEmpty) {
      return _buildEmpty('Hali bajarilgan buyurtmalar yo\'q', Icons.history_outlined);
    }
    return RefreshIndicator(
      color: kPrimary,
      onRefresh: _loadHistory,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(24, 16, 24, 100),
        itemCount: _history.length,
        itemBuilder: (_, i) => _HistoryCard(order: _history[i]),
      ),
    );
  }

  Widget _buildEmpty(String msg, IconData icon) => Center(
    child: Column(mainAxisSize: MainAxisSize.min, children: [
      Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(color: kSurface, shape: BoxShape.circle),
        child: Icon(icon, size: 40, color: kTextMuted),
      ),
      const SizedBox(height: 16),
      Text(msg, style: const TextStyle(color: kTextMuted, fontSize: 14, fontWeight: FontWeight.w600)),
    ]),
  );
}

// ── Sub-widgets ────────────────────────────────────────────────────────────────

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;
  const _ActionBtn({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) => GestureDetector(
    onTap: onTap,
    child: Container(
      height: 48,
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
        Icon(icon, color: color, size: 18),
        const SizedBox(width: 8),
        Text(label, style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
      ]),
    ),
  );
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
      dateStr = '${dt.day.toString().padLeft(2,'0')}.${dt.month.toString().padLeft(2,'0')} ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(16)),
      child: Row(children: [
        Container(
          width: 36, height: 36,
          decoration: BoxDecoration(color: color.withAlpha(25), shape: BoxShape.circle),
          child: Icon(isIncome ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded, color: color, size: 18),
        ),
        const SizedBox(width: 14),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(exp['title'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14)),
          const SizedBox(height: 2),
          Text(dateStr, style: const TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w500)),
        ])),
        Text(
          '${isIncome ? '+' : '-'} ${exp['amount']} so\'m',
          style: TextStyle(color: color, fontWeight: FontWeight.w700, fontSize: 13),
        ),
        const SizedBox(width: 12),
        GestureDetector(
          onTap: onDelete,
          child: const Icon(Icons.delete_outline, size: 18, color: kTextMuted),
        ),
      ]),
    );
  }
}

class _HistoryCard extends StatelessWidget {
  final Map<String, dynamic> order;
  const _HistoryCard({required this.order});

  @override
  Widget build(BuildContext context) {
    final config = statusConfig[order['status']] ?? {'label': order['status'], 'emoji': '📦', 'color': 0xFF71717a};
    final customer = order['customer'] as Map<String, dynamic>?;
    final items = order['items'] as List?;
    final amount = order['totalAmount'];
    String dateStr = '';
    try {
      final dt = DateTime.parse(order['updatedAt'] ?? order['createdAt']).toLocal();
      dateStr = '${dt.day.toString().padLeft(2,'0')}.${dt.month.toString().padLeft(2,'0')}.${dt.year} ${dt.hour.toString().padLeft(2,'0')}:${dt.minute.toString().padLeft(2,'0')}';
    } catch (_) {}

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: kSurface,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Expanded(child: Text(
            customer?['fullName'] ?? "Noma'lum",
            style: const TextStyle(color: kTextPrimary, fontWeight: FontWeight.w800, fontSize: 14),
          )),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: Color(config['color'] as int).withAlpha(30),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text('${config['emoji']} ${config['label']}',
                style: TextStyle(color: Color(config['color'] as int), fontSize: 11, fontWeight: FontWeight.w700)),
          ),
        ]),
        if (customer?['address'] != null) ...[
          const SizedBox(height: 5),
          Row(children: [
            const Icon(Icons.location_on_outlined, size: 12, color: kTextMuted),
            const SizedBox(width: 4),
            Expanded(child: Text(customer!['address'], style: const TextStyle(color: kTextMuted, fontSize: 12), overflow: TextOverflow.ellipsis)),
          ]),
        ],
        const SizedBox(height: 8),
        Row(children: [
          const Icon(Icons.inventory_2_outlined, size: 12, color: kTextMuted),
          const SizedBox(width: 4),
          Text('${items?.length ?? 0} ta mahsulot', style: const TextStyle(color: kTextMuted, fontSize: 12)),
          const Spacer(),
          if (amount != null && amount != 0)
            Text('${amount} so\'m', style: const TextStyle(color: kPrimary, fontWeight: FontWeight.w800, fontSize: 13)),
        ]),
        if (dateStr.isNotEmpty) ...[
          const SizedBox(height: 4),
          Text(dateStr, style: const TextStyle(color: kTextMuted, fontSize: 11)),
        ],
      ]),
    );
  }
}

// ── Expense Modal ──────────────────────────────────────────────────────────────
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
    final color = isIncome ? const Color(0xFF3b82f6) : const Color(0xFFef4444);
    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black.withAlpha(150),
        child: GestureDetector(
          onTap: () {},
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              padding: EdgeInsets.fromLTRB(24, 16, 24, MediaQuery.of(context).viewInsets.bottom + 24),
              decoration: BoxDecoration(
                color: kSurface,
                borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                border: Border(top: BorderSide(color: kSurface2)),
              ),
              child: Column(mainAxisSize: MainAxisSize.min, children: [
                Container(width: 36, height: 4, decoration: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(2))),
                const SizedBox(height: 18),
                Row(children: [
                  Container(
                    width: 40, height: 40,
                    decoration: BoxDecoration(color: color.withAlpha(20), shape: BoxShape.circle),
                    child: Icon(isIncome ? Icons.arrow_downward_rounded : Icons.arrow_upward_rounded, color: color, size: 22),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    editingId != null
                        ? (isIncome ? 'Kirimni tahrirlash' : 'Xarajatni tahrirlash')
                        : (isIncome ? 'Yangi Kirim' : 'Yangi Xarajat'),
                    style: const TextStyle(color: kTextPrimary, fontSize: 20, fontWeight: FontWeight.w800),
                  ),
                ]),
                const SizedBox(height: 20),
                _field('Nom', isIncome ? 'Misol: Mijozdan olindi' : "Misol: Yoqilg'i", titleCtrl),
                const SizedBox(height: 10),
                _field("Summa (so'm)", '250 000', amountCtrl, isNumber: true),
                const SizedBox(height: 10),
                _field('Izoh (ixtiyoriy)', 'Qo\'shimcha ma\'lumot...', commentCtrl, maxLines: 2),
                const SizedBox(height: 20),
                Row(children: [
                  Expanded(child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: kSurface2, foregroundColor: kTextPrimary, minimumSize: const Size(0, 50)),
                    onPressed: onClose,
                    child: const Text('Bekor'),
                  )),
                  const SizedBox(width: 12),
                  Expanded(flex: 2, child: ElevatedButton(
                    style: ElevatedButton.styleFrom(backgroundColor: color, minimumSize: const Size(0, 50)),
                    onPressed: saving ? null : onSave,
                    child: saving
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Text('Saqlash', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                  )),
                ]),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  Widget _field(String label, String hint, TextEditingController ctrl, {bool isNumber = false, int maxLines = 1}) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label, style: const TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 0.5)),
      const SizedBox(height: 6),
      TextField(
        controller: ctrl,
        keyboardType: isNumber ? TextInputType.number : TextInputType.multiline,
        maxLines: maxLines,
        style: const TextStyle(color: kTextPrimary, fontSize: 15, fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          hintText: hint, hintStyle: const TextStyle(color: kTextMuted),
          filled: true, fillColor: kSurface2,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        ),
      ),
    ]);
  }
}
