import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../core/constants.dart';

class OrdersPage extends StatefulWidget {
  final Map<String, dynamic> user;
  const OrdersPage({super.key, required this.user});

  @override
  State<OrdersPage> createState() => _OrdersPageState();
}

class _OrdersPageState extends State<OrdersPage> {
  List<dynamic> _orders = [];
  List<dynamic> _stages = [];
  bool _loading = true;
  bool _refreshing = false;
  String? _updatingId;
  String _filterStatus = 'ALL';
  Map<String, dynamic>? _selectedOrder;
  Map<String, dynamic>? _deadlineOrder;
  Map<String, dynamic>? _completeOrder;
  Map<String, dynamic>? _totalModal;
  final TextEditingController _receivedCtrl = TextEditingController();
  final TextEditingController _totalCtrl = TextEditingController();
  final TextEditingController _stageNameCtrl = TextEditingController();
  bool _showCreateStage = false;

  bool get isFacility => widget.user['appRole'] == 'FACILITY';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _receivedCtrl.dispose();
    _totalCtrl.dispose();
    _stageNameCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      List<dynamic> data;
      if (isFacility) {
        data = await getFacilityOrders(widget.user['companyId']);
        final stages = await getFacilityStages(widget.user['companyId']);
        if (mounted) setState(() => _stages = stages);
      } else {
        data = await getMyOrders(widget.user['id']);
      }
      if (mounted) setState(() { _orders = data; _loading = false; _refreshing = false; });
    } catch (e) {
      if (mounted) setState(() { _loading = false; _refreshing = false; });
    }
  }

  List<dynamic> get _filteredOrders {
    if (_filterStatus == 'ALL') return _orders;
    final stage = _stages.firstWhere(
      (s) => s['id'] == _filterStatus, orElse: () => null);
    if (stage != null) {
      final sf = stage['statusFilter'];
      if (sf != null) return _orders.where((o) => o['status'] == sf).toList();
      return _orders.where((o) => o['facilityStageId'] == _filterStatus).toList();
    }
    return _orders.where((o) => o['status'] == _filterStatus).toList();
  }

  Future<void> _updateStatus(String orderId, String nextStatus) async {
    if (nextStatus == 'PICKED_UP') {
      setState(() => _deadlineOrder = {'id': orderId, 'nextStatus': nextStatus});
      return;
    }

    if (nextStatus == 'AT_FACILITY') {
      final ok = await _confirm('Barcha gilamlarni korxonaga tushirib topshirganingizni tasdiqlaysizmi?');
      if (!ok) return;
    } else if (nextStatus == 'DELIVERED') {
      final order = _orders.firstWhere((o) => o['id'] == orderId, orElse: () => null);
      if (order != null) {
        _receivedCtrl.text = (order['totalAmount'] ?? 0).toString();
        setState(() => _completeOrder = order);
        return;
      }
    }

    await _doUpdateStatus(orderId, nextStatus);
  }

  Future<void> _doUpdateStatus(String orderId, String status,
      {String? deadline, String? facilityStageId}) async {
    setState(() => _updatingId = orderId);
    try {
      await updateOrderStatus(orderId, status,
          deadlineDate: deadline, facilityStageId: facilityStageId);
      await _load();
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _updatingId = null);
    }
  }

  Future<bool> _confirm(String msg) async {
    final res = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: const Text('Tasdiqlash', style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.w800)),
        content: Text(msg, style: const TextStyle(color: kTextSecondary)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Bekor', style: TextStyle(color: kTextMuted))),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Tasdiqlayman')),
        ],
      ),
    );
    return res == true;
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg.replaceFirst('Exception: ', '')),
      backgroundColor: Colors.red.shade900,
    ));
  }

  void _openMap(Map<String, dynamic> order) async {
    final customer = order['customer'] as Map<String, dynamic>?;
    if (customer == null) return;
    final loc = customer['location'];
    double? lat, lng;
    if (loc is Map) {
      lat = double.tryParse(loc['lat'].toString());
      lng = double.tryParse(loc['lng'].toString());
    } else if (loc is String && loc.contains(',')) {
      final parts = loc.split(',');
      lat = double.tryParse(parts[0]);
      lng = double.tryParse(parts[1]);
    }
    final address = customer['address'] ?? customer['fullName'] ?? 'Manzil';
    final encoded = Uri.encodeComponent(address);
    final urls = lat != null && lng != null
        ? [
            'https://maps.google.com/?q=$lat,$lng',
            'https://yandex.uz/maps/?ll=$lng,$lat&z=16&mode=whatshere',
            'https://2gis.uz/search/$encoded',
          ]
        : [
            'https://maps.google.com/?q=$encoded',
            'https://yandex.uz/maps/?text=$encoded',
            'https://2gis.uz/search/$encoded',
          ];

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: kSurface,
        title: Text('📍 $address', style: const TextStyle(color: kTextPrimary, fontWeight: FontWeight.w800, fontSize: 16)),
        content: const Text('Qaysi xarita dasturida ochmoqchisiz?', style: TextStyle(color: kTextSecondary)),
        actions: [
          TextButton(onPressed: () { Navigator.pop(ctx); launchUrl(Uri.parse(urls[0])); }, child: const Text('🗺 Google Maps', style: TextStyle(color: kPrimary))),
          TextButton(onPressed: () { Navigator.pop(ctx); launchUrl(Uri.parse(urls[1])); }, child: const Text('🟡 Yandex Maps', style: TextStyle(color: kPrimary))),
          TextButton(onPressed: () { Navigator.pop(ctx); launchUrl(Uri.parse(urls[2])); }, child: const Text('🏙 2GIS', style: TextStyle(color: kPrimary))),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filters = _buildFilters();

    return Scaffold(
      backgroundColor: kBackground,
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : Column(
              children: [
                // Filter chips
                SizedBox(
                  height: 52,
                  child: ListView.separated(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    itemCount: filters.length + (isFacility ? 1 : 0),
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (_, i) {
                      if (isFacility && i == filters.length) {
                        return _AddStageChip(onTap: () => setState(() => _showCreateStage = true));
                      }
                      final f = filters[i];
                      final active = _filterStatus == f['key'];
                      return GestureDetector(
                        onTap: () => setState(() => _filterStatus = f['key']),
                        onLongPress: isFacility && f['deletable'] == true
                            ? () => _deleteStage(f['key'], f['label'])
                            : null,
                        child: _FilterChip(label: f['label'], active: active),
                      );
                    },
                  ),
                ),
                // Orders list
                Expanded(
                  child: RefreshIndicator(
                    color: kPrimary,
                    onRefresh: () async { setState(() => _refreshing = true); await _load(); },
                    child: _filteredOrders.isEmpty
                        ? _EmptyList(isFacility: isFacility)
                        : ListView.builder(
                            padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                            itemCount: _filteredOrders.length,
                            itemBuilder: (_, i) => _OrderCard(
                              order: _filteredOrders[i],
                              onTap: () => setState(() => _selectedOrder = _filteredOrders[i]),
                            ),
                          ),
                  ),
                ),
              ],
            ),
      // Modals via overlays
      bottomSheet: null,
    ).withModals(
      context: context,
      selectedOrder: _selectedOrder,
      onCloseOrder: () => setState(() => _selectedOrder = null),
      deadlineOrder: _deadlineOrder,
      onCloseDeadline: () => setState(() => _deadlineOrder = null),
      onSelectDays: (days) async {
        final dOrder = _deadlineOrder!;
        setState(() => _deadlineOrder = null);
        final date = DateTime.now().add(Duration(days: days));
        await _doUpdateStatus(dOrder['id'], dOrder['nextStatus'],
            deadline: date.toIso8601String());
      },
      completeOrder: _completeOrder,
      receivedCtrl: _receivedCtrl,
      onCloseComplete: () => setState(() => _completeOrder = null),
      onComplete: () => _handleComplete(),
      updatingId: _updatingId,
      onUpdateStatus: (orderId, status) {
        _updateStatus(orderId, status);
        setState(() => _selectedOrder = null);
      },
      onAutoNextStage: (orderId, status, stageId) {
        _autoNext(orderId, status, stageId);
        setState(() => _selectedOrder = null);
      },
      onOpenMap: _openMap,
      onSetTotal: (order) {
        _totalCtrl.text = (order['totalAmount'] ?? '').toString();
        setState(() { _totalModal = order; _selectedOrder = null; });
      },
      stages: _stages,
      user: widget.user,
      totalModal: _totalModal,
      totalCtrl: _totalCtrl,
      onCloseTotal: () => setState(() => _totalModal = null),
      onSaveTotal: () => _saveTotal(),
      showCreateStage: _showCreateStage,
      stageNameCtrl: _stageNameCtrl,
      onCloseStage: () => setState(() { _showCreateStage = false; _stageNameCtrl.clear(); }),
      onSaveStage: () => _saveNewStage(),
      onUpdateItemPrice: (itemId, price) async {
        try { await updateItemPrice(itemId, price); await _load(); } catch (_) {}
      },
    );
  }

  List<Map<String, dynamic>> _buildFilters() {
    if (isFacility) {
      return [
        {'key': 'ALL', 'label': 'Barchasi'},
        ..._stages.map((s) => {'key': s['id'], 'label': s['name'], 'deletable': true}),
      ];
    }
    return [
      {'key': 'ALL', 'label': 'Barchasi'},
      {'key': 'NEW', 'label': 'Yangi'},
      {'key': 'DRIVER_ASSIGNED', 'label': 'Olib kelish'},
      {'key': 'READY_FOR_DELIVERY', 'label': 'Yetkazish'},
      {'key': 'OUT_FOR_DELIVERY', 'label': "Yo'lda"},
    ];
  }

  Future<void> _deleteStage(String id, String name) async {
    final ok = await _confirm('"$name" bo\'limni o\'chirmoqchimisiz?');
    if (!ok) return;
    try {
      await deleteFacilityStage(id);
      if (_filterStatus == id) setState(() => _filterStatus = 'ALL');
      await _load();
    } catch (e) { _showError(e.toString()); }
  }

  Future<void> _saveNewStage() async {
    final name = _stageNameCtrl.text.trim();
    if (name.isEmpty) return;
    try {
      await createFacilityStage(widget.user['companyId'], name, 'folder');
      setState(() => _showCreateStage = false);
      _stageNameCtrl.clear();
      await _load();
    } catch (e) { _showError(e.toString()); }
  }

  Future<void> _autoNext(String orderId, String status, String? stageId) async {
    final allStages = [
      ..._stages.map((s) => {'id': s['id'], 'statusFilter': s['statusFilter']}),
      {'id': 'READY_FOR_DELIVERY', 'statusFilter': 'READY_FOR_DELIVERY'},
    ];
    int idx = stageId != null ? allStages.indexWhere((s) => s['id'] == stageId) : -1;
    if (idx == -1) idx = allStages.indexWhere((s) => s['statusFilter'] == status);
    if (idx == -1) idx = 0;
    if (idx + 1 >= allStages.length) return;
    final next = allStages[idx + 1];
    final sf = next['statusFilter'] as String?;
    await _doUpdateStatus(orderId, sf ?? status, facilityStageId: next['id'] as String?);
  }

  Future<void> _handleComplete() async {
    final order = _completeOrder!;
    final amnt = num.tryParse(_receivedCtrl.text) ?? 0;
    setState(() => _updatingId = order['id']);
    try {
      await updateOrderStatus(order['id'], 'DELIVERED');
      if (amnt > 0) {
        await createExpense({
          'companyId': widget.user['companyId'],
          'userId': widget.user['id'],
          'orderId': order['id'],
          'title': "Mijozdan to'lov (Buyurtma)",
          'amount': amnt,
          'type': 'INCOME',
          'category': 'Logistika',
          'comment': "Kirim: Haydovchi mobil ilovasidan qo'shildi.",
          'date': DateTime.now().toIso8601String().split('T')[0],
        });
      }
      setState(() { _completeOrder = null; _selectedOrder = null; });
      await _load();
    } catch (e) { _showError(e.toString()); }
    finally { setState(() => _updatingId = null); }
  }

  Future<void> _saveTotal() async {
    final order = _totalModal!;
    final amnt = num.tryParse(_totalCtrl.text) ?? 0;
    try {
      await updateOrderTotal(order['id'], amnt);
      setState(() => _totalModal = null);
      await _load();
    } catch (e) { _showError(e.toString()); }
  }
}

