const defaults = [
  { id: 1, category: 'FOOD', status: 'OPEN', imageUrl: '/assets/hangout-ramen.jpg', publicLocationName: '新宿駅東口周辺', icon: '🍜', title: '新宿でラーメン食べよう', time: '30分後', place: '新宿駅東口・1.2km', current: 2, max: 4, host: 'ケンタ', rating: '★ 4.9', match: 94, hot: true, photo: 0, desc: '気になっていた煮干しラーメンへ。初参加も大歓迎です！' },
  { id: 2, category: 'RUNNING', status: 'OPEN', imageUrl: '/assets/demo-running-hangout-v2.jpg', publicLocationName: '代々木公園周辺', icon: '🏃', title: '代々木公園を軽くランニング', time: '1時間後', place: '代々木公園・2.4km', current: 3, max: 5, host: 'Miki', rating: '★ 4.8', match: 88, photo: 1, desc: '会話できるくらいのペースで5km走ります。' },
  { id: 3, category: 'CAFE', status: 'OPEN', imageUrl: '/assets/hangout-coffee.jpg', publicLocationName: '渋谷駅周辺', icon: '☕', title: '作業仲間募集・駅前カフェ', time: '3時間後', place: '渋谷駅・3.1km', current: 1, max: 3, host: 'Sora', rating: '★ 4.7', match: 81, photo: 2, desc: '各自作業しつつ、ときどき雑談しましょう。' },
  { id: 4, category: 'MOTORCYCLE', status: 'OPEN', imageUrl: '/assets/hangout-bike.jpg', publicLocationName: '世田谷周辺', icon: '🏍️', title: '夕方のショートツーリング', time: '3時間後', place: '世田谷・7.8km', current: 2, max: 4, host: 'Ryo', rating: '★ 5.0', match: 79, photo: 3, desc: '安全第一でゆっくり走ります。初心者歓迎。' },
];

const IS_PRODUCTION = globalThis.HANGOUT_NOW_CONFIG?.production === true;
const SESSION_STORAGE_KEY = IS_PRODUCTION ? 'hangout-now-production-session' : 'hangout-now-session';
const DEMO_ROLE_STORAGE_KEY = 'hangout-now-demo-role';
const saved = JSON.parse(localStorage.getItem('hangout-now-demo') || 'null');
const hangouts = saved?.hangouts || defaults;
const app = document.querySelector('#app');
let activeScreen = 'home';
const joined = new Set(saved?.joined || []);
const chats = saved?.chats || {};
const API_URL = globalThis.HANGOUT_NOW_CONFIG?.apiUrl || 'http://localhost:3000';
const DEMO_ACCOUNTS = globalThis.HANGOUT_NOW_CONFIG?.demoAccounts || null;
const INTEREST_OPTIONS=['カフェ','ラーメン','ランニング','飲み会','ダーツ','バー','ごはん','カラオケ','英会話','シーシャ','スイーツ','映画'];
const CATEGORY_LABELS={FOOD:'食事',DRINKING:'飲み会',WINE:'ワイン',BAR:'バー',IZAKAYA:'居酒屋',SUSHI:'寿司',YAKINIKU:'焼肉',DINNER:'ごはん',CAFE:'カフェ',SWEETS:'スイーツ',RUNNING:'ランニング',WALKING:'散歩',MOTORCYCLE:'ツーリング',YOGA:'ヨガ',CYCLING:'サイクリング',KARAOKE:'カラオケ',DARTS:'ダーツ',GAME:'ボードゲーム',MOVIE:'映画',SHISHA:'シーシャ',ENGLISH:'英会話'};
const HANGOUT_KEYWORD_GROUPS=[
  {id:'food-drink',label:'ごはん・飲み',description:'気軽な食事から仕事帰りの一杯まで',categories:['FOOD','DRINKING','WINE','BAR','IZAKAYA','SUSHI','YAKINIKU','DINNER']},
  {id:'cafe-sweets',label:'カフェ・スイーツ',description:'コーヒーや甘いものを囲んで話そう',categories:['CAFE','SWEETS','ENGLISH']},
  {id:'active-outdoor',label:'運動・アウトドア',description:'体を動かして自然に仲良くなろう',categories:['RUNNING','WALKING','MOTORCYCLE','YOGA','CYCLING']},
  {id:'hobby-social',label:'趣味・交流',description:'好きなことをきっかけにつながろう',categories:['KARAOKE','DARTS','GAME','MOVIE','SHISHA','ENGLISH']},
];
const MATCH_AREA_OPTIONS=['新宿','渋谷','池袋','東京','品川','上野','横浜'];
const MATCH_TIME_OPTIONS=['朝','昼','夕方','夜','深夜'];
const MATCH_DAY_OPTIONS=['月','火','水','木','金','土','日'];
const MATCH_TRAVEL_OPTIONS=[[15,'15分'],[30,'30分'],[45,'45分'],[60,'1時間'],[90,'1時間半']];
const MATCH_GROUP_OPTIONS=[[2,'2人'],[4,'3〜4人'],[6,'5〜6人'],[10,'7〜10人']];
const MATCH_BUDGET_OPTIONS=[[0,1000,'〜1,000円'],[1000,3000,'1,000〜3,000円'],[3000,5000,'3,000〜5,000円'],[5000,10000,'5,000〜10,000円'],[10000,100000,'10,000円〜']];
const MATCH_SOCIAL_STYLE_OPTIONS=['静かに話したい','ワイワイ楽しみたい','初対面でも積極的','少人数でじっくり','聞き役が多い'];
const MATCH_GOAL_OPTIONS=['趣味仲間','友達づくり','暇つぶし','情報交換','運動習慣','食事・飲み','新しい体験'];
const MATCH_FIRST_TIME_OPTIONS=['初参加歓迎','ひとり参加が安心','常連が多くてもOK','主催者から話しかけてほしい'];
const MATCH_AVOID_OPTIONS=['大人数','飲酒中心','深夜','屋外','激しい運動','写真撮影','営業・勧誘'];
const MATCH_FLEXIBILITY_OPTIONS=['時間厳守','多少の遅刻は許容','途中参加OK','途中退出OK','急な予定変更OK'];
const MATCH_LANGUAGE_OPTIONS=[['JAPANESE','日本語'],['ENGLISH','英語'],['KOREAN','韓国語'],['CHINESE','中国語']];
let session = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null');
let demoRole = IS_PRODUCTION ? null : localStorage.getItem(DEMO_ROLE_STORAGE_KEY);
const areas={新宿:{latitude:35.6901,longitude:139.7005},渋谷:{latitude:35.6580,longitude:139.7016}};
let userLocation=saved?.userLocation||null;
let unreadNotifications=0;
let realtimeSocket=null;
const behaviorEventsSent=new Set();
if (new URLSearchParams(location.search).has('resetAuth')) { localStorage.removeItem(SESSION_STORAGE_KEY); session = null; }

const hangoutImageObserver=new MutationObserver(()=>{
  document.querySelectorAll('#hangout-image,#edit-image').forEach(input=>{input.accept='image/*'});
  const input=document.querySelector('.host-menu-screen #edit-image');
  if(!input||input.dataset.previewReady==='true')return;
  input.dataset.previewReady='true';
  const preview=document.createElement('div');preview.className='hangout-image-preview';preview.innerHTML='<span>選択した画像をここに表示</span>';
  input.insertAdjacentElement('afterend',preview);
  input.addEventListener('change',()=>{const file=input.files[0];if(!file)return;if(input.dataset.previewUrl)URL.revokeObjectURL(input.dataset.previewUrl);const url=URL.createObjectURL(file);input.dataset.previewUrl=url;preview.style.backgroundImage=`url('${url}')`;preview.classList.add('has-image');preview.innerHTML='<b>16:9のHangout画像へ変換して保存します</b>'});
});
hangoutImageObserver.observe(document.body,{childList:true,subtree:true});

const buttonReliabilityObserver=new MutationObserver(()=>{
  document.querySelectorAll('button:not([type])').forEach(button=>{if(!button.closest('form'))button.type='button'});
});
buttonReliabilityObserver.observe(document.body,{childList:true,subtree:true});
const BUTTON_REPEAT_GUARD_MS=900;
const recentButtonActions=new WeakMap();
document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('button'):null;
  if(!button||button.disabled)return;
  const now=performance.now();
  const previousAction=recentButtonActions.get(button);
  if(previousAction!==undefined&&now-previousAction<BUTTON_REPEAT_GUARD_MS){
    event.preventDefault();
    event.stopImmediatePropagation();
    button.classList.remove('button-pressed');
    return;
  }
  recentButtonActions.set(button,now);
},true);
document.addEventListener('dblclick',event=>{
  const button=event.target instanceof Element?event.target.closest('button'):null;
  if(button)event.preventDefault();
},true);
document.addEventListener('pointerdown',event=>{const button=event.target.closest('button');if(button&&!button.disabled)button.classList.add('button-pressed')},{passive:true});
document.addEventListener('pointerup',event=>event.target.closest('button')?.classList.remove('button-pressed'),{passive:true});
document.addEventListener('pointercancel',event=>event.target.closest('button')?.classList.remove('button-pressed'),{passive:true});

function portraitClass(photo) { return `host-${photo}`; }
function photoStyle(url) { return url ? ` style="background-image:url('${url}')"` : ''; }
function userPhotos(user){const photos=(user?.profilePhotos||[]).filter(Boolean);if(user?.profilePhoto&&!photos.includes(user.profilePhoto))photos.unshift(user.profilePhoto);return photos.slice(0,3)}
function profilePhotoTrio(user,name){const photos=userPhotos(user);const positions=[1,0,2];return `<div class="profile-photo-trio" aria-label="${safeText(name)}のプロフィール画像">${positions.map((index,position)=>{const photo=photos[index];const main=position===1;return `<button type="button" class="profile-photo-circle ${main?'main':'side'} ${photo?'':'empty'}" data-profile-photo-index="${index}" ${photo?'': 'disabled'}${photoStyle(photo)} aria-label="${photo?`${safeText(name)}のプロフィール画像${index+1}を拡大`:'画像未登録'}">${photo?'':main?safeText(name).slice(0,1):'＋'}</button>`}).join('')}</div>`}
function hangoutPhotoClass(h) { return h.imageUrl ? 'custom-hangout-photo' : `activity-photo-${h.photo%4}`; }
function userAge(birthDate){if(!birthDate)return null;const born=new Date(birthDate);const now=new Date();let age=now.getFullYear()-born.getFullYear();if(now.getMonth()<born.getMonth()||(now.getMonth()===born.getMonth()&&now.getDate()<born.getDate()))age-=1;return age}
function eligibilityReason(h){const gender=session?.user?.gender;const age=userAge(session?.user?.birthDate);if(h.genderRestriction==='MALE_ONLY'&&gender!=='MALE')return '男性のみ参加できます';if(h.genderRestriction==='FEMALE_ONLY'&&gender!=='FEMALE')return '女性のみ参加できます';if(h.maxAge&&age!==null&&age>h.maxAge)return `年齢条件（${h.maxAge}歳以下）の対象外です`;return ''}

