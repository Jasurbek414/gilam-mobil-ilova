import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Linking, ActivityIndicator, Alert, Platform } from 'react-native';
import { useAuth } from '../_layout';
import { getMyOrders, updateOrderStatus, Order, STATUS_CONFIG } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try { const data = await getMyOrders(user.id); setOrders(data || []); }
    catch (err: any) { console.warn('Load orders error:', err); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user]);

  useEffect(() => { loadOrders(); const interval = setInterval(loadOrders, 30000); return () => clearInterval(interval); }, [loadOrders]);

  const onRefresh = () => { setRefreshing(true); loadOrders(); };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    try { await updateOrderStatus(orderId, nextStatus); await loadOrders(); }
    catch (err: any) { Alert.alert('Xatolik', err.message || 'Status yangilanmadi'); }
    finally { setUpdatingId(null); }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#10b981" />}
        ListEmptyComponent={
          <View style={styles.empty}>
             <Ionicons name="documents-outline" size={64} color="#27272a" />
             <Text style={styles.emptyTitle}>Sog'inch bilan kutamiz</Text>
             <Text style={styles.emptyDesc}>Sizga biriktirilgan yetkazib berish jarayonlari shu yerda chiqadi.</Text>
          </View>
        }
        renderItem={({ item }) => {
          const config = STATUS_CONFIG[item.status] || { label: item.status, emoji: '📦' };

          return (
            <View style={styles.card}>
              <View style={styles.cardInfo}>
                 <Text style={styles.idText}>#{(item.id).substring(0, 8)}</Text>
                 <Text style={styles.statusText}>{config.emoji} {config.label}</Text>
              </View>

              {item.customer && (
                <View style={styles.customerBlock}>
                   <View style={{flex: 1}}>
                      <Text style={styles.cName}>{item.customer.fullName}</Text>
                      <Text style={styles.cPhone}>{item.customer.phone1}</Text>
                      <Text style={styles.cAddress} numberOfLines={2}>{item.customer.address || "Manzil kiritilmagan"}</Text>
                   </View>
                   <View style={styles.actionGrid}>
                      <TouchableOpacity style={styles.iconBtn} onPress={() => Linking.openURL(`tel:${item.customer!.phone1}`)}>
                         <Ionicons name="call" size={20} color="#10b981" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.iconBtn, { marginTop: 12 }]} onPress={() => Linking.openURL(`https://yandex.uz/maps/?text=${item.customer!.address!}`)}>
                         <Ionicons name="navigate" size={20} color="#38bdf8" />
                      </TouchableOpacity>
                   </View>
                </View>
              )}

              <View style={styles.footerData}>
                 <Text style={styles.fText}>{item.items?.length || 0} dona</Text>
                 <Text style={styles.fMoney}>{Number(item.totalAmount).toLocaleString()} So'm</Text>
              </View>

              {config.next && (
                 <TouchableOpacity 
                   style={styles.mainBtn} 
                   activeOpacity={0.8} 
                   onPress={() => handleUpdateStatus(item.id, config.next!)}
                   disabled={updatingId === item.id}
                 >
                   {updatingId === item.id ? <ActivityIndicator color="#09090b" /> : <Text style={styles.mainBtnText}>{config.nextLabel}</Text>}
                 </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
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
  footerData: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 16 },
  fText: { fontSize: 14, color: '#a1a1aa', fontWeight: '700' },
  fMoney: { fontSize: 20, color: '#ffffff', fontWeight: '900' },
  mainBtn: { backgroundColor: '#10b981', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  mainBtnText: { color: '#09090b', fontSize: 15, fontWeight: '800', letterSpacing: 0.5 },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 20, color: '#ffffff', fontWeight: '800', marginTop: 24 },
  emptyDesc: { fontSize: 14, color: '#71717a', textAlign: 'center', paddingHorizontal: 40, marginTop: 8 }
});
