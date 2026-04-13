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
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.05,
          shadowRadius: 20,
          backgroundColor: '#ffffff',
          borderTopColor: 'transparent',
          minHeight: 65,
          paddingTop: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: 'Aktiv Buyurtmalar',
          tabBarLabel: 'Buyurtmalar',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4, 
              borderRadius: 12, 
              backgroundColor: focused ? '#ecfdf5' : 'transparent'
            }}>
              <MaterialIcons name="local-shipping" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerTitle: 'Tarix',
          tabBarLabel: 'Tarix',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4, 
              borderRadius: 12, 
              backgroundColor: focused ? '#ecfdf5' : 'transparent'
            }}>
              <MaterialIcons name="history" size={size} color={color} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: 'Shaxsiy Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color, size, focused }) => (
            <View style={{
              padding: 4, 
              borderRadius: 12, 
              backgroundColor: focused ? '#ecfdf5' : 'transparent'
            }}>
              <MaterialIcons name="person" size={size} color={color} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}