function persist() { localStorage.setItem('hangout-now-demo', JSON.stringify({ hangouts, joined: [...joined], chats, userLocation })); }
function navigate(screen) { if (!session) { authScreen(); return; } activeScreen = screen; ({ home, mapScreen:googleMapScreen, chatScreen, profileScreen }[screen])(); }
function slideInFromRight(element,duration=420){
  if(!element)return;
  element.classList.remove('chat-screen-visible');
  element.style.transition='none';
  element.style.transform='translateX(100%)';
  element.getBoundingClientRect();
  element.style.transition=`transform ${duration}ms cubic-bezier(.22,.75,.28,1)`;
  requestAnimationFrame(()=>{element.style.transform='translateX(0)'});
}
function slideOutToRight(element,onFinish,duration=420){
  if(!element){onFinish();return}
  element.style.transition=`transform ${duration}ms cubic-bezier(.72,0,.78,.28)`;
  element.style.transform='translateX(100%)';
  setTimeout(onFinish,duration);
}
function transitionHangoutConversation(workspace,opening,duration=320){
  const list=workspace?.querySelector('.hangout-flow-list');
  const detailPanel=workspace?.querySelector('.hangout-detail-panel');
  const conversation=workspace?.querySelector('.chat-conversation');
  if(!list||!detailPanel||!conversation)return;
  const transitions=[list,detailPanel,conversation];
  transitions.forEach(element=>{element.style.transition='none';element.style.animation='none'});
  list.style.transform=opening?'translateX(-25%)':'translateX(-40%)';
  detailPanel.style.transform=opening?'translateX(0)':'translateX(-25%)';
  conversation.style.transform=opening?'translateX(100%)':'translateX(0)';
  workspace.getBoundingClientRect();
  transitions.forEach(element=>{element.style.transition=`transform ${duration}ms cubic-bezier(.22,.75,.28,1)`});
  workspace.classList.toggle('conversation-open',opening);
  list.style.transform=opening?'translateX(-40%)':'translateX(-25%)';
  detailPanel.style.transform=opening?'translateX(-25%)':'translateX(0)';
  conversation.style.transform=opening?'translateX(0)':'translateX(100%)';
  setTimeout(()=>transitions.forEach(element=>{element.style.removeProperty('transition');element.style.removeProperty('transform')}),duration);
}
function connectRealtime(){if(!session)return;if(typeof io==='undefined'){if(!document.querySelector('#socket-client')){const script=document.createElement('script');script.id='socket-client';script.src=`${API_URL}/socket.io/socket.io.js`;script.onload=connectRealtime;document.head.append(script)}return}realtimeSocket?.disconnect();realtimeSocket=io(API_URL,{auth:{token:session.accessToken},reconnection:true,reconnectionAttempts:Infinity,reconnectionDelay:800,reconnectionDelayMax:8000});realtimeSocket.on('connect',()=>{document.body.classList.remove('realtime-offline');loadNotificationCount()});realtimeSocket.on('disconnect',()=>document.body.classList.add('realtime-offline'));realtimeSocket.on('notification',async(item)=>{unreadNotifications+=1;renderBadge();toast(item.title);if(document.visibilityState==='hidden'&&Notification.permission==='granted')new Notification(item.title,{body:item.body});if(activeScreen==='chatScreen'&&['CHAT_MESSAGE','DIRECT_MESSAGE'].includes(item.type))await chatScreen()});realtimeSocket.on('notifications:changed',loadNotificationCount)}
async function loadNotificationCount(){try{const data=await api('/notifications');unreadNotifications=data.unreadCount;renderBadge();return data}catch{return null}}
function renderBadge(){const badge=document.querySelector('.notification-badge');if(badge){badge.textContent=unreadNotifications>99?'99+':String(unreadNotifications);badge.classList.toggle('hidden',!unreadNotifications)}}
function showPageLoadingOverlay(label='読み込んでいます'){
  document.querySelector('.page-loading-overlay')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="sheet page-loading-overlay" role="status" aria-live="polite"><section><span></span><b>${safeText(label)}</b></section></div>`);
  const overlay=document.querySelector('.page-loading-overlay');
  return()=>overlay?.remove();
}

async function api(path, options = {}) {
  if(path==='/users/me'&&options.method==='PATCH'&&document.querySelector('.profile-editor-sheet')&&typeof options.body==='string'){
    const editor=document.querySelector('.profile-editor-sheet');const payload=JSON.parse(options.body);
    payload.avoidPreferences=[...editor.querySelectorAll('[data-match-avoid].chosen')].map(button=>button.dataset.matchAvoid);
    payload.scheduleFlexibility=[...editor.querySelectorAll('[data-match-flexibility].chosen')].map(button=>button.dataset.matchFlexibility);
    payload.behaviorLearningEnabled=editor.querySelector('#edit-behavior-learning')?.checked===true;
    payload.preferredLanguages=[...editor.querySelectorAll('[data-match-language].chosen')].map(button=>button.dataset.matchLanguage);
    options={...options,body:JSON.stringify(payload)};
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers: { 'content-type': 'application/json', ...(session?.accessToken ? { authorization: `Bearer ${session.accessToken}` } : {}), ...options.headers } });
  if(response.status===401&&session?.refreshToken&&!options._retried){const refreshed=await fetch(`${API_URL}/auth/refresh`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({refreshToken:session.refreshToken})});if(refreshed.ok){session=await refreshed.json();saveSession();connectRealtime();return api(path,{...options,_retried:true})}localStorage.removeItem(SESSION_STORAGE_KEY);session=null;authScreen();throw new Error('セッションの有効期限が切れました')}
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(Array.isArray(data?.message) ? data.message[0] : data?.message || 'APIへ接続できませんでした');
  return data;
}
async function trackBehavior(eventType,hangoutId){if(!session?.user?.matchingDataConsent||!session.user.behaviorLearningEnabled)return;const key=`${eventType}:${hangoutId||''}`;if(behaviorEventsSent.has(key))return;behaviorEventsSent.add(key);try{await api('/analytics/events',{method:'POST',body:JSON.stringify({eventType,...(hangoutId?{hangoutId}:{})})})}catch{behaviorEventsSent.delete(key)}}
function hangoutView(h, index = 0) {
  return { id:h.id, hostUserId:h.hostUserId, status:h.status, startAt:h.startAt, category:h.category, publicLocationName:h.publicLocationName, icon:{FOOD:'🍜',RUNNING:'🏃',CAFE:'☕',MOTORCYCLE:'🏍️',WALKING:'🚶'}[h.category]||'✨', title:h.title, time:timeLabel(h.startAt), place:h.locationName, imageUrl:h.imageUrl, meetingPlaceName:h.meetingPlaceName, meetingAddress:h.meetingAddress, navigationUrl:h.navigationUrl, latitude:h.latitude,longitude:h.longitude,publicLatitude:h.publicLatitude,publicLongitude:h.publicLongitude,locationPrecision:h.locationPrecision,distanceKm:h.distanceKm,current:h.participantCount, max:h.maxParticipants, hostMaleCount:h.hostMaleCount, hostFemaleCount:h.hostFemaleCount, hostParticipantCount:h.hostParticipantCount, acceptedParticipants:h.acceptedParticipants||[], genderRestriction:h.genderRestriction, maxAge:h.maxAge, host:h.host.displayName, hostPhoto:h.host.profilePhoto, hostPhotos:h.host.profilePhotos||[], hostStatus:h.host.hostStatus, verified:h.host.verification==='PHONE_VERIFIED', rating:h.host.hostStatus?.hostAverageRating?`主催評価 ★ ${h.host.hostStatus.hostAverageRating}`:'主催評価なし', match:Number.isFinite(h.matchScore)?h.matchScore:70, photo:index%4, desc:h.description||'', hot:timeLabel(h.startAt)==='30分後', myJoinStatus:h.myJoinStatus, hearted:h.hearted, heartCount:h.heartCount||0 };
}
async function loadHangouts() {
  if (!session) return;
  const query=userLocation?`?latitude=${userLocation.latitude}&longitude=${userLocation.longitude}&radiusKm=50`:'';
  const rows = await api(`/hangouts${query}`);
  hangouts.splice(0, hangouts.length, ...rows.map(hangoutView));
  void trackBehavior('DISCOVERY_VIEWED');
}
function timeLabel(startAt){const minutes=Math.max(0,Math.round((new Date(startAt)-Date.now())/60000));return minutes<=45?'30分後':minutes<=90?'1時間後':'3時間後'}
function countdownLabel(startAt){const seconds=Math.max(0,Math.ceil((new Date(startAt)-Date.now())/1000));if(seconds===0)return'開始時刻です';const hours=String(Math.floor(seconds/3600)).padStart(2,'0');const minutes=String(Math.floor(seconds%3600/60)).padStart(2,'0');const rest=String(seconds%60).padStart(2,'0');return`開始まで ${hours}:${minutes}:${rest}`}
function refreshCountdowns(){document.querySelectorAll('.card[data-id]').forEach(card=>{const hangout=hangouts.find(item=>String(item.id)===card.dataset.id);const label=card.querySelector('.card-body .meta span');if(hangout&&label)label.textContent=hangout.status==='STARTED'?'Hangout中':hangout.status==='FINISHED'?'終了':countdownLabel(hangout.startAt)});document.querySelectorAll('[data-keyword-hangout]').forEach(tile=>{const hangout=hangouts.find(item=>String(item.id)===tile.dataset.keywordHangout);const label=tile.querySelector('.keyword-tile-time');if(hangout&&label)label.textContent=hangout.status==='STARTED'?'Hangout中':hangout.status==='FINISHED'?'終了':countdownLabel(hangout.startAt)});document.querySelectorAll('.hangout-detail-sheet[data-hangout-id]').forEach(sheet=>{const hangout=hangouts.find(item=>String(item.id)===sheet.dataset.hangoutId);const label=sheet.querySelector('.detail-time');if(hangout&&label)label.textContent=`${hangout.status==='STARTED'?'Hangout中':hangout.status==='FINISHED'?'終了':countdownLabel(hangout.startAt)} ・ 相性 ${hangout.match}%`})}
setInterval(refreshCountdowns,1000);

function authScreen(mode = 'login') {
  const register = mode === 'register';
  const demoChoices = DEMO_ACCOUNTS ? `<section class="demo-entry"><span class="demo-label">公開デモ・すべて架空のデータです</span><h2>役割を選んですぐに体験</h2><p>登録や電話番号入力は必要ありません。</p><div class="demo-buttons"><button data-demo-role="host"><b>サヤカ（主催者）として見る</b><small>30代女性・飲み企画を管理</small></button><button data-demo-role="guest"><b>マドカ（参加者）として見る</b><small>30代女性・Hangoutを探す</small></button></div><div id="demo-error" class="auth-error"></div></section>` : '';
  const providerAction = register ? 'でアカウント作成' : 'でログイン';
  const genderChoices = register ? `<label>性別</label><div class="auth-gender-choices">${[['UNDISCLOSED','回答しない'],['MALE','男性'],['FEMALE','女性'],['OTHER','その他']].map(([value,label])=>`<button type="button" data-auth-gender="${value}" class="${value==='UNDISCLOSED'?'chosen':''}">${label}</button>`).join('')}</div>` : '';
  const authDivider = '<div class="auth-divider"><span>または</span></div>';
  const providerSection = `<div class="auth-providers" aria-label="その他の認証方法"><button type="button" data-auth-provider="Google"><span class="provider-mark google-mark">G</span>Google${providerAction}</button><button type="button" data-auth-provider="Apple"><span class="provider-mark apple-mark">●</span>Apple${providerAction}</button><button type="button" data-auth-provider="X"><span class="provider-mark">X</span>X${providerAction}</button><button type="button" data-auth-provider="LINE"><span class="provider-mark line-mark">L</span>LINE${providerAction}</button><button type="button" data-auth-provider="電話番号"><span class="provider-mark phone-mark">☎</span>電話番号${providerAction}</button></div><div id="provider-auth-note" class="provider-auth-note" role="status"></div>`;
  const emailSection = `<form id="auth-form"><label>メールアドレス</label><input id="email" type="email" autocomplete="email" required>${register ? '<label>表示名</label><input id="display-name" autocomplete="nickname" maxlength="40" required><label>生年月日</label><input id="birth-date" type="date" required value="1990-01-01"><label>プロフィール画像（任意・3枚まで）</label><input id="register-photo" type="file" accept="image/jpeg,image/png,image/webp" multiple><small class="registration-photo-note">1枚目を中央のメイン画像、2・3枚目を左右に表示します。</small>' : ''}${genderChoices}<label>パスワード</label><input id="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="12" required><div id="auth-error" class="auth-error"></div><button class="primary" type="submit">${register ? '無料で登録' : 'ログイン'}</button></form>`;
  const switchAuth = `<button class="secondary" id="switch-auth">${register ? 'アカウントをお持ちの方はログイン' : '新しくアカウントを作る'}</button>`;
  const authenticationChoices = register ? `${switchAuth}${authDivider}${providerSection}${authDivider}${emailSection}` : `${providerSection}${authDivider}${emailSection}${switchAuth}`;
  app.innerHTML = `<main class="phone auth-page"><div class="auth-brand">Hangout <i>Now</i></div><div class="auth-visual"><span>🍜</span><span>🏃</span><span>☕</span></div>${demoChoices}<section class="auth-card"><div class="eyebrow">今から、誰かと。</div><h1>${register ? 'アカウントを作る' : 'おかえりなさい'}</h1>${authenticationChoices}<small>登録により利用規約とプライバシーポリシーに同意します。</small><div class="policy-links"><a href="/privacy.html">プライバシー</a><a href="/terms.html">利用規約</a><a href="/community-guidelines.html">ガイドライン</a><a href="/delete-account.html">アカウント削除</a></div></section></main>`;
  const lineProviderButton=document.querySelector('[data-auth-provider="LINE"]');
  if(lineProviderButton)lineProviderButton.innerHTML=`<span class="provider-mark line-mark">L</span><span class="provider-copy"><b>LINEアプリ${providerAction}</b><small>LINEアプリが開きます</small></span>`;
  let gender='UNDISCLOSED';
  document.querySelectorAll('[data-auth-gender]').forEach((button)=>button.onclick=()=>{gender=button.dataset.authGender;document.querySelectorAll('[data-auth-gender]').forEach(item=>item.classList.toggle('chosen',item===button))});
  document.querySelectorAll('[data-demo-role]').forEach((button)=>button.onclick=()=>demoLogin(button.dataset.demoRole,button));
  if(DEMO_ACCOUNTS){
    document.querySelector('.auth-card')?.remove();
    return;
  }
  document.querySelectorAll('[data-auth-provider]').forEach((button)=>button.onclick=async()=>{const provider=button.dataset.authProvider;if(provider==='電話番号'){phoneAuthDialog();return}if(!['Google','Apple','X','LINE'].includes(provider)){document.querySelector('#provider-auth-note').textContent=`${provider}認証は現在利用できません。`;return}const input=null;try{const providerKey=provider.toLowerCase();sessionStorage.setItem('hangout-now-oauth-input','null');const returnTo=`${location.origin}${location.pathname}`;location.assign(`${API_URL}/auth/${providerKey}/start?returnTo=${encodeURIComponent(returnTo)}`)}catch(error){button.disabled=false;document.querySelector('#provider-auth-note').textContent=error.message}});
  document.querySelector('#switch-auth').onclick = () => authScreen(register ? 'login' : 'register');
  document.querySelector('#auth-form').onsubmit = async (event) => { event.preventDefault(); const button=event.submitter; button.disabled=true; button.textContent='接続中…'; const body={email:document.querySelector('#email').value.trim(),password:document.querySelector('#password').value}; try{if(register){Object.assign(body,{displayName:document.querySelector('#display-name').value.trim(),birthDate:document.querySelector('#birth-date').value,gender});const files=[...document.querySelector('#register-photo').files];if(files.length>3)throw new Error('プロフィール画像は3枚まで選択できます');if(files.length)body.profilePhotos=await Promise.all(files.map(imageData))}session=await api(register?'/auth/register':'/auth/login',{method:'POST',body:JSON.stringify(body)});demoRole=null;localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);saveSession();connectRealtime();await Promise.all([loadNotificationCount(),loadHangouts()]);if(register)await profileScreen();else navigate('home')}catch(error){document.querySelector('#auth-error').textContent=error.message;button.disabled=false;button.textContent=register?'無料で登録':'ログイン'} };
  void redeemOAuthTicket();
}

async function redeemOAuthTicket(){
  const ticket=new URL(location.href).searchParams.get('ticket');
  if(!ticket)return;
  const requestedProvider=new URL(location.href).searchParams.get('provider');
  const provider=['google','apple','x'].includes(requestedProvider)?requestedProvider:'line';
  const providerLabel=provider==='google'?'Google':provider==='apple'?'Apple':provider==='x'?'X':'LINE';
  const note=document.querySelector('#provider-auth-note');
  if(note)note.textContent=`${providerLabel}認証を確認しています…`;
  const stored=sessionStorage.getItem('hangout-now-oauth-input')||sessionStorage.getItem('hangout-now-line-input');
  let input=null;try{input=stored?JSON.parse(stored):null}catch{input=null}
  history.replaceState({},'',location.pathname);
  try{const result=await api(`/auth/${provider}/redeem`,{method:'POST',body:JSON.stringify({ticket,...(input||{})})});if(result.registrationRequired){sessionStorage.setItem('hangout-now-oauth-pending',JSON.stringify({provider,ticket,displayName:result.displayName||''}));authScreen('register');const displayName=document.querySelector('#display-name');if(displayName&&!displayName.value)displayName.value=result.displayName||'';const registrationNote=document.querySelector('#provider-auth-note');if(registrationNote)registrationNote.textContent=`表示名と生年月日を入力し、「${providerLabel}でアカウント作成」を押してください。LINE認証をやり直す必要はありません。`;return}session=result;demoRole=null;sessionStorage.removeItem('hangout-now-oauth-pending');sessionStorage.removeItem('hangout-now-oauth-input');sessionStorage.removeItem('hangout-now-line-input');localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);saveSession();connectRealtime();await Promise.all([loadNotificationCount(),loadHangouts()]);navigate('home')}catch(error){if(note)note.textContent=error.message}
}

function normalizeJapanesePhone(value){const compact=value.normalize('NFKC').replace(/[\s()（）\-‐‑‒–—―ー]/g,'');if(/^0\d{9,10}$/.test(compact))return`+81${compact.slice(1)}`;return compact}
function phoneAuthDialog(){document.body.insertAdjacentHTML('beforeend',`<div class="sheet phone-auth-sheet"><section class="panel"><div class="handle"></div><h2>電話番号で続ける</h2><p>SMSで届く6桁の認証コードを入力してください。</p><label>携帯電話番号</label><input id="auth-phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09012345678"><small>090・080・070から、そのまま入力できます。</small><small id="auth-phone-help" role="status" aria-live="polite"></small><div id="auth-phone-code-area" class="hidden"><label>6桁の認証コード</label><input id="auth-phone-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"></div><button class="primary" id="auth-phone-action">認証コードを送る</button><button class="secondary" id="auth-phone-close">キャンセル</button></section></div>`);const sheet=document.querySelector('.phone-auth-sheet');const action=sheet.querySelector('#auth-phone-action');const help=sheet.querySelector('#auth-phone-help');let challengeToken=null;let requestedPhone=null;sheet.querySelector('#auth-phone-close').onclick=()=>sheet.remove();action.onclick=async()=>{action.disabled=true;help.textContent='';try{const phone=normalizeJapanesePhone(sheet.querySelector('#auth-phone').value.trim());if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error('携帯電話番号を正しく入力してください');if(!challengeToken){const result=await api('/auth/phone/request',{method:'POST',body:JSON.stringify({phone})});requestedPhone=phone;challengeToken=result.challengeToken;sheet.querySelector('#auth-phone').value=phone;sheet.querySelector('#auth-phone').disabled=true;sheet.querySelector('#auth-phone-code-area').classList.remove('hidden');help.textContent=result.demoCode?`開発用コード：${result.demoCode}`:'SMSに認証コードを送信しました';action.textContent='アカウント作成・ログイン';return}const result=await api('/auth/phone/confirm',{method:'POST',body:JSON.stringify({phone:requestedPhone,challengeToken,code:sheet.querySelector('#auth-phone-code').value.trim()})});session=result;demoRole=null;localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);saveSession();connectRealtime();sheet.remove();await Promise.all([loadNotificationCount(),loadHangouts()]);navigate('home')}catch(error){help.textContent=error.message}finally{action.disabled=false}}}

async function demoLogin(role, button) {
  if (!DEMO_ACCOUNTS?.[role]) return;
  const original = button.innerHTML;
  document.querySelectorAll('[data-demo-role]').forEach((item)=>item.disabled=true);
  const slowTimer = setTimeout(()=>{button.innerHTML='<b>デモを起動中…</b><small>初回は10〜30秒ほどかかる場合があります</small>'},5000);
  button.innerHTML = '<b>ログイン中…</b><small>公開デモを準備しています</small>';
  try {
    session = null;
    try {
      session = await api('/auth/demo-login',{method:'POST',body:JSON.stringify({role})});
    } catch(firstError) {
      button.innerHTML='<b>再接続中…</b><small>デモサーバーの起動を待っています</small>';
      await new Promise((resolve)=>setTimeout(resolve,2000));
      session = await api('/auth/demo-login',{method:'POST',body:JSON.stringify({role})}).catch(()=>{throw firstError});
    }
    clearTimeout(slowTimer);
    demoRole = role;
    localStorage.setItem(DEMO_ROLE_STORAGE_KEY,role);
    saveSession();
    connectRealtime();
    navigate('home');
    await Promise.allSettled([loadNotificationCount(),loadHangouts()]);
    if(activeScreen==='home')home();
  } catch(error) {
    clearTimeout(slowTimer);
    document.querySelector('#demo-error').textContent=error.message;
    document.querySelectorAll('[data-demo-role]').forEach((item)=>item.disabled=false);
    button.innerHTML=original;
  }
}

function shell(content, showFab = true) {
  const demoGuide=demoRole==='host'?'作成・承認・終了・★1〜5評価を操作':'参加申請・トーク・★1〜5評価を操作';
  const demoBanner=demoRole?`<div class="demo-banner"><span><b>デモ：${demoRole==='host'?'サヤカ（主催者）':'マドカ（参加者）'}として体験中</b><small>${demoGuide}</small></span><div><button id="reset-demo">最初から</button><button id="switch-demo-role">役割切替</button></div></div>`:'';
  app.innerHTML = `<main class="phone">${demoBanner}<header class="top"><div class="brand">Hangout <i>Now</i></div><div class="header-actions"><button class="notification-button" aria-label="通知"><span class="notification-mark"></span><span class="notification-badge ${unreadNotifications?'':'hidden'}">${unreadNotifications}</span></button><button class="profile-menu-button" aria-label="自分のプロフィールを表示"><span class="avatar"${photoStyle(session.user.profilePhoto)}>${session.user.profilePhoto?'':safeText(session.user.displayName).slice(0,1)}</span></button></div></header>${content}${showFab ? '<button class="fab" aria-label="Hangoutを作る">＋</button>' : ''}</main>`;
  const switchDemoRole=app.querySelector('#switch-demo-role');
  if(switchDemoRole)switchDemoRole.onclick=()=>{realtimeSocket?.disconnect();session=null;demoRole=null;localStorage.removeItem(SESSION_STORAGE_KEY);localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);authScreen('login')};
  const resetDemo=app.querySelector('#reset-demo');if(resetDemo)resetDemo.onclick=resetPublicDemo;
  const fab = app.querySelector('.fab');
  if (fab) fab.onclick = showCreate;
  app.querySelector('.notification-button').onclick=notificationScreen;
  app.querySelector('.profile-menu-button').onclick=profileScreen;
}

