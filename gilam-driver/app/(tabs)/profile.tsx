import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, TextInput, Alert, ActivityIndicator, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { logout, createExpense, getDriverExpenses, deleteExpense } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, setUser } = useAuth();
  const router = useRouter();
  const [showLogout, setShowLogout] = useState(false);
  const [showExpense, setShowExpense] = useState(false);
  const [expenseData, setExpenseData] = useState({ title: '', amount: '', comment: '' });
  const [savingExpense, setSavingExpense] = useState(false);
  const [myExpenses, setMyExpenses] = useState<any[]>([]);
  const [loadingExp, setLoadingExp] = useState(true);

  const loadMyExpenses = useCallback(async () => {
    if (!user) return;
    try {
      setLoadingExp(true);
      const data = await getDriverExpenses(user.id);
      setMyExpenses(data || []);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoadingExp(false);
    }
  }, [user]);

  useEffect(() => {
    loadMyExpenses();
  }, [loadMyExpenses]);

  const handleLogout = async () => { await logout(); setUser(null); };

  const handleSaveExpense = async () => {
    if (!expenseData.title || !expenseData.amount) {
      Alert.alert('Xatolik', 'Xarajat nomi va summasini kiritish majburiy!');
      return;
    }
    
    setSavingExpense(true);
    try {
      await createExpense({
        companyId: user!.companyId,
        userId: user!.id,
        title: expenseData.title,
        amount: Number(expenseData.amount),
        category: 'Logistika', // Always logistics for drivers
        comment: `Haydovchi mobil ilovasidan qo'shildi. ${expenseData.comment}`,
        date: new Date().toISOString().split('T')[0]
      });
      setShowExpense(false);
      setExpenseData({ title: '', amount: '', comment: '' });
      Alert.alert('Bajarildi', 'Kiritilgan mablag xisobotga yozildi.');
      loadMyExpenses();
    } catch(err: any) {
      Alert.alert('Xatolik', err.message || 'Saqlab bo\'lmadi');
    } finally {
      setSavingExpense(false);
    }
  };

  const handleDeleteExpense = (id: string, title: string) => {
    Alert.alert('O\'chirish', `"${title}" xarajatini o'chirib tashlaysizmi?`, [
      { text: 'Bekor', style: 'cancel' },
      { text: 'O\'chirish', style: 'destructive', onPress: async () => {
          try {
            await deleteExpense(id);
            loadMyExpenses();
            Alert.alert('O\'chirildi', '', [{text: 'OK'}]);
          } catch(e:any) {
             Alert.alert('Xatolik', e.message);
          }
      }}
    ]);
  }

  if (!user) return null;

  return (
    <>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        
        <View style={styles.header}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.fullName?.[0]?.toUpperCase() || 'U'}</Text>
          </View>
          <Text style={styles.name}>{user.fullName}</Text>
          <Text style={styles.roleLabel}>{user.appRole === 'FACILITY' ? 'Sex xodimi' : 'Gilam Haydovchisi'}</Text>
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

        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.actionBtnCard} onPress={() => setShowExpense(true)} activeOpacity={0.8}>
             <View style={[styles.actionIconBg, {backgroundColor: 'rgba(16, 185, 129, 0.15)'}]}>
                <Ionicons name="wallet-outline" size={24} color="#10b981" />
             </View>
             <Text style={styles.actionCardText}>Xarajat{'\n'}qo'shish</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnCard} onPress={() => setShowLogout(true)} activeOpacity={0.8}>
             <View style={[styles.actionIconBg, {backgroundColor: 'rgba(239, 68, 68, 0.1)'}]}>
                <Ionicons name="log-out-outline" size={24} color="#ef4444" />
             </View>
             <Text style={styles.actionCardText}>Hisobdan{'\n'}chiqish</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.myExpHeader}>
          <Text style={styles.myExpTitle}>Mening xarajatlarim</Text>
          {loadingExp && <ActivityIndicator size="small" color="#10b981" />}
        </View>

        {myExpenses.length === 0 && !loadingExp ? (
          <View style={styles.emptyExp}>
            <Ionicons name="receipt-outline" size={32} color="#27272a" />
            <Text style={styles.emptyExpText}>Hali xarajat kiritmagansiz</Text>
          </View>
        ) : (
          myExpenses.map((exp) => (
            <View key={exp.id} style={styles.expCard}>
               <View style={{flex: 1}}>
                  <Text style={styles.expT}>{exp.title}</Text>
                  <Text style={styles.expD}>{new Date(exp.createdAt).toLocaleString('ru-RU', {day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</Text>
               </View>
               <View style={{alignItems: 'flex-end', justifyContent: 'center'}}>
                  <Text style={styles.expSum}>{exp.amount.toLocaleString()} so'm</Text>
               </View>
               <TouchableOpacity style={styles.expDelBtn} onPress={() => handleDeleteExpense(exp.id, exp.title)}>
                  <Ionicons name="trash" size={20} color="#ef4444" />
               </TouchableOpacity>
            </View>
          ))
        )}

      </ScrollView>

      {/* EXPENSE MODAL */}
      <Modal visible={showExpense} transparent animationType="slide">
        <View style={styles.expenseModalBg}>
          <ScrollView contentContainerStyle={styles.expenseModalScroll}>
            <View style={styles.expenseModalCard}>
              
              <View style={styles.dragHandle} />
              
              <Text style={styles.expenseTitle}>Yangi Xarajat</Text>

              <View style={styles.inputBlock}>
                 <Text style={styles.label}>Nima uchun sarflandi?</Text>
                 <TextInput 
                   style={styles.inputThin} 
                   placeholder="Masalan: Yoqilg'i, Tushlik" 
                   placeholderTextColor="#52525b"
                   value={expenseData.title}
                   onChangeText={(v) => setExpenseData({...expenseData, title: v})}
                 />
              </View>

              <View style={styles.inputBlock}>
                 <Text style={styles.label}>Summa (so'm)</Text>
                 <TextInput 
                   style={styles.inputThin} 
                   placeholder="250 000" 
                   placeholderTextColor="#52525b"
                   keyboardType="numeric"
                   value={expenseData.amount}
                   onChangeText={(v) => setExpenseData({...expenseData, amount: v})}
                 />
              </View>

              <View style={styles.inputBlock}>
                 <Text style={styles.label}>Izoh (ixtiyoriy)</Text>
                 <TextInput 
                   style={[styles.inputThin, {height: 80, paddingVertical: 16}]} 
                   placeholder="Shamol bo'lib qolsin..." 
                   placeholderTextColor="#52525b"
                   multiline
                   textAlignVertical="top"
                   value={expenseData.comment}
                   onChangeText={(v) => setExpenseData({...expenseData, comment: v})}
                 />
              </View>

              <View style={styles.mCmds}>
                <TouchableOpacity style={styles.mBtnCancel} onPress={() => setShowExpense(false)}>
                  <Text style={styles.mBtnCancelText}>Bekor qilish</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.fatGreenBtn} onPress={handleSaveExpense} disabled={savingExpense}>
                  {savingExpense ? <ActivityIndicator color="#fff" /> : <Text style={styles.fatGreenText}>Tasdiqlash</Text>}
                </TouchableOpacity>
              </View>

            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* LOGOUT MODAL */}

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
  infoValue: { fontSize: 16, color: '#ffffff', fontWeight: '700', letterSpacing: 0.5 },
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
  actionRow: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  actionBtnCard: { flex: 1, backgroundColor: '#18181b', borderRadius: 24, padding: 20, alignItems: 'center', justifyContent: 'center', elevation: 2 },
  actionIconBg: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  actionCardText: { color: '#ffffff', fontSize: 13, fontWeight: '700', textAlign: 'center', lineHeight: 20 },

  expenseModalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  expenseModalScroll: { flexGrow: 1, justifyContent: 'flex-end' },
  expenseModalCard: { backgroundColor: '#18181b', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  dragHandle: { width: 40, height: 4, backgroundColor: '#3f3f46', borderRadius: 2, alignSelf: 'center', marginBottom: 24 },
  expenseTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 24, textAlign: 'center' },
  
  inputBlock: { marginBottom: 16 },
  label: { color: '#a1a1aa', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 8, letterSpacing: 1 },
  inputThin: { backgroundColor: '#27272a', borderRadius: 16, height: 56, paddingHorizontal: 16, color: '#fff', fontSize: 15, fontWeight: '600' },
  
  fatGreenBtn: { flex: 1, height: 56, backgroundColor: '#10b981', borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  fatGreenText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  myExpHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16, marginTop: 16 },
  myExpTitle: { color: '#ffffff', fontSize: 20, fontWeight: '800' },
  emptyExp: { backgroundColor: '#18181b', borderRadius: 16, padding: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#27272a' },
  emptyExpText: { color: '#71717a', fontSize: 14, fontWeight: '600', marginTop: 12 },
  expCard: { backgroundColor: '#18181b', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  expT: { color: '#ffffff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
  expD: { color: '#71717a', fontSize: 12, fontWeight: '600' },
  expSum: { color: '#10b981', fontSize: 15, fontWeight: '800', paddingHorizontal: 16 },
  expDelBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(239, 68, 68, 0.1)', justifyContent: 'center', alignItems: 'center' }
});
