import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { getToken, getUser, User } from '../lib/api';
import { syncPushTokenToBackend } from '../lib/notifications';

// --- Expo Notifications (faqat real qurilmada) ---
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (_) {}

// Foreground — bildirishnoma har doim ko'rinsin (SMS kabi)
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,      // Ekran tepasidan tushsin
      shouldPlaySound: true,      // Ovoz chiqarsin
      shouldSetBadge: true,       // Badge raqami yangilansin
      priority: Notifications.AndroidNotificationPriority?.HIGH || 'high',
    }),
  });
}

// Android: yuqori prioritetli kanal — SMS kabi "heads-up" notification
async function setupAndroidChannel() {
  if (Platform.OS !== 'android' || !Notifications) return;
  await Notifications.setNotificationChannelAsync('chat_messages', {
    name: 'Chat xabarlari',
    description: 'Operator va haydovchilar o\'rtasidagi chat',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 150, 100, 150],
    lightColor: '#10b981',
    sound: 'default',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC || 1,
  });

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Umumiy bildirishnomalar',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10b981',
    sound: 'default',
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── Auth Context ────────────────────────────────────────────────────────────

interface AuthContextType {
  user: User | null;
  setUser: (u: User | null) => void;
  isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  setUser: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

// ─── Root Layout ─────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();

  // Notification listener refs
  const notificationListener = useRef<any>(null);
  const responseListener    = useRef<any>(null);

  // ── 1. Auth check + push token sync ──────────────────────────────────────
  useEffect(() => {
    async function init() {
      try {
        const token = await getToken();
        if (token) {
          const u = await getUser();
          setUser(u);

          // Android channel — birinchi navbatda sozlaymiz
          await setupAndroidChannel();

          // Push token'ni backendga yuboramiz (ruxsat so'rash ichida)
          await syncPushTokenToBackend();
        }
      } catch (e) {
        console.log('[Layout] Auth check error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // ── 2. Foreground notification listener (ilova ochiq bo'lganda) ───────────
  useEffect(() => {
    if (!Notifications) return;

    // Xabar kelganda (ilova foreground) — avtomatik ko'rinadi (handler yuqorida)
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification: any) => {
        console.log('[Push] Foreground notification received:', notification.request.content.title);
      }
    );

    // Foydalanuvchi notification ga BOSDI
    responseListener.current = Notifications.addNotificationResponseReceivedListener(
      (response: any) => {
        const data = response.notification.request.content.data || {};
        console.log('[Push] Notification tapped, data:', data);

        // Chat xabari bo'lsa → chat ekraniga o'tamiz
        if (data.type === 'chat' && data.senderId) {
          try {
            router.push({
              pathname: '/chat',
              params: { operatorId: data.senderId, companyId: data.companyId || '' },
            });
          } catch (navErr) {
            console.warn('[Push] Navigation error:', navErr);
          }
        }

        // Lokatsiya push bo'lsa → asosiy ekranga o'tamiz
        if (data.type === 'customer_location') {
          try {
            router.push('/');
          } catch (_) {}
        }
      }
    );

    return () => {
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
    };
  }, []);

  // ── 3. Route guard ────────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const inAuthGroup = segments[0] === 'login';
    if (!user && !inAuthGroup) {
      router.replace('/login');
    } else if (user && inAuthGroup) {
      router.replace('/');
    }
  }, [user, segments, isLoading]);

  // ── Loading spinner ───────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#059669' }}>
        <ActivityIndicator size="large" color="#fff" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <AuthContext.Provider value={{ user, setUser, isLoading }}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="login" />
        <Stack.Screen name="chat" options={{ headerShown: true, presentation: 'modal' }} />
      </Stack>
    </AuthContext.Provider>
  );
}
