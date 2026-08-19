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
  const [application, mobile] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
  ]);
  for (const contract of ['matchScore', 'distanceKm', '相性', '距離順', 'publicLocationName || hangout.locationName', 'conditionLabel(hangout)', '主催評価', 'onMap={() => setScreen("map")}']) {
    assert.ok(mobile.includes(contract), `missing native production-home contract: ${contract}`);
  }
  assert.match(mobile, /Alert\.alert\("エリアを選択"/);
  assert.match(mobile, /cardMatchScore}>相性 \{Math\.round/);
  assert.match(application, /category:h\.category, publicLocationName:h\.publicLocationName/);
  assert.match(application, /class="card-category"/);
  assert.match(application, /class="meta card-public-location"/);
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
  assert.match(mobile, /provider === "LINE" \? void onLine\(mode === "register"/);
  assert.match(mobile, /normalizePhoneNumber\(phone\)/);
  assert.match(mobile, /SMSで届いた6桁の認証コード/);
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

test('native Hangout creation matches the production full-screen flow', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  assert.match(mobile, /screen !== "chat" && screen !== "detail" && screen !== "create"/);
  assert.match(mobile, /createHeaderEyebrow}>新しい募集/);
  assert.match(mobile, /accessibilityLabel="ホームに戻る"/);
  assert.match(mobile, /<Text style=\{styles\.label\}>何する？<\/Text>[\s\S]*?<Text style=\{styles\.label\}>いつ？<\/Text>[\s\S]*?<Text style=\{styles\.label\}>公開エリア（新宿・渋谷のみ）<\/Text>/);
  for (const contract of ['承認後に表示する集合場所', 'Googleマップで場所を検索', '店名・住所からナビを設定', '合計人数（主催者1人を含む）', '参加できる性別', '年齢上限', 'ひとこと', 'キャンセル', 'Hangout公開']) assert.ok(mobile.includes(contract));
  assert.match(mobile, /createFooter: \{ flexDirection: "row"/);
  assert.doesNotMatch(mobile, /<Text style=\{styles\.backText\}>‹ ホームへ<\/Text>/);
  assert.doesNotMatch(mobile, /<Text style=\{styles\.label\}>カテゴリ<\/Text>/);
});

test('native profile photo insertion never sends sparse arrays', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  assert.match(mobile, /existingPhotos=.*\.filter\(\(value\): value is string => Boolean\(value\)\)/);
  assert.match(mobile, /const targetIndex=Math\.min\(index,profilePhotos\.length\)/);
  assert.match(mobile, /if\(targetIndex===profilePhotos\.length\)profilePhotos\.push\(photo\)/);
  assert.doesNotMatch(mobile, /profilePhotos\[index\]=photo/);
  assert.match(mobile, /allowsEditing: true,[\s\S]*?aspect: \[1, 1\],[\s\S]*?quality: 0\.5/);
  assert.match(mobile, /Alert\.alert\("画像を更新できませんでした", message\)/);
});

test('native participant Hangout detail matches the production information flow', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  assert.match(mobile, /if \(!isHost\) return \(/);
  assert.match(mobile, /participantHeroPhoto/);
  assert.match(mobile, /participantState}>\{stateLabel\(hangout\)\}/);
  assert.match(mobile, /<CountdownText startAt=\{hangout\.startAt\} style=\{styles\.participantTime\} \/><Text style=\{styles\.participantTime\}> ・ 相性/);
  assert.match(mobile, /participantDescription/);
  assert.match(mobile, /participantPanelLabel}>参加条件/);
  for (const contract of ['集合場所　', '参加人数　', '主催者　', '承認前：概略エリアのみ表示', '参加したい', '参加条件の対象外', 'この募集の主催者を通報・ブロック']) assert.ok(mobile.includes(contract));
  assert.match(mobile, /participantDetailFooter/);
  assert.match(mobile, /hangout\.myJoinStatus === "ACCEPTED" && <Pressable style=\{styles\.participantTalkButton\}/);
});

