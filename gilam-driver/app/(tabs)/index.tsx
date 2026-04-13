import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Linking, ActivityIndicator, Alert, Platform
} from 'react-native';
import { useAuth } from '../_layout';
import { getMyOrders, updateOrderStatus, Order, STATUS_CONFIG } from '../../lib/api';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

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
      setLoading(false); setRefreshing(false);
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
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  const renderOrder = ({ item }: { item: Order }) => {
    const config = STATUS_CONFIG[item.status] || {
      label: item.status, emoji: '📋', color: '#64748b', bg: '#f1f5f9'
    };

    return (
      <View style={styles.card}>
        {/* Top Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusPill, { backgroundColor: config.bg }]}>
            <Text style={styles.statusEmoji}>{config.emoji}</Text>
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
          </View>
          <Text style={styles.orderId}>#{item.id.substring(0, 8)}</Text>
        </View>

        {/* Customer Information */}
        {item.customer && (
          <View style={styles.cardBody}>
            <View style={styles.customerHeader}>
              <View style={styles.customerAvatar}>
                <Text style={styles.customerInitials}>{item.customer.fullName[0]?.toUpperCase()}</Text>
              </View>
              <View style={styles.customerInfo}>
                <Text style={styles.customerName}>{item.customer.fullName}</Text>
                <Text style={styles.customerPhone}>{item.customer.phone1}</Text>
              </View>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => callCustomer(item.customer!.phone1)}
                activeOpacity={0.7}
              >
                <Ionicons name="call" size={20} color="#10b981" />
              </TouchableOpacity>
            </View>

            {item.customer.address && (
              <View style={styles.addressBox}>
                <View style={styles.addressIconWrap}>
                   <Ionicons name="location" size={18} color="#64748b" />
                </View>
                <View style={styles.addressDetails}>
                  <Text style={styles.addressText}>{item.customer.address}</Text>
                  <TouchableOpacity onPress={() => openMap(item.customer!.address!)}>
                    <Text style={styles.mapLink}>Xaritada ochish <MaterialIcons name="arrow-forward-ios" size={10} /></Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* Pricing & Footer Actions */}
        <View style={styles.cardFooter}>
          <View style={styles.totalsBox}>
            <Text style={styles.itemsLabel}>{item.items?.length || 0} ta buyum</Text>
            <Text style={styles.amountLabel}>{Number(item.totalAmount).toLocaleString()} so'm</Text>
          </View>

          {config.next && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleUpdateStatus(item.id, config.next!)}
              disabled={updatingId === item.id}
              activeOpacity={0.8}
            >
              {updatingId === item.id ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.actionBtnText}>{config.nextLabel}</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item) => item.id}
        renderItem={renderOrder}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#10b981']} />}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <View style={styles.emptyCircle}>
              <MaterialIcons name="inbox" size={48} color="#94a3b8" />
            </View>
            <Text style={styles.emptyTitle}>Buyurtmalar yo'q</Text>
            <Text style={styles.emptyDesc}>Sizga biriktirilgan buyurtmalar bu yerda paydo bo'ladi.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f8fafc' },
  container: { flex: 1, backgroundColor: '#f8fafc' },
  listContent: { padding: 16, paddingBottom: 100, paddingTop: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.05,
    shadowRadius: 24,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusEmoji: { fontSize: 13, marginRight: 4 },
  statusText: { fontSize: 13, fontWeight: '700' },
  orderId: { fontSize: 13, color: '#94a3b8', fontWeight: '600' },
  cardBody: {
    padding: 20,
  },
  customerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  customerInitials: {
    fontSize: 18,
    fontWeight: '800',
    color: '#64748b',
  },
  customerInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 2,
  },
  customerPhone: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  callButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#ecfdf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressBox: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  addressIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  addressDetails: {
    flex: 1,
  },
  addressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  mapLink: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3b82f6',
  },
  cardFooter: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  totalsBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemsLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '600',
  },
  amountLabel: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  actionBtn: {
    backgroundColor: '#10b981',
    borderRadius: 16,
    height: 54,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  emptyBox: { alignItems: 'center', paddingVertical: 80 },
  emptyCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 16, elevation: 2 },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: '#0f172a', marginBottom: 8 },
  emptyDesc: { fontSize: 14, color: '#64748b', textAlign: 'center', paddingHorizontal: 40, lineHeight: 22 },
});
