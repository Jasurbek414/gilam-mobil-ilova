import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Linking, ActivityIndicator, Alert
} from 'react-native';
import { useAuth } from '../_layout';
import { getMyOrders, updateOrderStatus, Order, STATUS_CONFIG } from '../../lib/api';
import { MaterialIcons } from '@expo/vector-icons';

export default function OrdersScreen() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try {
      const data = await getMyOrders(user.id);
      setOrders(data || []);
    } catch (err: any) {
      console.warn('Load orders error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    loadOrders();
    // Auto refresh every 30 seconds
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, [loadOrders]);

  const onRefresh = () => {
    setRefreshing(true);
    loadOrders();
  };

  const handleUpdateStatus = async (orderId: string, nextStatus: string) => {
    setUpdatingId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
      await loadOrders();
    } catch (err: any) {
      Alert.alert('Xatolik', err.message || 'Status yangilanmadi');
    } finally {
      setUpdatingId(null);
    }
  };

  const callCustomer = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const openMap = (address: string) => {
    // Attempting to open mapping app, typically Yandex/Google Maps
    Linking.openURL(`https://yandex.uz/maps/?text=${encodeURIComponent(address)}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#059669" />
      </View>
    );
  }

  const renderOrder = ({ item }: { item: Order }) => {
    const config = STATUS_CONFIG[item.status] || {
      label: item.status, emoji: '📋', color: '#64748b', bg: '#f1f5f9'
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: config.bg, borderColor: config.color }]}>
            <Text style={styles.statusEmoji}>{config.emoji}</Text>
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.orderId}>#{item.id.substring(0, 8)}</Text>
        </View>

        {item.customer && (
          <View style={styles.cardBody}>
            <View style={styles.customerRow}>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{item.customer.fullName}</Text>
                <Text style={styles.customerPhone}>{item.customer.phone1}</Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => callCustomer(item.customer!.phone1)}
                activeOpacity={0.7}
              >
                <MaterialIcons name="call" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {item.customer.address && (
              <View style={styles.addressBox}>
                <MaterialIcons name="location-pin" size={20} color="#64748b" />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.addressText}>{item.customer.address}</Text>
                  <TouchableOpacity onPress={() => openMap(item.customer!.address!)}>
                    <Text style={styles.mapLink}>Xaritada ochish →</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.totalItems}>{item.items?.length || 0} ta mahsulot</Text>
          <Text style={styles.totalAmount}>{Number(item.totalAmount).toLocaleString()} so'm</Text>
        </View>

        {item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>💬 {item.notes}</Text>
          </View>
        )}

        {config.next && (
          <View style={styles.actionBox}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleUpdateStatus(item.id, config.next!)}
              disabled={updatingId === item.id}
              activeOpacity={0.8}
            >
              {updatingId === item.id ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.actionBtnText}>{config.nextLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const activeCount = orders.length;
  const waitingCount = orders.filter(o => o.status === 'DRIVER_ASSIGNED').length;

  return (
    <View style={styles.container}>
      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statBox, { backgroundColor: '#059669' }]}>
          <Text style={styles.statScore}>{activeCount}</Text>
          <Text style={styles.statLabel}>AKTIV BUYURTMALAR</Text>
        </View>
        <View style={[styles.statBox, { backgroundColor: '#d97706' }]}>
          <Text style={styles.statScore}>{waitingCount}</Text>
          <Text style={styles.statLabel}>KUTAYOTGAN</Text>
        </View>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#059669']} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>Hozircha buyurtma yo'q</Text>
            <Text style={styles.emptyDesc}>Yangi buyurtma kelganda bu yerda ko'rinadi</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  statsRow: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statBox: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statScore: { fontSize: 28, fontWeight: '900', color: '#fff' },
  statLabel: { fontSize: 10, fontWeight: '800', color: '#f1f5f9', letterSpacing: 1, marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f8fafc',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusEmoji: { fontSize: 14, marginRight: 6 },
  statusText: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase' },
  orderId: { fontSize: 12, color: '#94a3b8', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardBody: { padding: 16 },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#1e293b' },
  customerPhone: { fontSize: 13, color: '#64748b', marginTop: 2 },
  callBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#22c55e',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#22c55e', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4,
  },
  addressBox: { flexDirection: 'row', backgroundColor: '#f8fafc', padding: 12, borderRadius: 12 },
  addressText: { fontSize: 13, fontWeight: '600', color: '#334155' },
  mapLink: { fontSize: 12, fontWeight: '700', color: '#3b82f6', marginTop: 4 },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, paddingHorizontal: 16, backgroundColor: '#f8fafc',
  },
  totalItems: { fontSize: 13, fontWeight: '600', color: '#64748b' },
  totalAmount: { fontSize: 16, fontWeight: '900', color: '#059669' },
  notesBox: { padding: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  notesText: { fontSize: 12, fontStyle: 'italic', color: '#64748b' },
  actionBox: { padding: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9' },
  actionBtn: {
    backgroundColor: '#059669', borderRadius: 16, paddingVertical: 16,
    alignItems: 'center', shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3,
  },
  actionBtnText: { color: '#fff', fontSize: 15, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  emptyBox: { alignItems: 'center', paddingVertical: 64 },
  emptyEmoji: { fontSize: 64, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#475569' },
  emptyDesc: { fontSize: 13, color: '#94a3b8', marginTop: 4 },
});
