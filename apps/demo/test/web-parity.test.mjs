import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const publicDirectory = new URL('../public/', import.meta.url);

function assetVersion(html, asset) {
  return html.match(new RegExp(`${asset.replace('.', '\\.')}\\?v=([0-9-]+)`))?.[1];
}

test('OAuth redirects pass through the production web proxy', async () => {
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');

  assert.match(server, /redirect:'manual'/);
  assert.match(server, /upstream\.headers\.get\('location'\)/);
  assert.match(server, /\.\.\.\(location\?\{location\}:\{\}\)/);
});

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

test('web and native load Hangout details from the detail API instead of reusing list rows', async () => {
  const [application, mobile] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
  ]);

  assert.match(application, /h=hangoutView\(await api\(`\/hangouts\/\$\{id\}`\)/);
  assert.doesNotMatch(application, /let h = hangouts\.find/);
  assert.match(mobile, /const detail = await request<Hangout>\(`\/hangouts\/\$\{hangout\.id\}`\)/);
});

test('homepage explains activity-first AI matching with trust and consent', async () => {
  const homepage = await readFile(new URL('../public/hangout-now.html', import.meta.url), 'utf8');
  for (const copy of ['人より先に、', '活動をマッチング。', '独自のマッチングアルゴリズム', 'マッチング成立の可能性を高めます', '信頼と安全を考えたマッチング', '活動履歴は許可した場合のみ利用', '正確な位置情報やトーク内容は学習に使用しません']) {
    assert.ok(homepage.includes(copy), `homepage AI matching copy is missing: ${copy}`);
  }
  assert.doesNotMatch(homepage, /94% MATCH|8つの判断パターン/);
});

test('homepage exposes useful search metadata without keyword stuffing', async () => {
  const homepage = await readFile(new URL('../public/hangout-now.html', import.meta.url), 'utf8');
  for (const copy of ['近くの友達・趣味仲間を活動から探す｜Hangout Now', '今やりたい活動、時間、エリアから安全に探せる']) {
    assert.ok(homepage.includes(copy), `homepage search metadata is missing: ${copy}`);
  }
  assert.match(homepage, /<link rel="canonical" href="https:\/\/method-more\.com\/hangout-now\.html">/);
});

