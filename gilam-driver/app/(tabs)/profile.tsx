import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { logout } from '../../lib/api';

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
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.fullName?.[0]?.toUpperCase() || 'U'}</Text>
        </View>
        <Text style={styles.name}>{user.fullName}</Text>
        <Text style={styles.roleText}>HAYDOVCHI</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Telefon</Text>
          <Text style={styles.value}>{user.phone}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Kompaniya</Text>
          <Text style={styles.value}>{user.company?.name || user.companyId || '—'}</Text>
        </View>
        <View style={[styles.row, { borderBottomWidth: 0 }]}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.valueSmall}>{user.id}</Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => setShowLogout(true)}
        activeOpacity={0.8}
      >
        <Text style={styles.logoutText}>TIZIMDAN CHIQISH</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>Gilam SDK • v1.0.0</Text>
      </View>

      {/* Logout Modal */}
      <Modal visible={showLogout} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Tizimdan chiqish</Text>
            <Text style={styles.modalText}>Haqiqatan ham chiqmoqchimisiz?</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnCancel]}
                onPress={() => setShowLogout(false)}
              >
                <Text style={styles.modalBtnTextCancel}>BEKOR QILISH</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleLogout}
              >
                <Text style={styles.modalBtnTextConfirm}>CHIQISH</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40, paddingTop: 24 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#F7FAFC',
    borderWidth: 1, borderColor: '#E2E8F0',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  avatarText: { fontSize: 32, color: '#000000', fontWeight: '800' },
  name: { fontSize: 24, fontWeight: '900', color: '#000000', letterSpacing: -0.5, marginBottom: 4 },
  roleText: { fontSize: 11, fontWeight: '700', color: '#A0AEC0', letterSpacing: 2 },
  section: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
    marginBottom: 32,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#F7FAFC',
  },
  label: { fontSize: 12, fontWeight: '600', color: '#718096', textTransform: 'uppercase', letterSpacing: 0.5 },
  value: { fontSize: 14, fontWeight: '600', color: '#1A202C' },
  valueSmall: { fontSize: 12, color: '#A0AEC0', fontFamily: 'monospace' },
  logoutBtn: {
    padding: 16, borderRadius: 8, borderWidth: 1, borderColor: '#E53E3E',
    alignItems: 'center',
  },
  logoutText: { color: '#E53E3E', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  footer: { alignItems: 'center', marginTop: 40 },
  footerText: { fontSize: 11, color: '#CBD5E0', fontWeight: '500', letterSpacing: 1 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  modalContent: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#000000', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#4A5568', marginBottom: 32 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 14, borderRadius: 8, alignItems: 'center', borderWidth: 1 },
  modalBtnCancel: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0' },
  modalBtnConfirm: { backgroundColor: '#000000', borderColor: '#000000' },
  modalBtnTextCancel: { color: '#4A5568', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  modalBtnTextConfirm: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', letterSpacing: 1 },
});
