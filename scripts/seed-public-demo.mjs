const baseUrl = process.env.HANGOUTNOW_API_URL || 'https://hangoutnow-api.onrender.com';
const demoUrl = process.env.HANGOUTNOW_DEMO_URL || 'https://hangoutnow-demo.onrender.com';
const password = process.env.HANGOUTNOW_DEMO_PASSWORD || 'HangoutNow-Demo-2026!';
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z6nAAAAAASUVORK5CYII=';

const accounts = {
  host: {
    email: process.env.HANGOUTNOW_DEMO_HOST_EMAIL || 'demo-host@hangoutnow.example',
    displayName: 'ユウキ（デモ主催者）',
    phone: '+819011110001',
    bio: 'カフェ巡りとランニングが好きです。これは公開デモ用の架空プロフィールです。',
  },
  guest: {
    email: process.env.HANGOUTNOW_DEMO_GUEST_EMAIL || 'demo-guest@hangoutnow.example',
    displayName: 'ミサキ（デモ参加者）',
    phone: '+819011110002',
    bio: '気軽に参加できるHangoutを探しています。これは公開デモ用の架空プロフィールです。',
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
        birthDate: '1990-01-01',
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
      profilePhoto: photo,
      bio: account.bio,
      homeArea: '新宿・渋谷',
      interests: ['カフェ', 'ランニング', 'デモ'],
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
const title = '新宿でデモカフェ交流会';

let hangouts = await call('/hangouts?latitude=35.69&longitude=139.70&radiusKm=20', {}, host.token)
  .then((result) => result.body);
let hangout = hangouts.find((item) => item.hostUserId === host.id && item.title === title && ['OPEN', 'FULL'].includes(item.status));

if (!hangout) {
  hangout = await call('/hangouts', {
    method: 'POST',
    body: JSON.stringify({
      title,
      description: '公開デモ用の架空イベントです。参加申請とチャットを自由にお試しください。',
      category: 'CAFE',
      startInMinutes: 180,
      locationName: '新宿駅周辺（デモ）',
      latitude: 35.6901,
      longitude: 139.7005,
      maxParticipants: 4,
    }),
  }, host.token).then((result) => result.body);
}

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

process.stdout.write(`${JSON.stringify({
  ok: true,
  demoUrl,
  host: { email: host.email, password, created: host.created },
  guest: { email: guest.email, password, created: guest.created },
  hangout: { id: hangout.id, title: hangout.title, joinStatus },
  chat: { roomId: room.id, ready: true },
}, null, 2)}\n`);
