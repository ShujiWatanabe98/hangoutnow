import { useCallback, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { ActivityIndicator, Alert, Animated, FlatList, Image, InputAccessoryView, Keyboard, KeyboardAvoidingView, Linking, Modal, PanResponder, Platform, Pressable, RefreshControl, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { WebView } from "react-native-webview";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";

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
  { label: "ダーツ", uri: `${WEBSITE_URL}/assets/hangout-dartu.jpg`, category: "ダーツ", title: "渋谷で気軽にダーツしよう", description: "初心者も経験者も歓迎！気軽にダーツを楽しみながら交流しましょう。" },
  { label: "バー", uri: `${WEBSITE_URL}/assets/hangout-bar.jpg`, category: "バー", title: "落ち着いたバーで話そう", description: "静かなバーでゆっくり話しながら、楽しい時間を過ごしましょう。" },
  { label: "ごはん", uri: `${WEBSITE_URL}/assets/hangout-gohan.jpg`, category: "ごはん", title: "新宿で一緒にごはんを食べよう", description: "ひとりでは入りにくいお店へ、みんなで気軽にごはんを食べに行きましょう。" },
  { label: "カラオケ", uri: `${WEBSITE_URL}/assets/hangout-karaoke.jpg`, category: "カラオケ", title: "新宿でカラオケを楽しもう", description: "歌の上手さは関係なし！好きな曲を歌って、みんなで楽しく盛り上がりましょう。" },
  { label: "英会話", uri: `${WEBSITE_URL}/assets/hangout-english.jpg`, category: "英会話", title: "初心者向け英会話カフェ", description: "間違えても大丈夫。カフェで気軽に英会話を練習しながら交流しましょう。" },
  { label: "シーシャ", uri: `${WEBSITE_URL}/assets/hangout-shisha.jpg`, category: "シーシャ", title: "ゆったりシーシャを楽しもう", description: "落ち着いた空間でシーシャを楽しみながら、気軽におしゃべりしましょう。" },
  { label: "スイーツ", uri: `${WEBSITE_URL}/assets/hangout-sweet.jpg`, category: "スイーツ", title: "話題のスイーツを食べに行こう", description: "気になっていたスイーツを一緒に楽しみながら、のんびり交流しましょう。" },
  { label: "映画", uri: `${WEBSITE_URL}/assets/hangout-movie.jpg`, category: "映画", title: "一緒に映画を観に行こう", description: "気になる映画を一緒に観て、終わったあとは感想を楽しく話しましょう。" },
] as const;
const SESSION_KEY = "hangout-now-session";
const MANUAL_AREA_KEY = "hangout-now-manual-area";
const LINE_REDIRECT_URI = "hangoutnow://auth/line";
const X_REDIRECT_URI = "hangoutnow://auth/x";
const GOOGLE_REDIRECT_URI = "hangoutnow://auth/google";
const APPLE_REDIRECT_URI = "hangoutnow://auth/apple";
const IOS_KEYBOARD_ACCESSORY_ID = "hangout-now-keyboard-actions";
WebBrowser.maybeCompleteAuthSession();
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function AppTextInput(props: React.ComponentProps<typeof TextInput>) {
  return <TextInput {...props} inputAccessoryViewID={props.inputAccessoryViewID ?? (Platform.OS === "ios" ? IOS_KEYBOARD_ACCESSORY_ID : undefined)} />;
}
const INTEREST_OPTIONS = ["カフェ", "ラーメン", "ランニング", "飲み会", "ダーツ", "バー", "ごはん", "カラオケ", "英会話", "シーシャ", "スイーツ", "映画"] as const;
const MATCH_ACTIVITY_OPTIONS = [...INTEREST_OPTIONS, "チル"] as const;
const SOCIAL_STYLE_OPTIONS = ["静かに話したい", "ワイワイ楽しみたい", "初対面でも積極的", "少人数でじっくり", "聞き役が多い"] as const;
const PARTICIPATION_GOAL_OPTIONS = ["趣味仲間", "友達づくり", "暇つぶし", "情報交換", "運動習慣", "食事・飲み", "新しい体験"] as const;
const FIRST_TIME_OPTIONS = ["初参加歓迎", "ひとり参加が安心", "常連が多くてもOK", "主催者から話しかけてほしい"] as const;
const AVOID_OPTIONS = ["大人数", "飲酒中心", "深夜", "屋外", "激しい運動", "写真撮影", "営業・勧誘"] as const;
const FLEXIBILITY_OPTIONS = ["時間厳守", "多少の遅れは許容", "途中参加OK", "途中退出OK", "急な予定変更OK"] as const;
const LANGUAGE_OPTIONS = [["JAPANESE", "日本語"], ["ENGLISH", "英語"], ["KOREAN", "韓国語"], ["CHINESE", "中国語"]] as const;
const MATCH_AREA_OPTIONS = ["新宿", "渋谷", "池袋", "東京", "品川", "上野", "横浜"] as const;
const MATCH_TIME_OPTIONS = ["朝", "昼", "夕方", "夜", "深夜"] as const;
const MATCH_DAY_OPTIONS = ["月", "火", "水", "木", "金", "土", "日"] as const;
const MATCH_TRAVEL_OPTIONS = [[15, "15分"], [30, "30分"], [45, "45分"], [60, "1時間"], [90, "1時間半"]] as const;
const MATCH_GROUP_OPTIONS = [[2, "2人"], [4, "3〜4人"], [6, "5〜6人"], [10, "7〜10人"]] as const;
const MATCH_BUDGET_OPTIONS = [[0, 1000, "〜1,000円"], [1000, 3000, "1,000〜3,000円"], [3000, 5000, "3,000〜5,000円"], [5000, 10000, "5,000〜10,000円"], [10000, 100000, "10,000円〜"]] as const;

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
  alcoholPreference: "NONE" | "SOMETIMES" | "YES" | null;
  smokingPreference: "NON_SMOKING" | "SEPARATED" | "NO_PREFERENCE" | null;
  avoidPreferences: string[];
  scheduleFlexibility: string[];
  behaviorLearningEnabled: boolean;
  preferredLanguages: string[];
  interests: string[];
  verificationStatus: string;
  profilePhoto: string | null;
  profilePhotos: string[];
};

