import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { request } from './api';

// expo-notifications ni xavfsiz yuklash
let Notifications: any = null;
try {
  Notifications = require('expo-notifications');
} catch (_) {}

const isExpoGo = Constants.appOwnership === 'expo';

/**
 * Android: "heads-up" chat channel — SMS kabi ekran tepasidan tushadi.
 * Bu funksiya _layout.tsx da ham chaqiriladi, shu sababli idempotent.
 */
export async function setupNotificationChannels() {
  if (Platform.OS !== 'android' || !Notifications) return;

  await Notifications.setNotificationChannelAsync('chat_messages', {
    name: '💬 Chat xabarlari',
    description: 'Operator va haydovchilar orasidagi chat xabarlari',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 150, 100, 150],
    lightColor: '#10b981',
    enableLights: true,
    enableVibrate: true,
    showBadge: true,
    // PUBLIC — qulflangan ekranda ham ko'rinsin
    lockscreenVisibility: Notifications.AndroidNotificationVisibility?.PUBLIC ?? 1,
  });

  await Notifications.setNotificationChannelAsync('default', {
    name: 'Bildirishnomalar',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#10b981',
    enableVibrate: true,
    showBadge: true,
  });
}

/**
 * Push notification uchun ruxsat so'radi va Expo push token qaytaradi.
 * - Emulator da ishlasa null qaytaradi
 * - Expo Go da ishlasa null qaytaradi
 * - Ruxsat berilmasa null qaytaradi
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (isExpoGo || !Notifications) {
    console.log('[Push] Expo Go yoki modul topilmadi. Token olinmaydi.');
    return null;
  }

  if (!Device.isDevice) {
    console.warn('[Push] Push xabarnomalar faqat haqiqiy telefonda ishlaydi.');
    return null;
  }

  // Android channel sozlash
  await setupNotificationChannels();

  // Ruxsat holati
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    // Foydalanuvchidan ruxsat SO'RAYMIZ
    const { status } = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowBadge: true,
        allowSound: true,
        allowDisplayInCarPlay: false,
        allowCriticalAlerts: false,
        provideAppNotificationSettings: false,
        allowProvisional: false,
        allowAnnouncements: false,
      },
    });
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('[Push] Foydalanuvchi bildirishnomalar uchun ruxsat bermadi!');
    return null;
  }

  try {
    const projectId =
      Constants?.expoConfig?.extra?.eas?.projectId ??
      Constants?.easConfig?.projectId;

    const tokenResult = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : {}
    );
    const token = tokenResult.data;
    console.log('[Push] ✅ Token olindi:', token?.substring(0, 30) + '...');
    return token;
  } catch (e: any) {
    console.warn('[Push] Token olishda xatolik:', e.message);
    return null;
  }
}

/**
 * Expo push tokenni backendga saqlaydi.
 * `_layout.tsx` da login bo'lgandan keyin chaqiriladi.
 */
export async function syncPushTokenToBackend(): Promise<void> {
  try {
    const token = await registerForPushNotificationsAsync();
    if (token) {
      await request('/users/push-token', {
        method: 'PUT',
        body: JSON.stringify({ token }),
      });
      console.log('[Push] ✅ Token backendga saqlandi!');
    }
  } catch (e) {
    console.warn('[Push] Token sync xatolik:', e);
  }
}
