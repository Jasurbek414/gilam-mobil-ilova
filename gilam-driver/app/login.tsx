import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, Dimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../lib/api';
import { useAuth } from './_layout';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!phone.trim() || !password.trim()) {
      Alert.alert('Xatolik', "Barcha maydonlarni to'ldiring.");
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
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
        
        {/* Brand Header */}
        <View style={styles.header}>
          <View style={styles.iconCircle}>
             <MaterialIcons name="local-shipping" size={32} color="#10b981" />
          </View>
          <Text style={styles.title}>Gilam App</Text>
          <Text style={styles.subtitle}>Logistika va yetkazib berish xizmati qismi</Text>
        </View>

        {/* Input Form */}
        <View style={styles.form}>
          <View style={styles.inputWrapper}>
             <View style={styles.inputPrefix}>
               <MaterialIcons name="phone" size={20} color="#64748b" />
             </View>
             <TextInput
               style={styles.input}
               value={phone}
               onChangeText={setPhone}
               placeholder="Telefon raqamingiz"
               placeholderTextColor="#94a3b8"
               keyboardType="phone-pad"
               autoCapitalize="none"
               cursorColor="#10b981"
             />
          </View>

          <View style={styles.inputWrapper}>
             <View style={styles.inputPrefix}>
               <MaterialIcons name="lock" size={20} color="#64748b" />
             </View>
             <TextInput
               style={styles.input}
               value={password}
               onChangeText={setPassword}
               placeholder="Parolingiz"
               placeholderTextColor="#94a3b8"
               secureTextEntry
               cursorColor="#10b981"
             />
          </View>

          <TouchableOpacity style={styles.forgotBtn} activeOpacity={0.6}>
            <Text style={styles.forgotText}>Parolni tiklash</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]} 
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Tizimga kirish</Text>
            )}
          </TouchableOpacity>
        </View>

      </View>

      <Text style={styles.secureBadge}>
        <MaterialIcons name="verified-user" size={12} color="#10b981" /> Himoyalangan ulanish
      </Text>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 6,
    textAlign: 'center',
    fontWeight: '500',
  },
  form: {
    width: '100%',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    height: 60,
    overflow: 'hidden',
  },
  inputPrefix: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderRightWidth: 1,
    borderRightColor: '#f1f5f9',
    height: '100%',
  },
  input: {
    flex: 1,
    height: '100%',
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  forgotBtn: {
    alignSelf: 'flex-end',
    marginBottom: 32,
  },
  forgotText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '700',
  },
  loginBtn: {
    width: '100%',
    height: 60,
    backgroundColor: '#10b981',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  loginBtnDisabled: {
    backgroundColor: '#94a3b8',
    shadowOpacity: 0,
  },
  loginBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  secureBadge: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    alignItems: 'center',
  }
});
