import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '../_layout';
import { getCompanyOrders, Order } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function HistoryScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    try {
      const companyId = user.company?.id || user.companyId;
      if (!companyId) return;
      const data = await getCompanyOrders(companyId);
      setOrders((data || []).filter(o => o.status === 'DELIVERED' || o.status === 'CANCELLED'));
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
          <View style={styles.card}>
             <View style={styles.rowInfo}>
                <Text style={styles.idText}>#{item.id.substring(0, 8)}</Text>
                <Text style={[styles.statusTag, item.status === 'CANCELLED' && { color: '#ef4444' }]}>
                   {item.status === 'DELIVERED' ? 'YAKUNLANDI' : 'BEKOR QILINGAN'}
                </Text>
             </View>
             {item.customer && (
                <View style={styles.cBox}>
                  <Text style={styles.cName}>{item.customer.fullName}</Text>
                  <Text style={styles.cDetail}>{item.customer.address || item.customer.phone1}</Text>
                </View>
             )}
             <View style={styles.botRow}>
                <Text style={styles.date}>{new Date(item.updatedAt).toLocaleDateString()}</Text>
                <Text style={styles.amount}>{Number(item.totalAmount).toLocaleString()} So'm</Text>
             </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#09090b' },
  container: { flex: 1, backgroundColor: '#09090b' },
  list: { padding: 16, paddingBottom: 100 },
  card: { backgroundColor: '#18181b', borderRadius: 20, padding: 20, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' },
  rowInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  idText: { fontSize: 14, color: '#71717a', fontWeight: '800' },
  statusTag: { fontSize: 12, color: '#10b981', fontWeight: '800', letterSpacing: 1 },
  cBox: { marginBottom: 16 },
  cName: { fontSize: 16, color: '#ffffff', fontWeight: '800' },
  cDetail: { fontSize: 14, color: '#a1a1aa', marginTop: 4 },
  botRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#27272a', paddingTop: 16 },
  date: { fontSize: 13, color: '#71717a', fontWeight: '600' },
  amount: { fontSize: 16, color: '#ffffff', fontWeight: '800' },
  empty: { alignItems: 'center', marginTop: 100 },
  emptyTitle: { fontSize: 18, color: '#71717a', fontWeight: '700', marginTop: 16 }
});