function hangoutState(h){return h.status==='STARTED'?'Hangout中':h.myJoinStatus==='PENDING'?'申請中':h.myJoinStatus==='WAITLISTED'?'待機中':h.myJoinStatus==='ACCEPTED'?'承認済み':h.status==='FULL'?'満員':'募集中'}
function keywordGroup(keywordId){return HANGOUT_KEYWORD_GROUPS.find(group=>group.id===keywordId)}
function hangoutsForKeyword(group){return group?hangouts.filter(hangout=>group.categories.includes(hangout.category)):[]}
function keywordTile(h,index){
  const state=hangoutState(h);const location=h.publicLocationName||h.place||'エリア未設定';const label=`${h.title}、${state}、${h.time}、${location}、相性${h.match}%`;
  return `<button class="keyword-hangout-tile ${index===0?'featured':''}" type="button" data-keyword-hangout="${safeText(h.id)}" aria-label="${safeText(label)}"><span class="keyword-tile-photo ${hangoutPhotoClass(h)}"${photoStyle(h.imageUrl)}></span><span class="keyword-tile-status">${state}</span><span class="keyword-tile-match">${h.match}%</span><span class="keyword-tile-copy"><b>${safeText(h.title)}</b><small><span class="keyword-tile-time">${safeText(h.time)}</span> ・ ${safeText(location)}</small></span></button>`;
}
function bindFullHangoutCards(refresh,returnKeywordId){
  document.querySelectorAll('[data-heart]').forEach(button=>button.onclick=async event=>{event.stopPropagation();button.disabled=true;try{const result=await api(`/hangouts/${button.dataset.heart}/heart`,{method:'POST'});const hangout=hangouts.find(item=>String(item.id)===button.dataset.heart);if(hangout)Object.assign(hangout,result);refresh();toast(result.hearted?'ハートを送りました':'ハートを取り消しました')}catch(error){button.disabled=false;toast(error.message)}});
  document.querySelectorAll('.card').forEach(cardElement=>cardElement.onclick=()=>detail(cardElement.dataset.id,null,returnKeywordId?{returnKeywordId}:{}));
}
function home() {
  activeScreen = 'home';
  const groups=HANGOUT_KEYWORD_GROUPS.map(group=>({group,items:hangoutsForKeyword(group)})).filter(section=>section.items.length);
  const journey=demoRole?`<section class="demo-journey"><b>デモ：サヤカの飲み企画</b><ol><li>主催者は30代女性のサヤカ</li><li>20代男性のマサヤは承認済み</li><li>30代女性のマドカはHangoutを検索中</li><li>マドカが途中参加を申請</li><li>承認後はグループトークで会話</li></ol><small>「サヤカと新宿で気軽に飲もう」を開いて試せます。</small></section>`:'';
  const keywordSections=groups.map(({group,items})=>`<section class="keyword-section" aria-labelledby="keyword-${group.id}"><button class="keyword-title" id="keyword-${group.id}" type="button" data-keyword="${group.id}"><span><b>${group.label}</b><small>${group.description}</small></span><i>すべて見る　›</i></button><div class="keyword-mosaic">${items.slice(0,6).map(keywordTile).join('')}</div></section>`).join('');
  shell(`${journey}<section class="hero"><div class="eyebrow">${userLocation?.label||'エリア未設定'}</div><h1>今から何する？</h1><button id="create-hangout" class="create-hangout-button" type="button">Hangoutを作る</button><div class="location-tools"><button id="use-location">現在地を使う</button><select id="manual-area"><option value="">エリアを選択</option>${Object.keys(areas).map(a=>`<option ${userLocation?.label===a?'selected':''}>${a}</option>`).join('')}</select></div></section><section class="keyword-discovery"><header class="keyword-discovery-head"><div><small>キーワードから探す</small><h2>気分に合うHangout</h2></div><button id="open-nearby-map" class="map-shortcut" type="button" aria-label="近くのHangoutをマップで表示"><span></span></button></header>${keywordSections||'<div class="empty">近くのHangoutはまだありません。<br>エリアを変更して探してみてください。</div>'}</section>`, false);
  document.querySelector('#create-hangout').onclick=showCreate;
  document.querySelector('#use-location').onclick=useCurrentLocation;
  document.querySelector('#manual-area').onchange=async(event)=>{const name=event.target.value;if(!name)return;userLocation={...areas[name],label:name,source:'manual'};persist();await loadHangouts();home()};
  document.querySelector('#open-nearby-map').onclick=googleMapScreen;
  document.querySelectorAll('[data-keyword]').forEach(button=>button.onclick=()=>keywordHangoutList(button.dataset.keyword));
  document.querySelectorAll('[data-keyword-hangout]').forEach(button=>button.onclick=()=>detail(button.dataset.keywordHangout));
  refreshCountdowns();
}

function keywordHangoutList(keywordId){
  const group=keywordGroup(keywordId);if(!group){home();return}activeScreen='keyword';const items=hangoutsForKeyword(group);
  shell(`<section class="page-title keyword-page-title"><button class="brand-back" id="keyword-home" type="button" aria-label="キーワード一覧に戻る"><span></span></button><div><div class="eyebrow">キーワード</div><h1>${group.label}</h1></div></section><div class="keyword-list-lead"><p>${group.description}</p><span>${items.length}件・おすすめ順</span></div><section class="cards keyword-list-cards">${items.length?items.map(card).join(''):'<div class="empty">このキーワードのHangoutはまだありません。</div>'}</section>`,false);
  document.querySelector('#keyword-home').onclick=home;bindFullHangoutCards(()=>keywordHangoutList(keywordId),keywordId);refreshCountdowns();
}

function card(h) {
  const requested = ['PENDING','ACCEPTED','WAITLISTED'].includes(h.myJoinStatus);
  const conditions=`${{ANY:'だれでも',MALE_ONLY:'男性のみ',FEMALE_ONLY:'女性のみ'}[h.genderRestriction]||'だれでも'}${h.maxAge?`・${h.maxAge===29?'20代':h.maxAge===39?'30代':'50代'}まで`:''}`;
  const state=hangoutState(h);
  return `<article class="card ${requested ? 'requested' : ''}" data-id="${h.id}"><div class="card-photo ${hangoutPhotoClass(h)}"${photoStyle(h.imageUrl)} role="img" aria-label="${safeText(h.title)}のイメージ写真"></div><button class="heart-button ${h.hearted?'on':''}" type="button" data-heart="${h.id}" aria-label="${h.hearted?'ハートを取り消す':'ハートを送る'}"><b>${h.hearted?'♥':'♡'}</b><span>${h.heartCount||0}</span></button><div class="card-status">${state}</div><div class="card-body"><div class="card-top"><div>${h.category?`<div class="card-category">${CATEGORY_LABELS[h.category]||safeText(h.category)}</div>`:''}<h3>${h.title}</h3><div class="meta"><span class="${h.hot ? 'hot' : ''}">${h.time}</span>${h.distanceKm!==null&&h.distanceKm!==undefined?` ・ ${h.distanceKm}km`:''}</div>${h.publicLocationName?`<div class="meta card-public-location">${safeText(h.publicLocationName)}</div>`:''}<div class="meta people" style="margin-top:5px">参加 ${h.current} / ${h.max}人 ・ ${conditions} ${h.distanceKm>10?'<b class="far">・遠め</b>':''}</div></div></div><div class="card-bottom"><div class="host"><span class="mini ${portraitClass(h.photo)}"${photoStyle(h.hostPhoto)} aria-label="${h.host}のプロフィール写真"></span><span>${h.host} ${h.verified?'・確認済み':''}<br><b class="host-tier tier-${(h.hostStatus?.tier||'WHITE').toLowerCase()}">${h.hostStatus?.label||'ホワイト'}</b> ・ ${h.rating}</span></div><span class="match">相性 ${h.match}%</span></div></div></article>`;
}

async function resetPublicDemo(){if(!confirm('共有デモを初期状態へ戻します。デモ用の募集・申請・トーク・評価がリセットされます。実ユーザーのデータには影響しません。'))return;try{await api('/demo/reset',{method:'POST'});joined.clear();Object.keys(chats).forEach(key=>delete chats[key]);persist();await loadHangouts();home();toast('デモを最初の状態に戻しました')}catch(error){toast(error.message)}}

async function useCurrentLocation(){if(!navigator.geolocation){toast('現在地を取得できないため、エリアを選択してください');return}navigator.geolocation.getCurrentPosition(async(pos)=>{userLocation={latitude:pos.coords.latitude,longitude:pos.coords.longitude,label:'現在地周辺',source:'gps'};persist();await loadHangouts();home();toast('現在地から近い順に並べました')},()=>toast('位置情報を許可するか、エリアを選択してください'),{enableHighAccuracy:false,timeout:8000,maximumAge:300000})}

async function detail(id, sourceScreen = null, options = {}) {
  const returnToProfile=Boolean(sourceScreen?.classList.contains('profile-screen'));
  const returnKeywordId=options.returnKeywordId;
  let profileLoading=null;
  if(returnToProfile){sourceScreen.classList.add('profile-behind-hangout');document.body.insertAdjacentHTML('beforeend','<div class="sheet profile-hangout-loading" role="status" aria-live="polite"><section><span></span><b>Hangoutを読み込んでいます</b></section></div>');profileLoading=document.querySelector('.profile-hangout-loading')}
  const returnAfterDeletion=async()=>{await loadHangouts();await profileScreen({animate:false})};
  let h = hangouts.find((item) => String(item.id) === String(id));
  if (!h) {
    try {
      h = hangoutView(await api(`/hangouts/${id}`), hangouts.length);
    } catch (error) {
      profileLoading?.remove();
      sourceScreen?.classList.remove('profile-behind-hangout');
      toast(error.message);
      return;
    }
  }
  void trackBehavior('HANGOUT_VIEWED',h.id);
  const requested = ['PENDING','ACCEPTED','WAITLISTED'].includes(h.myJoinStatus);
  const mine=h.hostUserId===session.user.id||h.host===session.user.displayName;
  let requests=[];
  if(mine){try{requests=await api(`/hangouts/${id}/requests`)}catch(error){toast(error.message)}}
  let detailRatingMembers=[];
  if(h.status==='FINISHED'&&(mine||h.myJoinStatus==='ACCEPTED')){try{const rooms=await api('/chat-rooms');detailRatingMembers=(rooms.find(room=>room.hangout.id===id)?.members||[]).filter(member=>member.id!==session.user.id&&!member.myRatingScore)}catch(error){toast(error.message)}}
  const state=h.status==='FINISHED'?'終了':h.status==='STARTED'?'Hangout中':h.myJoinStatus==='PENDING'?'申請中':h.myJoinStatus==='WAITLISTED'?'待機中':h.myJoinStatus==='ACCEPTED'?'承認済み':h.status==='FULL'?'満員':'募集中';
  const conditionText=`${{ANY:'だれでも',MALE_ONLY:'男性のみ',FEMALE_ONLY:'女性のみ'}[h.genderRestriction]||'だれでも'} ・ ${h.maxAge?h.maxAge===29?'20代まで':h.maxAge===39?'30代まで':'50代まで':'年齢制限なし'}`;
  const chatAvailable=h.myJoinStatus==='ACCEPTED'||(mine&&h.current>1);
  const hangoutChatButton=chatAvailable?'<button class="flow-chat-button inline-chat-button" id="open-flow-chat">トーク</button>':'';
  const approvedRows=(h.acceptedParticipants||[]).map((member,index)=>`<button class="approved-member-row" type="button" data-approved-profile="${index}" aria-label="${safeText(member.displayName)}のプロフィールを見る"><span class="request-avatar"${photoStyle(member.profilePhoto)}>${member.profilePhoto?'':safeText(member.displayName).slice(0,1)}</span><span><b>${safeText(member.displayName)}</b><small>${member.gender==='MALE'?'男性':member.gender==='FEMALE'?'女性':'性別非公開'} ・ ${member.verification==='PHONE_VERIFIED'?'電話確認済み':'本人確認前'}</small></span><i aria-hidden="true">›</i></button>`).join('');
  const participantOverview=`<section class="approved-members"><h3>参加メンバー</h3><small>主催者 1人</small>${approvedRows||'<p class="empty">承認済みの参加者はまだいません。</p>'}</section>`;
  const detailRatingSection=detailRatingMembers.length?`<section class="detail-rating-section"><div class="eyebrow">HANGOUT終了後</div><h3>主催者・参加者を評価</h3><p>一緒に過ごしたメンバーを★1〜5で評価できます。送信後は変更できません。</p><div class="hangout-rating-members">${detailRatingMembers.map(member=>`<article class="hangout-rating-member"><b>${safeText(member.displayName)}</b><small>${member.id===h.hostUserId?'主催者として評価':'参加者として評価'}</small><div class="rating-stars compact">${[1,2,3,4,5].map(score=>`<button type="button" data-detail-rating="${member.id}" data-score="${score}" class="${member.myRatingScore===score?'selected':''}" aria-label="${safeText(member.displayName)}を星${score}で評価">${score}★</button>`).join('')}</div><em>${member.myRatingScore?`評価済み ★${member.myRatingScore}`:'評価を選択してください'}</em></article>`).join('')}</div><button class="primary detail-rating-complete" type="button" data-detail-finish-ratings>評価完了</button></section>`:'';
  const navigationButton=(h.locationPrecision==='EXACT'?`<section class="exact-meeting-place"><b>店名</b><span>${safeText(h.meetingPlaceName||h.place)}</span><b>住所</b><span>${safeText(h.meetingAddress||h.place)}</span><button class="navigation-button" id="open-navigation">地図アプリでナビ開始</button></section>`:'')+participantOverview;
  const requestList=mine?`<section class="inline-requests"><div class="inline-requests-head"><div><small>参加申請</small><h3>参加したいメンバー</h3></div><span>${requests.filter(request=>request.status==='PENDING').length}件の判断待ち</span></div>${requests.length?requests.map(request=>`<article class="request-row"><button class="request-person" type="button" data-request-profile="${request.id}" aria-label="${safeText(request.user.displayName)}のプロフィールを見る"><span class="request-avatar"${photoStyle(request.user.profilePhoto)}>${request.user.profilePhoto?'':safeText(request.user.displayName).slice(0,1)}</span><div><b>${safeText(request.user.displayName)}</b><small>${request.user.verification==='PHONE_VERIFIED'?'✓ 電話確認済み':'本人確認前'}</small></div></button><p>${safeText(request.message||'メッセージなし')}</p>${request.status==='PENDING'?`<div class="request-decisions"><button class="reject" data-reject="${request.id}">却下</button><button class="approve" data-accept="${request.id}">承認</button></div>`:`<strong class="request-result">${{ACCEPTED:'承認済み',REJECTED:'却下済み',WAITLISTED:'待機中',CANCELLED:'キャンセル'}[request.status]||safeText(request.status)}</strong>`}</article>`).join(''):'<div class="empty inline-request-empty">参加申請はまだありません。</div>'}</section>`:'';
  const matchFeedbackSection=!mine&&!requested&&session.user.matchingDataConsent?'<section class="match-feedback"><small>この募集が合わない場合</small><button class="outline" id="not-a-match" type="button">合わない理由を送る</button></section>':'';
   document.body.insertAdjacentHTML('beforeend', `<div class="sheet hangout-detail-sheet hangout-flow detail-open"><aside class="hangout-flow-list"><header><b>近くのHangout</b><button id="close-flow">一覧を閉じる</button></header>${hangouts.map(item=>`<button class="flow-list-row ${item.id===id?'active':''}" data-flow-hangout="${item.id}"><span class="map-list-photo activity-photo-${item.photo%4}"></span><span><strong>${safeText(item.title)}</strong><small>${safeText(item.time)} ・ ${safeText(item.place)}</small></span></button>`).join('')}</aside><section class="panel hangout-detail-panel"><header class="hangout-detail-nav"><button id="close" class="brand-back" type="button" aria-label="Hangout一覧に戻る"><span></span></button><b>Hangout</b><span></span></header><main class="hangout-detail-content"><div class="hangout-hero-photo activity-photo-${h.photo%4}"></div><div class="hangout-state">${state}</div><div class="detail-head"><div class="detail-photo ${portraitClass(h.photo)}"${photoStyle(h.hostPhoto)} role="button" tabindex="0" aria-label="${h.host}のプロフィール画像を見る"></div><div><strong>${h.host}</strong><div class="meta">${h.rating} ${h.verified?'・電話確認済み':'・本人確認前'}</div></div></div><div class="eyebrow detail-time">${h.time} ・ 相性 ${h.match}%</div><h2>${h.title}</h2><p>${h.desc}</p><div class="condition-panel"><small>参加条件</small><strong>${conditionText}</strong></div><div class="info"><b>集合場所</b>　${h.place}${h.distanceKm!==null&&h.distanceKm!==undefined?`（約${h.distanceKm}km）`:''}<br><b>参加人数</b>　${h.current} / ${h.max}人<br><b>主催者</b>　${h.host}　${h.rating}<br>${h.locationPrecision==='EXACT'?'承認済み：店名・住所・正確な位置を表示':'承認前：概略エリアのみ表示'}</div>${navigationButton}${h.distanceKm>10?'<div class="distance-warning">移動距離が長めです。開始時刻に間に合うか確認してください。</div>':''}${hangoutChatButton}${detailRatingSection}${requestList}${mine?`<div class="owner-actions"><button id="edit-hangout">Hangout編集</button><button id="delete-hangout-active">Hangout削除</button>${['OPEN','FULL'].includes(h.status)?`<button id="start-hangout" ${(h.acceptedParticipants||[]).length?'':'disabled'}>Hangout開始</button>${(h.acceptedParticipants||[]).length?'':'<small class="start-disabled-note">参加メンバーを承認すると開始できます。</small>'}`:''}${h.status==='STARTED'?'<button id="finish-hangout">Hangout終了</button>':''}</div>`:''}</main><footer class="hangout-detail-action">${mine?'':h.status==='FINISHED'?'':`<button class="primary" id="join" ${requested ? 'disabled' : ''}>${requested ? ({PENDING:'申請中',WAITLISTED:'待機中',ACCEPTED:'承認済み',REJECTED:'拒否'}[h.myJoinStatus]||'参加申請済み') : '参加したい'}</button>`}</footer></section><section class="chat-conversation" id="chat-conversation"><div class="conversation-placeholder"><span class="conversation-photo activity-photo-${h.photo%4}"></span><b>Hangoutからトークへ</b><small>参加が承認されると、ここで会話を始められます。</small></div></section></div>`);
  const sheet = [...document.querySelectorAll('.hangout-flow')].at(-1);
  if(returnToProfile)sheet.classList.add('profile-origin');
  profileLoading?.remove();
  if(mine&&h.status==='FINISHED')sheet.querySelector('.owner-actions').innerHTML='<button id="delete-hangout">Hangout削除</button>';
  sheet.dataset.hangoutId=String(id);refreshCountdowns();
  const animate=options.animate!==false;
  if(animate)sheet.classList.remove('detail-open');
  if(!returnToProfile)sourceScreen?.remove();
  if(animate)requestAnimationFrame(()=>requestAnimationFrame(()=>sheet.classList.add('detail-open')));
  sheet.querySelector('#close').setAttribute('aria-label',returnToProfile?'プロフィールに戻る':returnKeywordId?'キーワード一覧に戻る':'ホームに戻る');
  const hero=sheet.querySelector('.hangout-hero-photo');if(h.imageUrl){hero.className='hangout-hero-photo custom-hangout-photo';hero.style.backgroundImage=`url('${h.imageUrl}')`}
  const hostPhoto=sheet.querySelector('.detail-photo');const openHostPhotos=()=>showProfilePhoto(userPhotos({profilePhoto:h.hostPhoto,profilePhotos:h.hostPhotos}),h.host);hostPhoto.onclick=openHostPhotos;hostPhoto.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();openHostPhotos()}};
  const returnFromDetail=()=>{sheet.classList.remove('detail-open','conversation-open');sheet.classList.add('closing');setTimeout(()=>{sheet.remove();if(returnToProfile){sourceScreen.classList.remove('profile-behind-hangout');activeScreen='profileScreen'}else if(returnKeywordId)keywordHangoutList(returnKeywordId);else home()},240)};
  sheet.querySelector('#close').onclick = returnFromDetail;
  const detailRatingComplete=sheet.querySelector('[data-detail-finish-ratings]');if(detailRatingComplete)detailRatingComplete.onclick=returnFromDetail;
  const chatButton=sheet.querySelector('#open-flow-chat');if(chatButton){const conditionPanel=sheet.querySelector('.condition-panel');conditionPanel?.parentNode.insertBefore(chatButton,conditionPanel);chatButton.onclick=()=>openHangoutFlowChat(id)}
  const navigation=sheet.querySelector('#open-navigation');if(navigation)navigation.onclick=()=>window.open(h.navigationUrl||`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(h.latitude!==undefined&&h.longitude!==undefined?`${h.latitude},${h.longitude}`:h.place)}`,'_blank','noopener');
  sheet.querySelectorAll('[data-approved-profile]').forEach(button=>button.onclick=()=>{const member=(h.acceptedParticipants||[])[Number(button.dataset.approvedProfile)];if(member)showApplicantProfile(member,'参加メンバープロフィール')});
  sheet.querySelectorAll('[data-detail-rating]').forEach(button=>button.onclick=async()=>{const card=button.closest('.hangout-rating-member');const buttons=[...card.querySelectorAll('[data-detail-rating]')];if(buttons.some(item=>item.disabled))return;buttons.forEach(item=>item.disabled=true);try{await api(`/hangouts/${id}/ratings`,{method:'POST',body:JSON.stringify({ratedUserId:button.dataset.detailRating,score:Number(button.dataset.score)})});buttons.forEach(item=>item.classList.toggle('selected',item===button));card.remove();toast(`評価 ★${button.dataset.score}を保存しました`)}catch(error){toast(error.message)}finally{buttons.forEach(item=>item.disabled=false)}});
  if(!mine){sheet.querySelector('.hangout-detail-content').insertAdjacentHTML('beforeend','<button class="danger-link" id="report">通報・ブロック</button>');sheet.querySelector('#report').onclick=()=>{sheet.remove();safetyDialog(h)}}
  const deleteHangoutAndReturn=async()=>{sheet.classList.add('hangout-deleting');setTimeout(async()=>{sheet.remove();await returnAfterDeletion();toast('Hangoutとトークを削除しました')},420)};
  if(mine&&h.status==='FINISHED'){sheet.querySelector('#delete-hangout').onclick=async()=>{if(!confirm('このHangoutを削除しますか？Hangoutのトークもすべて削除されます。'))return;try{await api(`/hangouts/${id}`,{method:'DELETE'});await deleteHangoutAndReturn()}catch(error){toast(error.message)}};return}
   if(mine){sheet.querySelectorAll('[data-request-profile]').forEach(button=>button.onclick=()=>{const request=requests.find(item=>item.id===button.dataset.requestProfile);if(request)showApplicantProfile(request.user)});sheet.querySelectorAll('[data-accept]').forEach(button=>button.onclick=()=>decideInlineRequest(id,button.dataset.accept,true,sheet));sheet.querySelectorAll('[data-reject]').forEach(button=>button.onclick=()=>decideInlineRequest(id,button.dataset.reject,false,sheet));sheet.querySelector('#edit-hangout').onclick=()=>showEditHangout(h,sheet);sheet.querySelector('#delete-hangout-active').onclick=async()=>{if(!confirm('このHangoutを削除しますか？Hangoutのトークもすべて削除されます。'))return;try{await api(`/hangouts/${id}`,{method:'DELETE'});await deleteHangoutAndReturn()}catch(error){toast(error.message)}};const start=sheet.querySelector('#start-hangout');if(start&&!start.disabled)start.onclick=async()=>{start.disabled=true;start.textContent='開始中…';try{await api(`/hangouts/${id}/start`,{method:'POST'});h.status='STARTED';await loadHangouts();sheet.querySelector('.hangout-state').textContent='Hangout中';sheet.querySelector('.detail-time').textContent=`Hangout中 ・ 相性 ${h.match}%`;start.id='finish-hangout';start.textContent='Hangout終了';start.disabled=false;start.onclick=()=>showFinishConfirmation(id);toast('Hangoutを開始しました。途中参加の申請を受け付けています')}catch(error){start.disabled=false;start.textContent='Hangout開始';toast(error.message)}};const finish=sheet.querySelector('#finish-hangout');if(finish)finish.onclick=()=>showFinishConfirmation(id);return}
  const feedbackAnchor=sheet.querySelector('.hangout-detail-content');if(matchFeedbackSection)feedbackAnchor.insertAdjacentHTML('beforeend',matchFeedbackSection);
  const notMatchButton=sheet.querySelector('#not-a-match');if(notMatchButton)notMatchButton.onclick=()=>showMatchFeedbackDialog(h);
  const joinButton=sheet.querySelector('#join');if(joinButton){const reason=eligibilityReason(h);if(reason&&!requested){joinButton.disabled=true;joinButton.textContent='参加条件の対象外';joinButton.insertAdjacentHTML('beforebegin',`<small class="eligibility-note">${safeText(reason)}</small>`)}joinButton.onclick=()=>{if(reason||requested)return;showJoinRequestDialog(h,sheet)}}
}

