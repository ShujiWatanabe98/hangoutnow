import { readFileSync } from 'node:fs';

const baseUrl = process.env.HANGOUTNOW_API_URL || 'https://hangoutnow-api.onrender.com';
const password = process.env.HANGOUTNOW_VALIDATION_PASSWORD || 'HangoutNow-Verify-2026!';
const marker = '[AI検証20260819]';
const photo = (name) => `data:image/jpeg;base64,${readFileSync(new URL(`../apps/demo/public/assets/${name}`, import.meta.url)).toString('base64')}`;

const profiles = [
{ key:'yui',email:'verify-ai-yui@hangoutnow.example',name:'ユイ（AI検証）',birthDate:'1994-05-16',gender:'FEMALE',area:'新宿',photo:'demo-mami-profile-main.jpg',interests:['カフェ','映画','英会話'],activities:['カフェ','映画'],slots:['WED','FRI','NIGHT'],urgency:'TODAY',travel:25,groups:[3,4],budget:[1000,3500],styles:['少人数','会話中心'],goals:['趣味仲間','気分転換'],first:['初心者歓迎'],alcohol:'SOMETIMES',smoking:'NON_SMOKING',avoid:['大人数'],flex:['開始時刻を調整可能'],languages:['JAPANESE','ENGLISH']},
  { key:'sota',email:'verify-ai-sota@hangoutnow.example',name:'ソウタ（AI検証）',birthDate:'1990-10-02',gender:'MALE',area:'渋谷',photo:'demo-host-profile.jpg',interests:['ランニング','ラーメン','写真'],activities:['ランニング','散歩'],slots:['SAT','SUN','MORNING'],urgency:'WEEKEND',travel:45,groups:[2,4,6],budget:[0,2500],styles:['アクティブ','少人数'],goals:['運動仲間','趣味仲間'],first:['経験者歓迎'],alcohol:'NONE',smoking:'NON_SMOKING',avoid:['喫煙'],flex:['雨天変更可能'],languages:['JAPANESE']},
  { key:'minji',email:'verify-ai-minji@hangoutnow.example',name:'ミンジ（AI検証）',birthDate:'1997-03-21',gender:'FEMALE',area:'新宿',photo:'demo-guest-profile.jpg',interests:['韓国語','カフェ','スイーツ'],activities:['カフェ','語学交流'],slots:['TUE','THU','EVENING'],urgency:'THIS_WEEK',travel:30,groups:[3,5],budget:[1500,4000],styles:['会話中心','国際交流'],goals:['語学交流','友達づくり'],first:['初参加同士'],alcohol:'NONE',smoking:'NON_SMOKING',avoid:['飲酒中心'],flex:['終了時刻を調整可能'],languages:['KOREAN','JAPANESE']},
  { key:'chen',email:'verify-ai-chen@hangoutnow.example',name:'チェン（AI検証）',birthDate:'1988-12-09',gender:'MALE',area:'渋谷',photo:'demo-masaya-profile.jpg',interests:['中国語','英会話','ボードゲーム'],activities:['語学交流','ゲーム'],slots:['FRI','SAT','NIGHT'],urgency:'THIS_WEEK',travel:60,groups:[4,6],budget:[1000,5000],styles:['国際交流','にぎやか'],goals:['語学交流','新しい体験'],first:['初心者歓迎'],alcohol:'SOMETIMES',smoking:'SEPARATED',avoid:['営業・勧誘'],flex:['途中参加可能'],languages:['CHINESE','ENGLISH','JAPANESE']},
  { key:'emma',email:'verify-ai-emma@hangoutnow.example',name:'エマ（AI検証）',birthDate:'1995-08-27',gender:'OTHER',area:'渋谷',photo:'demo-madoka-profile-main.jpg',interests:['英会話','ワイン','散歩'],activities:['英会話','散歩'],slots:['SUN','DAYTIME','EVENING'],urgency:'FLEXIBLE',travel:40,groups:[2,3,4],budget:[2000,6000],styles:['落ち着いた雰囲気','国際交流'],goals:['語学交流','気分転換'],first:['初心者歓迎'],alcohol:'YES',smoking:'NO_PREFERENCE',avoid:['騒がしい店'],flex:['場所を調整可能'],languages:['ENGLISH','JAPANESE']},
];

