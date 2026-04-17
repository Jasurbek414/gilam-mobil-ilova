import 'package:flutter/material.dart';
import '../core/api.dart';
import '../core/theme.dart';

class LoginScreen extends StatefulWidget {
  final Function(Map<String, dynamic> user) onLogin;
  const LoginScreen({super.key, required this.onLogin});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  List<Map<String, dynamic>> _companies = [];
  String _companyName = '';
  String _appRole = 'DRIVER';
  bool _loadingCompanies = false;
  bool _loading = false;
  bool _showCompanyPicker = false;
  bool _showRolePicker = false;

  final TextEditingController _phoneCtrl = TextEditingController();
  final TextEditingController _passCtrl = TextEditingController();

  @override
  void initState() {
    super.initState();
    _fetchCompanies();
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchCompanies() async {
    setState(() => _loadingCompanies = true);
    try {
      final data = await getCompanies();
      if (mounted) setState(() => _companies = data);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text("Kompaniyalar yuklanmadi: ${e.toString().replaceFirst('Exception: ', '')}"),
          backgroundColor: Colors.red.shade900,
        ));
      }
    } finally {
      if (mounted) setState(() => _loadingCompanies = false);
    }
  }

  Future<void> _handleLogin() async {
    if (_companyName.trim().isEmpty || _phoneCtrl.text.trim().isEmpty || _passCtrl.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(
        content: Text("Ma'lumotlarni to'liq kiriting"),
        backgroundColor: Color(0xFF991b1b),
      ));
      return;
    }
    setState(() => _loading = true);
    try {
      final userData = await apiRequest('/auth/login', method: 'POST', body: {
        'phone': _phoneCtrl.text.trim(),
        'password': _passCtrl.text.trim(),
      }) as Map<String, dynamic>;

      final token = userData['access_token'] as String;
      await setToken(token);
      final user = userData['user'] as Map<String, dynamic>;

      final role = user['role'] as String? ?? '';
      if (!['DRIVER', 'WASHER', 'FINISHER'].contains(role)) {
        throw Exception('Bu ilova faqat Haydovchi va Sex xodimlari uchun!');
      }

      final company = user['company'] as Map<String, dynamic>?;
      if (company == null || !(company['name'] as String).toLowerCase().contains(_companyName.trim().toLowerCase())) {
        throw Exception("Kiritilgan kampaniya nomi xato yoki bunday kampaniyada ishlamaysiz!");
      }

      final fullUser = {...user, 'appRole': _appRole};
      await saveUser(fullUser);
      widget.onLogin(fullUser);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text(e.toString().replaceFirst('Exception: ', '')),
          backgroundColor: Colors.red.shade900,
        ));
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: kBackground,
      body: Stack(
        children: [
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 48),
                  // Logo
                  Container(
                    width: 72, height: 72,
                    decoration: BoxDecoration(
                      color: kSurface,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: kSurface2),
                    ),
                    child: const Icon(Icons.directions_car, size: 38, color: kPrimary),
                  ),
                  const SizedBox(height: 24),
                  const Text('Gilam Driver', style: TextStyle(color: kTextPrimary, fontSize: 32, fontWeight: FontWeight.w900, letterSpacing: -0.5)),
                  const Text('Eksklyuziv hamkorlik platformasi', style: TextStyle(color: kTextSecondary, fontSize: 13, fontWeight: FontWeight.w500, letterSpacing: 1)),
                  const SizedBox(height: 48),

                  // Company picker
                  _Tile(
                    icon: Icons.business,
                    text: _companyName.isEmpty ? 'Kampaniya nomini tanlang' : _companyName,
                    placeholder: _companyName.isEmpty,
                    trailing: _loadingCompanies
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: kPrimary))
                        : const Icon(Icons.keyboard_arrow_down, color: kTextMuted),
                    onTap: () => setState(() => _showCompanyPicker = true),
                  ),
                  const SizedBox(height: 12),

                  // Role picker
                  _Tile(
                    icon: Icons.people,
                    text: _appRole == 'DRIVER' ? 'Haydovchi (Yetkazib berish)' : "Sex xodimi (Yuvish/Quritish)",
                    trailing: const Icon(Icons.keyboard_arrow_down, color: kTextMuted),
                    onTap: () => setState(() => _showRolePicker = true),
                  ),
                  const SizedBox(height: 12),

                  // Phone
                  _InputField(
                    ctrl: _phoneCtrl,
                    icon: Icons.call,
                    hint: 'Telefon raqamingiz',
                    keyboardType: TextInputType.phone,
                  ),
                  const SizedBox(height: 12),

                  // Password
                  _InputField(
                    ctrl: _passCtrl,
                    icon: Icons.lock_outline,
                    hint: 'Maxfiy parolingiz',
                    obscure: true,
                  ),
                  const SizedBox(height: 24),

                  // Login button
                  SizedBox(
                    width: double.infinity,
                    height: 60,
                    child: ElevatedButton(
                      onPressed: _loading ? null : _handleLogin,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: kPrimary,
                        foregroundColor: kBackground,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 6,
                        shadowColor: kPrimary.withOpacity(0.4),
                      ),
                      child: _loading
                          ? const CircularProgressIndicator(color: kBackground, strokeWidth: 2)
                          : const Text('TIZIMGA KIRISH', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, letterSpacing: 1)),
                    ),
                  ),
                  const SizedBox(height: 24),
                  const Center(child: Text("Parolni unutdingizmi?", style: TextStyle(color: kTextMuted, fontWeight: FontWeight.w600))),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),

          // Bottom brand
          const Positioned(
            bottom: 20, left: 0, right: 0,
            child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
              Icon(Icons.shield, size: 12, color: kPrimary),
              SizedBox(width: 4),
              Text('Secure TLS Encryption', style: TextStyle(color: kTextMuted, fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1)),
            ]),
          ),

          // Modals
          if (_showCompanyPicker)
            _CompanyPicker(
              companies: _companies,
              loading: _loadingCompanies,
              onSelect: (name) => setState(() { _companyName = name; _showCompanyPicker = false; }),
              onClose: () => setState(() => _showCompanyPicker = false),
            ),
          if (_showRolePicker)
            _RolePicker(
              onSelect: (role) => setState(() { _appRole = role; _showRolePicker = false; }),
              onClose: () => setState(() => _showRolePicker = false),
            ),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final IconData icon;
  final String text;
  final bool placeholder;
  final Widget? trailing;
  final VoidCallback onTap;
  const _Tile({required this.icon, required this.text, this.placeholder = false, this.trailing, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 64, padding: const EdgeInsets.symmetric(horizontal: 16),
        decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(16), border: Border.all(color: kSurface2)),
        child: Row(children: [
          Icon(icon, size: 20, color: kTextMuted),
          const SizedBox(width: 12),
          Expanded(child: Text(text, style: TextStyle(color: placeholder ? kTextMuted : kTextPrimary, fontSize: 16, fontWeight: FontWeight.w600))),
          if (trailing != null) trailing!,
        ]),
      ),
    );
  }
}

