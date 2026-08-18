import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publicDirectory = new URL('../public/', import.meta.url);

function assetVersion(html, asset) {
  return html.match(new RegExp(`${asset.replace('.', '\\.')}\\?v=([0-9-]+)`))?.[1];
}

test('demo and production load the same application assets', async () => {
  const [demo, production] = await Promise.all([
    readFile(new URL('demo.html', publicDirectory), 'utf8'),
    readFile(new URL('app.html', publicDirectory), 'utf8'),
  ]);

  for (const asset of ['styles.css', 'portraits.css', 'auth.css', 'requests.css', 'app.js']) {
    assert.equal(assetVersion(production, asset), assetVersion(demo, asset), `${asset} must stay in sync`);
  }
  assert.match(production, /production:true,demoAccounts:null/);
});

test('production uses the shared Hangout, talk, notification, and profile flows', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');

  for (const contract of [
    'function showJoinRequestDialog',
    '/auth/demo-login',
    'openHangoutFlowChat',
    'function showEditHangout',
    'notificationScreen',
    'showProfileEditor',
    'showHangoutRail',
    "h.hostUserId===session.user.id",
  ]) assert.ok(application.includes(contract), `missing shared production contract: ${contract}`);

  for (const functionName of ['showJoinRequestDialog', 'showEditHangout', 'showHangoutRatingScreen', 'showCreate', 'showProfileEditor']) {
    const declarations = application.match(new RegExp(`function ${functionName}\\(`, 'g')) ?? [];
    assert.equal(declarations.length, 1, `${functionName} must have exactly one current implementation`);
  }
  for (const retiredContract of ['showJoinRequestDialogReliable', 'showEditHangoutFixed', 'showHangoutRatingScreenStable', '画像を選び直す', 'Hangoutを公開する', '内容を編集', '開催を中止']) {
    assert.ok(!application.includes(retiredContract), `retired implementation remains: ${retiredContract}`);
  }
});

test('profile editor saves privacy-safe matching preferences', async () => {
  const [application, mobile] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
  ]);
  for (const contract of ['edit-preferred-areas', 'edit-preferred-activities', 'edit-preferred-age-min', 'data-preferred-gender', 'edit-activity-time-slots', 'edit-participation-urgency', 'edit-max-travel-minutes', 'edit-preferred-group-sizes', 'edit-budget-min', 'edit-budget-max', 'edit-matching-consent', 'matchingDataConsent']) {
    assert.ok(application.includes(contract), `missing matching preference contract: ${contract}`);
  }
  for (const tapContract of ['data-match-area', 'data-match-activity', 'data-match-age-min', 'data-match-time', 'data-match-day', 'data-match-urgency', 'data-match-travel', 'data-match-group', 'data-match-budget-min', 'data-match-social-style', 'data-match-goal', 'data-match-alcohol', 'data-match-smoking', 'data-match-first-time', 'data-match-avoid', 'data-match-flexibility', 'data-match-language', 'edit-behavior-learning']) {
    assert.ok(application.includes(tapContract), `matching preference must be tappable: ${tapContract}`);
  }
  for (const label of ['朝', '昼', '夕方', '夜', '深夜', '月', '火', '水', '木', '金', '土', '日']) assert.ok(application.includes(label), `missing quick choice: ${label}`);
  for (const field of ['socialStyles', 'participationGoals', 'firstTimePreferences', 'alcoholPreference', 'smokingPreference']) assert.ok(application.includes(field), `missing social matching field: ${field}`);
  for (const field of ['avoidPreferences', 'scheduleFlexibility', 'behaviorLearningEnabled', "trackBehavior('DISCOVERY_VIEWED')", "trackBehavior('HANGOUT_VIEWED'"]) assert.ok(application.includes(field), `missing behavior matching field: ${field}`);
  for (const language of ['日本語', '英語', '韓国語', '中国語', 'preferredLanguages']) assert.ok(application.includes(language), `missing language matching field: ${language}`);
  assert.match(application, /正確なGPS位置は保存しません/);
  assert.match(application, /function showMatchFeedbackDialog/);
  assert.match(application, /\/analytics\/match-feedback/);
  for (const contract of ['preferredAreas', 'preferredActivities', 'preferredAgeMin', 'preferredGenders', 'activityTimeSlots', 'participationUrgency', 'maxTravelMinutes', 'preferredGroupSizes', 'budgetMin', 'matchingDataConsent', 'socialStyles', 'participationGoals', 'firstTimePreferences', 'alcoholPreference', 'smokingPreference', 'avoidPreferences', 'scheduleFlexibility', 'behaviorLearningEnabled']) {
    assert.ok(mobile.includes(contract), `missing mobile matching preference contract: ${contract}`);
  }
  assert.match(mobile, /正確なGPS位置は保存しません/);
  assert.match(mobile, /\/analytics\/match-feedback/);
});

