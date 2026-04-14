import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, Linking, ActivityIndicator, Alert, Platform, Modal, ScrollView, TextInput } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useAuth } from '../_layout';
import { getMyOrders, getFacilityOrders, updateOrderStatus, Order, STATUS_CONFIG, getFacilityStages, FacilityStage, createFacilityStage, deleteFacilityStage, reorderFacilityStages } from '../../lib/api';
import { Ionicons } from '@expo/vector-icons';

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [deadlineOrder, setDeadlineOrder] = useState<{ id: string, nextStatus: string } | null>(null);
  const [completeOrderModal, setCompleteOrderModal] = useState<Order | null>(null);
  const [receivedAmount, setReceivedAmount] = useState<string>('');
  const [facilityStages, setFacilityStages] = useState<FacilityStage[]>([]);
  const [createStageModal, setCreateStageModal] = useState<boolean>(false);
  const [newStageName, setNewStageName] = useState<string>('');
  const [nextStageModal, setNextStageModal] = useState<Order | null>(null);
  const [reorderStageModal, setReorderStageModal] = useState<boolean>(false);
  const [localFacilityStages, setLocalFacilityStages] = useState<FacilityStage[]>([]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    try { 
      let data = [];
      if (user.appRole === 'FACILITY') {
        data = await getFacilityOrders(user.companyId);
        const stagesData = await getFacilityStages(user.companyId);
        setFacilityStages(stagesData || []);
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
    if (nextStatus === 'PICKED_UP') {
      setDeadlineOrder({ id: orderId, nextStatus });
      return;
    }

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
      const orderToComplete = orders.find(o => o.id === orderId);
      if (orderToComplete) {
         setReceivedAmount(String(orderToComplete.totalAmount || ''));
         setCompleteOrderModal(orderToComplete);
      }
    } else {
      doUpdate();
    }
  };

  const handleAutoNextStage = async (orderId: string, currentStatus: string, currentFacilityStageId?: string | null) => {
      const STAGES = [
         { id: 'AT_FACILITY', isDynamic: false },
         { id: 'WASHING', isDynamic: false },
         { id: 'DRYING', isDynamic: false },
         { id: 'FINISHED', isDynamic: false },
         ...facilityStages.map(s => ({ id: s.id, isDynamic: true })),
         { id: 'READY_FOR_DELIVERY', isDynamic: false }
      ];

      let currentIndex = currentFacilityStageId ? STAGES.findIndex(s => s.id === currentFacilityStageId) : STAGES.findIndex(s => s.id === currentStatus);
      if (currentIndex === -1) currentIndex = 0;
      
      const nextStage = STAGES[currentIndex + 1];
      if (!nextStage) return;

      try {
         setUpdatingId(orderId);
         if (nextStage.isDynamic) {
             await updateOrderStatus(orderId, currentStatus, undefined, undefined, nextStage.id);
         } else {
             await updateOrderStatus(orderId, nextStage.id, undefined, undefined, ""); 
         }
         await loadOrders();
      } catch (e: any) { Alert.alert("Xato", e.message); } 
      finally { setUpdatingId(null); }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#10b981" /></View>;
  }

  const DYNAMIC_FILTERS = facilityStages.map(s => ({ key: s.id, label: s.name, icon: s.icon }));

  const FACILITY_FILTERS: any[] = [
     { key: 'ALL', label: 'Barchasi', icon: 'list' },
     { key: 'AT_FACILITY', label: 'Sexga tushgan', icon: 'business' },
     { key: 'WASHING', label: 'Yuvilmoqda', icon: 'water' },
     { key: 'DRYING', label: 'Quritilmoqda', icon: 'sunny' },
     { key: 'FINISHED', label: 'Pardozda', icon: 'sparkles' },
     ...DYNAMIC_FILTERS
  ];

  const DRIVER_FILTERS = [
     { key: 'ALL', label: 'Barchasi', icon: 'list' },
     { key: 'NEW', label: 'Yangi ishlar', icon: 'flash' },
     { key: 'DRIVER_ASSIGNED', label: 'Olib kelish', icon: 'car' },
     { key: 'READY_FOR_DELIVERY', label: 'Yetkazish', icon: 'cube' },
     { key: 'OUT_FOR_DELIVERY', label: 'Yo\'lda', icon: 'navigate' },
  ];

  const currentFilters: any[] = user?.appRole === 'FACILITY' ? FACILITY_FILTERS : DRIVER_FILTERS;
  const filteredOrders = filterStatus === 'ALL' 
     ? orders 
     : orders.filter(o => 
         facilityStages.find(s => s.id === filterStatus) 
           ? o.facilityStageId === filterStatus 
           : o.status === filterStatus
       );

  return (
    <View style={styles.container}>

      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 }}>
         <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {currentFilters.map(f => {
               const isActive = filterStatus === f.key;
               return (
                  <TouchableOpacity 
                     key={f.key}
                     activeOpacity={0.7}
                     onPress={() => setFilterStatus(f.key)}
                     onLongPress={() => {
                        if (user?.appRole !== 'FACILITY' || f.key === 'ALL' || ['AT_FACILITY', 'WASHING', 'DRYING', 'FINISHED'].includes(f.key)) return;
                        Alert.alert("Bo'limni o'chirish", `"${f.label}" bo'limini o'chirmoqchimisiz?`, [
                           {text: 'Bekor qilish', style: 'cancel'},
                           {text: "O'chirish", style: 'destructive', onPress: async () => {
                               try {
                                  await deleteFacilityStage(f.key);
                                  loadOrders();
                               } catch(e:any) { Alert.alert('Xato', e.message) }
                           }}
                        ])
                     }}
                     style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: isActive ? '#10b981' : 'rgba(255,255,255,0.05)',
                        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                        borderWidth: 1, borderColor: isActive ? '#10b981' : 'rgba(255,255,255,0.1)'
                     }}
                  >
                     <Ionicons name={f.icon as any} size={16} color={isActive ? '#064e3b' : '#a1a1aa'} />
                     <Text style={{ color: isActive ? '#064e3b' : '#a1a1aa', fontSize: 14, fontWeight: '700' }}>
                        {f.label}
                     </Text>
                  </TouchableOpacity>
               )
            })}
            
            {user?.appRole === 'FACILITY' && (
               <>
                  <TouchableOpacity 
                     activeOpacity={0.7}
                     onPress={() => setCreateStageModal(true)}
                     style={{
                        flexDirection: 'row', alignItems: 'center', gap: 6,
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                        borderWidth: 1, borderColor: '#10b981', borderStyle: 'dashed'
                     }}
                  >
                     <Ionicons name="add" size={18} color="#10b981" />
                     <Text style={{ color: '#10b981', fontSize: 13, fontWeight: '700' }}>Bo'lim qo'shish</Text>
                  </TouchableOpacity>
                  
                  {facilityStages.length > 0 && (
                     <TouchableOpacity 
                        activeOpacity={0.7}
                        onPress={() => { setLocalFacilityStages(facilityStages); setReorderStageModal(true); }}
                        style={{
                           flexDirection: 'row', alignItems: 'center', gap: 6,
                           backgroundColor: 'rgba(255, 255, 255, 0.05)',
                           paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20,
                           borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)'
                        }}
                     >
                        <Ionicons name="swap-vertical" size={18} color="#a1a1aa" />
                        <Text style={{ color: '#a1a1aa', fontSize: 13, fontWeight: '700' }}>Tartiblash</Text>
                     </TouchableOpacity>
                  )}
               </>
            )}
         </ScrollView>
      </View>

      <FlatList
        data={filteredOrders}
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
              style={styles.cardPremium} 
              activeOpacity={0.7}
              onPress={() => setSelectedOrder(item)}
            >
              <View style={styles.cardHeaderPremium}>
                 <View style={styles.customerBlockPremium}>
                    <Text style={styles.cNamePremium} numberOfLines={1}>
                       {item.customer?.fullName || 'Noma\'lum shaxs'} <Text style={styles.cIdPremium}> #{item.id.substring(0, 5)}</Text>
                    </Text>
                 </View>
                 <View style={styles.statusBadgePremium}>
                    <Text style={styles.statusBadgeTextPremium}>{config.emoji} {config.label}</Text>
                 </View>
              </View>
              
              <View style={styles.cardBodyInline}>
                 {item.items && item.items.length > 0 && (
                    <View style={styles.cardItemsInline}>
                       <Ionicons name="layers-outline" size={13} color="#10b981" style={{marginRight: 6}} />
                       <Text style={styles.itemsInlineText} numberOfLines={1}>
                          {item.items.map(i => `${i.service?.name} (${i.quantity}${i.service?.measurementUnit ? i.service.measurementUnit : ''})`).join(', ')}
                       </Text>
                    </View>
                 )}

                 {user?.appRole !== 'FACILITY' && item.customer?.address && (
                   <View style={styles.cardItemsInline}>
                      <Ionicons name="location-outline" size={13} color="#a1a1aa" style={{marginRight: 6}} />
                      <Text style={styles.itemsInlineText} numberOfLines={1}>
                         {item.customer.address}
                      </Text>
                   </View>
                 )}

                 {item.notes && (
                    <View style={styles.noteInline}>
                       <Ionicons name="chatbox-ellipses-outline" size={13} color="#facc15" style={{marginRight: 6}} />
                       <Text style={styles.noteInlineText} numberOfLines={1}>{item.notes}</Text>
                    </View>
                 )}
              </View>

              <View style={styles.cardFooterInline}>
                 <Text style={styles.metaTextInline}>📦 {item.items?.length || 0} xil tur</Text>
                 <View style={styles.actionArrowInline}>
                    <Text style={styles.actionArrowTextInline}>Batafsil</Text>
                    <Ionicons name="chevron-forward" size={12} color="#10b981" />
                 </View>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      {/* Deadline Picker Modal */}
      <Modal visible={!!deadlineOrder} transparent animationType="slide">
         {deadlineOrder && (
           <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { height: '55%' }]}>
                 <Text style={styles.modalTitle}>Necha kunda tayyor bo'ladi?</Text>
                 <Text style={{color: '#a1a1aa', marginTop: 8, marginBottom: 24, lineHeight: 20}}>Mijozga va'da qilingan kunni tanlang. Muddat yaqinlashganda sex xodimlariga avtomatik ogohlantirish boradi.</Text>
                 
                 <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center'}}>
                    {[1, 2, 3, 4, 5, 6].map(days => (
                       <TouchableOpacity 
                         key={days}
                         style={{ backgroundColor: '#27272a', paddingVertical: 16, borderRadius: 16, width: '30%', alignItems: 'center', borderWidth: 1, borderColor: '#3f3f46' }}
                         onPress={async () => {
                            const date = new Date();
                            date.setDate(date.getDate() + days);
                            setUpdatingId(deadlineOrder.id);
                            setDeadlineOrder(null);
                            try {
                               await updateOrderStatus(deadlineOrder.id, deadlineOrder.nextStatus, undefined, date.toISOString());
                               await loadOrders();
                            } catch (err: any) {
                               Alert.alert('Xatolik', err.message);
                            } finally {
                               setUpdatingId(null);
                            }
                         }}
                       >
                         <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{days} kun</Text>
                       </TouchableOpacity>
                    ))}
                 </View>

                 <TouchableOpacity 
                   style={[styles.mainBtn, { backgroundColor: '#3f3f46', marginTop: 24 }]} 
                   onPress={() => setDeadlineOrder(null)}
                 >
                   <Text style={[styles.mainBtnText, { color: '#fff' }]}>Bekor qilish</Text>
                 </TouchableOpacity>
              </View>
           </View>
         )}
      </Modal>

      {/* Complete Order Modal (Kirim qabul qilish) */}
      <Modal visible={!!completeOrderModal} transparent animationType="slide">
         {completeOrderModal && (
            <View style={styles.modalOverlay}>
               <View style={[styles.modalContent, { height: 'auto', paddingBottom: 40 }]}>
                  <Text style={styles.modalTitle}>Yetkazib Berish & To'lov</Text>
                  <Text style={{color: '#a1a1aa', marginTop: 8, marginBottom: 24, lineHeight: 20}}>
                     Gilamlar mijozga yetkazib berildimi? Shu joyning o'zida qabul qilib olgan pulingizni kiriting va u avtomatik tarzda "Kirim" xisobiga o'tadi.
                  </Text>

                  <View style={styles.mRow}>
                     <Text style={styles.mLabel}>Hisoblangan haq:</Text>
                     <Text style={[styles.mValue, {color: '#3b82f6', fontSize: 18, fontWeight: '900'}]}>
                        {Number(completeOrderModal.totalAmount || 0).toLocaleString()} so'm
                     </Text>
                  </View>

                  <View style={{marginTop: 16, marginBottom: 32}}>
                     <Text style={{color: '#d4d4d8', fontSize: 13, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1}}>Qabul Qilingan Pul</Text>
                     <View style={{flexDirection: 'row', alignItems: 'center', backgroundColor: '#27272a', borderRadius: 16, borderWidth: 1, borderColor: '#3f3f46', paddingHorizontal: 16}}>
                        <Text style={{fontSize: 24, fontWeight: '800', color: '#10b981', marginRight: 8}}>+</Text>
                        <TextInput 
                           style={{flex: 1, color: '#fff', fontSize: 24, fontWeight: '800', paddingVertical: 16}}
                           placeholder="0"
                           placeholderTextColor="#52525b"
                           keyboardType="numeric"
                           value={receivedAmount}
                           onChangeText={setReceivedAmount}
                        />
                        <Text style={{color: '#71717a', fontSize: 16, fontWeight: '700'}}>so'm</Text>
                     </View>
                  </View>
                  
                  <View style={{flexDirection: 'row', gap: 12}}>
                     <TouchableOpacity 
                       style={[styles.mainBtn, { backgroundColor: '#3f3f46', flex: 1, height: 56 }]} 
                       onPress={() => setCompleteOrderModal(null)}
                     >
                       <Text style={[styles.mainBtnText, { color: '#fff' }]}>Bekor qilish</Text>
                     </TouchableOpacity>

                     <TouchableOpacity 
                       style={[styles.mainBtn, { flex: 1.5, height: 56, backgroundColor: '#3b82f6' }]} 
                       onPress={async () => {
                          if (!receivedAmount) {
                             Alert.alert('Xatolik', 'Olingan summani kiriting (agar olinmagan bo\'lsa 0 kiriting).');
                             return;
                          }
                          setUpdatingId(completeOrderModal.id);
                          const amnt = Number(receivedAmount);
                          try {
                             await updateOrderStatus(completeOrderModal.id, 'DELIVERED');
                             
                             if (amnt > 0) {
                               // also import createExpense from api.ts
                               const { createExpense } = require('../../lib/api');
                               await createExpense({
                                  companyId: user!.companyId,
                                  userId: user!.id,
                                  orderId: completeOrderModal.id,
                                  title: 'Mijozdan to\'lov (Buyurtma)',
                                  amount: amnt,
                                  type: 'INCOME',
                                  category: 'Logistika',
                                  comment: `Kirim: Haydovchi mobil ilovasidan qo'shildi. Buyurtma ID: ${completeOrderModal.id}`,
                                  date: new Date().toISOString().split('T')[0]
                               });
                             }

                             setCompleteOrderModal(null);
                             setSelectedOrder(null);
                             await loadOrders();
                             Alert.alert('Muvaffaqiyatli', amnt > 0 ? 'Buyurtma yetkazildi va To\'lov olinganligi tasdiqlandi!' : 'Buyurtma yetkazildi.');
                          } catch (err: any) {
                             Alert.alert('Xatolik', err.message);
                          } finally {
                             setUpdatingId(null);
                          }
                       }}
                     >
                       {updatingId === completeOrderModal.id ? <ActivityIndicator color="#fff" /> : <Text style={[styles.mainBtnText, {color: '#fff'}]}>Yetkazildi</Text>}
                     </TouchableOpacity>
                  </View>
               </View>
            </View>
         )}
      </Modal>

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
                    
                     <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 }}>
                        <View>
                           <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>Buyurtma</Text>
                           <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>#{selectedOrder.id.substring(0, 8)}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                           <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 0.5 }}>Sana</Text>
                           <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{new Date(selectedOrder.createdAt).toLocaleDateString('uz-UZ')}</Text>
                        </View>
                     </View>

                     <View style={{ backgroundColor: 'rgba(39, 39, 42, 0.4)', borderRadius: 20, padding: 20, marginBottom: 24 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                           <View style={{ flex: 1, paddingRight: 10 }}>
                              <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Mijoz</Text>
                              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: -0.5 }}>{selectedOrder.customer?.fullName}</Text>
                              <Text style={{ color: '#a1a1aa', fontSize: 14, marginTop: 4, fontWeight: '500' }}>{selectedOrder.customer?.phone1}</Text>
                           </View>

                           {user?.appRole !== 'FACILITY' && selectedOrder.customer && (
                              <View style={{ flexDirection: 'row', gap: 12 }}>
                                 <TouchableOpacity 
                                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' }}
                                    onPress={() => Linking.openURL(`tel:${selectedOrder.customer!.phone1}`)}
                                 >
                                    <Ionicons name="call" size={20} color="#10b981" />
                                 </TouchableOpacity>
                                 <TouchableOpacity 
                                    style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(56, 189, 248, 0.1)', justifyContent: 'center', alignItems: 'center' }}
                                    onPress={() => Linking.openURL(`https://yandex.uz/maps/?text=${selectedOrder.customer!.address!}`)}
                                 >
                                    <Ionicons name="navigate" size={20} color="#38bdf8" />
                                 </TouchableOpacity>
                              </View>
                           )}
                        </View>

                        {selectedOrder.notes ? (
                           <View style={{ marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(255, 255, 255, 0.05)' }}>
                              <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 }}>Izohlar</Text>
                              <Text style={{ color: '#facc15', fontSize: 14, fontStyle: 'italic', fontWeight: '500', lineHeight: 20 }}>"{selectedOrder.notes}"</Text>
                           </View>
                        ) : null}
                     </View>

                     <View style={{ marginBottom: 24 }}>
                        <Text style={{ color: '#71717a', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 12, letterSpacing: 0.5 }}>Tarkibiy Qismlar</Text>
                        
                        {(!selectedOrder.items || selectedOrder.items.length === 0) ? (
                            <Text style={styles.emptyItems}>Hozircha narsalar kiritilmagan.</Text>
                        ) : (
                           selectedOrder.items.map((it, idx) => (
                              <View key={it.id || idx} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: idx === selectedOrder.items!.length - 1 ? 0 : 1, borderBottomColor: 'rgba(255, 255, 255, 0.05)' }}>
                                 
                                 <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255, 255, 255, 0.03)', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                                    <Ionicons name="layers" size={20} color="#a1a1aa" />
                                 </View>

                                 <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 2 }} numberOfLines={1}>
                                       {it.service?.name || 'Xizmat turi mavjud emas'}
                                    </Text>
                                    <Text style={{ color: '#71717a', fontSize: 12, fontWeight: '500' }}>
                                       {it.quantity} {it.service?.measurementUnit || 'kv.m'}
                                       {(it.width && it.length) ? `   •   ${it.width} x ${it.length}` : ''}
                                    </Text>
                                 </View>

                                 {user?.appRole !== 'FACILITY' ? (
                                   <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                      <TextInput 
                                          style={{ color: '#10b981', fontSize: 16, fontWeight: '800', textAlign: 'right', minWidth: 46, paddingVertical: 4, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: 'rgba(16, 185, 129, 0.3)' }}
                                          placeholder="0"
                                          placeholderTextColor="#3f3f46"
                                          keyboardType="numeric"
                                          defaultValue={it.totalPrice && Number(it.totalPrice) > 0 ? String(it.totalPrice) : ''}
                                          onEndEditing={async (e) => {
                                             const num = Number(e.nativeEvent.text);
                                             if (num >= 0 && it.id) {
                                                try { 
                                                   const { updateItemPrice } = require('../../lib/api');
                                                   await updateItemPrice(it.id, num); 
                                                   loadOrders();
                                                } catch (err: any) { Alert.alert('Xato', err.message || 'Narx saqlanmadi'); }
                                             }
                                          }}
                                      />
                                      <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '700', opacity: 0.8, marginLeft: 4, marginTop: 4 }}>so'm</Text>
                                   </View>
                                 ) : (
                                    <Text style={{ color: '#10b981', fontSize: 15, fontWeight: '800' }}>
                                       {Number(it.totalPrice || 0).toLocaleString()} <Text style={{ fontSize: 12, fontWeight: '600', opacity: 0.8 }}>so'm</Text>
                                    </Text>
                                 )}
                              </View>
                           ))
                        )}
                     </View>

                     <View style={{ height: 24 }} />
                     
                     {user?.appRole === 'FACILITY' ? (
                        <TouchableOpacity 
                          style={styles.mainBtn} 
                          activeOpacity={0.8} 
                          onPress={() => {
                             handleAutoNextStage(selectedOrder.id, selectedOrder.status, (selectedOrder as any).facilityStage?.id || null);
                             setSelectedOrder(null);
                          }}
                        >
                          {updatingId === selectedOrder.id ? <ActivityIndicator color="#09090b" /> : <Text style={styles.mainBtnText}>Keyingi bo'limga o'tkazish ➡️</Text>}
                        </TouchableOpacity>
                     ) : (
                        STATUS_CONFIG[selectedOrder.status]?.next && (
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
                        )
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

      {/* CREATE STAGE MODAL */}
      <Modal visible={createStageModal} animationType="fade" transparent>
         <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
            <View style={{ backgroundColor: '#18181b', borderRadius: 24, padding: 24, width: '100%', borderWidth: 1, borderColor: '#27272a' }}>
               <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800', marginBottom: 16 }}>Yangi bo'lim qo'shish</Text>
               <TextInput 
                  style={{ backgroundColor: '#09090b', color: '#fff', borderRadius: 12, padding: 16, fontSize: 16, borderWidth: 1, borderColor: '#27272a', marginBottom: 16 }}
                  placeholder="Masalan: Pardozlash, Qadoqlash..."
                  placeholderTextColor="#71717a"
                  value={newStageName}
                  onChangeText={setNewStageName}
               />
               <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#27272a', alignItems: 'center' }} onPress={() => { setCreateStageModal(false); setNewStageName(''); }}>
                     <Text style={{ color: '#fff', fontWeight: '700' }}>Bekor qilish</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={{ flex: 1, padding: 16, borderRadius: 12, backgroundColor: '#10b981', alignItems: 'center' }}
                    onPress={async () => {
                       if (!newStageName.trim() || !user?.companyId) return;
                       try {
                          await createFacilityStage(user.companyId, newStageName, 'folder');
                          setCreateStageModal(false);
                          setNewStageName('');
                          loadOrders();
                       } catch (e: any) { Alert.alert("Xato", e.message); }
                    }}
                  >
                     <Text style={{ color: '#064e3b', fontWeight: '800' }}>Qo'shish</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* REORDER STAGES MODAL */}
      <Modal visible={reorderStageModal} animationType="slide" transparent>
         <View style={styles.modalOverlay}>
            <View style={{...styles.modalContent, height: '70%'}}>
               <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Bo'limlarni Tariblash</Text>
                  <TouchableOpacity onPress={() => setReorderStageModal(false)} style={styles.closeBtn}>
                     <Ionicons name="close" size={20} color="#ffffff" />
                  </TouchableOpacity>
               </View>
               <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
                  <Text style={{ color: '#71717a', fontSize: 13, marginBottom: 16 }}>Siz yasagan maxsus bo'limlar shu tartibda ketma-ketlikda o'tadi:</Text>
                  
                  {localFacilityStages.map((stage, idx) => (
                     <View 
                        key={stage.id} 
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#09090b', padding: 12, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: '#27272a' }}
                     >
                        <Ionicons name={stage.icon as any || 'folder'} size={24} color="#10b981" style={{ marginRight: 12 }} />
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 }}>{stage.name}</Text>
                        
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                           <TouchableOpacity 
                              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center', opacity: idx === 0 ? 0.3 : 1 }}
                              disabled={idx === 0}
                              onPress={() => {
                                 const copy = [...localFacilityStages];
                                 const temp = copy[idx-1];
                                 copy[idx-1] = copy[idx];
                                 copy[idx] = temp;
                                 setLocalFacilityStages(copy);
                              }}
                           >
                              <Ionicons name="arrow-up" size={18} color="#fff" />
                           </TouchableOpacity>
                           <TouchableOpacity 
                              style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: '#27272a', justifyContent: 'center', alignItems: 'center', opacity: idx === localFacilityStages.length - 1 ? 0.3 : 1 }}
                              disabled={idx === localFacilityStages.length - 1}
                              onPress={() => {
                                 const copy = [...localFacilityStages];
                                 const temp = copy[idx+1];
                                 copy[idx+1] = copy[idx];
                                 copy[idx] = temp;
                                 setLocalFacilityStages(copy);
                              }}
                           >
                              <Ionicons name="arrow-down" size={18} color="#fff" />
                           </TouchableOpacity>
                        </View>
                     </View>
                  ))}
               </ScrollView>
               <TouchableOpacity 
                  style={{ ...styles.mainBtn, marginBottom: 20 }}
                  onPress={async () => {
                     try {
                        await reorderFacilityStages(user?.companyId as string, localFacilityStages.map(s => s.id));
                        setReorderStageModal(false);
                        loadOrders();
                     } catch(e:any) { Alert.alert('Xato', e.message); }
                  }}
               >
                  <Text style={styles.mainBtnText}>Tartibni Saqlash</Text>
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

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
  mainBtn: { backgroundColor: '#10b981', height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  mainBtnText: { color: '#064e3b', fontSize: 15, fontWeight: '800', letterSpacing: 0.2 },
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

  cardPremium: { backgroundColor: '#18181b', borderRadius: 18, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#27272a' },
  cardHeaderPremium: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  customerBlockPremium: { flex: 1, marginRight: 8 },
  cNamePremium: { color: '#ffffff', fontSize: 16, fontWeight: '700', letterSpacing: -0.3 },
  cIdPremium: { color: '#71717a', fontSize: 13, fontWeight: '500', marginLeft: 6 },
  statusBadgePremium: { backgroundColor: 'rgba(16, 185, 129, 0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusBadgeTextPremium: { color: '#10b981', fontSize: 11, fontWeight: '800' },
  cardBodyInline: { marginBottom: 12, gap: 6 },
  cardItemsInline: { flexDirection: 'row', alignItems: 'center' },
  itemsInlineText: { color: '#a1a1aa', fontSize: 13, fontWeight: '500', flex: 1 },
  noteInline: { flexDirection: 'row', alignItems: 'center' },
  noteInlineText: { color: '#facc15', fontSize: 13, fontWeight: '600', flex: 1 },
  cardFooterInline: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  metaTextInline: { color: '#71717a', fontSize: 12, fontWeight: '600' },
  actionArrowInline: { flexDirection: 'row', alignItems: 'center' },
  actionArrowTextInline: { color: '#10b981', fontSize: 12, fontWeight: '700', marginRight: 2 },

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
