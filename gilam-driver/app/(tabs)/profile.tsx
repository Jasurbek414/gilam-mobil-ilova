import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Modal } from 'react-native';
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
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.fullName?.[0]?.toUpperCase() || '👤'}</Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.phone}>{user.phone}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>HAYDOVCHI</Text>
          </View>
        </View>
      </View>

      <View style={styles.infoList}>
        <View style={styles.infoRow}>
          <MaterialIcons name="phone" size={24} color="#059669" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>TELEFON</Text>
            <Text style={styles.infoValue}>{user.phone}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name="business" size={24} color="#059669" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>KOMPANIYA</Text>
            <Text style={styles.infoValue}>{user.company?.name || user.companyId || '—'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <MaterialIcons name="badge" size={24} color="#059669" />
          <View style={styles.infoContent}>
            <Text style={styles.infoLabel}>ID</Text>
            <Text style={styles.infoValueSmall}>{user.id}</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutBtn}
        onPress={() => setShowLogout(true)}
        activeOpacity={0.8}
      >
        <MaterialIcons name="logout" size={20} color="#ef4444" />
        <Text style={styles.logoutText}>TIZIMDAN CHIQISH</Text>
      </TouchableOpacity>

      <View style={styles.fwInfo}>
        <Text style={styles.fwTitle}>Gilam SaaS • Haydovchi</Text>
        <Text style={styles.fwVers}>Versiya 1.0.0</Text>
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
                <Text style={styles.modalBtnTextCancel}>YO'Q</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnConfirm]}
                onPress={handleLogout}
              >
                <Text style={styles.modalBtnTextConfirm}>HA, CHIQISH</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc', padding: 16 },
  headerCard: {
    backgroundColor: '#059669', borderRadius: 24, padding: 24,
    flexDirection: 'row', alignItems: 'center', marginBottom: 24,
    shadowColor: '#059669', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center', marginRight: 16,
  },
  avatarText: { fontSize: 32, color: '#fff', fontWeight: '900' },
  headerInfo: { flex: 1 },
  name: { fontSize: 20, fontWeight: '900', color: '#fff', marginBottom: 4 },
  phone: { fontSize: 14, color: '#a7f3d0', fontWeight: '600', marginBottom: 8 },
  roleBadge: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, alignSelf: 'flex-start' },
  roleText: { fontSize: 10, fontWeight: '900', color: '#fff', letterSpacing: 1 },
  infoList: { backgroundColor: '#fff', borderRadius: 20, padding: 8, marginBottom: 24, borderWidth: 1, borderColor: '#f1f5f9' },
  infoRow: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  infoContent: { marginLeft: 16, flex: 1 },
  infoLabel: { fontSize: 10, fontWeight: '800', color: '#94a3b8', letterSpacing: 1, marginBottom: 4 },
  infoValue: { fontSize: 15, fontWeight: '700', color: '#1e293b' },
  infoValueSmall: { fontSize: 12, color: '#64748b', fontFamily: 'monospace' },
  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fef2f2', borderRadius: 16, padding: 16,
    borderWidth: 2, borderColor: '#fee2e2',
  },
  logoutText: { color: '#ef4444', fontSize: 14, fontWeight: '900', letterSpacing: 1, marginLeft: 8 },
  fwInfo: { alignItems: 'center', marginTop: 32 },
  fwTitle: { fontSize: 12, fontWeight: '800', color: '#94a3b8', letterSpacing: 1 },
  fwVers: { fontSize: 11, color: '#cbd5e1', marginTop: 4 },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#1e293b', textAlign: 'center', marginBottom: 8 },
  modalText: { fontSize: 14, color: '#64748b', textAlign: 'center', marginBottom: 24 },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalBtn: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center' },
  modalBtnCancel: { backgroundColor: '#f1f5f9' },
  modalBtnConfirm: { backgroundColor: '#ef4444', shadowColor: '#ef4444', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  modalBtnTextCancel: { color: '#64748b', fontSize: 14, fontWeight: '800', letterSpacing: 1 },
  modalBtnTextConfirm: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});
