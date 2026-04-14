import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useAuth } from './_layout';
import { Ionicons } from '@expo/vector-icons';
import { Stack, useRouter } from 'expo-router';
import io, { Socket } from 'socket.io-client';
import { getToken, request } from '../lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ChatScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [operatorId, setOperatorId] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState('Operator');
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
           if (supportReq.fullName) setOperatorName(supportReq.fullName);
           
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
        title: 'Qo\'llab-quvvatlash markazi',
        headerStyle: { backgroundColor: '#111827' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontSize: 18, fontWeight: '600' },
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
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => listRef.current?.scrollToEnd({animated: true})}
            ListEmptyComponent={
               <View style={styles.centerEmpty}>
                 <View style={styles.emptyCircle}>
                    <Ionicons name="chatbubbles-outline" size={48} color="#94a3b8" />
                 </View>
                 <Text style={styles.emptyText}>Xush kelibsiz! Savollaringizni yozing</Text>
                 <Text style={styles.emptySubText}>Operator tez orada javob beradi</Text>
               </View>
            }
            renderItem={({ item }) => {
              const isMe = item.senderId === user?.id;
              
              // Helper to split full name:
              const fName = (item.sender?.fullName || operatorName).split('-')[0].trim();

              return (
                <View style={[styles.msgRow, isMe ? styles.msgRight : styles.msgLeft]}>
                  <View style={{flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start'}}>
                    {!isMe && (
                      <Text style={styles.senderNameLabel}>
                        {fName}
                      </Text>
                    )}
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                      <Text style={[styles.msgText, {color: isMe?'#ffffff':'#f8fafc'}]}>{item.text}</Text>
                      <Text style={[styles.timeText, {color: isMe?'#d1fae5':'#94a3b8'}]}>
                         {new Date(item.createdAt).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
          <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Xabar yozing..."
              placeholderTextColor="#64748b"
              multiline
            />
            <TouchableOpacity 
               style={[styles.sendBtn, (!inputText.trim() || !operatorId) && {backgroundColor: '#334155'}]} 
               onPress={sendMessage}
               disabled={!inputText.trim() || !operatorId}
            >
              <Ionicons name="send" size={18} color="#fff" style={{marginLeft: 3, marginTop: 1}} />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 10, flexGrow: 1, justifyContent: 'flex-end' },
  centerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginBottom: 60 },
  emptyCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#1e293b', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  emptyText: { color: '#f8fafc', fontSize: 16, fontWeight: '500' },
  emptySubText: { color: '#94a3b8', fontSize: 13, marginTop: 6 },
  msgRow: { flexDirection: 'row', marginBottom: 14 },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start' },
  senderNameLabel: { fontSize: 12, color: '#94a3b8', marginBottom: 4, marginLeft: 2, fontWeight: '500' },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, shadowColor: '#000', shadowOffset: {width: 0, height: 1}, shadowOpacity: 0.1, elevation: 1 },
  bubbleMe: { backgroundColor: '#059669', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#1e293b', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 22 },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end', fontWeight: '500' },
  inputContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, backgroundColor: '#1e293b', borderTopWidth: 1, borderTopColor: '#334155', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#0f172a', color: '#f8fafc', borderRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, minHeight: 48, maxHeight: 120, fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#059669', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginBottom: 2, shadowColor: '#059669', shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.4, elevation: 2 },
});
