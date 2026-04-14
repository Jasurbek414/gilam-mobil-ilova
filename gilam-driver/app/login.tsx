import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login } from '../lib/api';
import { useAuth } from './_layout';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!companyName.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Ogohlantirish', "Ma'lumotlarni to'liq kiriting, shu jumladan kampaniya nomini ham");
      return;
    }
    setLoading(true);
    try {
      const user = await login(phone.trim(), password.trim(), companyName.trim());
      setUser(user);
      router.replace('/');
    } catch (err: any) {
      Alert.alert('Xatolik', err.message || 'Kirishda xatolik');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09090b' }}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          
          {/* Logo & Branding */}
          <View style={styles.header}>
            <View style={styles.logoBox}>
               <MaterialIcons name="alt-route" size={42} color="#10b981" />
            </View>
            <Text style={styles.title}>Gilam Driver</Text>
            <Text style={styles.subtitle}>Eksklyuziv hamkorlik platformasi</Text>
          </View>

          {/* Form */}
          <View style={styles.formBox}>
             <View style={styles.inputContainer}>
                <Ionicons name="business" size={20} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="Kampaniya nomi (misol: Ideal Gilam)"
                  placeholderTextColor="#52525b"
                  autoCapitalize="words"
                  cursorColor="#10b981"
                />
             </View>

             <View style={styles.inputContainer}>
                <Ionicons name="call" size={20} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Telefon raqamingiz"
                  placeholderTextColor="#52525b"
                  keyboardType="phone-pad"
                  autoCapitalize="none"
                  cursorColor="#10b981"
                />
             </View>

             <View style={styles.inputContainer}>
                <Ionicons name="lock-closed" size={20} color="#71717a" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Maxfiy parolingiz"
                  placeholderTextColor="#52525b"
                  secureTextEntry
                  cursorColor="#10b981"
                />
             </View>

             <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
                {loading ? <ActivityIndicator color="#09090b" /> : <Text style={styles.loginText}>TIZIMGA KIRISH</Text>}
             </TouchableOpacity>

             <Text style={styles.forgotPass}>Parolni unutdingizmi?</Text>
          </View>

        </ScrollView>

        {/* Bottom Secure Branding */}
        <View style={styles.footer}>
           <MaterialIcons name="shield" size={12} color="#10b981" />
           <Text style={styles.footerText}> Secure TLS Encryption</Text>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  header: { alignItems: 'flex-start', marginBottom: 48 },
  logoBox: { width: 72, height: 72, borderRadius: 20, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: '#27272a' },
  title: { fontSize: 32, fontWeight: '900', color: '#ffffff', letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: '#a1a1aa', fontWeight: '500', marginTop: 4, letterSpacing: 1 },
  formBox: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#18181b', borderRadius: 16, height: 64, marginBottom: 16, borderWidth: 1, borderColor: '#27272a', paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, color: '#ffffff', fontSize: 16, fontWeight: '600' },
  loginBtn: { height: 60, backgroundColor: '#10b981', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 12, shadowColor: '#10b981', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 },
  loginText: { color: '#09090b', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  forgotPass: { color: '#71717a', fontSize: 13, fontWeight: '600', textAlign: 'center', marginTop: 24 },
  footer: { position: 'absolute', bottom: 24, flexDirection: 'row', alignItems: 'center', width: '100%', justifyContent: 'center' },
  footerText: { color: '#52525b', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
});
