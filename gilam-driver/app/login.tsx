import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { login } from '../lib/api';
import { useAuth } from './_layout';

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
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.topSection}>
        <Text style={styles.brand}>GILAM</Text>
        <Text style={styles.appType}>Haydovchi</Text>
      </View>

      <View style={styles.formSection}>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Telefon Raqam</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+998"
            placeholderTextColor="#A0AEC0"
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>Parol</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••"
            placeholderTextColor="#A0AEC0"
            secureTextEntry
          />
        </View>

        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>TIZIMGA KIRISH</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Korporativ Kirish</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  topSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 48,
  },
  brand: {
    fontSize: 42,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -1,
  },
  appType: {
    fontSize: 16,
    fontWeight: '500',
    color: '#718096',
    letterSpacing: 2,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  formSection: {
    flex: 1.5,
  },
  inputContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4A5568',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    height: 56,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#1A202C',
    backgroundColor: '#F7FAFC',
  },
  button: {
    height: 56,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#CBD5E0',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
  footer: {
    paddingBottom: 40,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#A0AEC0',
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 1,
  }
});