test('native talk notifications display and open the addressed room', async () => {
  const [mobile, notifications, chat] = await Promise.all([
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../api/src/notifications/notification.service.ts', import.meta.url), 'utf8'),
    readFile(new URL('../../api/src/chat/chat.service.ts', import.meta.url), 'utf8'),
  ]);
  for (const contract of ['Notifications.setNotificationHandler', 'shouldShowBanner: true', 'shouldPlaySound: true', 'addNotificationResponseReceivedListener', 'getLastNotificationResponseAsync', 'openChatNotification(link)', 'group-chat:', 'direct-chat:']) {
    assert.ok(mobile.includes(contract), `missing native push notification contract: ${contract}`);
  }
  assert.match(notifications, /sound: 'default'/);
  assert.match(chat, /'CHAT_MESSAGE'/);
  assert.match(chat, /'DIRECT_MESSAGE'/);
});

test('native home exposes the current production recommendation cards', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  for (const contract of ['matchScore', 'distanceKm', '相性', 'おすすめ順', 'publicLocationName || hangout.locationName', 'conditionLabel(hangout)', '主催評価', 'onMap={() => setScreen("map")}']) {
    assert.ok(mobile.includes(contract), `missing native production-home contract: ${contract}`);
  }
});

test('demo authentication is not rolled back by optional initial data loading', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');
  const loginStart = application.indexOf('async function demoLogin');
  const loginEnd = application.indexOf('\nfunction shell', loginStart);
  const loginFlow = application.slice(loginStart, loginEnd);

  assert.ok(loginFlow.indexOf("navigate('home')") < loginFlow.indexOf('Promise.allSettled'), 'successful authentication must show the home screen before optional data refresh');
  assert.match(loginFlow, /Promise\.allSettled\(\[loadNotificationCount\(\),loadHangouts\(\)\]\)/);
});

test('social and phone authentication continue directly into account creation', async () => {
  const [application, mobile] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(application, /if\(provider==='電話番号'\)\{phoneAuthDialog\(\);return\}/);
  assert.match(application, /const input=null/);
  assert.match(application, /\/auth\/phone\/confirm/);
  assert.match(mobile, /provider === "LINE" \? void onLine\(\) : provider === "X" \? void onX\(\)/);
  assert.match(mobile, /authenticateWithOAuth\(provider:"google"\|"apple"\)/);
  assert.match(mobile, /\/auth\/phone\/confirm/);
  assert.match(mobile, /\/auth\/x\/redeem/);
  assert.match(application, /const result=await api\(`\/auth\/\$\{provider\}\/redeem`/);
});

test('profile remains behind talk while returning with the back animation', async () => {
  const [application, portraits] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('portraits.css', publicDirectory), 'utf8'),
  ]);

  assert.match(application, /if\(returnToProfile\)sourceScreen\.classList\.add\('profile-behind-chat'\)/);
  assert.match(application, /if\(!returnToProfile\)sourceScreen\?\.remove\(\)/);
  assert.match(application, /phone\.remove\(\);sourceScreen\.classList\.remove\('profile-behind-chat'\);activeScreen='profileScreen'/);
  assert.match(portraits, /\.profile-screen\.profile-behind-chat\{pointer-events:none\}\.chat-phone\{z-index:42\}/);
});

