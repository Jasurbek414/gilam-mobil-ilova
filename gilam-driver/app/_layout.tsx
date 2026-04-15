import { useState, useEffect, useRef, createContext, useContext } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import { getToken, getUser, User } from '../lib/api';
import {
  syncPushTokenToBackend,
  setupForegroundNotificationHandler,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '../lib/notifications';

// ─── Auth Context ─────────────────────────────────────────────────────────────

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

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router   = useRouter();
  const segments = useSegments();

  const unsub1 = useRef<(() => void) | null>(null);
  const unsub2 = useRef<(() => void) | null>(null);

  // ── 1. Auth + Push token setup ──────────────────────────────────────────
  useEffect(() => {
    // Foreground notification handler — banner ko'rsatish uchun
    // (Expo Go da bu funksiya xavfsiz skip qiladi)
    setupForegroundNotificationHandler();

    async function init() {
      try {
        const token = await getToken();
        if (token) {
          const u = await getUser();
          setUser(u);
          // Push token ni backendga saqlash (Expo Go da skip)
          await syncPushTokenToBackend();
        }
      } catch (e) {
        console.log('[Layout] Auth error:', e);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);

  // ── 2. Notification listeners ────────────────────────────────────────────
  useEffect(() => {
    // Kelgan notification (foreground) — log
    unsub1.current = addNotificationReceivedListener((notification) => {
      console.log('[Push] Foreground:', notification?.request?.content?.title);
    });

    // Notification ga bosilganda → navigatsiya
    unsub2.current = addNotificationResponseListener((response) => {
      const data = response?.notification?.request?.content?.data || {};
      if (data.type === 'chat' && data.senderId) {
        try {
          router.push({
            pathname: '/chat',
            params: {
              operatorId: data.senderId,
              companyId:  data.companyId || '',
            },
          });
        } catch (e) {
          console.warn('[Push] Navigate error:', e);
        }
      }
      if (data.type === 'customer_location') {
        try { router.push('/'); } catch (_) {}
      }
    });

    return () => {
      unsub1.current?.();
      unsub2.current?.();
    };
  }, []);

  // ── 3. Route guard ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isLoading) return;
    const inAuth = segments[0] === 'login';
    if (!user && !inAuth)  router.replace('/login');
    if (user  && inAuth)   router.replace('/');
  }, [user, segments, isLoading]);

  // ── Loading ──────────────────────────────────────────────────────────────
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
