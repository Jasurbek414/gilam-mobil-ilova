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
        title: `${operatorName} bilan Chat`,
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
                  <View style={{flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start'}}>
                    {!isMe && (
                      <Text style={{fontSize: 11, color: '#a1a1aa', marginBottom: 4, marginLeft: 4}}>
                        {item.sender?.fullName || operatorName}
                      </Text>
                    )}
                    <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
                      <Text style={[styles.msgText, {color: isMe?'#09090b':'#f4f4f5'}]}>{item.text}</Text>
                      <Text style={[styles.timeText, {color: isMe?'#064e3b':'#71717a'}]}>
                         {new Date(item.createdAt).toLocaleTimeString('uz-UZ', {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
          />
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Xabar yozing..."
              placeholderTextColor="#71717a"
              multiline
            />
            <TouchableOpacity 
               style={[styles.sendBtn, (!inputText.trim() || !operatorId) && {backgroundColor: '#3f3f46'}]} 
               onPress={sendMessage}
               disabled={!inputText.trim() || !operatorId}
            >
              <Ionicons name="send" size={18} color="#fff" />
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
  emptyText: { color: '#71717a', fontSize: 14, marginTop: 12 },
  msgRow: { flexDirection: 'row', marginBottom: 12 },
  msgRight: { justifyContent: 'flex-end' },
  msgLeft: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 16 },
  bubbleMe: { backgroundColor: '#10b981', borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#27272a', borderBottomLeftRadius: 4 },
  msgText: { fontSize: 15, lineHeight: 20 },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputContainer: { flexDirection: 'row', padding: 12, backgroundColor: '#18181b', borderTopWidth: 1, borderTopColor: '#27272a', alignItems: 'flex-end' },
  input: { flex: 1, backgroundColor: '#27272a', color: '#fff', borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, minHeight: 40, maxHeight: 100 },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#10b981', justifyContent: 'center', alignItems: 'center', marginLeft: 8, marginBottom: 2 },
});