async function call(path, options = {}, token, allowed = []) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'content-type':'application/json', ...(token ? { authorization:`Bearer ${token}` } : {}), ...options.headers } });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok && !allowed.includes(response.status)) throw new Error(`${options.method || 'GET'} ${path} -> ${response.status}: ${text}`);
  return { status: response.status, body };
}

async function account(profile) {
  let result = await call('/auth/login', { method:'POST', body:JSON.stringify({ email:profile.email, password }) }, undefined, [401]);
  if (result.status === 401) result = await call('/auth/register', { method:'POST', body:JSON.stringify({ email:profile.email, password, displayName:profile.name, birthDate:profile.birthDate }) });
  const token = result.body.accessToken;
  let user = await call('/users/me', {}, token).then(value => value.body);
  user = await call('/users/me', { method:'PATCH', body:JSON.stringify({
    displayName:profile.name,gender:profile.gender,profilePhotos:[photo(profile.photo)],bio:`${marker} 最新マッチング仕様を確認する架空プロフィールです。`,homeArea:profile.area,interests:profile.interests,
    preferredAreas:[profile.area,profile.area==='新宿'?'渋谷':'新宿'],preferredActivities:profile.activities,preferredAgeMin:24,preferredAgeMax:45,preferredGenders:[],activityTimeSlots:profile.slots,
    matchingDataConsent:true,behaviorLearningEnabled:true,participationUrgency:profile.urgency,maxTravelMinutes:profile.travel,preferredGroupSizes:profile.groups,budgetMin:profile.budget[0],budgetMax:profile.budget[1],
    socialStyles:profile.styles,participationGoals:profile.goals,firstTimePreferences:profile.first,alcoholPreference:profile.alcohol,smokingPreference:profile.smoking,avoidPreferences:profile.avoid,scheduleFlexibility:profile.flex,preferredLanguages:profile.languages,
  }) }, token).then(value => value.body);
  return { ...profile, id:user.id, token };
}

const users = Object.fromEntries((await Promise.all(profiles.map(account))).map(user => [user.key,user]));
const existing = await call('/hangouts/mine/activity', {}, users.yui.token).then(value => value.body);
if (existing.hosted.some(item => item.title.includes(marker))) {
  process.stdout.write(JSON.stringify({ status:'already-seeded', accounts:profiles.map(({email,name})=>({email,name})) }, null, 2));
  process.exit(0);
}

async function track(user, eventType, hangoutId) { await call('/analytics/events', { method:'POST', body:JSON.stringify({ eventType, ...(hangoutId?{hangoutId}:{}) }) }, user.token); }
async function create(host, input) {
  const hangout = await call('/hangouts', { method:'POST', body:JSON.stringify(input) }, host.token).then(value => value.body);
  await track(host,'HANGOUT_CREATED',hangout.id);
  return hangout;
}
async function join(host, member, hangout, message) {
  await track(member,'HANGOUT_VIEWED',hangout.id);
  await call(`/hangouts/${hangout.id}/heart`, { method:'POST', body:'{}' }, member.token);
  const request = await call(`/hangouts/${hangout.id}/join`, { method:'POST', body:JSON.stringify({ message }) }, member.token).then(value => value.body);
  await track(member,'JOIN_REQUESTED',hangout.id);
  await call(`/join-requests/${request.id}/accept`, { method:'POST', body:'{}' }, host.token);
  await track(member,'JOIN_ACCEPTED',hangout.id);
}
async function complete(host, hangout, members, messages) {
  const room = (await call('/chat-rooms', {}, host.token).then(value => value.body)).find(item => item.hangout.id===hangout.id);
  for (let index=0;index<messages.length;index+=1) await call(`/chat-rooms/${room.id}/messages`, { method:'POST', body:JSON.stringify({ body:messages[index] }) }, (index%2?members[0]:host).token);
  await call(`/hangouts/${hangout.id}/start`, { method:'POST', body:'{}' }, host.token);
  await call(`/hangouts/${hangout.id}/finish`, { method:'POST', body:'{}' }, host.token);
  await track(host,'HANGOUT_COMPLETED',hangout.id);
  for (const member of members) await track(member,'HANGOUT_COMPLETED',hangout.id);
  for (const member of members) {
    await call(`/hangouts/${hangout.id}/ratings`, { method:'POST', body:JSON.stringify({ ratedUserId:member.id, score:5 }) }, host.token);
    await call(`/hangouts/${hangout.id}/ratings`, { method:'POST', body:JSON.stringify({ ratedUserId:host.id, score:member.key==='emma'?4:5 }) }, member.token);
  }
}

