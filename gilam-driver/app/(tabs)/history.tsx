import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { useAuth } from '../_layout';
import { getDriverCompletedOrders, Order } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      if (!user.id) return;
      const data = await getDriverCompletedOrders(user.id);
      setOrders(data || []);
    } catch (err) { }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHistory(); }} tintColor="#10b981" />}
        ListEmptyComponent={
          <View style={styles.empty}>
             <Ionicons name="time" size={64} color="#27272a" />
             <Text style={styles.emptyTitle}>Tarix Yo'q</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} style={styles.card} onPress={() => setSelectedOrder(item)}>
             <View style={styles.rowInfo}>
                <Text style={styles.idText}>#{item.id.substring(0, 8)}</Text>
                <Text style={[styles.statusTag, item.status === 'CANCELLED' && { color: '#ef4444' }]}>
                   {item.status === 'DELIVERED' ? 'YAKUNLANDI 📦' : 'BEKOR QILINGAN ❌'}
                </Text>
             </View>
             {item.customer && (
                <View style={styles.cBox}>
                  <Text style={styles.cName}>{item.customer.fullName}</Text>
                  <Text style={styles.cDetail}>{item.customer.address || item.customer.phone1}</Text>
                </View>
             )}
             <View style={styles.botRow}>
                <Text style={styles.date}>{new Date(item.updatedAt).toLocaleDateString('uz-UZ')}</Text>
                <Text style={styles.amount}>{Number(item.totalAmount).toLocaleString()} So'm <Ionicons name="chevron-forward" color="#10b981"/></Text>
             </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selectedOrder} transparent animationType="slide">
         {selectedOrder && (
           <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                 <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Tarixiy Ma'lumot</Text>
                    <TouchableOpacity onPress={() => setSelectedOrder(null)} style={styles.closeBtn}>
                       <Ionicons name="close" size={24} color="#ffffff" />
                    </TouchableOpacity>
                 </View>

                 <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.mRow}>
                       <Text style={styles.mLabel}>ID Raqam:</Text>
                       <Text style={styles.mValue}>#{selectedOrder.id.substring(0, 8)}</Text>
                    </View>
                    <View style={styles.mRow}>
                       <Text style={styles.mLabel}>Holati:</Text>
                       <Text style={[styles.mValue, { color: selectedOrder.status === 'CANCELLED' ? '#ef4444' : '#10b981' }]}>{selectedOrder.status}</Text>
                    </View>
                    <View style={styles.mRow}>
                       <Text style={styles.mLabel}>Sana:</Text>
                       <Text style={styles.mValue}>{new Date(selectedOrder.updatedAt).toLocaleString('uz-UZ')}</Text>
                    </View>
                    
                    {selectedOrder.customer && (
                      <View style={styles.cDetailBox}>
                         <Text style={styles.cDetailTitle}>Mijoz Ma'lumotlari</Text>
                         <Text style={styles.cDetailText}><Ionicons name="person" size={12} color="#10b981"/> {selectedOrder.customer.fullName}</Text>
                         <Text style={styles.cDetailText}><Ionicons name="call" size={12} color="#10b981"/> {selectedOrder.customer.phone1}</Text>
                         <Text style={styles.cDetailText}><Ionicons name="location" size={12} color="#10b981"/> {selectedOrder.customer.address || "Manzil kiritilmagan"}</Text>
                      </View>
                    )}

                    {selectedOrder.notes && (
                      <View style={styles.mRow}>
                         <Text style={styles.mLabel}>Izoh (Notes):</Text>
                         <Text style={[styles.mValue, { flex: 1, textAlign: 'right', marginLeft: 16 }]}>{selectedOrder.notes}</Text>
                      </View>
                    )}

                    <Text style={styles.sectionTitle}>Xizmatlar ({selectedOrder.items?.length || 0})</Text>
                    {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                        <Text style={styles.emptyItems}>Hech qanday ma'lumot qolmagan.</Text>
                    ) : (
                       selectedOrder.items.map((it, idx) => (
                          <View key={idx} style={styles.itemBox}>
                             <View style={styles.itemHeader}>
                                <Text style={styles.itemName}>{it.service?.name || 'Xizmat'}</Text>
                                <Text style={styles.itemPrice}>{Number(it.totalPrice).toLocaleString()} so'm</Text>
                             </View>
                             <Text style={styles.itemMetric}>{it.quantity} qism {(it.width && it.length) ? `| D: ${it.width}x${it.length}` : ''}</Text>
                          </View>
                       ))
                    )}
                 </ScrollView>
              </View>
           </View>
         )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' },
  container: { flex: 1, backgroundColor: '#09090b' },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#18181b', borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  rowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  idText: { fontSize: 13, color: '#71717a', fontWeight: '800', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  statusTag: { fontSize: 12, color: '#10b981', fontWeight: '800', letterSpacing: 1 },
  cBox: { marginBottom: 16, padding: 12, backgroundColor: '#09090b', borderRadius: 12, borderWidth: 1, borderColor: '#27272a' },
  cName: { fontSize: 16, color: '#ffffff', fontWeight: '800' },
  cDetail: { fontSize: 13, color: '#a1a1aa', marginTop: 4 },
  botRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  date: { fontSize: 13, color: '#71717a', fontWeight: '600' },
  amount: { fontSize: 16, color: '#ffffff', fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 18, color: '#71717a', fontWeight: '700', marginTop: 16 },

  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modalContent: { backgroundColor: '#18181b', borderTopLeftRadius: 24, borderTopRightRadius: 24, height: '70%', padding: 24, borderWidth: 1, borderColor: '#27272a' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#27272a', paddingBottom: 16, marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#ffffff' },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center' },
  modalScroll: { flex: 1 },
  mRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  mLabel: { fontSize: 14, color: '#a1a1aa', fontWeight: '600' },
  mValue: { fontSize: 14, color: '#ffffff', fontWeight: '800' },
  cDetailBox: { backgroundColor: '#09090b', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#27272a', marginBottom: 12, marginTop: 4 },
  cDetailTitle: { fontSize: 12, textTransform: 'uppercase', color: '#10b981', fontWeight: '900', marginBottom: 8, letterSpacing: 1 },
  cDetailText: { fontSize: 13, color: '#e4e4e7', fontWeight: '600', marginBottom: 4 },
  sectionTitle: { fontSize: 16, color: '#ffffff', fontWeight: '800', marginTop: 8, marginBottom: 12 },
  emptyItems: { color: '#71717a', fontSize: 14, fontStyle: 'italic' },
  itemBox: { backgroundColor: '#09090b', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#27272a', marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  itemName: { fontSize: 15, color: '#ffffff', fontWeight: '700', flex: 1 },
  itemPrice: { fontSize: 15, color: '#10b981', fontWeight: '800', marginLeft: 8 },
  itemMetric: { fontSize: 13, color: '#a1a1aa' },
});
