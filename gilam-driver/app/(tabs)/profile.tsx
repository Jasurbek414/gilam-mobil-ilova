import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { logout } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => { await logout(); setUser(null); };

  if (!user) return null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.fullName?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.roleLabel}>Gilam Haydovchisi</Text>
        </View>

        <View style={styles.metricBlock}>
           <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="call" size={18} color="#10b981" /></View>
              <View style={{flex: 1}}>
                 <Text style={styles.infoLabel}>Aloqa</Text>
                 <Text style={styles.infoValue}>{user.phone}</Text>
              </View>
           </View>

           <View style={styles.infoRow}>
              <View style={styles.iconBox}><Ionicons name="business" size={18} color="#10b981" /></View>
              <View style={{flex: 1}}>
                 <Text style={styles.infoLabel}>Kompaniya</Text>
                 <Text style={styles.infoValue}>{user.company?.name || user.companyId || '—'}</Text>
              </View>
           </View>

           <View style={[styles.infoRow, {borderBottomWidth: 0}]}>
              <View style={styles.iconBox}><Ionicons name="finger-print" size={18} color="#10b981" /></View>
              <View style={{flex: 1}}>
                 <Text style={styles.infoLabel}>ID Raqam</Text>
                 <Text style={styles.infoValue}>{user.id}</Text>
              </View>
           </View>
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={() => setShowLogout(true)} activeOpacity={0.8}>
           <Text style={styles.logoutText}>HISOBLAN CHIQISH</Text>
        </TouchableOpacity>

      </ScrollView>

      <Modal visible={showLogout} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Ionicons name="warning" size={32} color="#ef4444" style={styles.mIcon} />
            <Text style={styles.mTitle}>Ishonchingiz komilmi?</Text>
            <Text style={styles.mText}>Hisobingizdan chiqib ketsangiz buyurtmalar qabul qila olmaysiz.</Text>
            
            <View style={styles.mCmds}>
              <TouchableOpacity style={styles.mBtnCancel} onPress={() => setShowLogout(false)}>
                <Text style={styles.mBtnCancelText}>Bekor qilish</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.mBtnOut} onPress={handleLogout}>
                <Text style={styles.mBtnOutText}>Ha, chiqish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#09090b', paddingHorizontal: 24, paddingTop: 40, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: 40 },
  avatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#10b981', marginBottom: 16 },
  avatarText: { fontSize: 40, color: '#10b981', fontWeight: '900' },
  name: { fontSize: 24, fontWeight: '800', color: '#ffffff' },
  roleLabel: { fontSize: 13, color: '#a1a1aa', fontWeight: '600', marginTop: 4, letterSpacing: 1 },
  metricBlock: { backgroundColor: '#18181b', borderRadius: 24, paddingHorizontal: 20, borderWidth: 1, borderColor: '#27272a', marginBottom: 32 },
  infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 20, borderBottomWidth: 1, borderBottomColor: '#27272a' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center', marginRight: 16 },
  infoLabel: { fontSize: 12, color: '#71717a', fontWeight: '600', marginBottom: 4 },
  infoValue: { fontSize: 16, color: '#ffffff', fontWeight: '700' },
  logoutBtn: { backgroundColor: '#18181b', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#ef4444' },
  logoutText: { color: '#ef4444', fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 24 },
  modalCard: { backgroundColor: '#18181b', borderRadius: 24, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#27272a' },
  mIcon: { marginBottom: 16 },
  mTitle: { fontSize: 20, color: '#ffffff', fontWeight: '800', marginBottom: 8 },
  mText: { fontSize: 14, color: '#a1a1aa', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  mCmds: { flexDirection: 'row', width: '100%', gap: 12 },
  mBtnCancel: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center' },
  mBtnOut: { flex: 1, height: 50, borderRadius: 12, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },
  mBtnCancelText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  mBtnOutText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
});
