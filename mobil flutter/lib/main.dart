import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'core/api.dart';
import 'core/theme.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

// Top-level background handler
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
}

final FlutterLocalNotificationsPlugin _localNotifs =
    FlutterLocalNotificationsPlugin();

Future<void> _setupLocalNotifications() async {
  const AndroidInitializationSettings androidSettings =
      AndroidInitializationSettings('@mipmap/ic_launcher');
  const InitializationSettings initSettings =
      InitializationSettings(android: androidSettings);
  await _localNotifs.initialize(
    settings: initSettings,
    onDidReceiveNotificationResponse: (details) {},
  );

  // Create high-priority channels
  for (final ch in [
    const AndroidNotificationChannel(
      'default', 'Bildirishnomalar',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
      showBadge: true,
    ),
    const AndroidNotificationChannel(
      'chat_messages', '💬 Chat xabarlari',
      importance: Importance.max,
      playSound: true,
      enableVibration: true,
      showBadge: true,
    ),
  ]) {
    await _localNotifs
        .resolvePlatformSpecificImplementation<
            AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(ch);
  }
}

void _showLocalNotification(RemoteMessage message) {
  final n = message.notification;
  if (n == null) return;
  final channelId = message.data['channelId'] as String? ?? 'default';
  _localNotifs.show(
    id: n.hashCode,
    title: n.title,
    body: n.body,
    notificationDetails: NotificationDetails(
      android: AndroidNotificationDetails(
        channelId,
        channelId,
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        icon: '@mipmap/ic_launcher',
      ),
    ),
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
  await _setupLocalNotifications();
  runApp(const GilamDriverApp());
}

class GilamDriverApp extends StatefulWidget {
  const GilamDriverApp({super.key});
  @override
  State<GilamDriverApp> createState() => _GilamDriverAppState();
}

class _GilamDriverAppState extends State<GilamDriverApp> {
  Map<String, dynamic>? _user;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final token = await getToken();
    if (token != null) {
      final saved = await getSavedUser();
      if (mounted) setState(() => _user = saved);
    }

    setState(() => _loading = false);

    // Listen foreground FCM
    FirebaseMessaging.onMessage.listen(_showLocalNotification);

    // If already logged in → register FCM
    if (_user != null) {
      await _registerFcm();
    }
  }

  // ── FCM Registration ────────────────────────────────────────────────────────
  Future<void> _registerFcm() async {
    try {
      // Android 13+ — runtime notification permission
      if (Platform.isAndroid) {
        final status = await Permission.notification.status;
        debugPrint('[FCM] Notification permission status: $status');
        if (!status.isGranted) {
          final result = await Permission.notification.request();
          debugPrint('[FCM] Notification permission result: $result');
          if (!result.isGranted) {
            debugPrint('[FCM] ⚠️ Ruxsat berilmadi — token olinmaydi');
            return;
          }
        }
      }

      final messaging = FirebaseMessaging.instance;

      // iOS permission (Android 13+ already handled above)
      final settings = await messaging.requestPermission(
        alert: true, badge: true, sound: true,
        announcement: false, carPlay: false,
        criticalAlert: false, provisional: false,
      );
      debugPrint('[FCM] Auth status: ${settings.authorizationStatus}');

      // Get FCM token
      final fcmToken = await messaging.getToken();
      if (fcmToken == null) {
        debugPrint('[FCM] ❌ Token null — Google Play Services mavjudmi?');
        return;
      }

      debugPrint('[FCM] ✅ Token: ${fcmToken.substring(0, 30)}...');

      // Save to backend
      await updatePushToken(fcmToken);
      debugPrint('[FCM] ✅ Token backendga saqlandi!');

      // Auto-refresh
      messaging.onTokenRefresh.listen((newToken) async {
        debugPrint('[FCM] 🔄 Token yangilandi');
        await updatePushToken(newToken);
      });
    } catch (e) {
      debugPrint('[FCM] ❌ Error: $e');
    }
  }

  void _handleLogin(Map<String, dynamic> user) {
    setState(() => _user = user);
    // Register FCM after login
    _registerFcm();
  }

  Future<void> _handleLogout() async {
    await logout();
    setState(() => _user = null);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gilam Driver',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: _loading
          ? const _SplashScreen()
          : _user == null
              ? LoginScreen(onLogin: _handleLogin)
              : HomeScreen(user: _user!, onLogout: _handleLogout),
    );
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: kBackground,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.directions_car, size: 64, color: kPrimary),
            SizedBox(height: 24),
            Text(
              'Gilam Driver',
              style: TextStyle(
                color: kTextPrimary,
                fontSize: 24,
                fontWeight: FontWeight.w900,
              ),
            ),
            SizedBox(height: 24),
            CircularProgressIndicator(color: kPrimary),
          ],
        ),
      ),
    );
  }
}