type UpdateProfileInput = Pick<User, "displayName" | "gender" | "bio" | "homeArea" | "interests" | "preferredAreas" | "preferredActivities" | "preferredAgeMin" | "preferredAgeMax" | "preferredGenders" | "activityTimeSlots" | "matchingDataConsent" | "participationUrgency" | "maxTravelMinutes" | "preferredGroupSizes" | "budgetMin" | "budgetMax" | "socialStyles" | "participationGoals" | "firstTimePreferences" | "alcoholPreference" | "smokingPreference" | "avoidPreferences" | "scheduleFlexibility" | "behaviorLearningEnabled" | "preferredLanguages">;

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
  acceptedParticipants?: ApplicantProfile[];
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
  age?: number;
  gender?: string | null;
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
type MatchFeedbackReason = "TIME" | "DISTANCE" | "FULL" | "BUDGET" | "CONDITIONS" | "OTHER";
const AREA_COORDINATES: Record<AlphaArea, { latitude: number; longitude: number }> = {
  新宿: { latitude: 35.6909, longitude: 139.7003 },
  渋谷: { latitude: 35.658, longitude: 139.7016 },
};
const DEFAULT_MAP_COORDINATES = { latitude: 35.6762, longitude: 139.6993 };
type AuthMode = "welcome" | "login" | "register";
type LocationSource = "unset" | "manual" | "gps";
type OAuthRegistrationInput = { displayName: string; birthDate: string; gender: string; profilePhotos?: string[] };
function messageText(body: string) {
  return body.startsWith("__STAMP__") ? "過去のスタンプ" : body;
}
function stateLabel(hangout: Hangout) {
  if (hangout.status === "STARTED") return "Hangout中";
  if (hangout.status === "FINISHED") return "終了";
  if (hangout.status === "CANCELLED") return "中止";
  return hangout.myJoinStatus === "ACCEPTED" ? "承認済み" : hangout.myJoinStatus === "PENDING" ? "申請中" : hangout.myJoinStatus === "WAITLISTED" ? "待機中" : hangout.status === "FULL" ? "満員" : "募集中";
}
function categoryLabel(category: string) {
  return ({ FOOD: "食事", RUNNING: "ランニング", CAFE: "カフェ", MOTORCYCLE: "ツーリング", WALKING: "散歩" } as Record<string, string>)[category] ?? category;
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

function normalizePhoneNumber(value: string): string {
  const compact = value.normalize("NFKC").trim().replace(/[\s()（）\-‐‑‒–—―ー]/g, "");
  if (compact.startsWith("+")) return compact;
  if (compact.startsWith("0")) return `+81${compact.slice(1)}`;
  if (compact.startsWith("81")) return `+${compact}`;
  return compact;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [hangouts, setHangouts] = useState<Hangout[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [ratingRoom, setRatingRoom] = useState<GroupRoom | null>(null);
  const [finishConfirmationId, setFinishConfirmationId] = useState<string | null>(null);
  const [reportingHangout, setReportingHangout] = useState<Hangout | null>(null);
  const [matchFeedbackHangout, setMatchFeedbackHangout] = useState<Hangout | null>(null);
  const [decidingRequest, setDecidingRequest] = useState<{ id: string; accept: boolean } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageBody, setMessageBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [demoRole, setDemoRole] = useState<"host" | "guest" | null>(null);
  const [unreadByRoom, setUnreadByRoom] = useState<Record<string, number>>({});
  const [realtimeOnline, setRealtimeOnline] = useState(false);
  const [locationLabel, setLocationLabel] = useState("エリア未設定");
  const [locationSource, setLocationSource] = useState<LocationSource>("unset");
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [hostStatus, setHostStatus] = useState<HostStatus | null>(null);
  const [profileActivity, setProfileActivity] = useState<ProfileActivity>({ hosted: [], participated: [], hearted: [] });
  const [selectedArea, setSelectedArea] = useState<AlphaArea>("新宿");
  const [selectedHangout, setSelectedHangout] = useState<Hangout | null>(null);
  const [detailReturnScreen, setDetailReturnScreen] = useState<"home" | "map" | "profile">("home");
  const [chatReturnScreen, setChatReturnScreen] = useState<"home" | "profile" | "detail">("home");
  const [ratingReturnScreen, setRatingReturnScreen] = useState<"home" | "detail">("home");
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [notificationInbox, setNotificationInbox] = useState<NotificationInbox>({ items: [], unreadCount: 0, enabled: true });
  const [actionMessage, setActionMessage] = useState("");
  const handledNotificationResponseId = useRef<string | null>(null);
  const actionMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showActionMessage = useCallback((message: string) => {
    if (actionMessageTimer.current) clearTimeout(actionMessageTimer.current);
    setActionMessage(message);
    actionMessageTimer.current = setTimeout(() => {
      setActionMessage("");
      actionMessageTimer.current = null;
    }, 2200);
  }, []);

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

  const loadHome = useCallback(async (locationOverride?: { latitude: number; longitude: number } | null) => {
    if (!session) return [] as Hangout[];
    const activeCoordinates = locationOverride === undefined ? coordinates : locationOverride;
    const query = activeCoordinates ? `?latitude=${activeCoordinates.latitude}&longitude=${activeCoordinates.longitude}&radiusKm=5` : "";
    const nextHangouts = await request<Hangout[]>(`/hangouts${query}`);
    setHangouts(nextHangouts);
    if (session.user.matchingDataConsent && session.user.behaviorLearningEnabled) {
      void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({ eventType: "DISCOVERY_VIEWED" }),
      }).catch(() => undefined);
    }
    return nextHangouts;
  }, [coordinates, request, session]);

  const toggleHeart = useCallback(async (hangout: Hangout) => {
    try {
      const result = await request<{ hearted: boolean; heartCount: number }>(`/hangouts/${hangout.id}/heart`, { method: "POST" });
      const update = (item: Hangout) => item.id === hangout.id ? { ...item, ...result } : item;
      setHangouts((current) => current.map(update));
      setSelectedHangout((current) => current ? update(current) : current);
      showActionMessage(result.hearted ? "ハートを送りました" : "ハートを取り消しました");
    } catch {
      Alert.alert("ハートを送れませんでした", "通信状態を確認してもう一度お試しください。");
    }
  }, [request, showActionMessage]);

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
      setChatReturnScreen("home");
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
    void SecureStore.getItemAsync(MANUAL_AREA_KEY).then((storedArea) => {
      if (storedArea !== "新宿" && storedArea !== "渋谷") return;
      setSelectedArea(storedArea);
      setCoordinates(AREA_COORDINATES[storedArea]);
      setLocationLabel(storedArea);
      setLocationSource("manual");
    }).catch(() => undefined);
  }, []);

  useEffect(() => () => {
    if (actionMessageTimer.current) clearTimeout(actionMessageTimer.current);
  }, []);

  useEffect(() => { void SecureStore.deleteItemAsync(SESSION_KEY); }, []);

  const enableDeviceNotifications = useCallback(async (requestPermission: boolean) => {
      if (Platform.OS === "web" || !Device.isDevice) {
        if (requestPermission) Alert.alert("端末通知", "実機のiPhoneで通知を許可できます。");
        return;
      }
      const existing = await Notifications.getPermissionsAsync();
      const permission = existing.status === "granted" ? existing : requestPermission ? await Notifications.requestPermissionsAsync() : existing;
      if (permission.status !== "granted") {
        if (requestPermission) Alert.alert("端末通知を許可できませんでした", "iPhoneの設定からHangout Nowの通知を許可してください。");
        return;
      }
      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      if (typeof projectId !== "string" || !projectId) return;
      const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
      await request("/notifications/push-token", {
        method: "POST",
        body: JSON.stringify({ token, platform: Platform.OS }),
      });
      await SecureStore.setItemAsync("hangout-now-push-token", token);
      if (requestPermission) Alert.alert("端末通知を許可しました", "Hangoutの更新をiPhoneで受け取れます。");
  }, [request]);

  useEffect(() => {
    if (!session) return;
    void enableDeviceNotifications(false).catch(() => undefined);
  }, [enableDeviceNotifications, session?.user.id]);

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

  async function register(input: { email: string; password: string; displayName: string; birthDate: string; gender: string; profilePhotos?: string[] }) {
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

  async function authenticateWithLine(input?: OAuthRegistrationInput) {
    setLoading(true);
    setError("");
    try {
      const startUrl = `${API_URL}/auth/line/start?returnTo=${encodeURIComponent(LINE_REDIRECT_URI)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, LINE_REDIRECT_URI);
      if (result.type !== "success" || !result.url) throw new Error("LINEログインがキャンセルされました");
      const ticket = new URL(result.url).searchParams.get("ticket");
      if (!ticket) throw new Error("LINEログインの確認情報を取得できませんでした");
      const response = await fetch(`${API_URL}/auth/line/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket, ...input }) });
      const data = await readJson(response) as Session | { message?: string | string[] };
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

  async function authenticateWithX(input?: OAuthRegistrationInput) {
    setLoading(true);
    setError("");
    try {
      const startUrl = `${API_URL}/auth/x/start?returnTo=${encodeURIComponent(X_REDIRECT_URI)}`;
      const result = await WebBrowser.openAuthSessionAsync(startUrl, X_REDIRECT_URI);
      if (result.type !== "success" || !result.url) throw new Error("Xログインがキャンセルされました");
      const ticket = new URL(result.url).searchParams.get("ticket");
      if (!ticket) throw new Error("Xログインの確認情報を取得できませんでした");
      const response = await fetch(`${API_URL}/auth/x/redeem`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ticket, ...input }) });
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

  async function authenticateWithOAuth(provider:"google"|"apple", input?: OAuthRegistrationInput) {
    setLoading(true);setError("");
    try{const redirectUri=provider==="google"?GOOGLE_REDIRECT_URI:APPLE_REDIRECT_URI;const label=provider==="google"?"Google":"Apple";const result=await WebBrowser.openAuthSessionAsync(`${API_URL}/auth/${provider}/start?returnTo=${encodeURIComponent(redirectUri)}`,redirectUri);if(result.type!=="success"||!result.url)throw new Error(`${label}ログインがキャンセルされました`);const ticket=new URL(result.url).searchParams.get("ticket");if(!ticket)throw new Error(`${label}ログインの確認情報を取得できませんでした`);const response=await fetch(`${API_URL}/auth/${provider}/redeem`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({ticket,...input})});const data=await readJson(response) as Session|{message?:string|string[]};if(!response.ok||!("accessToken" in data)){const message="message" in data?data.message:null;throw new Error(Array.isArray(message)?message[0]:message||`${label}ログインに失敗しました`)}setSession(data);setDemoRole(null);setScreen("home")}catch(cause){setError(cause instanceof Error?cause.message:"ログインに失敗しました")}finally{setLoading(false)}
  }

  async function authenticateWithPhone(phone:string,code?:string,challengeToken?:string):Promise<{challengeToken?:string;demoCode?:string}>{
    const normalizedPhone=normalizePhoneNumber(phone);
    setLoading(true);setError("");try{const path=challengeToken?'/auth/phone/confirm':'/auth/phone/request';const response=await fetch(`${API_URL}${path}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(challengeToken?{phone:normalizedPhone,code,challengeToken}:{phone:normalizedPhone})});const data=await readJson(response) as Session|{challengeToken?:string;demoCode?:string;message?:string|string[]};if(!response.ok){const message='message'in data?data.message:null;throw new Error(Array.isArray(message)?message[0]:message||'電話番号認証に失敗しました')}if('accessToken'in data){setSession(data);setDemoRole(null);setScreen('profile');return{}}return{challengeToken:data.challengeToken,demoCode:data.demoCode}}catch(cause){setError(cause instanceof Error?cause.message:'電話番号認証に失敗しました');throw cause}finally{setLoading(false)}
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
      showActionMessage(joinRequest.status === "WAITLISTED" ? "待機リストに登録しました" : "ひとこと付きで参加申請を送りました");
      if (session?.user.matchingDataConsent && session.user.behaviorLearningEnabled) void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "JOIN_REQUESTED",
          hangoutId: hangout.id,
        }),
      }).catch(() => undefined);
      await loadHome();
    } catch (cause) {
      try {
        const confirmed = await request<Hangout>(`/hangouts/${hangout.id}`);
        if (["PENDING", "WAITLISTED", "ACCEPTED"].includes(confirmed.myJoinStatus ?? "")) {
          setSelectedHangout((current) => current?.id === confirmed.id ? confirmed : current);
          setHangouts((current) => current.map((item) => item.id === confirmed.id ? confirmed : item));
          showActionMessage(confirmed.myJoinStatus === "WAITLISTED" ? "待機リストに登録しました" : "参加申請を受け付けました");
          return;
        }
      } catch {
        // The original submission error is shown when the server state cannot be confirmed.
      }
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
      if (session?.user.matchingDataConsent && session.user.behaviorLearningEnabled) void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "HANGOUT_VIEWED",
          hangoutId: detail.id,
        }),
      }).catch(() => undefined);
      setDetailReturnScreen(screen === "profile" ? "profile" : screen === "map" ? "map" : "home");
      setSelectedHangout(detail);
      if (detail.hostUserId === session?.user.id) setJoinRequests(await request<JoinRequest[]>(`/hangouts/${detail.id}/requests`));
      else setJoinRequests([]);
      if (detail.status === "FINISHED") await loadRooms();
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
      if (session?.user.matchingDataConsent && session.user.behaviorLearningEnabled) void request("/analytics/events", {
        method: "POST",
        body: JSON.stringify({
          eventType: "HANGOUT_CREATED",
          hangoutId: created.id,
        }),
      }).catch(() => undefined);
      setSelectedArea(input.area);
      setCoordinates(coordinates);
      setLocationLabel(input.area);
      setDetailReturnScreen("home");
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
      showActionMessage("Hangoutと写真を更新しました");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Hangoutを更新できませんでした";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }
  async function decideJoinRequest(requestId: string, accept: boolean) {
    if (!selectedHangout || decidingRequest) return;
    setDecidingRequest({ id: requestId, accept });
    setLoading(true);
    setError("");
    try {
      await request(`/join-requests/${requestId}/${accept ? "accept" : "reject"}`, { method: "POST" });
      setJoinRequests(await request<JoinRequest[]>(`/hangouts/${selectedHangout.id}/requests`));
      setSelectedHangout(await request<Hangout>(`/hangouts/${selectedHangout.id}`));
      await loadHome();
      showActionMessage(accept ? "参加申請を承認しました" : "参加申請を却下しました");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "参加申請を更新できませんでした");
    } finally {
      setDecidingRequest(null);
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
    setReportingHangout(hangout);
  }
  async function reportHost(hangout: Hangout, reason: ReportReason, details: string, blockUser: boolean) {
    setLoading(true);
    setError("");
    try {
      await request("/safety/reports", {
        method: "POST",
        body: JSON.stringify({
          targetUserId: hangout.hostUserId,
          hangoutId: hangout.id,
          reason,
          details: details.trim() || undefined,
          blockUser,
        }),
      });
      setReportingHangout(null);
      if (blockUser) {
        setHangouts((current) => current.filter((item) => item.hostUserId !== hangout.hostUserId));
        setSelectedHangout(null);
        setScreen("home");
      }
      Alert.alert("通報を受け付けました", blockUser ? "相手をブロックし、運営の確認対象に追加しました。" : "運営の確認対象に追加しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通報を送信できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function verifyPhone(phone: string, code?: string) {
    const normalizedPhone = normalizePhoneNumber(phone);
    setLoading(true);
    setError("");
    try {
      if (!code) {
        await request("/users/me/phone/request", {
          method: "POST",
          body: JSON.stringify({ phone: normalizedPhone }),
        });
        return;
      }
      const user = await request<User>("/users/me/phone/confirm", {
        method: "POST",
        body: JSON.stringify({ phone: normalizedPhone, code }),
      });
      setSession((current) => (current ? { ...current, user } : current));
      setScreen("profile");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "電話番号を確認できませんでした");
      throw cause;
    } finally {
      setLoading(false);
    }
  }
  async function chooseArea(area: AlphaArea) {
    const next = AREA_COORDINATES[area];
    setSelectedArea(area);
    setCoordinates(next);
    setLocationLabel(area);
    setLocationSource("manual");
    void SecureStore.setItemAsync(MANUAL_AREA_KEY, area).catch(() => undefined);
    setLoading(true);
    setError("");
    try {
      await loadHome(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hangoutを再取得できませんでした");
    } finally {
      setLoading(false);
    }
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
      setChatReturnScreen("detail");
      setScreen("chat");
      await openRoom(room);
    } finally {
      setLoading(false);
    }
  }

  async function sendMessage(quickBody?: string) {
    const body = (quickBody ?? messageBody).trim();
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
    setFinishConfirmationId(hangoutId);
  }
  async function finishHangout(hangoutId: string) {
    setLoading(true);
    setError("");
    try {
      await request(`/hangouts/${hangoutId}/finish`, { method: "POST" });
      setFinishConfirmationId(null);
      setSelectedHangout(await request<Hangout>(`/hangouts/${hangoutId}`));
      const nextRooms = await loadRooms();
      const finishedRoom = nextRooms.find((room): room is GroupRoom => room.type === "GROUP" && room.hangout.id === hangoutId);
      if (finishedRoom) {
        setRatingReturnScreen("home");
        setRatingRoom(finishedRoom);
        setScreen("rating");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Hangoutを終了できませんでした");
    } finally {
      setLoading(false);
    }
  }
  async function openHangoutRating(hangoutId: string) {
    setLoading(true);
    try {
      const nextRooms = await loadRooms();
      const room = nextRooms.find((item): item is GroupRoom => item.type === "GROUP" && item.hangout.id === hangoutId);
      if (!room) return Alert.alert("評価を開始できません", "Hangoutのトーク情報を取得できませんでした。");
      setRatingReturnScreen("detail");
      setRatingRoom(room);
      setScreen("rating");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "評価画面を開けませんでした");
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

  function confirmDeleteNotifications() {
    if (!notificationInbox.items.length) {
      Alert.alert("削除する通知はありません");
      return;
    }
    Alert.alert("通知を削除", "通知をすべて削除しますか？", [
      { text: "キャンセル", style: "cancel" },
      { text: "削除", style: "destructive", onPress: () => void deleteNotifications() },
    ]);
  }

  async function deleteNotifications() {
    try {
      await request("/notifications", { method: "DELETE" });
      await loadNotifications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "通知を削除できませんでした");
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
      setLocationSource("gps");
      await loadHome(next);
      showActionMessage("現在地から近い順に並べました");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "現在地を取得できませんでした");
    } finally {
      setLoading(false);
    }
  }

  async function chooseProfilePhoto(index: number, source?: "camera" | "library") {
    if (!source) {
      Alert.alert("プロフィール画像を追加", "追加方法を選んでください。", [
        { text: "カメラで撮影", onPress: () => void chooseProfilePhoto(index, "camera") },
        { text: "写真ライブラリから選ぶ", onPress: () => void chooseProfilePhoto(index, "library") },
        { text: "キャンセル", style: "cancel" },
      ]);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error(source === "camera" ? "カメラへのアクセスを許可してください" : "写真ライブラリへのアクセスを許可してください");
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ["images"],
        allowsMultipleSelection: false,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      };
      const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset=result.assets[0];
      if(!asset?.base64)throw new Error("写真を読み込めませんでした");
      const mediaType=asset.mimeType==="image/png"?"png":asset.mimeType==="image/webp"?"webp":"jpeg";
      const photo=`data:image/${mediaType};base64,${asset.base64}`;
      if (photo.length > 1_500_000) throw new Error("画像サイズが大きすぎます。別の写真を選ぶか、写真を小さく切り抜いてください");
      const existingPhotos=(session?.user.profilePhotos?.length ? session.user.profilePhotos : session?.user.profilePhoto ? [session.user.profilePhoto] : []).filter((value): value is string => Boolean(value));
      const profilePhotos=[...existingPhotos];
      const targetIndex=Math.min(index,profilePhotos.length);
      if(targetIndex===profilePhotos.length)profilePhotos.push(photo);
      else profilePhotos[targetIndex]=photo;
      const user = await request<User>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ profilePhotos }),
      });
      setSession((current) => (current ? { ...current, user } : current));
    } catch (cause) {
      const message=cause instanceof Error ? cause.message : "写真を更新できませんでした";
      setError(message);
      Alert.alert("画像を更新できませんでした", message);
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
      const [nextHangouts, nextRooms] = await Promise.all([loadHome(), loadRooms()]);
      setSelectedHangout((current) => current ? nextHangouts.find((hangout) => hangout.id === current.id) ?? current : current);
      setSelectedRoom((current) => current ? nextRooms.find((room) => room.id === current.id) ?? current : current);
      setRatingRoom((current) => current ? nextRooms.find((room): room is GroupRoom => room.type === "GROUP" && room.id === current.id) ?? current : current);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "プロフィールを更新できませんでした";
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }

  function submitMatchFeedback(hangout: Hangout) {
    setMatchFeedbackHangout(hangout);
  }
  async function sendMatchFeedback(hangout: Hangout, reason: MatchFeedbackReason) {
    try {
      await request("/analytics/match-feedback", { method: "POST", body: JSON.stringify({ hangoutId: hangout.id, outcome: "NOT_MATCHED", reason }) });
      setMatchFeedbackHangout(null);
      Alert.alert("送信しました", "おすすめ改善に反映しました。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "理由を送信できませんでした");
    }
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

  if (!session) {
    return <AuthScreen loading={loading} error={error} onLogin={authenticate} onRegister={register} onLine={authenticateWithLine} onX={authenticateWithX} onGoogle={(input)=>authenticateWithOAuth('google', input)} onApple={(input)=>authenticateWithOAuth('apple', input)} onPhone={authenticateWithPhone} />;
  }

  return (
    <SafeAreaView style={styles.safe}>
      {demoRole && screen !== "notifications" && !(screen === "chat" && selectedRoom) && (
        <View style={styles.demoBanner}>
          <View>
            <Text style={styles.demoTitle}>デモ：{demoRole === "host" ? "サヤカ（主催者）" : "マドカ（参加者）"}として体験中</Text>
            <Text style={styles.demoHint}>{demoRole === "host" ? "作成・承認・終了・★1〜5評価を操作" : "参加申請・トーク・★1〜5評価を操作"}</Text>
          </View>
          <View style={styles.demoBannerActions}>
            <Pressable onPress={confirmResetDemo} style={styles.resetDemoButton}><Text style={styles.switchText}>最初から</Text></Pressable>
            <Pressable onPress={logout} style={styles.switchButton}><Text style={styles.switchText}>役割切替</Text></Pressable>
          </View>
        </View>
      )}
      {screen !== "chat" && screen !== "detail" && screen !== "create" && screen !== "notifications" && screen !== "profile" && screen !== "phone" && screen !== "rating" && (
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
      {actionMessage ? <View style={styles.actionToast} accessibilityLiveRegion="polite"><Text style={styles.actionToastText}>{actionMessage}</Text></View> : null}
      <KeyboardAvoidingView style={styles.content} behavior={Platform.OS === "ios" && screen !== "chat" ? "padding" : undefined} keyboardVerticalOffset={0}>
        {screen === "home" && <HomeScreen user={session.user} hangouts={hangouts} refreshing={refreshing} locationLabel={locationLabel} locationSource={locationSource} selectedArea={selectedArea} demoRole={demoRole} onArea={chooseArea} onLocation={useCurrentLocation} onMap={() => setScreen("map")} onRefresh={refreshCurrent} onOpen={openHangout} onHeart={toggleHeart} onCreate={() => { if (!session.user.profilePhoto) { Alert.alert("プロフィール写真が必要です", "Hangoutを作る前に、顔が分かるプロフィール写真を登録してください。"); setScreen("profile"); return; } setScreen(session.user.verificationStatus === "PHONE_VERIFIED" ? "create" : "phone"); }} />}
        {screen === "map" && <MapScreen hangouts={hangouts} coordinates={coordinates ?? DEFAULT_MAP_COORDINATES} onBack={() => setScreen("home")} onOpen={openHangout} />}
        {screen === "create" && <CreateHangoutScreen area={selectedArea} onBack={() => setScreen("home")} onSubmit={createHangout} />}
        {screen === "detail" && selectedHangout && <HangoutDetailScreen user={session.user} hangout={selectedHangout} requests={joinRequests} decidingRequest={decidingRequest} ratingMembers={rooms.find((room): room is GroupRoom => room.type === "GROUP" && room.hangout.id === selectedHangout.id)?.members ?? []} onBack={() => setScreen(detailReturnScreen)} onJoin={joinHangout} onChat={openHangoutChat} onRateMember={rateParticipant} onStart={startHangout} onFinish={confirmFinishHangout} onCancel={confirmCancelHangout} onEdit={updateHangout} onDecide={decideJoinRequest} onReport={confirmReportHost} onAttendance={updateAttendance} onMatchFeedback={submitMatchFeedback} />}
        {screen === "phone" && <PhoneVerificationScreen onBack={() => setScreen("profile")} onVerify={verifyPhone} />}
        {screen === "chat" && <ChatScreen user={session.user} rooms={rooms} selectedRoom={selectedRoom} messages={messages} messageBody={messageBody} sending={sending} refreshing={refreshing} unreadByRoom={unreadByRoom} realtimeOnline={realtimeOnline} onRefresh={refreshCurrent} onOpen={openRoom} onRate={rateParticipant} onBack={() => selectedRoom ? setSelectedRoom(null) : setScreen(chatReturnScreen)} onChangeBody={setMessageBody} onSend={sendMessage} />}
        {screen === "rating" && ratingRoom && <RatingScreen user={session.user} room={ratingRoom} onRate={rateParticipant} onDone={() => { setRatingRoom(null); setScreen(ratingReturnScreen); }} />}
        {screen === "profile" && <ProfileScreen user={session.user} hostStatus={hostStatus} activity={profileActivity} demo={!!demoRole} onBack={() => setScreen("home")} onChat={() => { setSelectedRoom(null); setChatReturnScreen("profile"); setScreen("chat"); }} onOpenHangout={(id) => void openHangout({ id })} onPhone={() => setScreen("phone")} onPhoto={chooseProfilePhoto} onSave={updateProfile} onDelete={confirmDeleteAccount} onLogout={logout} />}
        {screen === "notifications" && <NotificationScreen inbox={notificationInbox} refreshing={refreshing} onBack={() => setScreen("home")} onRefresh={refreshCurrent} onEnabled={setNotificationEnabled} onDeviceNotifications={() => void enableDeviceNotifications(true)} onRead={readNotification} onReadAll={readAllNotifications} onDelete={confirmDeleteNotifications} />}
        <FinishConfirmationModal hangoutId={finishConfirmationId} loading={loading} onClose={() => setFinishConfirmationId(null)} onConfirm={(id) => void finishHangout(id)} />
        <ReportHostModal hangout={reportingHangout} loading={loading} onClose={() => setReportingHangout(null)} onSubmit={(hangout, reason, details, blockUser) => void reportHost(hangout, reason, details, blockUser)} />
        <MatchFeedbackModal hangout={matchFeedbackHangout} onClose={() => setMatchFeedbackHangout(null)} onSelect={sendMatchFeedback} />
      </KeyboardAvoidingView>
      {Platform.OS === "ios" && (
        <InputAccessoryView nativeID={IOS_KEYBOARD_ACCESSORY_ID}>
          <View style={styles.keyboardAccessory}>
            <Pressable style={styles.keyboardDoneButton} onPress={Keyboard.dismiss} accessibilityRole="button" accessibilityLabel="キーボードを閉じる">
              <Text style={styles.keyboardDoneText}>完了</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}
      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color="#d9ff68" />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function AuthScreen({ loading, error, onLogin, onRegister, onLine, onX, onGoogle, onApple, onPhone }: { loading: boolean; error: string; onLogin: (email: string, password: string, role?: "host" | "guest" | null) => Promise<void>; onRegister: (input: { email: string; password: string; displayName: string; birthDate: string; gender: string; profilePhotos?: string[] }) => Promise<void>; onLine: (input?: OAuthRegistrationInput) => Promise<void>; onX: (input?: OAuthRegistrationInput) => Promise<void>; onGoogle:(input?: OAuthRegistrationInput)=>Promise<void>;onApple:(input?: OAuthRegistrationInput)=>Promise<void>;onPhone:(phone:string,code?:string,challengeToken?:string)=>Promise<{challengeToken?:string;demoCode?:string}> }) {
  const [mode, setMode] = useState<AuthMode>("welcome");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("1990-01-01");
  const [birthDatePickerVisible, setBirthDatePickerVisible] = useState(false);
  const [gender, setGender] = useState("UNDISCLOSED");
  const [providerNote, setProviderNote] = useState("");
  const [authInputError, setAuthInputError] = useState("");
  const [registrationPhotos, setRegistrationPhotos] = useState<string[]>([]);
  const [phone,setPhone]=useState("");const[phoneCode,setPhoneCode]=useState("");const[phoneChallenge,setPhoneChallenge]=useState<string|null>(null);
  const resetProviderState = () => { setPhone(""); setPhoneCode(""); setPhoneChallenge(null); setProviderNote(""); };
  const changeMode = (next: AuthMode) => { resetProviderState(); setAuthInputError(""); setMode(next); };
  const registrationInput = (): OAuthRegistrationInput | null => {
    if (!displayName.trim()) { setAuthInputError("表示名を入力してください。"); return null; }
    if (!birthDate) { setAuthInputError("生年月日を入力してください。"); return null; }
    setAuthInputError("");
    return { displayName: displayName.trim(), birthDate, gender, ...(registrationPhotos.length ? { profilePhotos: registrationPhotos } : {}) };
  };
  const submitEmail = () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) { setAuthInputError("正しいメールアドレスを入力してください。"); return; }
    if (password.length < 12) { setAuthInputError("パスワードは12文字以上で入力してください。"); return; }
    if (mode === "login") { setAuthInputError(""); void onLogin(normalizedEmail, password); return; }
    const input = registrationInput();
    if (input) void onRegister({ email: normalizedEmail, password, ...input });
  };
  const submitProvider = (provider: "Google" | "Apple" | "X" | "LINE") => {
    if (provider === "LINE") void onLine();
    else if (provider === "X") void onX();
    else if (provider === "Google") void onGoogle();
    else void onApple();
  };
  const chooseRegistrationPhotos = async (source?: "camera" | "library") => {
    if (!source) return Alert.alert("プロフィール画像を追加", "追加方法を選んでください。", [
      { text: "カメラで撮影", onPress: () => void chooseRegistrationPhotos("camera") },
      { text: "写真ライブラリから選ぶ", onPress: () => void chooseRegistrationPhotos("library") },
      { text: "キャンセル", style: "cancel" },
    ]);
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert(source === "camera" ? "カメラへのアクセスが必要です" : "写真へのアクセスが必要です");
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], allowsMultipleSelection: source === "library", selectionLimit: source === "library" ? 3 : 1, quality: 0.65, base64: true };
    const result = source === "camera" ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled) return;
    const photos = result.assets.flatMap((asset) => asset.base64 ? [`data:image/${asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpeg"};base64,${asset.base64}`] : []).slice(0, 3);
    setRegistrationPhotos((current) => source === "camera" ? [...current, ...photos].slice(0, 3) : photos);
  };
  const authDivider = <View style={styles.authDividerRow}>
    <View style={styles.authDividerLine} />
    <Text style={styles.authDividerText}>または</Text>
    <View style={styles.authDividerLine} />
  </View>;
  const providerSection = <>
    {(["Google", "Apple", "X", "LINE", "電話番号"] as const).map((provider) => (
      <Pressable
        key={provider}
        disabled={loading}
        style={[styles.providerButton, provider === "X" && styles.xProviderButton]}
        onPress={() => provider === "電話番号" ? (setAuthInputError(""), setPhoneCode(""), setProviderNote(""), setPhoneChallenge("")) : submitProvider(provider)}
      >
        <Text style={[styles.providerMark, provider === "X" && styles.xProviderText]}>{provider === "Google" ? "G" : provider === "Apple" ? "●" : provider === "X" ? "X" : provider === "LINE" ? "L" : "☎"}</Text>
        <Text style={[styles.providerButtonText, provider === "X" && styles.xProviderText]}>{`${provider}${mode === "register" ? "でアカウント作成" : "でログイン"}`}</Text>
      </Pressable>
    ))}
    {phoneChallenge!==null?<View><Field label="携帯電話番号" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09012345678" />{phoneChallenge?<Field label="SMSで届いた6桁の認証コード" value={phoneCode} onChangeText={setPhoneCode} keyboardType="number-pad" maxLength={6} />:null}<Text style={styles.phoneHint}>日本の電話番号は090・080・070から入力できます。</Text><Pressable disabled={loading || !phone.trim() || Boolean(phoneChallenge && phoneCode.length !== 6)} style={[styles.primary, (loading || !phone.trim() || Boolean(phoneChallenge && phoneCode.length !== 6)) && styles.disabled]} onPress={async()=>{try{const result=await onPhone(phone,phoneCode,phoneChallenge||undefined);if(result.challengeToken){setPhoneChallenge(result.challengeToken);setProviderNote(result.demoCode?`開発用コード：${result.demoCode}`:'SMSに認証コードを送信しました')}}catch{}}}><Text style={styles.primaryText}>{phoneChallenge?'アカウント作成・ログイン':'SMS認証コードを送る'}</Text></Pressable></View>:null}
    <Text style={styles.providerNote}>{providerNote}</Text>
  </>;
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.authPage} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
        <Text style={styles.authBrand}>
          Hangout <Text style={styles.brandAccent}>Now</Text>
        </Text>
        <View style={styles.authVisual}>
          {[DEFAULT_HANGOUT_IMAGES.FOOD, DEFAULT_HANGOUT_IMAGES.RUNNING, DEFAULT_HANGOUT_IMAGES.CAFE].map((uri, index) => (
            <View key={uri} style={[styles.authVisualCard, index === 1 && styles.authVisualCardRaised]}>
              <Image source={{ uri }} style={styles.authVisualImage} resizeMode="cover" />
            </View>
          ))}
        </View>
        {mode === "welcome" && <View style={styles.demoCard}>
          <Text style={styles.demoPill}>公開デモ・すべて架空のデータです</Text>
          <Text style={styles.demoHeading}>役割を選んですぐに体験</Text>
          <Text style={styles.demoDescription}>登録や電話番号入力は必要ありません。</Text>
          <View style={styles.demoRow}>
            <Pressable disabled={loading} style={styles.roleButton} onPress={() => onLogin("", "", "host")}>
              <Text style={styles.roleTitle}>サヤカ（主催者）として見る</Text>
              <Text style={styles.roleHint}>30代女性・飲み企画を管理</Text>
            </Pressable>
            <Pressable disabled={loading} style={[styles.roleButton, styles.roleGuest]} onPress={() => onLogin("", "", "guest")}>
              <Text style={styles.roleTitle}>マドカ（参加者）として見る</Text>
              <Text style={styles.roleHint}>30代女性・Hangoutを探す</Text>
            </Pressable>
          </View>
        </View>}
        {mode === "welcome" ? (
          <View style={styles.authChoiceCard}>
            <Text style={styles.eyebrow}>利用方法を選んでください</Text>
            <Text style={styles.authChoiceTitle}>Hangout Nowをはじめる</Text>
            <Pressable style={styles.authLoginChoice} onPress={() => changeMode("login")} accessibilityRole="button">
              <Text style={styles.authLoginChoiceText}>ログイン</Text>
              <Text style={styles.authChoiceHint}>登録済みのアカウントを使う</Text>
            </Pressable>
            <Pressable style={styles.authRegisterChoice} onPress={() => changeMode("register")} accessibilityRole="button">
              <Text style={styles.authRegisterChoiceText}>新しくアカウントを作る</Text>
              <Text style={styles.authChoiceHint}>無料で登録する</Text>
            </Pressable>
          </View>
        ) : <>
        <Pressable style={styles.authBackButton} onPress={() => changeMode("welcome")} accessibilityRole="button" accessibilityLabel="最初の画面に戻る">
          <View style={styles.backChevron} />
          <Text style={styles.authBackText}>最初の画面へ</Text>
        </Pressable>
        <View style={styles.authCard}>
          <Text style={styles.eyebrow}>今から、誰かと。</Text>
          <Text style={styles.authTitle}>{mode === "login" ? "おかえりなさい" : "アカウントを作る"}</Text>
          {mode === "register" ? <Pressable style={styles.authSwitchButton} onPress={() => changeMode("login")}>
            <Text style={styles.authSwitch}>アカウントをお持ちの方はログイン</Text>
          </Pressable> : null}
          {mode === "register" ? authDivider : null}
          {providerSection}
          {authDivider}
          <Field label="メールアドレス" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          {mode === "register" && (
            <>
              <Field label="表示名" value={displayName} onChangeText={setDisplayName} />
              <Text style={styles.label}>生年月日</Text>
              <Pressable style={styles.datePickerButton} onPress={() => setBirthDatePickerVisible(true)} accessibilityRole="button" accessibilityLabel={`生年月日 ${birthDate}`}><Text style={styles.datePickerButtonText}>{new Date(`${birthDate}T00:00:00`).toLocaleDateString("ja-JP")}</Text><Text style={styles.datePickerChevron}>›</Text></Pressable>
              <Modal visible={birthDatePickerVisible} transparent animationType="fade" onRequestClose={() => setBirthDatePickerVisible(false)}><View style={styles.datePickerModal}><Pressable style={styles.phoneSheetBackdrop} onPress={() => setBirthDatePickerVisible(false)} /><View style={styles.datePickerPanel}><Text style={styles.confirmSheetTitle}>生年月日を選択</Text><DateTimePicker value={new Date(`${birthDate}T00:00:00`)} mode="date" display={Platform.OS === "ios" ? "spinner" : "default"} maximumDate={new Date()} locale="ja-JP" onChange={(event: DateTimePickerEvent, date?: Date) => { if (event.type === "dismissed") return setBirthDatePickerVisible(false); if (date) { const year = date.getFullYear(); const month = String(date.getMonth() + 1).padStart(2, "0"); const day = String(date.getDate()).padStart(2, "0"); setBirthDate(`${year}-${month}-${day}`); if (Platform.OS !== "ios") setBirthDatePickerVisible(false); } }} /><Pressable style={styles.primary} onPress={() => setBirthDatePickerVisible(false)}><Text style={styles.primaryText}>決定</Text></Pressable></View></View></Modal>
              <Text style={styles.label}>プロフィール画像（任意・3枚まで）</Text>
              <Pressable style={styles.imagePickerButton} onPress={() => void chooseRegistrationPhotos()}><Text style={styles.imagePickerButtonText}>プロフィール画像を選ぶ</Text></Pressable>
              {!!registrationPhotos.length && <View style={styles.registrationPhotoRow}>{registrationPhotos.map((photo, index) => <Image key={`${index}-${photo.length}`} source={{ uri: photo }} style={index === 0 ? styles.registrationPhotoMain : styles.registrationPhoto} />)}</View>}
              <Text style={styles.profileEditorHint}>1枚目を中央のメイン画像、2・3枚目を左右に表示します。</Text>
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
          {authInputError ? <Text style={styles.authError}>{authInputError}</Text> : error ? <Text style={styles.authError}>{error}</Text> : null}
          <Pressable
            disabled={loading}
            style={styles.primary}
            onPress={submitEmail}
          >
            <Text style={styles.primaryText}>{loading ? "接続中…" : mode === "login" ? "ログイン" : "無料で登録"}</Text>
          </Pressable>
          {mode === "login" ? <Pressable style={styles.authSwitchButton} onPress={() => changeMode("register")}>
            <Text style={styles.authSwitch}>新しくアカウントを作る</Text>
          </Pressable> : null}
          <Text style={styles.authAgreement}>登録により利用規約とプライバシーポリシーに同意します。</Text>
          <View style={styles.authPolicyLinks}>
            <Pressable onPress={() => void Linking.openURL(`${WEBSITE_URL}/privacy.html`)}><Text style={styles.authPolicyLink}>プライバシー</Text></Pressable>
            <Pressable onPress={() => void Linking.openURL(`${WEBSITE_URL}/terms.html`)}><Text style={styles.authPolicyLink}>利用規約</Text></Pressable>
            <Pressable onPress={() => void Linking.openURL(`${WEBSITE_URL}/community-guidelines.html`)}><Text style={styles.authPolicyLink}>ガイドライン</Text></Pressable>
            <Pressable onPress={() => void Linking.openURL(`${WEBSITE_URL}/delete-account.html`)}><Text style={styles.authPolicyLink}>アカウント削除</Text></Pressable>
          </View>
        </View>
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...input } = props;
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <AppTextInput {...input} style={styles.input} placeholderTextColor="#8a918c" />
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

function HangoutTimeText({ hangout, style }: { hangout: Pick<Hangout, "status" | "startAt">; style?: object }) {
  if (hangout.status === "STARTED") return <Text style={style}>Hangout中</Text>;
  if (hangout.status === "FINISHED" || hangout.status === "CANCELLED") return <Text style={style}>{hangout.status === "FINISHED" ? "終了" : "中止"}</Text>;
  return <CountdownText startAt={hangout.startAt} style={style} />;
}

function HomeScreen({ user, hangouts, refreshing, locationLabel, locationSource, selectedArea, demoRole, onArea, onLocation, onMap, onRefresh, onOpen, onHeart, onCreate }: { user: User; hangouts: Hangout[]; refreshing: boolean; locationLabel: string; locationSource: LocationSource; selectedArea: AlphaArea; demoRole: "host" | "guest" | null; onArea: (area: AlphaArea) => void; onLocation: () => void; onMap: () => void; onRefresh: () => void; onOpen: (hangout: Hangout) => void; onHeart: (hangout: Hangout) => void; onCreate: () => void }) {
  const [filter, setFilter] = useState<"おすすめ" | "30分後" | "1時間後" | "3時間後">("おすすめ");
  const homeStateLabel = (hangout: Hangout) => hangout.hostUserId === user.id && ["OPEN", "FULL"].includes(hangout.status) ? "主催中" : stateLabel(hangout);
  const timeLabel = (startAt: string) => {
    const minutes = Math.max(0, Math.round((new Date(startAt).getTime() - Date.now()) / 60000));
    return minutes <= 45 ? "30分後" : minutes <= 90 ? "1時間後" : "3時間後";
  };
  const visibleHangouts = filter === "おすすめ" ? hangouts : hangouts.filter((hangout) => timeLabel(hangout.startAt) === filter);
  const conditionLabel = (hangout: Hangout) => `${hangout.genderRestriction === "MALE_ONLY" ? "男性のみ" : hangout.genderRestriction === "FEMALE_ONLY" ? "女性のみ" : "だれでも"}${hangout.maxAge ? `・${hangout.maxAge === 29 ? "20代" : hangout.maxAge === 39 ? "30代" : "50代"}まで` : ""}`;
  const chooseHomeArea = () => Alert.alert("エリアを選択", undefined, [
    { text: "新宿", onPress: () => onArea("新宿") },
    { text: "渋谷", onPress: () => onArea("渋谷") },
    { text: "キャンセル", style: "cancel" },
  ]);
  return (
    <ScrollView refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      {demoRole && <View style={styles.demoJourney}><Text style={styles.demoJourneyTitle}>デモ：サヤカの飲み企画</Text><Text style={styles.demoJourneyText}>1. 主催者は30代女性のサヤカ{`\n`}2. 20代男性のマサヤは承認済み{`\n`}3. 30代女性のマドカはHangoutを検索中{`\n`}4. マドカが途中参加を申請{`\n`}5. 承認後はグループトークで会話</Text><Text style={styles.demoJourneyHint}>「サヤカと新宿で気軽に飲もう」を開いて試せます。</Text></View>}
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{locationLabel}</Text>
        <Text style={styles.heroTitle}>今から何する？</Text>
        <Pressable style={styles.createButton} onPress={onCreate}>
          <Text style={styles.primaryText}>Hangoutを作る</Text>
        </Pressable>
        <View style={styles.homeActions}>
          <Pressable style={styles.locationButton} onPress={onLocation}>
            <Text style={styles.locationText}>現在地を使う</Text>
          </Pressable>
          <Pressable style={styles.homeAreaPicker} onPress={chooseHomeArea} accessibilityRole="button" accessibilityLabel="エリアを選択">
            <Text style={styles.homeAreaChoiceText}>{locationSource === "manual" ? selectedArea : "エリアを選択"}</Text><Text style={styles.homeAreaChevron}>⌄</Text>
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {(["おすすめ", "30分後", "1時間後", "3時間後"] as const).map((value) => <Pressable key={value} style={[styles.filterPill, filter === value && styles.filterPillOn]} onPress={() => setFilter(value)}><Text style={[styles.filterPillText, filter === value && styles.filterPillTextOn]}>{value}</Text></Pressable>)}
      </ScrollView>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionTitle}>近くのHangout</Text>
        <View style={styles.sectionHeadActions}><Text style={styles.muted}>{visibleHangouts.length}件・距離順</Text><Pressable style={styles.homeMapButton} onPress={onMap} accessibilityRole="button" accessibilityLabel="近くのHangoutをマップで表示"><View style={styles.homeMapPin}><View style={styles.homeMapPinCenter} /></View></Pressable></View>
      </View>
      {visibleHangouts.map((hangout) => (
        <Pressable key={hangout.id} style={styles.card} onPress={() => onOpen(hangout)}>
          <Image source={{ uri: hangoutImageUrl(hangout) }} style={styles.activityPhoto} resizeMode="cover" />
          <Pressable style={[styles.heartButton, hangout.hearted && styles.heartButtonOn]} onPress={(event) => { event.stopPropagation(); onHeart(hangout); }} accessibilityRole="button" accessibilityLabel={hangout.hearted ? "ハートを取り消す" : "ハートを送る"}>
            <Text style={[styles.heartIcon, hangout.hearted && styles.heartIconOn]}>{hangout.hearted ? "♥" : "♡"}</Text>
            <Text style={[styles.heartCount, hangout.hearted && styles.heartIconOn]}>{hangout.heartCount}</Text>
          </Pressable>
          <Text style={styles.status}>{homeStateLabel(hangout)}</Text>
          <View style={styles.cardTop}>
            <View style={styles.cardCopy}>
              <Text style={styles.cardCategory}>{categoryLabel(hangout.category)}</Text>
              <Text style={styles.cardTitle}>{hangout.title}</Text>
              <View style={styles.cardMetaRow}><HangoutTimeText hangout={hangout} style={Math.max(0, new Date(hangout.startAt).getTime() - Date.now()) <= 45 * 60 * 1000 ? styles.hotCountdown : styles.muted} />{hangout.distanceKm != null && <Text style={styles.muted}>・ 約{hangout.distanceKm}km</Text>}</View>
              <Text style={styles.muted}>{hangout.publicLocationName || hangout.locationName}</Text>
              <Text style={styles.muted}>
                参加 {hangout.participantCount} / {hangout.maxParticipants}人 ・ {conditionLabel(hangout)}{hangout.distanceKm != null && hangout.distanceKm > 10 ? <Text style={styles.farBadge}> ・遠め</Text> : null}
              </Text>
            </View>
          </View>
          <View style={styles.cardBottom}>
            <View style={styles.cardHostRow}>
              {hangout.host.profilePhoto ? <Image source={{ uri: hangout.host.profilePhoto }} style={styles.cardHostPhoto} /> : <View style={styles.cardHostFallback}><Text style={styles.cardHostInitial}>{hangout.host.displayName.slice(0,1)}</Text></View>}
              <View>
                <Text style={styles.hostName}>{hangout.host.displayName}{hangout.host.verification === "PHONE_VERIFIED" ? " ・確認済み" : ""}</Text>
                <Text style={styles.hostTier}>{hangout.host.hostStatus?.label || "ホワイト"}{hangout.host.hostStatus?.hostAverageRating ? ` ・ 主催評価 ★ ${hangout.host.hostStatus.hostAverageRating}` : " ・ 主催評価なし"}</Text>
              </View>
            </View>
            <View style={styles.cardMatchWrap}><Text style={styles.cardMatchScore}>相性 {Math.round(hangout.matchScore ?? 70)}%</Text></View>
          </View>
        </Pressable>
      ))}
      {!visibleHangouts.length && <Text style={styles.empty}>この時間の募集はまだありません。{`\n`}エリアを変更して探してみてください。</Text>}
    </ScrollView>
  );
}

function MapScreen({ hangouts, coordinates, onBack, onOpen }: { hangouts: Hangout[]; coordinates: { latitude: number; longitude: number }; onBack: () => void; onOpen: (hangout: Hangout) => void }) {
  const mappedHangouts = hangouts.slice(0, 8);
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}&z=13&output=embed`;
  return (
    <ScrollView contentContainerStyle={styles.mapPage}>
      <View style={styles.mapHeading}>
        <Pressable style={styles.mapBackButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Hangout一覧に戻る">
          <View style={styles.backChevron} />
        </Pressable>
        <View>
          <Text style={styles.eyebrow}>Googleマップ・概略位置</Text>
          <Text style={styles.mapPageTitle}>近くのHangout</Text>
        </View>
      </View>
      <View style={styles.googleMapFrame}>
        <WebView source={{ uri: mapUrl }} originWhitelist={["https://*"]} style={styles.googleMap} accessibilityLabel="Googleマップ" />
      </View>
      <View style={styles.mapResultHeading}>
        <Text style={styles.mapResultHeadingTitle}>このマップのHangout</Text>
        <Text style={styles.mapResultHeadingCount}>{mappedHangouts.length}件</Text>
      </View>
      {mappedHangouts.map((hangout) => (
        <Pressable key={hangout.id} style={styles.mapResultCard} onPress={() => onOpen(hangout)}>
          <Image source={{ uri: hangoutImageUrl(hangout) }} style={styles.mapResultImage} resizeMode="cover" />
          <View style={styles.mapResultCopy}>
            <Text style={styles.mapResultTitle} numberOfLines={1}>{hangout.title}</Text>
            <Text style={styles.mapResultLocation} numberOfLines={1}>{hangout.publicLocationName || "概略エリア"}</Text>
          </View>
          <View style={styles.mapResultMeta}>
            {hangout.distanceKm != null && <Text style={styles.mapResultTime}>{hangout.distanceKm}km ・</Text>}
            <HangoutTimeText hangout={hangout} style={styles.mapResultTime} />
            <Text style={styles.mapResultChevron}>›</Text>
          </View>
        </Pressable>
      ))}
      {!mappedHangouts.length && <Text style={styles.empty}>このエリアのHangoutはまだありません。</Text>}
      <Text style={styles.mapPrivacy}>Googleマップを表示しています。承認前は概略エリア、承認後だけ正確な集合地点をナビへ渡します。</Text>
    </ScrollView>
  );
}

type CreateField = "title" | "publicLocationName" | "meetingPlaceName" | "meetingAddress" | "maxParticipants";

function CreateHangoutScreen({ area, onBack, onSubmit }: { area: AlphaArea; onBack: () => void; onSubmit: (input: CreateHangoutInput) => void }) {
  const [form, setForm] = useState<CreateHangoutInput>({
    title: "",
    description: "",
    category: "CAFE",
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
  const chooseHangoutImage = async (source: "library" | "camera") => {
    const permission = source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("写真へのアクセスが必要です", source === "camera" ? "撮影するため、カメラへのアクセスを許可してください。" : "Hangoutの画像を選ぶため、写真ライブラリへのアクセスを許可してください。");
      return;
    }
    const pickerOptions: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.72,
      base64: true,
    };
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);
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
    <View style={styles.createPage}>
      <View style={styles.createHeader}>
        <Pressable style={styles.createBackButton} hitSlop={8} onPress={onBack} accessibilityRole="button" accessibilityLabel="ホームに戻る"><View style={styles.backChevron} /></Pressable>
        <View style={styles.createHeaderHeading}><Text style={styles.createHeaderEyebrow}>新しい募集</Text><Text style={styles.createHeaderTitle}>Hangoutを作る</Text></View>
        <View style={styles.createHeaderSpacer} />
      </View>
      <ScrollView style={styles.createScroll} contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      {Object.keys(errors).length > 0 && <Text style={styles.validationMessage}>入力内容を確認してください。赤枠の項目を設定すると公開できます。</Text>}
      <Text style={styles.label}>Hangoutのイメージ写真</Text>
      <Pressable style={styles.imagePickerButton} onPress={() => Alert.alert("画像を追加", "追加方法を選んでください。", [
        { text: "写真ライブラリから選ぶ", onPress: () => void chooseHangoutImage("library") },
        { text: "カメラで撮影", onPress: () => void chooseHangoutImage("camera") },
        { text: "キャンセル", style: "cancel" },
      ])}>
        <Text style={styles.imagePickerButtonText}>{form.imageUrl ? "写真を変更" : "スマホの写真・カメラから追加"}</Text>
      </Pressable>
      <Text style={styles.privacyText}>写真ライブラリまたはカメラから選べます。</Text>
      {form.imageUrl ? <Image source={{ uri: form.imageUrl }} style={styles.createImagePreview} resizeMode="cover" /> : null}
      <Text style={styles.label}>Hangout Nowの画像を使う</Text>
      <Text style={styles.privacyText}>企画に近い画像を選んでください</Text>
      <View style={styles.providedImageGrid}>
        {HANGOUT_IMAGE_PRESETS.map((preset) => (
          <Pressable key={preset.label} style={[styles.providedImageChoice, form.imageUrl === preset.uri && styles.providedImageChoiceOn]} onPress={() => {
            setForm((current) => ({ ...current, imageUrl: preset.uri, category: preset.category, title: preset.title, description: preset.description }));
            setErrors((current) => ({ ...current, title: undefined }));
          }}>
            <Image source={{ uri: preset.uri }} style={styles.providedImagePhoto} />
            <Text style={styles.providedImageLabel}>{preset.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>何する？</Text>
      <AppTextInput style={[styles.input, errors.title && styles.invalidInput]} value={form.title} onChangeText={(title) => update("title", title)} placeholder="例：30分後にラーメン" maxLength={80} />
      {errors.title && <Text style={styles.fieldError}>{errors.title}</Text>}
      <Text style={styles.label}>いつ？</Text>
      <View style={styles.choiceRow}>
        {([30, 60, 180] as const).map((minutes) => (
          <Pressable key={minutes} style={[styles.choice, form.startInMinutes === minutes && styles.choiceOn]} onPress={() => setForm((v) => ({ ...v, startInMinutes: minutes }))}>
            <Text style={styles.choiceText}>{minutes === 30 ? "⚡ 30分後" : minutes === 60 ? "🔥 1時間後" : "🕒 3時間後"}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>公開エリア（新宿・渋谷のみ）</Text>
      <View style={styles.createAreaGrid}>
        {(["新宿", "渋谷"] as const).map((item) => (
          <Pressable key={item} style={[styles.createAreaChoice, form.area === item && styles.createAreaChoiceOn]} onPress={() => setForm((v) => ({ ...v, area: item, publicLocationName: `${item}駅周辺` }))}>
            <Text style={[styles.createAreaChoiceText, form.area === item && styles.createAreaChoiceTextOn]}>{item}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>承認前に表示するエリア</Text>
      <AppTextInput style={[styles.input, errors.publicLocationName && styles.invalidInput]} value={form.publicLocationName} onChangeText={(value) => update("publicLocationName", value)} maxLength={100} />
      {errors.publicLocationName && <Text style={styles.fieldError}>{errors.publicLocationName}</Text>}
      <View style={styles.privatePlaceBox}>
        <Text style={styles.privatePlaceTitle}>承認後に表示する集合場所</Text>
        <Text style={styles.privacyText}>店名・住所・ナビ情報は承認したメンバーだけに表示します。</Text>
        <Text style={styles.label}>店名</Text>
        <AppTextInput style={[styles.input, errors.meetingPlaceName && styles.invalidInput]} value={form.meetingPlaceName} onChangeText={(value) => update("meetingPlaceName", value)} maxLength={100} />
        {errors.meetingPlaceName && <Text style={styles.fieldError}>{errors.meetingPlaceName}</Text>}
        <Text style={styles.label}>住所</Text>
        <AppTextInput style={[styles.input, errors.meetingAddress && styles.invalidInput]} value={form.meetingAddress} onChangeText={(value) => update("meetingAddress", value)} maxLength={200} />
        {errors.meetingAddress && <Text style={styles.fieldError}>{errors.meetingAddress}</Text>}
        <Text style={styles.label}>ナビアプリの共有URL（任意）</Text>
        <AppTextInput style={styles.input} value={form.navigationUrl} onChangeText={(value) => update("navigationUrl", value)} autoCapitalize="none" keyboardType="url" maxLength={500} placeholder="Googleマップなどの共有URLを貼り付け" />
        <View style={styles.createMapActions}>
          <Pressable style={styles.createMapAction} onPress={() => void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.meetingPlaceName} ${form.meetingAddress}`.trim() || form.publicLocationName)}`)}><Text style={styles.createMapActionText}>Googleマップで場所を検索</Text></Pressable>
          <Pressable style={styles.createMapAction} onPress={() => update("navigationUrl", `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${form.meetingPlaceName} ${form.meetingAddress}`.trim() || form.publicLocationName)}`)}><Text style={styles.createMapActionText}>店名・住所からナビを設定</Text></Pressable>
        </View>
        <Text style={styles.createMapHelp}>ナビアプリで店名を検索し、共有URLを貼り付けるだけで設定できます。</Text>
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
      <AppTextInput style={[styles.input, styles.multiline]} value={form.description} onChangeText={(description) => setForm((v) => ({ ...v, description }))} multiline maxLength={500} />
      </ScrollView>
      <View style={styles.createFooter}>
        <Pressable style={styles.createCancelButton} onPress={onBack}><Text style={styles.createCancelText}>キャンセル</Text></Pressable>
        <Pressable style={styles.createPublishButton} onPress={publish}><Text style={styles.primaryText}>Hangout公開</Text></Pressable>
      </View>
    </View>
  );
}

