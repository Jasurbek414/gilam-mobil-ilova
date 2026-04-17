import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';
import '../screens/orders_screen.dart';
import '../screens/chat_screen.dart';
import '../screens/profile_screen.dart';

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

    final pages = [
      OrdersPage(user: user),
      ChatScreen(currentUser: user),
      ProfileScreen(user: user, onLogout: widget.onLogout),
    ];

    return Scaffold(
      backgroundColor: kBackground,
      appBar: AppBar(
        backgroundColor: kBackground,
        title: Row(children: [
          Container(
            width: 36, height: 36,
            decoration: BoxDecoration(color: kPrimary.withOpacity(0.1), borderRadius: BorderRadius.circular(10), border: Border.all(color: kPrimary.withOpacity(0.2))),
            child: const Center(child: Text('🏠', style: TextStyle(fontSize: 18))),
          ),
          const SizedBox(width: 12),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const Text('Gilam Driver', style: TextStyle(color: kTextPrimary, fontSize: 16, fontWeight: FontWeight.w900)),
            Text(isFac ? 'Sex xodimi' : 'Haydovchi', style: const TextStyle(color: kTextMuted, fontSize: 11)),
          ]),
        ]),
        actions: [
          if (_tab == 0)
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(color: kSurface2, borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  const Icon(Icons.circle, size: 8, color: kPrimary),
                  const SizedBox(width: 6),
                  Text(isFac ? 'Sex' : 'Haydovchi', style: const TextStyle(color: kTextSecondary, fontSize: 12, fontWeight: FontWeight.w700)),
                ]),
              ),
            ),
        ],
      ),
      body: IndexedStack(index: _tab, children: pages),
      bottomNavigationBar: Container(
        decoration: const BoxDecoration(
          color: kSurface,
          border: Border(top: BorderSide(color: kSurface2)),
        ),
        child: BottomNavigationBar(
          currentIndex: _tab,
          onTap: (i) => setState(() => _tab = i),
          backgroundColor: kSurface,
          selectedItemColor: kPrimary,
          unselectedItemColor: kTextMuted,
          type: BottomNavigationBarType.fixed,
          selectedLabelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 11),
          unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 11),
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.list_alt_outlined), activeIcon: Icon(Icons.list_alt), label: 'Buyurtmalar'),
            BottomNavigationBarItem(icon: Icon(Icons.chat_bubble_outline), activeIcon: Icon(Icons.chat_bubble), label: 'Operator'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profil'),
          ],
        ),
      ),
    );
  }
}