// ─── Sub widgets ──────────────────────────────────────────────────────────────

class _FilterChip extends StatelessWidget {
  final String label;
  final bool active;
  const _FilterChip({required this.label, required this.active});

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
      decoration: BoxDecoration(
        color: active ? kPrimary : kSurface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: active ? kPrimary : kBorder),
      ),
      child: Text(label,
          style: TextStyle(
            color: active ? kBackground : kTextSecondary,
            fontWeight: FontWeight.w700,
            fontSize: 13,
          )),
    );
  }
}

class _AddStageChip extends StatelessWidget {
  final VoidCallback onTap;
  const _AddStageChip({required this.onTap});
  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: kPrimary.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kPrimary, style: BorderStyle.solid),
        ),
        child: const Row(
          children: [
            Icon(Icons.add, size: 16, color: kPrimary),
            SizedBox(width: 4),
            Text("Bo'lim qo'shish", style: TextStyle(color: kPrimary, fontWeight: FontWeight.w700, fontSize: 13)),
          ],
        ),
      ),
    );
  }
}

class _EmptyList extends StatelessWidget {
  final bool isFacility;
  const _EmptyList({required this.isFacility});
  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        const SizedBox(height: 80),
        const Icon(Icons.inbox_outlined, size: 64, color: Color(0xFF27272a)),
        const SizedBox(height: 16),
        const Center(child: Text('Sog\'inch bilan kutamiz', style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800))),
        const SizedBox(height: 8),
        Center(child: Text(
          isFacility ? "Hozircha sexga kelib tushgan ishlar yo'q." : "Sizga biriktirilgan buyurtmalar shu yerda chiqadi.",
          style: const TextStyle(color: Color(0xFFa1a1aa), fontSize: 14),
          textAlign: TextAlign.center,
        )),
      ],
    );
  }
}