function HangoutDetailScreen({ user, hangout, requests, decidingRequest, ratingMembers, onBack, onJoin, onChat, onRateMember, onStart, onFinish, onCancel, onEdit, onDecide, onReport, onAttendance, onMatchFeedback }: { user: User; hangout: Hangout; requests: JoinRequest[]; decidingRequest: { id: string; accept: boolean } | null; ratingMembers: ChatMember[]; onBack: () => void; onJoin: (hangout: Hangout, message: string) => Promise<void>; onChat: (id: string) => void; onRateMember: (hangoutId: string, ratedUserId: string, score: number) => void; onStart: (id: string) => void; onFinish: (id: string) => void; onCancel: (id: string) => void; onEdit: (hangoutId: string, input: Partial<CreateHangoutInput>) => Promise<void>; onDecide: (id: string, accept: boolean) => void; onReport: (hangout: Hangout) => void; onAttendance: (status: "CONFIRMED" | "CANCELLED") => void; onMatchFeedback: (hangout: Hangout) => void }) {
  const isHost = hangout.hostUserId === user.id;
  const ineligibleReason = eligibilityReason(user, hangout);
  const [selectedApplicant, setSelectedApplicant] = useState<ApplicantProfile | null>(null);
  const [selectedApplicantTitle, setSelectedApplicantTitle] = useState<"申請者プロフィール" | "参加メンバープロフィール">("申請者プロフィール");
  const [joining, setJoining] = useState(false);
  const [editing, setEditing] = useState(false);
  const [hostPhotoIndex, setHostPhotoIndex] = useState<number | null>(null);
  const hostPhotos = (hangout.host.profilePhotos?.length ? hangout.host.profilePhotos : hangout.host.profilePhoto ? [hangout.host.profilePhoto] : []).filter(Boolean);
  const hasActiveRequest = ["PENDING", "WAITLISTED", "ACCEPTED"].includes(hangout.myJoinStatus ?? "");
  if (!isHost) return (
    <View style={styles.participantDetailPage}>
      <View style={styles.detailHeader}>
        <Pressable style={styles.detailBackButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Hangout一覧に戻る"><View style={styles.backChevron} /></Pressable>
        <Text style={styles.detailHeaderTitle}>Hangout</Text><View style={styles.detailHeaderSpacer} />
      </View>
      <ScrollView style={styles.detailScroll} contentContainerStyle={styles.participantDetailContent}>
        <View style={styles.participantHeroWrap}>
          <Image source={{ uri: hangoutImageUrl(hangout) }} style={styles.participantHeroPhoto} resizeMode="cover" />
          <Text style={styles.participantState}>{stateLabel(hangout)}</Text>
        </View>
        <View style={styles.participantDetailBody}>
          <View style={styles.participantHostRow}>
            <Pressable disabled={!hostPhotos.length} onPress={() => setHostPhotoIndex(0)} accessibilityLabel={`${hangout.host.displayName}のプロフィール画像を見る`}>
              {hangout.host.profilePhoto ? <Image source={{ uri: hangout.host.profilePhoto }} style={styles.detailHostPhoto} /> : <View style={styles.detailHostPhotoFallback}><Text style={styles.approvedMemberInitial}>{hangout.host.displayName.slice(0, 1)}</Text></View>}
            </Pressable>
            <View style={styles.cardCopy}><Text style={styles.participantHostName}>{hangout.host.displayName}</Text><Text style={styles.participantHostMeta}>{hangout.host.hostStatus?.hostAverageRating ? `主催評価 ★ ${hangout.host.hostStatus.hostAverageRating}` : "主催評価なし"}{hangout.host.verification === "PHONE_VERIFIED" ? " ・ 電話確認済み" : " ・ 本人確認前"}</Text></View>
          </View>
          <View style={styles.participantTimeRow}><HangoutTimeText hangout={hangout} style={styles.participantTime} /><Text style={styles.participantTime}> ・ 相性 {Math.round(hangout.matchScore ?? 70)}%</Text></View>
          <Text style={styles.participantTitle}>{hangout.title}</Text>
          {!!hangout.description && <Text style={styles.participantDescription}>{hangout.description}</Text>}
          {hangout.myJoinStatus === "ACCEPTED" && <Pressable style={styles.participantTalkButton} onPress={() => onChat(hangout.id)}><Text style={styles.participantTalkButtonText}>トーク</Text></Pressable>}
          <View style={styles.participantConditionPanel}><Text style={styles.participantPanelLabel}>参加条件</Text><Text style={styles.participantConditionText}>{hangout.genderRestriction === "MALE_ONLY" ? "男性のみ" : hangout.genderRestriction === "FEMALE_ONLY" ? "女性のみ" : "だれでも"}{hangout.maxAge ? `・${hangout.maxAge === 29 ? "20代" : hangout.maxAge === 39 ? "30代" : "50代"}まで` : ""}</Text></View>
          <View style={styles.participantInfoPanel}>
            <Text style={styles.participantInfoText}><Text style={styles.participantInfoLabel}>集合場所　</Text>{hangout.locationName}{hangout.distanceKm != null ? `（約${hangout.distanceKm}km）` : ""}</Text>
            <Text style={styles.participantInfoText}><Text style={styles.participantInfoLabel}>参加人数　</Text>{hangout.participantCount} / {hangout.maxParticipants}人</Text>
            <Text style={styles.participantInfoText}><Text style={styles.participantInfoLabel}>主催者　</Text>{hangout.host.displayName}　{hangout.host.hostStatus?.hostAverageRating ? `主催評価 ★ ${hangout.host.hostStatus.hostAverageRating}` : "主催評価なし"}</Text>
            <Text style={styles.participantPrivacyText}>{hangout.myJoinStatus === "ACCEPTED" ? "承認済み：店名・住所・正確な位置を表示" : "承認前：概略エリアのみ表示"}</Text>
          </View>
          {hangout.myJoinStatus === "ACCEPTED" && hangout.navigationUrl && <Pressable style={styles.participantNavigationButton} onPress={() => void Linking.openURL(hangout.navigationUrl!)}><Text style={styles.participantNavigationText}>地図アプリでナビ開始</Text></Pressable>}
          {hangout.distanceKm != null && hangout.distanceKm > 10 && <Text style={styles.distanceWarning}>移動距離が長めです。開始時刻に間に合うか確認してください。</Text>}
          {hangout.status === "FINISHED" && hangout.myJoinStatus === "ACCEPTED" && <InlineHangoutRatings userId={user.id} hostUserId={hangout.hostUserId} hangoutId={hangout.id} members={ratingMembers} onRate={onRateMember} onDone={onBack} />}
          {hangout.status !== "FINISHED" && hangout.myJoinStatus === "ACCEPTED" && <View style={styles.participantAttendancePanel}><Text style={styles.hostName}>{hangout.myAttendanceStatus === "CONFIRMED" ? "参加予定として回答済み" : "開始前の出欠確認"}</Text><Text style={styles.muted}>予定が変わった場合は早めにお知らせください。</Text><View style={styles.requestActions}><Pressable style={styles.rejectButton} onPress={() => onAttendance("CANCELLED")}><Text>キャンセル</Text></Pressable><Pressable style={styles.acceptButton} onPress={() => onAttendance("CONFIRMED")}><Text style={styles.primaryText}>参加する</Text></Pressable></View></View>}
          {hangout.myJoinStatus === "WAITLISTED" && <View style={styles.participantAttendancePanel}><Text style={styles.hostName}>待機リストに登録済み</Text><Text style={styles.muted}>空席が出たら通知します。集合場所の詳細は承認後に表示されます。</Text></View>}
          {hangout.myJoinStatus === "ACCEPTED" && <View style={styles.participantMembersPanel}><Text style={styles.sectionTitle}>参加メンバー</Text><Text style={styles.muted}>主催者 1人</Text>{(hangout.acceptedParticipants ?? []).map((member) => <Pressable key={member.id} style={styles.approvedMemberRow} onPress={() => { setSelectedApplicantTitle("参加メンバープロフィール"); setSelectedApplicant(member); }} accessibilityRole="button" accessibilityLabel={`${member.displayName}のプロフィールを見る`}>{member.profilePhoto ? <Image source={{ uri: member.profilePhoto }} style={styles.approvedMemberPhoto} /> : <View style={styles.approvedMemberPhotoFallback}><Text style={styles.approvedMemberInitial}>{member.displayName.slice(0, 1)}</Text></View>}<View style={styles.cardCopy}><Text style={styles.hostName}>{member.displayName}</Text><Text style={styles.muted}>{member.gender === "MALE" ? "男性" : member.gender === "FEMALE" ? "女性" : "性別非公開"} ・ {member.verification === "PHONE_VERIFIED" ? "電話確認済み" : "本人確認前"}</Text></View><Text style={styles.profileActivityChevron}>›</Text></Pressable>)}{!hangout.acceptedParticipants?.length && <Text style={styles.empty}>承認済みの参加者はまだいません。</Text>}</View>}
          {!hasActiveRequest && user.matchingDataConsent && <View style={styles.matchFeedbackPanel}><Text style={styles.muted}>この募集が合わない場合</Text><Pressable style={styles.matchFeedbackButton} onPress={() => onMatchFeedback(hangout)}><Text style={styles.matchFeedbackButtonText}>合わない理由を送る</Text></Pressable></View>}
          <Pressable style={styles.reportButton} onPress={() => onReport(hangout)}><Text style={styles.reportText}>この募集の主催者を通報・ブロック</Text></Pressable>
        </View>
      </ScrollView>
      {hangout.status !== "FINISHED" && hangout.myJoinStatus !== "ACCEPTED" && <View style={styles.participantDetailFooter}>
        {!!ineligibleReason && !hasActiveRequest && <Text style={styles.eligibilityNote}>{ineligibleReason}</Text>}
        <Pressable disabled={hasActiveRequest || !!ineligibleReason || !["OPEN", "FULL", "STARTED"].includes(hangout.status)} style={[styles.participantJoinButton, (hasActiveRequest || !!ineligibleReason || !["OPEN", "FULL", "STARTED"].includes(hangout.status)) && styles.disabledButton]} onPress={() => setJoining(true)}><Text style={styles.primaryText}>{hangout.myJoinStatus === "PENDING" ? "申請中" : hangout.myJoinStatus === "WAITLISTED" ? "待機中" : ineligibleReason ? "参加条件の対象外" : "参加したい"}</Text></Pressable>
      </View>}
      <ApplicantProfileModal profile={selectedApplicant} title={selectedApplicantTitle} onClose={() => setSelectedApplicant(null)} />
      <JoinRequestModal visible={joining} hangout={hangout} onClose={() => setJoining(false)} onSubmit={async (message) => { await onJoin(hangout, message); setJoining(false); }} />
      <PhotoViewerModal photos={hostPhotos} index={hostPhotoIndex} onIndex={setHostPhotoIndex} onClose={() => setHostPhotoIndex(null)} />
    </View>
  );
  if (isHost) return (
    <View style={styles.participantDetailPage}>
      <View style={styles.detailHeader}>
        <Pressable style={styles.detailBackButton} onPress={onBack} accessibilityRole="button" accessibilityLabel="Hangout一覧に戻る"><View style={styles.backChevron} /></Pressable>
        <Text style={styles.detailHeaderTitle}>Hangout</Text><View style={styles.detailHeaderSpacer} />
      </View>
      <ScrollView style={styles.detailScroll} contentContainerStyle={styles.participantDetailContent}>
        <View style={styles.participantHeroWrap}><Image source={{ uri: hangoutImageUrl(hangout) }} style={styles.participantHeroPhoto} resizeMode="cover" /><Text style={styles.participantState}>{stateLabel(hangout)}</Text></View>
        <View style={styles.participantDetailBody}>
          <View style={styles.participantHostRow}>
            <Pressable disabled={!hostPhotos.length} onPress={() => setHostPhotoIndex(0)} accessibilityLabel="主催者プロフィール画像を見る">{hangout.host.profilePhoto ? <Image source={{ uri: hangout.host.profilePhoto }} style={styles.detailHostPhoto} /> : <View style={styles.detailHostPhotoFallback}><Text style={styles.approvedMemberInitial}>{hangout.host.displayName.slice(0, 1)}</Text></View>}</Pressable>
            <View style={styles.cardCopy}><Text style={styles.participantHostName}>{hangout.host.displayName}</Text><Text style={styles.participantHostMeta}>{hangout.host.hostStatus?.hostAverageRating ? `主催評価 ★ ${hangout.host.hostStatus.hostAverageRating}` : "主催評価なし"}{hangout.host.verification === "PHONE_VERIFIED" ? " ・ 電話確認済み" : " ・ 本人確認前"}</Text></View>
          </View>
          <View style={styles.participantTimeRow}><HangoutTimeText hangout={hangout} style={styles.participantTime} /><Text style={styles.participantTime}> ・ 相性 {Math.round(hangout.matchScore ?? 70)}%</Text></View>
          <Text style={styles.participantTitle}>{hangout.title}</Text>
          {!!hangout.description && <Text style={styles.participantDescription}>{hangout.description}</Text>}
          <Pressable style={styles.participantTalkButton} onPress={() => onChat(hangout.id)}><Text style={styles.participantTalkButtonText}>トーク</Text></Pressable>
          <View style={styles.participantConditionPanel}><Text style={styles.participantPanelLabel}>参加条件</Text><Text style={styles.participantConditionText}>{hangout.genderRestriction === "MALE_ONLY" ? "男性のみ" : hangout.genderRestriction === "FEMALE_ONLY" ? "女性のみ" : "だれでも"}{hangout.maxAge ? `・${hangout.maxAge === 29 ? "20代" : hangout.maxAge === 39 ? "30代" : "50代"}まで` : ""}</Text></View>
          <View style={styles.participantInfoPanel}>
            <Text style={styles.participantInfoText}><Text style={styles.participantInfoLabel}>集合場所　</Text>{hangout.locationName}{hangout.distanceKm != null ? `（約${hangout.distanceKm}km）` : ""}</Text>
            {!!hangout.meetingPlaceName && <Text style={styles.participantInfoText}><Text style={styles.participantInfoLabel}>店名　</Text>{hangout.meetingPlaceName}</Text>}
            {!!hangout.meetingAddress && <Text style={styles.participantInfoText}><Text style={styles.participantInfoLabel}>住所　</Text>{hangout.meetingAddress}</Text>}
            <Text style={styles.participantInfoText}><Text style={styles.participantInfoLabel}>参加人数　</Text>{hangout.participantCount} / {hangout.maxParticipants}人</Text>
            <Text style={styles.participantPrivacyText}>主催者：店名・住所・正確な位置を表示</Text>
          </View>
          {!!hangout.navigationUrl && <Pressable style={styles.participantNavigationButton} onPress={() => void Linking.openURL(hangout.navigationUrl!)}><Text style={styles.participantNavigationText}>地図アプリでナビ開始</Text></Pressable>}
          <View style={styles.participantMembersPanel}><Text style={styles.sectionTitle}>参加メンバー</Text><Text style={styles.muted}>主催者 1人</Text>{(hangout.acceptedParticipants ?? []).map((member) => <Pressable key={member.id} style={styles.approvedMemberRow} onPress={() => { setSelectedApplicantTitle("参加メンバープロフィール"); setSelectedApplicant(member); }} accessibilityLabel={`${member.displayName}のプロフィールを見る`}>{member.profilePhoto ? <Image source={{ uri: member.profilePhoto }} style={styles.approvedMemberPhoto} /> : <View style={styles.approvedMemberPhotoFallback}><Text style={styles.approvedMemberInitial}>{member.displayName.slice(0, 1)}</Text></View>}<View style={styles.cardCopy}><Text style={styles.hostName}>{member.displayName}</Text><Text style={styles.muted}>{member.gender === "MALE" ? "男性" : member.gender === "FEMALE" ? "女性" : "性別非公開"} ・ {member.verification === "PHONE_VERIFIED" ? "電話確認済み" : "本人確認前"}</Text></View><Text style={styles.profileActivityChevron}>›</Text></Pressable>)}{!hangout.acceptedParticipants?.length && <Text style={styles.empty}>承認済みの参加者はまだいません。</Text>}</View>
          {hangout.status === "FINISHED" && <InlineHangoutRatings userId={user.id} hostUserId={hangout.hostUserId} hangoutId={hangout.id} members={ratingMembers} onRate={onRateMember} onDone={onBack} />}
          <View style={styles.hostRequestPanel}><View style={styles.hostRequestHeader}><View><Text style={styles.participantPanelLabel}>参加申請</Text><Text style={styles.hostRequestTitle}>参加したいメンバー</Text></View><Text style={styles.hostRequestBadge}>{requests.filter((item) => item.status === "PENDING").length}件の判断待ち</Text></View>{requests.map((item) => { const deciding = decidingRequest?.id === item.id; return <View key={item.id} style={styles.hostRequestCard}><Pressable style={styles.hostRequestPerson} onPress={() => { setSelectedApplicantTitle("申請者プロフィール"); setSelectedApplicant(item.user); }}>{item.user.profilePhoto ? <Image source={{ uri: item.user.profilePhoto }} style={styles.approvedMemberPhoto} /> : <View style={styles.approvedMemberPhotoFallback}><Text style={styles.approvedMemberInitial}>{item.user.displayName.slice(0, 1)}</Text></View>}<View style={styles.cardCopy}><Text style={styles.hostName}>{item.user.displayName}</Text><Text style={styles.muted}>{item.user.verification === "PHONE_VERIFIED" ? "✓ 電話確認済み" : "本人確認前"}</Text></View><Text style={styles.profileActivityChevron}>›</Text></Pressable><Text style={styles.hostRequestMessage}>{item.message || "メッセージなし"}</Text>{item.status === "PENDING" && hangout.status !== "FINISHED" ? <View style={styles.requestActions}><Pressable disabled={decidingRequest !== null} style={[styles.rejectButton, decidingRequest !== null && styles.disabledButton]} onPress={() => onDecide(item.id, false)}><Text>{deciding && !decidingRequest.accept ? "却下中…" : "却下"}</Text></Pressable><Pressable disabled={decidingRequest !== null} style={[styles.acceptButton, decidingRequest !== null && styles.disabledButton]} onPress={() => onDecide(item.id, true)}><Text style={styles.primaryText}>{deciding && decidingRequest.accept ? "承認中…" : "承認"}</Text></Pressable></View> : <Text style={styles.requestResult}>{item.status === "ACCEPTED" ? "承認済み" : item.status === "WAITLISTED" ? "待機中" : item.status === "REJECTED" ? "却下済み" : "キャンセル"}</Text>}</View>; })}{!requests.length && <Text style={styles.empty}>参加申請はまだありません。</Text>}</View>
          <View style={styles.hostOwnerActions}>
            {hangout.status !== "FINISHED" && <Pressable style={styles.editHangoutButton} onPress={() => setEditing(true)}><Text style={styles.editHangoutButtonText}>Hangout編集</Text></Pressable>}
            <Pressable style={styles.cancelHangoutButton} onPress={() => onCancel(hangout.id)}><Text style={styles.cancelHangoutButtonText}>Hangout削除</Text></Pressable>
            {["OPEN", "FULL"].includes(hangout.status) && <><Pressable disabled={!hangout.acceptedParticipants?.length} style={[styles.hostStartButton, !hangout.acceptedParticipants?.length && styles.disabledButton]} onPress={() => onStart(hangout.id)}><Text style={styles.primaryText}>Hangout開始</Text></Pressable>{!hangout.acceptedParticipants?.length && <Text style={styles.startDisabledNote}>参加メンバーを承認すると開始できます。</Text>}</>}
            {hangout.status === "STARTED" && <Pressable style={styles.hostFinishButton} onPress={() => onFinish(hangout.id)}><Text style={styles.hostFinishButtonText}>Hangout終了</Text></Pressable>}
          </View>
        </View>
      </ScrollView>
      <ApplicantProfileModal profile={selectedApplicant} title={selectedApplicantTitle} onClose={() => setSelectedApplicant(null)} />
      <EditHangoutModal visible={editing} hangout={hangout} onClose={() => setEditing(false)} onSave={async (input) => { await onEdit(hangout.id, input); setEditing(false); }} />
      <PhotoViewerModal photos={hostPhotos} index={hostPhotoIndex} onIndex={setHostPhotoIndex} onClose={() => setHostPhotoIndex(null)} />
    </View>
  );
}

function JoinRequestModal({ visible, hangout, onClose, onSubmit }: { visible: boolean; hangout: Hangout; onClose: () => void; onSubmit: (message: string) => Promise<void> }) {
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  useEffect(() => { if (visible) { setMessage(""); setSubmitting(false); } }, [visible, hangout.id]);
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modalPage}>
        <KeyboardAvoidingView style={styles.modalKeyboardAvoider} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.formPage} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Pressable onPress={onClose}><Text style={styles.backText}>‹ Hangoutに戻る</Text></Pressable>
          <Text style={styles.eyebrow}>参加申請</Text>
          <Text style={styles.pageTitle}>ひとこと添えて申請</Text>
          <Text style={styles.safetyNote}>{hangout.host.displayName}さんが参加可否を判断します。参加したい理由や当日の雰囲気が伝わるメッセージを書いてください。</Text>
          <Text style={styles.label}>主催者へのメッセージ</Text>
          <AppTextInput style={[styles.input, styles.multiline]} value={message} onChangeText={setMessage} multiline maxLength={200} placeholder="例：カフェ巡りが好きです。初参加ですが、よろしくお願いします！" />
          <Text style={styles.characterCount}>{message.trim().length} / 200文字</Text>
          <Pressable disabled={!message.trim() || submitting} style={[styles.primary, (!message.trim() || submitting) && styles.disabledButton]} onPress={() => { setSubmitting(true); void onSubmit(message.trim()).finally(() => setSubmitting(false)); }}>
            <Text style={styles.primaryText}>{submitting ? "申請中…" : "この内容で参加申請する"}</Text>
          </Pressable>
        </ScrollView>
        </KeyboardAvoidingView>
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
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setTitle(hangout.title); setDescription(hangout.description ?? ""); setPublicLocationName(hangout.publicLocationName ?? "");
    setMeetingPlaceName(hangout.meetingPlaceName ?? ""); setMeetingAddress(hangout.meetingAddress ?? ""); setNavigationUrl(hangout.navigationUrl ?? "");
    setGenderRestriction(hangout.genderRestriction); setMaxAge(hangout.maxAge); setImageUrl(hangout.imageUrl ?? undefined);
    setSaving(false);
  }, [visible, hangout.id, hangout.title, hangout.description, hangout.publicLocationName, hangout.meetingPlaceName, hangout.meetingAddress, hangout.navigationUrl, hangout.genderRestriction, hangout.maxAge, hangout.imageUrl]);
  const chooseImage = async (source: "camera" | "library") => {
    const permission = source === "camera" ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert(source === "camera" ? "カメラへのアクセスが必要です" : "写真へのアクセスが必要です");
    const result = source === "camera"
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.72, base64: true })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [16, 9], quality: 0.72, base64: true });
    const asset = result.canceled ? null : result.assets[0];
    if (!asset?.base64) return;
    const type = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpeg";
    setImageUrl(`data:image/${type};base64,${asset.base64}`);
  };
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => { if (!saving) onClose(); }}>
      <SafeAreaView style={styles.modalPage}>
        <KeyboardAvoidingView style={styles.modalKeyboardAvoider} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.editHangoutHeader}><Pressable disabled={saving} style={[styles.profileScreenBackButton, saving && styles.disabledButton]} hitSlop={8} onPress={onClose} accessibilityRole="button" accessibilityLabel="Hangout画面に戻る"><View style={styles.backChevron} /></Pressable><View style={styles.profileScreenHeading}><Text style={styles.profileScreenEyebrow}>主催者メニュー</Text><Text style={styles.profileScreenTitle}>Hangoutを編集</Text></View><View style={styles.profileScreenHeaderSpacer} /></View>
        <ScrollView contentContainerStyle={styles.editHangoutForm} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
          <Text style={styles.label}>Hangoutのイメージ写真</Text>
          <View style={styles.editImageActions}><Pressable style={styles.imagePickerButton} onPress={() => void chooseImage("camera")}><Text style={styles.imagePickerButtonText}>カメラで撮る</Text></Pressable><Pressable style={styles.imagePickerButton} onPress={() => void chooseImage("library")}><Text style={styles.imagePickerButtonText}>写真から選ぶ</Text></Pressable></View>
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
          <AppTextInput style={[styles.input, styles.multiline]} value={description} onChangeText={setDescription} multiline maxLength={500} />
        </ScrollView>
        <View style={styles.editHangoutFooter}><Pressable disabled={saving} style={[styles.editFooterCancel, saving && styles.disabledButton]} onPress={onClose}><Text style={styles.editFooterCancelText}>キャンセル</Text></Pressable><Pressable disabled={saving} style={[styles.editFooterSave, saving && styles.disabledButton]} onPress={async () => { if (saving) return; setSaving(true); try { await onSave({ title, description, imageUrl, publicLocationName, locationName: `${meetingPlaceName} ${meetingAddress}`.trim(), meetingPlaceName, meetingAddress, navigationUrl, genderRestriction, maxAge }); } finally { setSaving(false); } }}><Text style={styles.primaryText}>{saving ? "保存中…" : "変更を保存"}</Text></Pressable></View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