class _InputField extends StatelessWidget {
  final TextEditingController ctrl;
  final IconData icon;
  final String hint;
  final bool obscure;
  final TextInputType? keyboardType;
  const _InputField({required this.ctrl, required this.icon, required this.hint, this.obscure = false, this.keyboardType});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 64, padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(color: kSurface, borderRadius: BorderRadius.circular(16), border: Border.all(color: kSurface2)),
      child: Row(children: [
        Icon(icon, size: 20, color: kTextMuted),
        const SizedBox(width: 12),
        Expanded(child: TextField(
          controller: ctrl,
          obscureText: obscure,
          keyboardType: keyboardType,
          style: const TextStyle(color: kTextPrimary, fontSize: 16, fontWeight: FontWeight.w600),
          decoration: InputDecoration(hintText: hint, hintStyle: const TextStyle(color: kTextMuted), border: InputBorder.none),
          cursorColor: kPrimary,
        )),
      ]),
    );
  }
}

class _BottomSheet extends StatelessWidget {
  final String title;
  final Widget child;
  final VoidCallback onClose;
  const _BottomSheet({required this.title, required this.child, required this.onClose});

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
              height: MediaQuery.of(context).size.height * 0.6,
              padding: const EdgeInsets.all(24),
              decoration: const BoxDecoration(
                color: kSurface,
                borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                border: Border(top: BorderSide(color: kSurface2)),
              ),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(title, style: const TextStyle(color: kTextPrimary, fontSize: 20, fontWeight: FontWeight.w800)),
                      GestureDetector(
                        onTap: onClose,
                        child: Container(
                          width: 36, height: 36,
                          decoration: const BoxDecoration(color: kSurface2, shape: BoxShape.circle),
                          child: const Icon(Icons.close, color: kTextPrimary, size: 18),
                        ),
                      ),
                    ],
                  ),
                  const Divider(color: kSurface2, height: 24),
                  Expanded(child: child),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CompanyPicker extends StatelessWidget {
  final List<Map<String, dynamic>> companies;
  final bool loading;
  final Function(String) onSelect;
  final VoidCallback onClose;
  const _CompanyPicker({required this.companies, required this.loading, required this.onSelect, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return _BottomSheet(
      title: 'Kampaniyani tanlang',
      onClose: onClose,
      child: loading
          ? const Center(child: CircularProgressIndicator(color: kPrimary))
          : companies.isEmpty
              ? const Center(child: Text("Kampaniyalar topilmadi", style: TextStyle(color: kTextSecondary)))
              : ListView.separated(
                  itemCount: companies.length,
                  separatorBuilder: (_, __) => const Divider(color: kSurface2, height: 0),
                  itemBuilder: (_, i) => ListTile(
                    leading: const Icon(Icons.business_outlined, color: kPrimary),
                    title: Text(companies[i]['name'] as String, style: const TextStyle(color: kTextPrimary, fontWeight: FontWeight.w700)),
                    onTap: () => onSelect(companies[i]['name'] as String),
                  ),
                ),
    );
  }
}

class _RolePicker extends StatelessWidget {
  final Function(String) onSelect;
  final VoidCallback onClose;
  const _RolePicker({required this.onSelect, required this.onClose});

  @override
  Widget build(BuildContext context) {
    return _BottomSheet(
      title: 'Qaysi vazifada ishlaysiz?',
      onClose: onClose,
      child: Column(
        children: [
          ListTile(
            leading: const Icon(Icons.directions_car_outlined, color: kPrimary),
            title: const Text('Haydovchi (Yetkazish)', style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.w700)),
            onTap: () => onSelect('DRIVER'),
          ),
          const Divider(color: kSurface2, height: 0),
          ListTile(
            leading: const Icon(Icons.water_drop_outlined, color: kPrimary),
            title: const Text('Sex Xodimi (Yuvish/Quritish)', style: TextStyle(color: kTextPrimary, fontWeight: FontWeight.w700)),
            onTap: () => onSelect('FACILITY'),
          ),
        ],
      ),
    );
  }
}
