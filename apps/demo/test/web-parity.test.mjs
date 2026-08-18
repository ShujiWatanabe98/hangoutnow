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