function ApplicantProfileModal({ profile, title, onClose }: { profile: ApplicantProfile | null; title: "申請者プロフィール" | "参加メンバープロフィール"; onClose: () => void }) {
  const [photoIndex, setPhotoIndex] = useState<number | null>(null);
  const photos = (profile?.profilePhotos?.length ? profile.profilePhotos : profile?.profilePhoto ? [profile.profilePhoto] : []).filter(Boolean);
  return (
    <><Modal visible={profile !== null} transparent={Platform.OS !== "ios"} presentationStyle={Platform.OS === "ios" ? "pageSheet" : "overFullScreen"} allowSwipeDismissal animationType="slide" onRequestClose={onClose}>
      <View style={styles.applicantModalBackdrop}>
        <View style={styles.applicantModalCard}>
          <View style={styles.applicantSheetHandle} />
          <View style={styles.applicantModalHeader}>
            <Pressable style={styles.applicantModalBack} onPress={onClose} accessibilityRole="button" accessibilityLabel="プロフィールを閉じる"><View style={styles.backChevron} /></Pressable>
            <Text style={styles.applicantModalTitle}>{title}</Text>
            <View style={styles.applicantModalHeaderSpacer} />
          </View>
          <View style={styles.profilePhotoTrio}>{[profile?.profilePhotos?.[1],profile?.profilePhotos?.[0]||profile?.profilePhoto,profile?.profilePhotos?.[2]].map((photo,index)=>photo?<Pressable key={`${photo}-${index}`} onPress={() => setPhotoIndex(Math.max(0, photos.indexOf(photo)))} accessibilityLabel="プロフィール画像を拡大"><Image source={{uri:photo}} style={index===1?styles.applicantAvatar:styles.avatarSide}/></Pressable>:<View key={`applicant-empty-${index}`} style={index===1?styles.applicantAvatarFallback:styles.avatarSideFallback}><Text style={styles.applicantAvatarText}>{index===1?(profile?.displayName.slice(0,1)||"☺"):"＋"}</Text></View>)}</View>
          {!!photos.length && <Text style={styles.applicantPhotoHint}>画像をタップすると大きく表示できます</Text>}
          <Text style={styles.applicantName}>{profile?.displayName}</Text>
          <Text style={styles.applicantVerification}>{profile?.verification === "PHONE_VERIFIED" ? "✓ 電話番号確認済み" : "電話番号未確認"}</Text>
          <View style={styles.applicantDetails}>
            <View style={styles.applicantDetailRow}><Text style={styles.applicantDetailLabel}>年齢</Text><Text style={styles.applicantDetailValue}>{profile?.age !== undefined ? `${profile.age}歳` : "未登録"}</Text></View>
            <View style={styles.applicantDetailRow}><Text style={styles.applicantDetailLabel}>活動エリア</Text><Text style={styles.applicantDetailValue}>{profile?.homeArea || "未登録"}</Text></View>
          </View>
          <Text style={styles.applicantSectionTitle}>自己紹介</Text>
          <Text style={styles.applicantBio}>{profile?.bio || "自己紹介は未登録です。"}</Text>
          <Text style={styles.applicantSectionTitle}>興味のあること</Text>
          <View style={styles.applicantInterests}>
            {profile?.interests.length ? profile.interests.map((interest) => (
              <Text key={interest} style={styles.tag}>
                {interest}
              </Text>
            )) : <Text style={styles.tag}>未登録</Text>}
          </View>
          <Text style={styles.applicantPrivacyNote}>申請の判断に必要な公開プロフィールのみ表示しています。</Text>
          <Text style={styles.applicantDismissHint}>下にスライドして閉じる</Text>
        </View>
      </View>
    </Modal><PhotoViewerModal photos={photos} index={photoIndex} onIndex={setPhotoIndex} onClose={() => setPhotoIndex(null)} /></>
  );
}

