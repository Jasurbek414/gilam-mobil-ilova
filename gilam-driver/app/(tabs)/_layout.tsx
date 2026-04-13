import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#09090b',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#18181b',
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '800', fontSize: 18, letterSpacing: -0.5 },
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#09090b',
          borderTopWidth: 1,
          borderTopColor: '#27272a',
          minHeight: 70,
          elevation: 0,
          paddingTop: 12,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: 'Aktiv Buyurtmalar',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'rocket' : 'rocket-outline'} size={size + 4} color={focused ? '#10b981' : '#52525b'} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerTitle: 'Tarix Arxivi',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={size + 4} color={focused ? '#10b981' : '#52525b'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: 'Profil Sozlamalari',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size + 4} color={focused ? '#10b981' : '#52525b'} />
          ),
        }}
      />
    </Tabs>
  );
}
