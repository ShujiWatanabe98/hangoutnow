import { readFileSync } from 'node:fs';

const baseUrl = process.env.HANGOUTNOW_API_URL || 'https://hangoutnow-api.onrender.com';
const demoUrl = process.env.HANGOUTNOW_DEMO_URL || 'https://hangoutnow-demo.onrender.com';
const password = process.env.HANGOUTNOW_DEMO_PASSWORD || 'HangoutNow-Demo-2026!';
const hostPhotos = [
  'demo-mami-profile-main.jpg',
  'demo-mami-profile-left.jpg',
  'demo-mami-profile-right.jpg',
].map((name) => `data:image/jpeg;base64,${readFileSync(new URL(`../apps/demo/public/assets/${name}`, import.meta.url)).toString('base64')}`);
const guestPhotos = [
  'demo-madoka-profile-main.jpg',
  'demo-madoka-profile-left.jpg',
  'demo-madoka-profile-right.jpg',
].map((name) => `data:image/jpeg;base64,${readFileSync(new URL(`../apps/demo/public/assets/${name}`, import.meta.url)).toString('base64')}`);
const masayaPhoto = `data:image/jpeg;base64,${readFileSync(new URL('../apps/demo/public/assets/demo-masaya-profile.jpg', import.meta.url)).toString('base64')}`;
const kentaPhoto = `data:image/jpeg;base64,${readFileSync(new URL('../apps/demo/public/assets/demo-host-profile.jpg', import.meta.url)).toString('base64')}`;
const aoiPhoto = `data:image/jpeg;base64,${readFileSync(new URL('../apps/demo/public/assets/demo-guest-profile.jpg', import.meta.url)).toString('base64')}`;
const hangoutPhoto = (name) => `data:image/jpeg;base64,${readFileSync(new URL(`../apps/demo/public/assets/${name}`, import.meta.url)).toString('base64')}`;
const ramenPhoto = hangoutPhoto('hangout-ramen.jpg');
const runningPhoto = `data:image/jpeg;base64,${readFileSync(new URL('../apps/demo/public/assets/demo-running-hangout-v2.jpg', import.meta.url)).toString('base64')}`;
const cafePhoto = hangoutPhoto('hangout-coffee.jpg');
const touringPhoto = hangoutPhoto('hangout-bike.jpg');
const drinkingPhoto = hangoutPhoto('hangout-nomikai.jpg');
const imageByCategory = {
  FOOD: ramenPhoto,
  DRINKING: drinkingPhoto,
  WINE: hangoutPhoto('hangout-bar.jpg'),
  CAFE: cafePhoto,
  BAR: hangoutPhoto('hangout-bar.jpg'),
  IZAKAYA: drinkingPhoto,
  YAKINIKU: hangoutPhoto('hangout-yakiniku.jpg'),
  SWEETS: hangoutPhoto('hangout-sweet.jpg'),
  DARTS: hangoutPhoto('hangout-dartu.jpg'),
  GAME: hangoutPhoto('hangout-boardgame.jpg'),
  SHISHA: hangoutPhoto('hangout-si-sha.jpg'),
  ENGLISH: hangoutPhoto('hangout-english.jpg'),
  DINNER: hangoutPhoto('hangout-gohan.jpg'),
  WALKING: hangoutPhoto('hangout-sanpo.jpg'),
  YOGA: runningPhoto,
  CYCLING: touringPhoto,
  BOWLING: hangoutPhoto('hangout-dartu.jpg'),
  ARCADE: hangoutPhoto('hangout-boardgame.jpg'),
  SOCIAL: hangoutPhoto('hangout-english.jpg'),
  PICNIC: hangoutPhoto('hangout-sanpo.jpg'),
  SAUNA: hangoutPhoto('hangout-movie.jpg'),
  NIGHT_VIEW: hangoutPhoto('hangout-movie.jpg'),
  WATERFRONT: hangoutPhoto('hangout-sanpo.jpg'),
  MUSIC: hangoutPhoto('hangout-movie.jpg'),
};