function PhotoViewerModal({ photos, index, onIndex, onClose }: { photos: string[]; index: number | null; onIndex: (index: number | null) => void; onClose: () => void }) {
  const translateY = useRef(new Animated.Value(0)).current;
  useEffect(() => { if (index !== null) translateY.setValue(0); }, [index, translateY]);
  const dismiss = () => Animated.timing(translateY, { toValue: 900, duration: 180, useNativeDriver: true }).start(onClose);
  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 100 || gesture.vy > 1) dismiss();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start(),
  });
  return <Modal visible={index !== null && photos.length > 0} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.photoViewerBackdrop}>
      <Animated.View style={[styles.photoViewerSwipeContent, { transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={styles.photoViewerHandle} />
        <Text style={styles.photoViewerDismissHint}>下にスライドして閉じる</Text>
        {index !== null && photos[index] ? <Image source={{ uri: photos[index] }} style={styles.photoViewerImage} resizeMode="contain" /> : null}
        {photos.length > 1 && <View style={styles.photoViewerControls}><Pressable style={styles.photoViewerControl} onPress={() => onIndex(index === null ? 0 : (index - 1 + photos.length) % photos.length)}><Text style={styles.photoViewerControlText}>‹</Text></Pressable><Text style={styles.photoViewerCount}>{(index ?? 0) + 1} / {photos.length}</Text><Pressable style={styles.photoViewerControl} onPress={() => onIndex(index === null ? 0 : (index + 1) % photos.length)}><Text style={styles.photoViewerControlText}>›</Text></Pressable></View>}
      </Animated.View>
    </View>
  </Modal>;
}

function PhoneVerificationScreen({ onBack, onVerify }: { onBack: () => void; onVerify: (phone: string, code?: string) => Promise<void> }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState("");
  return (
    <View style={styles.phoneSheetScreen}>
    <Pressable style={styles.phoneSheetBackdrop} onPress={onBack} accessibilityLabel="電話番号確認を閉じる" />
    <View style={styles.phoneSheetPanel}>
      <View style={styles.phoneSheetHandle} />
      <ScrollView contentContainerStyle={styles.phoneSheetContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <Text style={styles.profileScreenEyebrow}>本人確認</Text>
      <Text style={styles.pageTitle}>電話番号確認</Text>
      <Text style={styles.safetyNote}>安全なコミュニティ運営のため、募集作成にはSMS確認が必要です。番号は他の利用者には公開されません。</Text>
      <Text style={styles.label}>携帯電話番号</Text>
      <AppTextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="09012345678" />
      <Text style={styles.phoneHint}>日本の電話番号は090・080・070から入力できます。</Text>
      {sent && (
        <>
          <Text style={styles.label}>6桁の確認コード</Text>
          <AppTextInput style={styles.input} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} />
        </>
      )}
      <Pressable
        disabled={!phone.trim() || Boolean(sent && code.length !== 6)}
        style={[styles.primary, (!phone.trim() || Boolean(sent && code.length !== 6)) && styles.disabled]}
        onPress={() => void (async () => {
          setMessage("");
          try {
            await onVerify(phone, sent ? code : undefined);
            if (!sent) {
              setSent(true);
              setMessage("SMSに認証コードを送信しました");
            }
          } catch (cause) {
            setMessage(cause instanceof Error ? cause.message : "電話番号を確認できませんでした");
          }
        })()}
      >
        <Text style={styles.primaryText}>{sent ? "確認して完了" : "SMSを送信"}</Text>
      </Pressable>
      {message ? <Text style={styles.providerNote}>{message}</Text> : null}
      <Pressable style={styles.secondary} onPress={onBack}><Text>キャンセル</Text></Pressable>
      </ScrollView>
    </View>
    </View>
  );
}

function InlineHangoutRatings({ userId, hostUserId, hangoutId, members, onRate, onDone }: { userId: string; hostUserId: string; hangoutId: string; members: ChatMember[]; onRate: (hangoutId: string, ratedUserId: string, score: number) => void; onDone: () => void }) {
  const targets = members.filter((member) => member.id !== userId);
  return (
    <View style={styles.inlineRatingPanel}>
      <Text style={styles.participantPanelLabel}>HANGOUT終了後</Text>
      <Text style={styles.inlineRatingTitle}>主催者・参加者を評価</Text>
      <Text style={styles.inlineRatingDescription}>一緒に過ごしたメンバーを★1〜5で評価できます。</Text>
      {targets.map((member) => (
        <View key={member.id} style={styles.inlineRatingCard}>
          <View style={styles.ratingScreenPerson}>
            {member.profilePhoto ? <Image source={{ uri: member.profilePhoto }} style={styles.headerAvatar} /> : <View style={styles.headerAvatarFallback}><Text style={styles.headerAvatarText}>{member.displayName.slice(0, 1)}</Text></View>}
            <View><Text style={styles.memberRatingName}>{member.displayName}</Text><Text style={styles.muted}>{member.id === hostUserId ? "主催者として評価" : "参加者として評価"}</Text><Text style={styles.muted}>{member.myRatingScore ? `評価済み ★${member.myRatingScore}` : "評価を選択してください"}</Text></View>
          </View>
          <View style={styles.scoreChoices}>
            {[1, 2, 3, 4, 5].map((score) => <Pressable key={score} accessibilityRole="button" accessibilityLabel={`${member.displayName}を星${score}で評価`} style={[styles.scoreButton, member.myRatingScore === score && styles.scoreButtonOn]} onPress={() => onRate(hangoutId, member.id, score)}><Text style={[styles.scoreText, member.myRatingScore === score && styles.scoreTextOn]}>{score}★</Text></Pressable>)}
          </View>
        </View>
      ))}
      {!targets.length && <Text style={styles.empty}>評価するメンバーはいません。</Text>}
      <Pressable style={styles.inlineRatingDone} onPress={onDone}><Text style={styles.primaryText}>評価完了</Text></Pressable>
    </View>
  );
}

function FinishConfirmationModal({ hangoutId, loading, onClose, onConfirm }: { hangoutId: string | null; loading: boolean; onClose: () => void; onConfirm: (hangoutId: string) => void }) {
  return <Modal visible={hangoutId !== null} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.confirmSheetScreen}>
      <Pressable style={styles.phoneSheetBackdrop} onPress={onClose} accessibilityLabel="終了確認を閉じる" />
      <View style={styles.confirmSheetPanel}>
        <View style={styles.phoneSheetHandle} />
        <Text style={styles.profileScreenEyebrow}>Hangoutを終了</Text>
        <Text style={styles.confirmSheetTitle}>楽しい時間を過ごせましたか？</Text>
        <Text style={styles.ratingScreenDescription}>終了すると参加者を★1〜5で評価できます。双方が★5の場合だけ1対1トークが解放されます。</Text>
        <Pressable disabled={loading || hangoutId === null} style={[styles.primary, loading && styles.disabled]} onPress={() => hangoutId && onConfirm(hangoutId)}><Text style={styles.primaryText}>{loading ? "終了しています…" : "終了して評価へ進む"}</Text></Pressable>
        <Pressable disabled={loading} style={styles.secondary} onPress={onClose}><Text>まだ終了しない</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

function ReportHostModal({ hangout, loading, onClose, onSubmit }: { hangout: Hangout | null; loading: boolean; onClose: () => void; onSubmit: (hangout: Hangout, reason: ReportReason, details: string, blockUser: boolean) => void }) {
  const [reason, setReason] = useState<ReportReason>("HARASSMENT");
  const [details, setDetails] = useState("");
  const [blockUser, setBlockUser] = useState(true);
  useEffect(() => { if (hangout) { setReason("HARASSMENT"); setDetails(""); setBlockUser(true); } }, [hangout]);
  const reasons: ReadonlyArray<[ReportReason, string]> = [["HARASSMENT","迷惑行為"],["DANGEROUS","危険行為"],["SEXUAL","性的目的"],["SOLICITATION","勧誘・営業"],["FRAUD","詐欺"],["OTHER","その他"]];
  return <Modal visible={hangout !== null} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.confirmSheetScreen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Pressable style={styles.phoneSheetBackdrop} onPress={onClose} accessibilityLabel="通報画面を閉じる" />
      <ScrollView style={styles.reportSheetPanel} contentContainerStyle={styles.reportSheetContent} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive"><View style={styles.phoneSheetHandle} /><Text style={styles.confirmSheetTitle}>{hangout?.host.displayName ?? "主催者"}を通報</Text><Text style={styles.safetyNote}>緊急の危険がある場合は、アプリではなく警察・救急へ連絡してください。</Text>
        <Text style={styles.label}>理由</Text><View style={styles.reportReasonGrid}>{reasons.map(([value,label]) => <Pressable key={value} style={[styles.reportReasonChoice, reason === value && styles.choiceOn]} onPress={() => setReason(value)}><Text style={styles.reportReasonText}>{label}</Text></Pressable>)}</View>
        <Text style={styles.label}>詳細</Text><AppTextInput style={[styles.input, styles.multiline]} value={details} onChangeText={setDetails} multiline maxLength={500} placeholder="状況を入力してください（任意）" />
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: blockUser }} style={styles.reportBlockChoice} onPress={() => setBlockUser((value) => !value)}><View style={[styles.matchingCheckbox, blockUser && styles.matchingCheckboxOn]}><Text style={styles.matchingCheckmark}>{blockUser ? "✓" : ""}</Text></View><Text style={styles.reportBlockText}>同時にブロック</Text></Pressable>
        <Pressable disabled={loading || !hangout} style={[styles.primary, loading && styles.disabled]} onPress={() => hangout && onSubmit(hangout, reason, details, blockUser)}><Text style={styles.primaryText}>{loading ? "送信しています…" : "通報する"}</Text></Pressable><Pressable disabled={loading} style={styles.secondary} onPress={onClose}><Text>キャンセル</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  </Modal>;
}

