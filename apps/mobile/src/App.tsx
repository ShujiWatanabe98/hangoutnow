import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const API_URL = "https://hangoutnow-api.onrender.com";
const WEBSITE_URL = "https://method-more.com";
const ACTIVITY_PHOTO_URL = `${WEBSITE_URL}/assets/activity-photos-v1.png`;
const DEFAULT_HANGOUT_IMAGES: Record<string, string> = {
  CAFE: `${WEBSITE_URL}/assets/demo-cafe-hangout.jpg`,
  FOOD: `${WEBSITE_URL}/assets/demo-ramen-mami-v3.jpg`,
  RUNNING: `${WEBSITE_URL}/assets/demo-running-hangout-v2.jpg`,
  WALKING: `${WEBSITE_URL}/assets/hangout-sanpo.jpg`,
  MOTORCYCLE: `${WEBSITE_URL}/assets/demo-touring-hangout-v2.jpg`,
  DRINKING: `${WEBSITE_URL}/assets/demo-drinking-hangout-v2.jpg`,
};
const HANGOUT_IMAGE_PRESETS = [
  { label: "カフェ", uri: DEFAULT_HANGOUT_IMAGES.CAFE, category: "カフェ", title: "新宿でコーヒー飲もう", description: "初参加歓迎！気軽におしゃべりしながら、おいしいコーヒーを一緒に楽しみましょう。" },
  { label: "ラーメン", uri: DEFAULT_HANGOUT_IMAGES.FOOD, category: "ラーメン", title: "新宿でラーメンを食べよう", description: "話題のラーメンを一緒に楽しみませんか？一人では入りづらい方も気軽にどうぞ！" },
  { label: "ランニング", uri: DEFAULT_HANGOUT_IMAGES.RUNNING, category: "ランニング", title: "新宿を気軽にランニングしよう", description: "会話できるゆっくりペースで走ります。初心者も経験者も一緒に楽しみましょう！" },
  { label: "飲み会", uri: DEFAULT_HANGOUT_IMAGES.DRINKING, category: "飲み会", title: "新宿で気軽に飲もう", description: "仕事帰りに楽しく乾杯しませんか？初参加の方も入りやすい気軽な飲み会です！" },
] as const;
const SESSION_KEY = "hangout-now-session";
const LINE_REDIRECT_URI = "hangoutnow://auth/line";
const X_REDIRECT_URI = "hangoutnow://auth/x";
const GOOGLE_REDIRECT_URI = "hangoutnow://auth/google";
const APPLE_REDIRECT_URI = "hangoutnow://auth/apple";
WebBrowser.maybeCompleteAuthSession();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});
const INTEREST_OPTIONS = ["カフェ", "ラーメン", "ランニング", "飲み会", "ダーツ", "バー", "ごはん", "カラオケ", "英会話", "シーシャ", "スイーツ", "映画"] as const;
const SOCIAL_STYLE_OPTIONS = ["静かに話したい", "ワイワイ楽しみたい", "初対面でも積極的", "少人数でじっくり", "聞き役が多い"] as const;
const PARTICIPATION_GOAL_OPTIONS = ["趣味仲間", "友達づくり", "暇つぶし", "情報交換", "運動習慣", "食事・飲み", "新しい体験"] as const;
const FIRST_TIME_OPTIONS = ["初参加歓迎", "ひとり参加が安心", "常連が多くてもOK", "主催者から話しかけてほしい"] as const;
const AVOID_OPTIONS = ["大人数", "飲酒中心", "深夜", "屋外", "激しい運動", "写真撮影", "営業・勧誘"] as const;
const FLEXIBILITY_OPTIONS = ["時間厳守", "多少の遅れは許容", "途中参加OK", "途中退出OK", "急な予定変更OK"] as const;

type User = {
  id: string;
  email: string;
  displayName: string;
  birthDate?: string;
  gender: string | null;
  bio: string | null;
  homeArea: string | null;
  preferredAreas: string[];
  preferredActivities: string[];
  preferredAgeMin: number | null;
  preferredAgeMax: number | null;
  preferredGenders: string[];
  activityTimeSlots: string[];
  matchingDataConsent: boolean;
  participationUrgency: "NOW" | "TODAY" | "THIS_WEEK" | "WEEKEND" | "FLEXIBLE" | null;
  maxTravelMinutes: number | null;
  preferredGroupSizes: number[];
  budgetMin: number | null;
  budgetMax: number | null;
  socialStyles: string[];
  participationGoals: string[];
  firstTimePreferences: string[];
  alcoholPreference: "AVOID" | "OK" | "PREFER" | null;
  smokingPreference: "AVOID" | "OK" | null;
  avoidPreferences: string[];
  scheduleFlexibility: string[];
  behaviorLearningEnabled: boolean;
  interests: string[];
  verificationStatus: string;
  profilePhoto: string | null;
  profilePhotos: string[];
};

type UpdateProfileInput = Pick<User, "displayName" | "gender" | "bio" | "homeArea" | "interests" | "preferredAreas" | "preferredActivities" | "preferredAgeMin" | "preferredAgeMax" | "preferredGenders" | "activityTimeSlots" | "matchingDataConsent" | "participationUrgency" | "maxTravelMinutes" | "preferredGroupSizes" | "budgetMin" | "budgetMax" | "socialStyles" | "participationGoals" | "firstTimePreferences" | "alcoholPreference" | "smokingPreference" | "avoidPreferences" | "scheduleFlexibility" | "behaviorLearningEnabled">;

type Session = { accessToken: string; refreshToken: string; user: User };
type HostTier = "WHITE" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
type HostStatus = {
  tier: HostTier;
  label: string;
  completedHangouts: number;
  totalParticipants: number;
  ratingCount: number;
  averageRating: number | null;
  hostRatingCount: number;
  hostAverageRating: number | null;
  participantRatingCount: number;
  participantAverageRating: number | null;
  recentAverageRating: number | null;
  cancellationRate: number;
  nextTier: HostTier | null;
};
type Host = {
  id: string;
  displayName: string;
  profilePhoto: string | null;
  profilePhotos?: string[];
  verification: string;
  hostStatus?: HostStatus;
};
type Hangout = {
  id: string;
  hostUserId: string;
  status: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  category: string;
  startAt: string;
  locationName: string;
  publicLocationName?: string;
  meetingPlaceName?: string | null;
  meetingAddress?: string | null;
  navigationUrl?: string | null;
  distanceKm?: number | null;
  matchScore?: number;
  participantCount: number;
  maxParticipants: number;
  hostMaleCount?: number;
  hostFemaleCount?: number;
  genderRestriction: "ANY" | "MALE_ONLY" | "FEMALE_ONLY";
  maxAge: number | null;
  myJoinStatus: string | null;
  myJoinRequestId: string | null;
  myAttendanceStatus: "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED" | null;
  host: Host;
  hearted: boolean;
  heartCount: number;
};
type Message = {
  id: string;
  body: string;
  senderUserId: string;
  createdAt: string;
  sender: { id: string; displayName: string; profilePhoto: string | null };
};
type ChatMember = {
  id: string;
  displayName: string;
  profilePhoto: string | null;
  profilePhotos?: string[];
  verification: string;
  myRatingScore?: number | null;
  ratedFiveByMe?: boolean;
  directChatEligible?: boolean;
};
type GroupRoom = {
  id: string;
  createdAt: string;
  type: "GROUP";
  hangoutId: string;
  hangout: { id: string; title: string; status: string; hostUserId: string; host: ChatMember };
  members: ChatMember[];
  lastMessage: Message | null;
};
type DirectRoom = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: "DIRECT";
  otherUser: ChatMember;
  lastMessage: Message | null;
};
type Room = GroupRoom | DirectRoom;
type NotificationItem = {
  id: string;
  type: string;
  link: string | null;
  readAt: string | null;
  title: string;
  body: string;
  createdAt: string;
};
type NotificationInbox = { items: NotificationItem[]; unreadCount: number; enabled: boolean };
type Screen = "home" | "map" | "create" | "detail" | "phone" | "chat" | "rating" | "profile" | "notifications";
type AlphaArea = "新宿" | "渋谷";
type ApplicantProfile = {
  id: string;
  displayName: string;
  verification: string;
  profilePhoto: string | null;
  profilePhotos?: string[];
  age: number;
  bio: string | null;
  homeArea: string | null;
  interests: string[];
};
type JoinRequest = {
  id: string;
  status: "PENDING" | "ACCEPTED" | "WAITLISTED" | "REJECTED" | "CANCELLED";
  message: string | null;
  user: ApplicantProfile;
};
type CreateHangoutInput = {
  title: string;
  description: string;
  imageUrl?: string;
  category: string;
  startInMinutes: 30 | 60 | 180;
  publicLocationName: string;
  locationName: string;
  meetingPlaceName: string;
  meetingAddress: string;
  navigationUrl: string;
  maxParticipants: number;
  genderRestriction: "ANY" | "MALE_ONLY" | "FEMALE_ONLY";
  maxAge: number | null;
  area: AlphaArea;
};
type ProfileActivityItem = { id: string; title: string; status: string; startAt: string; imageUrl: string | null; category: string; publicLocationName: string };
type ProfileActivity = { hosted: ProfileActivityItem[]; participated: ProfileActivityItem[]; hearted: ProfileActivityItem[] };
type ReportReason = "HARASSMENT" | "SPAM" | "DANGEROUS" | "SEXUAL" | "SOLICITATION" | "FRAUD" | "HATE" | "IMPERSONATION" | "OTHER";
const AREA_COORDINATES: Record<AlphaArea, { latitude: number; longitude: number }> = {
  新宿: { latitude: 35.6909, longitude: 139.7003 },
  渋谷: { latitude: 35.658, longitude: 139.7016 },
};
const MAP_PIN_POSITIONS = [
  { top: "18%", left: "20%" },
  { top: "30%", right: "18%" },
  { top: "53%", left: "34%" },
  { bottom: "18%", right: "28%" },
  { bottom: "12%", left: "12%" },
] as const;
type AuthMode = "login" | "register";
function messageText(body: string) {
  return body.startsWith("__STAMP__") ? "過去のスタンプ" : body;
}
function stateLabel(hangout: Hangout) {
  if (hangout.status === "STARTED") return "Hangout中";
  if (hangout.status === "FINISHED") return "終了";
  if (hangout.status === "CANCELLED") return "中止";
  return hangout.myJoinStatus === "ACCEPTED" ? "承認済み" : hangout.myJoinStatus === "PENDING" ? "申請中" : hangout.myJoinStatus === "WAITLISTED" ? "待機中" : hangout.status === "FULL" ? "満員" : "募集中";
}

function hangoutImageUrl(hangout: Pick<Hangout, "imageUrl" | "category">) {
  return hangout.imageUrl || DEFAULT_HANGOUT_IMAGES[hangout.category] || ACTIVITY_PHOTO_URL;
}