const accounts = {
  host: {
    email: process.env.HANGOUTNOW_DEMO_HOST_EMAIL || 'demo-host@hangoutnow.example',
    displayName: 'サヤカ',
    phone: '+819011110001',
    birthDate: '1989-04-12',
    gender: 'FEMALE',
    homeArea: '新宿',
    interests: ['飲み会', 'ごはん', 'カフェ', '映画'],
    bio: '新宿を中心に、初参加でも話しやすい少人数の食事会やカフェ会を企画しています。無理なく楽しめる雰囲気を大切にしています。',
    profilePhotos: hostPhotos,
    matchingPreferences: {
      preferredAreas: ['新宿', '渋谷'],
      preferredActivities: ['飲み会', 'ごはん', 'カフェ', '映画'],
      preferredAgeMin: 25,
      preferredAgeMax: 45,
      preferredGenders: [],
      activityTimeSlots: ['夕方', '夜', '金', '土'],
      participationUrgency: 'THIS_WEEK',
      maxTravelMinutes: 30,
      preferredGroupSizes: [4, 6],
      budgetMin: 3000,
      budgetMax: 5000,
      socialStyles: ['初対面でも積極的', '少人数でじっくり'],
      participationGoals: ['友達づくり', '食事・飲み', '新しい体験'],
      firstTimePreferences: ['初参加歓迎', '主催者から話しかけてほしい'],
      alcoholPreference: 'SOMETIMES',
      smokingPreference: 'NON_SMOKING',
      avoidPreferences: ['深夜', '営業・勧誘'],
      scheduleFlexibility: ['多少の遅れは許容', '途中参加OK'],
      preferredLanguages: ['JAPANESE', 'ENGLISH'],
    },
  },
  guest: {
    email: process.env.HANGOUTNOW_DEMO_GUEST_EMAIL || 'demo-guest@hangoutnow.example',
    displayName: 'マドカ',
    phone: '+819011110002',
    birthDate: '1990-09-20',
    gender: 'FEMALE',
    homeArea: '渋谷',
    interests: ['カフェ', '映画', 'スイーツ', '飲み会'],
    bio: '渋谷や新宿で、カフェや映画の話をゆっくり楽しめるHangoutを探しています。ひとりでも参加しやすい少人数の集まりが好きです。',
    profilePhotos: guestPhotos,
    matchingPreferences: {
      preferredAreas: ['渋谷', '新宿'],
      preferredActivities: ['カフェ', '映画', 'スイーツ', '飲み会'],
      preferredAgeMin: 28,
      preferredAgeMax: 42,
      preferredGenders: [],
      activityTimeSlots: ['昼', '夕方', '夜', '土', '日'],
      participationUrgency: 'TODAY',
      maxTravelMinutes: 45,
      preferredGroupSizes: [2, 4],
      budgetMin: 1000,
      budgetMax: 3000,
      socialStyles: ['少人数でじっくり', '聞き役が多い'],
      participationGoals: ['友達づくり', '新しい体験', '食事・飲み'],
      firstTimePreferences: ['ひとり参加が安心', '主催者から話しかけてほしい'],
      alcoholPreference: 'SOMETIMES',
      smokingPreference: 'NON_SMOKING',
      avoidPreferences: ['大人数', '深夜', '営業・勧誘'],
      scheduleFlexibility: ['途中参加OK', '途中退出OK'],
      preferredLanguages: ['JAPANESE', 'KOREAN'],
    },
  },
  masaya: {
    email: process.env.HANGOUTNOW_DEMO_MASAYA_EMAIL || 'demo-masaya@hangoutnow.example',
    displayName: 'マサヤ（承認済み参加者）',
    phone: '+819011110003',
    birthDate: '2002-06-15',
    gender: 'MALE',
    homeArea: '新宿',
    interests: ['飲み会', 'サッカー', 'ラーメン'],
    bio: '仕事や趣味の話をしながら楽しく飲みたいです。公開デモ用の架空プロフィールです。',
    profilePhoto: masayaPhoto,
  },
  kenta: {
    email: process.env.HANGOUTNOW_DEMO_KENTA_EMAIL || 'demo-kenta@hangoutnow.example',
    displayName: 'ケンタ',
    phone: '+819011110004',
    birthDate: '1993-02-18',
    gender: 'MALE',
    homeArea: '渋谷',
    interests: ['ツーリング', 'カフェ', '写真'],
    bio: '景色を楽しむ安全第一のツーリングを企画しています。初参加の方も歓迎です。',
    profilePhoto: kentaPhoto,
  },
  aoi: {
    email: process.env.HANGOUTNOW_DEMO_AOI_EMAIL || 'demo-aoi@hangoutnow.example',
    displayName: 'アオイ',
    phone: '+819011110005',
    birthDate: '1996-07-08',
    gender: 'FEMALE',
    homeArea: '代々木',
    interests: ['ランニング', 'カフェ', '旅行'],
    bio: '会話を楽しめるペースのランニングや、気軽なカフェ会を開いています。',
    profilePhoto: aoiPhoto,
  },
  rena: {
    email: process.env.HANGOUTNOW_DEMO_RENA_EMAIL || 'demo-rena@hangoutnow.example',
    displayName: 'レナ',
    phone: '+819011110006',
    birthDate: '1998-11-23',
    gender: 'FEMALE',
    homeArea: '新宿',
    interests: ['ワイン', '寿司', '映画', '英会話'],
    bio: '新宿と渋谷で気軽に参加できるHangoutを探しています。公開デモ用の架空プロフィールです。',
    profilePhoto: null,
  },
};

