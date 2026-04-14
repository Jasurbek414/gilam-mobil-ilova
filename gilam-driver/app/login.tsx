import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
  ActivityIndicator, ScrollView, Modal
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { login, getCompanies } from '../lib/api';
import { useAuth } from './_layout';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

export default function LoginScreen() {
  const router = useRouter();
  const { setUser } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [companies, setCompanies] = useState<{id: string, name: string}[]>([]);
  const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
  const [loadingCompanies, setLoadingCompanies] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [appRole, setAppRole] = useState('DRIVER');
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    setLoadingCompanies(true);
    try {
      const data = await getCompanies();
      if (!data || !Array.isArray(data)) {
        throw new Error("Ma'lumotlar formati noto'g'ri");
      }
      setCompanies(data);
    } catch (err: any) {
      console.warn("Could not fetch companies", err.message);
      Alert.alert("Xatolik", "Kompaniyalar ro'yxati yuklanmadi. Qayta urinib ko'ring.\n\n" + (err.message || 'Server xatosi'));
    } finally {
      setLoadingCompanies(false);
    }
  };

  const handleLogin = async () => {
    if (!companyName.trim() || !phone.trim() || !password.trim()) {
      Alert.alert('Ogohlantirish', "Ma'lumotlarni to'liq kiriting, shu jumladan kampaniya nomini ham");
      return;
    }
    setLoading(true);
    try {
      const user = await login(phone.trim(), password.trim(), companyName.trim());
      // Override or append the explicit appRole from Login
      const customizedUser = { ...user, appRole };
      setUser(customizedUser);
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
             <TouchableOpacity 
                style={[styles.inputContainer, { paddingHorizontal: 16 }]} 
                activeOpacity={0.7} 
                onPress={() => {
                  if (companies.length === 0) fetchCompanies(); 
                  setIsCompanyModalOpen(true);
                }}
             >
                <Ionicons name="business" size={20} color="#71717a" style={styles.inputIcon} />
                <Text style={[styles.input, { color: companyName ? '#ffffff' : '#52525b', paddingTop: 2 }]}>
                  {companyName ? companyName : "Kampaniya nomini tanlang"}
                </Text>
                {loadingCompanies ? <ActivityIndicator size="small" color="#10b981" /> : <Ionicons name="chevron-down" size={20} color="#71717a" />}
             </TouchableOpacity>

             <TouchableOpacity 
                style={[styles.inputContainer, { paddingHorizontal: 16 }]} 
                activeOpacity={0.7} 
                onPress={() => setIsRoleModalOpen(true)}
             >
                <Ionicons name="people" size={20} color="#71717a" style={styles.inputIcon} />
                <Text style={[styles.input, { color: '#ffffff', paddingTop: 2 }]}>
                  {appRole === 'DRIVER' ? "Haydovchi (Yetkazib berish)" : "Sex xodimi (Yuvish/Quritish/Qadoq)"}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#71717a" />
             </TouchableOpacity>

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

      {/* Company Selector Modal */}
      <Modal visible={isCompanyModalOpen} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Kampaniyani tanlang</Text>
                  <TouchableOpacity onPress={() => setIsCompanyModalOpen(false)} style={styles.closeBtn}>
                     <Ionicons name="close" size={24} color="#ffffff" />
                  </TouchableOpacity>
               </View>

               <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {loadingCompanies ? (
                    <ActivityIndicator size="large" color="#10b981" style={{marginTop: 40}} />
                  ) : companies.length === 0 ? (
                    <Text style={{color: '#a1a1aa', textAlign: 'center', marginTop: 40}}>Kampaniyalar topilmadi.</Text>
                  ) : null}
                  {companies.map(c => (
                    <TouchableOpacity 
                      key={c.id} 
                      style={styles.companyOption}
                      onPress={() => {
                        setCompanyName(c.name);
                        setIsCompanyModalOpen(false);
                      }}
                    >
                       <Ionicons name="business-outline" size={20} color="#10b981" style={{marginRight: 12}} />
                       <Text style={styles.companyOptionText}>{c.name}</Text>
                    </TouchableOpacity>
                  ))}
               </ScrollView>
            </View>
         </View>
      </Modal>

      {/* Role Selector Modal */}
      <Modal visible={isRoleModalOpen} transparent animationType="slide">
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Qaysi vazifada ishlaysiz?</Text>
                  <TouchableOpacity onPress={() => setIsRoleModalOpen(false)} style={styles.closeBtn}>
                     <Ionicons name="close" size={24} color="#ffffff" />
                  </TouchableOpacity>
               </View>
               <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                   <TouchableOpacity 
                     style={styles.companyOption}
                     onPress={() => {
                        setAppRole('DRIVER');
                        setIsRoleModalOpen(false);
                     }}
                   >
                      <Ionicons name="car-outline" size={20} color="#10b981" style={{marginRight: 12}} />
                      <Text style={styles.companyOptionText}>Haydovchi (Yetkazish)</Text>
                   </TouchableOpacity>
                   <TouchableOpacity 
                     style={styles.companyOption}
                     onPress={() => {
                        setAppRole('FACILITY');
                        setIsRoleModalOpen(false);
                     }}
                   >
                      <Ionicons name="water-outline" size={20} color="#10b981" style={{marginRight: 12}} />
                      <Text style={styles.companyOptionText}>Sex Xodimi (Yuvish/Quritish)</Text>
                   </TouchableOpacity>
               </ScrollView>
            </View>
         </View>
      </Modal>

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

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#18181b', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '60%', padding: 24, borderWidth: 1, borderColor: '#27272a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#27272a', paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center' },
  modalScroll: { flex: 1 },
  companyOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  companyOptionText: { color: '#ffffff', fontSize: 16, fontWeight: '700' }
});