class _OrderCard extends StatelessWidget {
  final Map<String, dynamic> order;
  final VoidCallback onTap;
  const _OrderCard({required this.order, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final config = statusConfig[order['status']] ?? {'label': order['status'], 'emoji': '📦', 'color': 0xFF71717a};
    final customer = order['customer'] as Map<String, dynamic>?;
    final items = order['items'] as List<dynamic>?;

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: kSurface,
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: kSurface2),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    '${customer?['fullName'] ?? "Noma'lum"} #${order['id'].toString().substring(0, 5)}',
                    style: const TextStyle(color: kTextPrimary, fontWeight: FontWeight.w800, fontSize: 15),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Color(config['color'] as int).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '${config['emoji']} ${config['label']}',
                    style: TextStyle(
                      color: Color(config['color'] as int),
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
            if (items != null && items.isNotEmpty) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  const Icon(Icons.layers_outlined, size: 13, color: kPrimary),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      items.map((i) => '${i['service']?['name']} (${i['quantity']})').join(', '),
                      style: const TextStyle(color: kTextSecondary, fontSize: 12),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],
            if (customer?['address'] != null) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(Icons.location_on_outlined, size: 13, color: kTextMuted),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(customer!['address'], style: const TextStyle(color: kTextMuted, fontSize: 12), overflow: TextOverflow.ellipsis),
                  ),
                ],
              ),
            ],
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Text('📦 ${items?.length ?? 0} xil tur', style: const TextStyle(color: kTextMuted, fontSize: 12)),
                    if (order['createdAt'] != null) ...[
                      const SizedBox(width: 12),
                      const Icon(Icons.access_time_outlined, size: 12, color: kTextMuted),
                      const SizedBox(width: 4),
                      Text(
                        _formatDate(order['createdAt']),
                        style: const TextStyle(color: kTextMuted, fontSize: 12),
                      ),
                    ],
                  ],
                ),
                const Row(
                  children: [
                    Text('Batafsil', style: TextStyle(color: kPrimary, fontSize: 12, fontWeight: FontWeight.w700)),
                    Icon(Icons.chevron_right, size: 14, color: kPrimary),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(String iso) {
    try {
      final dt = DateTime.parse(iso).toLocal();
      return '${dt.day.toString().padLeft(2, '0')}.${dt.month.toString().padLeft(2, '0')} ${dt.hour.toString().padLeft(2, '0')}:${dt.minute.toString().padLeft(2, '0')}';
    } catch (_) {
      return '';
    }
  }
}

// Extension to add modals overlay
extension _ScaffoldModals on Widget {
  Widget withModals({
    required BuildContext context,
    Map<String, dynamic>? selectedOrder,
    VoidCallback? onCloseOrder,
    Map<String, dynamic>? deadlineOrder,
    VoidCallback? onCloseDeadline,
    Function(int)? onSelectDays,
    Map<String, dynamic>? completeOrder,
    TextEditingController? receivedCtrl,
    VoidCallback? onCloseComplete,
    VoidCallback? onComplete,
    String? updatingId,
    Function(String, String)? onUpdateStatus,
    Function(String, String, String?)? onAutoNextStage,
    Function(Map<String, dynamic>)? onOpenMap,
    Function(Map<String, dynamic>)? onSetTotal,
    List<dynamic>? stages,
    Map<String, dynamic>? user,
    Map<String, dynamic>? totalModal,
    TextEditingController? totalCtrl,
    VoidCallback? onCloseTotal,
    VoidCallback? onSaveTotal,
    bool? showCreateStage,
    TextEditingController? stageNameCtrl,
    VoidCallback? onCloseStage,
    VoidCallback? onSaveStage,
    Function(String, num)? onUpdateItemPrice,
  }) {
    return Stack(
      children: [
        this,
        if (selectedOrder != null)
          _OrderDetailModal(
            order: selectedOrder,
            user: user!,
            onClose: onCloseOrder!,
            onUpdateStatus: onUpdateStatus!,
            onAutoNextStage: onAutoNextStage!,
            onOpenMap: onOpenMap!,
            onSetTotal: onSetTotal!,
            updatingId: updatingId,
            onUpdateItemPrice: onUpdateItemPrice!,
          ),
        if (deadlineOrder != null)
          _DeadlineModal(onClose: onCloseDeadline!, onSelectDays: onSelectDays!),
        if (completeOrder != null)
          _CompleteOrderModal(
            order: completeOrder,
            ctrl: receivedCtrl!,
            onClose: onCloseComplete!,
            onConfirm: onComplete!,
            updatingId: updatingId,
          ),
        if (totalModal != null)
          _TotalModal(order: totalModal, ctrl: totalCtrl!, onClose: onCloseTotal!, onSave: onSaveTotal!),
        if (showCreateStage == true)
          _CreateStageModal(ctrl: stageNameCtrl!, onClose: onCloseStage!, onSave: onSaveStage!),
      ],
    );
  }
}

// ─── Modals ───────────────────────────────────────────────────────────────────

class _Modal extends StatelessWidget {
  final double height;
  final Widget child;
  final VoidCallback onClose;
  const _Modal({required this.height, required this.child, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black.withOpacity(0.7),
        child: GestureDetector(
          onTap: () {},
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              height: height,
              decoration: const BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(top: BorderSide(color: kSurface2, width: 1)),
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class _DeadlineModal extends StatelessWidget {
  final VoidCallback onClose;
  final Function(int) onSelectDays;
  const _DeadlineModal({required this.onClose, required this.onSelectDays});

  @override
  Widget build(BuildContext context) {
    return _Modal(
      height: MediaQuery.of(context).size.height * 0.55,
      onClose: onClose,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Necha kunda tayyor bo\'ladi?', style: TextStyle(color: kTextPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text("Mijozga va'da qilingan kunni tanlang.", style: TextStyle(color: kTextSecondary, height: 1.5)),
            const SizedBox(height: 24),
            Wrap(
              spacing: 12, runSpacing: 12,
              children: List.generate(6, (i) => i + 1).map((days) =>
                GestureDetector(
                  onTap: () => onSelectDays(days),
                  child: Container(
                    width: 90, height: 60,
                    decoration: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(16), border: Border.all(color: kBorder)),
                    child: Center(child: Text('$days kun', style: const TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800))),
                  ),
                ),
              ).toList(),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: kSurface2, foregroundColor: kTextPrimary),
                onPressed: onClose,
                child: const Text('Bekor qilish'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CompleteOrderModal extends StatelessWidget {
  final Map<String, dynamic> order;
  final TextEditingController ctrl;
  final VoidCallback onClose, onConfirm;
  final String? updatingId;
  const _CompleteOrderModal({required this.order, required this.ctrl, required this.onClose, required this.onConfirm, this.updatingId});

  @override
  Widget build(BuildContext context) {
    return _Modal(
      height: 420,
      onClose: onClose,
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("Yetkazib Berish & To'lov", style: TextStyle(color: kTextPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            const Text("Gilamlar mijozga yetkazib berildimi?", style: TextStyle(color: kTextSecondary, height: 1.5)),
            const SizedBox(height: 20),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              const Text("Hisoblangan haq:", style: TextStyle(color: kTextSecondary)),
              Text('${order['totalAmount'] ?? 0} so\'m', style: const TextStyle(color: Color(0xFF3b82f6), fontWeight: FontWeight.w800, fontSize: 17)),
            ]),
            const SizedBox(height: 16),
            TextField(
              controller: ctrl,
              keyboardType: TextInputType.number,
              style: const TextStyle(color: kTextPrimary, fontSize: 22, fontWeight: FontWeight.w800),
              decoration: InputDecoration(
                labelText: 'Qabul qilingan pul',
                labelStyle: const TextStyle(color: kTextMuted),
                prefixText: '+ ',
                prefixStyle: const TextStyle(color: kPrimary, fontSize: 22, fontWeight: FontWeight.w800),
                suffixText: "so'm",
                suffixStyle: const TextStyle(color: kTextMuted),
                filled: true,
                fillColor: kSurface2,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 20),
            Row(children: [
              Expanded(child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: kSurface2, foregroundColor: kTextPrimary),
                onPressed: onClose,
                child: const Text('Bekor qilish'),
              )),
              const SizedBox(width: 12),
              Expanded(flex: 2, child: ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF3b82f6)),
                onPressed: updatingId == order['id'] ? null : onConfirm,
                child: updatingId == order['id']
                    ? const CircularProgressIndicator(color: Colors.white, strokeWidth: 2)
                    : const Text('Yetkazildi', style: TextStyle(color: Colors.white)),
              )),
            ]),
          ],
        ),
      ),
    );
  }
}

class _TotalModal extends StatelessWidget {
  final Map<String, dynamic> order;
  final TextEditingController ctrl;
  final VoidCallback onClose, onSave;
  const _TotalModal({required this.order, required this.ctrl, required this.onClose, required this.onSave});

  @override
  Widget build(BuildContext context) {
    return _Modal(height: 380, onClose: onClose, child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        const Text('💰 Summa Belgilash', style: TextStyle(color: kTextPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
        const SizedBox(height: 8),
        const Text("Gilamni o'lchab, tekshirib bo'lgandan so'ng buyurtma uchun jami summani kiriting.", style: TextStyle(color: kTextSecondary, height: 1.5)),
        const SizedBox(height: 20),
        TextField(
          controller: ctrl,
          keyboardType: TextInputType.number,
          style: const TextStyle(color: kTextPrimary, fontSize: 22, fontWeight: FontWeight.w800),
          decoration: InputDecoration(
            labelText: "Jami summa (so'm)",
            filled: true,
            fillColor: kSurface2,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFf59e0b))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFf59e0b))),
          ),
        ),
        const SizedBox(height: 20),
        Row(children: [
          Expanded(child: ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: kSurface2, foregroundColor: kTextPrimary), onPressed: onClose, child: const Text('Bekor'))),
          const SizedBox(width: 12),
          Expanded(child: ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFf59e0b), foregroundColor: kBackground), onPressed: onSave, child: const Text('Saqlash'))),
        ]),
      ]),
    ));
  }
}