async function call(path, options = {}, token, allowedStatuses = []) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
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
    if (response.status === 429 && attempt < 3) {
      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      const retryDelayMs = Number.isFinite(retryAfterSeconds) ? Math.max(1, retryAfterSeconds) * 1_000 : 61_000;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }
    if (!response.ok && !allowedStatuses.includes(response.status)) {
      throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text}`);
    }
    return { status: response.status, body };
  }
  throw new Error(`${options.method || 'GET'} ${path} exceeded its retry limit`);
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
  const matchingPreferences = {
    preferredAreas: [account.homeArea, account.homeArea === '新宿' ? '渋谷' : '新宿'],
    preferredActivities: account.interests,
    preferredAgeMin: 24,
    preferredAgeMax: 45,
    preferredGenders: [],
    activityTimeSlots: ['夜', '土', '日'],
    participationUrgency: 'THIS_WEEK',
    maxTravelMinutes: 30,
    preferredGroupSizes: [2, 4, 6],
    budgetMin: 1000,
    budgetMax: 5000,
    socialStyles: ['初対面でも積極的'],
    participationGoals: ['友達づくり'],
    firstTimePreferences: ['初参加歓迎'],
    alcoholPreference: 'SOMETIMES',
    smokingPreference: 'NON_SMOKING',
    avoidPreferences: ['営業・勧誘'],
    scheduleFlexibility: ['途中参加OK'],
    preferredLanguages: ['JAPANESE'],
    ...account.matchingPreferences,
  };
  const profilePayload = {
    displayName: account.displayName,
    gender: account.gender,
    profilePhotos: account.profilePhotos ?? (account.profilePhoto ? [account.profilePhoto] : []),
    bio: account.bio,
    homeArea: account.homeArea,
    interests: account.interests,
    matchingDataConsent: true,
    behaviorLearningEnabled: true,
    ...matchingPreferences,
  };
  let profileUpdate = await call('/users/me', {
    method: 'PATCH',
    body: JSON.stringify(profilePayload),
  }, token, [400]);
  if (profileUpdate.status === 400) {
    const unsupportedFields = ['behaviorLearningEnabled', 'socialStyles', 'participationGoals', 'firstTimePreferences', 'alcoholPreference', 'smokingPreference', 'avoidPreferences', 'scheduleFlexibility', 'preferredLanguages'];
    const messages = Array.isArray(profileUpdate.body?.message) ? profileUpdate.body.message : [];
    if (!unsupportedFields.some((field) => messages.includes(`property ${field} should not exist`))) {
      throw new Error(`PATCH /users/me -> 400: ${JSON.stringify(profileUpdate.body)}`);
    }
    const compatiblePayload = { ...profilePayload };
    for (const field of unsupportedFields) delete compatiblePayload[field];
    profileUpdate = await call('/users/me', { method: 'PATCH', body: JSON.stringify(compatiblePayload) }, token);
  }
  user = profileUpdate.body;

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
const masaya = await loginOrRegister(accounts.masaya);
const kenta = await loginOrRegister(accounts.kenta);
const aoi = await loginOrRegister(accounts.aoi);
const rena = await loginOrRegister(accounts.rena);
await call('/demo/reset', { method: 'POST', body: '{}' }, host.token);
const organizers = { host, kenta, aoi };
const samples = [
  {
    organizer: 'host',
    title: 'サヤカと新宿で気軽に飲もう',
    imageUrl: drinkingPhoto,
    description: '仕事帰りに気軽に乾杯する、公開デモ用の架空の飲み会です。初参加も歓迎します。',
    category: 'DRINKING', serviceArea: 'SHINJUKU', startInMinutes: 60, publicLocationName: '新宿駅東口周辺（デモ）', locationName: 'デモ居酒屋 新宿店 東京都新宿区新宿3-1-1',
    latitude: 35.6901, longitude: 139.7005, maxParticipants: 4, genderRestriction: 'ANY', maxAge: 39,
  },
  {
    organizer: 'aoi',
    title: '代々木公園をゆっくりランニング',
    imageUrl: runningPhoto,
    description: '会話できるペースで約5km走ります。初心者も歓迎する架空の募集です。',
    category: 'RUNNING', serviceArea: 'SHINJUKU', startInMinutes: 60, publicLocationName: '代々木公園周辺（デモ）', locationName: '代々木公園 原宿門 東京都渋谷区代々木神園町2-1',
    latitude: 35.6717, longitude: 139.6949, maxParticipants: 6, genderRestriction: 'FEMALE_ONLY', maxAge: 39,
  },
  {
    organizer: 'host',
    title: '新宿で話題のラーメンを食べよう',
    imageUrl: ramenPhoto,
    description: '気になっていたラーメン店へ一緒に行く、公開デモ用の架空募集です。',
    category: 'FOOD', serviceArea: 'SHINJUKU', startInMinutes: 30, publicLocationName: '新宿駅東口周辺（デモ）', locationName: 'デモラーメン新宿店 東京都新宿区歌舞伎町1-2-3',
    latitude: 35.6920, longitude: 139.7038, maxParticipants: 4, genderRestriction: 'MALE_ONLY', maxAge: 59,
  },
  {
    organizer: 'host',
    title: '夕方のショートツーリング',
    imageUrl: touringPhoto,
    description: '安全第一で景色を楽しむ、公開デモ用の架空ツーリング募集です。',
    category: 'MOTORCYCLE', serviceArea: 'SHIBUYA', startInMinutes: 180, publicLocationName: '渋谷駅周辺（デモ）', locationName: '渋谷区立宮下公園 東京都渋谷区神宮前6-20-10',
    latitude: 35.6437, longitude: 139.6816, maxParticipants: 5, genderRestriction: 'ANY', maxAge: 59,
  },
  {
    organizer: 'kenta',
    title: '渋谷のカフェでまったりしよう',
    imageUrl: cafePhoto,
    description: '落ち着いたカフェでコーヒーを飲みながら、ゆっくり話す公開デモ用の架空募集です。',
    category: 'CAFE', serviceArea: 'SHIBUYA', startInMinutes: 60, publicLocationName: '渋谷駅周辺（デモ）', locationName: 'デモカフェ渋谷店 東京都渋谷区渋谷1-26-5',
    latitude: 35.6580, longitude: 139.7016, maxParticipants: 5, genderRestriction: 'ANY',
  },
];

samples.push(...[
  ['host','新宿でワインを楽しむ会','WINE','SHINJUKU',35.6910,139.7010,60],
  ['kenta','渋谷の落ち着いたバーへ','BAR','SHIBUYA',35.6590,139.7020,180],
  ['aoi','新宿で気軽に居酒屋ごはん','IZAKAYA','SHINJUKU',35.6930,139.7040,30],
  ['host','寿司を食べながら交流会','SUSHI','SHINJUKU',35.6890,139.6990,180],
  ['kenta','渋谷で焼肉を囲もう','YAKINIKU','SHIBUYA',35.6570,139.6990,60],
  ['aoi','話題のスイーツを食べよう','SWEETS','SHIBUYA',35.6600,139.7030,60],
  ['host','新宿でカラオケ交流会','KARAOKE','SHINJUKU',35.6940,139.7020,180],
  ['kenta','渋谷でゆるくダーツ','DARTS','SHIBUYA',35.6560,139.7000,30],
  ['aoi','ボードゲームで遊ぼう','GAME','SHINJUKU',35.6880,139.7050,60],
  ['host','映画の感想を話すカフェ会','MOVIE','SHINJUKU',35.6870,139.6980,180],
  ['kenta','渋谷でシーシャを楽しもう','SHISHA','SHIBUYA',35.6550,139.7040,60],
  ['aoi','初心者向け英会話カフェ','ENGLISH','SHIBUYA',35.6610,139.7000,30],
  ['host','新宿で夜ごはん仲間募集','DINNER','SHINJUKU',35.6950,139.7060,60],
  ['aoi','スパイスカレーを食べ比べ','FOOD','SHIBUYA',35.6585,139.7025,30],
  ['kenta','餃子を囲んで夜ごはん','DINNER','SHINJUKU',35.6925,139.7055,180],
  ['kenta','クラフトビールを飲み比べ','DRINKING','SHIBUYA',35.6575,139.7005,60],
  ['aoi','日本酒を少しずつ楽しむ会','WINE','SHINJUKU',35.6905,139.7035,180],
  ['kenta','渋谷をのんびり散歩','WALKING','SHIBUYA',35.6540,139.6980,180],
  ['aoi','朝の新宿まち歩き','WALKING','SHINJUKU',35.6860,139.6970,30],
  ['aoi','朝のカフェでモーニング交流','CAFE','SHINJUKU',35.6890,139.7010,60],
  ['kenta','パン屋さん巡りとコーヒー','CAFE','SHIBUYA',35.6590,139.7030,180],
  ['host','季節のパフェを食べよう','SWEETS','SHINJUKU',35.6910,139.6990,30],
  ['aoi','公園でやさしい朝ヨガ','YOGA','SHINJUKU',35.6870,139.6950,60],
  ['kenta','都内をのんびりサイクリング','CYCLING','SHIBUYA',35.6560,139.6970,180],
  ['host','古民家カフェでのんびり','CAFE','SHINJUKU',35.6908,139.6998,180],
  ['aoi','テラスカフェで朝活','CAFE','SHIBUYA',35.6588,139.7018,30],
  ['kenta','夜カフェでゆっくり話そう','CAFE','SHINJUKU',35.6918,139.7028,60],
  ['host','ふわふわパンケーキを食べよう','SWEETS','SHIBUYA',35.6598,139.7008,60],
  ['aoi','アフタヌーンティーで交流','SWEETS','SHINJUKU',35.6898,139.7038,180],
  ['kenta','和菓子を少しずつ楽しむ会','SWEETS','SHIBUYA',35.6578,139.6998,30],
  ['host','季節のジェラート巡り','SWEETS','SHINJUKU',35.6928,139.7018,60],
  ['aoi','みんなでボウリング','BOWLING','SHINJUKU',35.6938,139.7008,60],
  ['kenta','ゲームセンターで遊ぼう','ARCADE','SHIBUYA',35.6568,139.7028,180],
  ['host','20代・30代のゆる交流会','SOCIAL','SHINJUKU',35.6888,139.7048,30],
  ['aoi','ひとり参加歓迎のおしゃべり会','SOCIAL','SHIBUYA',35.6608,139.6998,60],
  ['kenta','読書好きの交流会','SOCIAL','SHINJUKU',35.6878,139.6978,180],
  ['host','カメラ好きで集まろう','SOCIAL','SHIBUYA',35.6558,139.7038,30],
  ['aoi','地方出身者の交流会','SOCIAL','SHINJUKU',35.6948,139.7058,60],
  ['kenta','公園でゆるくピクニック','PICNIC','SHINJUKU',35.6868,139.6968,60],
  ['host','サウナでととのう会','SAUNA','SHIBUYA',35.6548,139.7008,180],
  ['aoi','夜景を眺めながらのんびり','NIGHT_VIEW','SHINJUKU',35.6958,139.7028,180],
  ['kenta','川沿いで夕涼み','WATERFRONT','SHIBUYA',35.6538,139.6978,60],
  ['host','音楽を聴きながらまったり','MUSIC','SHINJUKU',35.6898,139.6988,30],
].map(([organizer,title,category,serviceArea,latitude,longitude,startInMinutes])=>({
  organizer,title,category,serviceArea,latitude,longitude,startInMinutes,imageUrl:imageByCategory[category],
  description:`${title}。初参加歓迎の公開デモ用架空Hangoutです。`,
  publicLocationName:`${serviceArea==='SHINJUKU'?'新宿':'渋谷'}駅周辺（デモ）`,
  locationName:`デモ会場 ${serviceArea==='SHINJUKU'?'新宿':'渋谷'}店 東京都${serviceArea==='SHINJUKU'?'新宿区新宿3-2-1':'渋谷区渋谷1-2-3'}`,
  maxParticipants:6,genderRestriction:'ANY',maxAge:59,
})));

let hangouts = await call('/hangouts?latitude=35.69&longitude=139.70&radiusKm=20', {}, host.token)
  .then((result) => result.body);
for (const organizer of [kenta, aoi]) {
  const desiredTitles = new Set(samples.filter((sample) => sample.organizer === (organizer.id === kenta.id ? 'kenta' : 'aoi')).map((sample) => sample.title));
  const staleHangouts = hangouts.filter((item) => item.hostUserId === organizer.id && ['OPEN', 'FULL'].includes(item.status) && !desiredTitles.has(item.title));
  for (const stale of staleHangouts) {
    await call(`/hangouts/${stale.id}`, { method: 'DELETE' }, organizer.token);
  }
  hangouts = hangouts.filter((item) => !staleHangouts.some((stale) => stale.id === item.id));
}
const seededHangouts = [];
for (const sample of samples) {
  const organizer = organizers[sample.organizer];
  const addressIndex = sample.locationName.indexOf(' 東京都');
  const meetingPlaceName = addressIndex > 0 ? sample.locationName.slice(0, addressIndex) : sample.locationName;
  const meetingAddress = addressIndex > 0 ? sample.locationName.slice(addressIndex + 1) : sample.locationName;
  const navigationUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${meetingPlaceName} ${meetingAddress}`)}`;
  const hostMaleCount = organizer.gender === 'MALE' ? 1 : 0;
  const hostFemaleCount = organizer.gender === 'FEMALE' ? 1 : 0;
  const { organizer: _organizer, ...samplePayload } = sample;
  const currentSample = { ...samplePayload, meetingPlaceName, meetingAddress, navigationUrl, hostMaleCount, hostFemaleCount };
  let item = hangouts.find((candidate) => candidate.hostUserId === organizer.id && candidate.title === sample.title && ['OPEN', 'FULL'].includes(candidate.status));
  if (!item) {
    item = await call('/hangouts', {
      method: 'POST', body: JSON.stringify(currentSample),
    }, organizer.token).then((result) => result.body);
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
        imageUrl: sample.imageUrl,
        hostMaleCount,
        hostFemaleCount,
        genderRestriction: sample.genderRestriction,
        maxAge: sample.maxAge ?? null,
      }),
    }, organizer.token).then((result) => result.body);
  }
  seededHangouts.push(item);
}
const hangout = seededHangouts[0];

const weekHistory = await call('/demo/seed-week-history', { method: 'POST', body: '{}' }, host.token)
  .then((result) => result.body);

async function ensureHeart(account, item) {
  const detail = await call(`/hangouts/${item.id}`, {}, account.token).then((result) => result.body);
  if (!detail.hearted) await call(`/hangouts/${item.id}/heart`, { method: 'POST', body: '{}' }, account.token);
}

const cafeHangout = seededHangouts.find((item) => item.category === 'CAFE');
const movieHangout = seededHangouts.find((item) => item.category === 'MOVIE');
const runningHangout = seededHangouts.find((item) => item.category === 'RUNNING');
const englishHangout = seededHangouts.find((item) => item.category === 'ENGLISH');
if (!cafeHangout || !movieHangout || !runningHangout || !englishHangout) throw new Error('Matching behavior fixtures are incomplete');

await ensureHeart(guest, cafeHangout);
await ensureHeart(guest, movieHangout);
await ensureHeart(host, cafeHangout);
await ensureHeart(host, englishHangout);

for (const [account, item] of [[guest, hangout], [guest, cafeHangout], [guest, movieHangout], [guest, runningHangout], [host, cafeHangout], [host, englishHangout]]) {
  await call('/analytics/events', {
    method: 'POST',
    body: JSON.stringify({ eventType: 'HANGOUT_VIEWED', hangoutId: item.id }),
  }, account.token);
}
await call('/analytics/match-feedback', {
  method: 'POST',
  body: JSON.stringify({ hangoutId: hangout.id, outcome: 'MATCHED' }),
}, guest.token);
await call('/analytics/match-feedback', {
  method: 'POST',
  body: JSON.stringify({ hangoutId: runningHangout.id, outcome: 'NOT_MATCHED', reason: 'CONDITIONS' }),
}, guest.token);
await call('/analytics/match-feedback', {
  method: 'POST',
  body: JSON.stringify({ hangoutId: cafeHangout.id, outcome: 'MATCHED' }),
}, host.token);

const guestView = await call(`/hangouts/${hangout.id}`, {}, masaya.token).then((result) => result.body);
let joinStatus = guestView.myJoinStatus;
if (!joinStatus) {
  const request = await call(`/hangouts/${hangout.id}/join`, {
    method: 'POST',
    body: JSON.stringify({ message: 'デモ参加者です。参加をお願いします！' }),
  }, masaya.token).then((result) => result.body);
  await call(`/join-requests/${request.id}/accept`, { method: 'POST', body: '{}' }, host.token);
  joinStatus = 'ACCEPTED';
} else if (joinStatus === 'PENDING') {
  const requests = await call(`/hangouts/${hangout.id}/requests`, {}, host.token).then((result) => result.body);
  const request = requests.find((item) => item.user.id === masaya.id && item.status === 'PENDING');
  if (request) await call(`/join-requests/${request.id}/accept`, { method: 'POST', body: '{}' }, host.token);
  joinStatus = 'ACCEPTED';
}

let room = null;
let messages = null;
for (let attempt = 0; attempt < 3; attempt += 1) {
  const rooms = await call('/chat-rooms', {}, masaya.token).then((result) => result.body);
  const candidate = rooms.find((item) => item.hangoutId === hangout.id);
  if (candidate) {
    const result = await call(`/chat-rooms/${candidate.id}/messages`, {}, masaya.token, [404]);
    if (result.status !== 404) {
      room = candidate;
      messages = result.body;
      break;
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 400));
}
if (!room || !messages) throw new Error('Demo chat room was not created');
if (!messages.some((message) => message.body === 'こんにちは！デモトークへようこそ。')) {
  await call(`/chat-rooms/${room.id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body: 'こんにちは！デモトークへようこそ。' }),
  }, host.token);
}

