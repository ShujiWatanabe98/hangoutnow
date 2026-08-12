import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_URL = 'https://hangoutnow-api.onrender.com';
const DEMO_PASSWORD = 'HangoutNow-Demo-2026!';

type User = {
  id: string;
  email: string;
  displayName: string;
  bio: string | null;
  homeArea: string | null;
  interests: string[];
  verificationStatus: string;
  profilePhoto: string | null;
};

type Session = { accessToken: string; refreshToken: string; user: User };
type Host = { id: string; displayName: string; profilePhoto: string | null; verification: string };
type Hangout = {
  id: string;
  hostUserId: string;
  title: string;
  description: string | null;
  category: string;
  startAt: string;
  locationName: string;
  participantCount: number;
  maxParticipants: number;
  myJoinStatus: string | null;
  host: Host;
};
type Message = { id: string; body: string; senderUserId: string; createdAt: string; sender: { id: string; displayName: string } };
type Room = { id: string; hangoutId: string; hangout: { id: string; title: string; host: { displayName: string } }; lastMessage: Message | null };
type NotificationItem = { id: string; type: string; link: string | null; readAt: string | null };
type NotificationInbox = { items: NotificationItem[]; unreadCount: number };
type Screen = 'home' | 'chat' | 'profile';
type AuthMode = 'login' | 'register';

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>('home');
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [demoRole, setDemoRole] = useState<'host' | 'guest' | null>(null);
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [realtimeOnline, setRealtimeOnline] = useState(false);

  const request = useCallback(async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
    const perform = (accessToken?: string) => fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        'content-type': 'application/json',
        ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    });
    let response = await perform(session?.accessToken);
    if (response.status === 401 && session?.refreshToken && path !== '/auth/refresh') {
      const refreshed = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
      if (refreshed.ok) {
        const nextSession = await readJson(refreshed) as Session;
        setSession(nextSession);
        response = await perform(nextSession.accessToken);
      }
    }
    const data = await readJson(response);
    if (!response.ok) {
      const body = data as { message?: string | string[] } | null;
      const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
      throw new Error(message || '通信に失敗しました');
    }
    return data as T;
  }, [session]);

  const loadHome = useCallback(async () => {
    if (!session) return;
    setHangouts(await request<Hangout[]>('/hangouts'));
  }, [request, session]);

  const loadRooms = useCallback(async () => {
    if (!session) return;
    setRooms(await request<Room[]>('/chat-rooms'));
  }, [request, session]);

  const refreshCurrent = useCallback(async () => {
    setRefreshing(true);
    setError('');
    try {
      if (screen === 'home') await loadHome();
      if (screen === 'chat') await loadRooms();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新に失敗しました');
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, loadRooms, screen]);

  useEffect(() => {
    if (!session) return;
    void refreshCurrent();
  }, [screen, session?.user.id]);

  useEffect(() => {
    if (!session) return;
    const socket = io(API_URL, { auth: { token: session.accessToken }, transports: ['websocket'] });
    socket.on('connect', () => setRealtimeOnline(true));
    socket.on('disconnect', () => setRealtimeOnline(false));
    socket.on('notification', (item: { id?: string; type?: string; link?: string }) => {
      if (item.type !== 'CHAT_MESSAGE' || !item.link?.startsWith('chat:')) return;
      const roomId = item.link.slice(5);
      void loadRooms();
      if (selectedRoom?.id === roomId) {
        void request<Message[]>(`/chat-rooms/${roomId}/messages`).then(setMessages);
        if (item.id) void request(`/notifications/${item.id}/read`, { method: 'POST' });
      } else {
        setUnreadByRoom((current) => ({ ...current, [roomId]: (current[roomId] || 0) + 1 }));
      }
    });
    return () => { socket.disconnect(); };
  }, [loadRooms, request, selectedRoom?.id, session?.accessToken]);

  async function authenticate(email: string, password: string, role: 'host' | 'guest' | null = null) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await readJson(response) as Session | { message?: string };
      if (!response.ok) throw new Error('message' in data && data.message ? data.message : 'ログインできませんでした');
      setSession(data as Session);
      setDemoRole(role);
      setScreen(role === 'guest' ? 'chat' : 'home');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ログインできませんでした');
    } finally {
      setLoading(false);
    }
  }

  async function register(input: { email: string; password: string; displayName: string; birthDate: string }) {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await readJson(response) as Session | { message?: string | string[] };
      if (!response.ok) {
        const message = 'message' in data ? data.message : null;
        throw new Error(Array.isArray(message) ? message[0] : message || '登録できませんでした');
      }
      setSession(data as Session);
      setScreen('profile');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '登録できませんでした');
    } finally {
      setLoading(false);
    }
  }

  async function joinHangout(hangout: Hangout) {
    setLoading(true);
    setError('');
    try {
      await request(`/hangouts/${hangout.id}/join`, {
        method: 'POST',
        body: JSON.stringify({ message: 'スマホアプリから参加を希望します！' }),
      });
      await loadHome();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '参加申請に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function openRoom(room: Room) {
    setLoading(true);
    setSelectedRoom(room);
    setError('');
    try {
      setMessages(await request<Message[]>(`/chat-rooms/${room.id}/messages`));
      setUnreadByRoom((current) => ({ ...current, [room.id]: 0 }));
      const inbox = await request<NotificationInbox>('/notifications');
      const unread = inbox.items.filter((item) => !item.readAt && item.type === 'CHAT_MESSAGE' && item.link === `chat:${room.id}`);
      await Promise.all(unread.map((item) => request(`/notifications/${item.id}/read`, { method: 'POST' })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'メッセージを取得できませんでした');
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const body = messageBody.trim();
    if (!selectedRoom || !body) return;
    setSending(true);
    try {
      const sent = await request<Message>(`/chat-rooms/${selectedRoom.id}/messages`, { method: 'POST', body: JSON.stringify({ body }) });
      setMessageBody('');
      setMessages((current) => current.some((item) => item.id === sent.id) ? current : [...current, sent]);
      await loadRooms();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '送信できませんでした');
    } finally {
      setSending(false);
    }
  }

  function logout() {
    setSession(null);
    setDemoRole(null);
    setSelectedRoom(null);
    setMessages([]);
    setUnreadByRoom({});
    setError('');
  }

  if (!session) {
    return <AuthScreen loading={loading} error={error} onLogin={authenticate} onRegister={register} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {demoRole && (
        <View style={styles.demoBanner}>
          <View><Text style={styles.demoTitle}>デモ：{demoRole === 'host' ? '主催者' : '参加者'}として体験中</Text><Text style={styles.demoHint}>{demoRole === 'host' ? '募集カードから参加申請を管理' : '承認済みチャットを体験'}</Text></View>
          <Pressable onPress={logout} style={styles.switchButton}><Text style={styles.switchText}>役割変更</Text></Pressable>
        </View>
      )}
      <View style={styles.header}>
        <Text style={styles.brand}>Hangout <Text style={styles.brandAccent}>Now</Text></Text>
        <Text style={styles.userName}>{session.user.displayName}</Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.content}>
        {screen === 'home' && <HomeScreen user={session.user} hangouts={hangouts} refreshing={refreshing} onRefresh={refreshCurrent} onJoin={joinHangout} />}
        {screen === 'chat' && <ChatScreen user={session.user} rooms={rooms} selectedRoom={selectedRoom} messages={messages} messageBody={messageBody} sending={sending} refreshing={refreshing} unreadByRoom={unreadByRoom} realtimeOnline={realtimeOnline} onRefresh={refreshCurrent} onOpen={openRoom} onBack={()=>setSelectedRoom(null)} onChangeBody={setMessageBody} onSend={sendMessage} />}
        {screen === 'profile' && <ProfileScreen user={session.user} onLogout={logout} />}
      </View>
      <View style={styles.nav}>
        {([['home','⌂','ホーム'],['chat','♡','チャット'],['profile','☻','プロフィール']] as const).map(([value, icon, label]) => (
          <Pressable key={value} onPress={()=>{setSelectedRoom(null);setScreen(value)}} style={styles.navItem}>
            <Text style={[styles.navIcon,screen===value&&styles.navOn]}>{icon}</Text><Text style={[styles.navLabel,screen===value&&styles.navOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <View style={styles.loading}><ActivityIndicator color="#d9ff68" /></View> : null}
    </SafeAreaView>
  );
}

function AuthScreen({ loading, error, onLogin, onRegister }: { loading: boolean; error: string; onLogin: (email:string,password:string,role?:'host'|'guest'|null)=>Promise<void>; onRegister:(input:{email:string;password:string;displayName:string;birthDate:string})=>Promise<void> }) {
  const [mode,setMode]=useState<AuthMode>('login');
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [birthDate,setBirthDate]=useState('1990-01-01');
  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
    <Text style={styles.authBrand}>Hangout <Text style={styles.brandAccent}>Now</Text></Text>
    <Text style={styles.authEmoji}>🍜　🏃　☕</Text>
    <View style={styles.demoCard}><Text style={styles.demoPill}>公開デモ・すべて架空のデータです</Text><Text style={styles.demoHeading}>役割を選んですぐに体験</Text><Text style={styles.demoDescription}>登録や電話番号入力は必要ありません。</Text><View style={styles.demoRow}><Pressable disabled={loading} style={styles.roleButton} onPress={()=>onLogin('demo-host@hangoutnow.example',DEMO_PASSWORD,'host')}><Text style={styles.roleTitle}>主催者として見る</Text><Text style={styles.roleHint}>募集管理・承認</Text></Pressable><Pressable disabled={loading} style={[styles.roleButton,styles.roleGuest]} onPress={()=>onLogin('demo-guest@hangoutnow.example',DEMO_PASSWORD,'guest')}><Text style={styles.roleTitle}>参加者として見る</Text><Text style={styles.roleHint}>検索・チャット</Text></Pressable></View></View>
    <View style={styles.authCard}><Text style={styles.eyebrow}>今から、誰かと。</Text><Text style={styles.authTitle}>{mode==='login'?'おかえりなさい':'アカウントを作る'}</Text>
      <Field label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      {mode==='register'&&<><Field label="表示名" value={displayName} onChangeText={setDisplayName}/><Field label="生年月日" value={birthDate} onChangeText={setBirthDate}/></>}
      <Field label="パスワード" value={password} onChangeText={setPassword} secureTextEntry />
      {error?<Text style={styles.authError}>{error}</Text>:null}
      <Pressable disabled={loading} style={styles.primary} onPress={()=>mode==='login'?onLogin(email,password):onRegister({email,password,displayName,birthDate})}><Text style={styles.primaryText}>{loading?'接続中…':mode==='login'?'ログイン':'無料で登録'}</Text></Pressable>
      <Pressable onPress={()=>setMode(mode==='login'?'register':'login')}><Text style={styles.authSwitch}>{mode==='login'?'新しくアカウントを作る':'アカウントをお持ちの方はログイン'}</Text></Pressable>
    </View>
  </ScrollView></SafeAreaView>;
}

function Field(props: React.ComponentProps<typeof TextInput> & {label:string}) { const {label,...input}=props; return <View><Text style={styles.label}>{label}</Text><TextInput {...input} style={styles.input} placeholderTextColor="#8a918c" /></View> }

function HomeScreen({ user, hangouts, refreshing, onRefresh, onJoin }: {user:User;hangouts:Hangout[];refreshing:boolean;onRefresh:()=>void;onJoin:(hangout:Hangout)=>void}) {
  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}><View style={styles.hero}><Text style={styles.eyebrow}>{user.homeArea||'エリア未設定'}</Text><Text style={styles.heroTitle}>今から{`\n`}何する？</Text></View><View style={styles.sectionHead}><Text style={styles.sectionTitle}>近くのHangout</Text><Text style={styles.muted}>{hangouts.length}件</Text></View>{hangouts.map((hangout)=><View key={hangout.id} style={styles.card}><View style={styles.cardTop}><Text style={styles.category}>{({FOOD:'🍜',RUNNING:'🏃',CAFE:'☕',MOTORCYCLE:'🏍️',WALKING:'🚶'} as Record<string,string>)[hangout.category]||'✨'}</Text><View style={styles.cardCopy}><Text style={styles.cardTitle}>{hangout.title}</Text><Text style={styles.muted}>{hangout.locationName}</Text><Text style={styles.muted}>👥 {hangout.participantCount} / {hangout.maxParticipants}人</Text></View></View><View style={styles.cardBottom}><Text style={styles.hostName}>{hangout.host.displayName}{hangout.host.verification==='PHONE_VERIFIED'?' ✓':''}</Text>{hangout.hostUserId===user.id?<Text style={styles.status}>主催中</Text>:hangout.myJoinStatus?<Text style={styles.status}>{hangout.myJoinStatus==='ACCEPTED'?'承認済み':'申請中'}</Text>:<Pressable style={styles.joinButton} onPress={()=>onJoin(hangout)}><Text style={styles.joinText}>参加したい</Text></Pressable>}</View></View>)}{!hangouts.length&&<Text style={styles.empty}>現在募集中のHangoutはありません。</Text>}</ScrollView>;
}

function ChatScreen({ user, rooms, selectedRoom, messages, messageBody, sending, refreshing, unreadByRoom, realtimeOnline, onRefresh, onOpen, onBack, onChangeBody, onSend }: {user:User;rooms:Room[];selectedRoom:Room|null;messages:Message[];messageBody:string;sending:boolean;refreshing:boolean;unreadByRoom:Record<string,number>;realtimeOnline:boolean;onRefresh:()=>void;onOpen:(room:Room)=>void;onBack:()=>void;onChangeBody:(value:string)=>void;onSend:()=>void}) {
  const listRef=useRef<FlatList<Message>>(null);
  const time=(value?:string)=>value?new Date(value).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):'';
  if(selectedRoom)return <KeyboardAvoidingView style={styles.chatPage} behavior={Platform.OS==='ios'?'padding':undefined} keyboardVerticalOffset={demoRoleOffset()}>
    <View style={styles.chatHeader}><Pressable onPress={onBack} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable><View style={styles.chatHeading}><Text style={styles.chatTitle} numberOfLines={1}>{selectedRoom.hangout.title}</Text><Text style={styles.presence}>{realtimeOnline?'● オンライン':'○ 再接続中'}</Text></View></View>
    <FlatList ref={listRef} data={messages} keyExtractor={(item)=>item.id} contentContainerStyle={styles.messageList} onContentSizeChange={()=>listRef.current?.scrollToEnd({animated:true})} onLayout={()=>listRef.current?.scrollToEnd({animated:false})} renderItem={({item,index})=>{const mine=item.senderUserId===user.id;const previous=messages[index-1];const showName=!mine&&previous?.senderUserId!==item.senderUserId;return <View style={[styles.messageRow,mine?styles.messageRowMine:styles.messageRowOther]}>{!mine&&<View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>{item.sender.displayName.slice(0,1)}</Text></View>}<View style={styles.bubbleGroup}>{showName&&<Text style={styles.messageSender}>{item.sender.displayName}</Text>}<View style={[styles.message,item.senderUserId===user.id?styles.mine:styles.theirs]}><Text style={styles.messageText}>{item.body}</Text></View><Text style={[styles.messageTime,mine&&styles.messageTimeMine]}>{time(item.createdAt)}</Text></View></View>}} ListEmptyComponent={<Text style={styles.empty}>最初のメッセージを送ってみましょう。</Text>}/>
    <View style={styles.composer}><TextInput style={styles.composerInput} value={messageBody} onChangeText={onChangeBody} placeholder="メッセージ" placeholderTextColor="#8a918c" multiline maxLength={1000}/><Pressable disabled={sending||!messageBody.trim()} style={[styles.sendButton,(sending||!messageBody.trim())&&styles.sendDisabled]} onPress={onSend}><Text style={styles.sendText}>{sending?'…':'➤'}</Text></Pressable></View>
  </KeyboardAvoidingView>;
  return <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh}/>}><View style={styles.chatListHead}><View><Text style={styles.pageEyebrow}>承認済みのHangout</Text><Text style={styles.pageTitle}>チャット</Text></View><Text style={[styles.connectionBadge,realtimeOnline&&styles.connectionOn]}>{realtimeOnline?'リアルタイム':'再接続中'}</Text></View>{rooms.map(room=>{const unread=unreadByRoom[room.id]||0;return <Pressable key={room.id} style={styles.room} onPress={()=>onOpen(room)}><View style={styles.roomAvatar}><Text style={styles.roomAvatarText}>{room.hangout.title.slice(0,1)}</Text></View><View style={styles.roomCopy}><View style={styles.roomTop}><Text style={styles.roomTitle} numberOfLines={1}>{room.hangout.title}</Text><Text style={styles.roomTime}>{time(room.lastMessage?.createdAt)}</Text></View><View style={styles.roomBottom}><Text style={styles.roomPreview} numberOfLines={1}>{room.lastMessage?.body||'チャットを開始しましょう'}</Text>{unread>0&&<Text style={styles.unreadBadge}>{unread>99?'99+':unread}</Text>}</View></View></Pressable>})}{!rooms.length&&<Text style={styles.empty}>承認されるとチャットが表示されます。</Text>}</ScrollView>;
}

