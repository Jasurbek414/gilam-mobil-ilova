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

// Top-level background handler — must be top-level
@pragma('vm:entry-point')
Future<void> _firebaseBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[FCM-BG] Message: ${message.notification?.title}');
}

final FlutterLocalNotificationsPlugin _localNotifs =
    FlutterLocalNotificationsPlugin();

const String _channelDefault = 'gilam_default';
const String _channelChat = 'gilam_chat';

Future<void> _setupLocalNotifications() async {
  const AndroidInitializationSettings android =
      AndroidInitializationSettings('@mipmap/ic_launcher');
  await _localNotifs.initialize(
    settings: const InitializationSettings(android: android),
    onDidReceiveNotificationResponse: (_) {},
  );

  final plugin = _localNotifs
      .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  await plugin?.createNotificationChannel(const AndroidNotificationChannel(
    _channelDefault, 'Bildirishnomalar',
    importance: Importance.max, playSound: true, enableVibration: true,
  ));
  await plugin?.createNotificationChannel(const AndroidNotificationChannel(
    _channelChat, 'Chat xabarlari',
    importance: Importance.max, playSound: true, enableVibration: true,
    showBadge: true,
  ));
}

void _showNotif(RemoteMessage msg) {
  final n = msg.notification;
  if (n == null) return;
  final ch = msg.data['channelId'] as String? ?? _channelDefault;
  _localNotifs.show(
    id: n.hashCode,
    title: n.title,
    body: n.body,
    notificationDetails: NotificationDetails(
      android: AndroidNotificationDetails(
        ch, ch,
        importance: Importance.max,
        priority: Priority.high,
        playSound: true,
        enableVibration: true,
        icon: '@mipmap/ic_launcher',
      ),
    ),
  );
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  
  try {
    await Firebase.initializeApp();
    FirebaseMessaging.onBackgroundMessage(_firebaseBackgroundHandler);
    await _setupLocalNotifications();
  } catch (e) {
    debugPrint('[Main] Firebase init error: $e');
  }

  runApp(const GilamApp());
}

class GilamApp extends StatefulWidget {
  const GilamApp({super.key});
  @override
  State<GilamApp> createState() => _GilamAppState();
}

class _GilamAppState extends State<GilamApp> with WidgetsBindingObserver {
  Map<String, dynamic>? _user;
  bool _loading = true;
  String? _fcmToken;
  bool _fcmTokenSynced = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _boot();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _user != null && !_fcmTokenSynced) {
      _registerFcm();
    }
  }

  Future<void> _boot() async {
    // Load saved session
    final jwtToken = await getToken();
    if (jwtToken != null) {
      final saved = await getSavedUser();
      if (mounted) setState(() => _user = saved);
    }
    if (mounted) setState(() => _loading = false);

    // Listen foreground FCM
    FirebaseMessaging.onMessage.listen(_showNotif);

    // Register FCM if already logged in 
    if (_user != null) {
      await _registerFcm();
    }
  }

  Future<void> _registerFcm() async {
    try {
      // Step 1: Android 13+ notification permission
      if (Platform.isAndroid) {
        final status = await Permission.notification.status;
        debugPrint('[FCM] Permission status: $status');

        if (status.isDenied || status.isRestricted) {
          final result = await Permission.notification.request();
          debugPrint('[FCM] Permission after request: $result');
          if (!result.isGranted) {
            debugPrint('[FCM] Permission denied — cannot receive notifications');
            return;
          }
        }
      }

      final fm = FirebaseMessaging.instance;

      // Step 2: iOS permission (Android handled above)
      if (!Platform.isAndroid) {
        final s = await fm.requestPermission(alert: true, sound: true, badge: true);
        if (s.authorizationStatus == AuthorizationStatus.denied) return;
      }

      // Step 3: Get FCM token
      String? token;
      try {
        token = await fm.getToken().timeout(
          const Duration(seconds: 15),
          onTimeout: () {
            debugPrint('[FCM] getToken() timed out!');
            return null;
          },
        );
      } catch (e) {
        debugPrint('[FCM] getToken() error: $e');
        return;
      }

      if (token == null || token.isEmpty) {
        debugPrint('[FCM] Token is null/empty — Google Play Services available?');
        return;
      }

      debugPrint('[FCM] Token obtained: ${token.substring(0, 40)}...');
      _fcmToken = token;

      // Step 4: Send to backend
      try {
        await updatePushToken(token);
        _fcmTokenSynced = true;
        debugPrint('[FCM] ✅ Token saved to backend!');
      } catch (e) {
        _fcmTokenSynced = false;
        debugPrint('[FCM] Failed to save token: $e');
      }

      // Step 5: Handle token refresh
      fm.onTokenRefresh.listen((newToken) async {
        debugPrint('[FCM] Token refreshed');
        _fcmToken = newToken;
        try { await updatePushToken(newToken); } catch (_) {}
      });

    } catch (e) {
      debugPrint('[FCM] Unexpected error: $e');
    }
  }

  void _handleLogin(Map<String, dynamic> user) {
    setState(() => _user = user);
    _registerFcm(); // Register FCM after login
  }

  Future<void> _handleLogout() async {
    await logout();
    setState(() { _user = null; _fcmToken = null; _fcmTokenSynced = false; });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Gilam Driver',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: _loading
          ? const _Splash()
          : _user == null
              ? LoginScreen(onLogin: _handleLogin)
              : HomeScreen(user: _user!, onLogout: _handleLogout),
    );
  }
}

class _Splash extends StatelessWidget {
  const _Splash();
  @override
  Widget build(BuildContext context) => const Scaffold(
    backgroundColor: kBackground,
    body: Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.directions_car_filled_rounded, size: 72, color: kPrimary),
          SizedBox(height: 20),
          Text('Gilam Driver', style: TextStyle(
            color: kTextPrimary, fontSize: 26, fontWeight: FontWeight.w900,
          )),
          SizedBox(height: 8),
          Text('Yuklanmoqda...', style: TextStyle(color: kTextMuted)),
          SizedBox(height: 32),
          CircularProgressIndicator(color: kPrimary, strokeWidth: 2),
        ],
      ),
    ),
  );
}