const cafe = await create(users.yui,{title:`${marker} 新宿カフェ交流`,description:'少人数で会話を楽しむAI検証用Hangoutです。',category:'CAFE',serviceArea:'SHINJUKU',startInMinutes:30,locationName:'検証カフェ新宿店 東京都新宿区新宿3-1-1',meetingPlaceName:'検証カフェ新宿店',meetingAddress:'東京都新宿区新宿3-1-1',publicLocationName:'新宿駅周辺（検証）',latitude:35.6901,longitude:139.7005,maxParticipants:4,genderRestriction:'ANY'});
await join(users.yui,users.sota,cafe,'ランニング後に参加します。少人数で話したいです。');
await join(users.yui,users.minji,cafe,'日本語と韓国語で交流したいです。');
await complete(users.yui,cafe,[users.sota,users.minji],['今日はよろしくお願いします。','こちらこそ、楽しみにしています。','集合場所を確認しました。']);

const language = await create(users.chen,{title:`${marker} 渋谷3言語交流`,description:'日本語・英語・中国語で交流するAI検証用Hangoutです。',category:'ENGLISH',serviceArea:'SHIBUYA',startInMinutes:60,locationName:'検証ラウンジ渋谷店 東京都渋谷区渋谷1-1-1',meetingPlaceName:'検証ラウンジ渋谷店',meetingAddress:'東京都渋谷区渋谷1-1-1',publicLocationName:'渋谷駅周辺（検証）',latitude:35.6580,longitude:139.7016,maxParticipants:4,genderRestriction:'ANY'});
await join(users.chen,users.emma,language,'英語と日本語の会話を楽しみたいです。');
await join(users.chen,users.yui,language,'英会話を練習したいです。');
await complete(users.chen,language,[users.emma,users.yui],['Welcome! 気軽に話しましょう。','Thank you! 楽しみにしています。']);

const running = await create(users.sota,{title:`${marker} 週末朝ラン`,description:'会話できるペースで走るAI検証用Hangoutです。',category:'RUNNING',serviceArea:'SHIBUYA',startInMinutes:180,locationName:'代々木公園入口 東京都渋谷区代々木神園町2-1',meetingPlaceName:'代々木公園入口',meetingAddress:'東京都渋谷区代々木神園町2-1',publicLocationName:'代々木公園周辺（検証）',latitude:35.6717,longitude:139.6949,maxParticipants:6,genderRestriction:'ANY'});
for (const [user,reason] of [[users.minji,'TIME'],[users.chen,'DISTANCE'],[users.emma,'CONDITIONS']]) {
  await track(user,'HANGOUT_VIEWED',running.id);
  await call('/analytics/match-feedback',{method:'POST',body:JSON.stringify({hangoutId:running.id,outcome:'NOT_MATCHED',reason})},user.token);
}
await call('/analytics/match-feedback',{method:'POST',body:JSON.stringify({hangoutId:cafe.id,outcome:'MATCHED'})},users.minji.token);
await call('/analytics/match-feedback',{method:'POST',body:JSON.stringify({hangoutId:language.id,outcome:'MATCHED'})},users.emma.token);

process.stdout.write(JSON.stringify({ status:'seeded', accounts:profiles.map(({email,name,area,languages})=>({email,name,area,languages})), hangouts:[cafe.title,language.title,running.title] }, null, 2));