test('profile interest choices are unique and rendered by one implementation', async () => {
  const [application, mobile] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
  ]);
  const optionsSource = application.match(/const INTEREST_OPTIONS=\[([^\]]+)\]/)?.[1] ?? '';
  const options = [...optionsSource.matchAll(/'([^']+)'/g)].map((match) => match[1]);
  const expected = ['カフェ', 'ラーメン', 'ランニング', '飲み会', 'ダーツ', 'バー', 'ごはん', 'カラオケ', '英会話', 'シーシャ', 'スイーツ', '映画'];

  assert.deepEqual(options, expected, 'interest buttons must match Hangout Now image choices');
  assert.equal(new Set(options).size, options.length, 'interest option labels must be unique');
  assert.ok(!application.includes('profileInterestObserver'), 'legacy interest picker must not render a duplicate button set');
  for (const option of expected) assert.ok(mobile.includes(`"${option}"`), `mobile interest choices must include ${option}`);
});

test('Hangout creation fixes the organizer to one person', async () => {
  const [application, mobile, service] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../api/src/hangouts/hangout.service.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(application, /partyGrid\.previousElementSibling\.remove\(\);partyGrid\.nextElementSibling\.remove\(\);partyGrid\.remove\(\)/);
  assert.ok(!mobile.includes('<Text style={styles.label}>主催者側の人数</Text>'));
  assert.ok(!mobile.includes('hostMaleCount: input.hostMaleCount'));
  assert.match(service, /const hostMaleCount=user\.gender===Gender\.FEMALE\?0:1;const hostFemaleCount=user\.gender===Gender\.FEMALE\?1:0/);
});

test('host deletion returns to profile and cancelled Hangouts stay out of hosted history', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');

  assert.match(application, /const returnAfterDeletion=async\(\)=>\{await loadHangouts\(\);await profileScreen\(\{animate:false\}\)\}/);
  assert.match(application, /const hostedPast=activity\.hosted\.filter\(item=>item\.status!=='CANCELLED'/);
  assert.ok(!application.includes('if(returnToProfile)await profileScreen({animate:false});else home()'));
});

test('notifications use a standalone screen without the Hangout Now home header', async () => {
  const [application, requests] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('requests.css', publicDirectory), 'utf8'),
  ]);

  assert.match(application, /document\.querySelector\('\.phone'\)\.classList\.add\('notification-phone'\)/);
  assert.match(requests, /\.notification-phone>\.top,\.notification-phone>\.demo-banner\{display:none\}/);
});

test('profile Hangouts show loading immediately and return to the preserved profile', async () => {
  const [application, requests] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('requests.css', publicDirectory), 'utf8'),
  ]);

  assert.match(application, /profile-hangout-loading[^;]+Hangoutを読み込んでいます/);
  assert.match(application, /if\(returnToProfile\)sheet\.classList\.add\('profile-origin'\)/);
  assert.match(application, /returnToProfile\?'プロフィールに戻る':'ホームに戻る'/);
  assert.match(application, /if\(returnToProfile\)\{sourceScreen\.classList\.remove\('profile-behind-hangout'\);activeScreen='profileScreen'\}else home\(\)/);
  assert.match(application, /showPageLoadingOverlay\('プロフィールを読み込んでいます'\)/);
  assert.match(application, /showPageLoadingOverlay\('トークを読み込んでいます'\)/);
  assert.match(application, /showPageLoadingOverlay\('メッセージを読み込んでいます'\)/);
  assert.match(requests, /\.sheet\.profile-hangout-loading,\.sheet\.page-loading-overlay\{z-index:42;align-items:center;background:transparent;cursor:progress\}/);
  assert.match(requests, /\.hangout-detail-sheet\.profile-origin\{z-index:42\}/);
});

