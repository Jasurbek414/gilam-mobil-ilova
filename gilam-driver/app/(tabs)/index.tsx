import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Linking, ActivityIndicator, Alert, Platform
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
    Linking.openURL(`https://yandex.uz/maps/?text=${encodeURIComponent(address)}`);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  const renderOrder = ({ item }: { item: Order }) => {
    const config = STATUS_CONFIG[item.status] || {
      label: item.status, emoji: '📋', color: '#718096', bg: '#F7FAFC'
    };

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.statusText}>{config.label}</Text>
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
                style={styles.actionIcon}
                onPress={() => callCustomer(item.customer!.phone1)}
              >
                <MaterialIcons name="phone" size={20} color="#000000" />
              </TouchableOpacity>
            </View>

            {item.customer.address && (
              <View style={styles.addressRow}>
                <Text style={styles.addressText}>{item.customer.address}</Text>
                <TouchableOpacity onPress={() => openMap(item.customer!.address!)}>
                  <Text style={styles.mapLink}>Xarita</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        <View style={styles.cardFooter}>
          <Text style={styles.totalItems}>{item.items?.length || 0} PCS</Text>
          <Text style={styles.totalAmount}>{Number(item.totalAmount).toLocaleString()} SO'M</Text>
        </View>

        {item.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{item.notes}</Text>
          </View>
        )}

        {config.next && (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleUpdateStatus(item.id, config.next!)}
            disabled={updatingId === item.id}
          >
            {updatingId === item.id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.actionBtnText}>{config.nextLabel}</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const activeCount = orders.length;

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <Text style={styles.statCount}>{activeCount}</Text>
        <Text style={styles.statLabel}>AKTIV BUYURTMALAR</Text>
      </View>

      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#000000']} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Buyurtmalar yo'q</Text>
            <Text style={styles.emptyDesc}>Barcha buyurtmalar yakunlangan yoki tayinlanmagan.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F7FAFC' },
  statsRow: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    alignItems: 'center',
  },
  statCount: { fontSize: 36, fontWeight: '900', color: '#000000' },
  statLabel: { fontSize: 11, fontWeight: '700', color: '#718096', letterSpacing: 1, marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 32 },
  card: {
    backgroundColor: '#FFFFFF',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F7FAFC',
  },
  statusText: { fontSize: 12, fontWeight: '800', color: '#000000', textTransform: 'uppercase', letterSpacing: 0.5 },
  orderId: { fontSize: 12, color: '#A0AEC0', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  cardBody: { padding: 16 },
  customerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerInfo: { flex: 1 },
  customerName: { fontSize: 16, fontWeight: '700', color: '#1A202C' },
  customerPhone: { fontSize: 13, color: '#4A5568', marginTop: 2 },
  actionIcon: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#F2F2F2',
    justifyContent: 'center', alignItems: 'center',
  },
  addressRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 4 },
  addressText: { fontSize: 13, color: '#718096', flex: 1, marginRight: 16 },
  mapLink: { fontSize: 12, fontWeight: '700', color: '#000000', textDecorationLine: 'underline' },
  cardFooter: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderTopWidth: 1, borderTopColor: '#F7FAFC',
  },
  totalItems: { fontSize: 12, fontWeight: '600', color: '#718096' },
  totalAmount: { fontSize: 14, fontWeight: '800', color: '#000000' },
  notesBox: { paddingHorizontal: 16, paddingBottom: 16 },
  notesText: { fontSize: 13, color: '#A0AEC0', fontStyle: 'italic' },
  actionBtn: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  actionBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' },
  emptyBox: { alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#000000', marginBottom: 8 },
  emptyDesc: { fontSize: 13, color: '#718096', textAlign: 'center' },
});
