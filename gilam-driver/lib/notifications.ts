import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { request } from './api';

const isExpoGo = Constants.appOwnership === 'expo';
let Notifications: any = null;

if (!isExpoGo) {
  try {
     Notifications = require('expo-notifications');
     Notifications.setNotificationHandler({
       handleNotification: async () => ({
         shouldShowAlert: true,
         shouldPlaySound: true,
         shouldSetBadge: true,
       } as any),
     });
  } catch (e) {}
}

/**
 * Registers the device for push notifications and returns the Expo push token
 */
export async function registerForPushNotificationsAsync() {
  let token;

  if (isExpoGo || !Notifications) {
      console.log('[Push] Expo Go muhiti aniqlandi yoki modul topilmadi. Push token olinmaydi.');
      return null;
  }

  if (Platform.OS === 'android') {
    Notifications.setNotificationChannelAsync('default', {
      name: 'Umumiy bildirishnomalar',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#10b981',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.warn('Xabarnomalar uchun ruxsat berilmadi!');
      return null;
    }
    try {
      const projectId =
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId ?? 'gilam-driver-test';
        
      token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    } catch (e) {
      console.log('[Push] Push token error info:', (e as Error).message);
    }
  } else {
    console.warn('Push xabarnomalar faqat haqiqiy qurilmalarda ishlaydi');
  }

  return token;
}

/**
 * Syncs the expo push token with the backend
 */
export async function syncPushTokenToBackend() {
   try {
      const token = await registerForPushNotificationsAsync();
      if (token) {
         await request('/users/push-token', {
            method: 'PUT',
            body: JSON.stringify({ token })
         });
         console.log('✅ Push tokkenni backendga muvaffaqiyatli uladik!');
      }
   } catch(e) {
      console.warn('Push token sync success fail:', e);
   }
}
