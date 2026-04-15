// lib/expo-notifications-stub.js
// Expo Go da expo-notifications o'rniga ishlatiladigan bo'sh stub.
// Barcha export lar no-op funktsiyalar yoki null qaytaradi.

module.exports = {
  setNotificationHandler: () => {},
  getPermissionsAsync: async () => ({ status: 'undetermined' }),
  requestPermissionsAsync: async () => ({ status: 'denied' }),
  getExpoPushTokenAsync: async () => ({ data: null }),
  scheduleNotificationAsync: async () => null,
  cancelAllScheduledNotificationsAsync: async () => {},
  dismissAllNotificationsAsync: async () => {},
  addNotificationReceivedListener: () => ({ remove: () => {} }),
  addNotificationResponseReceivedListener: () => ({ remove: () => {} }),
  removeNotificationSubscription: () => {},
  setNotificationChannelAsync: async () => {},
  getNotificationChannelsAsync: async () => [],
  AndroidImportance: { HIGH: 4, MAX: 5, DEFAULT: 3, LOW: 2, MIN: 1, NONE: 0 },
  AndroidNotificationVisibility: { PUBLIC: 1, PRIVATE: 0, SECRET: -1 },
};
