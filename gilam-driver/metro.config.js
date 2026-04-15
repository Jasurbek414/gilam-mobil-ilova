// metro.config.js
// Expo Go da expo-notifications crash bo'lishining oldini olish uchun
// Expo Go muhitida bu modul bo'sh stub bilan almashtiriladi.

const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Expo Go aniqlash: EXPO_PUBLIC_* env yoki process.env dan
const isExpoGo = process.env.EXPO_PUBLIC_IS_EXPO_GO === 'true'
  || process.env.APP_OWNERSHIP === 'expo';

if (isExpoGo) {
  console.log('[Metro] Expo Go — expo-notifications stub bilan almashtirildi');
  config.resolver = config.resolver || {};
  config.resolver.extraNodeModules = {
    ...config.resolver.extraNodeModules,
    'expo-notifications': path.resolve(__dirname, 'lib/expo-notifications-stub.js'),
  };
}

module.exports = config;