test('native host Hangout detail matches the production management flow', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  assert.match(mobile, /if \(isHost\) return \(/);
  for (const contract of ['主催者：店名・住所・正確な位置を表示', '参加メンバー', '参加したいメンバー', '件の判断待ち', 'Hangout編集', 'Hangout削除', 'Hangout開始', 'Hangout終了']) assert.ok(mobile.includes(contract));
  assert.match(mobile, /requests\.filter\(\(item\) => item\.status === "PENDING"\)\.length/);
  assert.match(mobile, /onDecide\(item\.id, false\)/);
  assert.match(mobile, /onDecide\(item\.id, true\)/);
  assert.match(mobile, /disabled=\{!hangout\.acceptedParticipants\?\.length\}/);
  assert.match(mobile, /参加メンバーを承認すると開始できます。/);
  assert.match(mobile, /hostOwnerActions/);
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
  assert.doesNotMatch(mobile, /\["home", "map", "chat", "profile"\]\.includes\(screen\)/);
  assert.doesNotMatch(mobile, /‹ 一覧へ/);
  assert.match(mobile, /detailHeaderTitle}>Hangout/);
  assert.match(mobile, /quickMessageScroller: \{ flexGrow: 0, flexShrink: 0, height: 42/);
  assert.match(mobile, /quickMessageRow: \{ alignItems: "center"/);
  assert.match(mobile, /quickMessageButton: \{ height: 28, alignSelf: "center"/);
  assert.match(mobile, /profileChatButton: \{[^\n]*width: "100%"[^\n]*backgroundColor: "#edf8f0"/);
  assert.match(mobile, /setChatReturnScreen\("profile"\)/);
  assert.match(mobile, /setScreen\(chatReturnScreen\)/);
  assert.match(mobile, /useState<AuthMode>\("welcome"\)/);
  assert.match(mobile, /styles\.authVisualCardRaised/);
  assert.match(mobile, /authVisualCard: \{ width: 64, height: 64/);
  assert.doesNotMatch(mobile, /style=\{styles\.authPhoto\}/);
  assert.doesNotMatch(mobile, /SecureStore\.getItemAsync\(SESSION_KEY\)/);
  assert.match(mobile, /profileEditorBackButton: \{ width: 44, height: 44/);
  assert.match(mobile, /onPress=\{\(\) => void save\(\)\} accessibilityRole="button" accessibilityLabel="保存してプロフィールに戻る"/);
  assert.match(mobile, /MATCH_AREA_OPTIONS\.map/);
  assert.match(mobile, /MATCH_TIME_OPTIONS\.map/);
  assert.match(mobile, /MATCH_BUDGET_OPTIONS\.map/);
  assert.match(mobile, /<Text style=\{styles\.heroTitle\}>今から何する？<\/Text>/);
  assert.match(mobile, /<Pressable style=\{styles\.createButton\} onPress=\{onCreate\}>[\s\S]*?<View style=\{styles\.homeActions\}>/);
  assert.match(mobile, /createButton: \{[\s\S]*?width: "100%",[\s\S]*?minHeight: 50/);
  assert.match(mobile, /activityPhoto: \{[\s\S]*?aspectRatio: 32 \/ 9/);
  assert.match(mobile, /filterPillOn: \{ backgroundColor: "#17221d"/);
  assert.match(mobile, /styles\.homeMapPin/);
  assert.doesNotMatch(mobile, /Appleでログイン（準備中）/);
  assert.doesNotMatch(mobile, /provider === "Apple" && styles\.providerButtonDisabled/);
  assert.match(mobile, /xProviderButton/);
  for (const message of ['向かっています', '少し遅れます', '到着しました']) assert.ok(mobile.includes(message));
});

test('native privacy and remaining production screen parity are preserved', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.equal((mobile.match(/matchingDataConsent && session(?:\?\.)?\.user\.behaviorLearningEnabled/g) || []).length, 4);
  for (const contract of ['accessibilityLabel="ホームに戻る"', '>アカウント</Text>', '>プロフィール</Text>', '>興味のあること</Text>', '主催者メニュー', 'カメラで撮る', '写真から選ぶ', '変更を保存', '本人確認', '終了して評価へ進む', '楽しい時間を過ごせましたか？', 'DateTimePicker']) {
    assert.ok(mobile.includes(contract), `missing native production contract: ${contract}`);
  }
});

test('native profile camera, safety report, talk status, host tier, and demo labels match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /chooseProfilePhoto\(index: number, source\?: "camera" \| "library"\)/);
  assert.match(mobile, /chooseRegistrationPhotos = async \(source\?: "camera" \| "library"\)/);
  for (const contract of ['プロフィール画像を追加', 'カメラで撮影', '写真ライブラリから選ぶ', 'ReportHostModal', '同時にブロック', '状況を入力してください（任意）', '終了・評価待ち', 'Hangout終了', '次のステータス：', '最高ステータスです', 'マミ（主催者）として見る', 'マドカ（参加者）として見る']) {
    assert.ok(mobile.includes(contract), `missing current production mobile contract: ${contract}`);
  }
  assert.match(mobile, /blockUser,\s*\}\),/);
});

test('native waitlist, cancelled drafts, home urgency, activity status, and feedback match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.equal((mobile.match(/\["OPEN", "FULL", "STARTED"\]\.includes\(hangout\.status\)/g) || []).length, 2);
  assert.doesNotMatch(mobile, /hangout\.status !== "OPEN"/);
  assert.match(mobile, /if \(visible\) \{ setMessage\(""\); setSubmitting\(false\); \}/);
  assert.match(mobile, /if \(!visible\) return;[\s\S]*setTitle\(hangout\.title\)/);
  for (const contract of ['・遠め', 'hotCountdown', "item.status === 'FULL' ? '満員'", 'MatchFeedbackModal', '次回のおすすめ改善にだけ利用します。']) {
    assert.ok(mobile.includes(contract), `missing native current-production behavior: ${contract}`);
  }
});

test('native Hangout creation offers every production image preset and native photo sources', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  for (const label of ['カフェ', 'ラーメン', 'ランニング', '飲み会', 'ダーツ', 'バー', 'ごはん', 'カラオケ', '英会話', 'シーシャ', 'スイーツ', '映画']) {
    assert.match(mobile, new RegExp(`label: "${label}"`));
  }
  for (const asset of ['demo-cafe-hangout.jpg', 'demo-ramen-mami-v3.jpg', 'demo-running-hangout-v2.jpg', 'demo-drinking-hangout-v2.jpg', 'hangout-dartu.jpg', 'hangout-bar.jpg', 'hangout-gohan.jpg', 'hangout-karaoke.jpg', 'hangout-english.jpg', 'hangout-shisha.jpg', 'hangout-sweet.jpg', 'hangout-movie.jpg']) {
    assert.ok(mobile.includes(asset), `missing production image preset: ${asset}`);
  }
  assert.match(mobile, /HANGOUT_IMAGE_PRESETS\.map\(\(preset\)/);
  assert.match(mobile, /企画に近い画像を選んでください/);
  assert.match(mobile, /launchCameraAsync\(pickerOptions\)/);
  assert.match(mobile, /launchImageLibraryAsync\(pickerOptions\)/);
});

test('native map matches the production Google map and privacy-safe linked list', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /import \{ WebView \} from "react-native-webview"/);
  assert.match(mobile, /Googleマップ・概略位置/);
  assert.match(mobile, /maps\.google\.com\/maps\?q=/);
  assert.match(mobile, /const mappedHangouts = hangouts\.slice\(0, 8\)/);
  assert.match(mobile, /source=\{\{ uri: hangoutImageUrl\(hangout\) \}\}/);
  assert.match(mobile, /hangout\.publicLocationName \|\| "概略エリア"/);
  assert.match(mobile, /承認前は概略エリア、承認後だけ正確な集合地点をナビへ渡します/);
  for (const retiredMap of ['MAP_PIN_POSITIONS', 'styles.mapRoad', 'styles.mapYou', '近くのマップ', '現在地を更新']) assert.ok(!mobile.includes(retiredMap), `retired native map remains: ${retiredMap}`);
});

test('native iOS text entry always exposes a dismiss action and avoids the keyboard', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /InputAccessoryView nativeID=\{IOS_KEYBOARD_ACCESSORY_ID\}/);
  assert.match(mobile, /accessibilityLabel="キーボードを閉じる"/);
  assert.match(mobile, /<Text style=\{styles\.keyboardDoneText\}>完了<\/Text>/);
  assert.match(mobile, /function AppTextInput/);
  assert.match(mobile, /inputAccessoryViewID=\{props\.inputAccessoryViewID/);
  assert.equal((mobile.match(/<TextInput/g) ?? []).length, 1, 'all rendered fields must use the shared keyboard-enabled input');
  assert.match(mobile, /screen !== "chat" \? "padding" : undefined/);
  assert.ok((mobile.match(/keyboardDismissMode="interactive"/g) ?? []).length >= 5);
  assert.ok((mobile.match(/style=\{styles\.modalKeyboardAvoider\}/g) ?? []).length >= 3);
});