class _CreateStageModal extends StatelessWidget {
  final TextEditingController ctrl;
  final VoidCallback onClose, onSave;
  const _CreateStageModal({required this.ctrl, required this.onClose, required this.onSave});

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.black.withOpacity(0.8),
      child: Center(
        child: Container(
          margin: const EdgeInsets.all(24),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(24), border: Border.all(color: kSurface2)),
          child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text("Yangi bo'lim qo'shish", style: TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 16),
            TextField(controller: ctrl, style: const TextStyle(color: kTextPrimary), decoration: InputDecoration(hintText: 'Masalan: Pardozlash, Qadoqlash...', hintStyle: const TextStyle(color: kTextMuted), filled: true, fillColor: kBackground, border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: kSurface2)))),
            const SizedBox(height: 16),
            Row(children: [
              Expanded(child: ElevatedButton(style: ElevatedButton.styleFrom(backgroundColor: kSurface2, foregroundColor: kTextPrimary), onPressed: onClose, child: const Text('Bekor'))),
              const SizedBox(width: 12),
              Expanded(child: ElevatedButton(onPressed: onSave, child: const Text('Qo\'shish'))),
            ]),
          ]),
        ),
      ),
    );
  }
}

class _OrderDetailModal extends StatelessWidget {
  final Map<String, dynamic> order;
  final Map<String, dynamic> user;
  final VoidCallback onClose;
  final Function(String, String) onUpdateStatus;
  final Function(String, String, String?) onAutoNextStage;
  final Function(Map<String, dynamic>) onOpenMap;
  final Function(Map<String, dynamic>) onSetTotal;
  final String? updatingId;
  final Function(String, num) onUpdateItemPrice;

