import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard,
} from 'react-native';
import { useAuth } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import io, { Socket } from 'socket.io-client';
import { getToken, request } from '../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ChatMessage {
  id?: string;
  localId?: string; // optimistic placeholder ID
  text: string;
  senderId: string;
  recipientId?: string;
  createdAt: string;
  pending?: boolean; // true until server confirms
}

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState('Operator');
  const [loading, setLoading] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  useEffect(() => {
    async function initChat() {
      try {
        const token = await getToken();
        if (!token) return;

        // Fetch support contact (operator/admin for this company)
        const supportReq = await request<any>('/messages/support-contact');
        if (supportReq && supportReq.id) {
          setOperatorId(supportReq.id);
          if (supportReq.fullName) setOperatorName(supportReq.fullName);

          // Fetch message history
          const hist = await request<ChatMessage[]>(`/messages/history/${supportReq.id}`);
          setMessages(hist || []);
        }

        // Connect to chat namespace
        const socket = io('wss://gilam-api.ecos.uz/chat', {
          query: { token },
          transports: ['websocket'],
          reconnection: true,
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });
        socketRef.current = socket;

        // Incoming message from the OTHER person (operator → driver)
        socket.on('newMessage', (msg: ChatMessage) => {
          setMessages(prev => {
            // Avoid duplicate if it's our own echo (handled by messageSent)
            const alreadyExists = prev.some(m => m.id && m.id === msg.id);
            if (alreadyExists) return prev;
            return [...prev, msg];
          });
          setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        });

        // Server confirmation — replace optimistic message with DB record
        socket.on('messageSent', (msg: ChatMessage) => {
          setMessages(prev =>
            prev.map(m => {
              // Match by localId (our optimistic placeholder)
              if (m.localId && m.pending) return { ...msg, localId: undefined, pending: false };
              return m;
            }),
          );
        });

        socket.on('connect_error', (err) => {
          console.warn('[Chat] Socket connect error:', err.message);
        });

        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 600);
      } catch (e) {
        console.warn('Chat init error', e);
      } finally {
        setLoading(false);
      }
    }
    initChat();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const sendMessage = useCallback(() => {
    const text = inputText.trim();
    if (!text || !operatorId || !socketRef.current) return;

    // Optimistic local message — shown immediately with pending state
    const localId = `local-${Date.now()}`;
    const optimisticMsg: ChatMessage = {
      localId,
      text,
      senderId: user?.id || '',
      recipientId: operatorId,
      createdAt: new Date().toISOString(),
      pending: true,
    };

    setMessages(prev => [...prev, optimisticMsg]);
    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);

    socketRef.current.emit('sendMessage', {
      text,
      recipientId: operatorId,
      companyId: user?.companyId || null,
    });
  }, [inputText, operatorId, user]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <View style={styles.headerAvatar}>
            <Ionicons name="headset" size={18} color="#10b981" />
          </View>
          <View>
            <Text style={styles.headerTitle}>{operatorName}</Text>
            <Text style={styles.headerSubtitle}>Onlayn yordamchi</Text>
          </View>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color="#10b981" size="large" /></View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item, index) => item.id || item.localId || index.toString()}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
            ListEmptyComponent={
              <View style={styles.centerEmpty}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="chatbubble-ellipses-outline" size={40} color="#10b981" />
                </View>
                <Text style={styles.emptyText}>Xush kelibsiz!</Text>
                <Text style={styles.emptySubText}>
                  Savollaringizni yozing, operator tez orada javob beradi
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id;
              const time = new Date(item.createdAt).toLocaleTimeString('uz-UZ', {
                hour: '2-digit', minute: '2-digit',
              });

              return (
                <View style={[styles.msgRow, isMe ? styles.msgRight : styles.msgLeft]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.msgText, { color: isMe ? '#ffffff' : '#e4e4e7' }]}>
                      {item.text}
                    </Text>
                    <View style={styles.timeRow}>
                      <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.5)' : '#71717a' }]}>
                        {time}
                      </Text>
                      {isMe && (
                        <Ionicons
                          name={item.pending ? 'checkmark' : 'checkmark-done'}
                          size={14}
                          color={item.pending ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.5)'}
                          style={{ marginLeft: 4 }}
                        />
                      )}
                    </View>
                  </View>
                </View>
              );
            }}
          />
          <View style={[styles.inputContainer, { paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Xabar yozing..."
              placeholderTextColor="#71717a"
              multiline
              maxLength={1000}
              onSubmitEditing={sendMessage}
            />
            <TouchableOpacity
              style={[styles.sendBtn, !inputText.trim() && styles.sendBtnDisabled]}
              onPress={sendMessage}
              disabled={!inputText.trim() || !operatorId}
            >
              <Ionicons name="send" size={18} color={inputText.trim() ? '#09090b' : '#71717a'} style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  flex: { flex: 1 },
  header: {
    backgroundColor: '#09090b',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: '#18181b',
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  headerInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerAvatar: {
    width: 40, height: 40, borderRadius: 14,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  headerTitle: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
  headerSubtitle: { color: '#10b981', fontSize: 12, fontWeight: '600', marginTop: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, flexGrow: 1, justifyContent: 'flex-end' },
  centerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 60 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    justifyContent: 'center', alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  emptyText: { color: '#ffffff', fontSize: 18, fontWeight: '700' },
  emptySubText: {
    color: '#71717a', fontSize: 14, marginTop: 8,
    textAlign: 'center', paddingHorizontal: 40, lineHeight: 20,
  },
  msgRow: { marginBottom: 6 },
  msgRight: { alignItems: 'flex-end' },
  msgLeft: { alignItems: 'flex-start' },
  bubble: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 18,
    maxWidth: '82%',
  },
  bubbleMe: {
    backgroundColor: '#10b981',
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: '#18181b',
    borderBottomLeftRadius: 4,
    borderWidth: 1, borderColor: '#27272a',
  },
  msgText: { fontSize: 15, lineHeight: 21 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 4 },
  timeText: { fontSize: 11, fontWeight: '500' },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: '#09090b',
    borderTopWidth: 1,
    borderTopColor: '#27272a',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#18181b',
    color: '#ffffff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
    minHeight: 44,
    maxHeight: 100,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#10b981',
    justifyContent: 'center', alignItems: 'center',
    marginLeft: 10, marginBottom: 0,
  },
  sendBtnDisabled: {
    backgroundColor: '#27272a',
  },
});
