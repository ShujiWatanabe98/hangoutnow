import { readFileSync } from 'node:fs';

const baseUrl = process.env.HANGOUTNOW_API_URL || 'https://hangoutnow-api.onrender.com';
const demoUrl = process.env.HANGOUTNOW_DEMO_URL || 'https://hangoutnow-demo.onrender.com';
const password = process.env.HANGOUTNOW_DEMO_PASSWORD || 'HangoutNow-Demo-2026!';
const hostPhoto = `data:image/jpeg;base64,${readFileSync(new URL('../apps/demo/public/assets/demo-guest-profile.jpg', import.meta.url)).toString('base64')}`;
const guestPhoto = `data:image/jpeg;base64,${readFileSync(new URL('../apps/demo/public/assets/demo-host-profile.jpg', import.meta.url)).toString('base64')}`;

const accounts = {
  host: {
    email: process.env.HANGOUTNOW_DEMO_HOST_EMAIL || 'demo-host@hangoutnow.example',
    displayName: 'ミサキ（デモ主催者）',
    phone: '+819011110001',
    birthDate: '1988-04-12',
    gender: 'FEMALE',
    homeArea: '新宿',
    interests: ['カフェ', 'ラーメン', 'ランニング'],
    bio: 'カフェ巡りとランニングが好きです。これは公開デモ用の架空プロフィールです。',
    profilePhoto: hostPhoto,
  },
  guest: {
    email: process.env.HANGOUTNOW_DEMO_GUEST_EMAIL || 'demo-guest@hangoutnow.example',
    displayName: 'ユウキ（デモ参加者）',
    phone: '+819011110002',
    birthDate: '1993-09-20',
    gender: 'MALE',
    homeArea: '渋谷',
    interests: ['カフェ', '街歩き', '写真'],
    bio: '気軽に参加できるHangoutを探しています。これは公開デモ用の架空プロフィールです。',
    profilePhoto: guestPhoto,
  },
};

async function call(path, options = {}, token, allowedStatuses = []) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok && !allowedStatuses.includes(response.status)) {
    throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text}`);
  }
  return { status: response.status, body };
}

async function loginOrRegister(account) {
  const login = await call('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: account.email, password }),
  }, undefined, [401]);

  let session = login.body;
  let created = false;
  if (login.status === 401) {
    const registration = await call('/auth/register', {
      method: 'POST',
      body: JSON.stringify({
        email: account.email,
        password,
        displayName: account.displayName,
        birthDate: account.birthDate,
      }),
    });
    session = registration.body;
    created = true;
  }

  const token = session.accessToken;
  let user = await call('/users/me', {}, token).then((result) => result.body);
  user = await call('/users/me', {
    method: 'PATCH',
    body: JSON.stringify({
      displayName: account.displayName,
      gender: account.gender,
      profilePhoto: account.profilePhoto,
      bio: account.bio,
      homeArea: account.homeArea,
      interests: account.interests,
    }),
  }, token).then((result) => result.body);

  if (user.verificationStatus !== 'PHONE_VERIFIED') {
    const verification = await call('/users/me/phone/request', {
      method: 'POST',
      body: JSON.stringify({ phone: account.phone }),
    }, token);
    if (!verification.body.demoCode) {
      throw new Error(`Demo verification code was not returned for ${account.email}`);
    }
    user = await call('/users/me/phone/confirm', {
      method: 'POST',
      body: JSON.stringify({ phone: account.phone, code: verification.body.demoCode }),
    }, token).then((result) => result.body);
  }

  return { ...account, id: user.id, token, created };
}

const host = await loginOrRegister(accounts.host);
const guest = await loginOrRegister(accounts.guest);
const samples = [
  {
    title: '【デモ手順】新宿カフェ交流会',
    description: '作成・参加申請・承認・グループチャット・終了・相互★5・1対1チャットまで確認する公開デモ用の架空イベントです。',
    category: 'CAFE', serviceArea: 'SHINJUKU', startInMinutes: 180, publicLocationName: '新宿駅周辺（デモ）', locationName: 'デモカフェ新宿店 東京都新宿区新宿3-1-1',
    latitude: 35.6901, longitude: 139.7005, maxParticipants: 4, genderRestriction: 'ANY', maxAge: 39,
  },
  {
    title: '代々木公園をゆっくりランニング',
    description: '会話できるペースで約5km走ります。初心者も歓迎する架空の募集です。',
    category: 'RUNNING', serviceArea: 'SHINJUKU', startInMinutes: 60, publicLocationName: '代々木公園周辺（デモ）', locationName: '代々木公園 原宿門 東京都渋谷区代々木神園町2-1',
    latitude: 35.6717, longitude: 139.6949, maxParticipants: 6, genderRestriction: 'FEMALE_ONLY', maxAge: 39,
  },
  {
    title: '新宿で話題のラーメンを食べよう',
    description: '気になっていたラーメン店へ一緒に行く、公開デモ用の架空募集です。',
    category: 'FOOD', serviceArea: 'SHINJUKU', startInMinutes: 30, publicLocationName: '新宿駅東口周辺（デモ）', locationName: 'デモラーメン新宿店 東京都新宿区歌舞伎町1-2-3',
    latitude: 35.6920, longitude: 139.7038, maxParticipants: 4, genderRestriction: 'MALE_ONLY', maxAge: 59,
  },
  {
    title: '夕方のショートツーリング',
    description: '安全第一で景色を楽しむ、公開デモ用の架空ツーリング募集です。',
    category: 'MOTORCYCLE', serviceArea: 'SHIBUYA', startInMinutes: 180, publicLocationName: '渋谷駅周辺（デモ）', locationName: '渋谷区立宮下公園 東京都渋谷区神宮前6-20-10',
    latitude: 35.6437, longitude: 139.6816, maxParticipants: 5, genderRestriction: 'ANY', maxAge: 59,
  },
  {
    title: '渋谷で気軽に街歩き',
    description: '写真を撮りながらゆっくり散策する、公開デモ用の架空募集です。',
    category: 'WALKING', serviceArea: 'SHIBUYA', startInMinutes: 60, publicLocationName: '渋谷駅周辺（デモ）', locationName: '渋谷区立宮下公園 南入口 東京都渋谷区渋谷1-26-5',
    latitude: 35.6580, longitude: 139.7016, maxParticipants: 5, genderRestriction: 'ANY',
  },
];

let hangouts = await call('/hangouts?latitude=35.69&longitude=139.70&radiusKm=20', {}, host.token)
  .then((result) => result.body);
const seededHangouts = [];
for (const sample of samples) {
  const addressIndex = sample.locationName.indexOf(' 東京都');
  const meetingPlaceName = addressIndex > 0 ? sample.locationName.slice(0, addressIndex) : sample.locationName;
  const meetingAddress = addressIndex > 0 ? sample.locationName.slice(addressIndex + 1) : sample.locationName;
  const navigationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${meetingPlaceName} ${meetingAddress}`)}`;
  const currentSample = { ...sample, meetingPlaceName, meetingAddress, navigationUrl, hostMaleCount: 0, hostFemaleCount: 1 };
  let item = hangouts.find((candidate) => candidate.hostUserId === host.id && candidate.title === sample.title && ['OPEN', 'FULL'].includes(candidate.status));
  if (!item) {
    item = await call('/hangouts', {
      method: 'POST', body: JSON.stringify(currentSample),
    }, host.token).then((result) => result.body);
    hangouts.push(item);
  } else {
    item = await call(`/hangouts/${item.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        title: sample.title,
        description: sample.description,
        publicLocationName: sample.publicLocationName,
        locationName: sample.locationName,
        meetingPlaceName,
        meetingAddress,
        navigationUrl,
        hostMaleCount: 0,
        hostFemaleCount: 1,
        genderRestriction: sample.genderRestriction,
        maxAge: sample.maxAge ?? null,
      }),
    }, host.token).then((result) => result.body);
  }
  seededHangouts.push(item);
}
const hangout = seededHangouts[0];

