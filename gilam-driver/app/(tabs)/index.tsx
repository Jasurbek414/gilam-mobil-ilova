import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Linking, ActivityIndicator, Alert, Platform, Modal, ScrollView } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { getMyOrders, getFacilityOrders, updateOrderStatus, Order, STATUS_CONFIG } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try { 
      let data = [];
      if (user.appRole === 'FACILITY') {
        data = await getFacilityOrders(user.companyId);
      } else {
        data = await getMyOrders(user.id);
      }
      setOrders(data || []); 
    }
    catch (err: any) { console.warn('Load orders error:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { loadOrders(); const interval = setInterval(loadOrders, 3000); return () => clearInterval(interval); }, [loadOrders]);

  const onRefresh = () => { setRefreshing(true); loadOrders(); };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    const doUpdate = async () => {
      setUpdatingId(orderId);
      try { await updateOrderStatus(orderId, nextStatus); await loadOrders(); }
      catch (err: any) { Alert.alert('Xatolik', err.message || 'Status yangilanmadi'); }
      finally { setUpdatingId(null); }
    };

    if (nextStatus === 'AT_FACILITY') {
      Alert.alert(
        'Tasdiqlash',
        'Barcha gilamlarni korxonaga (sexga) tushirib topshirganingizni tasdiqlaysizmi?',
        [
          { text: 'Bekor qilish', style: 'cancel' },
          { text: 'Tasdiqlayman', onPress: doUpdate, style: 'default' }
        ]
      );
    } else if (nextStatus === 'DELIVERED') {
      Alert.alert(
        'Tasdiqlash',
        'Gilamlar mijozga to\'liq yetkazib berilganligini tasdiqlaysizmi?',
        [
          { text: 'Bekor qilish', style: 'cancel' },
          { text: 'Tasdiqlayman', onPress: doUpdate, style: 'default' }
        ]
      );
    } else {
      doUpdate();
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;
  }

  return (
    <View style={styles.container}>
      <Tabs.Screen 
        options={{
          headerRight: () => (
            <TouchableOpacity onPress={() => router.push('/chat')} style={{ marginRight: 20 }}>
               <Ionicons name="chatbubbles" size={26} color="#10b981" />
            </TouchableOpacity>
          )
        }} 
      />
      <View style={{ backgroundColor: 'red', padding: 10 }}>
         <Text style={{ color: 'white', fontWeight: 'bold' }}>
           DEBUG -- BackEndRole: {user?.role} | AppRole: {user?.appRole}
         </Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        ListEmptyComponent={
          <View style={styles.empty}>
             <Ionicons name="documents-outline" size={64} color="#27272a" />
             <Text style={styles.emptyTitle}>Sog'inch bilan kutamiz</Text>
             <Text style={styles.emptyDesc}>
               {user?.appRole === 'FACILITY' 
                 ? "Hozircha sexga kelib tushgan ishlar yo'q. Baraka kelishini kutamiz!" 
                 : "Sizga biriktirilgan yetkazib berish jarayonlari shu yerda chiqadi."}
             </Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = STATUS_CONFIG[item.status] || { label: item.status, emoji: '📦' };

          return (
            <TouchableOpacity 
              style={styles.cardCompact} 
              activeOpacity={0.7}
              onPress={() => setSelectedOrder(item)}
            >
              <View style={styles.cRow}>
                 <Text style={styles.cNameMini} numberOfLines={1}>{item.customer?.fullName || 'Noma\'lum shaxs'}</Text>
                 <View style={styles.statusBadgeCompact}>
                    <Text style={styles.statusBadgeText}>{config.emoji} {config.label}</Text>
                 </View>
              </View>
              
              {user?.appRole !== 'FACILITY' && (
                <Text style={styles.cAddressMini} numberOfLines={1}>
                   <Ionicons name="location" size={12} color="#71717a" /> {item.customer?.address || "Manzil kiritilmagan"}
                </Text>
              )}

              <View style={styles.cFooterMini}>
                 <Text style={styles.cMetaMini}>
                   {item.items?.length || 0} xil narsa
                   {user?.appRole !== 'FACILITY' ? ` • ${Number(item.totalAmount).toLocaleString()} sum` : ''}
                 </Text>
                 <Ionicons name="chevron-forward" size={16} color="#71717a" />
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Modern Order Details Modal */}
      <Modal visible={!!selectedOrder} transparent animationType="slide">
         {selectedOrder && (
           <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                 <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Buyurtma ma'lumoti</Text>
                    <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
                       <Ionicons name="close" size={24} color="#ffffff" />
                    </TouchableOpacity>
                 </View>

                 <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                    
                    <View style={styles.mRow}>
                       <Text style={styles.mLabel}>Buyurtma ID:</Text>
                       <Text style={styles.mValue}>#{selectedOrder.id.substring(0, 8)}</Text>
                    </View>
                    
                    <View style={styles.mRow}>
                       <Text style={styles.mLabel}>Yaratilgan vaqt:</Text>
                       <Text style={styles.mValue}>{new Date(selectedOrder.createdAt).toLocaleString('uz-UZ')}</Text>
                    </View>

                    <View style={styles.mRow}>
                       <Text style={styles.mLabel}>Buyurtmachi:</Text>
                       <Text style={styles.mValue}>{selectedOrder.customer?.fullName}</Text>
                    </View>

                    {user?.appRole !== 'FACILITY' && (
                      <>
                        <View style={styles.mRow}>
                           <Text style={styles.mLabel}>Telefon:</Text>
                           <Text style={styles.mValue}>{selectedOrder.customer?.phone1}</Text>
                        </View>

                        {selectedOrder.customer && (
                          <View style={styles.modalActionGrid}>
                             <TouchableOpacity style={styles.mBtnCall} onPress={() => Linking.openURL(`tel:${selectedOrder.customer!.phone1}`)}>
                                <Ionicons name="call" size={20} color="#fff" />
                                <Text style={styles.mBtnText}>Qo'ng'iroq</Text>
                             </TouchableOpacity>
                             <TouchableOpacity style={styles.mBtnMap} onPress={() => Linking.openURL(`https://yandex.uz/maps/?text=${selectedOrder.customer!.address!}`)}>
                                <Ionicons name="navigate" size={20} color="#fff" />
                                <Text style={styles.mBtnText}>Xarita</Text>
                             </TouchableOpacity>
                          </View>
                        )}
                      </>
                    )}

                     {selectedOrder.notes ? (
                        <View style={styles.mNotesBox}>
                           <Text style={styles.mLabel}>Izohlar:</Text>
                           <Text style={styles.mNotesText}>{selectedOrder.notes}</Text>
                        </View>
                     ) : null}

                     <Text style={styles.sectionTitle}>Narsalar ro'yxati</Text>
                     {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                         <Text style={styles.emptyItems}>Ichida narsalar hali biriktirilmagan.</Text>
                     ) : (
                        selectedOrder.items.map((it, idx) => (
                           <View key={it.id || idx} style={styles.itemBox}>
                              <View style={styles.itemHeader}>
                                 <Text style={styles.itemName}>{it.service?.name || 'Noma\'lum xizmat'}</Text>
                                 {user?.appRole !== 'FACILITY' && (
                                   <Text style={styles.itemPrice}>{Number(it.totalPrice).toLocaleString()} so'm</Text>
                                 )}
                              </View>
                              <View style={styles.itemDetails}>
                                 <Text style={styles.itemMetric}>{it.quantity} qism</Text>
                                 {(it.width && it.length) ? (
                                    <Text style={styles.itemDim}>{it.width} x {it.length} = {(it.width * it.length).toFixed(2)} m²</Text>
                                 ) : null}
                              </View>
                           </View>
                        ))
                     )}

                     <View style={{ height: 24 }} />
                     
                     {STATUS_CONFIG[selectedOrder.status]?.next && (
                        <TouchableOpacity 
                          style={styles.mainBtn} 
                          activeOpacity={0.8} 
                          onPress={() => {
                             handleUpdateStatus(selectedOrder.id, STATUS_CONFIG[selectedOrder.status].next!);
                             setSelectedOrder(null);
                          }}
                          disabled={updatingId === selectedOrder.id}
                        >
                          {updatingId === selectedOrder.id ? <ActivityIndicator color="#09090b" /> : <Text style={styles.mainBtnText}>{STATUS_CONFIG[selectedOrder.status].nextLabel}</Text>}
                        </TouchableOpacity>
                     )}
                     <View style={{ height: 40 }} />
                  </ScrollView>
               </View>
            </View>
         )}
      </Modal>

      {/* Floating Chat Button */}
      {user?.appRole !== 'FACILITY' && (
        <TouchableOpacity 
           style={styles.chatFab}
           activeOpacity={0.8}
           onPress={() => router.push('/chat')}
        >
           <Ionicons name="chatbubbles" size={28} color="#09090b" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  chatFab: { position: 'absolute', right: 20, bottom: 90, width: 64, height: 64, borderRadius: 32, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', shadowColor: '#10b981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' },
  container: { flex: 1, backgroundColor: '#09090b' },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#18181b', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#27272a' },
  cardInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  idText: { fontSize: 13, color: '#71717a', fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  statusText: { fontSize: 13, color: '#f4f4f5', fontWeight: '800' },
  customerBlock: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#09090b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a' },
  cName: { fontSize: 18, color: '#ffffff', fontWeight: '800', marginBottom: 4 },
  cPhone: { fontSize: 14, color: '#a1a1aa', fontWeight: '600', marginBottom: 8 },
  cAddress: { fontSize: 13, color: '#71717a', lineHeight: 18 },
  actionGrid: { alignItems: 'center', marginLeft: 16 },
  iconBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272a' },
  footerData: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 16, backgroundColor: '#27272a', padding: 12, borderRadius: 16 },
  fText: { fontSize: 13, color: '#10b981', fontWeight: '700', marginBottom: 4 },
  fMoney: { fontSize: 18, color: '#ffffff', fontWeight: '900' },
  mainBtn: { backgroundColor: '#10b981', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#09090b', fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 20, color: '#ffffff', fontWeight: '800', marginTop: 24 },
  emptyDesc: { fontSize: 14, color: '#71717a', textAlign: 'center', paddingHorizontal: 40, marginTop: 8 },

  cardCompact: { backgroundColor: '#18181b', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  cRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cNameMini: { fontSize: 16, color: '#fff', fontWeight: '800', flex: 1, paddingRight: 8 },
  statusBadgeCompact: { backgroundColor: '#27272a', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  cAddressMini: { fontSize: 12, color: '#a1a1aa', marginBottom: 12 },
  cFooterMini: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 10 },
  cMetaMini: { fontSize: 13, color: '#10b981', fontWeight: '800' },

  modalActionGrid: { flexDirection: 'row', gap: 12, marginTop: 12, marginBottom: 16 },
  mBtnCall: { flex: 1, backgroundColor: '#10b981', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 12, gap: 8 },
  mBtnMap: { flex: 1, backgroundColor: '#38bdf8', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: 48, borderRadius: 12, gap: 8 },
  mBtnText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#18181b', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '80%', padding: 24, borderWidth: 1, borderColor: '#27272a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#27272a', paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center' },
  modalScroll: { flex: 1 },
  mRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  mLabel: { fontSize: 14, color: '#a1a1aa', fontWeight: '600' },
  mValue: { fontSize: 14, color: '#ffffff', fontWeight: '800' },
  mNotesBox: { backgroundColor: '#09090b', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#27272a', marginTop: 8, marginBottom: 16 },
  mNotesText: { color: '#facc15', fontSize: 13, marginTop: 4, lineHeight: 18, fontWeight: '600' },
  sectionTitle: { fontSize: 16, color: '#ffffff', fontWeight: '800', marginTop: 16, marginBottom: 12 },
  emptyItems: { color: '#71717a', fontSize: 14, fontStyle: 'italic' },
  itemBox: { backgroundColor: '#09090b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a', marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { fontSize: 15, color: '#ffffff', fontWeight: '700', flex: 1 },
  itemPrice: { fontSize: 15, color: '#10b981', fontWeight: '800', marginLeft: 8 },
  itemDetails: { flexDirection: 'row', gap: 16 },
  itemMetric: { fontSize: 13, color: '#a1a1aa' },
  itemDim: { fontSize: 13, color: '#71717a' },
});
