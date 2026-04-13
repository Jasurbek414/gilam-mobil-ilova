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
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Order }) => {
    const isDelivered = item.status === 'DELIVERED';
    
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.statusRow}>
            <Text style={styles.emoji}>{isDelivered ? '✅' : '❌'}</Text>
            <View style={[styles.badge, isDelivered ? styles.badgeSuccess : styles.badgeError]}>
              <Text style={[styles.badgeText, isDelivered ? styles.textSuccess : styles.textError]}>
                {isDelivered ? 'YETKAZILDI' : 'BEKOR QILINDI'}
              </Text>
            </View>
          </View>
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
            {Number(item.totalAmount).toLocaleString()} so'm
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>Hali bajarilgan buyurtma yo'q</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: '#f1f5f9',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 16, marginRight: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  badgeSuccess: { backgroundColor: '#dcfce7' },
  badgeError: { backgroundColor: '#fee2e2' },
  badgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  textSuccess: { color: '#16a34a' },
  textError: { color: '#dc2626' },
  orderId: { fontSize: 12, color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  body: { marginBottom: 16 },
  name: { fontSize: 14, fontWeight: '700', color: '#334155' },
  address: { fontSize: 12, color: '#64748b', marginTop: 2 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 12 },
  date: { fontSize: 12, color: '#94a3b8', fontWeight: '500' },
  amount: { fontSize: 15, fontWeight: '900', color: '#059669' },
  empty: { alignItems: 'center', paddingVertical: 64 },
  emptyEmoji: { fontSize: 48, marginBottom: 16 },
  emptyText: { fontSize: 14, color: '#94a3b8', fontWeight: '600' },
});
