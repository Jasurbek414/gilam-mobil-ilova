import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, TouchableOpacity, Text } from 'react-native';
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
          <TouchableOpacity onPress={() => router.push('/chat')} style={{ marginRight: 20, width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}>
             <Ionicons name="chatbubble-ellipses" size={18} color="#10b981" />
          </TouchableOpacity>
        ),
        headerStyle: {
          backgroundColor: '#09090b',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 0,
        },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '800', fontSize: 18, letterSpacing: -0.5 },
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: -2, marginBottom: 6 },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#52525b',
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#09090b',
          borderTopWidth: 1,
          borderTopColor: '#18181b',
          minHeight: 70,
          elevation: 0,
          paddingTop: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: isFacility ? 'Sexdagi Barcha Ishlar' : 'Aktiv Buyurtmalar',
          tabBarLabel: isFacility ? 'Sex' : 'Buyurtmalar',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? (isFacility ? 'water' : 'rocket') : (isFacility ? 'water-outline' : 'rocket-outline')} size={22} color={focused ? '#10b981' : '#52525b'} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerTitle: isFacility ? "Sex Tarixi" : 'Tarix',
          tabBarLabel: 'Tarix',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={focused ? '#10b981' : '#52525b'} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ size, focused }) => (
            <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={22} color={focused ? '#10b981' : '#52525b'} />
          ),
        }}
      />
    </Tabs>
  );
}
