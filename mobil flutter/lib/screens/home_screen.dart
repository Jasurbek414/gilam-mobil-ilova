import 'package:flutter/material.dart';
import '../core/theme.dart';
import 'orders_screen.dart';
import 'chat_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  final Map<String, dynamic> user;
  final VoidCallback onLogout;
  const HomeScreen({super.key, required this.user, required this.onLogout});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;

  @override
  Widget build(BuildContext context) {
    final user = widget.user;
    final isFac = user['appRole'] == 'FACILITY';
    final role = isFac ? 'Sex xodimi' : 'Haydovchi';

    final pages = [
      OrdersPage(user: user),
      ChatPage(currentUser: user),
      ProfileScreen(user: user, onLogout: widget.onLogout),
    ];

    return Scaffold(
      backgroundColor: kBackground,
      appBar: _buildAppBar(role, isFac),
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: _buildNavBar(),
    );
  }

  PreferredSizeWidget _buildAppBar(String role, bool isFac) {
    return AppBar(
      backgroundColor: kBackground,
      elevation: 0,
      titleSpacing: 16,
      title: Row(children: [
        Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: kPrimary.withAlpha(20),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: kPrimary.withAlpha(40)),
          ),
          child: const Center(child: Text('🏠', style: TextStyle(fontSize: 20))),
        ),
        const SizedBox(width: 10),
        Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Gilam Driver',
              style: TextStyle(color: kTextPrimary, fontSize: 16, fontWeight: FontWeight.w900)),
          Text(role, style: const TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w500)),
        ]),
      ]),
      actions: [
        Container(
          margin: const EdgeInsets.only(right: 14),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(
            color: kPrimary.withAlpha(20),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: kPrimary.withAlpha(60)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(width: 7, height: 7, decoration: const BoxDecoration(color: kPrimary, shape: BoxShape.circle)),
            const SizedBox(width: 6),
            Text(isFac ? 'Sex' : 'Haydovchi',
                style: const TextStyle(color: kPrimary, fontSize: 11, fontWeight: FontWeight.w700)),
          ]),
        ),
      ],
    );
  }

  Widget _buildNavBar() {
    final items = [
      _NavItem(icon: Icons.list_alt_outlined, activeIcon: Icons.list_alt_rounded, label: 'Buyurtmalar'),
      _NavItem(icon: Icons.chat_bubble_outline_rounded, activeIcon: Icons.chat_bubble_rounded, label: 'Operator'),
      _NavItem(icon: Icons.person_outline_rounded, activeIcon: Icons.person_rounded, label: 'Profil'),
    ];

    return Container(
      decoration: BoxDecoration(
        color: kSurface,
        border: Border(top: BorderSide(color: kSurface2, width: 1)),
      ),
      child: SafeArea(
        child: SizedBox(
          height: 64,
          child: Row(
            children: List.generate(items.length, (i) {
              final selected = _tab == i;
              final item = items[i];
              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => setState(() => _tab = i),
                  child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                      decoration: BoxDecoration(
                        color: selected ? kPrimary.withAlpha(20) : Colors.transparent,
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Icon(
                        selected ? item.activeIcon : item.icon,
                        color: selected ? kPrimary : kTextMuted,
                        size: 24,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.label,
                      style: TextStyle(
                        color: selected ? kPrimary : kTextMuted,
                        fontSize: 11,
                        fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                      ),
                    ),
                  ]),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}

class _NavItem {
  final IconData icon, activeIcon;
  final String label;
  _NavItem({required this.icon, required this.activeIcon, required this.label});
}
