import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import io, { Socket } from 'socket.io-client';
import { getToken, request } from '../lib/api';

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    async function initChat() {
      try {
        const token = await getToken();
        if (!token) return;

        // Fetch Operator ID
        const supportReq = await request<any>('/messages/support-contact');
        if (supportReq && supportReq.id) {
           setOperatorId(supportReq.id);
           // Also fetch history
           const hist = await request<any[]>(`/messages/history/${supportReq.id}`);
           setMessages(hist || []);
        }

        // Connect socket
        const socket = io('wss://gilam-api.ecos.uz/chat', { query: { token } });
        socketRef.current = socket;

        socket.on('newMessage', (msg) => {
          setMessages(prev => [...prev, msg]);
        });
        
        setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 500);

      } catch(e) {
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

  const sendMessage = () => {
    if (!inputText.trim() || !operatorId || !socketRef.current) return;
    
    const payload = {
      text: inputText.trim(),
      recipientId: operatorId,
      companyId: user?.companyId || null
    };

    socketRef.current.emit('sendMessage', payload);
    
    // Add locally immediately for highly responsive UX
    setMessages(prev => [...prev, {
      text: payload.text,
      senderId: user?.id,
      createdAt: new Date().toISOString()
    }]);

    setInputText('');
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{
        title: 'Operator bilan Chat',
        headerStyle: { backgroundColor: '#09090b' },
        headerTintColor: '#ffffff',
        headerLeft: () => (
          <TouchableOpacity onPress={() => router.back()} style={{marginRight: 16}}>
             <Ionicons name="arrow-back" size={24} color="#ffffff" />
          </TouchableOpacity>
        )
      }} />

      {loading ? (
         <View style={styles.center}><ActivityIndicator color="#10b981" size="large"/></View>
      ) : (
        <KeyboardAvoidingView 
           style={styles.container} 
           behavior={Platform.OS === 'ios' ? 'padding' : undefined}
           keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(_, index) => index.toString()}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => listRef.current?.scrollToEnd({animated: true})}
            ListEmptyComponent={
               <View style={styles.centerEmpty}>
                 <Ionicons name="chatbubbles" size={48} color="#27272a" />
                 <Text style={styles.emptyText}>Savollaringizni shu yerga yozing</Text>
               </View>
            }
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id;
              return (
                <View style={[styles.msgRow, isMe ? styles.msgRight : styles.msgLeft]}>
                  <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={[styles.msgText, {color: isMe?'#09090b':'#f4f4f5'}]}>{item.text}</Text>
                    <Text style={[styles.timeText, {color: isMe?'#064e3b':'#71717a'}]}>
                       {new Date(item.createdAt).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})}
                    </Text>
                  </View>
                </View>
              );
            }}
          />

          <View style={styles.inputArea}>
             <TextInput
               style={styles.input}
               value={inputText}
               onChangeText={setInputText}
               placeholder="Xabar yozing..."
               placeholderTextColor="#71717a"
               cursorColor="#10b981"
             />
             <TouchableOpacity style={styles.sendBtn} onPress={sendMessage} disabled={!inputText.trim()}>
                <Ionicons name="send" size={20} color={inputText.trim() ? '#10b981' : '#27272a'} />
             </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#09090b' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, flexGrow: 1, justifyContent: 'flex-end' },
  centerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 60 },
  emptyText: { color: '#71717a', marginTop: 12, fontSize: 14 },
  msgRow: { width: '100%', marginBottom: 16, flexDirection: 'row' },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleMe: { backgroundColor: '#10b981', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#18181b', borderWidth: 1, borderColor: '#27272a', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, fontWeight: '500' },
  timeText: { fontSize: 11, marginTop: 4, alignSelf: 'flex-end', fontWeight: '700' },
  inputArea: { flexDirection: 'row', padding: 12, backgroundColor: '#09090b', borderTopWidth: 1, borderTopColor: '#27272a', alignItems: 'center', paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  input: { flex: 1, minHeight: 48, backgroundColor: '#18181b', borderRadius: 24, paddingHorizontal: 16, color: '#ffffff', fontSize: 15, borderWidth: 1, borderColor: '#27272a', marginRight: 12 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#18181b', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#27272a' }
});