  const _OrderDetailModal({
    required this.order, required this.user, required this.onClose,
    required this.onUpdateStatus, required this.onAutoNextStage,
    required this.onOpenMap, required this.onSetTotal,
    this.updatingId, required this.onUpdateItemPrice,
  });

  bool get isFacility => user['appRole'] == 'FACILITY';


  @override
  Widget build(BuildContext context) {
    final customer = order['customer'] as Map<String, dynamic>?;
    final items = order['items'] as List<dynamic>? ?? [];
    final cfg = statusConfig[order['status']] ?? {'label': order['status'], 'emoji': '📦'};
    final nextStatus = cfg['next'] as String?;

    return GestureDetector(
      onTap: onClose,
      child: Container(
        color: Colors.black.withOpacity(0.7),
        child: GestureDetector(
          onTap: () {},
          child: Align(
            alignment: Alignment.bottomCenter,
            child: Container(
              height: MediaQuery.of(context).size.height * 0.85,
              decoration: const BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
              ),
              child: Column(
                children: [
                  Padding(
                    padding: const EdgeInsets.fromLTRB(24, 20, 16, 16),
                    child: Row(
                      children: [
                        const Text("Buyurtma ma'lumoti", style: TextStyle(color: kTextPrimary, fontSize: 18, fontWeight: FontWeight.w800)),
                        const Spacer(),
                        IconButton(onPressed: onClose, icon: const Icon(Icons.close, color: kTextPrimary)),
                      ],
                    ),
                  ),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.fromLTRB(24, 0, 24, 24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Text('BUYURTMA', style: TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                              Text('#${order['id'].toString().substring(0, 8)}', style: const TextStyle(color: kTextPrimary, fontWeight: FontWeight.w700)),
                            ]),
                            Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              const Text('SANA', style: TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                              Text(
                                DateTime.parse(order['createdAt']).toLocal().toString().substring(0, 10),
                                style: const TextStyle(color: kTextPrimary, fontWeight: FontWeight.w700),
                              ),
                            ]),
                          ]),
                          const SizedBox(height: 20),
                          // Customer card
                          if (customer != null)
                            Container(
                              padding: const EdgeInsets.all(20),
                              decoration: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(20)),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    children: [
                                      Expanded(child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text('MIJOZ', style: TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w600)),
                                          const SizedBox(height: 4),
                                          Text(customer['fullName'] ?? '', style: const TextStyle(color: kTextPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
                                          if (customer['phone1'] != null)
                                            Text(customer['phone1'], style: const TextStyle(color: kTextSecondary, fontSize: 14)),
                                        ],
                                      )),
                                      GestureDetector(
                                        onTap: () => launchUrl(Uri.parse('tel:${customer['phone1']}')),
                                        child: Container(width: 48, height: 48, decoration: BoxDecoration(color: kPrimary.withOpacity(0.1), shape: BoxShape.circle), child: const Icon(Icons.call, color: kPrimary, size: 20)),
                                      ),
                                      const SizedBox(width: 12),
                                      GestureDetector(
                                        onTap: () => onOpenMap(order),
                                        child: Container(width: 48, height: 48, decoration: BoxDecoration(color: const Color(0xFF38bdf8).withOpacity(0.1), shape: BoxShape.circle), child: const Icon(Icons.navigation, color: Color(0xFF38bdf8), size: 20)),
                                      ),
                                    ],
                                  ),
                                  if (order['notes'] != null) ...[
                                    const Divider(color: kBorder, height: 24),
                                    const Text('IZOHLAR', style: TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w600)),
                                    const SizedBox(height: 6),
                                    Text('"${order['notes']}"', style: const TextStyle(color: Color(0xFFfacc15), fontSize: 14, fontStyle: FontStyle.italic)),
                                  ],
                                ],
                              ),
                            ),
                          const SizedBox(height: 20),
                          // Items
                          const Text('TARKIBIY QISMLAR', style: TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w600, letterSpacing: 0.5)),
                          const SizedBox(height: 12),
                          ...items.asMap().entries.map((entry) {
                            final it = entry.value as Map<String, dynamic>;
                            return _ItemRow(item: it, isFacility: isFacility, onUpdatePrice: (p) => onUpdateItemPrice(it['id'], p));
                          }),
                          const SizedBox(height: 24),
                          // Action button
                          if (isFacility) ...[
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFf59e0b), foregroundColor: kBackground),
                                onPressed: () => onSetTotal(order),
                                child: const Text('💰 Summa Belgilash'),
                              ),
                            ),
                            const SizedBox(height: 10),
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: updatingId == order['id'] ? null : () => onAutoNextStage(
                                  order['id'], order['status'],
                                  (order['facilityStage'] as Map<String, dynamic>?)?['id'],
                                ),
                                child: updatingId == order['id']
                                    ? const CircularProgressIndicator(color: kBackground, strokeWidth: 2)
                                    : const Text("Keyingi bo'limga o'tkazish ➡️"),
                              ),
                            ),
                          ] else if (nextStatus != null)
                            SizedBox(
                              width: double.infinity,
                              child: ElevatedButton(
                                onPressed: updatingId == order['id'] ? null : () => onUpdateStatus(order['id'], nextStatus),
                                child: updatingId == order['id']
                                    ? const CircularProgressIndicator(color: kBackground, strokeWidth: 2)
                                    : Text(cfg['nextLabel'] as String? ?? 'Keyingi'),
                              ),
                            ),
                          const SizedBox(height: 16),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ItemRow extends StatefulWidget {
  final Map<String, dynamic> item;
  final bool isFacility;
  final Function(num) onUpdatePrice;
  const _ItemRow({required this.item, required this.isFacility, required this.onUpdatePrice});
  @override
  State<_ItemRow> createState() => _ItemRowState();
}