function showMatchFeedbackDialog(h){
  const reasons=[['TIME','時間が合わない'],['DISTANCE','距離が遠い'],['FULL','希望人数と違う'],['BUDGET','予算が合わない'],['CONDITIONS','参加条件が合わない'],['OTHER','その他']];
  document.body.insertAdjacentHTML('beforeend',`<div class="sheet match-feedback-sheet"><section class="panel match-feedback-dialog"><h2>合わない理由</h2><p>次回のおすすめ改善にだけ利用します。</p><div class="interest-picker">${reasons.map(([value,label])=>`<button type="button" data-match-reason="${value}">${label}</button>`).join('')}</div><button class="outline" data-close-match-feedback type="button">閉じる</button></section></div>`);
  const feedbackSheet=[...document.querySelectorAll('.match-feedback-sheet')].at(-1);setTimeout(()=>feedbackSheet.classList.add('open'),0);
  const close=()=>{feedbackSheet.classList.remove('open');setTimeout(()=>feedbackSheet.remove(),240)};
  feedbackSheet.querySelector('[data-close-match-feedback]').onclick=close;
  feedbackSheet.querySelectorAll('[data-match-reason]').forEach(button=>button.onclick=async()=>{button.disabled=true;try{await api('/analytics/match-feedback',{method:'POST',body:JSON.stringify({hangoutId:h.id,outcome:'NOT_MATCHED',reason:button.dataset.matchReason})});close();toast('おすすめ改善に反映しました')}catch(error){button.disabled=false;toast(error.message)}});
}

function showJoinRequestDialog(h,detailSheet){
  document.querySelector('.join-request-screen')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="profile-screen join-request-screen"><header class="host-menu-header"><button class="brand-back" type="button" aria-label="Hangoutに戻る"><span></span></button><div><small>参加申請</small><b>参加したい</b></div><span></span></header><main class="profile-screen-content"><section class="host-menu-form join-request-form"><div class="eyebrow">主催者が参加可否を判断します</div><h2>ひとこと添えて申請</h2><p>参加したい理由や当日の雰囲気が伝わるメッセージを書いてください。</p><label for="join-message">主催者へのメッセージ</label><textarea id="join-message" rows="5" maxlength="200" placeholder="例：カフェ巡りが好きです。初参加ですが、よろしくお願いします！"></textarea><small><span id="join-message-count">0</span> / 200文字</small><div class="join-request-status" role="status" aria-live="polite"></div><button class="primary" id="send-join-request" type="button" data-incomplete="true">この内容で参加申請する</button></section></main></div>`);
  const dialog=[...document.querySelectorAll('.join-request-screen')].at(-1);
  const input=dialog.querySelector('#join-message');
  const send=dialog.querySelector('#send-join-request');
  const status=dialog.querySelector('.join-request-status');
  const detailJoinButton=detailSheet.querySelector('#join');
  let submitting=false;
  const applyStatus=(value)=>{
    const nextStatus=['PENDING','WAITLISTED','ACCEPTED'].includes(value)?value:'PENDING';
    h.myJoinStatus=nextStatus;
    const listedHangout=hangouts.find(item=>item.id===h.id);
    if(listedHangout)listedHangout.myJoinStatus=nextStatus;
    joined.add(h.id);
    persist();
    if(detailJoinButton){detailJoinButton.disabled=true;detailJoinButton.textContent={PENDING:'申請中',WAITLISTED:'待機中',ACCEPTED:'承認済み'}[nextStatus]}
    const detailState=detailSheet.querySelector('.hangout-state');
    if(detailState&&h.status!=='STARTED')detailState.textContent={PENDING:'申請中',WAITLISTED:'待機中',ACCEPTED:'承認済み'}[nextStatus];
    return nextStatus;
  };
  const closeDialog=()=>{if(submitting)return;dialog.classList.remove('open');dialog.classList.add('closing');setTimeout(()=>dialog.remove(),240)};
  const sync=()=>{const length=input.value.trim().length;dialog.querySelector('#join-message-count').textContent=String(length);send.dataset.incomplete=String(length<1);if(length)status.textContent=''};
  input.addEventListener('input',sync);
  input.addEventListener('compositionend',sync);
  dialog.querySelector('.brand-back').onclick=closeDialog;
  send.onclick=async()=>{
    const message=input.value.trim();
    if(submitting)return;
    if(!message){status.textContent='メッセージを入力してください。';input.focus();return}
    submitting=true;
    input.blur();
    send.disabled=true;
    send.setAttribute('aria-busy','true');
    send.textContent='申請中…';
    if(detailJoinButton){detailJoinButton.disabled=true;detailJoinButton.textContent='申請中…'}
    status.textContent='参加申請を送信しています。';
    try{
      const request=await api(`/hangouts/${h.id}/join`,{method:'POST',body:JSON.stringify({message})});
      const nextStatus=applyStatus(request?.status);
      status.textContent=nextStatus==='WAITLISTED'?'待機リストに登録しました。':'参加申請を送信しました。';
      try{await loadHangouts()}catch(error){console.warn('Hangout refresh failed after successful join request')}
      applyStatus(nextStatus);
      dialog.remove();
      detailSheet.remove();
      await detail(h.id,null,{animate:false});
      toast(nextStatus==='WAITLISTED'?'待機リストに登録しました':'ひとこと付きで参加申請を送りました');
    }catch(error){
      try{
        const current=await api(`/hangouts/${h.id}`);
        if(['PENDING','WAITLISTED','ACCEPTED'].includes(current.myJoinStatus)){
          const reconciledStatus=applyStatus(current.myJoinStatus);
          dialog.remove();
          try{await loadHangouts()}catch{/* The confirmed request status is already reflected locally. */}
          detailSheet.remove();
          await detail(h.id,null,{animate:false});
          toast(reconciledStatus==='WAITLISTED'?'待機リストに登録しました':'参加申請を受け付けました');
          return;
        }
      }catch{/* Preserve the original submission error below. */}
      submitting=false;
      send.disabled=false;
      send.removeAttribute('aria-busy');
      send.textContent='この内容で参加申請する';
      if(detailJoinButton){detailJoinButton.disabled=false;detailJoinButton.textContent='参加したい'}
      status.textContent=error.message;
      toast(error.message);
    }
  };
  sync();
  setTimeout(()=>dialog.classList.add('open'),0);
}

async function decideInlineRequest(hangoutId,requestId,accept,sheet){const actionButton=sheet.querySelector(`[data-${accept?'accept':'reject'}="${requestId}"]`);if(actionButton?.disabled)return;if(actionButton){actionButton.disabled=true;actionButton.textContent=accept?'承認中…':'却下中…'}try{await api(`/join-requests/${requestId}/${accept?'accept':'reject'}`,{method:'POST'});await loadHangouts();await detail(hangoutId,null,{animate:false});sheet.remove();toast(accept?'参加申請を承認しました':'参加申請を却下しました')}catch(error){if(actionButton){actionButton.disabled=false;actionButton.textContent=accept?'承認':'却下'}toast(error.message)}}

function showApplicantProfile(user,title='申請者プロフィール'){
  const interests=(user.interests||[]).map(interest=>`<span>${safeText(interest)}</span>`).join('')||'<span>未登録</span>';
  document.body.insertAdjacentHTML('beforeend',`<div class="sheet applicant-profile-sheet"><section class="panel applicant-profile"><header><button class="brand-back" type="button" aria-label="プロフィールを閉じる"><span></span></button><b>${safeText(title)}</b><span></span></header>${profilePhotoTrio(user,user.displayName)}<h2>${safeText(user.displayName)}</h2><div class="verified ${user.verification==='PHONE_VERIFIED'?'':'unverified'}">${user.verification==='PHONE_VERIFIED'?'✓ 電話番号確認済み':'本人確認前'}</div><dl><div><dt>年齢</dt><dd>${Number.isFinite(user.age)?`${user.age}歳`:'未登録'}</dd></div><div><dt>活動エリア</dt><dd>${safeText(user.homeArea||'未登録')}</dd></div></dl><section><h3>自己紹介</h3><p>${safeText(user.bio||'自己紹介は未登録です。')}</p></section><section><h3>興味のあること</h3><div class="tags">${interests}</div></section></section></div>`);
  const profile=document.querySelector('.applicant-profile-sheet');
  profile.querySelector('.brand-back').onclick=()=>profile.remove();
  profile.querySelectorAll('[data-profile-photo-index]').forEach(button=>button.onclick=()=>showProfilePhoto(userPhotos(user),user.displayName,'',Number(button.dataset.profilePhotoIndex)));
}

async function openHangoutFlowChat(hangoutId){let groups=[];try{groups=await api('/chat-rooms')}catch(error){toast(error.message);return}const room=groups.find(item=>item.hangout.id===hangoutId);if(!room){toast('参加承認後にトークを開始できます');return}openChat(room)}

function safetyDialog(h){document.body.insertAdjacentHTML('beforeend',`<div class="sheet"><section class="panel"><div class="handle"></div><h2>${h.host}を通報</h2><label>理由</label><select id="reason"><option value="HARASSMENT">迷惑行為</option><option value="DANGEROUS">危険行為</option><option value="SEXUAL">性的目的</option><option value="SOLICITATION">勧誘・営業</option><option value="FRAUD">詐欺</option><option value="OTHER">その他</option></select><label>詳細</label><textarea id="report-details" rows="3"></textarea><label><input id="block-too" type="checkbox" checked> 同時にブロック</label><button class="primary" id="submit-report">通報する</button><button class="secondary" id="close">キャンセル</button></section></div>`);const sheet=document.querySelector('.sheet');sheet.querySelector('#close').onclick=()=>sheet.remove();sheet.querySelector('#submit-report').onclick=async()=>{try{await api('/safety/reports',{method:'POST',body:JSON.stringify({targetUserId:h.hostUserId,hangoutId:h.id,reason:sheet.querySelector('#reason').value,details:sheet.querySelector('#report-details').value,blockUser:sheet.querySelector('#block-too').checked})});sheet.remove();await loadHangouts();home();toast('通報を受け付け、対象ユーザーを非表示にしました。')}catch(error){toast(error.message)}}}

function googleMapScreen(){
  activeScreen='mapScreen';
  const center=userLocation?`${userLocation.latitude},${userLocation.longitude}`:'35.6762,139.6993';
  const mappedHangouts=hangouts.slice(0,8);
  const rows=mappedHangouts.map(h=>`<button data-map-card="${h.id}"><span class="map-list-photo ${hangoutPhotoClass(h)}"${photoStyle(h.imageUrl)}></span><span class="map-list-copy"><b>${safeText(h.title)}</b><small>${safeText(h.place)}</small></span><span>${h.distanceKm!==null&&h.distanceKm!==undefined?h.distanceKm+'km ・ ':''}${safeText(h.time)} ›</span></button>`).join('');
  shell(`<section class="page-title map-page-title"><button class="brand-back" id="close-map" type="button" aria-label="Hangout一覧に戻る"><span></span></button><div><div class="eyebrow">Googleマップ・概略位置</div><h1>近くのHangout</h1></div></section><section class="google-map"><iframe title="Googleマップ" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=${encodeURIComponent(center)}&z=13&output=embed"></iframe></section><section class="map-results"><header><h2>このマップのHangout</h2><span>${mappedHangouts.length}件</span></header><div class="map-linked-list">${rows||'<div class="empty">このエリアのHangoutはまだありません。</div>'}</div></section><div class="map-note">Googleマップを表示しています。承認前は概略エリア、承認後だけ正確な集合地点をナビへ渡します。</div>`,false);
  document.querySelector('#close-map').onclick=()=>navigate('home');
  document.querySelectorAll('[data-map-card]').forEach(button=>button.onclick=()=>detail(button.dataset.mapCard));
}

