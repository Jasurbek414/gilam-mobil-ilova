import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { request } from './api';

// Set up the foreground notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  } as any),
});

/**
 * Registers the device for push notifications and returns the Expo push token
 */
export async function registerForPushNotificationsAsync() {
  let token;

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
        Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
      if (!projectId) {
         // Fallback if not using EAS directly yet
         token = (await Notifications.getExpoPushTokenAsync()).data;
      } else {
         token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      }
    } catch (e) {
      console.error('Push token error:', e);
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