test('homepage targets Shinjuku solo participants with measurable acquisition links', async () => {
  const [homepage, guide, sitemap, analytics, newsletter, share, server] = await Promise.all([
    readFile(new URL('../public/hangout-now.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/shinjuku-working-adult-friends.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../public/analytics.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/newsletter.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/share.js', import.meta.url), 'utf8'),
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  ]);

  for (const copy of ['今夜のHangoutを見る', '登録なしで60秒デモ', '18歳以上', '新宿で社会人の友達を、趣味から安全に探す']) {
    assert.ok(homepage.includes(copy), `target acquisition copy is missing: ${copy}`);
  }
  assert.match(homepage, /data-cta-name="browse-hangouts" data-cta-position="hero" data-page-type="homepage"/);
  assert.match(homepage, /href="\/how-it-works\.html#host" data-cta-name="host-guide"/);
  assert.match(homepage, /href="\/shinjuku-working-adult-friends\.html" data-guide-name="shinjuku-working-adult-friends"/);

  for (const contract of ['一人参加しやすい活動の選び方', '参加を決める前の確認リスト', '公共の場所で合流', 'AIマッチングは成立を保証するものではなく', '執筆：Hangout Now運営']) {
    assert.ok(guide.includes(contract), `working-adult guide is missing: ${contract}`);
  }
  assert.match(guide, /<link rel="canonical" href="https:\/\/method-more\.com\/shinjuku-working-adult-friends\.html">/);
  assert.match(guide, /"@type": "Article"/);
  assert.match(guide, /"@type": "BreadcrumbList"/);
  assert.match(sitemap, /https:\/\/method-more\.com\/shinjuku-working-adult-friends\.html/);

  for (const eventName of ['cta_click', 'guide_open', 'demo_open']) assert.ok(analytics.includes(`'${eventName}'`), `analytics event is missing: ${eventName}`);
  assert.match(analytics, /cta_name: cta\.dataset\.ctaName/);
  assert.match(newsletter, /hangoutAnalyticsEvent\?\.\('generate_lead', \{ lead_type: 'newsletter'/);
  for (const campaignPart of ["'shinjuku-launch-202609'", "utm_medium', network === 'web_share' ? 'referral' : 'organic-social'", "utm_campaign', campaign", "utm_id', campaign", "utm_source_platform", "utm_content"]) {
    assert.ok(share.includes(campaignPart), `share attribution is missing: ${campaignPart}`);
  }
  assert.match(share, /shinjuku-working-adult-friends/);
  assert.match(server, /analytics\.js\?v=20260820-2/);
  assert.match(server, /share\.css\?v=20260821-2/);
  assert.match(server, /share\.js\?v=20260821-3/);
  assert.match(server, /requestedPath === '\/tokyo-working-adult-friends\.html'/);
  assert.match(server, /location: '\/shinjuku-working-adult-friends\.html'/);
});

test('corporate homepage presents the three methodmore products accurately', async () => {
  const [corporate, hangout, divertnavi, divertnaviPrivacy, sitemap, corporateStyles, divertStyles, coachDemo, coachBootstrap, coachDemoScript, coachDriveModule, coachUnderpassModule, coachPoliceModule, server] = await Promise.all([
    readFile(new URL('../public/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/hangout-now.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/divertnavi.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/divertnavi-privacy.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/sitemap.xml', import.meta.url), 'utf8'),
    readFile(new URL('../public/corporate.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/divertnavi.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-demo/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-demo/bootstrap.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-demo/dist/mobile/demo.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-demo/dist/mobile/continuousDemoDrive.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-demo/dist/mobile/divertNaviUnderpasses.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/coachgo-demo/dist/mobile/kanagawaPolicePoints.js', import.meta.url), 'utf8'),
    readFile(new URL('../server.mjs', import.meta.url), 'utf8'),
  ]);

  assert.match(corporate, /<title>methodmore｜日常の選択を、もっと前へ。<\/title>/);
  assert.match(corporate, /<link rel="canonical" href="https:\/\/method-more\.com\/">/);
  assert.match(corporate, /href="\/hangout-now\.html"/);
  assert.match(corporate, /href="\/divertnavi\.html"/);
  assert.match(corporate, /href="\/divertnavi-app\/">Webアプリを開く<\/a>/);
  assert.match(corporate, /Hangout <em>Now<\/em>/);
  assert.match(corporate, /DivertNavi/);
  assert.match(corporate, /CoachGo/);
  assert.match(corporate, /公開中/);
  assert.match(corporate, /Android MVP 開発中/);
  assert.match(corporate, /公開データ連携PoC 検証中/);
  assert.match(corporate, /DivertNaviと同じ全国のアンダーパス公開地点/);
  assert.match(corporate, /href="\/coachgo-demo\/"[^>]*>デモを体験/);
  assert.match(coachDemo, /<title>CoachGo 危険監視PoC<\/title>/);
  assert.match(coachDemo, /id="mapbox-map"/);
  assert.match(coachDemo, /class="setting-switch"/);
  assert.match(coachDemo, /id="demo-playback"/);
  assert.doesNotMatch(coachDemo, /開発用シナリオ|危険監視を開始|何を見守りますか？/);
  assert.match(coachDemo, /src="\/coachgo-demo\/runtime-config\.js"/);
  assert.match(coachDemo, /src="\/coachgo-demo\/vendor\/mapbox-gl\.js"/);
  assert.match(coachDemo, /href="\/coachgo-demo\/styles\.css\?v=20260824-5"/);
  assert.match(coachDemo, /src="\/coachgo-demo\/bootstrap\.js\?v=20260824-6"/);
  assert.match(coachBootstrap, /\/coachgo-demo\/dist\/mobile\/demo\.js\?v=20260824-9/);
  assert.match(coachBootstrap, /dataset\.clientError/);
  assert.match(coachDemoScript, /SYNTHETIC_ONLY/);
  assert.match(coachDemoScript, /公開版: 合成アンダーパス1件 \/ 合成交通安全地点1件/);
  assert.match(coachDemoScript, /buildNationalUnderpassMapPayload/);
  assert.match(coachDemoScript, /divertNaviUnderpasses\.js\?v=20260824-1/);
  assert.match(coachDemoScript, /coachgo-underpass-clusters/);
  assert.match(coachDemoScript, /DivertNavi公開データ: アンダーパス/);
  assert.match(coachDemoScript, /directions\/v5\/mapbox\/driving/);
  assert.match(coachDemoScript, /自動デモ走行中　横浜駅 → 本厚木駅/);
  assert.match(coachDemoScript, /continuousDemoDrive\.js\?v=20260824-1/);
  assert.match(coachDemoScript, /kanagawaPolicePoints\.js\?v=20260824-1/);
  assert.match(coachDemoScript, /createCategoryMarkerImage/);
  assert.match(coachDemoScript, /POLICE_ENFORCEMENT/);
  assert.match(coachDriveModule, /YOKOHAMA_STATION/);
  assert.match(coachDriveModule, /HON_ATSUGI_STATION/);
  assert.match(coachDemoScript, /api\.rainviewer\.com\/public\/weather-maps\.json/);
  assert.match(coachDemo, /data-category="RAIN_CLOUD"/);
  assert.match(coachDemo, /Weather data by RainViewer/);
  assert.doesNotMatch(coachDemo, /HAZARD MONITOR|NOTIFICATION PREVIEW|WASHI AURORA|id="topbar-settings"|id="mobile-settings"/);
  assert.match(coachPoliceModule, /神奈川県警察 神奈川警察署/);
  assert.match(coachPoliceModule, /神奈川県警察 横須賀南警察署/);
  assert.equal((coachPoliceModule.match(/"id": "kanagawa-/g) ?? []).length, 44);
  assert.match(coachPoliceModule, /現在の取締り実施を示す情報ではありません/);
  assert.match(coachUnderpassModule, /function buildNationalUnderpassMapPayload/);
  assert.match(server, /requestedPath === '\/coachgo-demo'/);
  assert.match(server, /requestedPath === '\/coachgo-demo\/runtime-config\.js'/);
  assert.match(server, /underpassDataUrl: '\/divertnavi-app\/data\/underpasses\.generated\.json'/);
  assert.match(server, /dataMode: 'DIVERTNAVI_PUBLIC'/);
  assert.match(server, /'wasm-unsafe-eval'/);
  assert.match(hangout, /<link rel="canonical" href="https:\/\/method-more\.com\/hangout-now\.html">/);
  assert.match(divertnavi, /<link rel="canonical" href="https:\/\/method-more\.com\/divertnavi\.html">/);
  assert.match(divertnavi, /<title>走るだけで、みんなを守る｜DivertNavi<\/title>/);
  assert.match(divertnavi, /href="\/divertnavi-app\/">ブラウザでシミュレーション/);
  assert.match(divertnavi, /href="\/divertnavi-privacy\.html">プライバシー<\/a>/);
  assert.match(divertnaviPrivacy, /<link rel="canonical" href="https:\/\/method-more\.com\/divertnavi-privacy\.html">/);
  assert.match(divertnaviPrivacy, /<title>プライバシーポリシー \| DivertNavi<\/title>/);
  for (const privacyCopy of ['位置情報', '目的地の検索情報と履歴', '危険情報の登録', 'Mapbox', 'Open-Meteo', 'RainViewer', '利用者への関連付けとトラッキング', '保存期間と削除', 'info@method-more.com']) {
    assert.ok(divertnaviPrivacy.includes(privacyCopy), `DivertNavi privacy copy is missing: ${privacyCopy}`);
  }
  for (const copy of [
    'DivertNavi（ダイバーナビ）',
    'ナビゲーションアプリ<br>ではありません',
    '同じ道路・進行方向の前方',
    '運転中は、<br>画面を操作しない',
    '生の位置履歴をサーバーに保存しません',
    '警察・行政機関が提供するサービスではありません',
    '文章入力は使わず、大きなアイコンとラベル、音声入力で共有します。',
    '12種類の危険カテゴリ。',
    'Android MVP',
    'iOS',
  ]) assert.ok(divertnavi.includes(copy), `DivertNavi product copy is missing: ${copy}`);
  for (const category of ['取り締まり情報', '落下物・落石', '冠水', '雹', '激しい雨・水たまり', '事故・故障車', '工事・車線規制', '穴・段差', '白線・停止線が見えにくい', '標識・信号が見えにくい', '分かりにくい・誤解しやすい標識', '滑りやすい路面']) {
    assert.ok(divertnavi.includes(category), `DivertNavi hazard category is missing: ${category}`);
  }
  assert.match(divertnavi, /工事・車線規制<\/b><\/article>\s*<article><span>🕳️<\/span><b>穴・段差/);
  const categoryMarkup = divertnavi.match(/<div class="dn-category-list">([\s\S]*?)<\/div>/)?.[1] ?? '';
  assert.equal((categoryMarkup.match(/<article>/g) ?? []).length, 12);
  assert.match(divertStyles, /\.dn-category-list \{ display: grid; grid-template-columns: repeat\(4, 1fr\);/);
  assert.equal(assetVersion(corporate, 'corporate.css'), assetVersion(divertnavi, 'corporate.css'));
  assert.match(sitemap, /https:\/\/method-more\.com\/hangout-now\.html/);
  assert.match(sitemap, /https:\/\/method-more\.com\/divertnavi\.html/);
  assert.match(sitemap, /https:\/\/method-more\.com\/divertnavi-privacy\.html/);
  assert.match(corporateStyles, /\.divert-art/);
  assert.match(corporateStyles, /\.coach-art/);
  assert.match(divertStyles, /@media \(max-width: 620px\)/);
});

test('DivertNavi browser simulator is packaged under the product page', async () => {
  const [appIndex, underpassData] = await Promise.all([
    readFile(new URL('../public/divertnavi-app/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/divertnavi-app/data/underpasses.generated.json', import.meta.url), 'utf8'),
  ]);
  const dataset = JSON.parse(underpassData);

  assert.match(appIndex, /src="\/divertnavi-app\/assets\/index-[^"]+\.js"/);
  assert.match(appIndex, /href="\/divertnavi-app\/assets\/index-[^"]+\.css"/);
  assert.match(appIndex, /src="\/divertnavi-app\/config\.js"/);
  assert.equal(dataset.coverage.importedPrefectures, 47);
  assert.equal(dataset.coverage.itemCount, 4577);
});

test('public server sends browser security headers', async () => {
  const server = await readFile(new URL('../server.mjs', import.meta.url), 'utf8');
  for (const header of ['content-security-policy', 'permissions-policy', 'referrer-policy', 'x-content-type-options', 'x-frame-options']) {
    assert.ok(server.includes(`'${header}'`), `security header is missing: ${header}`);
  }
  assert.match(server, /frame-ancestors 'none'/);
  assert.match(server, /object-src 'none'/);
  assert.match(
    server,
    /img-src 'self' data: [^;]*https:\/\/hangoutnow-demo\.onrender\.com/,
    'CSP must allow the production demo asset origin used by Hangout image URLs',
  );
  assert.match(server, /https:\/\/api\.mapbox\.com/);
  assert.match(server, /worker-src blob:/);
  assert.match(server, /requestedPath === '\/divertnavi-app\/'/);
  assert.match(server, /requestedPath === '\/divertnavi-app\/config\.js'/);
  assert.match(server, /process\.env\.MAPBOX_APIKEY/);
  assert.match(server, /process\.env\.WXTECH_API_KEY/);
  assert.match(server, /requestedPath === '\/api\/weather\/radar'/);
  assert.match(server, /https:\/\/api\.rainviewer\.com/);
  assert.match(server, /https:\/\/tilecache\.rainviewer\.com/);
  assert.match(server, /https:\/\/api\.open-meteo\.com/);
  assert.match(server, /process\.env\.DIVERTNAVI_DASHBOARD_PATH/);
  assert.match(server, /action === 'status'/);
  assert.doesNotMatch(server, /\/divertnavi-app\/ops-[a-z0-9-]{24,}/, 'private dashboard path must not be committed');
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
  assert.match(application, /const MATCH_ACTIVITY_OPTIONS=\[\.\.\.INTEREST_OPTIONS,'チル'\]/);
  assert.match(application, /MATCH_ACTIVITY_OPTIONS\.map\(value=>chip\('data-match-activity'/);
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
  assert.match(mobile, /const MATCH_ACTIVITY_OPTIONS = \[\.\.\.INTEREST_OPTIONS, "チル"\] as const/);
  assert.match(mobile, /MATCH_ACTIVITY_OPTIONS\.map/);
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
  for (const contract of ['matchScore', 'distanceKm', '相性', 'おすすめ順', 'publicLocationName || hangout.locationName', 'conditionLabel(hangout)', '主催評価', 'onMap={() => setScreen("map")}']) {
    assert.ok(mobile.includes(contract), `missing native production-home contract: ${contract}`);
  }
  assert.match(mobile, /Alert\.alert\("エリアを選択"/);
  assert.match(mobile, /cardMatchScore}>相性 \{Math\.round/);
  assert.match(application, /category:h\.category, publicLocationName:h\.publicLocationName/);
  assert.match(application, /class="card-category"/);
  assert.match(application, /class="meta card-public-location"/);
});

test('native home mirrors the production keyword mosaics and every demo category', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  for (const category of ['FOOD', 'SUSHI', 'YAKINIKU', 'DINNER', 'DRINKING', 'WINE', 'BAR', 'IZAKAYA', 'CAFE', 'SWEETS', 'RUNNING', 'WALKING', 'YOGA', 'CYCLING', 'MOTORCYCLE', 'PICNIC', 'WATERFRONT', 'KARAOKE', 'DARTS', 'GAME', 'MOVIE', 'BOWLING', 'ARCADE', 'ENGLISH', 'SOCIAL', 'SHISHA', 'SAUNA', 'NIGHT_VIEW', 'MUSIC']) {
    assert.ok(mobile.includes(`${category}: GENERATED_HANGOUT_IMAGE`), `native generated image is missing: ${category}`);
  }
  assert.match(mobile, /id: "active", label: "運動", description: "一緒に体を動かして自然に仲良くなろう", categories: \["RUNNING", "WALKING", "YOGA", "CYCLING"\]/);
  assert.match(mobile, /id: "outdoor", label: "アウトドア", description: "外の空気を楽しみながら気軽に集まろう", categories: \["MOTORCYCLE", "PICNIC", "WATERFRONT"\]/);
  assert.doesNotMatch(mobile, /運動・アウトドア/);
  for (const contract of ['キーワードから探す', '気分に合うHangout', 'すべて見る', 'おすすめ順', 'HomeKeywordMosaic', 'HomeKeywordTile', 'keywordTileFeatured']) assert.ok(mobile.includes(contract), `native keyword mosaic contract is missing: ${contract}`);
  assert.match(mobile, /keywordTilePhoto: \{ flex: 1, width: "100%", height: "100%", backgroundColor: "#dfe8df" \}/);
  assert.match(mobile, /items\.slice\(0, 6\)/);
  assert.match(mobile, /setActivityGroup\(group\.id\)/);
  assert.match(mobile, /right\.interestScore - left\.interestScore/);
  assert.doesNotMatch(mobile, /\["おすすめ", "30分後", "1時間後", "3時間後"\]/);
});

test('web Hangout cards are shorter without removing images or information', async () => {
  const [application, portraits, requests] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('portraits.css', publicDirectory), 'utf8'),
    readFile(new URL('requests.css', publicDirectory), 'utf8'),
  ]);

  assert.match(portraits, /\.card-photo\{width:100%;aspect-ratio:32\/9/);
  assert.match(requests, /\.cards\{gap:10px\}\.card-body\{padding:12px 14px\}\.card-top\{padding-top:3px\}/);
  assert.match(requests, /\.card h3\{margin-top:0;margin-bottom:2px\}/);
  assert.match(requests, /\.card-public-location\{margin-top:2px\}\.card \.people\{margin-top:2px!important\}\.card-bottom\{margin-top:8px\}/);
  for (const visibleInformation of ['card-category', 'card-public-location', 'meta people', 'host-tier', 'class="match"']) {
    assert.ok(application.includes(visibleInformation), `Hangout card information is missing: ${visibleInformation}`);
  }
});

test('web discovery groups Hangouts into six-item keyword mosaics', async () => {
  const [application, requests, seed] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('requests.css', publicDirectory), 'utf8'),
    readFile(new URL('../../../scripts/seed-public-demo.mjs', import.meta.url), 'utf8'),
  ]);

  assert.doesNotMatch(application, /activeFilter|data-filter/);
  for (const keyword of ['ごはん', '飲み', 'カフェ', 'スイーツ', '運動', 'アウトドア', '遊ぶ', '交流', 'チル']) {
    assert.ok(application.includes(keyword), `keyword section is missing: ${keyword}`);
  }
  assert.doesNotMatch(application, /label:'ごはん・飲み'/);
  assert.doesNotMatch(application, /label:'カフェ・スイーツ'|label:'趣味・交流'/);
  assert.doesNotMatch(application, /label:'運動・アウトドア'/);
  assert.match(application, /id:'food',label:'ごはん'.+categories:\['FOOD','SUSHI','YAKINIKU','DINNER'\]/);
  assert.match(application, /id:'drink',label:'飲み'.+categories:\['DRINKING','WINE','BAR','IZAKAYA'\]/);
  assert.match(application, /id:'cafe',label:'カフェ'.+categories:\['CAFE'\]/);
  assert.match(application, /id:'sweets',label:'スイーツ'.+categories:\['SWEETS'\]/);
  assert.match(application, /id:'active',label:'運動'.+categories:\['RUNNING','WALKING','YOGA','CYCLING'\]/);
  assert.match(application, /id:'outdoor',label:'アウトドア'.+categories:\['MOTORCYCLE','PICNIC','WATERFRONT'\]/);
  assert.match(application, /id:'play',label:'遊ぶ'.+categories:\['KARAOKE','DARTS','GAME','MOVIE','BOWLING','ARCADE'\]/);
  assert.match(application, /id:'social',label:'交流'.+categories:\['ENGLISH','SOCIAL'\]/);
  assert.match(application, /id:'chill',label:'チル'.+categories:\['SHISHA','SAUNA','NIGHT_VIEW','MUSIC'\]/);
  assert.match(application, /items\.slice\(0,6\)\.map\(keywordTile\)/);
  assert.match(application, /<article class="keyword-hangout-tile/);
  assert.match(application, /data-keyword-heart="\$\{safeText\(h\.id\)\}"/);
  assert.match(application, /function toggleHangoutHeart\(button,hangoutId,refresh\)/);
  assert.match(application, /toggleHangoutHeart\(button,button\.dataset\.keywordHeart,home\)/);
  assert.match(application, /data-keyword="\$\{group\.id\}"/);
  assert.match(application, /aria-label="\$\{group\.label\}をすべて見る"/);
  assert.match(application, /class="keyword-view-all"><span>すべて見る<\/span><b aria-hidden="true">›<\/b>/);
  assert.match(application, /function keywordHangoutList\(keywordId\)/);
  assert.match(application, /const groups=personalizedKeywordSections\(\)/);
  assert.match(application, /await loadHangouts\(\)\.catch\(\(\)=>undefined\);refresh\(\)/);
  assert.match(application, /const behaviorRefresh=trackBehavior\('HANGOUT_VIEWED',h\.id\)/);
  assert.match(application, /await behaviorRefresh;await loadHangouts\(\)\.catch\(\(\)=>undefined\)/);
  assert.match(application, /bindFullHangoutCards\(\(\)=>keywordHangoutList\(keywordId\),keywordId\)/);
  assert.match(application, /else if\(returnKeywordId\)keywordHangoutList\(returnKeywordId\)/);
  assert.match(requests, /\.keyword-mosaic\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-template-rows:repeat\(3,92px\)/);
  assert.match(requests, /\.keyword-hangout-tile:first-child\{grid-column:1\/3;grid-row:1\/3/);
  assert.match(requests, /\.keyword-hangout-tile:nth-child\(6\)\{grid-column:3;grid-row:3\}/);
  assert.match(requests, /\.keyword-tile-heart\{position:absolute;z-index:4/);
  assert.match(requests, /\.keyword-tile-heart\.on\{background:#176b48;color:#fff\}/);
  assert.match(requests, /\.keyword-view-all\{[^}]*min-height:38px[^}]*background:#176b48[^}]*color:#fff/);
  assert.match(requests, /\.keyword-title:active \.keyword-view-all\{transform:scale\(\.96\)/);
  for (const demoTitle of ['古民家カフェでのんびり', 'テラスカフェで朝活', '夜カフェでゆっくり話そう', 'ふわふわパンケーキを食べよう', 'アフタヌーンティーで交流', '和菓子を少しずつ楽しむ会', '季節のジェラート巡り', 'みんなでボウリング', 'ゲームセンターで遊ぼう', '20代・30代のゆる交流会', 'ひとり参加歓迎のおしゃべり会', '読書好きの交流会', 'カメラ好きで集まろう', '地方出身者の交流会', '公園でゆるくピクニック', 'サウナでととのう会', '夜景を眺めながらのんびり', '川沿いで夕涼み', '音楽を聴きながらまったり']) {
    assert.ok(seed.includes(demoTitle), `demo Hangout is missing: ${demoTitle}`);
  }
});

test('web keyword mosaics render photos and keep hearts inside each tile', async () => {
  const [application, portraits, demo, production] = await Promise.all([
    readFile(new URL('../public/app.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/portraits.css', import.meta.url), 'utf8'),
    readFile(new URL('../public/demo.html', import.meta.url), 'utf8'),
    readFile(new URL('../public/app.html', import.meta.url), 'utf8'),
  ]);
  assert.match(application, /keyword-tile-photo \$\{hangoutPhotoClass\(h\)\}/);
  assert.match(application, /photoStyle\(h\.imageUrl\)/);
  assert.match(portraits, /\.keyword-mosaic\{height:276px;display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-template-rows:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(portraits, /\.keyword-hangout-tile\.featured\{grid-column:1\/3;grid-row:1\/3\}/);
  assert.match(portraits, /\.keyword-hangout-tile:nth-child\(6\)\{grid-column:3;grid-row:3;/);
  assert.match(portraits, /\.keyword-hangout-tile\{position:relative;isolation:isolate;/);
  assert.match(portraits, /\.keyword-tile-photo\{position:absolute;inset:0;display:block;width:100%;height:100%;/);
  assert.match(portraits, /\.keyword-tile-photo\.custom-hangout-photo\{background-size:cover!important;background-position:center!important\}/);
  assert.match(portraits, /\.keyword-tile-heart\{position:absolute;z-index:4;top:5px;right:5px;/);
  assert.match(demo, /portraits\.css\?v=20260821-43/);
  assert.match(production, /portraits\.css\?v=20260821-43/);
});

test('public demo seeds every Hangout category with generated activity photography', async () => {
  const seed = await readFile(new URL('../../../scripts/seed-public-demo.mjs', import.meta.url), 'utf8');
  const categories = [
    'FOOD', 'SUSHI', 'YAKINIKU', 'DINNER',
    'DRINKING', 'WINE', 'BAR', 'IZAKAYA',
    'CAFE', 'SWEETS',
    'RUNNING', 'WALKING', 'YOGA', 'CYCLING',
    'MOTORCYCLE', 'PICNIC', 'WATERFRONT',
    'KARAOKE', 'DARTS', 'GAME', 'MOVIE', 'BOWLING', 'ARCADE',
    'ENGLISH', 'SOCIAL',
    'SHISHA', 'SAUNA', 'NIGHT_VIEW', 'MUSIC',
  ];
  const groups = ['food', 'drink', 'cafe', 'sweets', 'active', 'outdoor', 'play', 'social', 'chill'];

  for (const category of categories) {
    assert.match(seed, new RegExp(`\\b${category}: generatedDemoPhoto\\('`), `generated photo mapping is missing: ${category}`);
    assert.match(seed, new RegExp(`category: '${category}'|,'${category}','(?:SHINJUKU|SHIBUYA)'`), `demo Hangout is missing: ${category}`);
  }
  for (const group of groups) {
    const photo = await readFile(new URL(`assets/hangout-demo-${group}-2026.webp`, publicDirectory));
    assert.ok(photo.byteLength > 50_000, `generated demo photo is unexpectedly small: ${group}`);
  }
});

test('web discovery prioritizes groups and Hangouts by private recommendation scores', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');
  const rankingStart = application.indexOf('function recommendationScore');
  const rankingEnd = application.indexOf('function keywordTile', rankingStart);
  assert.ok(rankingStart >= 0 && rankingEnd > rankingStart, 'personalized ranking functions are missing');
  const rankingSource = application.slice(rankingStart, rankingEnd);
  const rank = new Function('hangouts', 'HANGOUT_KEYWORD_GROUPS', `${rankingSource};return personalizedKeywordSections();`);
  const groups = [
    { id: 'drink', categories: ['DRINKING'] },
    { id: 'cafe', categories: ['CAFE'] },
    { id: 'chill', categories: ['SAUNA'] },
  ];
  const ranked = rank([
    { id: 'drink-1', category: 'DRINKING', match: 74 },
    { id: 'cafe-2', category: 'CAFE', match: 88 },
    { id: 'cafe-1', category: 'CAFE', match: 96 },
    { id: 'chill-1', category: 'SAUNA', match: 82 },
  ], groups);
  assert.deepEqual(ranked.map((section) => section.group.id), ['cafe', 'chill', 'drink']);
  assert.deepEqual(ranked[0].items.map((hangout) => hangout.id), ['cafe-1', 'cafe-2']);
});

test('demo authentication is not rolled back by optional initial data loading', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');
  const loginStart = application.indexOf('async function demoLogin');
  const loginEnd = application.indexOf('\nfunction shell', loginStart);
  const loginFlow = application.slice(loginStart, loginEnd);

  assert.ok(loginFlow.indexOf("navigate('home')") < loginFlow.indexOf('Promise.allSettled'), 'successful authentication must show the home screen before optional data refresh');
  assert.match(loginFlow, /Promise\.allSettled\(\[loadNotificationCount\(\),loadHangouts\(\)\]\)/);
});

test('social authentication remains available without phone authentication', async () => {
  const [application, mobile] = await Promise.all([
    readFile(new URL('app.js', publicDirectory), 'utf8'),
    readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8'),
  ]);

  for (const provider of ['Google', 'Apple', 'X', 'LINE']) {
    assert.ok(application.includes(`data-auth-provider="${provider}"`));
    assert.ok(mobile.includes(`"${provider}"`));
  }
  assert.doesNotMatch(application, /auth\/phone|phoneAuthDialog|電話番号|SMS認証/);
  assert.doesNotMatch(mobile, /auth\/phone|PhoneVerificationScreen|電話番号|SMS認証/);
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

test('web Hangout publishing gives immediate feedback and ignores repeated taps', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');
  assert.match(application, /let publishing=false/);
  assert.match(application, /publishButton\.onclick=async\(\)=>\{if\(publishing\)return/);
  assert.match(application, /publishButton\.disabled=true;publishButton\.setAttribute\('aria-busy','true'\);publishButton\.textContent='公開しています…'/);
  assert.match(application, /catch\(error\)\{publishing=false;publishButton\.disabled=false;publishButton\.removeAttribute\('aria-busy'\);publishButton\.textContent='Hangout公開'/);
});

test('every web button has a shared rapid repeat guard', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');
  assert.match(application, /const BUTTON_REPEAT_GUARD_MS=900/);
  assert.match(application, /const recentButtonActions=new WeakMap\(\)/);
  assert.match(application, /document\.addEventListener\('click',event=>\{/);
  assert.match(application, /event\.stopImmediatePropagation\(\)/);
  assert.match(application, /document\.addEventListener\('dblclick',event=>\{/);
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
  assert.match(mobile, /<HangoutTimeText hangout=\{hangout\} style=\{styles\.participantTime\} \/><Text style=\{styles\.participantTime\}> ・ 相性/);
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
  assert.match(application, /returnToProfile\?'プロフィールに戻る':returnKeywordId\?'キーワード一覧に戻る':'ホームに戻る'/);
  assert.match(application, /if\(returnToProfile\)\{sourceScreen\.classList\.remove\('profile-behind-hangout'\);activeScreen='profileScreen'\}else if\(returnKeywordId\)keywordHangoutList\(returnKeywordId\);else home\(\)/);
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
  for (const contract of ['accessibilityLabel="ホームに戻る"', '>アカウント</Text>', '>プロフィール</Text>', '>興味のあること</Text>', '主催者メニュー', 'カメラで撮る', '写真から選ぶ', '変更を保存', '終了して評価へ進む', '楽しい時間を過ごせましたか？', 'DateTimePicker']) {
    assert.ok(mobile.includes(contract), `missing native production contract: ${contract}`);
  }
});

test('native profile camera, safety report, talk status, host tier, and demo labels match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /chooseProfilePhoto\(index: number, source\?: "camera" \| "library"\)/);
  assert.match(mobile, /chooseRegistrationPhotos = async \(source\?: "camera" \| "library"\)/);
  for (const contract of ['プロフィール画像を追加', 'カメラで撮影', '写真ライブラリから選ぶ', 'ReportHostModal', '同時にブロック', '状況を入力してください（任意）', '終了・評価待ち', 'Hangout終了', '次のステータス：', '最高ステータスです', 'サヤカ（主催者）として見る', 'マドカ（参加者）として見る']) {
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
  for (const group of ['food', 'drink', 'cafe', 'sweets', 'active', 'outdoor', 'play', 'social', 'chill']) {
    assert.ok(mobile.includes(`GENERATED_HANGOUT_IMAGE("${group}")`), `missing generated image group: ${group}`);
  }
  for (const category of ['DARTS', 'BAR', 'DINNER', 'KARAOKE', 'ENGLISH', 'SHISHA', 'SWEETS', 'MOVIE']) assert.ok(mobile.includes(`uri: DEFAULT_HANGOUT_IMAGES.${category}`));
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
  assert.doesNotMatch(mobile, /PHONE_VERIFIED|電話確認済み|電話番号確認/);
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

test('native matching enums, age choices, and time slots match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  for (const value of ['"NONE"', '"SOMETIMES"', '"YES"', '"NON_SMOKING"', '"SEPARATED"', '"NO_PREFERENCE"']) assert.ok(mobile.includes(value));
  for (const retired of ['"AVOID" | "OK" | "PREFER"', '["AVOID", "飲まない場を希望"]', '["OK", "どちらでも"]']) assert.ok(!mobile.includes(retired));
  for (const label of ['こだわらない', '18〜24歳', '25〜29歳', '30代', '40代', '50歳〜', '飲まない', '少し飲む', '飲む', '禁煙希望', '分煙希望', '気にしない']) assert.ok(mobile.includes(label));
  assert.match(mobile, /activityTimeSlots: parseList\(activityTimeSlots\)\.slice\(0, 12\)/);
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

test('native location, registration, and matching editor flows match production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /loadHome = useCallback\(async \(locationOverride\?/);
  assert.ok((mobile.match(/await loadHome\(next\)/g) ?? []).length >= 2, 'area and GPS changes must reload nearby Hangouts');
  assert.match(mobile, /authenticateWithX\(input\?: OAuthRegistrationInput\)/);
  assert.match(mobile, /authenticateWithOAuth\(provider:"google"\|"apple", input\?: OAuthRegistrationInput\)/);
  assert.ok((mobile.match(/JSON\.stringify\(\{\s*ticket,\s*\.\.\.input\s*\}\)/g) ?? []).length >= 2);
  assert.match(mobile, /正しいメールアドレスを入力してください/);
  assert.match(mobile, /パスワードは12文字以上で入力してください/);
  assert.match(mobile, /const changeMode = \(next: AuthMode\) => \{ resetProviderState\(\)/);
  assert.match(mobile, /1枚目を中央のメイン画像、2・3枚目を左右に表示します/);
  assert.match(mobile, /タップするだけ。複数選べる項目は、もう一度タップすると解除できます/);

  const social = mobile.indexOf('>雰囲気・交流スタイル<');
  const goals = mobile.indexOf('>参加目的<', social);
  const languages = mobile.indexOf('>言語<', goals);
  assert.ok(social >= 0 && social < goals && goals < languages, 'matching fields must follow production order');
  const behavior = mobile.indexOf('アプリ内行動からおすすめを改善します');
  const consent = mobile.indexOf('この設定情報をマッチング改善に利用することに同意します');
  assert.ok(behavior >= 0 && behavior < consent, 'behavior consent must precede matching-data consent');
});

test('native search location state and operation feedback match production safely', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /type LocationSource = "unset" \| "manual" \| "gps"/);
  assert.match(mobile, /const MANUAL_AREA_KEY = "hangout-now-manual-area"/);
  assert.match(mobile, /SecureStore\.setItemAsync\(MANUAL_AREA_KEY, area\)/);
  assert.match(mobile, /SecureStore\.getItemAsync\(MANUAL_AREA_KEY\)/);
  assert.doesNotMatch(mobile, /SecureStore\.setItemAsync\([^\n]*coordinates/);
  assert.match(mobile, /setLocationSource\("manual"\)/);
  assert.match(mobile, /setLocationSource\("gps"\)/);
  assert.match(mobile, /locationSource === "manual" \? selectedArea : "エリアを選択"/);
  assert.match(mobile, /<Text style=\{styles\.eyebrow\}>\{locationLabel\}<\/Text>/);
  assert.match(mobile, /coordinates=\{coordinates \?\? DEFAULT_MAP_COORDINATES\}/);
  assert.match(mobile, /DEFAULT_MAP_COORDINATES = \{ latitude: 35\.6762, longitude: 139\.6993 \}/);
  assert.match(mobile, /showActionMessage\(result\.hearted \? "ハートを送りました" : "ハートを取り消しました"\)/);
  assert.match(mobile, /showActionMessage\("現在地から近い順に並べました"\)/);
  assert.match(mobile, /accessibilityLiveRegion="polite"/);
});

test('native Hangout status and write actions remain consistent with production', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(mobile, /function HangoutTimeText/);
  assert.match(mobile, /hangout\.status === "STARTED"[^\n]+Hangout中/);
  assert.match(mobile, /hangout\.status === "FINISHED" \|\| hangout\.status === "CANCELLED"/);
  assert.ok((mobile.match(/<HangoutTimeText hangout=\{hangout\}/g) ?? []).length >= 4);
  assert.match(mobile, /const confirmed = await request<Hangout>\(`\/hangouts\/\$\{hangout\.id\}`\)/);
  assert.match(mobile, /\["PENDING", "WAITLISTED", "ACCEPTED"\]\.includes\(confirmed\.myJoinStatus/);
  assert.match(mobile, /showActionMessage\(confirmed\.myJoinStatus === "WAITLISTED"/);
  assert.match(mobile, /if \(!selectedHangout \|\| decidingRequest\) return/);
  assert.match(mobile, /disabled=\{decidingRequest !== null\}/);
  assert.match(mobile, /却下中…/);
  assert.match(mobile, /承認中…/);
  assert.match(mobile, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(mobile, /disabled=\{saving\} style=\{\[styles\.editFooterSave/);
  assert.match(mobile, /saving \? "保存中…" : "変更を保存"/);
  for (const message of ['ひとこと付きで参加申請を送りました', '参加申請を承認しました', '参加申請を却下しました', 'Hangoutと写真を更新しました']) assert.ok(mobile.includes(message));
});

test('profile name changes refresh Hangout and talk display names', async () => {
  const web = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');

  assert.match(web, /saveSession\(\);await loadHangouts\(\);await profileScreen/);
  assert.match(mobile, /const selectedHangoutId = selectedHangout\?\.id/);
  assert.match(mobile, /selectedHangoutId \? request<Hangout>\(`\/hangouts\/\$\{selectedHangoutId\}`\) : Promise\.resolve\(null\)/);
  assert.match(mobile, /if \(refreshedDetail\) setSelectedHangout\(refreshedDetail\)/);
  assert.match(mobile, /setSelectedRoom\(\(current\) => current \? nextRooms\.find/);
});

test('talk and profile editor keep the same persistent back header as Hangout creation', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  const portraits = await readFile(new URL('../public/portraits.css', import.meta.url), 'utf8');

  assert.match(mobile, /<View style=\{styles\.chatListPage\}>[\s\S]*?<View style=\{styles\.chatListHead\}>[\s\S]*?<ScrollView style=\{styles\.chatListScroll\}/);
  assert.match(mobile, /profileEditorHeader: \{ minHeight: 68, paddingHorizontal: 14/);
  assert.match(portraits, /\.chat-page-title,\.chat-conversation-head\{position:sticky;top:0;z-index:5;flex-shrink:0;background:#fff\}/);
  assert.match(portraits, /\.profile-editor-sheet\{display:grid;grid-template-rows:auto minmax\(0,1fr\)/);
});

test('web removes phone registration and SMS verification', async () => {
  const web = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.doesNotMatch(web, /auth\/phone|users\/me\/phone|normalizeJapanesePhone|電話番号|SMS認証/);
  for (const provider of ['Google', 'Apple', 'X', 'LINE']) assert.ok(web.includes(`data-auth-provider="${provider}"`));
});
test('web authentication prioritizes providers and mirrors profile image feedback', async () => {
  const web = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');

  assert.match(web, /const authenticationChoices = register \? `\$\{switchAuth\}\$\{authDivider\}\$\{providerSection\}\$\{authDivider\}\$\{emailSection\}` : `\$\{providerSection\}\$\{authDivider\}\$\{emailSection\}\$\{switchAuth\}`/);
  assert.match(web, /アカウントをお持ちの方はログイン/);
  assert.ok(!web.includes("toast('新しい画像を表示しました')"), 'successful web profile image selection must not show a toast');
});

test('native authentication prioritizes non-phone providers', async () => {
  const mobile = await readFile(new URL('../../mobile/src/App.tsx', import.meta.url), 'utf8');
  const authenticationCard = mobile.slice(mobile.indexOf('<Text style={styles.authTitle}'), mobile.indexOf('<Text style={styles.authAgreement}>'));

  assert.ok(authenticationCard.indexOf('{providerSection}') < authenticationCard.indexOf('<Field label="メールアドレス"'), 'providers must appear before email authentication');
  assert.match(authenticationCard, /アカウントをお持ちの方はログイン/);
  assert.doesNotMatch(mobile, /auth\/phone|PhoneVerificationScreen|電話番号|SMS認証/);
  assert.ok(!mobile.includes('Alert.alert("画像を更新しました"'), 'successful profile image selection must not show an alert');
});