class _ItemRowState extends State<_ItemRow> {
  late TextEditingController _priceCtrl;
  @override
  void initState() {
    super.initState();
    final p = (widget.item['totalPrice'] ?? 0);
    _priceCtrl = TextEditingController(text: p != 0 ? p.toString() : '');
  }
  @override
  void dispose() { _priceCtrl.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final service = item['service'] as Map<String, dynamic>?;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          Container(width: 44, height: 44, decoration: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(14)), child: const Icon(Icons.layers, color: kTextMuted, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(service?['name'] ?? 'Xizmat turi', style: const TextStyle(color: kTextPrimary, fontWeight: FontWeight.w700, fontSize: 15)),
              Text('${item['quantity']} ${service?['measurementUnit'] ?? 'kv.m'}', style: const TextStyle(color: kTextMuted, fontSize: 12)),
            ],
          )),
          if (!widget.isFacility)
            SizedBox(
              width: 90,
              child: TextField(
                controller: _priceCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: kPrimary, fontWeight: FontWeight.w800, fontSize: 15),
                textAlign: TextAlign.right,
                decoration: const InputDecoration(
                  suffixText: "so'm", suffixStyle: TextStyle(color: kTextMuted, fontSize: 11),
                  border: InputBorder.none,
                  contentPadding: EdgeInsets.zero,
                ),
                onEditingComplete: () {
                  final p = num.tryParse(_priceCtrl.text);
                  if (p != null && p >= 0) widget.onUpdatePrice(p);
                },
              ),
            )
          else
            Text('${item['totalPrice'] ?? 0} so\'m', style: const TextStyle(color: kPrimary, fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
