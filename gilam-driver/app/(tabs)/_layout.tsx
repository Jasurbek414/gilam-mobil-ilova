import { Tabs } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { View } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: {
          backgroundColor: '#ffffff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f1f5f9',
        },
        headerTintColor: '#0f172a',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 17,
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarShowLabel: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 16,
          left: 24,
          right: 24,
          elevation: 10,
          shadowColor: '#10b981',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.15,
          shadowRadius: 20,
          backgroundColor: '#1e293b',
          borderRadius: 32,
          height: 64,
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingTop: 0,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: 'Buyurtmalar',
          tabBarIcon: ({ size, focused }) => (
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: focused ? '#10b981' : 'transparent',
              justifyContent: 'center', alignItems: 'center'
            }}>
              <MaterialIcons name="local-shipping" size={size} color={focused ? '#fff' : '#64748b'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerTitle: 'Tarix',
          tabBarIcon: ({ size, focused }) => (
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: focused ? '#10b981' : 'transparent',
              justifyContent: 'center', alignItems: 'center'
            }}>
              <MaterialIcons name="history" size={size} color={focused ? '#fff' : '#64748b'} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: 'Profil',
          tabBarIcon: ({ size, focused }) => (
            <View style={{
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: focused ? '#10b981' : 'transparent',
              justifyContent: 'center', alignItems: 'center'
            }}>
              <MaterialIcons name="person" size={size} color={focused ? '#fff' : '#64748b'} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
