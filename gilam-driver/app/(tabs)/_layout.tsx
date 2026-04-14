import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity } from 'react-native';
import { useAuth } from './../_layout';

export default function TabLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const isFacility = user?.appRole === 'FACILITY';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () => isFacility ? null : (
          <TouchableOpacity onPress={() => router.push('/chat')} style={{ marginRight: 20 }}>
             <Ionicons name="chatbubbles" size={24} color="#10b981" />
          </TouchableOpacity>
        ),
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
          headerTitle: isFacility ? 'Sexdagi Barcha Ishlar' : 'Aktiv Buyurtmalar',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? (isFacility ? 'water' : 'rocket') : (isFacility ? 'water-outline' : 'rocket-outline')} size={size + 4} color={focused ? '#10b981' : '#52525b'} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerTitle: isFacility ? "Sex Tarixi Bajarilgan" : 'Tarix Arxivi',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'file-tray-full' : 'file-tray-full-outline'} size={size + 4} color={focused ? '#10b981' : '#52525b'} />
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