const guestView = await call(`/hangouts/${hangout.id}`, {}, guest.token).then((result) => result.body);
let joinStatus = guestView.myJoinStatus;
if (!joinStatus) {
  const request = await call(`/hangouts/${hangout.id}/join`, {
    method: 'POST',
    body: JSON.stringify({ message: 'デモ参加者です。参加をお願いします！' }),
  }, guest.token).then((result) => result.body);
  await call(`/join-requests/${request.id}/accept`, { method: 'POST', body: '{}' }, host.token);
  joinStatus = 'ACCEPTED';
} else if (joinStatus === 'PENDING') {
  const requests = await call(`/hangouts/${hangout.id}/requests`, {}, host.token).then((result) => result.body);
  const request = requests.find((item) => item.user.id === guest.id && item.status === 'PENDING');
  if (request) await call(`/join-requests/${request.id}/accept`, { method: 'POST', body: '{}' }, host.token);
  joinStatus = 'ACCEPTED';
}

const rooms = await call('/chat-rooms', {}, guest.token).then((result) => result.body);
const room = rooms.find((item) => item.hangoutId === hangout.id);
if (!room) throw new Error('Demo chat room was not created');
const messages = await call(`/chat-rooms/${room.id}/messages`, {}, guest.token).then((result) => result.body);
if (!messages.some((message) => message.body === 'こんにちは！デモチャットへようこそ。')) {
  await call(`/chat-rooms/${room.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'こんにちは！デモチャットへようこそ。' }),
  }, host.token);
}

for (const account of [host, guest]) {
  const stamps = await call('/stamps', {}, account.token).then((result) => result.body);
  for (const text of ['向かってます', '少し遅れます', '到着']) {
    if (!stamps.some((stamp) => stamp.text === text)) {
      await call('/stamps', { method: 'POST', body: JSON.stringify({ text }) }, account.token);
    }
  }
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  demoUrl,
  host: { email: host.email, password, created: host.created },
  guest: { email: guest.email, password, created: guest.created },
  hangouts: seededHangouts.map((item) => ({ id: item.id, title: item.title, category: item.category })),
  primaryHangout: { id: hangout.id, title: hangout.title, joinStatus, genderRestriction: 'ANY', maxAge: 39 },
  chat: { roomId: room.id, ready: true, personalStamps: ['向かってます', '少し遅れます', '到着'] },
  walkthrough: [
    '主催者で新しいHangoutを作成',
    '参加者へ役割を切り替えて参加申請',
    '主催者へ戻って申請を承認',
    '双方で写真付きグループチャットとスタンプを確認',
    '主催者がHangoutを終了して参加者へ★5',
    '参加者も主催者へ★5を付け、1対1チャットを開始',
  ],
}, null, 2)}\n`);