function eligibilityReason(user: User, hangout: Hangout) {
  if (hangout.genderRestriction === "MALE_ONLY" && user.gender !== "MALE") return "男性のみ参加できます";
  if (hangout.genderRestriction === "FEMALE_ONLY" && user.gender !== "FEMALE") return "女性のみ参加できます";
  if (hangout.maxAge && user.birthDate) {
    const born = new Date(user.birthDate);
    const now = new Date();
    let age = now.getFullYear() - born.getFullYear();
    if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) age -= 1;
    if (age > hangout.maxAge) return `年齢条件（${hangout.maxAge}歳以下）の対象外です`;
  }
  return "";
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [ratingRoom, setRatingRoom] = useState<GroupRoom | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [demoRole, setDemoRole] = useState<"host" | "guest" | null>(null);
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [realtimeOnline, setRealtimeOnline] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [locationLabel, setLocationLabel] = useState("エリア未設定");
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [hostStatus, setHostStatus] = useState<HostStatus | null>(null);
  const [profileActivity, setProfileActivity] = useState<ProfileActivity>({ hosted: [], participated: [], hearted: [] });
  const [selectedArea, setSelectedArea] = useState<AlphaArea>("新宿");
  const [selectedHangout, setSelectedHangout] = useState<Hangout | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [notificationInbox, setNotificationInbox] = useState<NotificationInbox>({ items: [], unreadCount: 0, enabled: true });
  const handledNotificationResponseId = useRef<string | null>(null);

  const request = useCallback(
    async <T,>(path: string, options: RequestInit = {}): Promise<T> => {
      const perform = (accessToken?: string) =>
        fetch(`${API_URL}${path}`, {
          ...options,
          headers: {
            "content-type": "application/json",
            ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
            ...options.headers,
          },
        });
      let response = await perform(session?.accessToken);
      if (response.status === 401 && session?.refreshToken && path !== "/auth/refresh") {
        const refreshed = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken: session.refreshToken }),
        });
        if (refreshed.ok) {
          const nextSession = (await readJson(refreshed)) as Session;
          setSession(nextSession);
          response = await perform(nextSession.accessToken);
        }
      }
      const data = await readJson(response);
      if (!response.ok) {
        const body = data as { message?: string | string[] } | null;
        const message = Array.isArray(body?.message) ? body.message[0] : body?.message;
        throw new Error(message || "通信に失敗しました");
      }
      return data as T;
    },
    [session],
  );

  const loadHome = useCallback(async () => {
    if (!session) return;
    const query = coordinates ? `?latitude=${coordinates.latitude}&longitude=${coordinates.longitude}&radiusKm=5` : "";
    setHangouts(await request<Hangout[]>(`/hangouts${query}`));
    void request("/analytics/events", {
      method: "POST",
      body: JSON.stringify({ eventType: "DISCOVERY_VIEWED" }),
    }).catch(() => undefined);
  }, [coordinates, request, session]);

  const toggleHeart = useCallback(async (hangout: Hangout) => {
    try {
      const result = await request<{ hearted: boolean; heartCount: number }>(`/hangouts/${hangout.id}/heart`, { method: "POST" });
      const update = (item: Hangout) => item.id === hangout.id ? { ...item, ...result } : item;
      setHangouts((current) => current.map(update));
      setSelectedHangout((current) => current ? update(current) : current);
    } catch {
      Alert.alert("ハートを送れませんでした", "通信状態を確認してもう一度お試しください。");
    }
  }, [request]);

  const loadRooms = useCallback(async () => {
    if (!session) return [] as Room[];
    const [groups, directs] = await Promise.all([request<GroupRoom[]>("/chat-rooms"), request<DirectRoom[]>("/direct-chats")]);
    const timestamp = (room: Room) => new Date(room.lastMessage?.createdAt ?? (room.type === "DIRECT" ? room.updatedAt : room.createdAt)).getTime();
    const nextRooms: Room[] = [...groups, ...directs].sort((left, right) => timestamp(right) - timestamp(left));
    setRooms(nextRooms);
    return nextRooms;
  }, [request, session]);

  const loadHostStatus = useCallback(async () => {
    if (!session) return;
    const [status, activity] = await Promise.all([request<HostStatus>("/users/me/host-status"), request<ProfileActivity>("/hangouts/mine/activity")]);
    setHostStatus(status);
    setProfileActivity(activity);
  }, [request, session]);

  const loadNotifications = useCallback(async () => {
    if (!session) return;
    setNotificationInbox(await request<NotificationInbox>("/notifications"));
  }, [request, session]);

  const openChatNotification = useCallback(async (link: string) => {
    const prefix = link.startsWith("group-chat:") ? "group-chat:" : link.startsWith("direct-chat:") ? "direct-chat:" : null;
    if (!prefix) return;
    const roomId = link.slice(prefix.length);
    if (!roomId) return;
    try {
      const nextRooms = await loadRooms();
      const room = nextRooms.find((item) => item.id === roomId && (prefix === "direct-chat:" ? item.type === "DIRECT" : item.type === "GROUP"));
      if (!room) return;
      const base = room.type === "DIRECT" ? "/direct-chats" : "/chat-rooms";
      const [nextMessages, inbox] = await Promise.all([
        request<Message[]>(`${base}/${room.id}/messages`),
        request<NotificationInbox>("/notifications"),
      ]);
      const unread = inbox.items.filter((item) => !item.readAt && item.link === link);
      await Promise.all(unread.map((item) => request(`/notifications/${item.id}/read`, { method: "POST" })));
      setSelectedRoom(room);
      setMessages(nextMessages);
      setUnreadByRoom((current) => ({ ...current, [room.id]: 0 }));
      setScreen("chat");
      await loadNotifications();
    } catch {
      Alert.alert("トークを開けませんでした", "通信状態を確認して、トーク一覧からもう一度お試しください。");
    }
  }, [loadNotifications, loadRooms, request]);

  const refreshCurrent = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      if (screen === "home") await loadHome();
      if (screen === "chat") await loadRooms();
      if (screen === "profile") await loadHostStatus();
      if (screen === "notifications") await loadNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新に失敗しました");
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, loadHostStatus, loadNotifications, loadRooms, screen]);

  useEffect(() => {
    if (!session) return;
    void refreshCurrent();
  }, [screen, session?.user.id]);

  useEffect(() => {
    if (session) void loadNotifications();
  }, [loadNotifications, session?.user.id]);

  useEffect(() => {
    if (session && screen === "home" && coordinates) void loadHome();
  }, [coordinates, loadHome, screen, session]);

  useEffect(() => {
    void (async () => {
      try {
        const raw = await SecureStore.getItemAsync(SESSION_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Session;
        const refreshed = await fetch(`${API_URL}/auth/refresh`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ refreshToken: saved.refreshToken }),
        });
        if (!refreshed.ok) {
          await SecureStore.deleteItemAsync(SESSION_KEY);
          return;
        }
        const next = (await readJson(refreshed)) as Session;
        setSession(next);
        await SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(next));
      } catch {
        await SecureStore.deleteItemAsync(SESSION_KEY);
      } finally {
        setRestoring(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (session) void SecureStore.setItemAsync(SESSION_KEY, JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if (!session || Platform.OS === "web" || !Device.isDevice) return;
    let active = true;
    void (async () => {
      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.status === "granted" ? existing : await Notifications.requestPermissionsAsync();
      if (!active || permission.status !== "granted") return;
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (typeof projectId !== "string" || !projectId) return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      if (!active) return;
      await request("/notifications/push-token", {
        method: "POST",
        body: JSON.stringify({ token, platform: Platform.OS }),
      });
      await SecureStore.setItemAsync("hangout-now-push-token", token);
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [request, session?.user.id]);

  useEffect(() => {
    if (!session || Platform.OS === "web" || !Device.isDevice) return;
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (handledNotificationResponseId.current === identifier) return;
      const link = response.notification.request.content.data?.link;
      if (typeof link !== "string") return;
      handledNotificationResponseId.current = identifier;
      void openChatNotification(link);
    };
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (!response) return;
      handleResponse(response);
      void Notifications.clearLastNotificationResponseAsync();
    });
    return () => subscription.remove();
  }, [openChatNotification, session?.user.id]);

  useEffect(() => {
    if (!session) return;
    const socket = io(API_URL, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
    });
    socket.on("connect", () => setRealtimeOnline(true));
    socket.on("disconnect", () => setRealtimeOnline(false));
    socket.on("notification", (item: { id?: string; type?: string; link?: string }) => {
      void loadNotifications();
      if (!["CHAT_MESSAGE", "DIRECT_MESSAGE"].includes(item.type || "")) return;
      const prefix = item.link?.startsWith("group-chat:") ? "group-chat:" : item.link?.startsWith("direct-chat:") ? "direct-chat:" : null;
      if (!prefix) return;
      const roomId = item.link!.slice(prefix.length);
      void loadRooms();
      if (selectedRoom?.id === roomId) {
        const base = selectedRoom.type === "DIRECT" ? "/direct-chats" : "/chat-rooms";
        void request<Message[]>(`${base}/${roomId}/messages`).then(setMessages);
        if (item.id) void request(`/notifications/${item.id}/read`, { method: "POST" });
      } else {
        setUnreadByRoom((current) => ({
          ...current,
          [roomId]: (current[roomId] || 0) + 1,
        }));
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [loadNotifications, loadRooms, request, selectedRoom?.id, session?.accessToken]);

  async function authenticate(email: string, password: string, role: "host" | "guest" | null = null) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}${role ? "/auth/demo-login" : "/auth/login"}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(role ? { role } : { email, password }),
      });
      const data = (await readJson(response)) as Session | { message?: string };
      if (!response.ok) throw new Error("message" in data && data.message ? data.message : "ログインできませんでした");
      setSession(data as Session);
      setDemoRole(role);
      setScreen("home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "ログインできませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function register(input: { email: string; password: string; displayName: string; birthDate: string; gender: string }) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = (await readJson(response)) as Session | { message?: string | string[] };
      if (!response.ok) {
        const message = "message" in data ? data.message : null;
        throw new Error(Array.isArray(message) ? message[0] : message || "登録できませんでした");
      }
      setSession(data as Session);
      setScreen("profile");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "登録できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function authenticateWithLine(input?: { displayName: string; birthDate: string; gender: string }) {
    setLoading(true);
    setError("");
    try {
      const startUrl = `${API_URL}/auth/line/start?returnTo=${encodeURIComponent(LINE_REDIRECT_URI)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, LINE_REDIRECT_URI);
      if (result.type !== "success" || !result.url) throw new Error("LINEログインがキャンセルされました");
      const ticket = new URL(result.url).searchParams.get("ticket");
      if (!ticket) throw new Error("LINEログインの確認情報を取得できませんでした");
      const response = await fetch(`${API_URL}/auth/line/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket, ...input }) });
      const data = await readJson(response) as Session | { registrationRequired?: boolean; message?: string | string[] };
      if ("registrationRequired" in data && data.registrationRequired) throw new Error("初回のみ「アカウント作成」に切り替え、生年月日を入力してLINE登録してください");
      if (!response.ok || !("accessToken" in data)) {
        const message = "message" in data ? data.message : null;
        throw new Error(Array.isArray(message) ? message[0] : message || "LINEログインに失敗しました");
      }
      setSession(data);
      setDemoRole(null);
      setScreen("home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "LINEログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function authenticateWithX() {
    setLoading(true);
    setError("");
    try {
      const startUrl = `${API_URL}/auth/x/start?returnTo=${encodeURIComponent(X_REDIRECT_URI)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, X_REDIRECT_URI);
      if (result.type !== "success" || !result.url) throw new Error("Xログインがキャンセルされました");
      const ticket = new URL(result.url).searchParams.get("ticket");
      if (!ticket) throw new Error("Xログインの確認情報を取得できませんでした");
      const response = await fetch(`${API_URL}/auth/x/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket }) });
      const data = await readJson(response) as Session | { message?: string | string[] };
      if (!response.ok || !("accessToken" in data)) {
        const message = "message" in data ? data.message : null;
        throw new Error(Array.isArray(message) ? message[0] : message || "Xログインに失敗しました");
      }
      setSession(data);
      setDemoRole(null);
      setScreen("home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Xログインに失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function authenticateWithOAuth(provider:"google"|"apple") {
    setLoading(true);setError("");
    try{const redirectUri=provider==="google"?GOOGLE_REDIRECT_URI:APPLE_REDIRECT_URI;const label=provider==="google"?"Google":"Apple";const result=await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/${provider}/start?returnTo=${encodeURIComponent(redirectUri)}`,redirectUri);if(result.type!=="success"||!result.url)throw new Error(`${label}ログインがキャンセルされました`);const ticket=new URL(result.url).searchParams.get("ticket");if(!ticket)throw new Error(`${label}ログインの確認情報を取得できませんでした`);const response=await fetch(`${API_URL}/auth/${provider}/redeem`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ticket})});const data=await readJson(response) as Session|{message?:string|string[]};if(!response.ok||!("accessToken" in data)){const message="message" in data?data.message:null;throw new Error(Array.isArray(message)?message[0]:message||`${label}ログインに失敗しました`)}setSession(data);setDemoRole(null);setScreen("home")}catch(cause){setError(cause instanceof Error?cause.message:"ログインに失敗しました")}finally{setLoading(false)}
  }

  async function authenticateWithPhone(phone:string,code?:string,challengeToken?:string):Promise<{challengeToken?:string;demoCode?:string}>{
    setLoading(true);setError("");try{const path=challengeToken?'/auth/phone/confirm':'/auth/phone/request';const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(challengeToken?{phone,code,challengeToken}:{phone})});const data=await readJson(response) as Session|{challengeToken?:string;demoCode?:string;message?:string|string[]};if(!response.ok){const message='message'in data?data.message:null;throw new Error(Array.isArray(message)?message[0]:message||'電話番号認証に失敗しました')}if('accessToken'in data){setSession(data);setDemoRole(null);setScreen('home');return{}}return{challengeToken:data.challengeToken,demoCode:data.demoCode}}catch(cause){setError(cause instanceof Error?cause.message:'電話番号認証に失敗しました');throw cause}finally{setLoading(false)}
  }

  async function joinHangout(hangout: Hangout, message: string) {
    setLoading(true);
    setError("");
    const previousStatus = hangout.myJoinStatus;
    const applyJoinStatus = (status: string | null) => {
      setSelectedHangout((current) => current?.id === hangout.id ? { ...current, myJoinStatus: status } : current);
      setHangouts((current) => current.map((item) => item.id === hangout.id ? { ...item, myJoinStatus: status } : item));
    };
    applyJoinStatus("PENDING");
    try {
      const joinRequest = await request<{ status: string }>(`/hangouts/${hangout.id}/join`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      applyJoinStatus(joinRequest.status);
      void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "JOIN_REQUESTED",
          hangoutId: hangout.id,
        }),
      }).catch(() => undefined);
      await loadHome();
    } catch (cause) {
      applyJoinStatus(previousStatus);
      const message = cause instanceof Error ? cause.message : "参加申請に失敗しました";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  async function openHangout(hangout: Pick<Hangout, "id">) {
    setLoading(true);
    setError("");
    try {
      const detail = await request<Hangout>(`/hangouts/${hangout.id}`);
      void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "HANGOUT_VIEWED",
          hangoutId: detail.id,
        }),
      }).catch(() => undefined);
      setSelectedHangout(detail);
      if (detail.hostUserId === session?.user.id) setJoinRequests(await request<JoinRequest[]>(`/hangouts/${detail.id}/requests`));
      else setJoinRequests([]);
      setScreen("detail");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "募集詳細を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function createHangout(input: CreateHangoutInput) {
    setLoading(true);
    setError("");
    try {
      const coordinates = AREA_COORDINATES[input.area];
      const created = await request<Hangout>("/hangouts", {
        method: "POST",
        body: JSON.stringify({
          title: input.title.trim(),
          description: input.description.trim() || undefined,
          imageUrl: input.imageUrl,
          category: input.category,
          serviceArea: input.area === "新宿" ? "SHINJUKU" : "SHIBUYA",
          startInMinutes: input.startInMinutes,
          publicLocationName: input.publicLocationName.trim(),
          locationName: input.locationName.trim(),
          meetingPlaceName: input.meetingPlaceName.trim(),
          meetingAddress: input.meetingAddress.trim(),
          navigationUrl: input.navigationUrl.trim() || undefined,
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          maxParticipants: input.maxParticipants,
          genderRestriction: input.genderRestriction,
          maxAge: input.maxAge,
        }),
      });
      void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "HANGOUT_CREATED",
          hangoutId: created.id,
        }),
      }).catch(() => undefined);
      setSelectedArea(input.area);
      setCoordinates(coordinates);
      setLocationLabel(input.area);
      setSelectedHangout(created);
      setJoinRequests([]);
      await loadHome();
      setScreen("detail");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "募集を作成できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function updateHangout(hangoutId: string, input: Partial<CreateHangoutInput>) {
    setLoading(true);
    setError("");
    try {
      await request(`/hangouts/${hangoutId}`, {
        method: "PATCH",
        body: JSON.stringify({
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description.trim() } : {}),
          ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl } : {}),
          ...(input.publicLocationName !== undefined ? { publicLocationName: input.publicLocationName.trim() } : {}),
          ...(input.locationName !== undefined ? { locationName: input.locationName.trim() } : {}),
          ...(input.meetingPlaceName !== undefined ? { meetingPlaceName: input.meetingPlaceName.trim() } : {}),
          ...(input.meetingAddress !== undefined ? { meetingAddress: input.meetingAddress.trim() } : {}),
          ...(input.navigationUrl !== undefined ? { navigationUrl: input.navigationUrl.trim() || null } : {}),
          ...(input.genderRestriction !== undefined ? { genderRestriction: input.genderRestriction } : {}),
          ...(input.maxAge !== undefined ? { maxAge: input.maxAge } : {}),
        }),
      });
      const updated = await request<Hangout>(`/hangouts/${hangoutId}`);
      setSelectedHangout(updated);
      await loadHome();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Hangoutを更新できませんでした";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }
  async function decideJoinRequest(requestId: string, accept: boolean) {
    if (!selectedHangout) return;
    setLoading(true);
    setError("");
    try {
      await request(`/join-requests/${requestId}/${accept ? "accept" : "reject"}`, { method: "POST" });
      setJoinRequests(await request<JoinRequest[]>(`/hangouts/${selectedHangout.id}/requests`));
      setSelectedHangout(await request<Hangout>(`/hangouts/${selectedHangout.id}`));
      await loadHome();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "参加申請を更新できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function updateAttendance(status: "CONFIRMED" | "CANCELLED") {
    if (!selectedHangout?.myJoinRequestId) return;
    setLoading(true);
    setError("");
    try {
      await request(`/join-requests/${selectedHangout.myJoinRequestId}/attendance`, { method: "PATCH", body: JSON.stringify({ status }) });
      const updated = await request<Hangout>(`/hangouts/${selectedHangout.id}`);
      setSelectedHangout(updated);
      await loadHome();
      if (status === "CANCELLED") Alert.alert("キャンセルしました", "参加枠を解放し、待機中の方へ空席を通知しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "出欠を更新できませんでした");
    } finally {
      setLoading(false);
    }
  }
  function confirmReportHost(hangout: Hangout) {
    const choose = (reason: ReportReason, label: string) =>
      Alert.alert("通報してブロック", `${hangout.host.displayName}さんを「${label}」として運営へ通報し、今後お互いの募集とトークを非表示にします。`, [
        { text: "キャンセル", style: "cancel" },
        {
          text: "通報してブロック",
          style: "destructive",
          onPress: () => void reportHost(hangout, reason, label),
        },
      ]);
    Alert.alert("通報理由を選択", "緊急の危険がある場合は、アプリではなく警察・救急へ連絡してください。", [
      {
        text: "危険な行為",
        onPress: () => choose("DANGEROUS", "危険な行為"),
      },
      {
        text: "迷惑行為・その他",
        onPress: () => choose("OTHER", "迷惑行為・その他"),
      },
      { text: "キャンセル", style: "cancel" },
    ]);
  }
  async function reportHost(hangout: Hangout, reason: ReportReason, label: string) {
    setLoading(true);
    setError("");
    try {
      await request("/safety/reports", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: hangout.hostUserId,
          hangoutId: hangout.id,
          reason,
          details: `Hangout詳細画面から通報: ${label}`,
          blockUser: true,
        }),
      });
      setHangouts((current) => current.filter((item) => item.hostUserId !== hangout.hostUserId));
      setSelectedHangout(null);
      setScreen("home");
      Alert.alert("通報を受け付けました", "相手をブロックし、運営の確認対象に追加しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通報を送信できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function verifyPhone(phone: string, code?: string) {
    setLoading(true);
    setError("");
    try {
      if (!code) {
        await request("/users/me/phone/request", {
          method: "POST",
          body: JSON.stringify({ phone }),
        });
        return;
      }
      const user = await request<User>("/users/me/phone/confirm", {
        method: "POST",
        body: JSON.stringify({ phone, code }),
      });
      setSession((current) => (current ? { ...current, user } : current));
      setScreen("profile");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "電話番号を確認できませんでした");
    } finally {
      setLoading(false);
    }
  }
  function chooseArea(area: AlphaArea) {
    setSelectedArea(area);
    setCoordinates(AREA_COORDINATES[area]);
    setLocationLabel(area);
  }

  async function openRoom(room: Room) {
    setLoading(true);
    setSelectedRoom(room);
    setError("");
    try {
      const base = room.type === "DIRECT" ? "/direct-chats" : "/chat-rooms";
      const nextMessages = await request<Message[]>(`${base}/${room.id}/messages`);
      setMessages(nextMessages);
      setUnreadByRoom((current) => ({ ...current, [room.id]: 0 }));
      const inbox = await request<NotificationInbox>("/notifications");
      const link = `${room.type === "DIRECT" ? "direct-chat" : "group-chat"}:${room.id}`;
      const unread = inbox.items.filter((item) => !item.readAt && item.link === link);
      await Promise.all(unread.map((item) => request(`/notifications/${item.id}/read`, { method: "POST" })));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "メッセージを取得できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function openHangoutChat(hangoutId: string) {
    setLoading(true);
    setError("");
    try {
      const nextRooms = await loadRooms();
      const room = nextRooms.find((item): item is GroupRoom => item.type === "GROUP" && item.hangout.id === hangoutId);
      if (!room) {
        Alert.alert("トークを開始できません", "参加が承認されると、このHangoutのトークを利用できます。");
        return;
      }
      setScreen("chat");
      await openRoom(room);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage() {
    const body = messageBody.trim();
    if (!selectedRoom || !body) return;
    setSending(true);
    try {
      const base = selectedRoom.type === "DIRECT" ? "/direct-chats" : "/chat-rooms";
      const sent = await request<Message>(`${base}/${selectedRoom.id}/messages`, { method: "POST", body: JSON.stringify({ body }) });
      setMessageBody("");
      setMessages((current) => (current.some((item) => item.id === sent.id) ? current : [...current, sent]));
      await loadRooms();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "送信できませんでした");
    } finally {
      setSending(false);
    }
  }

  function confirmFinishHangout(hangoutId: string) {
    Alert.alert("Hangoutを終了", "終了すると参加者を評価できるようになります。終了後は募集へ戻せません。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "終了する",
        style: "destructive",
        onPress: () => void finishHangout(hangoutId),
      },
    ]);
  }
  async function finishHangout(hangoutId: string) {
    setLoading(true);
    setError("");
    try {
      await request(`/hangouts/${hangoutId}/finish`, { method: "POST" });
      setSelectedHangout(await request<Hangout>(`/hangouts/${hangoutId}`));
      const nextRooms = await loadRooms();
      const finishedRoom = nextRooms.find((room): room is GroupRoom => room.type === "GROUP" && room.hangout.id === hangoutId);
      if (finishedRoom) {
        setRatingRoom(finishedRoom);
        setScreen("rating");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hangoutを終了できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function startHangout(hangoutId: string) {
    setLoading(true);
    setError("");
    try {
      await request(`/hangouts/${hangoutId}/start`, { method: "POST" });
      setSelectedHangout(await request<Hangout>(`/hangouts/${hangoutId}`));
      await loadHome();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hangoutを開始できませんでした");
    } finally {
      setLoading(false);
    }
  }
  function confirmCancelHangout(hangoutId: string) {
    Alert.alert("Hangout削除", "このHangoutを削除しますか？Hangoutのトークもすべて削除されます。", [
      { text: "戻る", style: "cancel" },
      { text: "Hangout削除", style: "destructive", onPress: () => void cancelHangout(hangoutId) },
    ]);
  }
  async function cancelHangout(hangoutId: string) {
    setLoading(true);
    setError("");
    try {
      await request(`/hangouts/${hangoutId}`, { method: "DELETE" });
      setSelectedHangout(null);
      await loadHome();
      setScreen("home");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hangoutを中止できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function rateParticipant(hangoutId: string, ratedUserId: string, score: number) {
    setLoading(true);
    setError("");
    try {
      await request(`/hangouts/${hangoutId}/ratings`, {
        method: "POST",
        body: JSON.stringify({ ratedUserId, score }),
      });
      const nextRooms = await loadRooms();
      const refreshedRoom = nextRooms.find((room): room is GroupRoom => room.type === "GROUP" && room.hangout.id === hangoutId);
      if (refreshedRoom) setRatingRoom(refreshedRoom);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "評価を送信できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function setNotificationEnabled(enabled: boolean) {
    try {
      await request("/notifications/settings", { method: "PATCH", body: JSON.stringify({ enabled }) });
      setNotificationInbox((current) => ({ ...current, enabled }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通知設定を更新できませんでした");
    }
  }

  async function readNotification(id: string) {
    try {
      await request(`/notifications/${id}/read`, { method: "POST" });
      await loadNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通知を既読にできませんでした");
    }
  }

  async function readAllNotifications() {
    try {
      await request("/notifications/read-all", { method: "POST" });
      await loadNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通知を既読にできませんでした");
    }
  }

  function confirmResetDemo() {
    Alert.alert("共有デモを最初から", "デモ用の募集・申請・トーク・評価を初期状態へ戻します。実ユーザーのデータには影響しません。", [
      { text: "キャンセル", style: "cancel" },
      { text: "最初から", style: "destructive", onPress: () => void resetDemo() },
    ]);
  }

  async function resetDemo() {
    setLoading(true);
    setError("");
    try {
      await request("/demo/reset", { method: "POST" });
      setSelectedHangout(null);
      setSelectedRoom(null);
      setMessages([]);
      setUnreadByRoom({});
      await Promise.all([loadHome(), loadRooms(), loadNotifications()]);
      setScreen("home");
      Alert.alert("デモを初期状態に戻しました");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "デモを初期状態に戻せませんでした");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    if (Platform.OS !== "web")
      void SecureStore.getItemAsync("hangout-now-push-token").then(async (token) => {
        if (!token) return;
        await request("/notifications/push-token/remove", {
          method: "POST",
          body: JSON.stringify({ token, platform: Platform.OS }),
        }).catch(() => undefined);
        await SecureStore.deleteItemAsync("hangout-now-push-token");
      });
    if (session?.refreshToken)
      void fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
      });
    void SecureStore.deleteItemAsync(SESSION_KEY);
    setSession(null);
    setDemoRole(null);
    setSelectedRoom(null);
    setMessages([]);
    setUnreadByRoom({});
    setError("");
  }

  async function useCurrentLocation() {
    setLoading(true);
    setError("");
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("位置情報の利用を許可してください");
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const next = {
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
      };
      setCoordinates(next);
      setLocationLabel("現在地周辺");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "現在地を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function chooseProfilePhoto(index: number) {
    setLoading(true);
    setError("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("写真ライブラリへのアクセスを許可してください");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        quality: 0.65,
        base64: true,
      });
      if (result.canceled) return;
      const asset=result.assets[0];
      if(!asset?.base64)throw new Error("写真を読み込めませんでした");
      const mediaType=asset.mimeType==="image/png"?"png":asset.mimeType==="image/webp"?"webp":"jpeg";
      const photo=`data:image/${mediaType};base64,${asset.base64}`;
      const profilePhotos=[...(session?.user.profilePhotos??[])];
      profilePhotos[index]=photo;
      const user = await request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ profilePhotos }),
      });
      setSession((current) => (current ? { ...current, user } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "写真を更新できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(input: UpdateProfileInput) {
    setLoading(true);
    setError("");
    try {
      const user = await request<User>("/users/me", { method: "PATCH", body: JSON.stringify(input) });
      setSession((current) => (current ? { ...current, user } : current));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "プロフィールを更新できませんでした";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  function submitMatchFeedback(hangout: Hangout) {
    const reasons = [
      ["TIME", "時間が合わない"],
      ["DISTANCE", "距離が遠い"],
      ["FULL", "希望人数と違う"],
      ["BUDGET", "予算が合わない"],
      ["CONDITIONS", "参加条件が合わない"],
      ["OTHER", "その他"],
    ] as const;
    Alert.alert("合わない理由", "次回のおすすめ改善にだけ利用します。", [
      ...reasons.map(([reason, label]) => ({
        text: label,
        onPress: () => void request("/analytics/match-feedback", {
          method: "POST",
          body: JSON.stringify({ hangoutId: hangout.id, outcome: "NOT_MATCHED", reason }),
        }).then(() => Alert.alert("送信しました", "おすすめ改善に反映しました。"))
          .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "理由を送信できませんでした")),
      })),
      { text: "閉じる", style: "cancel" },
    ]);
  }

  function confirmDeleteAccount() {
    if (demoRole) {
      Alert.alert("デモアカウント", "共有デモアカウントは削除できません。");
      return;
    }
    Alert.alert("アカウントを削除", "プロフィール、募集、申請、トークなど関連データが削除されます。この操作は取り消せません。", [
      { text: "キャンセル", style: "cancel" },
      {
        text: "完全に削除",
        style: "destructive",
        onPress: () => void deleteAccount(),
      },
    ]);
  }
  async function deleteAccount() {
    setLoading(true);
    setError("");
    try {
      await request("/users/me", { method: "DELETE" });
      logout();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "アカウントを削除できませんでした");
    } finally {
      setLoading(false);
    }
  }

  if (restoring)
    return (
      <SafeAreaView style={styles.restore}>
        <ActivityIndicator color="#176b48" />
        <Text style={styles.restoreText}>ログイン状態を確認しています…</Text>
      </SafeAreaView>
    );

  if (!session) {
    return <AuthScreen loading={loading} error={error} onLogin={authenticate} onRegister={register} onLine={authenticateWithLine} onX={authenticateWithX} onGoogle={()=>authenticateWithOAuth('google')} onApple={()=>authenticateWithOAuth('apple')} onPhone={authenticateWithPhone} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {demoRole && !(screen === "chat" && selectedRoom) && (
        <View style={styles.demoBanner}>
          <View>
            <Text style={styles.demoTitle}>デモ：{demoRole === "host" ? "マミ（主催者）" : "マドカ（参加者）"}として体験中</Text>
            <Text style={styles.demoHint}>{demoRole === "host" ? "作成・承認・終了・★1〜5評価を操作" : "参加申請・トーク・★1〜5評価を操作"}</Text>
          </View>
          <View style={styles.demoBannerActions}>
            <Pressable onPress={confirmResetDemo} style={styles.resetDemoButton}><Text style={styles.switchText}>最初から</Text></Pressable>
            <Pressable onPress={logout} style={styles.switchButton}><Text style={styles.switchText}>役割切替</Text></Pressable>
          </View>
        </View>
      )}
      {screen !== "chat" && (
        <View style={styles.header}>
          <Text style={styles.brand}>
            Hangout <Text style={styles.brandAccent}>Now</Text>
          </Text>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel="通知" style={styles.notificationButton} onPress={() => setScreen("notifications")}>
              <Text style={styles.notificationBell}>●</Text>
              {notificationInbox.unreadCount > 0 && <Text style={styles.notificationBadge}>{notificationInbox.unreadCount > 99 ? "99+" : notificationInbox.unreadCount}</Text>}
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="自分のプロフィールを表示" style={styles.headerProfileButton} onPress={() => setScreen("profile")}>
              <Text style={styles.userName} numberOfLines={1}>{session.user.displayName}</Text>
              {session.user.profilePhoto ? <Image source={{ uri: session.user.profilePhoto }} style={styles.headerProfilePhoto} /> : <View style={styles.headerProfileFallback}><Text style={styles.headerProfileInitial}>{session.user.displayName.slice(0, 1)}</Text></View>}
            </Pressable>
          </View>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.content}>
        {screen === "home" && <HomeScreen user={session.user} hangouts={hangouts} refreshing={refreshing} locationLabel={locationLabel} selectedArea={selectedArea} demoRole={demoRole} onArea={chooseArea} onLocation={useCurrentLocation} onMap={() => setScreen("map")} onRefresh={refreshCurrent} onOpen={openHangout} onHeart={toggleHeart} onCreate={() => setScreen(session.user.verificationStatus === "PHONE_VERIFIED" ? "create" : "phone")} />}
        {screen === "map" && <MapScreen hangouts={hangouts} locationLabel={locationLabel} onBack={() => setScreen("home")} onLocation={useCurrentLocation} onOpen={openHangout} />}
        {screen === "create" && <CreateHangoutScreen area={selectedArea} onBack={() => setScreen("home")} onSubmit={createHangout} />}
        {screen === "detail" && selectedHangout && <HangoutDetailScreen user={session.user} hangout={selectedHangout} requests={joinRequests} onBack={() => setScreen("home")} onJoin={joinHangout} onChat={openHangoutChat} onStart={startHangout} onFinish={confirmFinishHangout} onCancel={confirmCancelHangout} onEdit={updateHangout} onDecide={decideJoinRequest} onReport={confirmReportHost} onAttendance={updateAttendance} onMatchFeedback={submitMatchFeedback} />}
        {screen === "phone" && <PhoneVerificationScreen onBack={() => setScreen("profile")} onVerify={verifyPhone} />}
        {screen === "chat" && <ChatScreen user={session.user} rooms={rooms} selectedRoom={selectedRoom} messages={messages} messageBody={messageBody} sending={sending} refreshing={refreshing} unreadByRoom={unreadByRoom} realtimeOnline={realtimeOnline} onRefresh={refreshCurrent} onOpen={openRoom} onRate={rateParticipant} onBack={() => selectedRoom ? setSelectedRoom(null) : setScreen("home")} onChangeBody={setMessageBody} onSend={sendMessage} />}
        {screen === "rating" && ratingRoom && <RatingScreen user={session.user} room={ratingRoom} onRate={rateParticipant} onDone={() => { setRatingRoom(null); setScreen("home"); }} />}
        {screen === "profile" && <ProfileScreen user={session.user} hostStatus={hostStatus} activity={profileActivity} demo={!!demoRole} onChat={() => { setSelectedRoom(null); setScreen("chat"); }} onOpenHangout={(id) => void openHangout({ id })} onPhone={() => setScreen("phone")} onPhoto={chooseProfilePhoto} onSave={updateProfile} onDelete={confirmDeleteAccount} onLogout={logout} />}
        {screen === "notifications" && <NotificationScreen inbox={notificationInbox} refreshing={refreshing} onBack={() => setScreen("home")} onRefresh={refreshCurrent} onEnabled={setNotificationEnabled} onRead={readNotification} onReadAll={readAllNotifications} />}
      </View>
      {!selectedRoom && ["home", "map", "chat", "profile"].includes(screen) && (
        <View style={styles.nav}>
          {(
            [
              ["home", "ホーム"],
              ["map", "マップ"],
              ["chat", "トーク"],
            ] as const
          ).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => {
                setSelectedRoom(null);
                setScreen(value);
              }}
              style={styles.navItem}
            >
              {value === "map" ? (
                <View style={styles.mapNavIconWrap}>
                  <View style={[styles.mapNavPin, screen === value && styles.mapNavPinOn]}>
                    <View style={styles.mapNavPinCenter} />
                  </View>
                </View>
              ) : (
                <View style={[styles.navMark, screen === value && styles.navMarkOn]} />
              )}
              <Text style={[styles.navLabel, screen === value && styles.navOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#d9ff68" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function AuthScreen({ loading, error, onLogin, onRegister, onLine, onX, onGoogle, onApple, onPhone }: { loading: boolean; error: string; onLogin: (email: string, password: string, role?: "host" | "guest" | null) => Promise<void>; onRegister: (input: { email: string; password: string; displayName: string; birthDate: string; gender: string }) => Promise<void>; onLine: (input?: { displayName: string; birthDate: string; gender: string }) => Promise<void>; onX: () => Promise<void>; onGoogle:()=>Promise<void>;onApple:()=>Promise<void>;onPhone:(phone:string,code?:string,challengeToken?:string)=>Promise<{challengeToken?:string;demoCode?:string}> }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("1990-01-01");
  const [gender, setGender] = useState("UNDISCLOSED");
  const [providerNote, setProviderNote] = useState("");
  const [phone,setPhone]=useState("+81");const[phoneCode,setPhoneCode]=useState("");const[phoneChallenge,setPhoneChallenge]=useState<string|null>(null);
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled">
        <Text style={styles.authBrand}>
          Hangout <Text style={styles.brandAccent}>Now</Text>
        </Text>
        <Image source={{ uri: ACTIVITY_PHOTO_URL }} style={styles.authPhoto} />
        <View style={styles.demoCard}>
          <Text style={styles.demoPill}>公開デモ・すべて架空のデータです</Text>
          <Text style={styles.demoHeading}>役割を選んですぐに体験</Text>
          <Text style={styles.demoDescription}>登録や電話番号入力は必要ありません。</Text>
          <View style={styles.demoRow}>
            <Pressable disabled={loading} style={styles.roleButton} onPress={() => onLogin("", "", "host")}>
              <Text style={styles.roleTitle}>主催者として見る</Text>
              <Text style={styles.roleHint}>募集管理・承認</Text>
            </Pressable>
            <Pressable disabled={loading} style={[styles.roleButton, styles.roleGuest]} onPress={() => onLogin("", "", "guest")}>
              <Text style={styles.roleTitle}>参加者として見る</Text>
              <Text style={styles.roleHint}>検索・トーク</Text>
            </Pressable>
          </View>
        </View>
        <View style={styles.authCard}>
          <Text style={styles.eyebrow}>今から、誰かと。</Text>
          <Text style={styles.authTitle}>{mode === "login" ? "おかえりなさい" : "アカウントを作る"}</Text>
          <Field label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {mode === "register" && (
            <>
              <Field label="表示名" value={displayName} onChangeText={setDisplayName} />
              <Field label="生年月日" value={birthDate} onChangeText={setBirthDate} />
              <Text style={styles.label}>性別</Text>
              <View style={styles.genderChoices}>
                {[
                  ["UNDISCLOSED", "回答しない"],
                  ["MALE", "男性"],
                  ["FEMALE", "女性"],
                  ["OTHER", "その他"],
                ].map(([value, label]) => (
                  <Pressable key={value} style={[styles.genderChoice, gender === value && styles.genderChoiceOn]} onPress={() => setGender(value)}>
                    <Text style={styles.genderChoiceText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Field label="パスワード" value={password} onChangeText={setPassword} secureTextEntry />
          {error ? <Text style={styles.authError}>{error}</Text> : null}
          <Pressable
            disabled={loading}
            style={styles.primary}
            onPress={() =>
              mode === "login"
                ? onLogin(email, password)
                : onRegister({
                    email,
                    password,
                    displayName,
                    birthDate,
                    gender,
                  })
            }
          >
            <Text style={styles.primaryText}>{loading ? "接続中…" : mode === "login" ? "ログイン" : "無料で登録"}</Text>
          </Pressable>
          <View style={styles.authDividerRow}>
            <View style={styles.authDividerLine} />
            <Text style={styles.authDividerText}>または</Text>
            <View style={styles.authDividerLine} />
          </View>
          {(["Google", "Apple", "X", "LINE", "電話番号"] as const).map((provider) => (
            <Pressable
              key={provider}
              style={styles.providerButton}
              onPress={() => provider === "LINE" ? void onLine() : provider === "X" ? void onX() : provider==="Google"?void onGoogle():provider==="Apple"?void onApple():setPhoneChallenge("")}
            >
              <Text style={styles.providerMark}>{provider === "Google" ? "G" : provider === "Apple" ? "●" : provider === "X" ? "X" : provider === "LINE" ? "L" : "☎"}</Text>
              <Text style={styles.providerButtonText}>{provider}{mode === "register" ? "でアカウント作成" : "でログイン"}</Text>
            </Pressable>
          ))}
          {phoneChallenge!==null?<View><Field label="電話番号（国番号から）" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />{phoneChallenge?<Field label="6桁の認証コード" value={phoneCode} onChangeText={setPhoneCode} keyboardType="number-pad" />:null}<Pressable disabled={loading} style={styles.primary} onPress={async()=>{try{const result=await onPhone(phone,phoneCode,phoneChallenge||undefined);if(result.challengeToken){setPhoneChallenge(result.challengeToken);setProviderNote(result.demoCode?`開発用コード：${result.demoCode}`:'SMSに認証コードを送信しました')}}catch{}}}><Text style={styles.primaryText}>{phoneChallenge?'アカウント作成・ログイン':'認証コードを送る'}</Text></Pressable></View>:null}
          <Text style={styles.providerNote}>{providerNote}</Text>
          <Pressable onPress={() => setMode(mode === "login" ? "register" : "login")}>
            <Text style={styles.authSwitch}>{mode === "login" ? "新しくアカウントを作る" : "アカウントをお持ちの方はログイン"}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...input} style={styles.input} placeholderTextColor="#8a918c" />
    </View>
  );
}

function CountdownText({ startAt, style }: { startAt: string; style?: object }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.max(0, Math.ceil((new Date(startAt).getTime() - now) / 1000));
  const label = seconds === 0 ? "開始時刻です" : `開始まで ${String(Math.floor(seconds / 3600)).padStart(2, "0")}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return <Text style={style}>{label}</Text>;
}

function HomeScreen({ user, hangouts, refreshing, locationLabel, selectedArea, demoRole, onArea, onLocation, onMap, onRefresh, onOpen, onHeart, onCreate }: { user: User; hangouts: Hangout[]; refreshing: boolean; locationLabel: string; selectedArea: AlphaArea; demoRole: "host" | "guest" | null; onArea: (area: AlphaArea) => void; onLocation: () => void; onMap: () => void; onRefresh: () => void; onOpen: (hangout: Hangout) => void; onHeart: (hangout: Hangout) => void; onCreate: () => void }) {
  const [filter, setFilter] = useState<"おすすめ" | "30分後" | "1時間後" | "3時間後">("おすすめ");
  const homeStateLabel = (hangout: Hangout) => hangout.hostUserId === user.id && ["OPEN", "FULL"].includes(hangout.status) ? "主催中" : stateLabel(hangout);
  const timeLabel = (startAt: string) => {
    const minutes = Math.max(0, Math.round((new Date(startAt).getTime() - Date.now()) / 60000));
    return minutes <= 45 ? "30分後" : minutes <= 90 ? "1時間後" : "3時間後";
  };
  const visibleHangouts = filter === "おすすめ" ? hangouts : hangouts.filter((hangout) => timeLabel(hangout.startAt) === filter);
  const conditionLabel = (hangout: Hangout) => `${hangout.genderRestriction === "MALE_ONLY" ? "男性のみ" : hangout.genderRestriction === "FEMALE_ONLY" ? "女性のみ" : "だれでも"}${hangout.maxAge ? `・${hangout.maxAge === 29 ? "20代" : hangout.maxAge === 39 ? "30代" : "50代"}まで` : ""}`;
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {demoRole && <View style={styles.demoJourney}><Text style={styles.demoJourneyTitle}>デモ：マミの飲み企画</Text><Text style={styles.demoJourneyText}>1. 主催者は30代女性のマミ{`\n`}2. 20代男性のマサヤは承認済み{`\n`}3. 30代女性のマドカはHangoutを検索中{`\n`}4. マドカが途中参加を申請{`\n`}5. 承認後はグループトークで会話</Text><Text style={styles.demoJourneyHint}>「マミと新宿で気軽に飲もう」を開いて試せます。</Text></View>}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{locationLabel === "エリア未設定" ? user.homeArea || locationLabel : locationLabel}</Text>
        <Text style={styles.heroTitle}>今から{`\n`}何する？</Text>
        <View style={styles.areaRow}>
          {(["新宿", "渋谷"] as const).map((area) => (
            <Pressable key={area} style={[styles.areaButton, selectedArea === area && styles.areaButtonOn]} onPress={() => onArea(area)}>
              <Text style={[styles.areaText, selectedArea === area && styles.areaTextOn]}>{area}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.homeActions}>
          <Pressable style={styles.locationButton} onPress={onLocation}>
            <Text style={styles.locationText}>現在地から近い順</Text>
          </Pressable>
          <Pressable style={styles.createButton} onPress={onCreate}>
            <Text style={styles.primaryText}>Hangoutを作る</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(["おすすめ", "30分後", "1時間後", "3時間後"] as const).map((value) => <Pressable key={value} style={[styles.filterPill, filter === value && styles.filterPillOn]} onPress={() => setFilter(value)}><Text style={[styles.filterPillText, filter === value && styles.filterPillTextOn]}>{value}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>近くのHangout</Text>
        <View style={styles.sectionHeadActions}><Text style={styles.muted}>{visibleHangouts.length}件・おすすめ順</Text><Pressable style={styles.homeMapButton} onPress={onMap} accessibilityRole="button" accessibilityLabel="近くのHangoutをマップで表示"><Text style={styles.homeMapButtonText}>マップ</Text></Pressable></View>
      </View>
      {visibleHangouts.map((hangout) => (
        <Pressable key={hangout.id} style={styles.card} onPress={() => onOpen(hangout)}>
          <Image source={{ uri: hangoutImageUrl(hangout) }} style={styles.activityPhoto} resizeMode="cover" />
          <Pressable style={[styles.heartButton, hangout.hearted && styles.heartButtonOn]} onPress={(event) => { event.stopPropagation(); onHeart(hangout); }} accessibilityRole="button" accessibilityLabel={hangout.hearted ? "ハートを取り消す" : "ハートを送る"}>
            <Text style={[styles.heartIcon, hangout.hearted && styles.heartIconOn]}>{hangout.hearted ? "♥" : "♡"}</Text>
            <Text style={[styles.heartCount, hangout.hearted && styles.heartIconOn]}>{hangout.heartCount}</Text>
          </Pressable>
          <View style={styles.cardTop}>
            <View style={styles.cardCopy}>
              <Text style={styles.cardCategory}>{hangout.category}</Text>
              <Text style={styles.cardTitle}>{hangout.title}</Text>
              <View style={styles.cardMetaRow}><CountdownText startAt={hangout.startAt} style={styles.muted} />{hangout.distanceKm != null && <Text style={styles.muted}>・ 約{hangout.distanceKm}km</Text>}</View>
              <Text style={styles.muted}>{hangout.publicLocationName || hangout.locationName}</Text>
              <Text style={styles.muted}>
                参加 {hangout.participantCount} / {hangout.maxParticipants}人 ・ {conditionLabel(hangout)}
              </Text>
            </View>
            <Text style={styles.status}>{homeStateLabel(hangout)}</Text>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.cardHostRow}>
              {hangout.host.profilePhoto ? <Image source={{ uri: hangout.host.profilePhoto }} style={styles.cardHostPhoto} /> : <View style={styles.cardHostFallback}><Text style={styles.cardHostInitial}>{hangout.host.displayName.slice(0,1)}</Text></View>}
              <View>
                <Text style={styles.hostName}>{hangout.host.displayName}{hangout.host.verification === "PHONE_VERIFIED" ? " ・確認済み" : ""}</Text>
                <Text style={styles.hostTier}>{hangout.host.hostStatus?.label || "ホワイト"}{hangout.host.hostStatus?.hostAverageRating ? ` ・ 主催評価 ★ ${hangout.host.hostStatus.hostAverageRating}` : " ・ 主催評価なし"}</Text>
              </View>
            </View>
            <View style={styles.cardMatchWrap}><Text style={styles.cardMatchLabel}>相性</Text><Text style={styles.cardMatchScore}>{Math.round(hangout.matchScore ?? 70)}%</Text></View>
          </View>
        </Pressable>
      ))}
      {!visibleHangouts.length && <Text style={styles.empty}>この時間の募集はまだありません。{`\n`}エリアを変更して探してみてください。</Text>}
    </ScrollView>
  );
}

function MapScreen({ hangouts, locationLabel, onBack, onLocation, onOpen }: { hangouts: Hangout[]; locationLabel: string; onBack: () => void; onLocation: () => void; onOpen: (hangout: Hangout) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.mapPage}>
      <Pressable style={styles.mapBackButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Hangout一覧に戻る">
        <Text style={styles.mapBackIcon}>‹</Text>
      </Pressable>
      <View style={styles.mapHeading}>
        <View>
          <Text style={styles.eyebrow}>{locationLabel}</Text>
          <Text style={styles.pageTitle}>近くのマップ</Text>
        </View>
        <Pressable style={styles.mapLocationButton} onPress={onLocation}>
          <Text style={styles.locationText}>現在地を更新</Text>
        </Pressable>
      </View>
      <View style={styles.mapCanvas}>
        <View style={[styles.mapRoad, styles.mapRoadHorizontal]} />
        <View style={[styles.mapRoad, styles.mapRoadVertical]} />
        <View style={styles.mapYou}><Text style={styles.mapYouText}>現在地</Text></View>
        {hangouts.slice(0, 5).map((hangout, index) => (
          <Pressable key={hangout.id} style={[styles.mapPin, MAP_PIN_POSITIONS[index]]} onPress={() => onOpen(hangout)}>
            <Text style={styles.mapPinText}>{index + 1}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.mapResultHeading}>
        <Text style={styles.mapResultHeadingTitle}>このマップのHangout</Text>
        <Text style={styles.mapResultHeadingCount}>{Math.min(hangouts.length, 5)}件</Text>
      </View>
      {hangouts.slice(0, 5).map((hangout, index) => (
        <Pressable key={hangout.id} style={styles.mapResultCard} onPress={() => onOpen(hangout)}>
          <Text style={styles.mapResultNumber}>{index + 1}</Text>
          <View style={styles.cardCopy}>
            <Text style={styles.cardTitle}>{hangout.title}</Text>
            <Text style={styles.muted}>{hangout.locationName} ・ {hangout.participantCount}/{hangout.maxParticipants}人</Text>
          </View>
          <Text style={styles.detailLink}>詳細 ›</Text>
        </Pressable>
      ))}
      {!hangouts.length && <Text style={styles.empty}>現在地周辺のHangoutはありません。</Text>}
      <Text style={styles.mapPrivacy}>承認前は概略エリアのみ表示します。正確な集合場所は承認後に確認できます。</Text>
    </ScrollView>
  );
}

type CreateField = "title" | "publicLocationName" | "meetingPlaceName" | "meetingAddress" | "maxParticipants";

function CreateHangoutScreen({ area, onBack, onSubmit }: { area: AlphaArea; onBack: () => void; onSubmit: (input: CreateHangoutInput) => void }) {
  const [form, setForm] = useState<CreateHangoutInput>({
    title: "",
    description: "",
    category: "ラーメン",
    startInMinutes: 30,
    publicLocationName: `${area}駅周辺`,
    locationName: "",
    meetingPlaceName: "",
    meetingAddress: "",
    navigationUrl: "",
    maxParticipants: 4,
    genderRestriction: "ANY",
    maxAge: null,
    area,
  });
  const [errors, setErrors] = useState<Partial<Record<CreateField, string>>>({});
  const update = <K extends keyof CreateHangoutInput>(key: K, value: CreateHangoutInput[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const chooseHangoutImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("写真へのアクセスが必要です", "Hangoutの画像を選ぶため、写真ライブラリへのアクセスを許可してください。");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.72,
      base64: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) return;
    const mediaType = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpeg";
    update("imageUrl", `data:image/${mediaType};base64,${asset.base64}`);
  };
  const publish = () => {
    const next: Partial<Record<CreateField, string>> = {};
    if (!form.title.trim()) next.title = "タイトルを入力してください";
    if (!form.publicLocationName.trim()) next.publicLocationName = "公開エリアを入力してください";
    if (!form.meetingPlaceName.trim()) next.meetingPlaceName = "集合場所の店名を入力してください";
    if (!form.meetingAddress.trim()) next.meetingAddress = "集合場所の住所を入力してください";
    if (form.maxParticipants < 2) next.maxParticipants = "合計人数は2人以上にしてください";
    setErrors(next);
    if (Object.keys(next).length === 0) onSubmit({ ...form, locationName: `${form.meetingPlaceName.trim()} ${form.meetingAddress.trim()}`.trim() });
  };
  return (
    <ScrollView contentContainerStyle={styles.formPage}>
      <Pressable onPress={onBack}>
        <Text style={styles.backText}>‹ ホームへ</Text>
      </Pressable>
      <Text style={styles.pageTitle}>Hangoutを作る</Text>
      {Object.keys(errors).length > 0 && <Text style={styles.validationMessage}>入力内容を確認してください。赤枠の項目を設定すると公開できます。</Text>}
      <Text style={styles.safetyNote}>安全のため集合場所は駅・店舗など公開された場所に限ります。店名・住所・正確な位置は承認された参加者だけに表示されます。</Text>
      <Text style={styles.label}>Hangoutのイメージ写真</Text>
      <Pressable style={styles.imagePickerButton} onPress={() => void chooseHangoutImage()}>
        <Text style={styles.imagePickerButtonText}>{form.imageUrl ? "写真を変更" : "スマホの写真から追加"}</Text>
      </Pressable>
      {form.imageUrl ? <Image source={{ uri: form.imageUrl }} style={styles.createImagePreview} resizeMode="cover" /> : null}
      <Text style={styles.label}>Hangout Nowの画像を使う</Text>
      <View style={styles.providedImageGrid}>
        {([
          ["カフェ", DEFAULT_HANGOUT_IMAGES.CAFE],
          ["ラーメン", DEFAULT_HANGOUT_IMAGES.FOOD],
          ["ランニング", DEFAULT_HANGOUT_IMAGES.RUNNING],
          ["飲み会", DEFAULT_HANGOUT_IMAGES.DRINKING],
        ] as const).map(([label, uri]) => (
          <Pressable key={label} style={[styles.providedImageChoice, form.imageUrl === uri && styles.providedImageChoiceOn]} onPress={() => {
            const preset = HANGOUT_IMAGE_PRESETS.find((item) => item.uri === uri);
            if (!preset) return;
            setForm((current) => ({ ...current, imageUrl: preset.uri, category: preset.category, title: preset.title, description: preset.description }));
            setErrors((current) => ({ ...current, title: undefined }));
          }}>
            <Image source={{ uri }} style={styles.providedImagePhoto} />
            <Text style={styles.providedImageLabel}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>公開エリア（新宿・渋谷のみ）</Text>
      <View style={styles.areaRow}>
        {(["新宿", "渋谷"] as const).map((item) => (
          <Pressable
            key={item}
            style={[styles.areaButton, form.area === item && styles.areaButtonOn]}
            onPress={() =>
              setForm((v) => ({
                ...v,
                area: item,
                publicLocationName: `${item}駅周辺`,
              }))
            }
          >
            <Text style={[styles.areaText, form.area === item && styles.areaTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>何する？</Text>
      <TextInput style={[styles.input, errors.title && styles.invalidInput]} value={form.title} onChangeText={(title) => update("title", title)} placeholder="例：30分後にラーメン" maxLength={80} />
      {errors.title && <Text style={styles.fieldError}>{errors.title}</Text>}
      <Text style={styles.label}>カテゴリ</Text>
      <View style={styles.choiceRow}>
        {["ラーメン", "ウォーキング", "ランニング"].map((category) => (
          <Pressable key={category} style={[styles.choice, form.category === category && styles.choiceOn]} onPress={() => setForm((v) => ({ ...v, category }))}>
            <Text>{category}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>開始まで</Text>
      <View style={styles.choiceRow}>
        {([30, 60, 180] as const).map((minutes) => (
          <Pressable key={minutes} style={[styles.choice, form.startInMinutes === minutes && styles.choiceOn]} onPress={() => setForm((v) => ({ ...v, startInMinutes: minutes }))}>
            <Text>{minutes === 180 ? "3時間" : `${minutes}分`}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>承認前に表示するエリア</Text>
      <TextInput style={[styles.input, errors.publicLocationName && styles.invalidInput]} value={form.publicLocationName} onChangeText={(value) => update("publicLocationName", value)} maxLength={100} />
      {errors.publicLocationName && <Text style={styles.fieldError}>{errors.publicLocationName}</Text>}
      <View style={styles.privatePlaceBox}>
        <Text style={styles.privatePlaceTitle}>承認後に表示する集合場所</Text>
        <Text style={styles.privacyText}>店名・住所・ナビ情報は承認したメンバーだけに表示します。</Text>
        <Text style={styles.label}>店名</Text>
        <TextInput style={[styles.input, errors.meetingPlaceName && styles.invalidInput]} value={form.meetingPlaceName} onChangeText={(value) => update("meetingPlaceName", value)} maxLength={100} />
        {errors.meetingPlaceName && <Text style={styles.fieldError}>{errors.meetingPlaceName}</Text>}
        <Text style={styles.label}>住所</Text>
        <TextInput style={[styles.input, errors.meetingAddress && styles.invalidInput]} value={form.meetingAddress} onChangeText={(value) => update("meetingAddress", value)} maxLength={200} />
        {errors.meetingAddress && <Text style={styles.fieldError}>{errors.meetingAddress}</Text>}
        <Text style={styles.label}>ナビアプリの共有URL（任意）</Text>
        <TextInput style={styles.input} value={form.navigationUrl} onChangeText={(value) => update("navigationUrl", value)} autoCapitalize="none" keyboardType="url" maxLength={500} />
      </View>
      <Text style={styles.label}>合計人数（主催者1人を含む）</Text>
      <View style={[styles.choiceRow, errors.maxParticipants && styles.invalidGroup]}>{[2, 3, 4, 5, 6, 7, 8].map((count) => <Pressable key={count} style={[styles.choice, form.maxParticipants === count && styles.choiceOn]} onPress={() => update("maxParticipants", count)}><Text>{count}人</Text></Pressable>)}</View>
      {errors.maxParticipants && <Text style={styles.fieldError}>{errors.maxParticipants}</Text>}
      <Text style={styles.label}>参加できる性別</Text>
      <View style={styles.choiceRow}>
        {([['ANY', 'だれでも'], ['MALE_ONLY', '男性のみ'], ['FEMALE_ONLY', '女性のみ']] as const).map(([value, label]) => (
          <Pressable key={value} style={[styles.choice, form.genderRestriction === value && styles.choiceOn]} onPress={() => update("genderRestriction", value)}><Text>{label}</Text></Pressable>
        ))}
      </View>
      <Text style={styles.label}>年齢上限</Text>
      <View style={styles.choiceRow}>
        {([[null, '制限なし'], [29, '20代まで'], [39, '30代まで'], [59, '50代まで']] as const).map(([value, label]) => (
          <Pressable key={label} style={[styles.choice, form.maxAge === value && styles.choiceOn]} onPress={() => update("maxAge", value)}><Text>{label}</Text></Pressable>
        ))}
      </View>
      <Text style={styles.label}>ひとこと</Text>
      <TextInput style={[styles.input, styles.multiline]} value={form.description} onChangeText={(description) => setForm((v) => ({ ...v, description }))} multiline maxLength={500} />
      <Pressable style={styles.primary} onPress={publish}>
        <Text style={styles.primaryText}>Hangout公開</Text>
      </Pressable>
    </ScrollView>
  );
}

function HangoutDetailScreen({ user, hangout, requests, onBack, onJoin, onChat, onStart, onFinish, onCancel, onEdit, onDecide, onReport, onAttendance, onMatchFeedback }: { user: User; hangout: Hangout; requests: JoinRequest[]; onBack: () => void; onJoin: (hangout: Hangout, message: string) => Promise<void>; onChat: (id: string) => void; onStart: (id: string) => void; onFinish: (id: string) => void; onCancel: (id: string) => void; onEdit: (hangoutId: string, input: Partial<CreateHangoutInput>) => Promise<void>; onDecide: (id: string, accept: boolean) => void; onReport: (hangout: Hangout) => void; onAttendance: (status: "CONFIRMED" | "CANCELLED") => void; onMatchFeedback: (hangout: Hangout) => void }) {
  const isHost = hangout.hostUserId === user.id;
  const ineligibleReason = eligibilityReason(user, hangout);
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantProfile | null>(null);
  const [joining, setJoining] = useState(false);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <ScrollView contentContainerStyle={styles.formPage}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>‹ 一覧へ</Text>
        </Pressable>
        <Image source={{ uri: hangoutImageUrl(hangout) }} style={styles.detailPhoto} resizeMode="cover" />
        <Text style={styles.eyebrow}>
          {hangout.category} ・ {stateLabel(hangout)}
        </Text>
        <Text style={styles.pageTitle}>{hangout.title}</Text>
        <Text style={styles.detailMeta}>
          {new Date(hangout.startAt).toLocaleString("ja-JP")} ／ {hangout.participantCount} / {hangout.maxParticipants}人
        </Text>
        <CountdownText startAt={hangout.startAt} style={styles.detailMeta} />
        <View style={styles.detailPanel}>
          <Text style={styles.label}>集合場所</Text>
          <Text>{hangout.locationName}</Text>
          <Text style={styles.privacyText}>{hangout.myJoinStatus === "ACCEPTED" || isHost ? "承認済みのため詳細を表示しています。" : "参加承認までは、おおまかな場所だけが表示されます。"}</Text>
          {hangout.description && <Text style={styles.description}>{hangout.description}</Text>}
          <Text style={styles.detailCondition}>{hangout.genderRestriction === "MALE_ONLY" ? "男性のみ" : hangout.genderRestriction === "FEMALE_ONLY" ? "女性のみ" : "性別条件なし"}{hangout.maxAge ? ` ・ ${hangout.maxAge}歳以下` : " ・ 年齢制限なし"}</Text>
          {(isHost || hangout.myJoinStatus === "ACCEPTED") && hangout.navigationUrl ? (
            <Pressable style={styles.mapLocationButton} onPress={() => void Linking.openURL(hangout.navigationUrl!)}><Text style={styles.locationText}>地図アプリでナビ開始</Text></Pressable>
          ) : null}
        </View>
        {(isHost || hangout.myJoinStatus === "ACCEPTED") && (
          <Pressable style={styles.talkButtonWide} onPress={() => onChat(hangout.id)}>
            <Text style={styles.talkButtonWideText}>トーク</Text>
          </Pressable>
        )}
        {!isHost && hangout.myJoinStatus === "ACCEPTED" && (
          <View style={styles.detailPanel}>
            <Text style={styles.hostName}>{hangout.myAttendanceStatus === "CONFIRMED" ? "参加予定として回答済み" : "開始前の出欠確認"}</Text>
            <Text style={styles.muted}>予定が変わった場合は早めにお知らせください。</Text>
            <View style={styles.requestActions}>
              <Pressable style={styles.rejectButton} onPress={() => onAttendance("CANCELLED")}>
                <Text>キャンセル</Text>
              </Pressable>
              <Pressable style={styles.acceptButton} onPress={() => onAttendance("CONFIRMED")}>
                <Text style={styles.primaryText}>参加する</Text>
              </Pressable>
            </View>
          </View>
        )}
        {!isHost && hangout.myJoinStatus === "WAITLISTED" && (
          <View style={styles.detailPanel}>
            <Text style={styles.hostName}>待機リストに登録済み</Text>
            <Text style={styles.muted}>空席が出たら通知します。集合場所の詳細は承認後に表示されます。</Text>
          </View>
        )}
        {!isHost && hangout.myJoinStatus === "PENDING" && (
          <Pressable disabled style={[styles.primary, styles.disabledButton]} accessibilityState={{ disabled: true }}>
            <Text style={styles.primaryText}>申請中</Text>
          </Pressable>
        )}
        {!isHost && !hangout.myJoinStatus && hangout.status === "OPEN" && (
          <Pressable disabled={!!ineligibleReason} style={[styles.primary, !!ineligibleReason && styles.disabledButton]} onPress={() => setJoining(true)}>
            <Text style={styles.primaryText}>{ineligibleReason || "参加したい"}</Text>
          </Pressable>
        )}
        {!isHost && !hangout.myJoinStatus && user.matchingDataConsent && (
          <View style={styles.matchFeedbackPanel}>
            <Text style={styles.muted}>この募集が合わない場合</Text>
            <Pressable style={styles.matchFeedbackButton} onPress={() => onMatchFeedback(hangout)}>
              <Text style={styles.matchFeedbackButtonText}>合わない理由を送る</Text>
            </Pressable>
          </View>
        )}
        {!isHost && (
          <Pressable style={styles.reportButton} onPress={() => onReport(hangout)}>
            <Text style={styles.reportText}>この募集の主催者を通報・ブロック</Text>
          </Pressable>
        )}
        {isHost && hangout.status === "FINISHED" && (
          <Pressable style={styles.cancelHangoutButton} onPress={() => onCancel(hangout.id)}><Text style={styles.cancelHangoutButtonText}>Hangout削除</Text></Pressable>
        )}
        {isHost && hangout.status !== "FINISHED" && (
          <>
            <Pressable style={styles.editHangoutButton} onPress={() => setEditing(true)}><Text style={styles.editHangoutButtonText}>Hangout編集</Text></Pressable>
            <Pressable style={styles.cancelHangoutButton} onPress={() => onCancel(hangout.id)}><Text style={styles.cancelHangoutButtonText}>Hangout削除</Text></Pressable>
            <Text style={styles.sectionTitle}>参加申請</Text>
            {requests.map((item) => (
              <View key={item.id} style={styles.requestCard}>
                <View style={styles.cardCopy}>
                  <Text style={styles.hostName}>
                    {item.user.displayName}
                    {item.user.verification === "PHONE_VERIFIED" ? " ・電話確認済み" : ""}
                  </Text>
                  <Text style={styles.muted}>
                    {item.message || "メッセージなし"} ／ {item.status}
                  </Text>
                  <Pressable onPress={() => setSelectedApplicant(item.user)}>
                    <Text style={styles.applicantProfileLink}>プロフィールを見る ›</Text>
                  </Pressable>
                </View>
                {item.status === "PENDING" && (
                  <View style={styles.requestActions}>
                    <Pressable style={styles.rejectButton} onPress={() => onDecide(item.id, false)}>
                      <Text>見送る</Text>
                    </Pressable>
                    <Pressable style={styles.acceptButton} onPress={() => onDecide(item.id, true)}>
                      <Text style={styles.primaryText}>承認</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            ))}
            {!requests.length && <Text style={styles.empty}>まだ申請はありません。</Text>}
            {['OPEN', 'FULL'].includes(hangout.status) && <Pressable style={styles.finishButtonWide} onPress={() => onStart(hangout.id)}><Text style={styles.primaryText}>Hangout開始</Text></Pressable>}
            {hangout.status === 'STARTED' && <Pressable style={styles.finishButtonWide} onPress={() => onFinish(hangout.id)}><Text style={styles.primaryText}>Hangout終了</Text></Pressable>}
          </>
        )}
      </ScrollView>
      <ApplicantProfileModal profile={selectedApplicant} onClose={() => setSelectedApplicant(null)} />
      <JoinRequestModal visible={joining} hangout={hangout} onClose={() => setJoining(false)} onSubmit={async (message) => { await onJoin(hangout, message); setJoining(false); }} />
      <EditHangoutModal visible={editing} hangout={hangout} onClose={() => setEditing(false)} onSave={async (input) => { await onEdit(hangout.id, input); setEditing(false); }} />
    </>
  );
}

function JoinRequestModal({ visible, hangout, onClose, onSubmit }: { visible: boolean; hangout: Hangout; onClose: () => void; onSubmit: (message: string) => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalPage}>
        <ScrollView contentContainerStyle={styles.formPage}>
          <Pressable onPress={onClose}><Text style={styles.backText}>‹ Hangoutに戻る</Text></Pressable>
          <Text style={styles.eyebrow}>参加申請</Text>
          <Text style={styles.pageTitle}>ひとこと添えて申請</Text>
          <Text style={styles.safetyNote}>{hangout.host.displayName}さんが参加可否を判断します。参加したい理由や当日の雰囲気が伝わるメッセージを書いてください。</Text>
          <Text style={styles.label}>主催者へのメッセージ</Text>
          <TextInput style={[styles.input, styles.multiline]} value={message} onChangeText={setMessage} multiline maxLength={200} placeholder="例：カフェ巡りが好きです。初参加ですが、よろしくお願いします！" />
          <Text style={styles.characterCount}>{message.trim().length} / 200文字</Text>
          <Pressable disabled={!message.trim() || submitting} style={[styles.primary, (!message.trim() || submitting) && styles.disabledButton]} onPress={() => { setSubmitting(true); void onSubmit(message.trim()).finally(() => setSubmitting(false)); }}>
            <Text style={styles.primaryText}>{submitting ? "申請中…" : "この内容で参加申請する"}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function EditHangoutModal({ visible, hangout, onClose, onSave }: { visible: boolean; hangout: Hangout; onClose: () => void; onSave: (input: Partial<CreateHangoutInput>) => Promise<void> }) {
  const [title, setTitle] = useState(hangout.title);
  const [description, setDescription] = useState(hangout.description ?? "");
  const [publicLocationName, setPublicLocationName] = useState(hangout.publicLocationName ?? "");
  const [meetingPlaceName, setMeetingPlaceName] = useState(hangout.meetingPlaceName ?? "");
  const [meetingAddress, setMeetingAddress] = useState(hangout.meetingAddress ?? "");
  const [navigationUrl, setNavigationUrl] = useState(hangout.navigationUrl ?? "");
  const [genderRestriction, setGenderRestriction] = useState<"ANY" | "MALE_ONLY" | "FEMALE_ONLY">(hangout.genderRestriction);
  const [maxAge, setMaxAge] = useState<number | null>(hangout.maxAge);
  const [imageUrl, setImageUrl] = useState(hangout.imageUrl ?? undefined);
  const chooseImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("写真へのアクセスが必要です");
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.72, base64: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    const type = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpeg";
    setImageUrl(`data:image/${type};base64,${asset.base64}`);
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalPage}>
        <ScrollView contentContainerStyle={styles.formPage}>
          <Pressable onPress={onClose}><Text style={styles.backText}>‹ Hangout画面に戻る</Text></Pressable>
          <Text style={styles.pageTitle}>Hangoutを編集</Text>
          <Text style={styles.label}>Hangoutのイメージ写真</Text>
          <Pressable style={styles.imagePickerButton} onPress={() => void chooseImage()}><Text style={styles.imagePickerButtonText}>写真を変更</Text></Pressable>
          {imageUrl ? <Image source={{ uri: imageUrl }} style={styles.createImagePreview} /> : null}
          <Field label="タイトル" value={title} onChangeText={setTitle} maxLength={80} />
          <Field label="承認前に表示するエリア" value={publicLocationName} onChangeText={setPublicLocationName} maxLength={100} />
          <Field label="店名" value={meetingPlaceName} onChangeText={setMeetingPlaceName} maxLength={100} />
          <Field label="住所" value={meetingAddress} onChangeText={setMeetingAddress} maxLength={200} />
          <Field label="ナビアプリの共有URL（任意）" value={navigationUrl} onChangeText={setNavigationUrl} autoCapitalize="none" keyboardType="url" maxLength={500} />
          <Text style={styles.label}>参加できる性別</Text>
          <View style={styles.choiceRow}>{([['ANY','だれでも'],['MALE_ONLY','男性のみ'],['FEMALE_ONLY','女性のみ']] as const).map(([value,label]) => <Pressable key={value} style={[styles.choice, genderRestriction === value && styles.choiceOn]} onPress={() => setGenderRestriction(value)}><Text>{label}</Text></Pressable>)}</View>
          <Text style={styles.label}>年齢上限</Text>
          <View style={styles.choiceRow}>{([[null,'制限なし'],[29,'20代まで'],[39,'30代まで'],[59,'50代まで']] as const).map(([value,label]) => <Pressable key={label} style={[styles.choice, maxAge === value && styles.choiceOn]} onPress={() => setMaxAge(value)}><Text>{label}</Text></Pressable>)}</View>
          <Text style={styles.label}>説明</Text>
          <TextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline maxLength={500} />
          <Pressable style={styles.primary} onPress={() => void onSave({ title, description, imageUrl, publicLocationName, locationName: `${meetingPlaceName} ${meetingAddress}`.trim(), meetingPlaceName, meetingAddress, navigationUrl, genderRestriction, maxAge })}><Text style={styles.primaryText}>保存</Text></Pressable>
          <Pressable style={styles.secondary} onPress={onClose}><Text>キャンセル</Text></Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function ApplicantProfileModal({ profile, onClose }: { profile: ApplicantProfile | null; onClose: () => void }) {
  return (
    <Modal visible={profile !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.applicantModalBackdrop}>
        <View style={styles.applicantModalCard}>
          <View style={styles.profilePhotoTrio}>{[profile?.profilePhotos?.[1],profile?.profilePhotos?.[0]||profile?.profilePhoto,profile?.profilePhotos?.[2]].map((photo,index)=>photo?<Image key={`${photo}-${index}`} source={{uri:photo}} style={index===1?styles.applicantAvatar:styles.avatarSide}/>:<View key={`applicant-empty-${index}`} style={index===1?styles.applicantAvatarFallback:styles.avatarSideFallback}><Text style={styles.applicantAvatarText}>{index===1?(profile?.displayName.slice(0,1)||"☺"):"＋"}</Text></View>)}</View>
          <Text style={styles.applicantName}>{profile?.displayName}</Text>
          <Text style={styles.applicantMeta}>
            {profile?.age}歳{profile?.homeArea ? ` ・ ${profile.homeArea}` : ""}
          </Text>
          <Text style={styles.applicantVerification}>{profile?.verification === "PHONE_VERIFIED" ? "✓ 電話番号確認済み" : "電話番号未確認"}</Text>
          <Text style={styles.applicantBio}>{profile?.bio || "自己紹介はまだありません。"}</Text>
          <View style={styles.applicantInterests}>
            {profile?.interests.map((interest) => (
              <Text key={interest} style={styles.tag}>
                {interest}
              </Text>
            ))}
          </View>
          <Text style={styles.applicantPrivacyNote}>申請の判断に必要な公開プロフィールのみ表示しています。</Text>
          <Pressable style={styles.applicantCloseButton} onPress={onClose}>
            <Text style={styles.primaryText}>閉じる</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function PhoneVerificationScreen({ onBack, onVerify }: { onBack: () => void; onVerify: (phone: string, code?: string) => Promise<void> }) {
  const [phone, setPhone] = useState("+81");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  return (
    <ScrollView contentContainerStyle={styles.formPage}>
      <Pressable onPress={onBack}>
        <Text style={styles.backText}>‹ 戻る</Text>
      </Pressable>
      <Text style={styles.pageTitle}>電話番号を確認</Text>
      <Text style={styles.safetyNote}>安全なコミュニティ運営のため、募集作成にはSMS確認が必要です。番号は他の利用者には公開されません。</Text>
      <Text style={styles.label}>電話番号（国番号付き）</Text>
      <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+819012345678" />
      {sent && (
        <>
          <Text style={styles.label}>6桁の確認コード</Text>
          <TextInput style={styles.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
        </>
      )}
      <Pressable
        style={styles.primary}
        onPress={() =>
          void onVerify(phone, sent ? code : undefined).then(() => {
            if (!sent) setSent(true);
          })
        }
      >
        <Text style={styles.primaryText}>{sent ? "確認して完了" : "SMSを送信"}</Text>
      </Pressable>
    </ScrollView>
  );
}

function RatingScreen({ user, room, onRate, onDone }: { user: User; room: GroupRoom; onRate: (hangoutId: string, userId: string, score: number) => void; onDone: () => void }) {
  const members = room.members.filter((member) => member.id !== user.id && !member.myRatingScore);
  return (
    <ScrollView contentContainerStyle={styles.ratingScreen}>
      <Text style={styles.eyebrow}>Hangoutを終了しました</Text>
      <Text style={styles.ratingScreenTitle}>参加メンバーを評価</Text>
      <Text style={styles.ratingScreenDescription}>一緒に過ごしたメンバーを★1〜5で評価してください。送信後は変更できません。</Text>
      {members.map((member) => (
        <View key={member.id} style={styles.ratingScreenCard}>
          <View style={styles.ratingScreenPerson}>
            {member.profilePhoto ? <Image source={{ uri: member.profilePhoto }} style={styles.headerAvatar} /> : <View style={styles.headerAvatarFallback}><Text style={styles.headerAvatarText}>{member.displayName.slice(0, 1)}</Text></View>}
            <View>
              <Text style={styles.memberRatingName}>{member.displayName}</Text>
              <Text style={styles.muted}>{member.id === room.hangout.hostUserId ? "主催者として評価" : "参加者として評価"}</Text>
            </View>
          </View>
          <View style={styles.scoreChoices}>
            {[1, 2, 3, 4, 5].map((score) => (
              <Pressable key={score} accessibilityRole="button" accessibilityLabel={`${member.displayName}を星${score}で評価`} style={[styles.scoreButton, member.myRatingScore === score && styles.scoreButtonOn]} onPress={() => onRate(room.hangout.id, member.id, score)}>
                <Text style={[styles.scoreText, member.myRatingScore === score && styles.scoreTextOn]}>{score}★</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.ratingUnlockHint}>{member.myRatingScore ? `評価済み ★${member.myRatingScore}` : "評価を選択してください"}{member.directChatEligible ? " ・ 1対1トークが利用できます" : ""}</Text>
        </View>
      ))}
      {!members.length && <Text style={styles.empty}>評価する参加メンバーはいません。</Text>}
      <Pressable style={styles.primary} onPress={onDone}><Text style={styles.primaryText}>評価を完了</Text></Pressable>
    </ScrollView>
  );
}

function ChatScreen({ user, rooms, selectedRoom, messages, messageBody, sending, refreshing, unreadByRoom, realtimeOnline, onRefresh, onOpen, onRate, onBack, onChangeBody, onSend }: { user: User; rooms: Room[]; selectedRoom: Room | null; messages: Message[]; messageBody: string; sending: boolean; refreshing: boolean; unreadByRoom: Record<string, number>; realtimeOnline: boolean; onRefresh: () => void; onOpen: (room: Room) => void; onRate: (hangoutId: string, userId: string, score: number) => void; onBack: () => void; onChangeBody: (value: string) => void; onSend: () => void }) {
  const listRef = useRef<FlatList<Message>>(null);
  const time = (value?: string) =>
    value
      ? new Date(value).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  if (selectedRoom) {
    const headerPerson = selectedRoom.type === "DIRECT" ? selectedRoom.otherUser : selectedRoom.hangout.host;
    return (
      <KeyboardAvoidingView style={styles.chatPage} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={0}>
        <View style={styles.chatHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="トーク一覧に戻る" onPress={onBack} style={styles.backButton}>
            <View style={styles.backChevron} />
          </Pressable>
          {headerPerson.profilePhoto ? (
            <Image source={{ uri: headerPerson.profilePhoto }} style={styles.headerAvatar} />
          ) : (
            <View style={styles.headerAvatarFallback}>
              <Text style={styles.headerAvatarText}>{headerPerson.displayName.slice(0, 1)}</Text>
            </View>
          )}
          <View style={styles.chatHeading}>
            <Text style={styles.chatTitle} numberOfLines={1}>
              {selectedRoom.type === "DIRECT" ? selectedRoom.otherUser.displayName : selectedRoom.hangout.title}
            </Text>
            <Text style={styles.presence}>
              {selectedRoom.type === "DIRECT" ? "1対1 ・ " : `グループ ・ ${selectedRoom.members.length}人 ・ `}
              {realtimeOnline ? "● オンライン" : "○ 再接続中"}
            </Text>
          </View>
        </View>
        {selectedRoom.type === "GROUP" && selectedRoom.hangout.status === "FINISHED" && (
          <View style={styles.ratingActions}>
            {selectedRoom.members
              .filter((member) => member.id !== user.id && !member.myRatingScore)
              .map((member) => (
                <View key={member.id} style={styles.memberRating}>
                  <Text style={styles.memberRatingName}>
                    {member.displayName}（{member.id === selectedRoom.hangout.hostUserId ? "主催者評価" : "参加者評価"}）
                    {member.myRatingScore ? `　評価済み ★${member.myRatingScore}` : ""}
                  </Text>
                  <View style={styles.scoreChoices}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Pressable key={score} accessibilityRole="button" accessibilityLabel={`${member.displayName}の${member.id === selectedRoom.hangout.hostUserId ? "主催" : "参加"}を星${score}で評価`} style={[styles.scoreButton, member.myRatingScore === score && styles.scoreButtonOn]} onPress={() => onRate(selectedRoom.hangout.id, member.id, score)}>
                        <Text style={[styles.scoreText, member.myRatingScore === score && styles.scoreTextOn]}>{score}★</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.ratingUnlockHint}>{member.directChatEligible ? "1対1トークを開始できます" : "双方が★5の場合のみ1対1トークが解放されます"}</Text>
                </View>
              ))}
          </View>
        )}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          onLayout={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            const mine = item.senderUserId === user.id;
            const previous = messages[index - 1];
            const showName = previous?.senderUserId !== item.senderUserId;
            const photo = item.sender.profilePhoto || (mine ? user.profilePhoto : null);
            const avatar = photo ? (
              <Image source={{ uri: photo }} style={styles.chatAvatar} />
            ) : (
              <View style={styles.chatAvatar}>
                <Text style={styles.chatAvatarText}>{item.sender.displayName.slice(0, 1)}</Text>
              </View>
            );
            return (
              <View style={[styles.messageRow, mine ? styles.messageRowMine : styles.messageRowOther]}>
                {!mine && avatar}
                <View style={styles.bubbleGroup}>
                  {showName && <Text style={[styles.messageSender, mine && styles.messageSenderMine]}>{mine ? "あなた" : item.sender.displayName}</Text>}
                  <View style={[styles.message, mine ? styles.mine : styles.theirs]}>
                    <Text style={styles.messageText}>{messageText(item.body)}</Text>
                  </View>
                  <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{time(item.createdAt)}</Text>
                </View>
                {mine && avatar}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>最初のメッセージを送ってみましょう。</Text>}
        />
        <View style={styles.composer}>
          <TextInput style={styles.composerInput} value={messageBody} onChangeText={onChangeBody} placeholder="メッセージ" placeholderTextColor="#8a918c" multiline maxLength={1000} />
          <Pressable disabled={sending || !messageBody.trim()} style={[styles.sendButton, (sending || !messageBody.trim()) && styles.sendDisabled]} onPress={onSend}>
            <Text style={styles.sendText}>{sending ? "…" : "↑"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }
  const visibleRooms = rooms;
  return (
    <ScrollView style={styles.chatListPage} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.chatListHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="ホームに戻る" onPress={onBack} style={styles.backButton}>
          <View style={styles.backChevron} />
        </Pressable>
        <View style={styles.chatListHeadingCopy}>
          <Text style={styles.pageEyebrow}>会話から次の行動へ</Text>
          <Text style={styles.pageTitle}>トーク</Text>
        </View>
        <Text style={[styles.connectionBadge, realtimeOnline && styles.connectionOn]}>{realtimeOnline ? "リアルタイム" : "再接続中"}</Text>
      </View>
      <View style={styles.talkListSummary}>
        <Text style={styles.talkListTitle}>トーク</Text>
        <Text style={styles.talkListCounts}>1対1 {rooms.filter((room) => room.type === "DIRECT").length}　グループ {rooms.filter((room) => room.type === "GROUP").length}</Text>
      </View>
      {visibleRooms.map((room) => {
        const unread = unreadByRoom[room.id] || 0;
        const title = room.type === "DIRECT" ? room.otherUser.displayName : room.hangout.title;
        const person = room.type === "DIRECT" ? room.otherUser : room.hangout.host;
        return (
          <Pressable key={room.id} style={styles.room} onPress={() => onOpen(room)}>
            {person.profilePhoto ? (
              <Image source={{ uri: person.profilePhoto }} style={styles.roomAvatar} />
            ) : (
              <View style={styles.roomAvatar}>
                <Text style={styles.roomAvatarText}>{person.displayName.slice(0, 1)}</Text>
              </View>
            )}
            <View style={styles.roomCopy}>
              <View style={styles.roomTop}>
                <Text style={styles.roomTitle} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.roomType}>{room.type === "DIRECT" ? "1対1" : "グループ"}</Text>
                <Text style={styles.roomTime}>{time(room.lastMessage?.createdAt)}</Text>
              </View>
              <View style={styles.roomBottom}>
                <Text style={styles.roomPreview} numberOfLines={1}>
                  {room.lastMessage?.body || "トークを開始しましょう"}
                </Text>
                {unread > 0 && <Text style={styles.unreadBadge}>{unread > 99 ? "99+" : unread}</Text>}
              </View>
            </View>
          </Pressable>
        );
      })}
      {!visibleRooms.length && <Text style={styles.empty}>トークはまだありません。</Text>}
    </ScrollView>
  );
}

function NotificationScreen({ inbox, refreshing, onBack, onRefresh, onEnabled, onRead, onReadAll }: { inbox: NotificationInbox; refreshing: boolean; onBack: () => void; onRefresh: () => void; onEnabled: (enabled: boolean) => void; onRead: (id: string) => void; onReadAll: () => void }) {
  return (
    <View style={styles.notificationScreen}>
      <View style={styles.notificationHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="ホームに戻る" onPress={onBack} style={styles.backButton}><View style={styles.backChevron} /></Pressable>
        <View style={styles.notificationHeadTitle}><Text style={styles.notificationHeadEyebrow}>リアルタイム更新</Text><Text style={styles.notificationHeadText}>通知</Text></View>
        <View style={styles.notificationHeadSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.notificationPage} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.notificationSettings}>
        <View style={styles.notificationSettingCopy}><Text style={styles.notificationSettingTitle}>アプリ内通知を受け取る</Text><Text style={styles.muted}>申請・承認・トーク・Hangoutの更新をお知らせします。</Text></View>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: inbox.enabled }} style={[styles.notificationToggle, inbox.enabled && styles.notificationToggleOn]} onPress={() => onEnabled(!inbox.enabled)}><View style={[styles.notificationToggleKnob, inbox.enabled && styles.notificationToggleKnobOn]} /></Pressable>
      </View>
      <Pressable style={styles.readAllButton} onPress={onReadAll}><Text style={styles.readAllButtonText}>すべて既読</Text></Pressable>
      {inbox.items.map((item) => (
        <Pressable key={item.id} style={[styles.notificationItem, !item.readAt && styles.notificationItemUnread]} onPress={() => onRead(item.id)}>
          <View style={[styles.notificationDot, item.readAt && styles.notificationDotRead]} />
          <View style={styles.notificationItemCopy}><Text style={styles.notificationItemTitle}>{item.title}</Text><Text style={styles.notificationItemBody}>{item.body}</Text><Text style={styles.notificationItemTime}>{new Date(item.createdAt).toLocaleString("ja-JP")}</Text></View>
        </Pressable>
      ))}
      {!inbox.items.length && <Text style={styles.empty}>通知はまだありません。</Text>}
      </ScrollView>
    </View>
  );
}

function ProfileScreen({ user, hostStatus, activity, demo, onChat, onOpenHangout, onPhone, onPhoto, onSave, onDelete, onLogout }: { user: User; hostStatus: HostStatus | null; activity: ProfileActivity; demo: boolean; onChat: () => void; onOpenHangout: (id: string) => void; onPhone: () => void; onPhoto: (index: number) => void; onSave: (input: UpdateProfileInput) => Promise<void>; onDelete: () => void; onLogout: () => void }) {
  const white = hostStatus?.tier === "WHITE";
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [homeArea, setHomeArea] = useState(user.homeArea ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [interests, setInterests] = useState(user.interests.filter((value) => !(INTEREST_OPTIONS as readonly string[]).includes(value)).join("、"));
  const [selectedInterests, setSelectedInterests] = useState(user.interests.filter((value) => (INTEREST_OPTIONS as readonly string[]).includes(value)));
  const [gender, setGender] = useState(user.gender ?? "UNDISCLOSED");
  const [preferredAreas, setPreferredAreas] = useState((user.preferredAreas ?? []).join("、"));
  const [preferredActivities, setPreferredActivities] = useState((user.preferredActivities ?? []).join("、"));
  const [preferredAgeMin, setPreferredAgeMin] = useState(user.preferredAgeMin?.toString() ?? "");
  const [preferredAgeMax, setPreferredAgeMax] = useState(user.preferredAgeMax?.toString() ?? "");
  const [preferredGenders, setPreferredGenders] = useState(user.preferredGenders ?? []);
  const [activityTimeSlots, setActivityTimeSlots] = useState((user.activityTimeSlots ?? []).join("、"));
  const [participationUrgency, setParticipationUrgency] = useState<User["participationUrgency"]>(user.participationUrgency ?? null);
  const [maxTravelMinutes, setMaxTravelMinutes] = useState(user.maxTravelMinutes?.toString() ?? "");
  const [preferredGroupSizes, setPreferredGroupSizes] = useState((user.preferredGroupSizes ?? []).join("、"));
  const [budgetMin, setBudgetMin] = useState(user.budgetMin?.toString() ?? "");
  const [budgetMax, setBudgetMax] = useState(user.budgetMax?.toString() ?? "");
  const [matchingDataConsent, setMatchingDataConsent] = useState(user.matchingDataConsent ?? false);
  const [socialStyles, setSocialStyles] = useState(user.socialStyles ?? []);
  const [participationGoals, setParticipationGoals] = useState(user.participationGoals ?? []);
  const [firstTimePreferences, setFirstTimePreferences] = useState(user.firstTimePreferences ?? []);
  const [alcoholPreference, setAlcoholPreference] = useState<User["alcoholPreference"]>(user.alcoholPreference ?? null);
  const [smokingPreference, setSmokingPreference] = useState<User["smokingPreference"]>(user.smokingPreference ?? null);
  const [avoidPreferences, setAvoidPreferences] = useState(user.avoidPreferences ?? []);
  const [scheduleFlexibility, setScheduleFlexibility] = useState(user.scheduleFlexibility ?? []);
  const [behaviorLearningEnabled, setBehaviorLearningEnabled] = useState(user.behaviorLearningEnabled ?? false);
  const activeStatuses = new Set(["OPEN", "FULL", "STARTED"]);
  const activitySections = [
    ["主催中のHangout", activity.hosted.filter((item) => activeStatuses.has(item.status))],
    ["主催したHangout", activity.hosted.filter((item) => !activeStatuses.has(item.status))],
    ["参加するHangout", activity.participated.filter((item) => activeStatuses.has(item.status))],
    ["参加したHangout", activity.participated.filter((item) => !activeStatuses.has(item.status))],
    ["ハートしたHangout", activity.hearted],
  ] as const;
  const toggleInterest = (interest: string) => {
    const next = selectedInterests.includes(interest) ? selectedInterests.filter((item) => item !== interest) : [...selectedInterests, interest];
    setSelectedInterests([...new Set(next)].slice(0, 20));
  };
  const parseList = (value: string) => [...new Set(value.split(/[、,]/).map((item) => item.trim()).filter(Boolean))];
  const togglePreferredGender = (value: string) => setPreferredGenders((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value].slice(0, 4));
  const toggleChoice = (value: string, current: string[], update: (values: string[]) => void, limit: number) => update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value].slice(0, limit));
  const choiceGrid = (options: readonly string[], current: string[], update: (values: string[]) => void, limit: number) => (
    <View style={styles.interestOptionGrid}>{options.map((option) => { const selected = current.includes(option); return <Pressable key={option} style={[styles.interestOption, selected && styles.interestOptionSelected]} onPress={() => toggleChoice(option, current, update, limit)}><Text style={[styles.interestOptionText, selected && styles.interestOptionTextSelected]}>{option}</Text></Pressable>; })}</View>
  );
  const save = async () => {
    const name = displayName.trim();
    if (!name) return Alert.alert("表示名を入力してください");
    const customValues = interests.split(/[、,]/).map((value) => value.trim()).filter(Boolean).filter((value) => !(INTEREST_OPTIONS as readonly string[]).includes(value));
    const values = [...new Set([...selectedInterests, ...customValues])].slice(0, 20);
    const ageMin = preferredAgeMin ? Number(preferredAgeMin) : null;
    const ageMax = preferredAgeMax ? Number(preferredAgeMax) : null;
    const minimumBudget = budgetMin ? Number(budgetMin) : null;
    const maximumBudget = budgetMax ? Number(budgetMax) : null;
    if (ageMin !== null && ageMax !== null && ageMin > ageMax) return Alert.alert("希望年齢を確認してください", "下限は上限以下にしてください。");
    if (minimumBudget !== null && maximumBudget !== null && minimumBudget > maximumBudget) return Alert.alert("予算を確認してください", "下限は上限以下にしてください。");
    try {
      await onSave({
        displayName: name, homeArea: homeArea.trim() || null, bio: bio.trim() || null, interests: values, gender,
        preferredAreas: parseList(preferredAreas).slice(0, 10), preferredActivities: parseList(preferredActivities).slice(0, 20),
        preferredAgeMin: ageMin, preferredAgeMax: ageMax, preferredGenders,
        activityTimeSlots: parseList(activityTimeSlots).slice(0, 7), participationUrgency,
        maxTravelMinutes: maxTravelMinutes ? Number(maxTravelMinutes) : null,
        preferredGroupSizes: parseList(preferredGroupSizes).map(Number).filter((value) => Number.isInteger(value) && value >= 2 && value <= 20).slice(0, 6),
        budgetMin: minimumBudget, budgetMax: maximumBudget, matchingDataConsent,
        socialStyles, participationGoals, firstTimePreferences, alcoholPreference, smokingPreference,
        avoidPreferences, scheduleFlexibility, behaviorLearningEnabled,
      });
      setEditing(false);
      Alert.alert("保存しました", "プロフィールを更新しました。");
    } catch {
      Alert.alert("更新できませんでした", "入力内容を確認してもう一度お試しください。");
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.profile}>
      <View style={styles.profilePhotoTrio}>{[user.profilePhotos?.[1],user.profilePhotos?.[0]||user.profilePhoto,user.profilePhotos?.[2]].map((photo,index)=>photo?<Image key={`${photo}-${index}`} source={{uri:photo}} style={index===1?styles.avatar:styles.avatarSide}/>:<View key={`empty-${index}`} style={index===1?styles.avatarFallback:styles.avatarSideFallback}><Text style={styles.avatarText}>{index===1?"☺":"＋"}</Text></View>)}</View>
      <Text style={styles.profileName}>{user.displayName}</Text>
      <Pressable style={styles.profileChatButton} onPress={onChat}>
        <Text style={styles.profileChatButtonIcon}>●</Text>
        <Text style={styles.profileChatButtonText}>トーク</Text>
      </Pressable>
      <Pressable style={styles.profileEditButton} onPress={() => setEditing(true)}>
        <Text style={styles.profileEditButtonText}>プロフィールを編集</Text>
      </Pressable>
      <View>
        <Text style={[styles.verified, user.verificationStatus !== "PHONE_VERIFIED" && styles.unverified]}>{user.verificationStatus === "PHONE_VERIFIED" ? "✓ 電話番号確認済み" : "電話番号を確認する ›"}</Text>
      </View>
      {hostStatus && (
        <View style={[styles.hostRankCard, white && styles.hostRankWhite]}>
          <Text style={[styles.hostRankCaption, white && styles.hostRankDark]}>主催者ステータス</Text>
          <Text style={[styles.hostRankName, white && styles.hostRankDark]}>{hostStatus.label}</Text>
          <Text style={[styles.hostRankStats, white && styles.hostRankDark]}>
            開催完了 {hostStatus.completedHangouts}回 ・ 累計参加者 {hostStatus.totalParticipants}人{`\n`}主催評価 {hostStatus.hostAverageRating ?? "未評価"}（{hostStatus.hostRatingCount}件） ・ 参加評価 {hostStatus.participantAverageRating ?? "未評価"}（{hostStatus.participantRatingCount}件）{`\n`}中止率 {Math.round(hostStatus.cancellationRate * 100)}%
          </Text>
        </View>
      )}
      <Text style={styles.bio}>{user.bio || "自己紹介を登録しましょう。"}</Text>
      <View style={styles.tags}>
        {user.interests.map((item) => (
          <Text key={item} style={styles.tag}>
            {item}
          </Text>
        ))}
      </View>
      {activitySections.map(([heading, items]) => (
        <View key={heading} style={styles.profileActivitySection}>
          <Text style={styles.profileActivityHeading}>{heading}</Text>
          {items.length ? items.map((item) => (
            <Pressable key={item.id} style={styles.profileActivityCard} onPress={() => onOpenHangout(item.id)} accessibilityRole="button" accessibilityLabel={`${item.title}を表示`}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.profileActivityImage} /> : <View style={styles.profileActivityImageFallback}><Text>✨</Text></View>}
              <View style={styles.cardCopy}>
                <Text style={styles.profileActivityTitle}>{item.title}</Text>
                <Text style={styles.muted}>{new Date(item.startAt).toLocaleDateString('ja-JP')} ・ {item.status === 'FINISHED' ? '終了' : item.status === 'CANCELLED' ? '中止' : item.status === 'STARTED' ? 'Hangout中' : '募集中'}</Text>
              </View>
              <Text style={styles.profileActivityChevron}>›</Text>
            </Pressable>
          )) : <Text style={styles.empty}>まだありません。</Text>}
        </View>
      ))}
      <View style={styles.safety}>
        <Text>🛡️ 相手を尊重し、公開場所で安全に会いましょう。</Text>
      </View>
      <View style={styles.legalLinks}>
        <Pressable onPress={() => void Linking.openURL(`${WEBSITE_URL}/privacy.html`)}>
          <Text style={styles.legalLink}>プライバシーポリシー</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(`${WEBSITE_URL}/terms.html`)}>
          <Text style={styles.legalLink}>利用規約</Text>
        </Pressable>
        <Pressable onPress={() => void Linking.openURL(`${WEBSITE_URL}/community-guidelines.html`)}>
          <Text style={styles.legalLink}>コミュニティガイドライン</Text>
        </Pressable>
      </View>
      <Pressable style={styles.logoutButton} onPress={onLogout}>
        <Text style={styles.logoutText}>ログアウト</Text>
      </Pressable>
      <Pressable style={styles.deleteButton} onPress={onDelete}>
        <Text style={styles.deleteText}>{demo ? "デモアカウントについて" : "アカウントを削除"}</Text>
      </Pressable>
      <Modal visible={editing} animationType="slide" onRequestClose={() => void save()}>
        <SafeAreaView style={styles.profileEditorPage}>
          <View style={styles.profileEditorHeader}><Pressable onPress={() => void save()} accessibilityLabel="プロフィールに戻る"><Text style={styles.profileEditorCancel}>‹</Text></Pressable><Text style={styles.profileEditorTitle}>プロフィールを編集</Text><View style={{ width: 24 }} /></View>
          <ScrollView contentContainerStyle={styles.profileEditorForm} keyboardShouldPersistTaps="handled">
            <Text style={styles.profileEditorLabel}>プロフィール画像（最大3枚）</Text><View style={styles.profilePhotoTrio}>{[1,0,2].map((photoIndex,position)=>{const photo=user.profilePhotos?.[photoIndex]||(photoIndex===0?user.profilePhoto:undefined);return <Pressable key={photoIndex} onPress={()=>onPhoto(photoIndex)} accessibilityLabel={`${photoIndex+1}枚目の画像を選ぶ`}>{photo?<Image source={{uri:photo}} style={position===1?styles.avatar:styles.avatarSide}/>:<View style={position===1?styles.avatarFallback:styles.avatarSideFallback}><Text style={styles.avatarText}>{position===1?"☺":"＋"}</Text></View>}</Pressable>})}</View><Text style={styles.profileEditorHint}>丸い画像をタップして入れ替えます。中央がメイン画像です。</Text>
            <Text style={styles.profileEditorLabel}>表示名</Text><TextInput style={styles.profileEditorInput} value={displayName} onChangeText={setDisplayName} maxLength={40} />
            <Text style={styles.profileEditorLabel}>電話番号</Text><Pressable style={styles.profileEditorAction} onPress={() => { setEditing(false); onPhone(); }}><Text style={styles.profileEditorActionText}>{user.verificationStatus === "PHONE_VERIFIED" ? "電話番号を変更" : "電話番号を確認"}</Text></Pressable>
            <Text style={styles.profileEditorLabel}>活動エリア</Text><TextInput style={styles.profileEditorInput} value={homeArea} onChangeText={setHomeArea} maxLength={80} placeholder="例：新宿・渋谷" />
            <Text style={styles.profileEditorLabel}>自己紹介</Text><TextInput style={[styles.profileEditorInput, styles.profileEditorBio]} value={bio} onChangeText={setBio} maxLength={500} multiline textAlignVertical="top" placeholder="好きなことや参加したいHangoutを書きましょう" />
            <Text style={styles.profileEditorLabel}>興味のあること</Text>
            <View style={styles.interestOptionGrid}>{INTEREST_OPTIONS.map((interest) => { const selected = selectedInterests.includes(interest); return <Pressable key={interest} style={[styles.interestOption, selected && styles.interestOptionSelected]} onPress={() => toggleInterest(interest)}><Text style={[styles.interestOptionText, selected && styles.interestOptionTextSelected]}>{interest}</Text></Pressable>; })}</View>
            <TextInput style={[styles.profileEditorInput, { marginTop: 10 }]} value={interests} onChangeText={setInterests} maxLength={300} placeholder="ボタンにない興味だけ入力" /><Text style={styles.profileEditorHint}>候補はタップして選択し、入力欄には候補にない言葉だけを記載します。</Text>
            <Text style={styles.profileEditorLabel}>性別</Text><View style={styles.profileGenderOptions}>{[["UNDISCLOSED", "回答しない"], ["MALE", "男性"], ["FEMALE", "女性"], ["OTHER", "その他"]].map(([value, label]) => <Pressable key={value} style={[styles.profileGenderOption, gender === value && styles.profileGenderOptionSelected]} onPress={() => setGender(value)}><Text style={gender === value ? styles.profileGenderOptionTextSelected : styles.profileGenderOptionText}>{label}</Text></Pressable>)}</View>
            <View style={styles.matchingPreferences}>
              <Text style={styles.matchingTitle}>マッチング設定</Text>
              <Text style={styles.profileEditorHint}>入力は任意です。位置は市区・駅などのおおまかなエリアだけを保存し、正確なGPS位置は保存しません。</Text>
              <Text style={styles.profileEditorLabel}>希望エリア</Text><TextInput style={styles.profileEditorInput} value={preferredAreas} onChangeText={setPreferredAreas} maxLength={300} placeholder="例：新宿、渋谷" />
              <Text style={styles.profileEditorLabel}>希望する活動</Text><TextInput style={styles.profileEditorInput} value={preferredActivities} onChangeText={setPreferredActivities} maxLength={500} placeholder="例：カフェ、ランニング" />
              <Text style={styles.profileEditorLabel}>希望年齢</Text><View style={styles.matchingRangeRow}><TextInput style={[styles.profileEditorInput, styles.matchingRangeInput]} value={preferredAgeMin} onChangeText={setPreferredAgeMin} keyboardType="number-pad" placeholder="下限" maxLength={3} /><Text style={styles.matchingRangeSeparator}>〜</Text><TextInput style={[styles.profileEditorInput, styles.matchingRangeInput]} value={preferredAgeMax} onChangeText={setPreferredAgeMax} keyboardType="number-pad" placeholder="上限" maxLength={3} /></View>
              <Text style={styles.profileEditorLabel}>希望する相手</Text><View style={styles.profileGenderOptions}>{[["MALE", "男性"], ["FEMALE", "女性"], ["OTHER", "その他"], ["UNDISCLOSED", "指定なし"]].map(([value, label]) => { const selected = preferredGenders.includes(value); return <Pressable key={value} style={[styles.profileGenderOption, selected && styles.profileGenderOptionSelected]} onPress={() => togglePreferredGender(value)}><Text style={selected ? styles.profileGenderOptionTextSelected : styles.profileGenderOptionText}>{label}</Text></Pressable>; })}</View>
              <Text style={styles.profileEditorLabel}>雰囲気・交流スタイル</Text><Text style={styles.profileEditorHint}>自分に合う過ごし方を選択</Text>{choiceGrid(SOCIAL_STYLE_OPTIONS, socialStyles, setSocialStyles, 5)}
              <Text style={styles.profileEditorLabel}>活動しやすい時間</Text><TextInput style={styles.profileEditorInput} value={activityTimeSlots} onChangeText={setActivityTimeSlots} maxLength={200} placeholder="例：平日夜、土日昼" />
              <Text style={styles.profileEditorLabel}>参加したい時期</Text><View style={styles.interestOptionGrid}>{([[null, "未設定"], ["NOW", "今すぐ"], ["TODAY", "今日"], ["THIS_WEEK", "今週"], ["WEEKEND", "週末"], ["FLEXIBLE", "いつでも"]] as const).map(([value, label]) => <Pressable key={label} style={[styles.interestOption, participationUrgency === value && styles.interestOptionSelected]} onPress={() => setParticipationUrgency(value)}><Text style={[styles.interestOptionText, participationUrgency === value && styles.interestOptionTextSelected]}>{label}</Text></Pressable>)}</View>
              <Text style={styles.profileEditorLabel}>移動できる時間（分）</Text><TextInput style={styles.profileEditorInput} value={maxTravelMinutes} onChangeText={setMaxTravelMinutes} keyboardType="number-pad" maxLength={3} placeholder="例：30" />
              <Text style={styles.profileEditorLabel}>希望人数</Text><TextInput style={styles.profileEditorInput} value={preferredGroupSizes} onChangeText={setPreferredGroupSizes} maxLength={40} placeholder="例：2、4、6" />
              <Text style={styles.profileEditorLabel}>予算（円）</Text><View style={styles.matchingRangeRow}><TextInput style={[styles.profileEditorInput, styles.matchingRangeInput]} value={budgetMin} onChangeText={setBudgetMin} keyboardType="number-pad" placeholder="下限" maxLength={6} /><Text style={styles.matchingRangeSeparator}>〜</Text><TextInput style={[styles.profileEditorInput, styles.matchingRangeInput]} value={budgetMax} onChangeText={setBudgetMax} keyboardType="number-pad" placeholder="上限" maxLength={6} /></View>
              <Text style={styles.profileEditorLabel}>参加目的</Text>{choiceGrid(PARTICIPATION_GOAL_OPTIONS, participationGoals, setParticipationGoals, 7)}
              <Text style={styles.profileEditorLabel}>飲酒</Text><View style={styles.interestOptionGrid}>{([[null, "指定なし"], ["AVOID", "飲まない場を希望"], ["OK", "どちらでも"], ["PREFER", "飲酒ありを希望"]] as const).map(([value,label]) => <Pressable key={label} style={[styles.interestOption, alcoholPreference === value && styles.interestOptionSelected]} onPress={() => setAlcoholPreference(value)}><Text style={[styles.interestOptionText, alcoholPreference === value && styles.interestOptionTextSelected]}>{label}</Text></Pressable>)}</View>
              <Text style={styles.profileEditorLabel}>喫煙</Text><View style={styles.interestOptionGrid}>{([[null, "指定なし"], ["AVOID", "禁煙を希望"], ["OK", "どちらでも"]] as const).map(([value,label]) => <Pressable key={label} style={[styles.interestOption, smokingPreference === value && styles.interestOptionSelected]} onPress={() => setSmokingPreference(value)}><Text style={[styles.interestOptionText, smokingPreference === value && styles.interestOptionTextSelected]}>{label}</Text></Pressable>)}</View>
              <Text style={styles.profileEditorLabel}>初参加への配慮</Text><Text style={styles.profileEditorHint}>安心して参加するために必要なこと</Text>{choiceGrid(FIRST_TIME_OPTIONS, firstTimePreferences, setFirstTimePreferences, 4)}
              <Text style={styles.profileEditorLabel}>苦手・避けたい条件</Text><Text style={styles.profileEditorHint}>おすすめから優先的に外します</Text>{choiceGrid(AVOID_OPTIONS, avoidPreferences, setAvoidPreferences, 7)}
              <Text style={styles.profileEditorLabel}>予定の柔軟性</Text>{choiceGrid(FLEXIBILITY_OPTIONS, scheduleFlexibility, setScheduleFlexibility, 5)}
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: matchingDataConsent }} style={[styles.matchingConsent, matchingDataConsent && styles.matchingConsentOn]} onPress={() => setMatchingDataConsent((value) => !value)}><View style={[styles.matchingCheckbox, matchingDataConsent && styles.matchingCheckboxOn]}><Text style={styles.matchingCheckmark}>{matchingDataConsent ? "✓" : ""}</Text></View><Text style={styles.matchingConsentText}>この設定情報をマッチング改善に利用することに同意します。正確なGPS位置やトーク内容は利用しません。</Text></Pressable>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: behaviorLearningEnabled }} style={[styles.matchingConsent, behaviorLearningEnabled && styles.matchingConsentOn]} onPress={() => setBehaviorLearningEnabled((value) => !value)}><View style={[styles.matchingCheckbox, behaviorLearningEnabled && styles.matchingCheckboxOn]}><Text style={styles.matchingCheckmark}>{behaviorLearningEnabled ? "✓" : ""}</Text></View><Text style={styles.matchingConsentText}>アプリ内行動からおすすめを改善します。閲覧した募集、ハート、参加、評価を使い、正確な位置やトーク内容は学習に使いません。</Text></Pressable>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f3" },
  restore: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f7f8f3",
  },
  restoreText: { color: "#5f6862", fontSize: 12 },
  content: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brand: { fontSize: 21, fontWeight: "900", color: "#17221d" },
  brandAccent: { color: "#176b48" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  notificationButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e1e6df" },
  notificationBell: { width: 15, height: 15, borderRadius: 8, overflow: "hidden", backgroundColor: "#176b48", color: "#176b48" },
  notificationBadge: { position: "absolute", top: -3, right: -3, minWidth: 20, height: 20, borderRadius: 10, overflow: "hidden", paddingHorizontal: 4, textAlign: "center", lineHeight: 20, backgroundColor: "#e05245", color: "#fff", fontSize: 9, fontWeight: "900" },
  userName: { fontSize: 12, color: "#6d766f", maxWidth: 170 },
  headerProfileButton: { flexDirection: "row", alignItems: "center", gap: 9, paddingLeft: 8, paddingVertical: 2 },
  headerProfilePhoto: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#dfe6df" },
  headerProfileFallback: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#176b48" },
  headerProfileInitial: { color: "#fff", fontSize: 14, fontWeight: "900" },
  error: {
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff0eb",
    color: "#a93622",
  },
  loading: {
    position: "absolute",
    top: 70,
    right: 18,
    backgroundColor: "#17221d",
    padding: 8,
    borderRadius: 20,
  },
  demoBanner: {
    backgroundColor: "#17221d",
    paddingHorizontal: 13,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  demoTitle: { color: "#fff", fontSize: 11, fontWeight: "900" },
  demoHint: { color: "#cad2cc", fontSize: 9, marginTop: 2 },
  demoBannerActions: { flexDirection: "row", gap: 6 },
  resetDemoButton: { backgroundColor: "#fff", minHeight: 40, justifyContent: "center", paddingHorizontal: 11, borderRadius: 20 },
  switchButton: {
    backgroundColor: "#d9ff68",
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  switchText: { fontSize: 10, fontWeight: "900", color: "#17221d" },
  nav: {
    height: 72,
    borderTopWidth: 1,
    borderColor: "#e3e7df",
    backgroundColor: "#fff",
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
  },
  navItem: { alignItems: "center", justifyContent: "center", minWidth: 88, minHeight: 48 },
  navMark: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ccd5ce",
    marginBottom: 8,
  },
  navMarkOn: { width: 20, backgroundColor: "#176b48" },
  mapNavIconWrap: { height: 13, marginBottom: 3, alignItems: "center", justifyContent: "center" },
  mapNavPin: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderBottomLeftRadius: 2,
    backgroundColor: "#e05245",
    transform: [{ rotate: "-45deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  mapNavPinOn: { backgroundColor: "#176b48", width: 16, height: 16, borderRadius: 8, borderBottomLeftRadius: 2 },
  mapNavPinCenter: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  navLabel: { fontSize: 10, color: "#89908b", fontWeight: "700" },
  navOn: { color: "#176b48" },
  mapPage: { padding: 18, paddingBottom: 40, backgroundColor: "#f7f8f3" },
  mapBackButton: { width: 44, height: 44, marginBottom: 10, borderWidth: 1, borderColor: "#dce5df", borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  mapBackIcon: { marginTop: -3, color: "#176b48", fontSize: 34, lineHeight: 36, fontWeight: "500" },
  mapHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mapLocationButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: "#d8ded8", backgroundColor: "#fff" },
  mapCanvas: { height: 310, marginTop: 4, borderRadius: 24, overflow: "hidden", backgroundColor: "#dfead9" },
  mapRoad: { position: "absolute", backgroundColor: "#fff", borderColor: "#cbd6ca", borderWidth: 1 },
  mapRoadHorizontal: { top: "43%", left: -20, right: -20, height: 38, transform: [{ rotate: "-8deg" }] },
  mapRoadVertical: { top: -20, bottom: -20, left: "58%", width: 34, transform: [{ rotate: "12deg" }] },
  mapYou: { position: "absolute", left: "48%", top: "45%", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#17221d" },
  mapYouText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  mapPin: { position: "absolute", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", backgroundColor: "#176b48", shadowColor: "#17221d", shadowOpacity: 0.2, shadowRadius: 5 },
  mapPinText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  mapPrivacy: { marginVertical: 13, color: "#59635c", fontSize: 11, lineHeight: 17 },
  mapResultHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 },
  mapResultHeadingTitle: { color: "#17221d", fontSize: 18, fontWeight: "900" },
  mapResultHeadingCount: { color: "#176b48", fontSize: 12, fontWeight: "800" },
  mapResultCard: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 8, padding: 13, borderRadius: 16, backgroundColor: "#fff" },
  mapResultNumber: { width: 28, height: 28, borderRadius: 14, color: "#fff", backgroundColor: "#176b48", textAlign: "center", textAlignVertical: "center", fontSize: 11, fontWeight: "900" },
  authPage: { padding: 24, paddingBottom: 50, backgroundColor: "#eef5eb" },
  authBrand: {
    textAlign: "center",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 8,
  },
  authPhoto: {
    width: "100%",
    height: 120,
    borderRadius: 22,
    marginVertical: 20,
  },
  demoCard: {
    backgroundColor: "#17221d",
    borderRadius: 24,
    padding: 18,
    marginBottom: 16,
  },
  demoPill: {
    alignSelf: "flex-start",
    backgroundColor: "#d9ff68",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    fontSize: 10,
    fontWeight: "900",
  },
  demoHeading: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 10,
  },
  demoDescription: {
    color: "#cad2cc",
    fontSize: 12,
    marginTop: 3,
    marginBottom: 12,
  },
  demoRow: { flexDirection: "row", gap: 8 },
  roleButton: {
    flex: 1,
    backgroundColor: "#fff",
    minHeight: 68,
    justifyContent: "center",
    padding: 14,
    borderRadius: 16,
  },
  roleGuest: { backgroundColor: "#d9ff68" },
  roleTitle: { fontSize: 12, fontWeight: "900", color: "#17221d" },
  roleHint: { fontSize: 10, color: "#667069", marginTop: 3 },
  authCard: { backgroundColor: "#fff", padding: 20, borderRadius: 24 },
  authTitle: {
    fontSize: 27,
    fontWeight: "900",
    color: "#17221d",
    marginTop: 5,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
    marginBottom: 6,
    color: "#374139",
  },
  input: {
    borderWidth: 1,
    borderColor: "#dfe4df",
    borderRadius: 13,
    padding: 12,
    color: "#17221d",
    backgroundColor: "#fff",
  },
  invalidInput: { borderColor: "#c62828", borderWidth: 2, backgroundColor: "#fff7f7" },
  invalidGroup: { borderColor: "#c62828", borderWidth: 2, borderRadius: 13, padding: 8, backgroundColor: "#fff7f7" },
  validationMessage: { color: "#9f221c", backgroundColor: "#fff0ef", borderColor: "#d8493f", borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8, fontWeight: "800" },
  fieldError: { color: "#b3261e", fontSize: 12, marginTop: 5, fontWeight: "700" },
  partyCounts: { flexDirection: "row", gap: 12 },
  partyCount: { flex: 1, gap: 7 },
  profileActivitySection: { width: "100%", marginTop: 22 },
  profileActivityHeading: { fontSize: 17, fontWeight: "900", color: "#17221d", marginBottom: 10 },
  profileActivityCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 15, padding: 10, marginBottom: 8 },
  profileActivityImage: { width: 58, height: 58, borderRadius: 12 },
  profileActivityImageFallback: { width: 58, height: 58, borderRadius: 12, backgroundColor: "#eaf1e9", alignItems: "center", justifyContent: "center" },
  profileActivityTitle: { fontWeight: "800", color: "#17221d" },
  profileActivityChevron: { color: "#8a938d", fontSize: 28, fontWeight: "500", marginLeft: 4 },
  authError: { color: "#bd3a28", fontSize: 12, marginTop: 8 },
  primary: {
    backgroundColor: "#176b48",
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 17,
    marginTop: 15,
    alignItems: "center",
    shadowColor: "#176b48",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  authDividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 20, marginBottom: 14 },
  authDividerLine: { flex: 1, height: 1, backgroundColor: "#dce2dc" },
  authDividerText: { color: "#7a837d", fontSize: 12, fontWeight: "800" },
  providerButton: { minHeight: 48, marginBottom: 9, borderWidth: 1, borderColor: "#d8ded9", borderRadius: 14, backgroundColor: "#f8faf8", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  providerMark: { width: 24, textAlign: "center", color: "#176b48", fontSize: 16, fontWeight: "900" },
  providerButtonText: { color: "#17221d", fontSize: 13, fontWeight: "900" },
  providerNote: { minHeight: 30, paddingTop: 7, color: "#59645d", fontSize: 11, textAlign: "center" },
  authSwitch: { textAlign: "center", color: "#59635c", padding: 15 },
  hero: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  eyebrow: { color: "#176b48", fontSize: 12, fontWeight: "900" },
  heroTitle: {
    fontSize: 35,
    lineHeight: 39,
    fontWeight: "900",
    color: "#17221d",
    marginTop: 6,
  },
  locationButton: {
    alignSelf: "flex-start",
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#d8ded8",
    backgroundColor: "#fff",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 13,
  },
  locationText: { fontSize: 11, fontWeight: "900", color: "#176b48" },
  sectionHead: {
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 19, fontWeight: "900" },
  sectionHeadActions: { flexDirection: "row", alignItems: "center", gap: 9 },
  homeMapButton: { minHeight: 36, justifyContent: "center", paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: "#cfd8d0", backgroundColor: "#fff" },
  homeMapButtonText: { color: "#176b48", fontSize: 10, fontWeight: "900" },
  muted: { fontSize: 12, color: "#6d766f", marginTop: 3 },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e7df",
    borderRadius: 20,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  activityPhoto: {
    height: 142,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
    backgroundColor: "#dfe6df",
  },
  heartButton: { position: "absolute", zIndex: 2, top: 10, left: 10, minWidth: 58, height: 38, paddingHorizontal: 10, borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#ffffffee" },
  heartButtonOn: { backgroundColor: "#fff0f2" },
  heartIcon: { color: "#5d6861", fontSize: 22, fontWeight: "900" },
  heartIconOn: { color: "#e34f68" },
  heartCount: { color: "#49544d", fontSize: 12, fontWeight: "900" },
  cardTop: { flexDirection: "row", gap: 12 },
  cardCategory: {
    fontSize: 11,
    fontWeight: "900",
    color: "#176b48",
    marginBottom: 4,
  },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#17221d" },
  cardMetaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  cardBottom: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hostName: { fontSize: 12, fontWeight: "700" },
  hostTier: { fontSize: 9, fontWeight: "900", color: "#8a6647", marginTop: 3 },
  cardHostRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 9, paddingRight: 8 },
  cardHostPhoto: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#dfe6df" },
  cardHostFallback: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#e9f1e9" },
  cardHostInitial: { color: "#176b48", fontWeight: "900" },
  cardMatchWrap: { minWidth: 58, alignItems: "flex-end" },
  cardMatchLabel: { color: "#6d766f", fontSize: 9, fontWeight: "800" },
  cardMatchScore: { color: "#176b48", fontSize: 19, fontWeight: "900" },
  status: {
    fontSize: 11,
    fontWeight: "900",
    color: "#176b48",
    backgroundColor: "#e9f7ec",
    padding: 7,
    borderRadius: 10,
  },
  joinButton: {
    backgroundColor: "#d9ff68",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  joinText: { fontSize: 11, fontWeight: "900" },
  finishButton: {
    backgroundColor: "#17221d",
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
  },
  finishButtonText: { fontSize: 10, fontWeight: "900", color: "#fff" },
  empty: { textAlign: "center", color: "#6d766f", padding: 30 },
  areaRow: { flexDirection: "row", gap: 8, marginTop: 13 },
  areaButton: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e7ece7",
  },
  areaButtonOn: { backgroundColor: "#176b48" },
  areaText: { fontSize: 12, fontWeight: "900", color: "#59635c" },
  areaTextOn: { color: "#fff" },
  homeActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  createButton: {
    backgroundColor: "#176b48",
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 13,
  },
  detailLink: { fontSize: 11, color: "#176b48", fontWeight: "900" },
  formPage: { padding: 20, paddingBottom: 60, backgroundColor: "#f7f8f3" },
  backText: { color: "#176b48", fontWeight: "900", marginBottom: 15 },
  safetyNote: {
    backgroundColor: "#e9f7ec",
    padding: 14,
    borderRadius: 14,
    color: "#344039",
    lineHeight: 19,
  },
  imagePickerButton: {
    minHeight: 48,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 14,
    backgroundColor: "#e4f2e8",
    alignItems: "center",
    justifyContent: "center",
  },
  imagePickerButtonText: { color: "#176b48", fontSize: 15, fontWeight: "900" },
  createImagePreview: { width: "100%", aspectRatio: 16 / 9, borderRadius: 18, marginBottom: 8, backgroundColor: "#dfe6df" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: {
    minHeight: 42,
    justifyContent: "center",
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 13,
    backgroundColor: "#e7ece7",
  },
  choiceOn: { backgroundColor: "#d9ff68" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  disabled: { opacity: 0.45 },
  detailPhoto: {
    width: "100%",
    height: 170,
    borderRadius: 20,
    marginBottom: 16,
    backgroundColor: "#dfe6df",
  },
  detailMeta: { color: "#667069", marginBottom: 16 },
  detailPanel: {
    padding: 17,
    borderRadius: 18,
    backgroundColor: "#fff",
    marginBottom: 18,
  },
  privacyText: { fontSize: 11, color: "#176b48", marginTop: 8 },
  description: { marginTop: 18, lineHeight: 21 },
  reportButton: { marginTop: 18, padding: 13, alignItems: "center" },
  reportText: {
    color: "#a93622",
    fontSize: 12,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  requestCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#fff",
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  applicantProfileLink: {
    color: "#176b48",
    fontSize: 11,
    fontWeight: "900",
    marginTop: 8,
  },
  applicantModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "#17221d99",
  },
  applicantModalCard: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 34,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#f7f8f3",
  },
  applicantAvatar: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#dfe6df",
  },
  applicantAvatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#d9ac86",
  },
  applicantAvatarText: { color: "#fff", fontSize: 32, fontWeight: "900" },
  applicantName: { marginTop: 14, fontSize: 24, fontWeight: "900" },
  applicantMeta: { marginTop: 5, color: "#59635c", fontSize: 13 },
  applicantVerification: {
    marginTop: 7,
    color: "#176b48",
    fontSize: 12,
    fontWeight: "800",
  },
  applicantBio: {
    marginTop: 18,
    color: "#4f5952",
    lineHeight: 21,
    textAlign: "center",
  },
  applicantInterests: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
    marginTop: 15,
  },
  applicantPrivacyNote: {
    marginTop: 20,
    color: "#788079",
    fontSize: 10,
    textAlign: "center",
  },
  applicantCloseButton: {
    width: "100%",
    alignItems: "center",
    marginTop: 18,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 17,
    backgroundColor: "#176b48",
  },
  requestActions: { flexDirection: "row", gap: 6 },
  rejectButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#eef1ed",
  },
  acceptButton: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#176b48",
  },
  talkButtonWide: {
    minHeight: 52,
    marginBottom: 18,
    borderRadius: 17,
    backgroundColor: "#176b48",
    alignItems: "center",
    justifyContent: "center",
  },
  talkButtonWideText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  finishButtonWide: {
    marginTop: 20,
    minHeight: 52,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 17,
    backgroundColor: "#17221d",
    alignItems: "center",
    shadowColor: "#17221d",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 3,
  },
  chatListPage: { flex: 1, backgroundColor: "#f7f8f3" },
  pageEyebrow: {
    color: "#176b48",
    fontWeight: "900",
    fontSize: 12,
    marginTop: 20,
  },
  pageTitle: {
    fontSize: 32,
    fontWeight: "900",
    marginTop: 4,
    marginBottom: 15,
  },
  chatListHead: {
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatListHeadingCopy: { flex: 1, marginLeft: 12 },
  connectionBadge: {
    fontSize: 10,
    fontWeight: "800",
    color: "#9a6c54",
    backgroundColor: "#fff0e8",
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connectionOn: { color: "#176b48", backgroundColor: "#e9f7ec" },
  chatTabs: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 5,
    borderRadius: 15,
    backgroundColor: "#e7ece7",
    flexDirection: "row",
  },
  chatTab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 11,
  },
  chatTabOn: { backgroundColor: "#fff" },
  chatTabText: { fontSize: 12, fontWeight: "900", color: "#788079" },
  chatTabTextOn: { color: "#176b48" },
  directPeople: {
    marginHorizontal: 14,
    marginBottom: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  directPeopleTitle: {
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 9,
    color: "#4d5750",
  },
  personChip: {
    marginRight: 7,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#e9f7ec",
  },
  personChipText: { fontSize: 11, fontWeight: "800", color: "#176b48" },
  room: {
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e7df",
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
  },
  roomAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#d9ff68",
    alignItems: "center",
    justifyContent: "center",
  },
  roomAvatarText: { fontSize: 18, fontWeight: "900", color: "#17221d" },
  roomCopy: { flex: 1 },
  roomTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  roomBottom: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 8,
  },
  roomTitle: { flex: 1, fontWeight: "900", fontSize: 15 },
  roomTime: { fontSize: 10, color: "#89918b" },
  roomPreview: { flex: 1, fontSize: 12, color: "#6d766f" },
  unreadBadge: {
    minWidth: 21,
    textAlign: "center",
    color: "#fff",
    backgroundColor: "#24a35a",
    fontSize: 10,
    fontWeight: "900",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 11,
  },
  chatPage: { flex: 1, backgroundColor: "#e8eee8" },
  chatHeader: {
    height: 64,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderColor: "#dfe4df",
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 42,
    height: 42,
    borderWidth: 1,
    borderColor: "#dce5df",
    borderRadius: 21,
    backgroundColor: "#f8fbf6",
    alignItems: "center",
    justifyContent: "center",
  },
  backChevron: {
    width: 10,
    height: 10,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: "#176b48",
    transform: [{ rotate: "45deg" }],
    marginLeft: 4,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ddd",
  },
  headerAvatarFallback: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#d9ac86",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { fontSize: 15, fontWeight: "900", color: "#fff" },
  chatHeading: { flex: 1, paddingHorizontal: 10 },
  chatTitle: { fontSize: 16, fontWeight: "900", maxWidth: "100%" },
  presence: { fontSize: 9, color: "#176b48", marginTop: 2 },
  messageList: { paddingHorizontal: 11, paddingTop: 14, paddingBottom: 16 },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginVertical: 4,
    maxWidth: "94%",
  },
  messageRowMine: { alignSelf: "flex-end" },
  messageRowOther: { alignSelf: "flex-start" },
  chatAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#d9ac86",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 15,
  },
  chatAvatarText: { fontSize: 12, fontWeight: "900", color: "#fff" },
  bubbleGroup: { maxWidth: "86%" },
  message: { paddingHorizontal: 13, paddingVertical: 9, borderRadius: 18 },
  mine: {
    alignSelf: "flex-end",
    backgroundColor: "#d9ff68",
    borderBottomRightRadius: 5,
  },
  theirs: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderBottomLeftRadius: 5,
  },
  messageSender: {
    fontSize: 9,
    color: "#687169",
    fontWeight: "700",
    marginBottom: 3,
    marginLeft: 4,
  },
  messageSenderMine: { textAlign: "right", marginRight: 4 },
  messageText: { fontSize: 15, lineHeight: 20, color: "#17221d" },
  messageTime: { fontSize: 9, color: "#7b847e", marginTop: 3, marginLeft: 4 },
  messageTimeMine: { textAlign: "right", marginRight: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderColor: "#dfe4df",
  },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 110,
    backgroundColor: "#f4f6f3",
    borderWidth: 1,
    borderColor: "#dfe4df",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 9,
    color: "#17221d",
  },
  sendButton: {
    width: 44,
    height: 44,
    backgroundColor: "#176b48",
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#176b48",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.24,
    shadowRadius: 7,
    elevation: 4,
  },
  sendDisabled: { backgroundColor: "#d7ddd9", shadowOpacity: 0, elevation: 0 },
  sendText: { color: "#d9ff68", fontSize: 24, lineHeight: 26, fontWeight: "800" },
  ratingScreen: { padding: 20, paddingBottom: 40, gap: 14 },
  ratingScreenTitle: { fontSize: 28, lineHeight: 34, fontWeight: "900", color: "#17221d" },
  ratingScreenDescription: { color: "#687169", fontSize: 14, lineHeight: 22 },
  ratingScreenCard: { gap: 14, padding: 16, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfe4df" },
  ratingScreenPerson: { flexDirection: "row", alignItems: "center", gap: 12 },
  profile: { alignItems: "center", padding: 24 },
  profilePhotoTrio: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#ddd", borderWidth: 3, borderColor: "#fff", shadowColor: "#17221d", shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  avatarSide: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#ddd", borderWidth: 3, borderColor: "#fff", shadowColor: "#17221d", shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  avatarSideFallback: { width: 66, height: 66, borderRadius: 33, backgroundColor: "#e7ede8", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#17221d", shadowOpacity: 0.15, shadowRadius: 8, elevation: 3 },
  avatarFallback: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: "#d9ac86",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 35 },
  photoButton: {
    marginTop: 9,
    backgroundColor: "#e9f7ec",
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 20,
  },
  photoButtonText: { color: "#176b48", fontSize: 11, fontWeight: "900" },
  profileName: { fontSize: 25, fontWeight: "900", marginTop: 14 },
  profileEditButton: { marginTop: 12, minHeight: 48, justifyContent: "center", paddingHorizontal: 24, borderRadius: 16, backgroundColor: "#176b48", shadowColor: "#176b48", shadowOpacity: 0.18, shadowRadius: 7, elevation: 2 },
  profileEditButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
  profileChatButton: { marginTop: 12, minWidth: 150, minHeight: 48, paddingHorizontal: 22, borderRadius: 24, backgroundColor: "#d9ff68", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, shadowColor: "#176b48", shadowOpacity: 0.16, shadowRadius: 7, elevation: 2 },
  profileChatButtonIcon: { color: "#176b48", fontSize: 11 },
  profileChatButtonText: { color: "#17221d", fontSize: 14, fontWeight: "900" },
  profileEditorPage: { flex: 1, backgroundColor: "#f7f8f3" },
  profileEditorHeader: { minHeight: 58, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#dfe5df", backgroundColor: "#fff" },
  profileEditorTitle: { fontSize: 16, fontWeight: "900", color: "#17221d" },
  profileEditorCancel: { color: "#687169", fontSize: 13, fontWeight: "700" },
  profileEditorSave: { color: "#176b48", fontSize: 13, fontWeight: "900" },
  profileEditorForm: { padding: 22, paddingBottom: 48 },
  profileEditorLabel: { marginTop: 17, marginBottom: 7, color: "#435049", fontSize: 12, fontWeight: "900" },
  profileEditorInput: { minHeight: 48, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1, borderColor: "#d8dfd9", borderRadius: 13, backgroundColor: "#fff", color: "#17221d" },
  profileEditorBio: { minHeight: 130 },
  profileEditorHint: { marginTop: 6, color: "#6d766f", fontSize: 10, lineHeight: 15 },
  interestOptionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  interestOption: { minHeight: 40, justifyContent: "center", paddingHorizontal: 14, borderWidth: 1, borderColor: "#d8dfd9", borderRadius: 999, backgroundColor: "#fff" },
  interestOptionSelected: { borderColor: "#176b48", backgroundColor: "#d9ff68" },
  interestOptionText: { color: "#59635c", fontSize: 12, fontWeight: "800" },
  interestOptionTextSelected: { color: "#17221d" },
  profileEditorAction: { minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#176b48", borderRadius: 13, backgroundColor: "#fff" },
  profileEditorActionText: { color: "#176b48", fontSize: 13, fontWeight: "900" },
  profileGenderOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  profileGenderOption: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#d8dfd9", borderRadius: 999, backgroundColor: "#fff" },
  profileGenderOptionSelected: { borderColor: "#176b48", backgroundColor: "#e9f7ec" },
  profileGenderOptionText: { color: "#59635c", fontSize: 12, fontWeight: "700" },
  profileGenderOptionTextSelected: { color: "#176b48", fontSize: 12, fontWeight: "900" },
  matchingPreferences: { marginTop: 22, padding: 16, borderWidth: 1, borderColor: "#dfe5df", borderRadius: 18, backgroundColor: "#f8faf7" },
  matchingTitle: { color: "#17221d", fontSize: 18, fontWeight: "900" },
  matchingRangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  matchingRangeInput: { flex: 1 },
  matchingRangeSeparator: { color: "#687169", fontWeight: "800" },
  matchingConsent: { marginTop: 20, flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 13, borderWidth: 1, borderColor: "#d8dfd9", borderRadius: 14, backgroundColor: "#fff" },
  matchingConsentOn: { borderColor: "#176b48", backgroundColor: "#eaf6ec" },
  matchingCheckbox: { width: 22, height: 22, borderWidth: 1, borderColor: "#aeb8b0", borderRadius: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  matchingCheckboxOn: { borderColor: "#176b48", backgroundColor: "#176b48" },
  matchingCheckmark: { color: "#fff", fontSize: 13, fontWeight: "900" },
  matchingConsentText: { flex: 1, color: "#435049", fontSize: 11, lineHeight: 17 },
  matchFeedbackPanel: { marginTop: 14, gap: 8, padding: 14, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfe5df" },
  matchFeedbackButton: { minHeight: 44, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#176b48", borderRadius: 12 },
  matchFeedbackButtonText: { color: "#176b48", fontSize: 12, fontWeight: "900" },
  verified: { color: "#176b48", fontWeight: "800", marginTop: 5 },
  unverified: { color: "#b25c31" },
  hostRankCard: {
    width: "100%",
    marginTop: 16,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#8a6647",
  },
  hostRankWhite: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#cfd8d1",
  },
  hostRankDark: { color: "#344039" },
  hostRankCaption: { fontSize: 10, fontWeight: "800", color: "#fff" },
  hostRankName: {
    fontSize: 25,
    fontWeight: "900",
    color: "#fff",
    marginTop: 3,
  },
  hostRankStats: { fontSize: 11, lineHeight: 18, color: "#fff", marginTop: 7 },
  bio: {
    textAlign: "center",
    color: "#5f6862",
    lineHeight: 21,
    marginVertical: 18,
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 7,
  },
  tag: {
    backgroundColor: "#eaf4e8",
    color: "#176b48",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 20,
    fontWeight: "700",
  },
  safety: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 15,
    marginTop: 24,
  },
  legalLinks: { width: "100%", alignItems: "center", gap: 11, marginTop: 22 },
  legalLink: {
    color: "#176b48",
    fontSize: 12,
    fontWeight: "800",
    textDecorationLine: "underline",
  },
  logoutButton: {
    marginTop: 24,
    minHeight: 48,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#cfd5d0",
    borderRadius: 14,
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  logoutText: { color: "#4f5952", fontWeight: "800" },
  deleteButton: { marginTop: 12, minHeight: 44, justifyContent: "center", paddingHorizontal: 18 },
  deleteText: { color: "#b23a2d", fontSize: 12, fontWeight: "800" },
  ratingActions: {
    gap: 7,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  memberRating: { padding: 9, borderRadius: 13, backgroundColor: "#f4f6f3" },
  memberRatingName: {
    fontSize: 11,
    fontWeight: "900",
    color: "#344039",
    marginBottom: 7,
  },
  scoreChoices: { flexDirection: "row", gap: 5 },
  scoreButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 42,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce2dc",
  },
  scoreButtonOn: { backgroundColor: "#176b48", borderColor: "#176b48" },
  scoreText: { fontSize: 10, fontWeight: "900", color: "#b47715" },
  scoreTextOn: { color: "#fff" },
  ratingUnlockHint: { fontSize: 8, color: "#707a73", marginTop: 6 },
  talkListSummary: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  talkListTitle: { color: "#17221d", fontSize: 20, fontWeight: "900" },
  talkListCounts: { color: "#687169", fontSize: 10, fontWeight: "800" },
  roomType: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, overflow: "hidden", backgroundColor: "#e9f7ec", color: "#176b48", fontSize: 8, fontWeight: "900" },
  genderChoices: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  genderChoice: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#eef1ed",
  },
  genderChoiceOn: { backgroundColor: "#d9ff68" },
  genderChoiceText: { fontSize: 11, fontWeight: "800" },
  modalPage: { flex: 1, backgroundColor: "#f4f1e8" },
  providedImageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  providedImageChoice: { width: "47%", overflow: "hidden", borderWidth: 2, borderColor: "transparent", borderRadius: 16, backgroundColor: "#fff" },
  providedImageChoiceOn: { borderColor: "#176b48" },
  providedImagePhoto: { width: "100%", height: 64 },
  providedImageLabel: { padding: 9, color: "#344039", fontWeight: "900" },
  privatePlaceBox: { gap: 7, padding: 14, borderRadius: 18, backgroundColor: "#eaf4e8", borderWidth: 1, borderColor: "#c9ddcc" },
  privatePlaceTitle: { color: "#176b48", fontSize: 16, fontWeight: "900" },
  detailCondition: { marginTop: 12, color: "#176b48", fontWeight: "800" },
  editHangoutButton: { minHeight: 50, alignItems: "center", justifyContent: "center", marginBottom: 14, borderRadius: 16, backgroundColor: "#fff1c9", borderWidth: 1, borderColor: "#e4c97b" },
  editHangoutButtonText: { color: "#765611", fontSize: 16, fontWeight: "900" },
  cancelHangoutButton: { minHeight: 50, alignItems: "center", justifyContent: "center", marginBottom: 14, borderRadius: 16, backgroundColor: "#ffe2dc", borderWidth: 1, borderColor: "#efb4a8" },
  cancelHangoutButtonText: { color: "#a13e31", fontSize: 16, fontWeight: "900" },
  characterCount: { textAlign: "right", color: "#687169", fontSize: 12 },
  disabledButton: { opacity: 0.45 },
  secondary: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#e7ede7", marginTop: 10 },
  demoJourney: { marginHorizontal: 16, marginTop: 4, marginBottom: 12, padding: 16, borderRadius: 20, backgroundColor: "#17221d" },
  demoJourneyTitle: { color: "#d9ff68", fontSize: 15, fontWeight: "900", marginBottom: 8 },
  demoJourneyText: { color: "#fff", fontSize: 12, lineHeight: 20 },
  demoJourneyHint: { color: "#cad2cc", fontSize: 10, marginTop: 8 },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 13 },
  filterPill: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, backgroundColor: "#e8ece6" },
  filterPillOn: { backgroundColor: "#176b48" },
  filterPillText: { color: "#59635c", fontSize: 12, fontWeight: "800" },
  filterPillTextOn: { color: "#fff" },
  notificationScreen: { flex: 1, backgroundColor: "#f7f8f3" },
  notificationPage: { padding: 18, paddingBottom: 80, gap: 12 },
  notificationHead: { minHeight: 64, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#dfe5df", backgroundColor: "#fff" },
  notificationHeadTitle: { flex: 1, alignItems: "center" },
  notificationHeadEyebrow: { color: "#176b48", fontSize: 10, fontWeight: "900" },
  notificationHeadText: { marginTop: 2, color: "#17221d", fontSize: 17, fontWeight: "900" },
  notificationHeadSpacer: { width: 42 },
  notificationSettings: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, padding: 16, borderRadius: 18, backgroundColor: "#fff" },
  notificationSettingCopy: { flex: 1, gap: 3 },
  notificationSettingTitle: { color: "#17221d", fontSize: 14, fontWeight: "900" },
  notificationToggle: { width: 48, height: 28, borderRadius: 14, padding: 3, backgroundColor: "#ccd3cd" },
  notificationToggleOn: { backgroundColor: "#176b48" },
  notificationToggleKnob: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" },
  notificationToggleKnobOn: { transform: [{ translateX: 20 }] },
  readAllButton: { alignSelf: "flex-end", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 16, backgroundColor: "#e8f3e8" },
  readAllButtonText: { color: "#176b48", fontSize: 11, fontWeight: "900" },
  notificationItem: { flexDirection: "row", gap: 11, padding: 15, borderRadius: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e5e9e4" },
  notificationItemUnread: { backgroundColor: "#f3fbe2", borderColor: "#cce58a" },
  notificationDot: { width: 9, height: 9, borderRadius: 5, marginTop: 5, backgroundColor: "#e05245" },
  notificationDotRead: { backgroundColor: "#c7cec8" },
  notificationItemCopy: { flex: 1, gap: 4 },
  notificationItemTitle: { color: "#17221d", fontSize: 13, fontWeight: "900" },
  notificationItemBody: { color: "#4f5a52", fontSize: 12, lineHeight: 18 },
  notificationItemTime: { color: "#8a928c", fontSize: 9 },
});