process.stdout.write(`${JSON.stringify({
  ok: true,
  demoUrl,
  host: { email: host.email, displayName: host.displayName, created: host.created },
  guest: { email: guest.email, displayName: guest.displayName, created: guest.created },
  personas: [host, guest, masaya, kenta, aoi, rena].map((account) => ({ email: account.email, displayName: account.displayName, created: account.created })),
  matchingProfiles: [host, guest].map((account) => ({
    displayName: account.displayName,
    homeArea: account.homeArea,
    interests: account.interests,
    preferences: account.matchingPreferences,
  })),
  organizers: [host, kenta, aoi].map((account) => ({ id: account.id, displayName: account.displayName, created: account.created })),
  hangouts: seededHangouts.map((item) => ({ id: item.id, title: item.title, category: item.category })),
  weekHistory: { days: weekHistory.days, mutualRating: weekHistory.mutualRating },
  behaviorHistory: { viewed: 6, hearts: 4, matchFeedbacks: 3 },
  primaryHangout: { id: hangout.id, title: hangout.title, joinStatus, genderRestriction: 'ANY', maxAge: 39 },
  chat: { roomId: room.id, ready: true },
  walkthrough: [
    '主催者で新しいHangoutを作成',
    '参加者へ役割を切り替えて参加申請',
    '主催者へ戻って申請を承認',
    '双方でグループトークを確認',
    '主催者がHangoutを終了して参加者へ★5',
    '参加者も主催者へ★5を付け、1対1トークを開始',
  ],
}, null, 2)}\n`);