function showEditHangout(h,detailSheet){
  document.body.insertAdjacentHTML('beforeend',`<div class="host-menu-screen"><header class="host-menu-header"><button id="close" class="brand-back" type="button" aria-label="Hangout画面に戻る"><span></span></button><div><small>主催者メニュー</small><b>Hangoutを編集</b></div><span></span></header><main class="host-menu-content"><section class="host-menu-form"><label>Hangoutのイメージ写真</label><input id="edit-image" type="file" accept="image/jpeg,image/png,image/webp"><small>現在の写真をいつでも変更できます。</small><label>タイトル</label><input id="edit-title" maxlength="80" value="${safeText(h.title)}"><label>承認前に表示するエリア</label><input id="edit-public-place" maxlength="100" value="${safeText(h.publicLocationName||h.place)}"><label>店名</label><input id="edit-place-name" maxlength="100" value="${safeText(h.meetingPlaceName||h.place)}"><label>住所</label><input id="edit-address" maxlength="200" value="${safeText(h.meetingAddress||h.place)}"><label>参加できる性別</label><select id="edit-gender"><option value="ANY">だれでも</option><option value="MALE_ONLY">男性のみ</option><option value="FEMALE_ONLY">女性のみ</option></select><label>年齢上限</label><select id="edit-max-age"><option value="">制限なし</option><option value="29">20代まで</option><option value="39">30代まで</option><option value="59">50代まで</option></select><label>説明</label><textarea id="edit-description" maxlength="500" rows="7">${safeText(h.desc)}</textarea></section></main><footer class="host-menu-actions"><button class="secondary" id="cancel-edit">キャンセル</button><button class="primary" id="save-hangout">保存</button></footer></div>`);
  const menu=document.querySelector('.host-menu-screen');
  const closeMenu=(afterClose)=>{
    const imageInput=menu.querySelector('#edit-image');
    menu.classList.remove('open');
    menu.classList.add('closing');
    setTimeout(()=>{if(imageInput.dataset.previewUrl)URL.revokeObjectURL(imageInput.dataset.previewUrl);menu.remove();if(afterClose)afterClose()},240);
  };
  setTimeout(()=>{
    menu.classList.add('open');
    const preview=menu.querySelector('.hangout-image-preview');
    if(preview&&h.imageUrl){preview.style.backgroundImage=`url('${h.imageUrl}')`;preview.classList.add('has-image');preview.innerHTML='<b>現在保存されている画像</b>'}
  },0);
  menu.querySelector('#edit-gender').value=h.genderRestriction||'ANY';
  menu.querySelector('#edit-max-age').value=h.maxAge||'';
  menu.querySelector('#close').onclick=()=>closeMenu();
  menu.querySelector('#cancel-edit').onclick=()=>closeMenu();
  const saveButton=menu.querySelector('#save-hangout');
  saveButton.onclick=async()=>{
    if(saveButton.disabled)return;
    saveButton.disabled=true;
    saveButton.textContent='保存中…';
    try{
      const placeName=menu.querySelector('#edit-place-name').value.trim();
      const address=menu.querySelector('#edit-address').value.trim();
      const file=menu.querySelector('#edit-image').files[0];
      const imageUrl=file?await imageData(file):undefined;
      const maxAge=menu.querySelector('#edit-max-age').value;
      await api(`/hangouts/${h.id}`,{method:'PATCH',body:JSON.stringify({title:menu.querySelector('#edit-title').value.trim(),publicLocationName:menu.querySelector('#edit-public-place').value.trim(),locationName:`${placeName} ${address}`.trim(),meetingPlaceName:placeName,meetingAddress:address,...(imageUrl?{imageUrl}:{}),description:menu.querySelector('#edit-description').value.trim(),genderRestriction:menu.querySelector('#edit-gender').value,maxAge:maxAge?Number(maxAge):null})});
      await loadHangouts();
      await detail(h.id,null,{animate:false});
      closeMenu(()=>{detailSheet.remove();toast('Hangoutと写真を更新しました')});
    }catch(error){saveButton.disabled=false;saveButton.textContent='保存';toast(error.message)}
  };
}

async function chatScreen(sourceScreen = null) {
  const returnToProfile=Boolean(sourceScreen?.classList.contains('profile-screen'));
  if(returnToProfile)sourceScreen.classList.add('profile-behind-chat');
  activeScreen = 'chatScreen';
  const closeLoading=showPageLoadingOverlay('トークを読み込んでいます');
  let groups=[],directs=[];try{[groups,directs]=await Promise.all([api('/chat-rooms'),api('/direct-chats')])}catch(error){toast(error.message)}finally{closeLoading()}
  const roomTime=room=>new Date(room.lastMessage?.createdAt||room.updatedAt||room.createdAt||0).getTime();
  const talks=[...groups.map((room,index)=>({room,index,kind:'group'})),...directs.map((room,index)=>({room,index,kind:'direct'}))].sort((a,b)=>roomTime(b.room)-roomTime(a.room));
  const talkRows=talks.map(({room,index,kind},visualIndex)=>{const direct=kind==='direct';const title=direct?room.otherUser.displayName:room.hangout.title;const person=direct?room.otherUser:room.hangout.host;return `<button class="chat-row talk-row" data-room-index="${index}" data-kind="${kind}"><span class="mini ${portraitClass(visualIndex%4)}"${photoStyle(person.profilePhoto)}></span><span><b>${safeText(title)}</b><small>${safeText(room.lastMessage?.body||(direct?'1対1でメッセージを送りましょう':'グループにメッセージを送りましょう'))}</small></span><span class="talk-meta"><time>${room.lastMessage?.createdAt?new Date(room.lastMessage.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'}):''}</time><em>${direct?'1対1':'グループ'}</em></span></button>`}).join('');
  const directCandidates='';
  const demoChatHint=demoRole==='host'?'<div class="demo-chat-hint"><span>終了操作は左のHangout詳細から行います</span><button id="chat-switch-demo-role">役割切替</button></div>':'';
  const hosted=hangouts.filter(h=>h.hostUserId===session.user.id&&['OPEN','FULL','STARTED'].includes(h.status));const showHangoutRail=hosted.length>0;const hangoutRail=showHangoutRail?`<aside class="hangout-rail"><header><b>Hangout <i>Now</i></b><span>主催中のHangout</span></header><div class="hosted-hangouts">${hosted.map(h=>`<article><button class="hosted-photo activity-photo-${h.photo%4}" data-open-host-hangout="${h.id}" aria-label="${safeText(h.title)}を開く"></button><div><strong>${safeText(h.title)}</strong><small>${safeText(h.time)} ・ ${safeText(h.place)}</small><button data-hangout-chat="${h.id}">トークを見る</button></div></article>`).join('')}</div></aside>`:'';
  shell(`<section class="chat-workspace ${showHangoutRail?'with-hangout-rail':''}">${hangoutRail}<aside class="chat-sidebar"><section class="page-title chat-page-title"><button class="brand-back chat-list-back" type="button" aria-label="Hangout一覧に戻る"><span></span></button><div><div class="eyebrow">新しいメッセージ順</div><h1>トーク</h1></div><span class="realtime-pill">● リアルタイム</span></section>${demoChatHint}${directCandidates}<div class="talk-list-heading"><b>トーク</b><span>1対1 ${directs.length}　グループ ${groups.length}</span></div><div class="chat-lists"><section class="chat-list">${talkRows||'<div class="empty">トークはまだありません。</div>'}</section></div></aside><section class="chat-conversation" id="chat-conversation"><div class="conversation-placeholder"><span class="conversation-photo"></span><b>会話を選んでください</b><small>相手の表情を感じながら、待ち合わせまで自然に話せます。</small></div></section></section>`, false);
  const chatPhone=document.querySelector('.phone');
  chatPhone.classList.add('chat-phone','chat-screen-enter');
  if(!returnToProfile)sourceScreen?.remove();
  slideInFromRight(chatPhone);
  const chatSwitch=document.querySelector('#chat-switch-demo-role');if(chatSwitch)chatSwitch.onclick=()=>{realtimeSocket?.disconnect();session=null;demoRole=null;localStorage.removeItem(SESSION_STORAGE_KEY);localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);authScreen('login')};
  document.querySelectorAll('[data-chat-tab]').forEach((tab)=>tab.onclick=()=>{document.querySelectorAll('[data-chat-tab]').forEach(x=>x.classList.toggle('active',x===tab));document.querySelectorAll('[data-chat-list]').forEach(x=>x.classList.toggle('hidden',x.dataset.chatList!==tab.dataset.chatTab))});
  document.querySelectorAll('[data-room-index]').forEach((button)=>button.onclick=()=>{const room=(button.dataset.kind==='direct'?directs:groups)[Number(button.dataset.roomIndex)];openChat(room)});
  document.querySelectorAll('[data-start-direct]').forEach((button)=>button.onclick=async()=>{try{await api('/direct-chats',{method:'POST',body:JSON.stringify({userId:button.dataset.startDirect})});await chatScreen();document.querySelector('[data-chat-tab="direct"]')?.click()}catch(error){toast(error.message)}});
  document.querySelectorAll('[data-open-host-hangout]').forEach(button=>button.onclick=()=>detail(button.dataset.openHostHangout));document.querySelectorAll('[data-hangout-chat]').forEach(button=>button.onclick=()=>{const workspace=document.querySelector('.chat-workspace');workspace.classList.add('hangout-selected');const row=[...document.querySelectorAll('.chat-row[data-kind="group"]')].find(item=>groups[Number(item.dataset.roomIndex)]?.hangout.id===button.dataset.hangoutChat);row?.click()});const listBack=document.querySelector('.chat-list-back');if(listBack)listBack.onclick=()=>{const workspace=document.querySelector('.chat-workspace');if(workspace.classList.contains('conversation-open'))workspace.classList.remove('conversation-open');else if(workspace.classList.contains('hangout-selected'))workspace.classList.remove('hangout-selected');else{const phone=document.querySelector('.chat-phone');slideOutToRight(phone,()=>{if(returnToProfile){phone.remove();sourceScreen.classList.remove('profile-behind-chat');activeScreen='profileScreen';return}navigate('home')})}};
  document.querySelectorAll('[data-rate-user]').forEach((button)=>button.onclick=()=>showRatingDialog(button.dataset.hangoutId,button.dataset.rateUser,button.dataset.userName,button.dataset.ratingRole));
}

function showRatingDialog(hangoutId,ratedUserId,userName,ratingRole){const roleLabel=ratingRole==='host'?'主催者として':'参加者として';document.body.insertAdjacentHTML('beforeend',`<div class="sheet rating-sheet"><section class="panel"><div class="handle"></div><div class="rating-person">${safeText(userName)}さんを${roleLabel}評価</div><h2>${ratingRole==='host'?'主催評価':'参加評価'}を選んでください</h2><p>この評価は${ratingRole==='host'?'主催評価':'参加評価'}として別々に集計されます。双方が★5の場合だけ1対1トークが解放されます。</p><div class="rating-stars">${[1,2,3,4,5].map(score=>`<button data-rating-score="${score}" aria-label="星${score}">${'★'.repeat(score)}<small>${score}</small></button>`).join('')}</div><button class="secondary" data-cancel-rating>キャンセル</button></section></div>`);const sheet=document.querySelector('.rating-sheet');sheet.querySelector('[data-cancel-rating]').onclick=()=>sheet.remove();sheet.querySelectorAll('[data-rating-score]').forEach(button=>button.onclick=async()=>{const score=Number(button.dataset.ratingScore);try{await api(`/hangouts/${hangoutId}/ratings`,{method:'POST',body:JSON.stringify({ratedUserId,score})});sheet.remove();toast(`${ratingRole==='host'?'主催評価':'参加評価'} ★${score}を保存しました${score===5?'。相手も★5なら1対1が解放されます':''}`);chatScreen()}catch(error){toast(error.message)}})}

async function notificationScreen(){activeScreen='notifications';const data=await loadNotificationCount()||{items:[],enabled:true};shell(`<header class="host-menu-header notification-screen-header"><button class="brand-back" id="notification-home" type="button" aria-label="ホームに戻る"><span></span></button><div><small>リアルタイム更新</small><b>通知</b></div><span></span></header><div class="notification-settings"><label><input id="notification-enabled" type="checkbox" ${data.enabled?'checked':''}> アプリ内通知を受け取る</label><div class="notification-actions"><button id="browser-notification">端末通知を許可</button><button id="read-all">すべて既読</button><button id="delete-notifications">通知を削除</button></div></div><section class="notification-list">${data.items.length?data.items.map(n=>`<button data-notification="${n.id}" class="notification-item ${n.readAt?'':'unread'}"><b>${n.title}</b><span>${n.body}</span><small>${new Date(n.createdAt).toLocaleString('ja-JP')}</small></button>`).join(''):'<div class="empty">通知はまだありません。</div>'}</section>`,false);document.querySelector('.phone').classList.add('notification-phone');document.querySelector('#notification-home').onclick=home;document.querySelector('#notification-enabled').onchange=async(e)=>{await api('/notifications/settings',{method:'PATCH',body:JSON.stringify({enabled:e.target.checked})});toast('通知設定を保存しました')};document.querySelector('#browser-notification').onclick=async()=>{if(!('Notification'in window)){toast('この端末は通知に対応していません');return}const result=await Notification.requestPermission();toast(result==='granted'?'端末通知を許可しました':'アプリ内通知を利用します')};document.querySelector('#read-all').onclick=async()=>{await api('/notifications/read-all',{method:'POST'});unreadNotifications=0;notificationScreen()};document.querySelector('#delete-notifications').onclick=async()=>{if(!data.items.length){toast('削除する通知はありません');return}if(!confirm('通知をすべて削除しますか？'))return;await api('/notifications',{method:'DELETE'});unreadNotifications=0;await notificationScreen();toast('通知を削除しました')};document.querySelectorAll('[data-notification]').forEach(b=>b.onclick=async()=>{await api(`/notifications/${b.dataset.notification}/read`,{method:'POST'});b.classList.remove('unread');await loadNotificationCount()})}

