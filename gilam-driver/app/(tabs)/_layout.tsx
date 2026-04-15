import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useAuth } from './../_layout';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabLayout() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const isFacility = user?.appRole === 'FACILITY';

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerRight: () =>
          isFacility ? null : (
            <TouchableOpacity
              onPress={() => router.push('/chat')}
              style={s.chatBtn}
              activeOpacity={0.75}
            >
              <Ionicons name="chatbubble-ellipses" size={19} color="#10b981" />
            </TouchableOpacity>
          ),
        headerStyle: {
          backgroundColor: '#0c0c0f',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#1a1a1e',
        } as any,
        headerTintColor: '#ffffff',
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 18,
          letterSpacing: -0.4,
          color: '#ffffff',
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
          marginBottom: 4,
          letterSpacing: 0.2,
        },
        tabBarActiveTintColor: '#10b981',
        tabBarInactiveTintColor: '#3f3f46',
        tabBarStyle: {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#0c0c0f',
          borderTopWidth: 1,
          borderTopColor: '#1a1a1e',
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          headerTitle: isFacility ? 'Sex Ishlari' : 'Buyurtmalar',
          tabBarLabel: isFacility ? 'Sex' : 'Buyurtmalar',
          tabBarIcon: ({ focused }) => (
            <View style={[s.iconWrap, focused && s.iconWrapActive]}>
              <Ionicons
                name={focused
                  ? (isFacility ? 'water' : 'layers')
                  : (isFacility ? 'water-outline' : 'layers-outline')}
                size={21}
                color={focused ? '#10b981' : '#3f3f46'}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          headerTitle: isFacility ? 'Sex Tarixi' : 'Tarix',
          tabBarLabel: 'Tarix',
          tabBarIcon: ({ focused }) => (
            <View style={[s.iconWrap, focused && s.iconWrapActive]}>
              <Ionicons
                name={focused ? 'time' : 'time-outline'}
                size={21}
                color={focused ? '#10b981' : '#3f3f46'}
              />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          headerTitle: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ focused }) => (
            <View style={[s.iconWrap, focused && s.iconWrapActive]}>
              <Ionicons
                name={focused ? 'person-circle' : 'person-circle-outline'}
                size={22}
                color={focused ? '#10b981' : '#3f3f46'}
              />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const s = StyleSheet.create({
  chatBtn: {
    marginRight: 16,
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  iconWrap: {
    width: 36,
    height: 28,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
});
