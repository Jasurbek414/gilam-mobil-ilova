import Constants from 'expo-constants';
import { Platform, Alert, Linking } from 'react-native';
import * as Device from 'expo-device';
import { request } from './api';

// ─── Expo Go Detection ────────────────────────────────────────────────────────
export const isExpoGo = Constants.appOwnership === 'expo';

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

// ─── Android notification channels ───────────────────────────────────────────
export async function setupNotificationChannels() {
  if (isExpoGo || Platform.OS !== 'android') return;
  try {
    await N.setNotificationChannelAsync('chat_messages', {
      name: '💬 Chat xabarlari',
      importance: N.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 150, 100, 150],
      lightColor: '#10b981',
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    });
    await N.setNotificationChannelAsync('default', {
      name: 'Bildirishnomalar',
      importance: N.AndroidImportance.MAX,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: N.AndroidNotificationVisibility.PUBLIC,
    });
    console.log('[Push] ✅ Notification channels yaratildi');
  } catch (e) {
    console.warn('[Push] Channel xatolik:', e);
  }
}

// ─── Ruxsat so'rash ───────────────────────────────────────────────────────────
export async function ensureNotificationPermission(): Promise<'granted' | 'denied' | 'skipped'> {
  if (isExpoGo || !Device.isDevice) return 'skipped';

  try {
    const { status } = await N.getPermissionsAsync();
    if (status === 'granted') return 'granted';

    if (status === 'undetermined') {
      const { status: newStatus } = await N.requestPermissionsAsync();
      if (newStatus === 'granted') return 'granted';
      await showGoToSettingsAlert();
      return 'denied';
    }

    await showGoToSettingsAlert();
    return 'denied';
  } catch (e) {
    console.warn('[Push] Permission error:', e);
    return 'denied';
  }
}

async function showGoToSettingsAlert() {
  return new Promise<void>((resolve) => {
    Alert.alert(
      '🔔 Bildirishnomalar o\'chirilgan',
      'Operator xabarlarini va buyurtma yangilanishlarini olish uchun bildirishnomalar yoqilgan bo\'lishi kerak.',
      [
        { text: 'Keyinroq', style: 'cancel', onPress: resolve },
        {
          text: '⚙️ Sozlamalarni ochish',
          onPress: async () => {
            try {
              if (Platform.OS === 'android') {
                await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
                  { key: 'android.provider.extra.APP_PACKAGE', value: 'uz.ecos.gilam.driver' },
                ]);
              } else {
                await Linking.openURL('app-settings:');
              }
            } catch {
              await Linking.openSettings();
            }
            resolve();
          },
        },
      ],
    );
  });
}

// ─── FCM Token olish (to'g'ridan-to'g'ri Firebase, Expo account kerak emas) ──
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo) {
    console.log('[Push] Expo Go — token olinmaydi');
    return null;
  }
  if (!Device.isDevice) {
    console.warn('[Push] Emulator — skip');
    return null;
  }

  try {
    await setupNotificationChannels();

    const permResult = await ensureNotificationPermission();
    if (permResult !== 'granted') {
      console.log('[Push] Ruxsat berilmadi:', permResult);
      return null;
    }

    // ✅ FCM token — to'g'ridan-to'g'ri Firebase, EAS kerak emas
    const pushToken = await N.getDevicePushTokenAsync();
    const token = pushToken?.data as string;
    
    if (!token) {
      console.warn('[Push] FCM token bo\'sh');
      return null;
    }
    
    console.log('[Push] ✅ FCM token olindi:', token.substring(0, 20) + '...');
    return token;
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
        body: JSON.stringify({ token, type: 'fcm' }),
      });
      console.log('[Push] ✅ FCM token backendga saqlandi');
    }
  } catch (e) {
    console.warn('[Push] Sync xatolik:', e);
  }
}

// ─── Listeners ───────────────────────────────────────────────────────────────
export function addNotificationReceivedListener(
  cb: (n: any) => void
): (() => void) | null {
  if (isExpoGo) return null;
  try {
    const sub = N.addNotificationReceivedListener(cb);
    return () => N.removeNotificationSubscription(sub);
  } catch { return null; }
}

export function addNotificationResponseListener(
  cb: (r: any) => void
): (() => void) | null {
  if (isExpoGo) return null;
  try {
    const sub = N.addNotificationResponseReceivedListener(cb);
    return () => N.removeNotificationSubscription(sub);
  } catch { return null; }
}
