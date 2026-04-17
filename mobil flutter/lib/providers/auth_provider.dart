import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api.dart';

class AuthProvider extends ChangeNotifier {
  Map<String, dynamic>? _user;
  bool _loading = true;

  Map<String, dynamic>? get user => _user;
  bool get loading => _loading;
  bool get isLoggedIn => _user != null;

  Future<void> init() async {
    final token = await getToken();
    if (token != null) {
      final saved = await getSavedUser();
      _user = saved;
    }
    _loading = false;
    notifyListeners();
  }

  Future<void> login(String phone, String password, String companyName, String appRole) async {
    final userData = await apiLogin(phone, password);

    final role = userData['role'] as String? ?? '';
    if (!['DRIVER', 'WASHER', 'FINISHER'].contains(role)) {
      throw Exception('Bu ilova faqat Haydovchi va Sex xodimlari uchun!');
    }

    final company = userData['company'] as Map<String, dynamic>?;
    if (company == null ||
        !(company['name'] as String)
            .toLowerCase()
            .contains(companyName.trim().toLowerCase())) {
      throw Exception("Kiritilgan kampaniya nomi xato yoki bunday kampaniyada ishlamaysiz!");
    }

    final fullUser = {...userData, 'appRole': appRole};
    await saveUser(fullUser);
    _user = fullUser;
    notifyListeners();
  }

  Future<void> logout() async {
    await removeToken();
    _user = null;
    notifyListeners();
  }

  void setUser(Map<String, dynamic> user) {
    _user = user;
    notifyListeners();
  }
}

Future<Map<String, dynamic>> apiLogin(String phone, String password) async {
  return await apiRequest('/auth/login', method: 'POST', body: {
    'phone': phone,
    'password': password,
  }).then((data) {
    final map = data as Map<String, dynamic>;
    setToken(map['access_token'] as String);
    return map['user'] as Map<String, dynamic>;
  });
}
