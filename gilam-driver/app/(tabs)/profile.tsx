import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { logout } from '../../lib/api';
import { MaterialIcons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);

  const handleLogout = async () => {
    await logout();
    setUser(null);
  };

  if (!user) return null;

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.fullName?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.roleText}>HAYDOVCHI</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <View style={styles.rowIcon}>
            <MaterialIcons name="phone" size={20} color="#64748b" />
          </View>
          <View style={styles.rowContent}>
             <Text style={styles.label}>Telefon</Text>
             <Text style={styles.value}>{user.phone}</Text>
          </View>
        </View>

        <View style={styles.row}>
           <View style={styles.rowIcon}>
            <MaterialIcons name="business" size={20} color="#64748b" />
          </View>
          <View style={styles.rowContent}>
             <Text style={styles.label}>Kompaniya</Text>
             <Text style={styles.value}>{user.company?.name || user.companyId || '—'}</Text>
          </View>
        </View>

        <View style={[styles.row, { borderBottomWidth: 0 }]}>
           <View style={styles.rowIcon}>
            <MaterialIcons name="badge" size={20} color="#64748b" />
          </View>
          <View style={styles.rowContent}>
             <Text style={styles.label}>ID Nomer</Text>
             <Text style={styles.valueSmall}>{user.id}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => setShowLogout(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>Tizimdan chiqish</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Gilam SDK • v1.0.0</Text>
      </View>

      {/* Modern Enhanced Modal */}
      <Modal visible={showLogout} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalWarningIcon}>
               <MaterialIcons name="logout" size={32} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>Chiqish</Text>
            <Text style={styles.modalText}>Haqiqatan ham o'z hisobingizdan chiqmoqchimisiz?</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowLogout(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnTextCancel}>Bekor qilish</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <Text style={styles.modalBtnTextConfirm}>Chiqish</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, backgroundColor: '#f8fafc', paddingHorizontal: 24, paddingTop: 32, paddingBottom: 120 },
  header: { alignItems: 'center', marginBottom: 40 },
  avatar: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: '#ffffff',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
    shadowColor: '#10b981', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 4,
  },
  avatarText: { fontSize: 36, color: '#10b981', fontWeight: '900' },
  name: { fontSize: 24, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
  roleText: { fontSize: 13, fontWeight: '700', color: '#94a3b8', letterSpacing: 1 },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 32,
    paddingHorizontal: 8,
    shadowColor: '#64748b', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 2,
  },
  row: {
    flexDirection: 'row', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f1f5f9',
  },
  rowIcon: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: '#f8fafc', justifyContent: 'center', alignItems: 'center', marginRight: 16
  },
  rowContent: { flex: 1 },
  label: { fontSize: 13, fontWeight: '600', color: '#64748b', marginBottom: 2 },
  value: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
  valueSmall: { fontSize: 13, color: '#94a3b8', fontFamily: 'monospace', fontWeight: '500' },
  logoutBtn: {
    padding: 18, borderRadius: 16, backgroundColor: '#fef2f2',
    alignItems: 'center', borderWidth: 1, borderColor: '#fee2e2'
  },
  logoutText: { color: '#ef4444', fontSize: 15, fontWeight: '700' },
  footer: { alignItems: 'center', marginTop: 40 },
  footerText: { fontSize: 12, color: '#cbd5e1', fontWeight: '600' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 32, padding: 32, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.1, shadowRadius: 30, elevation: 10 },
  modalWarningIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fef2f2', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  modalText: { fontSize: 15, color: '#64748b', marginBottom: 32, textAlign: 'center', lineHeight: 22 },
  modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
  modalBtn: { flex: 1, paddingVertical: 16, borderRadius: 16, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#f1f5f9' },
  modalBtnConfirm: { backgroundColor: '#ef4444' },
  modalBtnTextCancel: { color: '#475569', fontSize: 15, fontWeight: '700' },
  modalBtnTextConfirm: { color: '#ffffff', fontSize: 15, fontWeight: '700' },
});
