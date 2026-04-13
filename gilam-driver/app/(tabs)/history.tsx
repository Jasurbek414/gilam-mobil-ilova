import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useAuth } from '../_layout';
import { getCompanyOrders, Order } from '../../lib/api';
import { MaterialIcons } from '@expo/vector-icons';

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
      setLoading(false); setRefreshing(false);
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
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const renderItem = ({ item }: { item: Order }) => {
    const isDelivered = item.status === 'DELIVERED';
    
    return (
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.identBox}>
             <MaterialIcons 
               name={isDelivered ? "check-circle" : "cancel"} 
               size={20} 
               color={isDelivered ? "#10b981" : "#ef4444"} 
             />
             <Text style={styles.orderId}>Buyurtma #{item.id.substring(0, 8)}</Text>
          </View>
          <Text style={[styles.statusText, !isDelivered && styles.textError]}>
            {isDelivered ? 'YETKAZILDI' : 'BEKOR QILINDI'}
          </Text>
        </View>

        {item.customer && (
          <View style={styles.body}>
            <Text style={styles.name}>{item.customer.fullName}</Text>
            <Text style={styles.address}>{item.customer.address || item.customer.phone1}</Text>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.date}>
            {new Date(item.updatedAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'short', year: 'numeric' })}
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyCircle}>
              <MaterialIcons name="history-toggle-off" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>Tarix bo'sh</Text>
            <Text style={styles.emptyText}>Hali yakunlangan yoki bekor qilingan tranzaksiyalar mavjud emas.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  list: { padding: 16, paddingBottom: 100 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  identBox: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderId: { 
    fontSize: 14, 
    color: '#0f172a', 
    fontWeight: '700',
    marginLeft: 8,
  },
  statusText: { 
    fontSize: 11, 
    fontWeight: '800', 
    letterSpacing: 0.5, 
    color: '#10b981' 
  },
  textError: { color: '#ef4444' },
  body: { marginBottom: 16 },
  name: { fontSize: 16, fontWeight: '700', color: '#334155', marginBottom: 2 },
  address: { fontSize: 14, color: '#64748b' },
  footer: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    borderTopWidth: 1, 
    borderTopColor: '#f1f5f9', 
    paddingTop: 16 
  },
  date: { fontSize: 13, color: '#94a3b8', fontWeight: '500' },
  amount: { fontSize: 16, fontWeight: '800', color: '#0f172a' },
  empty: { alignItems: 'center', paddingVertical: 80 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
});