test('native applicant photos enlarge and dismiss with a downward swipe', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /accessibilityLabel="プロフィール画像を拡大"/);
  assert.match(mobile, /allowSwipeDismissal animationType="slide"/);
  assert.match(mobile, /画像をタップすると大きく表示できます/);
  assert.match(mobile, /onMoveShouldSetPanResponder:[^\n]+gesture\.dy > 8/);
  assert.match(mobile, /gesture\.dy > 100 \|\| gesture\.vy > 1/);
  assert.match(mobile, /<Text style=\{styles\.photoViewerDismissHint\}>下にスライドして閉じる<\/Text>/);
  assert.doesNotMatch(mobile, /photoViewerClose/);
  assert.doesNotMatch(mobile, /applicantCloseButton/);
});

test('native participant members, applicant profile, and chat heading match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /member\.profilePhoto \? <Image/);
  assert.match(mobile, /member\.gender === "MALE" \? "男性"/);
  assert.match(mobile, /member\.verification === "PHONE_VERIFIED" \? "電話確認済み"/);
  assert.match(mobile, /申請者プロフィール/);
  assert.match(mobile, /applicantDetailLabel}>年齢/);
  assert.match(mobile, /applicantDetailLabel}>活動エリア/);
  assert.match(mobile, /新しいメッセージ順/);
  assert.doesNotMatch(mobile, /会話から次の行動へ/);
  assert.doesNotMatch(mobile, /contentContainerStyle=\{styles\.detailPage\}/);
  assert.doesNotMatch(mobile, />見送る<\/Text>/);
});

