import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import { request } from './api';

// ─── Expo Go aniqlash ─────────────────────────────────────────────────────────
export const isExpoGo = Constants.appOwnership === 'expo';

// ─── Stub import ─────────────────────────────────────────────────────────────
// Expo Go da bu fayl bo'sh stub, APK da haqiqiy expo-notifications.
// metro.config.js da resolver.extraNodeModules orqali almashtiriladi.
import * as N from 'expo-notifications';

// ─── Foreground handler ───────────────────────────────────────────────────────
export function setupForegroundNotificationHandler() {
  if (isExpoGo) return;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (_) {}
}

// ─── Android kanal sozlash ────────────────────────────────────────────────────
export async function setupNotificationChannels() {
  if (isExpoGo || Platform.OS !== 'android') return;
  try {
    await N.setNotificationChannelAsync('chat_messages', {
      name: '💬 Chat xabarlari',
      importance: N.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 150, 100, 150],
      lightColor: '#10b981',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
    });
    await N.setNotificationChannelAsync('default', {
      name: 'Bildirishnomalar',
      importance: N.AndroidImportance.HIGH,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
      enableVibrate: true,
      showBadge: true,
    });
  } catch (_) {}
}

// ─── Push token olish ─────────────────────────────────────────────────────────
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo) {
    console.log('[Push] Expo Go — push token olinmaydi');
    return null;
  }
  if (!Device.isDevice) {
    console.warn('[Push] Emulator — push token olinmaydi');
    return null;
  }
  try {
    await setupNotificationChannels();
    const { status: existingStatus } = await N.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await N.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('[Push] Ruxsat berilmadi');
      return null;
    }
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;
    const { data: token } = await N.getExpoPushTokenAsync(projectId ? { projectId } : {});
    console.log('[Push] ✅ Token olindi');
    return token ?? null;
  } catch (e: any) {
    console.warn('[Push] Token xatolik:', e?.message ?? e);
    return null;
  }
}

// ─── Backend ga saqlash ───────────────────────────────────────────────────────
export async function syncPushTokenToBackend(): Promise<void> {
  if (isExpoGo) return;
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await request('/users/push-token', {
        method: 'PUT',
        body: JSON.stringify({ token }),
      });
      console.log('[Push] ✅ Token backend da saqlandi');
    }
  } catch (e) {
    console.warn('[Push] Sync xatolik:', e);
  }
}

// ─── Listener larni qo'shish ──────────────────────────────────────────────────
export function addNotificationReceivedListener(cb: (n: any) => void): (() => void) | null {
  if (isExpoGo) return null;
  try {
    const sub = N.addNotificationReceivedListener(cb);
    return () => N.removeNotificationSubscription(sub);
  } catch {
    return null;
  }
}

export function addNotificationResponseListener(cb: (r: any) => void): (() => void) | null {
  if (isExpoGo) return null;
  try {
    const sub = N.addNotificationResponseReceivedListener(cb);
    return () => N.removeNotificationSubscription(sub);
  } catch {
    return null;
  }
}