test('completed Hangout ratings have a persistent completion action that removes rating screens', async () => {
  const [application, portraits] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('portraits.css', publicDirectory), 'utf8'),
  ]);

  assert.match(application, /class="primary hangout-rating-complete" data-finish-ratings>評価完了<\/button>/);
  assert.match(application, /document\.querySelectorAll\('\.hangout-rating-sheet'\)\.forEach\(screen=>screen\.remove\(\)\)/);
  assert.match(application, /document\.querySelector\('\.hangout-detail-sheet'\)\?\.remove\(\);home\(\)/);
  assert.match(application, /h\.status==='FINISHED'&&\(mine\|\|h\.myJoinStatus==='ACCEPTED'\)/);
  assert.match(application, /data-detail-finish-ratings>評価完了<\/button>/);
  assert.match(application, /detailRatingComplete\.onclick=returnFromDetail/);
  assert.match(portraits, /\.hangout-rating-sheet>\.panel\{display:flex;flex-direction:column;overflow:hidden\}/);
  assert.match(portraits, /\.hangout-rating-complete,\.detail-rating-complete\{flex:0 0 auto;width:100%/);
});

test('profile ends with a logout action that clears the session', async () => {
  const [application, portraits] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('portraits.css', publicDirectory), 'utf8'),
  ]);

  assert.match(application, /profile-screen-content'\)\.insertAdjacentHTML\('beforeend','<button class="profile-logout-button" id="profile-logout" type="button">ログアウト<\/button>'\)/);
  assert.match(application, /screen\.querySelector\('#profile-logout'\)\.onclick=\(\)=>\{realtimeSocket\?\.disconnect\(\);session=null;demoRole=null;localStorage\.removeItem\(SESSION_STORAGE_KEY\);localStorage\.removeItem\(DEMO_ROLE_STORAGE_KEY\);screen\.remove\(\);authScreen\('login'\)\}/);
  assert.match(portraits, /\.profile-logout-button\{display:block;width:calc\(100% - 32px\)/);
});

test('retired web and mobile implementations do not return', async () => {
  const [application, portraits, requests, mobile] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('portraits.css', publicDirectory), 'utf8'),
    readFile(new URL('requests.css', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
  ]);
  const currentSources = `${application}\n${portraits}\n${requests}\n${mobile}`;
  for (const retiredContract of ['#cancel-hangout', 'profile-editor-photo{', '画像を選び直す', 'Hangoutを公開する', '内容を編集', '開催を中止']) {
    assert.ok(!currentSources.includes(retiredContract), `retired cross-platform implementation remains: ${retiredContract}`);
  }
});

test('native screens include the latest production profile, notification, talk, and member actions', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /preferredLanguages/);
  assert.match(mobile, /LANGUAGE_OPTIONS/);
  assert.match(mobile, /method: "DELETE"/);
  assert.match(mobile, /deleteNotificationsButton/);
  assert.match(mobile, /photoViewerBackdrop/);
  assert.match(mobile, /acceptedParticipants/);
  assert.match(mobile, /quickMessageButton/);
  assert.match(mobile, /registrationPhotos/);
  assert.match(mobile, /authPolicyLinks/);
  assert.match(mobile, /detailHostRow/);
  assert.match(mobile, /distanceWarning/);
  assert.match(mobile, /openHangoutRating/);
  assert.match(mobile, /disabled=\{!hangout\.acceptedParticipants\?\.length\}/);
  assert.match(mobile, /detailReturnScreen/);
  assert.match(mobile, /profileStats/);
  assert.match(mobile, /PhotoViewerModal/);
  for (const message of ['向かっています', '少し遅れます', '到着しました']) assert.ok(mobile.includes(message));
});