function demoRoleOffset(){return Platform.OS==='ios'?84:0}

function ProfileScreen({user,onLogout}:{user:User;onLogout:()=>void}) { return <ScrollView contentContainerStyle={styles.profile}>{user.profilePhoto?<Image source={{uri:user.profilePhoto}} style={styles.avatar}/>:<View style={styles.avatarFallback}><Text style={styles.avatarText}>☺</Text></View>}<Text style={styles.profileName}>{user.displayName}</Text><Text style={[styles.verified,user.verificationStatus!=='PHONE_VERIFIED'&&styles.unverified]}>{user.verificationStatus==='PHONE_VERIFIED'?'✓ 電話番号確認済み':'電話番号未確認'}</Text><Text style={styles.bio}>{user.bio||'自己紹介を登録しましょう。'}</Text><View style={styles.tags}>{user.interests.map(item=><Text key={item} style={styles.tag}>{item}</Text>)}</View><View style={styles.safety}><Text>🛡️ 相手を尊重し、公開場所で安全に会いましょう。</Text></View><Pressable style={styles.logoutButton} onPress={onLogout}><Text style={styles.logoutText}>ログアウト</Text></Pressable></ScrollView> }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#f7f8f3'},content:{flex:1},header:{paddingHorizontal:20,paddingVertical:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},brand:{fontSize:21,fontWeight:'900',color:'#17221d'},brandAccent:{color:'#176b48'},userName:{fontSize:12,color:'#6d766f',maxWidth:170},error:{marginHorizontal:16,marginBottom:8,padding:10,borderRadius:12,backgroundColor:'#fff0eb',color:'#a93622'},loading:{position:'absolute',top:70,right:18,backgroundColor:'#17221d',padding:8,borderRadius:20},
  demoBanner:{backgroundColor:'#17221d',paddingHorizontal:13,paddingVertical:8,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},demoTitle:{color:'#fff',fontSize:11,fontWeight:'900'},demoHint:{color:'#cad2cc',fontSize:9,marginTop:2},switchButton:{backgroundColor:'#d9ff68',paddingHorizontal:10,paddingVertical:7,borderRadius:20},switchText:{fontSize:10,fontWeight:'900',color:'#17221d'},
  nav:{height:72,borderTopWidth:1,borderColor:'#e3e7df',backgroundColor:'#fff',flexDirection:'row',justifyContent:'space-around',paddingTop:8},navItem:{alignItems:'center',minWidth:80},navIcon:{fontSize:20,color:'#89908b'},navLabel:{fontSize:10,color:'#89908b',fontWeight:'700'},navOn:{color:'#176b48'},
  authPage:{padding:24,paddingBottom:50,backgroundColor:'#eef5eb'},authBrand:{textAlign:'center',fontSize:26,fontWeight:'900',marginTop:8},authEmoji:{textAlign:'center',fontSize:34,marginVertical:24},demoCard:{backgroundColor:'#17221d',borderRadius:24,padding:18,marginBottom:16},demoPill:{alignSelf:'flex-start',backgroundColor:'#d9ff68',paddingHorizontal:9,paddingVertical:5,borderRadius:20,fontSize:10,fontWeight:'900'},demoHeading:{color:'#fff',fontSize:20,fontWeight:'900',marginTop:10},demoDescription:{color:'#cad2cc',fontSize:12,marginTop:3,marginBottom:12},demoRow:{flexDirection:'row',gap:8},roleButton:{flex:1,backgroundColor:'#fff',padding:12,borderRadius:14},roleGuest:{backgroundColor:'#d9ff68'},roleTitle:{fontSize:12,fontWeight:'900',color:'#17221d'},roleHint:{fontSize:10,color:'#667069',marginTop:3},authCard:{backgroundColor:'#fff',padding:20,borderRadius:24},authTitle:{fontSize:27,fontWeight:'900',color:'#17221d',marginTop:5,marginBottom:8},label:{fontSize:12,fontWeight:'800',marginTop:12,marginBottom:6,color:'#374139'},input:{borderWidth:1,borderColor:'#dfe4df',borderRadius:13,padding:12,color:'#17221d',backgroundColor:'#fff'},authError:{color:'#bd3a28',fontSize:12,marginTop:8},primary:{backgroundColor:'#176b48',padding:15,borderRadius:15,marginTop:15,alignItems:'center'},primaryText:{color:'#fff',fontWeight:'900'},authSwitch:{textAlign:'center',color:'#59635c',padding:15},
  hero:{paddingHorizontal:20,paddingTop:12,paddingBottom:16},eyebrow:{color:'#176b48',fontSize:12,fontWeight:'900'},heroTitle:{fontSize:35,lineHeight:39,fontWeight:'900',color:'#17221d',marginTop:6},sectionHead:{paddingHorizontal:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:8},sectionTitle:{fontSize:19,fontWeight:'900'},muted:{fontSize:12,color:'#6d766f',marginTop:3},card:{backgroundColor:'#fff',borderWidth:1,borderColor:'#e3e7df',borderRadius:20,padding:16,marginHorizontal:14,marginBottom:12},cardTop:{flexDirection:'row',gap:12},category:{width:48,height:48,textAlign:'center',textAlignVertical:'center',fontSize:25,backgroundColor:'#eef6d5',borderRadius:15},cardCopy:{flex:1},cardTitle:{fontSize:16,fontWeight:'900',color:'#17221d'},cardBottom:{marginTop:14,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},hostName:{fontSize:12,fontWeight:'700'},status:{fontSize:11,fontWeight:'900',color:'#176b48',backgroundColor:'#e9f7ec',padding:7,borderRadius:10},joinButton:{backgroundColor:'#d9ff68',paddingHorizontal:12,paddingVertical:8,borderRadius:12},joinText:{fontSize:11,fontWeight:'900'},empty:{textAlign:'center',color:'#6d766f',padding:30},
  pageEyebrow:{color:'#176b48',fontWeight:'900',fontSize:12,marginTop:20},pageTitle:{fontSize:32,fontWeight:'900',marginTop:4,marginBottom:15},chatListHead:{paddingHorizontal:20,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},connectionBadge:{fontSize:10,fontWeight:'800',color:'#9a6c54',backgroundColor:'#fff0e8',paddingHorizontal:9,paddingVertical:6,borderRadius:20},connectionOn:{color:'#176b48',backgroundColor:'#e9f7ec'},room:{marginHorizontal:14,marginBottom:8,padding:12,borderRadius:18,backgroundColor:'#fff',borderWidth:1,borderColor:'#e3e7df',flexDirection:'row',alignItems:'center',gap:11},roomAvatar:{width:48,height:48,borderRadius:24,backgroundColor:'#d9ff68',alignItems:'center',justifyContent:'center'},roomAvatarText:{fontSize:18,fontWeight:'900',color:'#17221d'},roomCopy:{flex:1},roomTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},roomBottom:{flexDirection:'row',alignItems:'center',marginTop:5,gap:8},roomTitle:{flex:1,fontWeight:'900',fontSize:15},roomTime:{fontSize:10,color:'#89918b'},roomPreview:{flex:1,fontSize:12,color:'#6d766f'},unreadBadge:{minWidth:21,textAlign:'center',color:'#fff',backgroundColor:'#24a35a',fontSize:10,fontWeight:'900',paddingHorizontal:6,paddingVertical:4,borderRadius:11},chatPage:{flex:1,backgroundColor:'#e8eee8'},chatHeader:{height:57,paddingHorizontal:10,backgroundColor:'#fff',borderBottomWidth:1,borderColor:'#dfe4df',flexDirection:'row',alignItems:'center'},backButton:{width:42,height:42,alignItems:'center',justifyContent:'center'},back:{color:'#176b48',fontSize:36,lineHeight:38},chatHeading:{flex:1,paddingRight:42,alignItems:'center'},chatTitle:{fontSize:16,fontWeight:'900',maxWidth:'100%'},presence:{fontSize:9,color:'#176b48',marginTop:2},messageList:{paddingHorizontal:11,paddingTop:14,paddingBottom:16},messageRow:{flexDirection:'row',alignItems:'flex-end',marginVertical:4,maxWidth:'86%'},messageRowMine:{alignSelf:'flex-end'},messageRowOther:{alignSelf:'flex-start'},chatAvatar:{width:32,height:32,borderRadius:16,backgroundColor:'#d9ac86',alignItems:'center',justifyContent:'center',marginRight:6,marginBottom:15},chatAvatarText:{fontSize:12,fontWeight:'900'},bubbleGroup:{maxWidth:'88%'},message:{paddingHorizontal:13,paddingVertical:9,borderRadius:18},mine:{alignSelf:'flex-end',backgroundColor:'#d9ff68',borderBottomRightRadius:5},theirs:{alignSelf:'flex-start',backgroundColor:'#fff',borderBottomLeftRadius:5},messageSender:{fontSize:9,color:'#687169',fontWeight:'700',marginBottom:3,marginLeft:4},messageText:{fontSize:15,lineHeight:20,color:'#17221d'},messageTime:{fontSize:9,color:'#7b847e',marginTop:3,marginLeft:4},messageTimeMine:{textAlign:'right',marginRight:4},composer:{flexDirection:'row',alignItems:'flex-end',gap:8,paddingHorizontal:10,paddingVertical:8,backgroundColor:'#fff',borderTopWidth:1,borderColor:'#dfe4df'},composerInput:{flex:1,minHeight:40,maxHeight:110,backgroundColor:'#f4f6f3',borderWidth:1,borderColor:'#dfe4df',borderRadius:20,paddingHorizontal:14,paddingTop:10,paddingBottom:9,color:'#17221d'},sendButton:{width:42,height:42,backgroundColor:'#24a35a',borderRadius:21,alignItems:'center',justifyContent:'center'},sendDisabled:{backgroundColor:'#bdc6c0'},sendText:{color:'#fff',fontSize:18,fontWeight:'900'},
  profile:{alignItems:'center',padding:24},avatar:{width:92,height:92,borderRadius:46,backgroundColor:'#ddd'},avatarFallback:{width:92,height:92,borderRadius:46,backgroundColor:'#d9ac86',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:35},profileName:{fontSize:25,fontWeight:'900',marginTop:14},verified:{color:'#176b48',fontWeight:'800',marginTop:5},unverified:{color:'#b25c31'},bio:{textAlign:'center',color:'#5f6862',lineHeight:21,marginVertical:18},tags:{flexDirection:'row',flexWrap:'wrap',justifyContent:'center',gap:7},tag:{backgroundColor:'#eaf4e8',color:'#176b48',paddingHorizontal:11,paddingVertical:7,borderRadius:20,fontWeight:'700'},safety:{backgroundColor:'#fff',borderRadius:16,padding:15,marginTop:24},logoutButton:{marginTop:24,borderWidth:1,borderColor:'#cfd5d0',borderRadius:14,paddingHorizontal:30,paddingVertical:12},logoutText:{color:'#4f5952',fontWeight:'800'},
});
