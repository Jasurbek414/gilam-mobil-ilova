import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

const String apiBase = 'https://gilam-api.ecos.uz/api';

// ─── Token helpers ────────────────────────────────────────────────────────────
Future<String?> getToken() async {
  final prefs = await SharedPreferences.getInstance();
  return prefs.getString('token');
}

Future<void> setToken(String token) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('token', token);
}

Future<void> removeToken() async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove('token');
  await prefs.remove('user');
}

Future<Map<String, dynamic>?> getSavedUser() async {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString('user');
  if (raw == null) return null;
  return jsonDecode(raw) as Map<String, dynamic>;
}

Future<void> saveUser(Map<String, dynamic> user) async {
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString('user', jsonEncode(user));
}

// ─── Generic HTTP request ─────────────────────────────────────────────────────
Future<dynamic> apiRequest(
  String path, {
  String method = 'GET',
  Map<String, dynamic>? body,
}) async {
  final token = await getToken();
  final headers = <String, String>{
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  final uri = Uri.parse('$apiBase$path');
  http.Response res;

  switch (method.toUpperCase()) {
    case 'POST':
      res = await http.post(uri, headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 15));
    case 'PUT':
      res = await http.put(uri, headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 15));
    case 'PATCH':
      res = await http.patch(uri, headers: headers, body: jsonEncode(body))
          .timeout(const Duration(seconds: 15));
    case 'DELETE':
      res = await http.delete(uri, headers: headers)
          .timeout(const Duration(seconds: 15));
    default:
      res = await http.get(uri, headers: headers)
          .timeout(const Duration(seconds: 15));
  }

  if (res.statusCode == 401) {
    if (path == '/auth/login') throw Exception("Telefon raqam yoki parol noto'g'ri!");
    await removeToken();
    throw Exception('SESSION_EXPIRED');
  }

  if (res.statusCode == 204) return null;

  final ct = res.headers['content-type'] ?? '';
  if (!ct.contains('application/json')) return null;

  final decoded = jsonDecode(res.body);
  if (res.statusCode >= 400) {
    final msg = decoded['message'];
    throw Exception(msg is List ? msg.join(', ') : (msg ?? 'Server xatoligi'));
  }

  return decoded;
}

// ─── Companies ───────────────────────────────────────────────────────────────
Future<List<Map<String, dynamic>>> getCompanies() async {
  final res = await http.get(
    Uri.parse('$apiBase/public/companies'),
    headers: {'Accept': 'application/json'},
  );
  if (!res.ok) throw Exception('Kompaniyalar yuklanmadi');
  final data = jsonDecode(res.body) as List;
  return data.cast<Map<String, dynamic>>();
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
Future<Map<String, dynamic>> login(String phone, String password) async {
  final data = await apiRequest('/auth/login', method: 'POST', body: {
    'phone': phone,
    'password': password,
  }) as Map<String, dynamic>;
  await setToken(data['access_token'] as String);
  return data['user'] as Map<String, dynamic>;
}

Future<void> logout() async => removeToken();

// ─── Push Token ───────────────────────────────────────────────────────────────
Future<void> updatePushToken(String token) async {
  await apiRequest('/users/push-token', method: 'PUT', body: {'token': token});
}

// ─── Orders ───────────────────────────────────────────────────────────────────
Future<List<dynamic>> getMyOrders(String userId) async {
  return (await apiRequest('/orders/driver/$userId') as List?) ?? [];
}

Future<List<dynamic>> getDriverOrderHistory(String userId) async {
  return (await apiRequest('/orders/driver/$userId/history') as List?) ?? [];
}

Future<List<dynamic>> getFacilityOrderHistory(String companyId) async {
  return (await apiRequest('/orders/facility/$companyId/history') as List?) ?? [];
}

Future<List<dynamic>> getFacilityOrders(String companyId) async {
  return (await apiRequest('/orders/facility/$companyId') as List?) ?? [];
}

Future<Map<String, dynamic>> updateOrderStatus(
  String orderId,
  String status, {
  String? notes,
  String? deadlineDate,
  String? facilityStageId,
}) async {
  final body = <String, dynamic>{'status': status};
  if (notes != null) body['notes'] = notes;
  if (deadlineDate != null) body['deadlineDate'] = deadlineDate;
  if (facilityStageId != null) body['facilityStageId'] = facilityStageId;
  return await apiRequest('/orders/$orderId/status', method: 'PATCH', body: body)
      as Map<String, dynamic>;
}

Future<void> updateItemPrice(String itemId, num price) async {
  await apiRequest('/orders/items/$itemId/price', method: 'PATCH', body: {'price': price});
}

Future<void> updateOrderTotal(String orderId, num totalAmount) async {
  await apiRequest('/orders/$orderId/total', method: 'PATCH', body: {'totalAmount': totalAmount});
}

// ─── Facility Stages ──────────────────────────────────────────────────────────
Future<List<dynamic>> getFacilityStages(String companyId) async {
  return (await apiRequest('/facility-stages/company/$companyId') as List?) ?? [];
}

Future<Map<String, dynamic>> createFacilityStage(
    String companyId, String name, String icon) async {
  return await apiRequest('/facility-stages',
      method: 'POST', body: {'companyId': companyId, 'name': name, 'icon': icon});
}

Future<void> deleteFacilityStage(String stageId) async {
  await apiRequest('/facility-stages/$stageId', method: 'DELETE');
}

Future<void> reorderFacilityStages(String companyId, List<String> stageIds) async {
  await apiRequest('/facility-stages/reorder',
      method: 'PUT', body: {'companyId': companyId, 'stageIds': stageIds});
}

// ─── Expenses ─────────────────────────────────────────────────────────────────
Future<Map<String, dynamic>> createExpense(Map<String, dynamic> data) async {
  return await apiRequest('/expenses', method: 'POST', body: data);
}

Future<List<dynamic>> getDriverExpenses(String userId) async {
  return (await apiRequest('/expenses/user/$userId') as List?) ?? [];
}

Future<void> deleteExpense(String id) async {
  await apiRequest('/expenses/$id', method: 'DELETE');
}

Future<void> updateExpense(String id, Map<String, dynamic> data) async {
  await apiRequest('/expenses/$id', method: 'PATCH', body: data);
}

// ─── Messages ─────────────────────────────────────────────────────────────────
Future<List<dynamic>> getMessageHistory(String otherUserId) async {
  return (await apiRequest('/messages/history/$otherUserId') as List?) ?? [];
}

Future<Map<String, dynamic>?> getSupportContact() async {
  return await apiRequest('/messages/support-contact') as Map<String, dynamic>?;
}

// Extension helper
extension ResponseOk on http.Response {
  bool get ok => statusCode >= 200 && statusCode < 300;
}
