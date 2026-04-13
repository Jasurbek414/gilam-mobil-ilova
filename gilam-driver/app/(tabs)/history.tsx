import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator, Platform } from 'react-native';
import { useAuth } from '../_layout';
import { getCompanyOrders, Order } from '../../lib/api';

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
      const myHistory = (data || []).filter(
        (o) => o.status === 'DELIVERED' || o.status === 'CANCELLED'
      );
      setOrders(myHistory);
    } catch (err: any) {
      console.warn('Load history error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const onRefresh = () => {
    setRefreshing(true);
    loadHistory();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Order }) => {
    const isDelivered = item.status === 'DELIVERED';
    
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <Text style={[styles.statusText, !isDelivered && styles.textError]}>
            {isDelivered ? 'YETKAZILDI' : 'BEKOR QILINDI'}
          </Text>
          <Text style={styles.orderId}>#{item.id.substring(0, 8)}</Text>
        </View>

        {item.customer && (
          <View style={styles.body}>
            <Text style={styles.name}>{item.customer.fullName}</Text>
            <Text style={styles.address}>{item.customer.address || item.customer.phone1}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.date}>
            {new Date(item.updatedAt).toLocaleDateString('uz-UZ')}
          </Text>
          <Text style={styles.amount}>
            {Number(item.totalAmount).toLocaleString()} SO'M
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#000000']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Bajarilgan buyurtmalar yo'q.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF', padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 8,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: '#000000' },
  textError: { color: '#E53E3E' },
  orderId: { fontSize: 12, color: '#A0AEC0', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  body: { marginBottom: 16 },
  name: { fontSize: 14, fontWeight: '700', color: '#1A202C' },
  address: { fontSize: 13, color: '#718096', marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F7FAFC', paddingTop: 12 },
  date: { fontSize: 12, color: '#718096', fontWeight: '500' },
  amount: { fontSize: 13, fontWeight: '800', color: '#000000' },
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyText: { fontSize: 14, color: '#718096', fontWeight: '500' },
});
