import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  Animated, Easing, Keyboard, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../lib/api';
import { useAuth } from './_layout';
import { MaterialIcons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

// Custom Input Component with Animations
const CustomInput = ({ 
  icon, label, value, onChangeText, secureTextEntry = false, keyboardType = "default" 
}: any) => {
  const [isFocused, setIsFocused] = useState(false);
  const animatedFocus = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedFocus, {
      toValue: isFocused || value ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [isFocused, value]);

  const borderColor = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.1)', '#10b981']
  });

  const labelTop = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [18, -10]
  });

  const labelFontSize = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [15, 12]
  });

  const labelColor = animatedFocus.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.5)', '#34d399']
  });

  return (
    <View style={styles.inputContainer}>
      <Animated.View style={[styles.inputWrapper, { borderColor }]}>
        <MaterialIcons name={icon} size={22} color={isFocused ? '#34d399' : 'rgba(255,255,255,0.5)'} style={styles.icon} />
        
        <View style={{ flex: 1, position: 'relative', justifyContent: 'center' }}>
          <Animated.Text style={[styles.floatingLabel, { top: labelTop, fontSize: labelFontSize, color: labelColor }]}>
            {label}
          </Animated.Text>
          
          <TextInput
            style={styles.inputField}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            secureTextEntry={secureTextEntry}
            keyboardType={keyboardType}
            autoCapitalize="none"
            cursorColor="#10b981"
          />
        </View>
      </Animated.View>
    </View>
  );
};

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const btnScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, []);

  const onPressIn = () => {
    Animated.spring(btnScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const onPressOut = () => {
    Animated.spring(btnScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handleLogin = async () => {
    Keyboard.dismiss();
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Xatolik', "Telefon va parolni kiritish majburiy");
      return;
    }
    setLoading(true);
    try {
      const user = await login(phone.trim(), password.trim());
      setUser(user);
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Xatolik', err.message || 'Kirishda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.backgroundContainer}>
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </View>

      <Animated.View style={[styles.inner, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        
        {/* Header Section */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="local-shipping" size={42} color="#10b981" />
          </View>
          <Text style={styles.title}>Xush Kelibsiz</Text>
          <Text style={styles.subtitle}>GILAM SAAS <Text style={{color: '#10b981'}}>HAYDOVCHI</Text></Text>
        </View>

        {/* Form Section */}
        <View style={styles.glassCard}>
          <CustomInput 
            icon="phone-android" 
            label="Telefon raqam" 
            value={phone} 
            onChangeText={setPhone} 
            keyboardType="phone-pad" 
          />
          <CustomInput 
            icon="lock-outline" 
            label="Parol" 
            value={password} 
            onChangeText={setPassword} 
            secureTextEntry 
          />

          <Text style={styles.forgotPass}>Parolni unutdingizmi?</Text>

          <Animated.View style={{ transform: [{ scale: btnScale }], width: '100%', marginTop: 10 }}>
            <TouchableOpacity
              activeOpacity={0.9}
              onPressIn={onPressIn}
              onPressOut={onPressOut}
              onPress={handleLogin}
              disabled={loading}
              style={{ width: '100%' }}
            >
              <View style={[styles.loginBtn, loading && { opacity: 0.7 }]}>
                {loading ? (
                   <Text style={styles.loginBtnText}>YUKLANMOQDA...</Text>
                ) : (
                  <>
                    <Text style={styles.loginBtnText}>TIZIMGA KIRISH</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#fff" style={{marginLeft: 8}}/>
                  </>
                )}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.footerText}>
          Tizim faqatgina tasdiqlangan kompaniya xodimlari uchun yopiq tartibda ishlaydi.
        </Text>

      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a', // Very dark slate
  },
  backgroundContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
  },
  glowTop: {
    position: 'absolute',
    top: -height * 0.2,
    right: -width * 0.3,
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    backgroundColor: 'rgba(16, 185, 129, 0.15)', // Emerald glow
  },
  glowBottom: {
    position: 'absolute',
    bottom: -height * 0.1,
    left: -width * 0.5,
    width: width * 1.2,
    height: width * 1.2,
    borderRadius: width,
    backgroundColor: 'rgba(56, 189, 248, 0.1)', // Sky glow
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 4,
    marginTop: 8,
  },
  glassCard: {
    width: '100%',
    backgroundColor: 'rgba(30, 41, 59, 0.7)',
    borderRadius: 32,
    padding: 24,
    paddingTop: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  inputContainer: {
    marginBottom: 20,
    height: 64,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    height: 64,
  },
  icon: {
    marginRight: 16,
  },
  floatingLabel: {
    position: 'absolute',
    left: 0,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  inputField: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    paddingTop: 16, // push text down to fit floating label
  },
  forgotPass: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 24,
  },
  loginBtn: {
    width: '100%',
    height: 60,
    backgroundColor: '#10b981',
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  loginBtnText: {
    color: '#064e3b',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  footerText: {
    position: 'absolute',
    bottom: 40,
    color: '#64748b',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 18,
    paddingHorizontal: 32,
  }
});