function MatchFeedbackModal({ hangout, onClose, onSelect }: { hangout: Hangout | null; onClose: () => void; onSelect: (hangout: Hangout, reason: MatchFeedbackReason) => Promise<void> }) {
  const [sendingReason, setSendingReason] = useState<MatchFeedbackReason | null>(null);
  useEffect(() => { if (hangout) setSendingReason(null); }, [hangout]);
  const reasons: ReadonlyArray<[MatchFeedbackReason, string]> = [["TIME","時間が合わない"],["DISTANCE","距離が遠い"],["FULL","希望人数と違う"],["BUDGET","予算が合わない"],["CONDITIONS","参加条件が合わない"],["OTHER","その他"]];
  return <Modal visible={hangout !== null} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.confirmSheetScreen}><Pressable style={styles.phoneSheetBackdrop} onPress={onClose} accessibilityLabel="合わない理由を閉じる" /><View style={styles.matchFeedbackSheet}><View style={styles.phoneSheetHandle} /><Text style={styles.confirmSheetTitle}>合わない理由</Text><Text style={styles.ratingScreenDescription}>次回のおすすめ改善にだけ利用します。</Text><View style={styles.matchFeedbackReasonGrid}>{reasons.map(([value,label]) => <Pressable key={value} disabled={sendingReason !== null} style={[styles.matchFeedbackReasonButton, sendingReason !== null && styles.disabled]} onPress={() => { if (!hangout) return; setSendingReason(value); void onSelect(hangout, value).finally(() => setSendingReason(null)); }}><Text style={styles.matchFeedbackReasonText}>{sendingReason === value ? "送信中…" : label}</Text></Pressable>)}</View><Pressable disabled={sendingReason !== null} style={styles.secondary} onPress={onClose}><Text>閉じる</Text></Pressable></View></View>
  </Modal>;
}

function RatingScreen({ user, room, onRate, onDone }: { user: User; room: GroupRoom; onRate: (hangoutId: string, userId: string, score: number) => void; onDone: () => void }) {
  const members = room.members.filter((member) => member.id !== user.id && !member.myRatingScore);
  return (
    <View style={styles.ratingSheetScreen}><View style={styles.ratingSheetPanel}><View style={styles.phoneSheetHandle} /><ScrollView contentContainerStyle={styles.ratingScreen}>
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
    </ScrollView></View></View>
  );
}