test('native profile context, finished ratings, chat copy, and empty interests match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /setSelectedApplicantTitle\("参加メンバープロフィール"\)/);
  assert.match(mobile, /setSelectedApplicantTitle\("申請者プロフィール"\)/);
  assert.match(mobile, /<Text style=\{styles\.applicantModalTitle\}>\{title\}<\/Text>/);
  assert.match(mobile, /member\.id === hostUserId \? "主催者として評価" : "参加者として評価"/);
  assert.match(mobile, /`グループ ・ \$\{selectedRoom\.members\.length\}人 ・ `/);
  assert.match(mobile, /\{item\.sender\.displayName\}<\/Text>/);
  assert.doesNotMatch(mobile, /mine \? "あなた" : item\.sender\.displayName/);
  assert.match(mobile, /placeholder="メッセージを入力"/);
  assert.match(mobile, /user\.interests\.length \? user\.interests\.map/);
  assert.match(mobile, /<Text style=\{styles\.tag\}>未登録<\/Text>/);
});

test('native matching enums, age choices, time slots, and phone copy match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  for (const value of ['"NONE"', '"SOMETIMES"', '"YES"', '"NON_SMOKING"', '"SEPARATED"', '"NO_PREFERENCE"']) assert.ok(mobile.includes(value));
  for (const retired of ['"AVOID" | "OK" | "PREFER"', '["AVOID", "飲まない場を希望"]', '["OK", "どちらでも"]']) assert.ok(!mobile.includes(retired));
  for (const label of ['こだわらない', '18〜24歳', '25〜29歳', '30代', '40代', '50歳〜', '飲まない', '少し飲む', '飲む', '禁煙希望', '分煙希望', '気にしない']) assert.ok(mobile.includes(label));
  assert.match(mobile, /activityTimeSlots: parseList\(activityTimeSlots\)\.slice\(0, 12\)/);
  assert.match(mobile, /phoneChallenge\?'アカウント作成・ログイン':'SMS認証コードを送る'/);
  assert.ok((mobile.match(/member\.gender === "MALE" \? "男性"/g) ?? []).length >= 2);
});

test('native hosted and participated history opens the production finished Hangout flow', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  for (const heading of ['主催中のHangout', '主催したHangout', '参加するHangout', '参加したHangout', 'ハートしたHangout']) assert.ok(mobile.includes(heading));
  assert.match(mobile, /item\.status !== "CANCELLED" && !activeStatuses\.has\(item\.status\)/);
  assert.match(mobile, /if \(detail\.status === "FINISHED"\) await loadRooms\(\)/);
  assert.match(mobile, /function InlineHangoutRatings/);
  assert.match(mobile, /HANGOUT終了後/);
  assert.match(mobile, /主催者・参加者を評価/);
  assert.match(mobile, /一緒に過ごしたメンバーを★1〜5で評価できます/);
  assert.match(mobile, />評価完了<\/Text>/);
  assert.match(mobile, /hangout\.status !== "FINISHED" && hangout\.myJoinStatus === "ACCEPTED"/);
  assert.match(mobile, /profileActivityCard: \{ width: "100%"[^\n]+borderWidth: 1/);
});

test('native notifications match the standalone production notification screen', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /demoRole && screen !== "notifications"/);
  assert.match(mobile, /screen !== "create" && screen !== "notifications"/);
  assert.match(mobile, /onDeviceNotifications=\{\(\) => void enableDeviceNotifications\(true\)\}/);
  assert.match(mobile, /端末通知を許可/);
  assert.match(mobile, /accessibilityRole="checkbox"/);
  assert.match(mobile, /notificationActions: \{ flexDirection: "row"[^\n]+gap: 5/);
  assert.match(mobile, /notificationItemUnread: \{ borderLeftWidth: 5, borderLeftColor: "#176b48", backgroundColor: "#f6fff8" \}/);
  assert.doesNotMatch(mobile, /notificationDot/);
});
