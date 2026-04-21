import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator,
  Keyboard, StatusBar, Animated,
} from 'react-native';
import { useAuth } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter, useLocalSearchParams } from 'expo-router';
import io, { Socket } from 'socket.io-client';
import { getToken, request, API_URL } from '../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatMessage {
  id?: string;
  localId?: string;
  text: string;
  senderId: string;
  recipientId?: string;
  createdAt: string;
  pending?: boolean;
}

const WS_URL = API_URL.replace('/api', '');

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useLocalSearchParams<{ operatorId?: string; companyId?: string }>();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [operatorId, setOperatorId] = useState<string | null>(params.operatorId || null);
  const [operatorName, setOperatorName] = useState('Operator');
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);
  const sendBtnScale = useRef(new Animated.Value(1)).current;

  // ── Keyboard listener ────────────────────────────────────────────────────
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // ── Chat init ────────────────────────────────────────────────────────────
  useEffect(() => {
    let socket: Socket;

    async function initChat() {
      try {
        const token = await getToken();
        if (!token || !user) return;

        // 1. Support-contact ni olamiz (agar params da operatorId yo'q bo'lsa)
        let opId = operatorId;
        if (!opId) {
          const support = await request<any>('/messages/support-contact');
          if (support?.id) {
            opId = support.id;
            setOperatorId(support.id);
            if (support.fullName) setOperatorName(support.fullName);
          }
        } else {
          // Operator nomini olish
          try {
            const hist = await request<any[]>(`/messages/history/${opId}`);
            if (hist?.length > 0) {
              const opMsg = hist.find(m => m.senderId === opId);
              if (opMsg?.sender?.fullName) setOperatorName(opMsg.sender.fullName);
            }
          } catch (_) {}
        }

        if (!opId) { setLoading(false); return; }

        // 2. Tarix yuklash
        const history = await request<ChatMessage[]>(`/messages/history/${opId}`);
        setMessages(history || []);
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 300);

        // 3. WebSocket ulanish
        socket = io(`${WS_URL}/chat`, {
          query: { token },
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 10,
          reconnectionDelay: 1500,
          timeout: 10000,
        });
        socketRef.current = socket;

        socket.on('connect', () => {
          console.log('[Chat] ✅ Connected:', socket.id);
          setConnected(true);
        });

        socket.on('disconnect', (reason) => {
          console.log('[Chat] ❌ Disconnected:', reason);
          setConnected(false);
        });

        socket.on('connect_error', (err) => {
          console.warn('[Chat] Connect error:', err.message);
          setConnected(false);
        });

        // Operator → haydovchiga kelgan xabar
        socket.on('newMessage', (msg: ChatMessage) => {
          console.log('[Chat] newMessage:', msg.senderId, msg.text?.substring(0, 20));
          setMessages(prev => {
            if (prev.some(m => m.id && m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
        });

        // Haydovchi yuborgan xabarning DB tasdiqi
        socket.on('messageSent', (msg: ChatMessage) => {
          console.log('[Chat] messageSent confirmed:', msg.id);
          setMessages(prev => {
            // Faqat bitta eng oxirgi pending localId xabarni almashtir
            let replaced = false;
            return prev.map(m => {
              if (!replaced && m.localId && m.pending) {
                replaced = true;
                return { ...msg, pending: false };
              }
              return m;
            });
          });
        });

      } catch (e) {
        console.warn('[Chat] Init error:', e);
      } finally {
        setLoading(false);
      }
    }

    initChat();
    return () => { socket?.disconnect(); };
  }, []);

  // ── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !operatorId || !socketRef.current?.connected) return;

    // Send button animation
    Animated.sequence([
      Animated.timing(sendBtnScale, { toValue: 0.85, duration: 80, useNativeDriver: true }),
      Animated.timing(sendBtnScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();

    const localId = `local-${Date.now()}`;
    const optimistic: ChatMessage = {
      localId,
      text,
      senderId: user?.id || '',
      recipientId: operatorId,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages(prev => [...prev, optimistic]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

    socketRef.current.emit('sendMessage', {
      text,
      recipientId: operatorId,
      companyId: user?.companyId || null,
    });
  }, [inputText, operatorId, user]);

  // ── Render ───────────────────────────────────────────────────────────────
  const renderMessage = useCallback(({ item, index }: { item: ChatMessage; index: number }) => {
    const isMe = item.senderId === user?.id;
    const time = new Date(item.createdAt).toLocaleTimeString('uz-UZ', {
      hour: '2-digit', minute: '2-digit',
    });

    // Date divider — kun o'zgarganda ko'rsatish
    const prevItem = messages[index - 1];
    const showDate = !prevItem ||
      new Date(item.createdAt).toDateString() !== new Date(prevItem.createdAt).toDateString();

    const today = new Date().toDateString();
    const msgDate = new Date(item.createdAt).toDateString();
    const dateLabel = msgDate === today
      ? 'Bugun'
      : new Date(item.createdAt).toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long' });

    return (
      <>
        {showDate && (
          <View style={s.dateDivider}>
            <Text style={s.dateDividerText}>{dateLabel}</Text>
          </View>
        )}
        <View style={[s.msgRow, isMe ? s.msgRight : s.msgLeft]}>
          {!isMe && (
            <View style={s.avatarSmall}>
              <Ionicons name="headset" size={12} color="#10b981" />
            </View>
          )}
          <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleThem]}>
            {!isMe && <Text style={s.senderName}>{operatorName}</Text>}
            <Text style={[s.msgText, { color: isMe ? '#fff' : '#e4e4e7' }]}>
              {item.text}
            </Text>
            <View style={s.timeRow}>
              <Text style={[s.timeText, { color: isMe ? 'rgba(255,255,255,0.55)' : '#52525b' }]}>
                {time}
              </Text>
              {isMe && (
                <Ionicons
                  name={item.pending ? 'checkmark' : 'checkmark-done'}
                  size={13}
                  color={item.pending ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.6)'}
                  style={{ marginLeft: 3 }}
                />
              )}
            </View>
          </View>
        </View>
      </>
    );
  }, [messages, user, operatorName]);

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor="#111113" />
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={s.headerCenter}>
          <View style={s.headerAvatarWrap}>
            <Ionicons name="headset" size={17} color="#10b981" />
            {connected && <View style={s.onlineDot} />}
          </View>
          <View>
            <Text style={s.headerName}>{operatorName}</Text>
            <Text style={[s.headerStatus, { color: connected ? '#10b981' : '#f59e0b' }]}>
              {connected ? 'Onlayn' : 'Ulanmoqda...'}
            </Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#10b981" size="large" />
          <Text style={s.loadingText}>Yuklanmoqda...</Text>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={s.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, i) => item.id || item.localId || String(i)}
            contentContainerStyle={[s.list, messages.length === 0 && s.listEmpty]}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={s.emptyBox}>
                <View style={s.emptyIconBox}>
                  <Ionicons name="chatbubbles-outline" size={44} color="#10b981" />
                </View>
                <Text style={s.emptyTitle}>Suhbatni boshlang!</Text>
                <Text style={s.emptyDesc}>
                  Savollaringizni yozing, operator{'\n'}tez orada javob beradi
                </Text>
              </View>
            }
            renderItem={renderMessage}
          />

          {/* ── Input bar ── */}
          <View style={[s.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={s.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Xabar yozing..."
              placeholderTextColor="#52525b"
              multiline
              maxLength={1000}
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={sendMessage}
            />
            <Animated.View style={{ transform: [{ scale: sendBtnScale }] }}>
              <TouchableOpacity
                style={[s.sendBtn, !inputText.trim() && s.sendBtnOff]}
                onPress={sendMessage}
                disabled={!inputText.trim() || !operatorId}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="send"
                  size={17}
                  color={inputText.trim() ? '#09090b' : '#3f3f46'}
                  style={{ marginLeft: 1 }}
                />
              </TouchableOpacity>
            </Animated.View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0c0c0f' },
  flex: { flex: 1 },

  // Header
  header: {
    backgroundColor: '#111113',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1f1f23',
    gap: 12,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 13,
    backgroundColor: '#1a1a1e',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: '#2a2a2e',
  },
  headerCenter: { flexDirection: 'row', alignItems: 'center', gap: 11, flex: 1 },
  headerAvatarWrap: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: 'rgba(16,185,129,0.08)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(16,185,129,0.25)',
  },
  onlineDot: {
    position: 'absolute', bottom: 1, right: 1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#10b981',
    borderWidth: 2, borderColor: '#111113',
  },
  headerName: { color: '#fff', fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  headerStatus: { fontSize: 12, fontWeight: '600', marginTop: 1 },

  // Loading
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { color: '#52525b', fontSize: 14 },

  // List
  list: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 8 },
  listEmpty: { flex: 1, justifyContent: 'flex-end' },

  // Empty
  emptyBox: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 60, gap: 12 },
  emptyIconBox: {
    width: 88, height: 88, borderRadius: 28,
    backgroundColor: 'rgba(16,185,129,0.07)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.15)',
    marginBottom: 4,
  },
  emptyTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  emptyDesc: { color: '#52525b', fontSize: 14, textAlign: 'center', lineHeight: 21 },

  // Date divider
  dateDivider: { alignItems: 'center', marginVertical: 14 },
  dateDividerText: {
    backgroundColor: '#1a1a1e',
    color: '#71717a',
    fontSize: 11, fontWeight: '600',
    paddingHorizontal: 12, paddingVertical: 4,
    borderRadius: 10, letterSpacing: 0.4,
  },

  // Messages
  msgRow: { flexDirection: 'row', alignItems: 'flex-end', marginBottom: 4 },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start', gap: 7 },
  avatarSmall: {
    width: 28, height: 28, borderRadius: 10,
    backgroundColor: 'rgba(16,185,129,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(16,185,129,0.2)',
    marginBottom: 2,
  },

  bubble: {
    paddingHorizontal: 13, paddingVertical: 9,
    borderRadius: 18, maxWidth: '80%',
  },
  bubbleMe: {
    backgroundColor: '#10b981',
    borderBottomRightRadius: 5,
  },
  bubbleThem: {
    backgroundColor: '#1a1a1e',
    borderBottomLeftRadius: 5,
    borderWidth: 1, borderColor: '#28282c',
  },
  senderName: {
    color: '#10b981', fontSize: 11, fontWeight: '700',
    marginBottom: 3, letterSpacing: 0.2,
  },
  msgText: { fontSize: 15, lineHeight: 22 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  timeText: { fontSize: 10.5, fontWeight: '500' },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    paddingHorizontal: 14, paddingTop: 10,
    backgroundColor: '#111113',
    borderTopWidth: 1, borderTopColor: '#1f1f23',
    alignItems: 'flex-end', gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#1a1a1e',
    color: '#fff',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 11, paddingBottom: 11,
    minHeight: 44, maxHeight: 110,
    fontSize: 15,
    borderWidth: 1, borderColor: '#2a2a2e',
    lineHeight: 20,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#10b981',
    justifyContent: 'center', alignItems: 'center',
  },
  sendBtnOff: { backgroundColor: '#1e1e22' },
});