function ChatScreen({ user, rooms, selectedRoom, messages, messageBody, sending, refreshing, unreadByRoom, realtimeOnline, onRefresh, onOpen, onRate, onBack, onChangeBody, onSend }: { user: User; rooms: Room[]; selectedRoom: Room | null; messages: Message[]; messageBody: string; sending: boolean; refreshing: boolean; unreadByRoom: Record<string, number>; realtimeOnline: boolean; onRefresh: () => void; onOpen: (room: Room) => void; onRate: (hangoutId: string, userId: string, score: number) => void; onBack: () => void; onChangeBody: (value: string) => void; onSend: (body?: string) => void }) {
  const listRef = useRef<FlatList<Message>>(null);
  const time = (value?: string) =>
    value
      ? new Date(value).toLocaleTimeString("ja-JP", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";
  const roomStatus = (room: GroupRoom) => room.hangout.status === "FINISHED" ? "Hangout終了" : room.hangout.status === "STARTED" ? "Hangout中" : room.hangout.status === "FULL" ? "満員" : "募集中";
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
              {selectedRoom.type === "DIRECT" ? "1対1 ・ " : selectedRoom.hangout.status === "FINISHED" ? "終了・評価待ち ・ " : `グループ ・ ${selectedRoom.members.length}人 ・ `}
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
          style={styles.messageListView}
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
                  {showName && <Text style={[styles.messageSender, mine && styles.messageSenderMine]}>{item.sender.displayName}</Text>}
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
        {selectedRoom.type === "GROUP" && (
          <ScrollView style={styles.quickMessageScroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickMessageRow}>
            {["向かっています", "少し遅れます", "到着しました"].map((body) => (
              <Pressable key={body} disabled={sending} style={styles.quickMessageButton} onPress={() => onSend(body)}>
                <Text style={styles.quickMessageText}>{body}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        <View style={styles.composer}>
          <AppTextInput style={styles.composerInput} value={messageBody} onChangeText={onChangeBody} placeholder="メッセージを入力" placeholderTextColor="#8a918c" multiline maxLength={1000} />
          <Pressable disabled={sending || !messageBody.trim()} style={[styles.sendButton, (sending || !messageBody.trim()) && styles.sendDisabled]} onPress={() => onSend()}>
            <Text style={styles.sendText}>{sending ? "…" : "↑"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    );
  }
  const visibleRooms = rooms;
  return (
    <View style={styles.chatListPage}>
      <View style={styles.chatListHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="ホームに戻る" onPress={onBack} style={styles.backButton}>
          <View style={styles.backChevron} />
        </Pressable>
        <View style={styles.chatListHeadingCopy}>
          <Text style={styles.pageEyebrow}>新しいメッセージ順</Text>
          <Text style={styles.pageTitle}>トーク</Text>
        </View>
        <Text style={[styles.connectionBadge, realtimeOnline && styles.connectionOn]}>{realtimeOnline ? "リアルタイム" : "再接続中"}</Text>
      </View>
      <ScrollView style={styles.chatListScroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
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
                {room.type === "GROUP" && <Text style={styles.roomStatus}>{roomStatus(room)}</Text>}
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
    </View>
  );
}

function NotificationScreen({ inbox, refreshing, onBack, onRefresh, onEnabled, onDeviceNotifications, onRead, onReadAll, onDelete }: { inbox: NotificationInbox; refreshing: boolean; onBack: () => void; onRefresh: () => void; onEnabled: (enabled: boolean) => void; onDeviceNotifications: () => void; onRead: (id: string) => void; onReadAll: () => void; onDelete: () => void }) {
  return (
    <View style={styles.notificationScreen}>
      <View style={styles.notificationHead}>
        <Pressable accessibilityRole="button" accessibilityLabel="ホームに戻る" onPress={onBack} style={styles.backButton}><View style={styles.backChevron} /></Pressable>
        <View style={styles.notificationHeadTitle}><Text style={styles.notificationHeadEyebrow}>リアルタイム更新</Text><Text style={styles.notificationHeadText}>通知</Text></View>
        <View style={styles.notificationHeadSpacer} />
      </View>
      <ScrollView contentContainerStyle={styles.notificationPage} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <View style={styles.notificationSettings}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: inbox.enabled }} style={styles.notificationSettingRow} onPress={() => onEnabled(!inbox.enabled)}>
          <View style={[styles.notificationCheckbox, inbox.enabled && styles.notificationCheckboxOn]}><Text style={styles.notificationCheckmark}>{inbox.enabled ? "✓" : ""}</Text></View>
          <Text style={styles.notificationSettingTitle}>アプリ内通知を受け取る</Text>
        </Pressable>
        <View style={styles.notificationActions}>
          <Pressable style={styles.deviceNotificationsButton} onPress={onDeviceNotifications}><Text style={styles.deviceNotificationsText}>端末通知を許可</Text></Pressable>
          <Pressable style={styles.readAllButton} onPress={onReadAll}><Text style={styles.readAllButtonText}>すべて既読</Text></Pressable>
          <Pressable style={styles.deleteNotificationsButton} onPress={onDelete}><Text style={styles.deleteNotificationsText}>通知を削除</Text></Pressable>
        </View>
      </View>
      {inbox.items.map((item) => (
        <Pressable key={item.id} style={[styles.notificationItem, !item.readAt && styles.notificationItemUnread]} onPress={() => onRead(item.id)}>
          <View style={styles.notificationItemCopy}><Text style={styles.notificationItemTitle}>{item.title}</Text><Text style={styles.notificationItemBody}>{item.body}</Text><Text style={styles.notificationItemTime}>{new Date(item.createdAt).toLocaleString("ja-JP")}</Text></View>
        </Pressable>
      ))}
      {!inbox.items.length && <Text style={styles.empty}>通知はまだありません。</Text>}
      </ScrollView>
    </View>
  );
}

function ProfileScreen({ user, hostStatus, activity, demo, onBack, onChat, onOpenHangout, onPhone, onPhoto, onSave, onDelete, onLogout }: { user: User; hostStatus: HostStatus | null; activity: ProfileActivity; demo: boolean; onBack: () => void; onChat: () => void; onOpenHangout: (id: string) => void; onPhone: () => void; onPhoto: (index: number) => void; onSave: (input: UpdateProfileInput) => Promise<void>; onDelete: () => void; onLogout: () => void }) {
  const white = hostStatus?.tier === "WHITE";
  const nextTierLabel = hostStatus?.nextTier ? ({ BRONZE: "ブロンズ", SILVER: "シルバー", GOLD: "ゴールド", PLATINUM: "プラチナ", DIAMOND: "ダイアモンド", WHITE: "ホワイト" } as const)[hostStatus.nextTier] : null;
  const [editing, setEditing] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
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
  const [preferredLanguages, setPreferredLanguages] = useState(user.preferredLanguages ?? []);
  const [photoViewerIndex, setPhotoViewerIndex] = useState<number | null>(null);
  const profilePhotos = (user.profilePhotos?.length ? user.profilePhotos : user.profilePhoto ? [user.profilePhoto] : []).filter(Boolean);
  const activeStatuses = new Set(["OPEN", "FULL", "STARTED"]);
  const activitySections = [
    ["主催中のHangout", activity.hosted.filter((item) => activeStatuses.has(item.status))],
    ["主催したHangout", activity.hosted.filter((item) => item.status !== "CANCELLED" && !activeStatuses.has(item.status))],
    ["参加するHangout", activity.participated.filter((item) => activeStatuses.has(item.status))],
    ["参加したHangout", activity.participated.filter((item) => !activeStatuses.has(item.status))],
    ["ハートしたHangout", activity.hearted],
  ] as const;
  const toggleInterest = (interest: string) => {
    const next = selectedInterests.includes(interest) ? selectedInterests.filter((item) => item !== interest) : [...selectedInterests, interest];
    setSelectedInterests([...new Set(next)].slice(0, 20));
  };
  const parseList = (value: string) => [...new Set(value.split(/[、,]/).map((item) => item.trim()).filter(Boolean))];
  const toggleCsvChoice = (value: string, current: string, update: (next: string) => void) => {
    const values = parseList(current);
    update((values.includes(value) ? values.filter((item) => item !== value) : [...values, value]).join("、"));
  };
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
    setProfileSaving(true);
    try {
      await onSave({
        displayName: name, homeArea: homeArea.trim() || null, bio: bio.trim() || null, interests: values, gender,
        preferredAreas: parseList(preferredAreas).slice(0, 10), preferredActivities: parseList(preferredActivities).slice(0, 20),
        preferredAgeMin: ageMin, preferredAgeMax: ageMax, preferredGenders,
        activityTimeSlots: parseList(activityTimeSlots).slice(0, 12), participationUrgency,
        maxTravelMinutes: maxTravelMinutes ? Number(maxTravelMinutes) : null,
        preferredGroupSizes: parseList(preferredGroupSizes).map(Number).filter((value) => Number.isInteger(value) && value >= 2 && value <= 20).slice(0, 6),
        budgetMin: minimumBudget, budgetMax: maximumBudget, matchingDataConsent,
        socialStyles, participationGoals, firstTimePreferences, alcoholPreference, smokingPreference,
        avoidPreferences, scheduleFlexibility, behaviorLearningEnabled, preferredLanguages,
      });
      setEditing(false);
      Alert.alert("保存しました", "プロフィールを更新しました。");
    } catch {
      Alert.alert("更新できませんでした", "入力内容を確認してもう一度お試しください。");
    } finally {
      setProfileSaving(false);
    }
  };
  const selectedPreferredAreas = parseList(preferredAreas).filter((value) => (MATCH_AREA_OPTIONS as readonly string[]).includes(value));
  const customPreferredAreas = parseList(preferredAreas).filter((value) => !(MATCH_AREA_OPTIONS as readonly string[]).includes(value)).join("、");
  const selectedPreferredActivities = parseList(preferredActivities).filter((value) => (MATCH_ACTIVITY_OPTIONS as readonly string[]).includes(value));
  const customPreferredActivities = parseList(preferredActivities).filter((value) => !(MATCH_ACTIVITY_OPTIONS as readonly string[]).includes(value)).join("、");
  const selectedActivitySlots = parseList(activityTimeSlots);
  const selectedGroupSizes = parseList(preferredGroupSizes).map(Number);
  return (
    <View style={styles.profileScreen}>
      <View style={styles.profileScreenHeader}>
        <Pressable style={styles.profileScreenBackButton} hitSlop={8} onPress={onBack} accessibilityRole="button" accessibilityLabel="ホームに戻る"><View style={styles.backChevron} /></Pressable>
        <View style={styles.profileScreenHeading}><Text style={styles.profileScreenEyebrow}>アカウント</Text><Text style={styles.profileScreenTitle}>プロフィール</Text></View>
        <View style={styles.profileScreenHeaderSpacer} />
      </View>
    <ScrollView contentContainerStyle={styles.profile}>
      <View style={styles.profilePhotoTrio}>{[user.profilePhotos?.[1],user.profilePhotos?.[0]||user.profilePhoto,user.profilePhotos?.[2]].map((photo,index)=>photo?<Pressable key={`${photo}-${index}`} onPress={() => setPhotoViewerIndex(index === 0 ? 1 : index === 1 ? 0 : 2)} accessibilityLabel="プロフィール画像を拡大"><Image source={{uri:photo}} style={index===1?styles.avatar:styles.avatarSide}/></Pressable>:<View key={`empty-${index}`} style={index===1?styles.avatarFallback:styles.avatarSideFallback}><Text style={styles.avatarText}>{index===1?"☺":"＋"}</Text></View>)}</View>
      <Text style={styles.profileName}>{user.displayName}</Text>
      <Pressable onPress={user.verificationStatus === "PHONE_VERIFIED" ? undefined : onPhone} accessibilityRole={user.verificationStatus === "PHONE_VERIFIED" ? "text" : "button"}>
        <Text style={[styles.verified, user.verificationStatus !== "PHONE_VERIFIED" && styles.unverified]}>{user.verificationStatus === "PHONE_VERIFIED" ? "✓ 電話番号確認済み" : "電話番号を確認する ›"}</Text>
      </Pressable>
      <Pressable style={styles.profileChatButton} onPress={onChat}><Text style={styles.profileChatButtonIcon}>●</Text><Text style={styles.profileChatButtonText}>トーク</Text></Pressable>
      <Pressable style={styles.profileEditButton} onPress={() => setEditing(true)}><Text style={styles.profileEditButtonText}>プロフィールを編集</Text></Pressable>
      {hostStatus && (
        <View style={[styles.hostRankCard, white && styles.hostRankWhite]}>
          <Text style={[styles.hostRankCaption, white && styles.hostRankDark]}>主催者ステータス</Text>
          <Text style={[styles.hostRankName, white && styles.hostRankDark]}>{hostStatus.label}</Text>
          <Text style={[styles.hostRankStats, white && styles.hostRankDark]}>
            開催完了 {hostStatus.completedHangouts}回 ・ 累計参加者 {hostStatus.totalParticipants}人{`\n`}主催評価 {hostStatus.hostAverageRating ?? "未評価"}（{hostStatus.hostRatingCount}件） ・ 参加評価 {hostStatus.participantAverageRating ?? "未評価"}（{hostStatus.participantRatingCount}件）{`\n`}中止率 {Math.round(hostStatus.cancellationRate * 100)}%
          </Text>
          <Text style={[styles.hostRankNext, white && styles.hostRankDark]}>{nextTierLabel ? `次のステータス：${nextTierLabel}` : "最高ステータスです"}</Text>
        </View>
      )}
      <View style={styles.profileStats}>
        <View style={styles.profileStat}><Text style={styles.profileStatValue}>{hostStatus?.hostAverageRating ?? "—"}</Text><Text style={styles.profileStatLabel}>主催評価</Text></View>
        <View style={styles.profileStat}><Text style={styles.profileStatValue}>{hostStatus?.participantAverageRating ?? "—"}</Text><Text style={styles.profileStatLabel}>参加評価</Text></View>
        <View style={styles.profileStat}><Text style={styles.profileStatValue}>{activity.participated.length}</Text><Text style={styles.profileStatLabel}>参加</Text></View>
        <View style={styles.profileStat}><Text style={styles.profileStatValue}>{hostStatus?.completedHangouts ?? activity.hosted.filter((item) => item.status === "FINISHED").length}</Text><Text style={styles.profileStatLabel}>開催完了</Text></View>
      </View>
      <Text style={styles.bio}>{user.bio || "自己紹介を登録しましょう。"}</Text>
      <Text style={styles.profileSectionTitle}>興味のあること</Text>
      <View style={styles.tags}>
        {user.interests.length ? user.interests.map((item) => (
          <Text key={item} style={styles.tag}>
            {item}
          </Text>
        )) : <Text style={styles.tag}>未登録</Text>}
      </View>
      {activitySections.map(([heading, items]) => (
        <View key={heading} style={styles.profileActivitySection}>
          <Text style={styles.profileActivityHeading}>{heading}</Text>
          {items.length ? items.map((item) => (
            <Pressable key={item.id} style={styles.profileActivityCard} onPress={() => onOpenHangout(item.id)} accessibilityRole="button" accessibilityLabel={`${item.title}を表示`}>
              {item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.profileActivityImage} /> : <View style={styles.profileActivityImageFallback}><Text>✨</Text></View>}
              <View style={styles.cardCopy}>
                <Text style={styles.profileActivityTitle}>{item.title}</Text>
                <Text style={styles.muted}>{new Date(item.startAt).toLocaleDateString('ja-JP')} ・ {item.status === 'FINISHED' ? '終了' : item.status === 'CANCELLED' ? '中止' : item.status === 'STARTED' ? 'Hangout中' : item.status === 'FULL' ? '満員' : '募集中'}</Text>
              </View>
              <Text style={styles.profileActivityChevron}>›</Text>
            </Pressable>
          )) : <Text style={styles.empty}>まだありません。</Text>}
        </View>
      ))}
      <View style={styles.safety}>
        <Text>🛡️ 募集を作るには、顔が分かるプロフィール写真と電話番号確認が必要です。</Text>
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
          <KeyboardAvoidingView style={styles.modalKeyboardAvoider} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.profileEditorHeader}><Pressable disabled={profileSaving} style={styles.profileEditorBackButton} hitSlop={8} onPress={() => void save()} accessibilityRole="button" accessibilityLabel="保存してプロフィールに戻る">{profileSaving ? <ActivityIndicator size="small" color="#176b48" /> : <View style={styles.backChevron} />}</Pressable><View style={styles.profileEditorHeading}><Text style={styles.profileEditorEyebrow}>アカウント</Text><Text style={styles.profileEditorTitle}>プロフィールを編集</Text></View><View style={styles.profileEditorHeaderSpacer} /></View>
          <ScrollView contentContainerStyle={styles.profileEditorForm} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <Text style={styles.profileEditorLabel}>プロフィール画像（最大3枚）</Text><View style={styles.profilePhotoTrio}>{[1,0,2].map((photoIndex,position)=>{const photo=user.profilePhotos?.[photoIndex]||(photoIndex===0?user.profilePhoto:undefined);return <Pressable key={photoIndex} onPress={()=>onPhoto(photoIndex)} accessibilityLabel={`${photoIndex+1}枚目の画像を選ぶ`}>{photo?<Image source={{uri:photo}} style={position===1?styles.avatar:styles.avatarSide}/>:<View style={position===1?styles.avatarFallback:styles.avatarSideFallback}><Text style={styles.avatarText}>{position===1?"☺":"＋"}</Text></View>}</Pressable>})}</View><Text style={styles.profileEditorHint}>丸い画像をタップして入れ替えます。中央がメイン画像です。</Text>
            <Text style={styles.profileEditorLabel}>表示名</Text><AppTextInput style={styles.profileEditorInput} value={displayName} onChangeText={setDisplayName} maxLength={40} />
            <Text style={styles.profileEditorLabel}>電話番号</Text><Pressable style={styles.profileEditorAction} onPress={() => { setEditing(false); onPhone(); }}><Text style={styles.profileEditorActionText}>{user.verificationStatus === "PHONE_VERIFIED" ? "電話番号を変更" : "電話番号を確認"}</Text></Pressable>
            <Text style={styles.profileEditorLabel}>活動エリア</Text><AppTextInput style={styles.profileEditorInput} value={homeArea} onChangeText={setHomeArea} maxLength={80} placeholder="例：新宿・渋谷" />
            <Text style={styles.profileEditorLabel}>自己紹介</Text><AppTextInput style={[styles.profileEditorInput, styles.profileEditorBio]} value={bio} onChangeText={setBio} maxLength={500} multiline textAlignVertical="top" placeholder="好きなことや参加したいHangoutを書きましょう" />
            <Text style={styles.profileEditorLabel}>興味のあること</Text>
            <View style={styles.interestOptionGrid}>{INTEREST_OPTIONS.map((interest) => { const selected = selectedInterests.includes(interest); return <Pressable key={interest} style={[styles.interestOption, selected && styles.interestOptionSelected]} onPress={() => toggleInterest(interest)}><Text style={[styles.interestOptionText, selected && styles.interestOptionTextSelected]}>{interest}</Text></Pressable>; })}</View>
            <AppTextInput style={[styles.profileEditorInput, { marginTop: 10 }]} value={interests} onChangeText={setInterests} maxLength={300} placeholder="ボタンにない興味だけ入力" /><Text style={styles.profileEditorHint}>候補はタップして選択し、入力欄には候補にない言葉だけを記載します。</Text>
            <Text style={styles.profileEditorLabel}>性別</Text><View style={styles.profileGenderOptions}>{[["UNDISCLOSED", "回答しない"], ["MALE", "男性"], ["FEMALE", "女性"], ["OTHER", "その他"]].map(([value, label]) => <Pressable key={value} style={[styles.profileGenderOption, gender === value && styles.profileGenderOptionSelected]} onPress={() => setGender(value)}><Text style={gender === value ? styles.profileGenderOptionTextSelected : styles.profileGenderOptionText}>{label}</Text></Pressable>)}</View>
            <View style={styles.matchingPreferences}>
              <Text style={styles.matchingTitle}>マッチング設定</Text>
              <Text style={styles.profileEditorHint}>タップするだけ。複数選べる項目は、もう一度タップすると解除できます。</Text>
              <Text style={styles.profileEditorHint}>入力は任意です。位置は市区・駅などのおおまかなエリアだけを保存し、正確なGPS位置は保存しません。</Text>
              <Text style={styles.profileEditorLabel}>希望エリア</Text><Text style={styles.profileEditorHint}>よく行く場所を選択</Text><View style={styles.matchChoiceGrid}>{MATCH_AREA_OPTIONS.map((value) => { const selected = selectedPreferredAreas.includes(value); return <Pressable key={value} style={[styles.matchChoice, selected && styles.matchChoiceSelected]} onPress={() => toggleCsvChoice(value, preferredAreas, setPreferredAreas)}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{value}</Text></Pressable>; })}</View><AppTextInput style={[styles.profileEditorInput, styles.matchCustomInput]} value={customPreferredAreas} onChangeText={(value) => setPreferredAreas([...selectedPreferredAreas, ...parseList(value)].join("、"))} maxLength={300} placeholder="ほかのエリアを追加（例：吉祥寺）" />
              <Text style={styles.profileEditorLabel}>希望する活動</Text><Text style={styles.profileEditorHint}>興味があるものを選択</Text><View style={styles.matchChoiceGrid}>{MATCH_ACTIVITY_OPTIONS.map((value) => { const selected = selectedPreferredActivities.includes(value); return <Pressable key={value} style={[styles.matchChoice, selected && styles.matchChoiceSelected]} onPress={() => toggleCsvChoice(value, preferredActivities, setPreferredActivities)}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{value}</Text></Pressable>; })}</View><AppTextInput style={[styles.profileEditorInput, styles.matchCustomInput]} value={customPreferredActivities} onChangeText={(value) => setPreferredActivities([...selectedPreferredActivities, ...parseList(value)].join("、"))} maxLength={500} placeholder="ほかの活動を追加" />
              <Text style={styles.profileEditorLabel}>希望年齢</Text><View style={styles.matchChoiceGridWide}>{([["", "", "こだわらない"], ["18", "24", "18〜24歳"], ["25", "29", "25〜29歳"], ["30", "39", "30代"], ["40", "49", "40代"], ["50", "100", "50歳〜"]] as const).map(([min, max, label]) => { const selected = preferredAgeMin === min && preferredAgeMax === max; return <Pressable key={label} style={[styles.matchChoice, selected && styles.matchChoiceSelected]} onPress={() => { setPreferredAgeMin(min); setPreferredAgeMax(max); }}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{label}</Text></Pressable>; })}</View>
              <Text style={styles.profileEditorLabel}>希望する相手</Text><View style={styles.profileGenderOptions}>{[["MALE", "男性"], ["FEMALE", "女性"], ["OTHER", "その他"], ["UNDISCLOSED", "指定なし"]].map(([value, label]) => { const selected = preferredGenders.includes(value); return <Pressable key={value} style={[styles.profileGenderOption, selected && styles.profileGenderOptionSelected]} onPress={() => togglePreferredGender(value)}><Text style={selected ? styles.profileGenderOptionTextSelected : styles.profileGenderOptionText}>{label}</Text></Pressable>; })}</View>
              <Text style={styles.profileEditorLabel}>雰囲気・交流スタイル</Text><Text style={styles.profileEditorHint}>自分に合う過ごし方を選択</Text>{choiceGrid(SOCIAL_STYLE_OPTIONS, socialStyles, setSocialStyles, 5)}
              <Text style={styles.profileEditorLabel}>参加目的</Text>{choiceGrid(PARTICIPATION_GOAL_OPTIONS, participationGoals, setParticipationGoals, 7)}
              <Text style={styles.profileEditorLabel}>言語</Text><Text style={styles.profileEditorHint}>会話に使いたい言語を複数選択できます</Text>{choiceGrid(LANGUAGE_OPTIONS.map(([, label]) => label), preferredLanguages.map((value) => LANGUAGE_OPTIONS.find(([key]) => key === value)?.[1] ?? value), (labels) => setPreferredLanguages(labels.map((label) => LANGUAGE_OPTIONS.find(([, optionLabel]) => optionLabel === label)?.[0] ?? label)), 4)}
              <Text style={styles.profileEditorLabel}>活動しやすい時間</Text><Text style={styles.matchChoiceSubtitle}>時間帯</Text><View style={styles.matchChoiceGrid}>{MATCH_TIME_OPTIONS.map((value) => { const selected = selectedActivitySlots.includes(value); return <Pressable key={value} style={[styles.matchChoice, selected && styles.matchChoiceSelected]} onPress={() => toggleCsvChoice(value, activityTimeSlots, setActivityTimeSlots)}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{value}</Text></Pressable>; })}</View><Text style={styles.matchChoiceSubtitle}>曜日</Text><View style={styles.matchWeekGrid}>{MATCH_DAY_OPTIONS.map((value) => { const selected = selectedActivitySlots.includes(value); return <Pressable key={value} style={[styles.matchChoice, styles.matchWeekChoice, selected && styles.matchChoiceSelected]} onPress={() => toggleCsvChoice(value, activityTimeSlots, setActivityTimeSlots)}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{value}</Text></Pressable>; })}</View>
              <Text style={styles.profileEditorLabel}>参加したい時期</Text><View style={styles.interestOptionGrid}>{([[null, "未設定"], ["NOW", "今すぐ"], ["TODAY", "今日"], ["THIS_WEEK", "今週"], ["WEEKEND", "週末"], ["FLEXIBLE", "いつでも"]] as const).map(([value, label]) => <Pressable key={label} style={[styles.interestOption, participationUrgency === value && styles.interestOptionSelected]} onPress={() => setParticipationUrgency(value)}><Text style={[styles.interestOptionText, participationUrgency === value && styles.interestOptionTextSelected]}>{label}</Text></Pressable>)}</View>
              <Text style={styles.profileEditorLabel}>移動できる時間</Text><View style={styles.matchChoiceGrid}>{MATCH_TRAVEL_OPTIONS.map(([value, label]) => { const selected = maxTravelMinutes === String(value); return <Pressable key={value} style={[styles.matchChoice, selected && styles.matchChoiceSelected]} onPress={() => setMaxTravelMinutes(selected ? "" : String(value))}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{label}</Text></Pressable>; })}</View>
              <Text style={styles.profileEditorLabel}>希望人数</Text><Text style={styles.profileEditorHint}>複数選択できます</Text><View style={styles.matchChoiceGrid}>{MATCH_GROUP_OPTIONS.map(([value, label]) => { const selected = selectedGroupSizes.includes(value); return <Pressable key={value} style={[styles.matchChoice, selected && styles.matchChoiceSelected]} onPress={() => toggleCsvChoice(String(value), preferredGroupSizes, setPreferredGroupSizes)}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{label}</Text></Pressable>; })}</View>
              <Text style={styles.profileEditorLabel}>1回の予算</Text><View style={styles.matchChoiceGridWide}>{MATCH_BUDGET_OPTIONS.map(([min, max, label]) => { const selected = budgetMin === String(min) && budgetMax === String(max); return <Pressable key={label} style={[styles.matchChoice, selected && styles.matchChoiceSelected]} onPress={() => { setBudgetMin(selected ? "" : String(min)); setBudgetMax(selected ? "" : String(max)); }}><Text style={[styles.matchChoiceText, selected && styles.matchChoiceTextSelected]}>{label}</Text></Pressable>; })}</View>
              <Text style={styles.profileEditorLabel}>お酒</Text><View style={styles.interestOptionGrid}>{([["NONE", "飲まない"], ["SOMETIMES", "少し飲む"], ["YES", "飲む"]] as const).map(([value,label]) => <Pressable key={label} style={[styles.interestOption, alcoholPreference === value && styles.interestOptionSelected]} onPress={() => setAlcoholPreference(alcoholPreference === value ? null : value)}><Text style={[styles.interestOptionText, alcoholPreference === value && styles.interestOptionTextSelected]}>{label}</Text></Pressable>)}</View>
              <Text style={styles.profileEditorLabel}>喫煙環境</Text><View style={styles.interestOptionGrid}>{([["NON_SMOKING", "禁煙希望"], ["SEPARATED", "分煙希望"], ["NO_PREFERENCE", "気にしない"]] as const).map(([value,label]) => <Pressable key={label} style={[styles.interestOption, smokingPreference === value && styles.interestOptionSelected]} onPress={() => setSmokingPreference(smokingPreference === value ? null : value)}><Text style={[styles.interestOptionText, smokingPreference === value && styles.interestOptionTextSelected]}>{label}</Text></Pressable>)}</View>
              <Text style={styles.profileEditorLabel}>初参加への配慮</Text><Text style={styles.profileEditorHint}>安心して参加するために必要なこと</Text>{choiceGrid(FIRST_TIME_OPTIONS, firstTimePreferences, setFirstTimePreferences, 4)}
              <Text style={styles.profileEditorLabel}>苦手・避けたい条件</Text><Text style={styles.profileEditorHint}>おすすめから優先的に外します</Text>{choiceGrid(AVOID_OPTIONS, avoidPreferences, setAvoidPreferences, 7)}
              <Text style={styles.profileEditorLabel}>予定の柔軟性</Text>{choiceGrid(FLEXIBILITY_OPTIONS, scheduleFlexibility, setScheduleFlexibility, 5)}
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: behaviorLearningEnabled }} style={[styles.matchingConsent, behaviorLearningEnabled && styles.matchingConsentOn]} onPress={() => setBehaviorLearningEnabled((value) => !value)}><View style={[styles.matchingCheckbox, behaviorLearningEnabled && styles.matchingCheckboxOn]}><Text style={styles.matchingCheckmark}>{behaviorLearningEnabled ? "✓" : ""}</Text></View><Text style={styles.matchingConsentText}>アプリ内行動からおすすめを改善します。閲覧した募集、ハート、参加、評価を使い、正確な位置やトーク内容は学習に使いません。</Text></Pressable>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: matchingDataConsent }} style={[styles.matchingConsent, matchingDataConsent && styles.matchingConsentOn]} onPress={() => setMatchingDataConsent((value) => !value)}><View style={[styles.matchingCheckbox, matchingDataConsent && styles.matchingCheckboxOn]}><Text style={styles.matchingCheckmark}>{matchingDataConsent ? "✓" : ""}</Text></View><Text style={styles.matchingConsentText}>この設定情報をマッチング改善に利用することに同意します。正確なGPS位置やトーク内容は利用しません。</Text></Pressable>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
      <PhotoViewerModal photos={profilePhotos} index={photoViewerIndex} onIndex={setPhotoViewerIndex} onClose={() => setPhotoViewerIndex(null)} />
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8f3" },
  keyboardAccessory: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: "#dce5df", backgroundColor: "#f8fbf6" },
  keyboardDoneButton: { minWidth: 64, minHeight: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  keyboardDoneText: { color: "#176b48", fontSize: 16, fontWeight: "900" },
  modalKeyboardAvoider: { flex: 1 },
  restore: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: "#f7f8f3",
  },
  restoreText: { color: "#5f6862", fontSize: 12 },
  content: { flex: 1 },
  profileScreen: { flex: 1, backgroundColor: "#f7f8f3" },
  profileScreenHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14 },
  profileScreenBackButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#dfe5df" },
  profileScreenHeading: { flex: 1, paddingHorizontal: 12 },
  profileScreenEyebrow: { color: "#176b48", fontSize: 10, fontWeight: "900" },
  profileScreenTitle: { marginTop: 2, color: "#17221d", fontSize: 17, fontWeight: "900" },
  profileScreenHeaderSpacer: { width: 42 },
  profileSectionTitle: { alignSelf: "stretch", marginTop: 8, color: "#17221d", fontSize: 18, fontWeight: "900" },
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
  actionToast: { position: "absolute", left: 24, right: 24, bottom: 78, zIndex: 50, alignItems: "center" },
  actionToastText: { overflow: "hidden", paddingHorizontal: 16, paddingVertical: 11, borderRadius: 18, backgroundColor: "#17221d", color: "#fff", fontSize: 12, fontWeight: "800", textAlign: "center" },
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
  mapPage: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 40, backgroundColor: "#f7f8f3" },
  mapBackButton: { width: 42, height: 42, borderWidth: 1, borderColor: "#dce5df", borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#f8fbf6" },
  mapHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  mapPageTitle: { marginTop: 2, color: "#17221d", fontSize: 30, lineHeight: 36, fontWeight: "900" },
  mapLocationButton: { minHeight: 44, justifyContent: "center", alignItems: "center", paddingHorizontal: 15, borderRadius: 14, borderWidth: 1, borderColor: "#176b48", backgroundColor: "#fff" },
  googleMapFrame: { height: 440, borderRadius: 24, overflow: "hidden", borderWidth: 1, borderColor: "#ced9ca", backgroundColor: "#e7eee6" },
  googleMap: { flex: 1, backgroundColor: "#e7eee6" },
  mapPrivacy: { marginTop: 14, padding: 14, borderRadius: 15, color: "#486052", backgroundColor: "#edf5ec", fontSize: 12, lineHeight: 19 },
  mapResultHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18, marginBottom: 10 },
  mapResultHeadingTitle: { color: "#17221d", fontSize: 19, fontWeight: "900" },
  mapResultHeadingCount: { color: "#176b48", fontSize: 12, fontWeight: "800" },
  mapResultCard: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 8, padding: 11, borderWidth: 1, borderColor: "#e3e7df", borderRadius: 16, backgroundColor: "#fff" },
  mapResultImage: { width: 42, height: 42, borderRadius: 12, backgroundColor: "#dfe6df" },
  mapResultCopy: { flex: 1, minWidth: 0 },
  mapResultTitle: { color: "#17221d", fontSize: 12, fontWeight: "900" },
  mapResultLocation: { marginTop: 5, color: "#6d766f", fontSize: 10 },
  mapResultMeta: { flexDirection: "row", alignItems: "center", maxWidth: 110 },
  mapResultTime: { color: "#6d766f", fontSize: 9 },
  mapResultChevron: { marginLeft: 3, color: "#6d766f", fontSize: 16 },
  authPage: { paddingHorizontal: 20, paddingTop: 35, paddingBottom: 50, backgroundColor: "#eef5eb" },
  authBrand: {
    textAlign: "center",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 8,
  },
  authVisual: { height: 110, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 },
  authVisualCard: { width: 64, height: 64, overflow: "hidden", borderRadius: 22, backgroundColor: "#fff", shadowColor: "#25372a", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 4 },
  authVisualCardRaised: { transform: [{ translateY: -18 }] },
  authVisualImage: { width: "100%", height: "100%" },
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
  authCard: { backgroundColor: "#fff", padding: 24, borderRadius: 26, shadowColor: "#25372a", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 4 },
  authChoiceCard: { backgroundColor: "#fff", padding: 24, borderRadius: 26, gap: 10, shadowColor: "#25372a", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 4 },
  authChoiceTitle: { color: "#17221d", fontSize: 24, fontWeight: "900", marginBottom: 6 },
  authLoginChoice: { minHeight: 62, justifyContent: "center", paddingHorizontal: 18, borderRadius: 16, backgroundColor: "#176b48" },
  authLoginChoiceText: { color: "#fff", fontSize: 17, fontWeight: "900" },
  authRegisterChoice: { minHeight: 62, justifyContent: "center", paddingHorizontal: 18, borderRadius: 16, backgroundColor: "#d9ff68", borderWidth: 2, borderColor: "#17221d" },
  authRegisterChoiceText: { color: "#17221d", fontSize: 17, fontWeight: "900" },
  authChoiceHint: { color: "#667069", fontSize: 10, fontWeight: "700", marginTop: 2 },
  authBackButton: { alignSelf: "flex-start", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, paddingHorizontal: 12, borderRadius: 22, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce5df" },
  authBackText: { color: "#176b48", fontSize: 12, fontWeight: "900" },
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
  profileActivityCard: { width: "100%", flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e3e7df", borderRadius: 15, padding: 10, marginBottom: 9 },
  profileActivityImage: { width: 62, height: 58, borderRadius: 11, backgroundColor: "#eaf1e9" },
  profileActivityImageFallback: { width: 62, height: 58, borderRadius: 11, backgroundColor: "#eaf1e9", alignItems: "center", justifyContent: "center" },
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
  xProviderButton: { minHeight: 54, backgroundColor: "#17221d", borderColor: "#17221d", shadowColor: "#17221d", shadowOpacity: 0.2, shadowRadius: 6, elevation: 2 },
  xProviderText: { color: "#fff" },
  providerButtonDisabled: { opacity: 0.55, backgroundColor: "#eef0ee" },
  providerMark: { width: 24, textAlign: "center", color: "#176b48", fontSize: 16, fontWeight: "900" },
  providerButtonText: { color: "#17221d", fontSize: 13, fontWeight: "900" },
  providerNote: { minHeight: 30, paddingTop: 7, color: "#59645d", fontSize: 11, textAlign: "center" },
  authSwitchButton: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 8, borderRadius: 15, borderWidth: 2, borderColor: "#176b48", backgroundColor: "#edf8f0" },
  authSwitch: { textAlign: "center", color: "#176b48", fontSize: 15, fontWeight: "900", padding: 12 },
  phoneHint: { color: "#59645d", fontSize: 10, marginTop: 7 },
  authAgreement: { marginTop: 16, color: "#737c75", fontSize: 10, textAlign: "center" },
  authPolicyLinks: { marginTop: 9, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 13 },
  authPolicyLink: { color: "#176b48", fontSize: 10, fontWeight: "800", textDecorationLine: "underline" },
  registrationPhotoRow: { marginTop: 10, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  registrationPhotoMain: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#dfe6df" },
  registrationPhoto: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#dfe6df" },
  hero: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 6 },
  eyebrow: { color: "#176b48", fontSize: 12, fontWeight: "900" },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "900",
    color: "#17221d",
    marginTop: 6,
  },
  locationButton: {
    flex: 1,
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
  homeMapButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center", borderRadius: 13, borderWidth: 1, borderColor: "#dfe5df", backgroundColor: "#fff" },
  homeMapPin: { width: 17, height: 17, borderRadius: 9, borderBottomRightRadius: 2, backgroundColor: "#ec5b54", transform: [{ rotate: "45deg" }], alignItems: "center", justifyContent: "center" },
  homeMapPinCenter: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  muted: { fontSize: 12, color: "#6d766f", marginTop: 3 },
  hotCountdown: { fontSize: 12, color: "#d95a34", fontWeight: "900", marginTop: 3 },
  farBadge: { color: "#b34b35", fontWeight: "900" },
  card: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e3e7df",
    borderRadius: 22,
    padding: 16,
    marginHorizontal: 14,
    marginBottom: 12,
    overflow: "hidden",
  },
  activityPhoto: {
    width: "auto",
    aspectRatio: 32 / 9,
    marginHorizontal: -16,
    marginTop: -16,
    marginBottom: 14,
    backgroundColor: "#dfe6df",
  },
  heartButton: { position: "absolute", zIndex: 2, top: 12, left: 12, minWidth: 58, height: 38, paddingHorizontal: 10, borderRadius: 19, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, backgroundColor: "#ffffffee" },
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
  cardHostPhoto: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#dfe6df" },
  cardHostFallback: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#e9f1e9" },
  cardHostInitial: { color: "#176b48", fontWeight: "900" },
  cardMatchWrap: { minWidth: 66, alignItems: "center", justifyContent: "center", paddingHorizontal: 9, paddingVertical: 7, borderRadius: 10, backgroundColor: "#e9f7ec" },
  cardMatchLabel: { color: "#6d766f", fontSize: 9, fontWeight: "800" },
  cardMatchScore: { color: "#176b48", fontSize: 12, fontWeight: "900" },
  status: {
    position: "absolute",
    zIndex: 2,
    top: 12,
    right: 12,
    fontSize: 10,
    fontWeight: "900",
    color: "#176b48",
    backgroundColor: "#e9f7ec",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
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
  homeActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  homeAreaPicker: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: "#e3e7df", backgroundColor: "#fff" },
  homeAreaChoiceText: { color: "#17221d", fontSize: 11, fontWeight: "800" },
  homeAreaChevron: { color: "#687169", fontSize: 16, fontWeight: "900" },
  createButton: {
    backgroundColor: "#176b48",
    width: "100%",
    minHeight: 50,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 15,
  },
  detailLink: { fontSize: 11, color: "#176b48", fontWeight: "900" },
  createPage: { flex: 1, backgroundColor: "#f7f8f3" },
  createHeader: { minHeight: 68, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#dfe5df", backgroundColor: "#fff" },
  createBackButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#f7faf7", borderWidth: 1, borderColor: "#dce5df" },
  createHeaderHeading: { alignItems: "center" },
  createHeaderEyebrow: { color: "#687169", fontSize: 10, fontWeight: "800", marginBottom: 2 },
  createHeaderTitle: { color: "#17221d", fontSize: 17, fontWeight: "900" },
  createHeaderSpacer: { width: 44, height: 44 },
  createScroll: { flex: 1 },
  formPage: { padding: 20, paddingBottom: 32, backgroundColor: "#f7f8f3" },
  createFooter: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#dfe5df", backgroundColor: "#fff" },
  createCancelButton: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, borderWidth: 1, borderColor: "#d8e0da", backgroundColor: "#f7faf6" },
  createCancelText: { color: "#536058", fontSize: 15, fontWeight: "800" },
  createPublishButton: { flex: 1.4, minHeight: 52, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#176b48" },
  createAreaGrid: { flexDirection: "row", gap: 8 },
  createAreaChoice: { flex: 1, minHeight: 46, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#dfe5df", borderRadius: 13, backgroundColor: "#fff" },
  createAreaChoiceOn: { borderColor: "#176b48", backgroundColor: "#d9ff68" },
  createAreaChoiceText: { color: "#59635c", fontSize: 13, fontWeight: "800" },
  createAreaChoiceTextOn: { color: "#17221d", fontWeight: "900" },
  createMapActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  createMapAction: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 7, borderWidth: 1, borderColor: "#176b48", borderRadius: 12, backgroundColor: "#fff" },
  createMapActionText: { color: "#176b48", fontSize: 10, fontWeight: "800", textAlign: "center" },
  createMapHelp: { marginTop: 7, color: "#657069", fontSize: 10, lineHeight: 15 },
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
  choiceText: { color: "#17221d", fontSize: 12, fontWeight: "800", textAlign: "center" },
  multiline: { minHeight: 90, textAlignVertical: "top" },
  disabled: { opacity: 0.45 },
  detailPhoto: {
    width: "100%",
    height: 220,
    borderRadius: 16,
    marginBottom: 16,
    backgroundColor: "#dfe6df",
  },
  detailHeader: { height: 62, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff", borderBottomWidth: 1, borderColor: "#e5e9e5" },
  detailBackButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#f7faf7", borderWidth: 1, borderColor: "#dce5df" },
  detailHeaderTitle: { color: "#17221d", fontSize: 17, fontWeight: "900" },
  detailHeaderSpacer: { width: 44, height: 44 },
  participantDetailPage: { flex: 1, backgroundColor: "#fff" },
  participantDetailContent: { paddingBottom: 32, backgroundColor: "#fff" },
  participantHeroWrap: { position: "relative" },
  participantHeroPhoto: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#dfe6df" },
  participantState: { position: "absolute", right: 14, bottom: 12, overflow: "hidden", paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: "#e9f7ec", color: "#176b48", fontSize: 11, fontWeight: "900" },
  participantDetailBody: { paddingHorizontal: 20, paddingTop: 16 },
  participantHostRow: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 14 },
  participantHostName: { color: "#17221d", fontSize: 14, fontWeight: "900" },
  participantHostMeta: { marginTop: 3, color: "#6d766f", fontSize: 11 },
  participantTimeRow: { flexDirection: "row", alignItems: "center", marginBottom: 7 },
  participantTime: { color: "#176b48", fontSize: 12, fontWeight: "900" },
  participantTitle: { color: "#17221d", fontSize: 27, lineHeight: 33, fontWeight: "900" },
  participantDescription: { marginTop: 10, color: "#4f5a53", fontSize: 14, lineHeight: 21 },
  participantTalkButton: { minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 18, borderRadius: 15, backgroundColor: "#176b48" },
  participantTalkButtonText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  participantConditionPanel: { marginTop: 18, padding: 14, borderRadius: 15, borderWidth: 1, borderColor: "#dfe5df", backgroundColor: "#f7f8f3" },
  participantPanelLabel: { color: "#687169", fontSize: 10, fontWeight: "800" },
  participantConditionText: { marginTop: 5, color: "#17221d", fontSize: 15, fontWeight: "900" },
  participantInfoPanel: { marginTop: 14, padding: 15, borderRadius: 17, backgroundColor: "#f7f8f3", gap: 9 },
  participantInfoText: { color: "#344039", fontSize: 13, lineHeight: 19 },
  participantInfoLabel: { color: "#17221d", fontWeight: "900" },
  participantPrivacyText: { marginTop: 3, color: "#176b48", fontSize: 11, fontWeight: "800" },
  participantNavigationButton: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 12, borderWidth: 1, borderColor: "#b9d6c4", borderRadius: 14, backgroundColor: "#edf8f0" },
  participantNavigationText: { color: "#176b48", fontSize: 14, fontWeight: "900" },
  participantAttendancePanel: { marginTop: 14, padding: 15, borderRadius: 17, borderWidth: 1, borderColor: "#dfe5df", backgroundColor: "#fff" },
  participantMembersPanel: { marginTop: 18, padding: 16, borderRadius: 18, borderWidth: 1, borderColor: "#dfe5df", backgroundColor: "#fff" },
  participantDetailFooter: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderTopColor: "#dfe5df", backgroundColor: "#fff" },
  participantJoinButton: { minHeight: 54, alignItems: "center", justifyContent: "center", borderRadius: 17, backgroundColor: "#176b48" },
  eligibilityNote: { marginBottom: 8, color: "#9a5c27", fontSize: 11, textAlign: "center" },
  hostRequestPanel: { marginTop: 20, padding: 16, borderWidth: 1, borderColor: "#dfe5df", borderRadius: 18, backgroundColor: "#f8faf7" },
  hostRequestHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  hostRequestTitle: { marginTop: 3, color: "#17221d", fontSize: 17, fontWeight: "900" },
  hostRequestBadge: { overflow: "hidden", paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: "#fff0e8", color: "#a94b28", fontSize: 9, fontWeight: "900" },
  hostRequestCard: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#e3e7df" },
  hostRequestPerson: { flexDirection: "row", alignItems: "center", gap: 10 },
  hostRequestMessage: { marginVertical: 10, color: "#6d766f", fontSize: 12, lineHeight: 18 },
  requestResult: { alignSelf: "flex-start", overflow: "hidden", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#e9f7ec", color: "#176b48", fontSize: 10, fontWeight: "900" },
  hostOwnerActions: { marginTop: 20, gap: 10 },
  hostStartButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, backgroundColor: "#176b48" },
  hostFinishButton: { minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 15, borderWidth: 1, borderColor: "#efcfad", backgroundColor: "#fff3e6" },
  hostFinishButtonText: { color: "#a95617", fontSize: 15, fontWeight: "900" },
  detailScroll: { flex: 1, backgroundColor: "#fff" },
  detailPage: { padding: 20, paddingBottom: 60, backgroundColor: "#fff" },
  detailHostRow: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e3e8e2", marginBottom: 12 },
  detailHostPhoto: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#dfe6df" },
  detailHostPhotoFallback: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#176b48" },
  distanceWarning: { padding: 12, borderRadius: 13, color: "#8a5315", backgroundColor: "#fff3d9", fontSize: 12, fontWeight: "700", marginBottom: 12 },
  startDisabledNote: { marginTop: -8, color: "#737c75", fontSize: 11, textAlign: "center" },
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
  applicantSheetHandle: { width: 42, height: 5, marginBottom: 18, borderRadius: 3, backgroundColor: "#b8c0ba" },
  applicantModalHeader: { width: "100%", minHeight: 44, marginBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  applicantModalBack: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  applicantModalTitle: { color: "#17221d", fontSize: 15, fontWeight: "900" },
  applicantModalHeaderSpacer: { width: 44, height: 44 },
  applicantPhotoHint: { marginTop: 9, color: "#176b48", fontSize: 10, fontWeight: "800" },
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
  applicantVerification: {
    marginTop: 7,
    color: "#176b48",
    fontSize: 12,
    fontWeight: "800",
  },
  applicantDetails: { width: "100%", marginTop: 18, borderRadius: 16, backgroundColor: "#fff", paddingHorizontal: 16 },
  applicantDetailRow: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#edf0eb" },
  applicantDetailLabel: { color: "#69726b", fontSize: 12, fontWeight: "800" },
  applicantDetailValue: { color: "#17221d", fontSize: 13, fontWeight: "900" },
  applicantSectionTitle: { width: "100%", marginTop: 18, color: "#17221d", fontSize: 15, fontWeight: "900" },
  applicantBio: {
    width: "100%",
    marginTop: 8,
    color: "#4f5952",
    lineHeight: 21,
    textAlign: "left",
  },
  applicantInterests: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: 7,
    width: "100%",
    marginTop: 10,
  },
  applicantPrivacyNote: {
    marginTop: 20,
    color: "#788079",
    fontSize: 10,
    textAlign: "center",
  },
  applicantDismissHint: { marginTop: 18, color: "#6d766f", fontSize: 11, fontWeight: "800" },
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
  chatListScroll: { flex: 1 },
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
  messageListView: { flex: 1 },
  messageList: { flexGrow: 1, paddingHorizontal: 11, paddingTop: 14, paddingBottom: 16 },
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
  quickMessageScroller: { flexGrow: 0, flexShrink: 0, height: 42, backgroundColor: "#fff", borderTopWidth: 1, borderColor: "#edf0eb" },
  quickMessageRow: { alignItems: "center", gap: 6, paddingHorizontal: 12 },
  quickMessageButton: { height: 28, alignSelf: "center", justifyContent: "center", paddingHorizontal: 10, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#dce5df" },
  quickMessageText: { color: "#176b48", fontSize: 10, fontWeight: "800" },
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
  profileChatButton: { marginTop: 12, width: "100%", minHeight: 52, paddingHorizontal: 22, borderRadius: 15, backgroundColor: "#edf8f0", borderWidth: 1, borderColor: "#b9d6c4", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  profileChatButtonIcon: { color: "#176b48", fontSize: 10 },
  profileChatButtonText: { color: "#176b48", fontSize: 16, fontWeight: "900" },
  profileEditorPage: { flex: 1, backgroundColor: "#f7f8f3" },
  profileEditorHeader: { minHeight: 68, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: "#dfe5df", backgroundColor: "#fff" },
  profileEditorBackButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#f7faf7", borderWidth: 1, borderColor: "#dce5df" },
  profileEditorHeaderSpacer: { width: 44, height: 44 },
  profileEditorTitle: { fontSize: 16, fontWeight: "900", color: "#17221d" },
  profileEditorHeading: { alignItems: "center" },
  profileEditorEyebrow: { color: "#687169", fontSize: 9, fontWeight: "800", marginBottom: 2 },
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
  matchChoiceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  matchChoiceGridWide: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  matchWeekGrid: { flexDirection: "row", gap: 5, marginTop: 8 },
  matchChoice: { minHeight: 44, minWidth: "30%", flexGrow: 1, flexBasis: "30%", alignItems: "center", justifyContent: "center", paddingHorizontal: 7, paddingVertical: 8, borderWidth: 1, borderColor: "#d9dfd9", borderRadius: 13, backgroundColor: "#fff" },
  matchWeekChoice: { minWidth: 0, flexBasis: 0, paddingHorizontal: 1 },
  matchChoiceSelected: { borderColor: "#176b48", backgroundColor: "#d9ff68" },
  matchChoiceText: { color: "#344039", fontSize: 12, fontWeight: "800", textAlign: "center" },
  matchChoiceTextSelected: { color: "#17221d" },
  matchChoiceSubtitle: { marginTop: 13, color: "#59625c", fontSize: 12, fontWeight: "800" },
  matchCustomInput: { marginTop: 9, backgroundColor: "#fafbf9" },
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
  hostRankNext: { fontSize: 11, fontStyle: "italic", fontWeight: "900", color: "#d9ff68", marginTop: 8 },
  profileStats: { width: "100%", flexDirection: "row", borderRadius: 18, overflow: "hidden", backgroundColor: "#fff", borderWidth: 1, borderColor: "#e3e8e2", marginTop: 14 },
  profileStat: { flex: 1, alignItems: "center", paddingVertical: 13, borderRightWidth: 1, borderColor: "#edf0ec" },
  profileStatValue: { color: "#17221d", fontSize: 16, fontWeight: "900" },
  profileStatLabel: { marginTop: 3, color: "#737c75", fontSize: 8, fontWeight: "700" },
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
  inlineRatingPanel: { marginTop: 18, padding: 16, borderWidth: 1, borderColor: "#dfe5df", borderRadius: 18, backgroundColor: "#f7f8f3" },
  inlineRatingTitle: { marginTop: 5, color: "#17221d", fontSize: 18, fontWeight: "900" },
  inlineRatingDescription: { marginTop: 7, marginBottom: 12, color: "#59635c", fontSize: 12, lineHeight: 18 },
  inlineRatingCard: { marginBottom: 10, padding: 13, borderWidth: 1, borderColor: "#e3e7df", borderRadius: 15, backgroundColor: "#fff" },
  inlineRatingDone: { minHeight: 50, alignItems: "center", justifyContent: "center", marginTop: 4, borderRadius: 15, backgroundColor: "#176b48" },
  talkListSummary: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  talkListTitle: { color: "#17221d", fontSize: 20, fontWeight: "900" },
  talkListCounts: { color: "#687169", fontSize: 10, fontWeight: "800" },
  roomType: { marginLeft: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, overflow: "hidden", backgroundColor: "#e9f7ec", color: "#176b48", fontSize: 8, fontWeight: "900" },
  roomStatus: { marginLeft: 6, color: "#687169", fontSize: 9, fontWeight: "800" },
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
  editHangoutHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#f7f8f3", borderBottomWidth: 1, borderBottomColor: "#e2e7e1" },
  editHangoutForm: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 32, gap: 10 },
  editImageActions: { flexDirection: "row", gap: 10 },
  editHangoutFooter: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#dfe5df" },
  editFooterCancel: { flex: 1, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#e7ede7" },
  editFooterCancelText: { color: "#344039", fontWeight: "900" },
  editFooterSave: { flex: 1.4, minHeight: 50, alignItems: "center", justifyContent: "center", borderRadius: 16, backgroundColor: "#176b48" },
  phoneSheetScreen: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(18,30,24,0.35)" },
  phoneSheetBackdrop: { ...StyleSheet.absoluteFillObject },
  phoneSheetPanel: { maxHeight: "88%", paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f7f8f3" },
  phoneSheetHandle: { alignSelf: "center", width: 42, height: 5, marginBottom: 8, borderRadius: 3, backgroundColor: "#b7c0b9" },
  phoneSheetContent: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 24, gap: 10 },
  confirmSheetScreen: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(18,30,24,0.42)" },
  confirmSheetPanel: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f7f8f3", gap: 12 },
  confirmSheetTitle: { color: "#17221d", fontSize: 24, lineHeight: 31, fontWeight: "900" },
  reportSheetPanel: { maxHeight: "94%", borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f7f8f3" },
  reportSheetContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 24, gap: 10 },
  reportReasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  reportReasonChoice: { minHeight: 40, justifyContent: "center", paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#eef1ed" },
  reportReasonText: { color: "#344039", fontSize: 12, fontWeight: "800" },
  reportBlockChoice: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#fff" },
  reportBlockText: { color: "#344039", fontWeight: "800" },
  matchFeedbackSheet: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 26, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f7f8f3", gap: 12 },
  matchFeedbackReasonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  matchFeedbackReasonButton: { minHeight: 44, justifyContent: "center", paddingHorizontal: 14, borderRadius: 16, backgroundColor: "#eef1ed", borderWidth: 1, borderColor: "#dfe5df" },
  matchFeedbackReasonText: { color: "#344039", fontSize: 12, fontWeight: "800" },
  ratingSheetScreen: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(18,30,24,0.35)" },
  ratingSheetPanel: { maxHeight: "94%", paddingTop: 10, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f7f8f3" },
  datePickerButton: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: "#d8ded8", backgroundColor: "#fff" },
  datePickerButtonText: { color: "#17221d", fontSize: 16, fontWeight: "700" },
  datePickerChevron: { color: "#687169", fontSize: 24 },
  datePickerModal: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(18,30,24,0.4)" },
  datePickerPanel: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: "#f7f8f3", gap: 12 },
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
  filterPill: { minHeight: 42, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: "#dfe5df", backgroundColor: "#fff" },
  filterPillOn: { backgroundColor: "#17221d", borderColor: "#17221d" },
  filterPillText: { color: "#59635c", fontSize: 12, fontWeight: "800" },
  filterPillTextOn: { color: "#fff" },
  notificationScreen: { flex: 1, backgroundColor: "#f7f8f3" },
  notificationPage: { paddingHorizontal: 16, paddingTop: 0, paddingBottom: 80, gap: 8 },
  notificationHead: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: "#f7f8f3" },
  notificationHeadTitle: { flex: 1, alignItems: "flex-start" },
  notificationHeadEyebrow: { color: "#176b48", fontSize: 10, fontWeight: "900" },
  notificationHeadText: { marginTop: 2, color: "#17221d", fontSize: 17, fontWeight: "900" },
  notificationHeadSpacer: { width: 42 },
  notificationSettings: { marginBottom: 6, padding: 14, borderRadius: 17, backgroundColor: "#fff" },
  notificationSettingRow: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 12 },
  notificationSettingTitle: { color: "#17221d", fontSize: 13, fontWeight: "800" },
  notificationCheckbox: { width: 22, height: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#bfc8c1", borderRadius: 5, backgroundColor: "#fff" },
  notificationCheckboxOn: { borderColor: "#176b48", backgroundColor: "#176b48" },
  notificationCheckmark: { color: "#fff", fontSize: 14, fontWeight: "900" },
  notificationActions: { flexDirection: "row", alignItems: "stretch", gap: 5 },
  deviceNotificationsButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderWidth: 1, borderColor: "#dce2dc", borderRadius: 12, backgroundColor: "#fff" },
  deviceNotificationsText: { color: "#17221d", fontSize: 10, fontWeight: "800", textAlign: "center" },
  readAllButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderWidth: 1, borderColor: "#dce2dc", borderRadius: 12, backgroundColor: "#fff" },
  readAllButtonText: { color: "#17221d", fontSize: 10, fontWeight: "800", textAlign: "center" },
  deleteNotificationsButton: { flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 5, borderWidth: 1, borderColor: "#f0c7bf", borderRadius: 12, backgroundColor: "#fff3f0" },
  deleteNotificationsText: { color: "#a53b2c", fontSize: 10, fontWeight: "800", textAlign: "center" },
  approvedMemberRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 8, borderBottomWidth: 1, borderColor: "#e7ebe6" },
  approvedMemberPhoto: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#dfe6df" },
  approvedMemberPhotoFallback: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#176b48" },
  approvedMemberInitial: { color: "#fff", fontWeight: "900" },
  photoViewerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  photoViewerSwipeContent: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  photoViewerHandle: { position: "absolute", top: 28, width: 44, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.7)" },
  photoViewerDismissHint: { position: "absolute", top: 43, color: "#fff", fontSize: 11, fontWeight: "800" },
  photoViewerImage: { width: "100%", height: "72%" },
  photoViewerControls: { position: "absolute", bottom: 54, flexDirection: "row", alignItems: "center", gap: 24 },
  photoViewerControl: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.18)" },
  photoViewerControlText: { color: "#fff", fontSize: 38, lineHeight: 42 },
  photoViewerCount: { color: "#fff", fontSize: 13, fontWeight: "800" },
  notificationItem: { width: "100%", padding: 13, borderRadius: 15, backgroundColor: "#fff", borderWidth: 1, borderColor: "#e3e7df" },
  notificationItemUnread: { borderLeftWidth: 5, borderLeftColor: "#176b48", backgroundColor: "#f6fff8" },
  notificationItemCopy: { flex: 1, gap: 4 },
  notificationItemTitle: { color: "#17221d", fontSize: 13, fontWeight: "900" },
  notificationItemBody: { color: "#4f5a52", fontSize: 12, lineHeight: 18 },
  notificationItemTime: { color: "#8a928c", fontSize: 9 },
});