function safeText(value){return String(value).replace(/[&<>"']/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]))}
function messageContent(body){return body?.startsWith('__STAMP__')?'<span class="removed-stamp">過去のスタンプ</span>':safeText(body)}

async function openChat(room) {
  const kind=room.type==='DIRECT'?'direct':'group';const base=kind==='direct'?'/direct-chats':'/chat-rooms';
  const closeLoading=showPageLoadingOverlay('メッセージを読み込んでいます');
  let messages=[];try{messages=await api(`${base}/${room.id}/messages`)}catch(error){toast(error.message);return}finally{closeLoading()}
  const title=kind==='direct'?room.otherUser.displayName:room.hangout.title;const photo=kind==='direct'?room.otherUser.profilePhoto:room.hangout.host.profilePhoto;
  const conversation=document.querySelector('#chat-conversation');const workspace=document.querySelector('.chat-workspace,.hangout-flow');
  conversation.innerHTML=`<header class="chat-conversation-head"><button class="chat-back brand-back" type="button" aria-label="トーク一覧に戻る"><span></span></button><span class="conversation-avatar"${photoStyle(photo)}>${photo?'':safeText(title).slice(0,1)}</span><div><h2>${safeText(title)}</h2><small>${kind==='direct'?'1対1':room.hangout.status==='FINISHED'?'終了・評価待ち':'グループ ・ '+room.members.length+'人'}　<span>● オンライン</span></small></div></header><div class="messages">${messages.map((m)=>{const mine=m.senderUserId===session.user.id;return `<div class="message-line ${mine?'mine':''}">${mine?'':`<span class="message-avatar"${photoStyle(m.sender.profilePhoto)}>${m.sender.profilePhoto?'':safeText(m.sender.displayName).slice(0,1)}</span>`}<div class="bubble-wrap"><small>${safeText(m.sender.displayName)}</small><div class="bubble">${messageContent(m.body)}</div><time>${new Date(m.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</time></div>${mine?`<span class="message-avatar"${photoStyle(m.sender.profilePhoto||session.user.profilePhoto)}>${m.sender.profilePhoto||session.user.profilePhoto?'':safeText(m.sender.displayName).slice(0,1)}</span>`:''}</div>`}).join('')||'<div class="empty">最初のメッセージを送ってみましょう。</div>'}</div><div class="conversation-actions">${kind==='group'?'<div class="quick"><button>向かっています</button><button>少し遅れます</button><button>到着しました</button></div>':''}<div class="composer"><input placeholder="メッセージを入力" maxlength="1000"><button class="chat-send-button" aria-label="メッセージを送信"><span>↑</span></button></div></div>`;
  if(workspace.classList.contains('hangout-flow'))transitionHangoutConversation(workspace,true);else workspace.classList.add('conversation-open');conversation.querySelector('.messages').scrollTop=conversation.querySelector('.messages').scrollHeight;
  conversation.querySelector('.chat-back').onclick=()=>{if(workspace.classList.contains('hangout-flow'))transitionHangoutConversation(workspace,false);else workspace.classList.remove('conversation-open')};
  let sendingMessage=false;
  const send=async(text)=>{
    const body=text.trim();
    if(!body||sendingMessage)return;
    const input=conversation.querySelector('.composer input');
    const sendButton=conversation.querySelector('.composer button');
    sendingMessage=true;
    sendButton.disabled=true;
    try{
      const message=await api(`${base}/${room.id}/messages`,{method:'POST',body:JSON.stringify({body})});
      const messagesElement=conversation.querySelector('.messages');
      messagesElement.querySelector('.empty')?.remove();
      messagesElement.insertAdjacentHTML('beforeend',`<div class="message-line mine"><div class="bubble-wrap"><small>${safeText(message.sender.displayName)}</small><div class="bubble">${messageContent(message.body)}</div><time>${new Date(message.createdAt).toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'})}</time></div><span class="message-avatar"${photoStyle(message.sender.profilePhoto||session.user.profilePhoto)}>${message.sender.profilePhoto||session.user.profilePhoto?'':safeText(message.sender.displayName).slice(0,1)}</span></div>`);
      input.value='';
      messagesElement.scrollTop=messagesElement.scrollHeight;
    }catch(error){toast(error.message)}finally{sendingMessage=false;sendButton.disabled=false}
  };
  conversation.querySelectorAll('.quick button').forEach((button)=>button.onclick=()=>send(button.textContent));
  conversation.querySelector('.composer button').onclick=()=>send(conversation.querySelector('.composer input').value);
  conversation.querySelector('.composer input').onkeydown=(event)=>{if(event.key==='Enter'&&!event.isComposing)send(event.currentTarget.value)};
}

async function showHangoutRatingScreen(hangoutId){
  try{
    const groups=await api('/chat-rooms');
    const room=groups.find(item=>item.hangout.id===hangoutId);
    const members=(room?.members||[]).filter(member=>member.id!==session.user.id&&!member.myRatingScore);
    document.body.insertAdjacentHTML('beforeend',`<div class="sheet rating-sheet hangout-rating-sheet"><section class="panel"><div class="handle"></div><div class="eyebrow">Hangoutを終了しました</div><h2>参加メンバーを評価</h2><p>一緒に過ごしたメンバーを★1〜5で評価してください。送信後は変更できません。</p><div class="hangout-rating-members">${members.map(member=>`<article class="hangout-rating-member"><b>${safeText(member.displayName)}</b><small>${member.id===room.hangout.hostUserId?'主催者として評価':'参加者として評価'}</small><div class="rating-stars compact">${[1,2,3,4,5].map(score=>`<button data-member-rating="${member.id}" data-score="${score}" class="${member.myRatingScore===score?'selected':''}" aria-label="${safeText(member.displayName)}を星${score}で評価">${score}★</button>`).join('')}</div><em>${member.myRatingScore?`評価済み ★${member.myRatingScore}`:'評価を選択してください'}</em></article>`).join('')||'<div class="empty">評価する参加メンバーはいません。</div>'}</div><button class="primary hangout-rating-complete" data-finish-ratings>評価完了</button></section></div>`);
    const sheet=[...document.querySelectorAll('.hangout-rating-sheet')].at(-1);
    sheet.querySelector('[data-finish-ratings]').onclick=()=>{document.querySelectorAll('.hangout-rating-sheet').forEach(screen=>screen.remove());document.querySelector('.hangout-detail-sheet')?.remove();home()};
    sheet.querySelectorAll('[data-member-rating]').forEach(button=>button.onclick=async()=>{
      const memberCard=button.closest('.hangout-rating-member');
      const ratingButtons=[...memberCard.querySelectorAll('[data-member-rating]')];
      if(ratingButtons.some(item=>item.disabled))return;
      ratingButtons.forEach(item=>item.disabled=true);
      try{
        await api(`/hangouts/${hangoutId}/ratings`,{method:'POST',body:JSON.stringify({ratedUserId:button.dataset.memberRating,score:Number(button.dataset.score)})});
        ratingButtons.forEach(item=>item.classList.toggle('selected',item===button));
        memberCard.querySelector('em').textContent=`評価済み ★${button.dataset.score}`;
        toast(`評価 ★${button.dataset.score}を保存しました`);
      }catch(error){toast(error.message)}finally{ratingButtons.forEach(item=>item.disabled=false)}
    });
  }catch(error){toast(error.message)}
}

function showFinishConfirmation(hangoutId){document.body.insertAdjacentHTML('beforeend',`<div class="sheet finish-sheet"><section class="panel"><div class="handle"></div><div class="eyebrow">Hangoutを終了</div><h2>楽しい時間を過ごせましたか？</h2><p>終了すると参加者を★1〜5で評価できます。双方が★5の場合だけ1対1トークが解放されます。</p><button class="primary" id="confirm-finish">終了して評価へ進む</button><button class="secondary" id="close">まだ終了しない</button></section></div>`);const sheet=document.querySelector('.finish-sheet');sheet.querySelector('#close').onclick=()=>sheet.remove();sheet.querySelector('#confirm-finish').onclick=async()=>{try{await api(`/hangouts/${hangoutId}/finish`,{method:'POST'});sheet.remove();await loadHangouts();toast('Hangoutを終了しました');await showHangoutRatingScreen(hangoutId)}catch(error){toast(error.message)}}}

function showProfilePhoto(profilePhoto,displayName,extraClass='',initialIndex=0){
  document.querySelector('.profile-photo-viewer')?.remove();
  const name=safeText(displayName||'プロフィール');
  const photos=(Array.isArray(profilePhoto)?profilePhoto:[profilePhoto]).filter(Boolean);let index=Math.min(initialIndex,Math.max(0,photos.length-1));
  document.body.insertAdjacentHTML('beforeend',`<div class="profile-photo-viewer" role="dialog" aria-modal="true" aria-label="${name}のプロフィール写真"><button class="profile-photo-viewer-close" type="button" aria-label="大きい写真を閉じる">×</button><button class="profile-photo-viewer-nav previous" type="button" aria-label="前の画像">‹</button><div class="profile-photo-viewer-image ${extraClass}"></div><button class="profile-photo-viewer-nav next" type="button" aria-label="次の画像">›</button><b>${name}</b><small class="profile-photo-viewer-count"></small></div>`);
  const viewer=document.querySelector('.profile-photo-viewer');
  const render=()=>{const image=viewer.querySelector('.profile-photo-viewer-image');image.style.backgroundImage=photos[index]?`url('${photos[index]}')`:'';image.textContent=photos[index]?'':name.slice(0,1);viewer.querySelector('.profile-photo-viewer-count').textContent=photos.length>1?`${index+1} / ${photos.length}`:'タップして閉じる';viewer.querySelectorAll('.profile-photo-viewer-nav').forEach(button=>button.classList.toggle('hidden',photos.length<2))};render();
  const close=()=>{document.removeEventListener('keydown',onKeydown);viewer.classList.add('closing');setTimeout(()=>viewer.remove(),180)};
  const onKeydown=event=>{if(event.key==='Escape')close()};
  document.addEventListener('keydown',onKeydown);
  viewer.onclick=event=>{if(event.target===viewer||event.target.closest('.profile-photo-viewer-close'))close()};
  viewer.querySelector('.previous').onclick=()=>{index=(index-1+photos.length)%photos.length;render()};viewer.querySelector('.next').onclick=()=>{index=(index+1)%photos.length;render()};
  setTimeout(()=>viewer.classList.add('open'),0);
  viewer.querySelector('.profile-photo-viewer-close').focus();
}

async function profileScreen({animate=true}={}) {
  activeScreen = 'profileScreen';
  const closeLoading=showPageLoadingOverlay('プロフィールを読み込んでいます');
  const hosted=hangouts.filter((h)=>h.hostUserId===session.user.id).length;
  const verified=session.user.verificationStatus==='PHONE_VERIFIED';
  let hostStatus=null;let activity={hosted:[],participated:[],hearted:[]};try{[hostStatus,activity]=await Promise.all([api('/users/me/host-status'),api('/hangouts/mine/activity')])}catch(error){toast(error.message)}finally{closeLoading()}
  document.querySelector('.profile-screen')?.remove();
  document.body.insertAdjacentHTML('beforeend',`<div class="profile-screen"><header class="host-menu-header"><button class="brand-back" type="button" aria-label="ホームに戻る"><span></span></button><div><small>アカウント</small><b>プロフィール</b></div><span></span></header><main class="profile-screen-content"><section class="profile">${profilePhotoTrio(session.user,session.user.displayName)}<h1>${safeText(session.user.displayName)}</h1><button class="profile-chat-button" id="profile-chat"><span>●</span>トーク</button><div class="verified ${verified?'':'unverified'}">${verified?'✓ 電話番号確認済み':'電話番号未確認'}</div><p>${safeText(session.user.bio||'自己紹介を登録しましょう。')}</p><button class="primary profile-edit-button" id="edit-profile">プロフィールを編集</button><div class="stats"><div><b>—</b><span>主催評価</span></div><div><b>—</b><span>参加評価</span></div><div><b>${joined.size}</b><span>参加</span></div><div><b>${hosted}</b><span>主催</span></div></div><h2>興味のあること</h2><div class="tags">${(session.user.interests||[]).map(i=>`<span>${safeText(i)}</span>`).join('')||'<span>未登録</span>'}</div><div class="safety">🛡️ 募集を作るには、顔が分かるプロフィール写真と電話番号確認が必要です。</div></section></main></div>`);
  const screen=document.querySelector('.profile-screen');
  const closeProfile=()=>{home();screen.classList.remove('open');screen.classList.add('closing');setTimeout(()=>screen.remove(),240)};
  if(animate)setTimeout(()=>screen.classList.add('open'),0);else{screen.style.transition='none';screen.classList.add('open')}
  screen.querySelector('.brand-back').onclick=closeProfile;
  screen.querySelectorAll('[data-profile-photo-index]').forEach(button=>button.onclick=()=>showProfilePhoto(userPhotos(session.user),session.user.displayName,'avatar',Number(button.dataset.profilePhotoIndex)));
  const activityRows=items=>items.length?items.map(item=>`<button class="profile-activity-row" data-profile-hangout="${item.id}" aria-label="${safeText(item.title)}を表示">${item.imageUrl?`<span style="background-image:url('${safeText(item.imageUrl)}')"></span>`:'<span class="empty-photo">✨</span>'}<div><b>${safeText(item.title)}</b><small>${new Date(item.startAt).toLocaleDateString('ja-JP')} ・ ${{FINISHED:'終了',CANCELLED:'中止',STARTED:'Hangout中',FULL:'満員',OPEN:'募集中'}[item.status]||safeText(item.status)}</small></div><i>›</i></button>`).join(''):'<p class="profile-activity-empty">まだありません。</p>';
  const activeStatuses=new Set(['OPEN','FULL','STARTED']);
  const hostedActive=activity.hosted.filter(item=>activeStatuses.has(item.status));
  const hostedPast=activity.hosted.filter(item=>item.status!=='CANCELLED'&&!activeStatuses.has(item.status));
  const participatingActive=activity.participated.filter(item=>activeStatuses.has(item.status));
  const participatedPast=activity.participated.filter(item=>!activeStatuses.has(item.status));
  screen.querySelector('.tags').insertAdjacentHTML('afterend',`<section class="profile-activity"><h2>主催中のHangout</h2>${activityRows(hostedActive)}<h2>主催したHangout</h2>${activityRows(hostedPast)}<h2>参加するHangout</h2>${activityRows(participatingActive)}<h2>参加したHangout</h2>${activityRows(participatedPast)}<h2>ハートしたHangout</h2>${activityRows(activity.hearted||[])}</section>`);
  screen.querySelector('.profile-screen-content').insertAdjacentHTML('beforeend','<button class="profile-logout-button" id="profile-logout" type="button">ログアウト</button>');
  screen.querySelector('#profile-logout').onclick=()=>{realtimeSocket?.disconnect();session=null;demoRole=null;localStorage.removeItem(SESSION_STORAGE_KEY);localStorage.removeItem(DEMO_ROLE_STORAGE_KEY);screen.remove();authScreen('login')};
  screen.querySelector('#profile-chat').onclick=()=>chatScreen(screen);
  screen.querySelectorAll('[data-profile-hangout]').forEach(button=>button.onclick=async()=>{if(button.disabled)return;button.disabled=true;try{await detail(button.dataset.profileHangout,screen)}finally{if(button.isConnected)button.disabled=false}});
  if(hostStatus){const nextLabel={BRONZE:'ブロンズ',SILVER:'シルバー',GOLD:'ゴールド',PLATINUM:'プラチナ',DIAMOND:'ダイアモンド'}[hostStatus.nextTier];screen.querySelector('.profile .verified').insertAdjacentHTML('afterend',`<section class="host-rank-card tier-${hostStatus.tier.toLowerCase()}"><small>主催者ステータス</small><strong>${hostStatus.label}</strong><p>開催完了 ${hostStatus.completedHangouts}回 ・ 累計参加者 ${hostStatus.totalParticipants}人<br>主催評価 ${hostStatus.hostAverageRating??'未評価'}（${hostStatus.hostRatingCount}件）<br>参加評価 ${hostStatus.participantAverageRating??'未評価'}（${hostStatus.participantRatingCount}件）<br>中止率 ${Math.round(hostStatus.cancellationRate*100)}%</p><em>${nextLabel?`次のステータス：${nextLabel}`:'最高ステータスです'}</em></section>`);const stats=screen.querySelectorAll('.stats b');stats[0].textContent=hostStatus.hostAverageRating??'—';stats[1].textContent=hostStatus.participantAverageRating??'—';stats[3].textContent=hostStatus.completedHangouts;screen.querySelectorAll('.stats span')[3].textContent='開催完了'}
  const profileChatButton=screen.querySelector('#profile-chat');
  const phoneVerification=screen.querySelector('.profile>.verified');
  if(profileChatButton&&phoneVerification)profileChatButton.before(phoneVerification);
  const profileEditButton=screen.querySelector('#edit-profile');
  if(profileChatButton&&profileEditButton)profileChatButton.after(profileEditButton);
  screen.querySelector('#edit-profile').onclick=showProfileEditor;
}

function showProfileEditor(){
  const interests=(session.user.interests||[]).filter(value=>!INTEREST_OPTIONS.includes(value)).join('、');
  document.body.insertAdjacentHTML('beforeend',`<div class="sheet profile-editor-sheet"><header class="host-menu-header profile-editor-header"><button class="brand-back" type="button" aria-label="プロフィールに戻る"><span></span></button><div><small>アカウント</small><b>プロフィールを編集</b></div><span></span></header><section class="panel profile-editor"><label>プロフィール画像（最大3枚）</label>${profilePhotoTrio(session.user,session.user.displayName)}<input id="edit-profile-photo" class="hidden" type="file" accept="image/jpeg,image/png,image/webp"><small>丸い画像をタップして入れ替えます。中央がメイン画像です。</small><label>表示名</label><input id="edit-display-name" maxlength="40" value="${safeText(session.user.displayName)}"><label>電話番号</label><button class="outline profile-editor-phone" id="edit-phone">${session.user.verificationStatus==='PHONE_VERIFIED'?'電話番号を変更':'電話番号を確認'}</button><label>活動エリア</label><input id="edit-home-area" maxlength="80" placeholder="例：新宿・渋谷" value="${safeText(session.user.homeArea||'')}"><label>自己紹介</label><textarea id="edit-bio" maxlength="500" rows="5" placeholder="好きなことや参加したいHangoutを書きましょう">${safeText(session.user.bio||'')}</textarea><label>興味のあること</label><div class="interest-picker profile-interest-picker">${INTEREST_OPTIONS.map(item=>`<button type="button" data-profile-interest="${safeText(item)}" class="${(session.user.interests||[]).includes(item)?'chosen':''}">${safeText(item)}</button>`).join('')}</div><input id="edit-interests" maxlength="300" placeholder="ボタンにない興味だけ入力" value="${safeText(interests)}"><small>上の候補はタップして黄色で選択し、入力欄には候補にない言葉だけを記載します。</small><label>性別</label><select id="edit-gender"><option value="UNDISCLOSED">回答しない</option><option value="MALE">男性</option><option value="FEMALE">女性</option><option value="OTHER">その他</option></select></section></div>`);
  const sheet=document.querySelector('.profile-editor-sheet');
  const closeProfileEditor=()=>{sheet.classList.remove('open');sheet.classList.add('closing');setTimeout(()=>sheet.remove(),240)};
  setTimeout(()=>sheet.classList.add('open'),0);
  sheet.querySelector('#edit-gender').value=session.user.gender||'UNDISCLOSED';
  const genderSelect=sheet.querySelector('#edit-gender');
  const selectedSlots=session.user.activityTimeSlots||[];
  const chip=(attribute,value,label,chosen=false)=>`<button type="button" ${attribute}="${value}" class="match-choice ${chosen?'chosen':''}">${label}</button>`;
  const currentAgeMin=session.user.preferredAgeMin??null,currentAgeMax=session.user.preferredAgeMax??null;
  const ageChoices=[[null,null,'こだわらない'],[18,24,'18〜24歳'],[25,29,'25〜29歳'],[30,39,'30代'],[40,49,'40代'],[50,100,'50歳〜']];
  genderSelect.insertAdjacentHTML('afterend',`<div class="matching-preferences"><h3>マッチング設定</h3><p class="matching-lead">タップするだけ。複数選べる項目は、もう一度タップすると解除できます。</p><p class="matching-privacy">入力は任意です。位置は市区・駅などのおおまかなエリアだけを保存し、正確なGPS位置は保存しません。</p>
    <div class="matching-field"><b>希望エリア</b><small>よく行く場所を選択</small><div class="match-choice-grid">${MATCH_AREA_OPTIONS.map(value=>chip('data-match-area',value,value,(session.user.preferredAreas||[]).includes(value))).join('')}</div><input id="edit-preferred-areas" maxlength="300" placeholder="ほかのエリアを追加（例：吉祥寺）" value="${safeText((session.user.preferredAreas||[]).filter(value=>!MATCH_AREA_OPTIONS.includes(value)).join('、'))}"></div>
    <div class="matching-field"><b>希望する活動</b><small>興味があるものを選択</small><div class="match-choice-grid">${INTEREST_OPTIONS.map(value=>chip('data-match-activity',value,value,(session.user.preferredActivities||[]).includes(value))).join('')}</div><input id="edit-preferred-activities" maxlength="500" placeholder="ほかの活動を追加" value="${safeText((session.user.preferredActivities||[]).filter(value=>!INTEREST_OPTIONS.includes(value)).join('、'))}"></div>
    <div class="matching-field"><b>希望年齢</b><div class="match-choice-grid match-choice-grid-wide">${ageChoices.map(([min,max,label])=>`<button type="button" data-match-age-min="${min??''}" data-match-age-max="${max??''}" class="match-choice ${(currentAgeMin===min&&currentAgeMax===max)||(!currentAgeMin&&!currentAgeMax&&min===null)?'chosen':''}">${label}</button>`).join('')}</div><input id="edit-preferred-age-min" type="hidden" value="${currentAgeMin??''}"><input id="edit-preferred-age-max" type="hidden" value="${currentAgeMax??''}"></div>
    <div class="matching-field"><b>希望する相手</b><div class="match-choice-grid">${[['MALE','男性'],['FEMALE','女性'],['OTHER','その他'],['UNDISCLOSED','指定なし']].map(([value,label])=>chip('data-preferred-gender',value,label,(session.user.preferredGenders||[]).includes(value))).join('')}</div></div>
    <div class="matching-field"><b>雰囲気・交流スタイル</b><small>自分に合う過ごし方を選択</small><div class="match-choice-grid match-choice-grid-wide">${MATCH_SOCIAL_STYLE_OPTIONS.map(value=>chip('data-match-social-style',value,value,(session.user.socialStyles||[]).includes(value))).join('')}</div></div>
    <div class="matching-field"><b>参加目的</b><small>今回の出会いに求めること</small><div class="match-choice-grid">${MATCH_GOAL_OPTIONS.map(value=>chip('data-match-goal',value,value,(session.user.participationGoals||[]).includes(value))).join('')}</div></div>
    <div class="matching-field"><b>言語</b><small>会話に使いたい言語を複数選択できます</small><div class="match-choice-grid match-choice-grid-wide">${MATCH_LANGUAGE_OPTIONS.map(([value,label])=>chip('data-match-language',value,label,(session.user.preferredLanguages||[]).includes(value))).join('')}</div></div>
    <div class="matching-field"><b>活動しやすい時間</b><small>時間帯と曜日をそれぞれ選択</small><div class="match-choice-subtitle">時間帯</div><div class="match-choice-grid">${MATCH_TIME_OPTIONS.map(value=>chip('data-match-time',value,value,selectedSlots.includes(value))).join('')}</div><div class="match-choice-subtitle">曜日</div><div class="match-choice-grid match-week-grid">${MATCH_DAY_OPTIONS.map(value=>chip('data-match-day',value,value,selectedSlots.includes(value))).join('')}</div><input id="edit-activity-time-slots" type="hidden"></div>
    <div class="matching-field"><b>参加したい時期</b><div class="match-choice-grid match-choice-grid-wide">${[['NOW','今すぐ'],['TODAY','今日'],['THIS_WEEK','今週'],['WEEKEND','週末'],['FLEXIBLE','いつでも']].map(([value,label])=>chip('data-match-urgency',value,label,session.user.participationUrgency===value)).join('')}</div><input id="edit-participation-urgency" type="hidden" value="${session.user.participationUrgency||''}"></div>
    <div class="matching-field"><b>移動できる時間</b><div class="match-choice-grid">${MATCH_TRAVEL_OPTIONS.map(([value,label])=>chip('data-match-travel',value,label,session.user.maxTravelMinutes===value)).join('')}</div><input id="edit-max-travel-minutes" type="hidden" value="${session.user.maxTravelMinutes??''}"></div>
    <div class="matching-field"><b>希望人数</b><small>複数選択できます</small><div class="match-choice-grid">${MATCH_GROUP_OPTIONS.map(([value,label])=>chip('data-match-group',value,label,(session.user.preferredGroupSizes||[]).includes(value))).join('')}</div><input id="edit-preferred-group-sizes" type="hidden"></div>
    <div class="matching-field"><b>1回の予算</b><div class="match-choice-grid match-choice-grid-wide">${MATCH_BUDGET_OPTIONS.map(([min,max,label])=>`<button type="button" data-match-budget-min="${min}" data-match-budget-max="${max}" class="match-choice ${session.user.budgetMin===min&&session.user.budgetMax===max?'chosen':''}">${label}</button>`).join('')}</div><input id="edit-budget-min" type="hidden" value="${session.user.budgetMin??''}"><input id="edit-budget-max" type="hidden" value="${session.user.budgetMax??''}"></div>
    <div class="matching-field"><b>お酒</b><div class="match-choice-grid">${[['NONE','飲まない'],['SOMETIMES','少し飲む'],['YES','飲む']].map(([value,label])=>chip('data-match-alcohol',value,label,session.user.alcoholPreference===value)).join('')}</div><input id="edit-alcohol-preference" type="hidden" value="${session.user.alcoholPreference||''}"></div>
    <div class="matching-field"><b>喫煙環境</b><div class="match-choice-grid">${[['NON_SMOKING','禁煙希望'],['SEPARATED','分煙希望'],['NO_PREFERENCE','気にしない']].map(([value,label])=>chip('data-match-smoking',value,label,session.user.smokingPreference===value)).join('')}</div><input id="edit-smoking-preference" type="hidden" value="${session.user.smokingPreference||''}"></div>
    <div class="matching-field"><b>初参加への配慮</b><small>安心して参加するために必要なこと</small><div class="match-choice-grid match-choice-grid-wide">${MATCH_FIRST_TIME_OPTIONS.map(value=>chip('data-match-first-time',value,value,(session.user.firstTimePreferences||[]).includes(value))).join('')}</div></div>
    <div class="matching-field"><b>苦手・避けたい条件</b><small>おすすめから優先的に外します</small><div class="match-choice-grid match-choice-grid-wide">${MATCH_AVOID_OPTIONS.map(value=>chip('data-match-avoid',value,value,(session.user.avoidPreferences||[]).includes(value))).join('')}</div></div>
    <div class="matching-field"><b>予定の柔軟性</b><small>参加しやすい進行を選択</small><div class="match-choice-grid match-choice-grid-wide">${MATCH_FLEXIBILITY_OPTIONS.map(value=>chip('data-match-flexibility',value,value,(session.user.scheduleFlexibility||[]).includes(value))).join('')}</div></div>
    <label class="matching-consent behavior-learning"><input id="edit-behavior-learning" type="checkbox" ${session.user.behaviorLearningEnabled?'checked':''}> <span><b>アプリ内行動からおすすめを改善</b><small>閲覧した募集、ハート、参加、評価を使います。正確な位置やトーク内容は学習に使いません。</small></span></label>
    <label class="matching-consent"><input id="edit-matching-consent" type="checkbox" ${session.user.matchingDataConsent?'checked':''}> この情報とアプリ内の閲覧・参加履歴を、マッチング改善に利用することに同意します</label></div>`);
  sheet.querySelectorAll('[data-preferred-gender]').forEach(button=>button.onclick=()=>button.classList.toggle('chosen'));
  const toggleChoices=selector=>sheet.querySelectorAll(selector).forEach(button=>button.onclick=()=>button.classList.toggle('chosen'));
  const singleChoice=(selector,onChange)=>sheet.querySelectorAll(selector).forEach(button=>button.onclick=()=>{const wasChosen=button.classList.contains('chosen');sheet.querySelectorAll(selector).forEach(item=>item.classList.remove('chosen'));if(!wasChosen)button.classList.add('chosen');onChange(wasChosen?null:button)});
  toggleChoices('[data-match-area]');toggleChoices('[data-match-activity]');toggleChoices('[data-match-time]');toggleChoices('[data-match-day]');toggleChoices('[data-match-group]');toggleChoices('[data-match-social-style]');toggleChoices('[data-match-goal]');toggleChoices('[data-match-first-time]');toggleChoices('[data-match-avoid]');toggleChoices('[data-match-flexibility]');toggleChoices('[data-match-language]');
  singleChoice('[data-match-age-min]',button=>{sheet.querySelector('#edit-preferred-age-min').value=button?.dataset.matchAgeMin||'';sheet.querySelector('#edit-preferred-age-max').value=button?.dataset.matchAgeMax||''});
  singleChoice('[data-match-urgency]',button=>{sheet.querySelector('#edit-participation-urgency').value=button?.dataset.matchUrgency||''});
  singleChoice('[data-match-travel]',button=>{sheet.querySelector('#edit-max-travel-minutes').value=button?.dataset.matchTravel||''});
  singleChoice('[data-match-budget-min]',button=>{sheet.querySelector('#edit-budget-min').value=button?.dataset.matchBudgetMin||'';sheet.querySelector('#edit-budget-max').value=button?.dataset.matchBudgetMax||''});
  singleChoice('[data-match-alcohol]',button=>{sheet.querySelector('#edit-alcohol-preference').value=button?.dataset.matchAlcohol||''});
  singleChoice('[data-match-smoking]',button=>{sheet.querySelector('#edit-smoking-preference').value=button?.dataset.matchSmoking||''});
  sheet.querySelector('#edit-phone').onclick=()=>{closeProfileEditor();phoneDialog()};
  sheet.querySelectorAll('[data-profile-interest]').forEach(button=>button.onclick=()=>button.classList.toggle('chosen'));
  const profilePhotoInput=sheet.querySelector('#edit-profile-photo');
  const pendingProfilePhotos=userPhotos(session.user);
  let profilePhotosChanged=false;
  let selectedProfilePhotoIndex=0;
  sheet.querySelectorAll('[data-profile-photo-index]').forEach(button=>{button.disabled=false;button.classList.add('profile-editor-photo-slot');button.setAttribute('aria-label',`${Number(button.dataset.profilePhotoIndex)+1}枚目の画像を選ぶ`);button.onclick=()=>{selectedProfilePhotoIndex=Number(button.dataset.profilePhotoIndex);profilePhotoInput.click()}});
  profilePhotoInput.removeAttribute('multiple');
  profilePhotoInput.onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const photo=await imageData(file);pendingProfilePhotos[selectedProfilePhotoIndex]=photo;profilePhotosChanged=true;const button=sheet.querySelector(`[data-profile-photo-index="${selectedProfilePhotoIndex}"]`);button.style.backgroundImage=`url('${photo}')`;button.textContent='';button.classList.remove('empty')}catch(error){toast(error.message)}finally{event.target.value=''}};
  const saveProfileChanges=async()=>{const displayName=sheet.querySelector('#edit-display-name').value.trim();if(!displayName){toast('表示名を入力してください');return false}const parseList=value=>[...new Set(value.split(/[、,]/).map(item=>item.trim()).filter(Boolean))];const parsed=parseList(sheet.querySelector('#edit-interests').value).filter(value=>!INTEREST_OPTIONS.includes(value));const selectedPreset=[...sheet.querySelectorAll('[data-profile-interest].chosen')].map(button=>button.dataset.profileInterest);const updatedInterests=[...new Set([...selectedPreset,...parsed])].slice(0,20);const ageMin=sheet.querySelector('#edit-preferred-age-min').value;const ageMax=sheet.querySelector('#edit-preferred-age-max').value;const budgetMin=sheet.querySelector('#edit-budget-min').value;const budgetMax=sheet.querySelector('#edit-budget-max').value;const selectedAreas=[...sheet.querySelectorAll('[data-match-area].chosen')].map(button=>button.dataset.matchArea);const selectedActivities=[...sheet.querySelectorAll('[data-match-activity].chosen')].map(button=>button.dataset.matchActivity);const selectedTimes=[...sheet.querySelectorAll('[data-match-time].chosen')].map(button=>button.dataset.matchTime);const selectedDays=[...sheet.querySelectorAll('[data-match-day].chosen')].map(button=>button.dataset.matchDay);const selectedGroups=[...sheet.querySelectorAll('[data-match-group].chosen')].map(button=>Number(button.dataset.matchGroup));const socialStyles=[...sheet.querySelectorAll('[data-match-social-style].chosen')].map(button=>button.dataset.matchSocialStyle);const participationGoals=[...sheet.querySelectorAll('[data-match-goal].chosen')].map(button=>button.dataset.matchGoal);const firstTimePreferences=[...sheet.querySelectorAll('[data-match-first-time].chosen')].map(button=>button.dataset.matchFirstTime);if(ageMin&&ageMax&&Number(ageMin)>Number(ageMax)){toast('希望年齢の下限は上限以下にしてください');return false}if(budgetMin&&budgetMax&&Number(budgetMin)>Number(budgetMax)){toast('予算の下限は上限以下にしてください');return false}try{session.user=await api('/users/me',{method:'PATCH',body:JSON.stringify({displayName,homeArea:sheet.querySelector('#edit-home-area').value.trim()||null,bio:sheet.querySelector('#edit-bio').value.trim()||null,interests:updatedInterests,gender:sheet.querySelector('#edit-gender').value,preferredAreas:[...new Set([...selectedAreas,...parseList(sheet.querySelector('#edit-preferred-areas').value)])].slice(0,10),preferredActivities:[...new Set([...selectedActivities,...parseList(sheet.querySelector('#edit-preferred-activities').value)])].slice(0,20),preferredAgeMin:ageMin?Number(ageMin):null,preferredAgeMax:ageMax?Number(ageMax):null,preferredGenders:[...sheet.querySelectorAll('[data-preferred-gender].chosen')].map(button=>button.dataset.preferredGender),activityTimeSlots:[...selectedTimes,...selectedDays].slice(0,12),participationUrgency:sheet.querySelector('#edit-participation-urgency').value||null,maxTravelMinutes:sheet.querySelector('#edit-max-travel-minutes').value?Number(sheet.querySelector('#edit-max-travel-minutes').value):null,preferredGroupSizes:selectedGroups.slice(0,6),budgetMin:budgetMin?Number(budgetMin):null,budgetMax:budgetMax?Number(budgetMax):null,socialStyles,participationGoals,firstTimePreferences,alcoholPreference:sheet.querySelector('#edit-alcohol-preference').value||null,smokingPreference:sheet.querySelector('#edit-smoking-preference').value||null,matchingDataConsent:sheet.querySelector('#edit-matching-consent').checked,...(profilePhotosChanged?{profilePhotos:pendingProfilePhotos.filter(Boolean).slice(0,3)}:{})})});saveSession();await loadHangouts();await profileScreen({animate:false});closeProfileEditor();toast('プロフィールとマッチング設定を更新しました');return true}catch(error){toast(error.message);return false}};
  const profileEditorBack=sheet.querySelector('.profile-editor-header .brand-back');profileEditorBack.onclick=async()=>{if(profileEditorBack.disabled)return;profileEditorBack.disabled=true;const saved=await saveProfileChanges();if(!saved&&sheet.isConnected)profileEditorBack.disabled=false};
}

function showCreate() {
  if(!session.user.profilePhoto){toast('Hangoutの作成にはプロフィール写真が必要です');navigate('profileScreen');return}
  if(session.user.verificationStatus!=='PHONE_VERIFIED'){toast('Hangoutの作成には電話番号確認が必要です');navigate('profileScreen');return}
  document.body.insertAdjacentHTML('beforeend', `<div class="create-hangout-screen"><header class="host-menu-header"><button id="close-create" class="brand-back" type="button" aria-label="ホームに戻る"><span></span></button><div><small>新しい募集</small><b>Hangoutを作る</b></div><span></span></header><main class="host-menu-content"><section class="host-menu-form"><label>何する？</label><input id="title" maxlength="80" value="新宿でコーヒー飲もう"><label>いつ？</label><div class="time-grid"><button class="chosen" data-time="30">⚡ 30分後</button><button data-time="60">🔥 1時間後</button><button data-time="180">🕒 3時間後</button></div><label>公開エリア（新宿・渋谷のみ）</label><select id="service-area"><option value="SHINJUKU">新宿</option><option value="SHIBUYA">渋谷</option></select><label>承認前に表示するエリア</label><input id="public-place" maxlength="100" value="新宿駅周辺"><div class="private-place-box"><strong>承認後に表示する集合場所</strong><small>店名・住所・ナビ情報は承認したメンバーだけに表示します。</small><label>店名</label><input id="meeting-place-name" maxlength="100" value="デモカフェ新宿店"><label>住所</label><input id="meeting-address" maxlength="200" value="東京都新宿区新宿3-1-1"><label>ナビアプリの共有URL（任意）</label><input id="navigation-url" type="url" maxlength="500" placeholder="Googleマップなどの共有URLを貼り付け"><div class="map-input-actions"><button type="button" id="open-map-search">Googleマップで場所を検索</button><button type="button" id="make-map-link">店名・住所からナビを設定</button></div><small id="map-help">ナビアプリで店名を検索し、共有URLを貼り付けるだけで設定できます。</small></div><label>主催者側の人数</label><div class="host-party-grid"><label>男性<select id="host-male-count">${[0,1,2,3,4,5].map(n=>`<option value="${n}" ${n===1?'selected':''}>${n}人</option>`).join('')}</select></label><label>女性<select id="host-female-count">${[0,1,2,3,4,5].map(n=>`<option value="${n}">${n}人</option>`).join('')}</select></label></div><small>例：男性2人なら、参加を検討している人にも「男性2人」と表示されます。</small><label>合計人数（主催者側を含む）</label><select id="capacity">${[3,4,5,6,8,10,12].map(n=>`<option value="${n}" ${n===4?'selected':''}>${n}人</option>`).join('')}</select><label>参加できる性別</label><select id="gender-restriction"><option value="ANY">だれでも</option><option value="MALE_ONLY">男性のみ</option><option value="FEMALE_ONLY">女性のみ</option></select><label>年齢上限</label><select id="max-age"><option value="">制限なし</option><option value="29">20代まで</option><option value="39">30代まで</option><option value="59">50代まで</option></select><label>ひとこと</label><textarea id="desc" rows="4">初参加歓迎！気軽におしゃべりしながら、おいしいコーヒーを一緒に楽しみましょう。</textarea></section></main><footer class="host-menu-actions"><button class="secondary" id="cancel-create">キャンセル</button><button class="primary" id="publish">Hangout公開</button></footer></div>`);
  const screen=document.querySelector('.create-hangout-screen');const form=screen.querySelector('.host-menu-form');form.insertAdjacentHTML('afterbegin','<div id="create-validation-message" class="create-validation-message hidden" role="alert"></div><label>Hangoutのイメージ写真</label><input id="hangout-image" type="file" accept="image/jpeg,image/png,image/webp"><small>公開後も主催者メニューからいつでも変更できます。</small>');const partyGrid=screen.querySelector('.host-party-grid');partyGrid.previousElementSibling.remove();partyGrid.nextElementSibling.remove();partyGrid.remove();const maleSelect={value:session.user.gender==='FEMALE'?'0':'1'};const femaleSelect={value:session.user.gender==='FEMALE'?'1':'0'};const capacitySelect=screen.querySelector('#capacity');capacitySelect.previousElementSibling.textContent='合計人数（主催者1人を含む）';capacitySelect.innerHTML=Array.from({length:7},(_,index)=>`<option value="${index+2}" ${index===2?'selected':''}>${index+2}人</option>`).join('');const close=()=>{screen.classList.add('closing');setTimeout(()=>screen.remove(),240)};setTimeout(()=>screen.classList.add('open'),0);screen.querySelector('#close-create').onclick=close;screen.querySelector('#cancel-create').onclick=close;
  const imageInput=screen.querySelector('#hangout-image');imageInput.previousElementSibling.textContent='スマホの写真・カメラから追加';imageInput.nextElementSibling.textContent='写真ライブラリ、カメラ、ファイルから選べます。';imageInput.insertAdjacentHTML('afterend',`<div class="hangout-image-preview" id="hangout-image-preview"><span>選択した画像をここに表示</span></div><div class="provided-image-head"><b>Hangout Nowの画像を使う</b><small>企画に近い画像を選んでください</small></div><div class="provided-image-grid"><button type="button" data-provided-image="/assets/demo-cafe-hangout.jpg" aria-label="カフェの画像"><span style="background-image:url('/assets/demo-cafe-hangout.jpg')"></span><b>カフェ</b></button><button type="button" data-provided-image="/assets/demo-ramen-mami-v3.jpg" aria-label="ラーメンの画像"><span style="background-image:url('/assets/demo-ramen-mami-v3.jpg')"></span><b>ラーメン</b></button><button type="button" data-provided-image="/assets/demo-running-hangout-v2.jpg" aria-label="ランニングの画像"><span style="background-image:url('/assets/demo-running-hangout-v2.jpg')"></span><b>ランニング</b></button><button type="button" data-provided-image="/assets/demo-drinking-hangout-v2.jpg" aria-label="飲み会の画像"><span style="background-image:url('/assets/demo-drinking-hangout-v2.jpg')"></span><b>飲み会</b></button></div>`);const imagePreview=screen.querySelector('#hangout-image-preview');const providedButtons=[...screen.querySelectorAll('[data-provided-image]')];const showImagePreview=url=>{imagePreview.style.backgroundImage=`url('${url}')`;imagePreview.classList.add('has-image');imagePreview.innerHTML='<b>この画像を使用します</b>'};imageInput.onchange=()=>{const file=imageInput.files[0];providedButtons.forEach(button=>button.classList.remove('chosen'));if(file){const previewUrl=URL.createObjectURL(file);showImagePreview(previewUrl)}};providedButtons.forEach(button=>button.onclick=async()=>{try{const response=await fetch(button.dataset.providedImage);if(!response.ok)throw new Error('画像を読み込めません');const blob=await response.blob();const transfer=new DataTransfer();transfer.items.add(new File([blob],button.dataset.providedImage.split('/').pop(),{type:blob.type||'image/jpeg'}));imageInput.files=transfer.files;providedButtons.forEach(item=>item.classList.toggle('chosen',item===button));showImagePreview(button.dataset.providedImage)}catch(error){toast(error.message)}});
  screen.querySelector('.provided-image-grid').insertAdjacentHTML('beforeend',`<button type="button" data-provided-image="/assets/hangout-dartu.jpg" aria-label="ダーツの画像"><span style="background-image:url('/assets/hangout-dartu.jpg')"></span><b>ダーツ</b></button><button type="button" data-provided-image="/assets/hangout-bar.jpg" aria-label="バーの画像"><span style="background-image:url('/assets/hangout-bar.jpg')"></span><b>バー</b></button><button type="button" data-provided-image="/assets/hangout-gohan.jpg" aria-label="ごはんの画像"><span style="background-image:url('/assets/hangout-gohan.jpg')"></span><b>ごはん</b></button><button type="button" data-provided-image="/assets/hangout-karaoke.jpg" aria-label="カラオケの画像"><span style="background-image:url('/assets/hangout-karaoke.jpg')"></span><b>カラオケ</b></button><button type="button" data-provided-image="/assets/hangout-english.jpg" aria-label="英会話の画像"><span style="background-image:url('/assets/hangout-english.jpg')"></span><b>英会話</b></button><button type="button" data-provided-image="/assets/hangout-shisha.jpg" aria-label="シーシャの画像"><span style="background-image:url('/assets/hangout-shisha.jpg')"></span><b>シーシャ</b></button><button type="button" data-provided-image="/assets/hangout-sweet.jpg" aria-label="スイーツの画像"><span style="background-image:url('/assets/hangout-sweet.jpg')"></span><b>スイーツ</b></button><button type="button" data-provided-image="/assets/hangout-movie.jpg" aria-label="映画の画像"><span style="background-image:url('/assets/hangout-movie.jpg')"></span><b>映画</b></button>`);
  const extraProvidedButtons=[...screen.querySelectorAll('.provided-image-grid [data-provided-image]')].filter(button=>!providedButtons.includes(button));providedButtons.push(...extraProvidedButtons);extraProvidedButtons.forEach(button=>button.onclick=async()=>{try{const response=await fetch(button.dataset.providedImage);if(!response.ok)throw new Error('画像を読み込めません');const blob=await response.blob();const transfer=new DataTransfer();transfer.items.add(new File([blob],button.dataset.providedImage.split('/').pop(),{type:blob.type||'image/jpeg'}));imageInput.files=transfer.files;providedButtons.forEach(item=>item.classList.toggle('chosen',item===button));showImagePreview(button.dataset.providedImage)}catch(error){toast(error.message)}});
  providedButtons.forEach(button=>button.addEventListener('click',async()=>{const response=await fetch(button.dataset.providedImage);if(!response.ok)return;const blob=await response.blob();imageInput.providedFile=new File([blob],button.dataset.providedImage.split('/').pop(),{type:blob.type||'image/jpeg'})}));imageInput.addEventListener('change',()=>{if(imageInput.files[0])imageInput.providedFile=null});screen.querySelector('#publish').addEventListener('click',()=>{if(imageInput.providedFile&&!imageInput.files[0])Object.defineProperty(imageInput,'files',{configurable:true,value:[imageInput.providedFile]})},{capture:true});
  const imageCopy={
    '/assets/hangout-dartu.jpg':{title:'渋谷で気軽にダーツしよう',description:'初心者も経験者も歓迎！気軽にダーツを楽しみながら交流しましょう。'},
    '/assets/hangout-bar.jpg':{title:'落ち着いたバーで話そう',description:'静かなバーでゆっくり話しながら、楽しい時間を過ごしましょう。'},
    '/assets/hangout-gohan.jpg':{title:'新宿で一緒にごはんを食べよう',description:'ひとりでは入りにくいお店へ、みんなで気軽にごはんを食べに行きましょう。'},
    '/assets/hangout-karaoke.jpg':{title:'新宿でカラオケを楽しもう',description:'歌の上手さは関係なし！好きな曲を歌って、みんなで楽しく盛り上がりましょう。'},
    '/assets/hangout-english.jpg':{title:'初心者向け英会話カフェ',description:'間違えても大丈夫。カフェで気軽に英会話を練習しながら交流しましょう。'},
    '/assets/hangout-shisha.jpg':{title:'ゆったりシーシャを楽しもう',description:'落ち着いた空間でシーシャを楽しみながら、気軽におしゃべりしましょう。'},
    '/assets/hangout-sweet.jpg':{title:'話題のスイーツを食べに行こう',description:'気になっていたスイーツを一緒に楽しみながら、のんびり交流しましょう。'},
    '/assets/hangout-movie.jpg':{title:'一緒に映画を観に行こう',description:'気になる映画を一緒に観て、終わったあとは感想を楽しく話しましょう。'},
    '/assets/demo-cafe-hangout.jpg':{title:'新宿でコーヒー飲もう',description:'初参加歓迎！気軽におしゃべりしながら、おいしいコーヒーを一緒に楽しみましょう。'},
    '/assets/demo-ramen-mami-v3.jpg':{title:'新宿でラーメンを食べよう',description:'話題のラーメンを一緒に楽しみませんか？一人では入りづらい方も気軽にどうぞ！'},
    '/assets/demo-running-hangout-v2.jpg':{title:'新宿を気軽にランニングしよう',description:'会話できるゆっくりペースで走ります。初心者も経験者も一緒に楽しみましょう！'},
    '/assets/demo-drinking-hangout-v2.jpg':{title:'新宿で気軽に飲もう',description:'仕事帰りに楽しく乾杯しませんか？初参加の方も入りやすい気軽な飲み会です！'},
  };
  providedButtons.forEach(button=>button.addEventListener('click',()=>{const copy=imageCopy[button.dataset.providedImage];if(!copy)return;screen.querySelector('#title').value=copy.title;screen.querySelector('#desc').value=copy.description;}));
  screen.querySelectorAll('[data-time]').forEach(button=>button.onclick=()=>{screen.querySelectorAll('[data-time]').forEach(item=>item.classList.remove('chosen'));button.classList.add('chosen')});
  screen.querySelector('#service-area').onchange=event=>{const shinjuku=event.target.value==='SHINJUKU';screen.querySelector('#public-place').value=shinjuku?'新宿駅周辺':'渋谷駅周辺';screen.querySelector('#meeting-place-name').value=shinjuku?'デモカフェ新宿店':'デモカフェ渋谷店';screen.querySelector('#meeting-address').value=shinjuku?'東京都新宿区新宿3-1-1':'東京都渋谷区渋谷1-2-3'};
  const mapQuery=()=>encodeURIComponent(`${screen.querySelector('#meeting-place-name').value.trim()} ${screen.querySelector('#meeting-address').value.trim()}`);screen.querySelector('#open-map-search').onclick=()=>window.open(`https://www.google.com/maps/search/?api=1&query=${mapQuery()}`,'_blank','noopener');screen.querySelector('#make-map-link').onclick=()=>{screen.querySelector('#navigation-url').value=`https://www.google.com/maps/search/?api=1&query=${mapQuery()}`;screen.querySelector('#map-help').textContent='店名・住所からナビURLを設定しました。'};
  const validationMessage=screen.querySelector('#create-validation-message');const publishButton=screen.querySelector('#publish');const cancelButton=screen.querySelector('#cancel-create');const backButton=screen.querySelector('#close-create');let publishing=false;const clearValidation=()=>{screen.querySelectorAll('.field-invalid').forEach(item=>item.classList.remove('field-invalid'));validationMessage.classList.add('hidden');validationMessage.innerHTML=''};screen.querySelectorAll('input,select,textarea').forEach(field=>field.addEventListener('input',clearValidation));publishButton.onclick=async()=>{if(publishing)return;clearValidation();const titleField=screen.querySelector('#title');const publicPlaceField=screen.querySelector('#public-place');const placeNameField=screen.querySelector('#meeting-place-name');const addressField=screen.querySelector('#meeting-address');const title=titleField.value.trim();const publicPlace=publicPlaceField.value.trim();const placeName=placeNameField.value.trim();const address=addressField.value.trim();const male=Number(maleSelect.value);const female=Number(femaleSelect.value);const capacity=Number(capacitySelect.value);const errors=[];const invalid=(field,message)=>{field.classList.add('field-invalid');errors.push(message)};if(!title)invalid(titleField,'「何する？」を入力してください');if(!publicPlace)invalid(publicPlaceField,'承認前に表示するエリアを入力してください');if(!placeName)invalid(placeNameField,'集合場所の店名を入力してください');if(!address)invalid(addressField,'集合場所の住所を入力してください');if(male+female<1)invalid(screen.querySelector('.host-party-grid'),'主催者側の人数を設定してください');if(capacity<2)invalid(capacitySelect,'合計人数は2人以上にしてください');if(male+female>capacity)invalid(capacitySelect,'合計人数は主催者側の人数以上にしてください');if(errors.length){validationMessage.innerHTML=`<b>入力内容を確認してください</b><ul>${errors.map(message=>`<li>${message}</li>`).join('')}</ul>`;validationMessage.classList.remove('hidden');screen.querySelector('.field-invalid')?.scrollIntoView({behavior:'smooth',block:'center'});screen.querySelector('.field-invalid input,.field-invalid select,.field-invalid textarea,.field-invalid')?.focus();return}const serviceArea=screen.querySelector('#service-area').value;const meeting=serviceArea==='SHINJUKU'?areas.新宿:areas.渋谷;const navigationUrl=screen.querySelector('#navigation-url').value.trim()||`https://www.google.com/maps/search/?api=1&query=${mapQuery()}`;publishing=true;publishButton.disabled=true;publishButton.setAttribute('aria-busy','true');publishButton.textContent='公開しています…';cancelButton.disabled=true;backButton.disabled=true;try{const maxAge=screen.querySelector('#max-age').value;const file=screen.querySelector('#hangout-image').files[0];const imageUrl=file?await imageData(file):undefined;await api('/hangouts',{method:'POST',body:JSON.stringify({title,description:screen.querySelector('#desc').value.trim()||'一緒に楽しい時間を過ごしましょう！',...(imageUrl?{imageUrl}:{}),category:'CAFE',serviceArea,startInMinutes:Number(screen.querySelector('[data-time].chosen').dataset.time),publicLocationName:publicPlace,locationName:`${placeName} ${address}`,meetingPlaceName:placeName,meetingAddress:address,navigationUrl,latitude:meeting.latitude,longitude:meeting.longitude,maxParticipants:capacity,hostMaleCount:male,hostFemaleCount:female,genderRestriction:screen.querySelector('#gender-restriction').value,...(maxAge?{maxAge:Number(maxAge)}:{})})});await loadHangouts();close();home();toast('Hangoutを公開し、一覧へ追加しました')}catch(error){publishing=false;publishButton.disabled=false;publishButton.removeAttribute('aria-busy');publishButton.textContent='Hangout公開';cancelButton.disabled=false;backButton.disabled=false;toast(error.message)}};
}

function saveSession(){localStorage.setItem(SESSION_STORAGE_KEY,JSON.stringify(session))}
function imageData(file){
  const hangoutImage=document.querySelector('#hangout-image')?.files[0]===file||document.querySelector('#edit-image')?.files[0]===file;
  const sizeLimit=hangoutImage?25:8;
  return new Promise((resolve,reject)=>{
    if(!file||!file.type.startsWith('image/')){reject(new Error('画像ファイルを選択してください'));return}
    if(file.size>sizeLimit*1024*1024){reject(new Error(`画像は${sizeLimit}MB以下にしてください`));return}
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('画像を読み込めません'));
    reader.onload=()=>{
      const img=new Image();
      img.onerror=()=>reject(new Error('この画像形式は読み込めません。JPEG・PNG・WebPで選び直してください'));
      img.onload=()=>{
        const canvas=document.createElement('canvas');
        const context=canvas.getContext('2d');
        if(!context){reject(new Error('画像を変換できません'));return}
        if(hangoutImage){
          const targetRatio=16/9;const sourceRatio=img.width/img.height;
          const sourceWidth=sourceRatio>targetRatio?img.height*targetRatio:img.width;
          const sourceHeight=sourceRatio>targetRatio?img.height:img.width/targetRatio;
          const sourceX=(img.width-sourceWidth)/2;const sourceY=(img.height-sourceHeight)/2;
          canvas.width=Math.max(320,Math.min(1200,Math.round(sourceWidth)));
          canvas.height=Math.round(canvas.width/targetRatio);
          context.imageSmoothingEnabled=true;context.imageSmoothingQuality='high';
          context.drawImage(img,sourceX,sourceY,sourceWidth,sourceHeight,0,0,canvas.width,canvas.height);
          let quality=.86;let converted=canvas.toDataURL('image/jpeg',quality);
          while(converted.length>1_400_000&&quality>.5){quality-=.08;converted=canvas.toDataURL('image/jpeg',quality)}
          if(converted.length>1_500_000){reject(new Error('画像を保存用サイズへ変換できませんでした'));return}
          resolve(converted);return;
        }
        const size=Math.min(512,Math.max(img.width,img.height));const scale=size/Math.max(img.width,img.height);
        canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
        context.drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/jpeg',.84));
      };
      img.src=String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
function phoneDialog(){document.body.insertAdjacentHTML('beforeend',`<div class="sheet profile-phone-sheet"><section class="panel"><div class="handle"></div><h2>電話番号確認</h2><p>SMSで届く6桁の認証コードを入力してください。電話番号は他の利用者には公開されません。</p><label>携帯電話番号</label><input id="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="09012345678" value="${session.user.phoneNumber||''}"><small>090・080・070から、そのまま入力できます。</small><small id="phone-status" role="status" aria-live="polite"></small><div id="phone-code-area" class="hidden"><label>6桁の認証コード</label><input id="phone-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code"><small id="demo-code"></small></div><button class="primary" id="phone-action">SMSを送信</button><button class="secondary" id="close">キャンセル</button></section></div>`);const sheet=document.querySelector('.profile-phone-sheet');const action=sheet.querySelector('#phone-action');const status=sheet.querySelector('#phone-status');sheet.querySelector('#close').onclick=()=>sheet.remove();let requestedPhone=null;action.onclick=async()=>{action.disabled=true;status.textContent='';try{const phone=normalizeJapanesePhone(sheet.querySelector('#phone').value.trim());if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error('携帯電話番号を正しく入力してください');if(!requestedPhone){const result=await api('/users/me/phone/request',{method:'POST',body:JSON.stringify({phone})});requestedPhone=phone;sheet.querySelector('#phone').value=phone;sheet.querySelector('#phone').disabled=true;sheet.querySelector('#phone-code-area').classList.remove('hidden');status.textContent='SMSに認証コードを送信しました';sheet.querySelector('#demo-code').textContent=result.demoCode?`デモ確認コード：${result.demoCode}`:'';action.textContent='確認して完了';return}session.user=await api('/users/me/phone/confirm',{method:'POST',body:JSON.stringify({phone:requestedPhone,code:sheet.querySelector('#phone-code').value.trim()})});saveSession();sheet.remove();profileScreen();toast('電話番号を確認しました')}catch(error){status.textContent=error.message;toast(error.message)}finally{action.disabled=false}}}

function toast(text) {
  document.querySelector('.toast')?.remove();
  document.body.insertAdjacentHTML('beforeend', `<div class="toast">✓ ${text}</div>`);
  setTimeout(() => document.querySelector('.toast')?.remove(), 3000);
}

window.addEventListener('online',connectRealtime);window.addEventListener('offline',()=>document.body.classList.add('realtime-offline'));
if (session) {connectRealtime();loadNotificationCount();loadHangouts().then(()=>navigate('home')).catch(()=>navigate('home'))} else authScreen();
