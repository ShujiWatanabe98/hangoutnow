import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

const API_URL = "https://hangoutnow-api.onrender.com";
const WEBSITE_URL = "https://method-more.com";
const ACTIVITY_PHOTO_URL = `${WEBSITE_URL}/assets/activity-photos-v1.png`;
const DEMO_PASSWORD = "HangoutNow-Demo-2026!";
const SESSION_KEY = "hangout-now-session";

type User = {
  id: string;
  email: string;
  displayName: string;
  gender: string | null;
  bio: string | null;
  homeArea: string | null;
  interests: string[];
  verificationStatus: string;
  profilePhoto: string | null;
};

type Session = { accessToken: string; refreshToken: string; user: User };
type HostTier = "WHITE" | "BRONZE" | "SILVER" | "GOLD" | "PLATINUM" | "DIAMOND";
type HostStatus = {
  tier: HostTier;
  label: string;
  completedHangouts: number;
  totalParticipants: number;
  ratingCount: number;
  averageRating: number | null;
  recentAverageRating: number | null;
  cancellationRate: number;
  nextTier: HostTier | null;
};
type Host = {
  id: string;
  displayName: string;
  profilePhoto: string | null;
  verification: string;
  hostStatus?: HostStatus;
};
type Hangout = {
  id: string;
  hostUserId: string;
  status: string;
  title: string;
  description: string | null;
  category: string;
  startAt: string;
  locationName: string;
  participantCount: number;
  maxParticipants: number;
  genderRestriction: "ANY" | "MALE_ONLY" | "FEMALE_ONLY";
  maxAge: number | null;
  myJoinStatus: string | null;
  myJoinRequestId: string | null;
  myAttendanceStatus: "PENDING_CONFIRMATION" | "CONFIRMED" | "CANCELLED" | null;
  host: Host;
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
  verification: string;
  myRatingScore?: number | null;
  ratedFiveByMe?: boolean;
  directChatEligible?: boolean;
};
type GroupRoom = {
  id: string;
  type: "GROUP";
  hangoutId: string;
  hangout: { id: string; title: string; status: string; host: ChatMember };
  members: ChatMember[];
  lastMessage: Message | null;
};
type DirectRoom = {
  id: string;
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
};
type NotificationInbox = { items: NotificationItem[]; unreadCount: number };
type Screen = "home" | "map" | "create" | "detail" | "phone" | "chat" | "profile";
type AlphaArea = "新宿" | "渋谷";
type ApplicantProfile = {
  id: string;
  displayName: string;
  verification: string;
  profilePhoto: string | null;
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
  category: string;
  startInMinutes: 30 | 60 | 180;
  publicLocationName: string;
  locationName: string;
  maxParticipants: number;
  area: AlphaArea;
};
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
type StampContent = { imageUrl: string; text: string };
type UserStamp = { id: string; imageUrl: string; text: string };
function stampContent(body: string): StampContent | null {
  if (!body.startsWith("__STAMP__")) return null;
  try {
    return JSON.parse(body.slice(9)) as StampContent;
  } catch {
    return null;
  }
}
function stateLabel(hangout: Hangout) {
  return hangout.myJoinStatus === "ACCEPTED" ? "承認済み" : hangout.myJoinStatus === "PENDING" ? "申請中" : hangout.status === "FULL" ? "満員" : "募集中";
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
  const [chatTab, setChatTab] = useState<"GROUP" | "DIRECT">("GROUP");
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [stamps, setStamps] = useState<UserStamp[]>([]);
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
  const [selectedArea, setSelectedArea] = useState<AlphaArea>("新宿");
  const [selectedHangout, setSelectedHangout] = useState<Hangout | null>(null);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);

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

  const loadRooms = useCallback(async () => {
    if (!session) return;
    const [groups, directs] = await Promise.all([request<GroupRoom[]>("/chat-rooms"), request<DirectRoom[]>("/direct-chats")]);
    setRooms([...groups, ...directs]);
  }, [request, session]);

  const loadHostStatus = useCallback(async () => {
    if (!session) return;
    setHostStatus(await request<HostStatus>("/users/me/host-status"));
  }, [request, session]);

  const refreshCurrent = useCallback(async () => {
    setRefreshing(true);
    setError("");
    try {
      if (screen === "home") await loadHome();
      if (screen === "chat") await loadRooms();
      if (screen === "profile") await loadHostStatus();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新に失敗しました");
    } finally {
      setRefreshing(false);
    }
  }, [loadHome, loadHostStatus, loadRooms, screen]);

  useEffect(() => {
    if (!session) return;
    void refreshCurrent();
  }, [screen, session?.user.id]);

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
    if (!session) return;
    const socket = io(API_URL, {
      auth: { token: session.accessToken },
      transports: ["websocket"],
    });
    socket.on("connect", () => setRealtimeOnline(true));
    socket.on("disconnect", () => setRealtimeOnline(false));
    socket.on("notification", (item: { id?: string; type?: string; link?: string }) => {
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
  }, [loadRooms, request, selectedRoom?.id, session?.accessToken]);

  async function authenticate(email: string, password: string, role: "host" | "guest" | null = null) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await readJson(response)) as Session | { message?: string };
      if (!response.ok) throw new Error("message" in data && data.message ? data.message : "ログインできませんでした");
      setSession(data as Session);
      setDemoRole(role);
      setScreen(role === "guest" ? "chat" : "home");
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

  async function joinHangout(hangout: Hangout) {
    setLoading(true);
    setError("");
    try {
      await request(`/hangouts/${hangout.id}/join`, {
        method: "POST",
        body: JSON.stringify({ message: "スマホアプリから参加を希望します！" }),
      });
      void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "JOIN_REQUESTED",
          hangoutId: hangout.id,
        }),
      }).catch(() => undefined);
      await loadHome();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "参加申請に失敗しました");
    } finally {
      setLoading(false);
    }
  }

  async function openHangout(hangout: Hangout) {
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
          category: input.category,
          serviceArea: input.area === "新宿" ? "SHINJUKU" : "SHIBUYA",
          startInMinutes: input.startInMinutes,
          publicLocationName: input.publicLocationName.trim(),
          locationName: input.locationName.trim(),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          maxParticipants: input.maxParticipants,
          genderRestriction: "ANY",
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
      Alert.alert("通報してブロック", `${hangout.host.displayName}さんを「${label}」として運営へ通報し、今後お互いの募集とチャットを非表示にします。`, [
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
      await request("/reports", {
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
      const [nextMessages, nextStamps] = await Promise.all([request<Message[]>(`${base}/${room.id}/messages`), request<UserStamp[]>("/stamps")]);
      setMessages(nextMessages);
      setStamps(nextStamps);
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

  async function startDirect(userId: string) {
    setLoading(true);
    setError("");
    try {
      const room = await request<DirectRoom>("/direct-chats", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      await loadRooms();
      setChatTab("DIRECT");
      await openRoom(room);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "1対1チャットを開始できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function sendStamp(stampId: string) {
    if (!selectedRoom) return;
    setSending(true);
    try {
      const base = selectedRoom.type === "DIRECT" ? "/direct-chats" : "/chat-rooms";
      const sent = await request<Message>(`${base}/${selectedRoom.id}/messages`, { method: "POST", body: JSON.stringify({ stampId }) });
      setMessages((current) => [...current, sent]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "スタンプを送信できませんでした");
    } finally {
      setSending(false);
    }
  }
  async function createStamp(text: string) {
    setLoading(true);
    setError("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("写真ライブラリへのアクセスを許可してください");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error("写真を読み込めませんでした");
      const mediaType = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpeg";
      const imageData = `data:image/${mediaType};base64,${asset.base64}`;
      const stamp = await request<UserStamp>("/stamps", {
        method: "POST",
        body: JSON.stringify({ text, imageData }),
      });
      setStamps((current) => [...current, stamp]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "スタンプを作成できませんでした");
    } finally {
      setLoading(false);
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
      await loadRooms();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hangoutを終了できませんでした");
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
      await loadRooms();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "評価を送信できませんでした");
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

  async function chooseProfilePhoto() {
    setLoading(true);
    setError("");
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error("写真ライブラリへのアクセスを許可してください");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.65,
        base64: true,
      });
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset?.base64) throw new Error("写真を読み込めませんでした");
      const mediaType = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpeg";
      const profilePhoto = `data:image/${mediaType};base64,${asset.base64}`;
      const user = await request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ profilePhoto }),
      });
      setSession((current) => (current ? { ...current, user } : current));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "写真を更新できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function updateProfile(input: Pick<User, "displayName" | "gender" | "bio" | "homeArea" | "interests">) {
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

  function confirmDeleteAccount() {
    if (demoRole) {
      Alert.alert("デモアカウント", "共有デモアカウントは削除できません。");
      return;
    }
    Alert.alert("アカウントを削除", "プロフィール、募集、申請、チャットなど関連データが削除されます。この操作は取り消せません。", [
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
    return <AuthScreen loading={loading} error={error} onLogin={authenticate} onRegister={register} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {demoRole && !(screen === "chat" && selectedRoom) && (
        <View style={styles.demoBanner}>
          <View>
            <Text style={styles.demoTitle}>デモ：{demoRole === "host" ? "主催者" : "参加者"}として体験中</Text>
            <Text style={styles.demoHint}>{demoRole === "host" ? "募集カードから参加申請を管理" : "承認済みチャットを体験"}</Text>
          </View>
          <Pressable onPress={logout} style={styles.switchButton}>
            <Text style={styles.switchText}>役割変更</Text>
          </Pressable>
        </View>
      )}
      {screen !== "chat" && (
        <View style={styles.header}>
          <Text style={styles.brand}>
            Hangout <Text style={styles.brandAccent}>Now</Text>
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="自分のプロフィールを表示"
            style={styles.headerProfileButton}
            onPress={() => setScreen("profile")}
          >
            <Text style={styles.userName} numberOfLines={1}>{session.user.displayName}</Text>
            {session.user.profilePhoto ? (
              <Image source={{ uri: session.user.profilePhoto }} style={styles.headerProfilePhoto} />
            ) : (
              <View style={styles.headerProfileFallback}>
                <Text style={styles.headerProfileInitial}>{session.user.displayName.slice(0, 1)}</Text>
              </View>
            )}
          </Pressable>
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.content}>
        {screen === "home" && <HomeScreen user={session.user} hangouts={hangouts} refreshing={refreshing} locationLabel={locationLabel} selectedArea={selectedArea} onArea={chooseArea} onLocation={useCurrentLocation} onRefresh={refreshCurrent} onOpen={openHangout} onCreate={() => setScreen(session.user.verificationStatus === "PHONE_VERIFIED" ? "create" : "phone")} />}
        {screen === "map" && <MapScreen hangouts={hangouts} locationLabel={locationLabel} onLocation={useCurrentLocation} onOpen={openHangout} />}
        {screen === "create" && <CreateHangoutScreen area={selectedArea} onBack={() => setScreen("home")} onSubmit={createHangout} />}
        {screen === "detail" && selectedHangout && <HangoutDetailScreen user={session.user} hangout={selectedHangout} requests={joinRequests} onBack={() => setScreen("home")} onJoin={joinHangout} onFinish={confirmFinishHangout} onDecide={decideJoinRequest} onReport={confirmReportHost} onAttendance={updateAttendance} />}
        {screen === "phone" && <PhoneVerificationScreen onBack={() => setScreen("profile")} onVerify={verifyPhone} />}
        {screen === "chat" && <ChatScreen user={session.user} rooms={rooms} stamps={stamps} chatTab={chatTab} selectedRoom={selectedRoom} messages={messages} messageBody={messageBody} sending={sending} refreshing={refreshing} unreadByRoom={unreadByRoom} realtimeOnline={realtimeOnline} onTab={setChatTab} onRefresh={refreshCurrent} onOpen={openRoom} onStartDirect={startDirect} onRate={rateParticipant} onSendStamp={sendStamp} onCreateStamp={createStamp} onBack={() => setSelectedRoom(null)} onChangeBody={setMessageBody} onSend={sendMessage} />}
        {screen === "profile" && <ProfileScreen user={session.user} hostStatus={hostStatus} demo={!!demoRole} onPhone={() => setScreen("phone")} onPhoto={chooseProfilePhoto} onSave={updateProfile} onDelete={confirmDeleteAccount} onLogout={logout} />}
      </View>
      {!selectedRoom && ["home", "map", "chat", "profile"].includes(screen) && (
        <View style={styles.nav}>
          {(
            [
              ["home", "ホーム"],
              ["map", "マップ"],
              ["chat", "チャット"],
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
              <View style={[styles.navMark, screen === value && styles.navMarkOn]} />
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

function AuthScreen({ loading, error, onLogin, onRegister }: { loading: boolean; error: string; onLogin: (email: string, password: string, role?: "host" | "guest" | null) => Promise<void>; onRegister: (input: { email: string; password: string; displayName: string; birthDate: string; gender: string }) => Promise<void> }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("1990-01-01");
  const [gender, setGender] = useState("UNDISCLOSED");
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
            <Pressable disabled={loading} style={styles.roleButton} onPress={() => onLogin("demo-host@hangoutnow.example", DEMO_PASSWORD, "host")}>
              <Text style={styles.roleTitle}>主催者として見る</Text>
              <Text style={styles.roleHint}>募集管理・承認</Text>
            </Pressable>
            <Pressable disabled={loading} style={[styles.roleButton, styles.roleGuest]} onPress={() => onLogin("demo-guest@hangoutnow.example", DEMO_PASSWORD, "guest")}>
              <Text style={styles.roleTitle}>参加者として見る</Text>
              <Text style={styles.roleHint}>検索・チャット</Text>
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

function HomeScreen({ user, hangouts, refreshing, locationLabel, selectedArea, onArea, onLocation, onRefresh, onOpen, onCreate }: { user: User; hangouts: Hangout[]; refreshing: boolean; locationLabel: string; selectedArea: AlphaArea; onArea: (area: AlphaArea) => void; onLocation: () => void; onRefresh: () => void; onOpen: (hangout: Hangout) => void; onCreate: () => void }) {
  const stateLabel = (hangout: Hangout) => (hangout.hostUserId === user.id ? "主催中" : hangout.myJoinStatus === "ACCEPTED" ? "承認済み" : hangout.myJoinStatus === "PENDING" ? "申請中" : hangout.status === "FULL" ? "満員" : "募集中");
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
            <Text style={styles.primaryText}>＋ 募集する</Text>
          </Pressable>
        </View>
      </View>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>{selectedArea}のHangout</Text>
        <Text style={styles.muted}>{hangouts.length}件</Text>
      </View>
      {hangouts.map((hangout) => (
        <Pressable key={hangout.id} style={styles.card} onPress={() => onOpen(hangout)}>
          <Image source={{ uri: ACTIVITY_PHOTO_URL }} style={styles.activityPhoto} resizeMode="cover" />
          <View style={styles.cardTop}>
            <View style={styles.cardCopy}>
              <Text style={styles.cardCategory}>{hangout.category}</Text>
              <Text style={styles.cardTitle}>{hangout.title}</Text>
              <Text style={styles.muted}>{hangout.locationName}</Text>
              <Text style={styles.muted}>
                参加 {hangout.participantCount} / {hangout.maxParticipants}人
              </Text>
            </View>
            <Text style={styles.status}>{stateLabel(hangout)}</Text>
          </View>
          <View style={styles.cardBottom}>
            <View>
              <Text style={styles.hostName}>
                主催：{hangout.host.displayName}
                {hangout.host.verification === "PHONE_VERIFIED" ? " ・確認済み" : ""}
              </Text>
              <Text style={styles.hostTier}>{hangout.host.hostStatus?.label || "ホワイト"}</Text>
            </View>
            <Text style={styles.detailLink}>詳細を見る ›</Text>
          </View>
        </Pressable>
      ))}
      {!hangouts.length && <Text style={styles.empty}>現在募集中のHangoutはありません。</Text>}
    </ScrollView>
  );
}

function MapScreen({ hangouts, locationLabel, onLocation, onOpen }: { hangouts: Hangout[]; locationLabel: string; onLocation: () => void; onOpen: (hangout: Hangout) => void }) {
  return (
    <ScrollView contentContainerStyle={styles.mapPage}>
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
      <Text style={styles.mapPrivacy}>承認前は概略エリアのみ表示します。正確な集合場所は承認後に確認できます。</Text>
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
    </ScrollView>
  );
}

function CreateHangoutScreen({ area, onBack, onSubmit }: { area: AlphaArea; onBack: () => void; onSubmit: (input: CreateHangoutInput) => void }) {
  const [form, setForm] = useState<CreateHangoutInput>({
    title: "",
    description: "",
    category: "ラーメン",
    startInMinutes: 30,
    publicLocationName: `${area}駅周辺`,
    locationName: "店名・住所を入力",
    maxParticipants: 4,
    area,
  });
  const valid = form.title.trim().length > 0 && form.publicLocationName.trim().length > 0 && form.locationName.trim().length > 0;
  return (
    <ScrollView contentContainerStyle={styles.formPage}>
      <Pressable onPress={onBack}>
        <Text style={styles.backText}>‹ ホームへ</Text>
      </Pressable>
      <Text style={styles.pageTitle}>Hangoutを募集</Text>
      <Text style={styles.safetyNote}>安全のため集合場所は駅・店舗など公開された場所に限ります。店名・住所・正確な位置は承認された参加者だけに表示されます。</Text>
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
      <Text style={styles.label}>タイトル</Text>
      <TextInput style={styles.input} value={form.title} onChangeText={(title) => setForm((v) => ({ ...v, title }))} placeholder="例：30分後にラーメン" maxLength={80} />
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
      <TextInput style={styles.input} value={form.publicLocationName} onChangeText={(publicLocationName) => setForm((v) => ({ ...v, publicLocationName }))} maxLength={100} />
      <Text style={styles.label}>承認後に表示する店名・住所</Text>
      <TextInput style={styles.input} value={form.locationName} onChangeText={(locationName) => setForm((v) => ({ ...v, locationName }))} maxLength={100} />
      <Text style={styles.label}>説明（任意）</Text>
      <TextInput style={[styles.input, styles.multiline]} value={form.description} onChangeText={(description) => setForm((v) => ({ ...v, description }))} multiline maxLength={500} />
      <Pressable disabled={!valid} style={[styles.primary, !valid && styles.disabled]} onPress={() => onSubmit(form)}>
        <Text style={styles.primaryText}>Hangoutを公開する</Text>
      </Pressable>
    </ScrollView>
  );
}

function HangoutDetailScreen({ user, hangout, requests, onBack, onJoin, onFinish, onDecide, onReport, onAttendance }: { user: User; hangout: Hangout; requests: JoinRequest[]; onBack: () => void; onJoin: (hangout: Hangout) => void; onFinish: (id: string) => void; onDecide: (id: string, accept: boolean) => void; onReport: (hangout: Hangout) => void; onAttendance: (status: "CONFIRMED" | "CANCELLED") => void }) {
  const isHost = hangout.hostUserId === user.id;
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantProfile | null>(null);
  return (
    <>
      <ScrollView contentContainerStyle={styles.formPage}>
        <Pressable onPress={onBack}>
          <Text style={styles.backText}>‹ 一覧へ</Text>
        </Pressable>
        <Image source={{ uri: ACTIVITY_PHOTO_URL }} style={styles.detailPhoto} resizeMode="cover" />
        <Text style={styles.eyebrow}>
          {hangout.category} ・ {stateLabel(hangout)}
        </Text>
        <Text style={styles.pageTitle}>{hangout.title}</Text>
        <Text style={styles.detailMeta}>
          {new Date(hangout.startAt).toLocaleString("ja-JP")} ／ {hangout.participantCount} / {hangout.maxParticipants}人
        </Text>
        <View style={styles.detailPanel}>
          <Text style={styles.label}>集合場所</Text>
          <Text>{hangout.locationName}</Text>
          <Text style={styles.privacyText}>{hangout.myJoinStatus === "ACCEPTED" || isHost ? "承認済みのため詳細を表示しています。" : "参加承認までは、おおまかな場所だけが表示されます。"}</Text>
          {hangout.description && <Text style={styles.description}>{hangout.description}</Text>}
        </View>
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
        {!isHost && !hangout.myJoinStatus && hangout.status === "OPEN" && (
          <Pressable style={styles.primary} onPress={() => onJoin(hangout)}>
            <Text style={styles.primaryText}>参加を申請する</Text>
          </Pressable>
        )}
        {!isHost && (
          <Pressable style={styles.reportButton} onPress={() => onReport(hangout)}>
            <Text style={styles.reportText}>この募集の主催者を通報・ブロック</Text>
          </Pressable>
        )}
        {isHost && (
          <>
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
            <Pressable style={styles.finishButtonWide} onPress={() => onFinish(hangout.id)}>
              <Text style={styles.primaryText}>Hangoutを終了</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
      <ApplicantProfileModal profile={selectedApplicant} onClose={() => setSelectedApplicant(null)} />
    </>
  );
}

function ApplicantProfileModal({ profile, onClose }: { profile: ApplicantProfile | null; onClose: () => void }) {
  return (
    <Modal visible={profile !== null} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.applicantModalBackdrop}>
        <View style={styles.applicantModalCard}>
          {profile?.profilePhoto ? (
            <Image source={{ uri: profile.profilePhoto }} style={styles.applicantAvatar} />
          ) : (
            <View style={styles.applicantAvatarFallback}>
              <Text style={styles.applicantAvatarText}>{profile?.displayName.slice(0, 1) || "☺"}</Text>
            </View>
          )}
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

function ChatScreen({ user, rooms, stamps, chatTab, selectedRoom, messages, messageBody, sending, refreshing, unreadByRoom, realtimeOnline, onTab, onRefresh, onOpen, onStartDirect, onRate, onSendStamp, onCreateStamp, onBack, onChangeBody, onSend }: { user: User; rooms: Room[]; stamps: UserStamp[]; chatTab: "GROUP" | "DIRECT"; selectedRoom: Room | null; messages: Message[]; messageBody: string; sending: boolean; refreshing: boolean; unreadByRoom: Record<string, number>; realtimeOnline: boolean; onTab: (tab: "GROUP" | "DIRECT") => void; onRefresh: () => void; onOpen: (room: Room) => void; onStartDirect: (userId: string) => void; onRate: (hangoutId: string, userId: string, score: number) => void; onSendStamp: (stampId: string) => void; onCreateStamp: (text: string) => void; onBack: () => void; onChangeBody: (value: string) => void; onSend: () => void }) {
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
          <Pressable accessibilityRole="button" accessibilityLabel="チャット一覧に戻る" onPress={onBack} style={styles.backButton}>
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
              .filter((member) => member.id !== user.id)
              .map((member) => (
                <View key={member.id} style={styles.memberRating}>
                  <Text style={styles.memberRatingName}>
                    {member.displayName}
                    {member.myRatingScore ? `　評価済み ★${member.myRatingScore}` : ""}
                  </Text>
                  <View style={styles.scoreChoices}>
                    {[1, 2, 3, 4, 5].map((score) => (
                      <Pressable key={score} accessibilityRole="button" accessibilityLabel={`${member.displayName}を星${score}で評価`} style={[styles.scoreButton, member.myRatingScore === score && styles.scoreButtonOn]} onPress={() => onRate(selectedRoom.hangout.id, member.id, score)}>
                        <Text style={[styles.scoreText, member.myRatingScore === score && styles.scoreTextOn]}>{score}★</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={styles.ratingUnlockHint}>{member.directChatEligible ? "1対1チャットを開始できます" : "双方が★5の場合のみ1対1チャットが解放されます"}</Text>
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
            const stamp = stampContent(item.body);
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
                  {stamp ? (
                    <View style={styles.stampMessage}>
                      <Image source={{ uri: stamp.imageUrl }} style={styles.stampImage} />
                      <Text style={styles.stampText}>{stamp.text}</Text>
                    </View>
                  ) : (
                    <View style={[styles.message, mine ? styles.mine : styles.theirs]}>
                      <Text style={styles.messageText}>{item.body}</Text>
                    </View>
                  )}
                  <Text style={[styles.messageTime, mine && styles.messageTimeMine]}>{time(item.createdAt)}</Text>
                </View>
                {mine && avatar}
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>最初のメッセージを送ってみましょう。</Text>}
        />
        <View style={styles.mobileStampTray}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {stamps.map((stamp) => (
              <Pressable key={stamp.id} style={styles.mobileStampChoice} onPress={() => onSendStamp(stamp.id)}>
                <Image source={{ uri: stamp.imageUrl }} style={styles.stampImage} />
                <Text style={styles.mobileStampLabel}>{stamp.text}</Text>
              </Pressable>
            ))}
            {["向かってます", "少し遅れます", "到着"].map((text) => (
              <Pressable key={text} style={styles.mobileStampCreate} onPress={() => onCreateStamp(text)}>
                <Text style={styles.mobileStampPlus}>＋</Text>
                <Text style={styles.mobileStampCreateText}>{text}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
        <View style={styles.composer}>
          <TextInput style={styles.composerInput} value={messageBody} onChangeText={onChangeBody} placeholder="メッセージ" placeholderTextColor="#8a918c" multiline maxLength={1000} />
          <Pressable disabled={sending || !messageBody.trim()} style={[styles.sendButton, (sending || !messageBody.trim()) && styles.sendDisabled]} onPress={onSend}>
            <Text style={styles.sendText}>{sending ? "…" : "➤"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }
  const visibleRooms = rooms.filter((room) => room.type === chatTab);
  const groupMembers = rooms
    .filter((room): room is GroupRoom => room.type === "GROUP")
    .flatMap((room) => room.members)
    .filter((member, index, all) => member.id !== user.id && member.directChatEligible && all.findIndex((item) => item.id === member.id) === index);
  return (
    <ScrollView style={styles.chatListPage} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.chatListHead}>
        <View>
          <Text style={styles.pageEyebrow}>会話から次の行動へ</Text>
          <Text style={styles.pageTitle}>チャット</Text>
        </View>
        <Text style={[styles.connectionBadge, realtimeOnline && styles.connectionOn]}>{realtimeOnline ? "リアルタイム" : "再接続中"}</Text>
      </View>
      <View style={styles.chatTabs}>
        <Pressable style={[styles.chatTab, chatTab === "GROUP" && styles.chatTabOn]} onPress={() => onTab("GROUP")}>
          <Text style={[styles.chatTabText, chatTab === "GROUP" && styles.chatTabTextOn]}>グループ</Text>
        </Pressable>
        <Pressable style={[styles.chatTab, chatTab === "DIRECT" && styles.chatTabOn]} onPress={() => onTab("DIRECT")}>
          <Text style={[styles.chatTabText, chatTab === "DIRECT" && styles.chatTabTextOn]}>1対1</Text>
        </Pressable>
      </View>
      {chatTab === "DIRECT" && (
        <View style={styles.directPeople}>
          <Text style={styles.directPeopleTitle}>一度会い、双方が★5を付けると1対1チャットが解放されます</Text>
          {groupMembers.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {groupMembers.map((member) => (
                <Pressable key={member.id} style={styles.personChip} onPress={() => onStartDirect(member.id)}>
                  <Text style={styles.personChipText}>{member.displayName}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}
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
                <Text style={styles.roomTime}>{time(room.lastMessage?.createdAt)}</Text>
              </View>
              <View style={styles.roomBottom}>
                <Text style={styles.roomPreview} numberOfLines={1}>
                  {room.lastMessage?.body || "チャットを開始しましょう"}
                </Text>
                {unread > 0 && <Text style={styles.unreadBadge}>{unread > 99 ? "99+" : unread}</Text>}
              </View>
            </View>
          </Pressable>
        );
      })}
      {!visibleRooms.length && <Text style={styles.empty}>{chatTab === "GROUP" ? "参加が承認されるとグループチャットが表示されます。" : "双方の★5評価がそろうと1対1チャットが表示されます。"}</Text>}
    </ScrollView>
  );
}

function ProfileScreen({ user, hostStatus, demo, onPhone, onPhoto, onSave, onDelete, onLogout }: { user: User; hostStatus: HostStatus | null; demo: boolean; onPhone: () => void; onPhoto: () => void; onSave: (input: Pick<User, "displayName" | "gender" | "bio" | "homeArea" | "interests">) => Promise<void>; onDelete: () => void; onLogout: () => void }) {
  const white = hostStatus?.tier === "WHITE";
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [homeArea, setHomeArea] = useState(user.homeArea ?? "");
  const [bio, setBio] = useState(user.bio ?? "");
  const [interests, setInterests] = useState(user.interests.join("、"));
  const [gender, setGender] = useState(user.gender ?? "UNDISCLOSED");
  const save = async () => {
    const name = displayName.trim();
    if (!name) return Alert.alert("表示名を入力してください");
    const values = [...new Set(interests.split(/[、,]/).map((value) => value.trim()).filter(Boolean))].slice(0, 20);
    try {
      await onSave({ displayName: name, homeArea: homeArea.trim() || null, bio: bio.trim() || null, interests: values, gender });
      setEditing(false);
      Alert.alert("保存しました", "プロフィールを更新しました。");
    } catch {
      Alert.alert("更新できませんでした", "入力内容を確認してもう一度お試しください。");
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.profile}>
      {user.profilePhoto ? (
        <Image source={{ uri: user.profilePhoto }} style={styles.avatar} />
      ) : (
        <View style={styles.avatarFallback}>
          <Text style={styles.avatarText}>☺</Text>
        </View>
      )}
      <Text style={styles.profileName}>{user.displayName}</Text>
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
            開催完了 {hostStatus.completedHangouts}回 ・ 累計参加者 {hostStatus.totalParticipants}人{`\n`}平均 {hostStatus.averageRating ?? "未評価"} ・ 評価 {hostStatus.ratingCount}件 ・ 中止率 {Math.round(hostStatus.cancellationRate * 100)}%
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
      <Modal visible={editing} animationType="slide" onRequestClose={() => setEditing(false)}>
        <SafeAreaView style={styles.profileEditorPage}>
          <View style={styles.profileEditorHeader}><Pressable onPress={() => setEditing(false)}><Text style={styles.profileEditorCancel}>キャンセル</Text></Pressable><Text style={styles.profileEditorTitle}>プロフィールを編集</Text><Pressable onPress={() => void save()}><Text style={styles.profileEditorSave}>保存</Text></Pressable></View>
          <ScrollView contentContainerStyle={styles.profileEditorForm} keyboardShouldPersistTaps="handled">
            <Text style={styles.profileEditorLabel}>プロフィール写真</Text><Pressable style={styles.profileEditorAction} onPress={onPhoto}><Text style={styles.profileEditorActionText}>写真を変更</Text></Pressable>
            <Text style={styles.profileEditorLabel}>表示名</Text><TextInput style={styles.profileEditorInput} value={displayName} onChangeText={setDisplayName} maxLength={40} />
            <Text style={styles.profileEditorLabel}>電話番号</Text><Pressable style={styles.profileEditorAction} onPress={() => { setEditing(false); onPhone(); }}><Text style={styles.profileEditorActionText}>{user.verificationStatus === "PHONE_VERIFIED" ? "電話番号を変更" : "電話番号を確認"}</Text></Pressable>
            <Text style={styles.profileEditorLabel}>活動エリア</Text><TextInput style={styles.profileEditorInput} value={homeArea} onChangeText={setHomeArea} maxLength={80} placeholder="例：新宿・渋谷" />
            <Text style={styles.profileEditorLabel}>自己紹介</Text><TextInput style={[styles.profileEditorInput, styles.profileEditorBio]} value={bio} onChangeText={setBio} maxLength={500} multiline textAlignVertical="top" placeholder="好きなことや参加したいHangoutを書きましょう" />
            <Text style={styles.profileEditorLabel}>興味のあること</Text><TextInput style={styles.profileEditorInput} value={interests} onChangeText={setInterests} maxLength={300} placeholder="カフェ、ランニング、ラーメン" /><Text style={styles.profileEditorHint}>「、」またはカンマで区切って20個まで登録できます。</Text>
            <Text style={styles.profileEditorLabel}>性別</Text><View style={styles.profileGenderOptions}>{[["UNDISCLOSED", "回答しない"], ["MALE", "男性"], ["FEMALE", "女性"], ["OTHER", "その他"]].map(([value, label]) => <Pressable key={value} style={[styles.profileGenderOption, gender === value && styles.profileGenderOptionSelected]} onPress={() => setGender(value)}><Text style={gender === value ? styles.profileGenderOptionTextSelected : styles.profileGenderOptionText}>{label}</Text></Pressable>)}</View>
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
  switchButton: {
    backgroundColor: "#d9ff68",
    paddingHorizontal: 10,
    paddingVertical: 7,
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
  navItem: { alignItems: "center", minWidth: 80 },
  navMark: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#ccd5ce",
    marginBottom: 8,
  },
  navMarkOn: { width: 20, backgroundColor: "#176b48" },
  navLabel: { fontSize: 10, color: "#89908b", fontWeight: "700" },
  navOn: { color: "#176b48" },
  mapPage: { padding: 18, paddingBottom: 40, backgroundColor: "#f7f8f3" },
  mapHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mapLocationButton: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 13, borderWidth: 1, borderColor: "#d8ded8", backgroundColor: "#fff" },
  mapCanvas: { height: 310, marginTop: 4, borderRadius: 24, overflow: "hidden", backgroundColor: "#dfead9" },
  mapRoad: { position: "absolute", backgroundColor: "#fff", borderColor: "#cbd6ca", borderWidth: 1 },
  mapRoadHorizontal: { top: "43%", left: -20, right: -20, height: 38, transform: [{ rotate: "-8deg" }] },
  mapRoadVertical: { top: -20, bottom: -20, left: "58%", width: 34, transform: [{ rotate: "12deg" }] },
  mapYou: { position: "absolute", left: "48%", top: "45%", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#17221d" },
  mapYouText: { color: "#fff", fontSize: 9, fontWeight: "900" },
  mapPin: { position: "absolute", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#fff", backgroundColor: "#176b48", shadowColor: "#17221d", shadowOpacity: 0.2, shadowRadius: 5 },
  mapPinText: { color: "#fff", fontSize: 12, fontWeight: "900" },
  mapPrivacy: { marginVertical: 13, color: "#59635c", fontSize: 11, lineHeight: 17 },
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
    padding: 12,
    borderRadius: 14,
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
  authError: { color: "#bd3a28", fontSize: 12, marginTop: 8 },
  primary: {
    backgroundColor: "#176b48",
    padding: 15,
    borderRadius: 15,
    marginTop: 15,
    alignItems: "center",
  },
  primaryText: { color: "#fff", fontWeight: "900" },
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
  cardTop: { flexDirection: "row", gap: 12 },
  cardCategory: {
    fontSize: 11,
    fontWeight: "900",
    color: "#176b48",
    marginBottom: 4,
  },
  cardCopy: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: "900", color: "#17221d" },
  cardBottom: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hostName: { fontSize: 12, fontWeight: "700" },
  hostTier: { fontSize: 9, fontWeight: "900", color: "#8a6647", marginTop: 3 },
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
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  choice: {
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
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#176b48",
  },
  requestActions: { flexDirection: "row", gap: 6 },
  rejectButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#eef1ed",
  },
  acceptButton: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: "#176b48",
  },
  finishButtonWide: {
    marginTop: 20,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#17221d",
    alignItems: "center",
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
    width: 42,
    height: 42,
    backgroundColor: "#24a35a",
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { backgroundColor: "#bdc6c0" },
  sendText: { color: "#fff", fontSize: 18, fontWeight: "900" },
  profile: { alignItems: "center", padding: 24 },
  avatar: { width: 92, height: 92, borderRadius: 46, backgroundColor: "#ddd" },
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
  profileEditButton: { marginTop: 12, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, backgroundColor: "#176b48" },
  profileEditButtonText: { color: "#fff", fontSize: 13, fontWeight: "900" },
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
  profileEditorAction: { minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#176b48", borderRadius: 13, backgroundColor: "#fff" },
  profileEditorActionText: { color: "#176b48", fontSize: 13, fontWeight: "900" },
  profileGenderOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  profileGenderOption: { paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#d8dfd9", borderRadius: 999, backgroundColor: "#fff" },
  profileGenderOptionSelected: { borderColor: "#176b48", backgroundColor: "#e9f7ec" },
  profileGenderOptionText: { color: "#59635c", fontSize: 12, fontWeight: "700" },
  profileGenderOptionTextSelected: { color: "#176b48", fontSize: 12, fontWeight: "900" },
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
    borderWidth: 1,
    borderColor: "#cfd5d0",
    borderRadius: 14,
    paddingHorizontal: 30,
    paddingVertical: 12,
  },
  logoutText: { color: "#4f5952", fontWeight: "800" },
  deleteButton: { marginTop: 15, padding: 10 },
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
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#dce2dc",
  },
  scoreButtonOn: { backgroundColor: "#176b48", borderColor: "#176b48" },
  scoreText: { fontSize: 10, fontWeight: "900", color: "#b47715" },
  scoreTextOn: { color: "#fff" },
  ratingUnlockHint: { fontSize: 8, color: "#707a73", marginTop: 6 },
  genderChoices: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  genderChoice: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 14,
    backgroundColor: "#eef1ed",
  },
  genderChoiceOn: { backgroundColor: "#d9ff68" },
  genderChoiceText: { fontSize: 11, fontWeight: "800" },
  stampMessage: {
    width: 150,
    height: 150,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#dfe6df",
  },
  stampImage: { width: "100%", height: "100%" },
  stampText: {
    position: "absolute",
    left: 5,
    right: 5,
    bottom: 8,
    color: "#fff",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  mobileStampTray: {
    height: 84,
    paddingVertical: 5,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
  },
  mobileStampChoice: {
    width: 72,
    height: 72,
    marginRight: 7,
    borderRadius: 14,
    overflow: "hidden",
  },
  mobileStampLabel: {
    position: "absolute",
    left: 3,
    right: 3,
    bottom: 4,
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    textAlign: "center",
    textShadowColor: "#000",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  mobileStampCreate: {
    width: 72,
    height: 72,
    marginRight: 7,
    borderRadius: 14,
    backgroundColor: "#edf1ec",
    alignItems: "center",
    justifyContent: "center",
  },
  mobileStampPlus: { fontSize: 20, color: "#176b48" },
  mobileStampCreateText: { fontSize: 8, fontWeight: "800", color: "#176b48" },
});
