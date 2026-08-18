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

test('demo authentication is not rolled back by optional initial data loading', async () => {
  const application = await readFile(new URL('app.js', publicDirectory), 'utf8');
  const loginStart = application.indexOf('async function demoLogin');
  const loginEnd = application.indexOf('\nfunction shell', loginStart);
  const loginFlow = application.slice(loginStart, loginEnd);

  assert.ok(loginFlow.indexOf("navigate('home')") < loginFlow.indexOf('Promise.allSettled'), 'successful authentication must show the home screen before optional data refresh');
  assert.match(loginFlow, /Promise\.allSettled\(\[loadNotificationCount\(\),loadHangouts\(\)\]\)/);
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
  assert.match(requests, /\.profile-hangout-loading\{z-index:42;align-items:center\}/);
  assert.match(requests, /\.hangout-detail-sheet\.profile-origin\{z-index:42\}/);
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
