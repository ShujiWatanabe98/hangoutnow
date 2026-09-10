import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const username = 'dashboard-test-user';
const password = 'dashboard-test-password';
let demo;
let origin;

before(async () => {
  const portProbe = createServer();
  portProbe.listen(0, '127.0.0.1');
  await once(portProbe, 'listening');
  const port = portProbe.address().port;
  await new Promise((resolve) => portProbe.close(resolve));
  origin = `http://127.0.0.1:${port}`;

  demo = spawn(process.execPath, ['server.mjs'], {
    cwd: new URL('..', import.meta.url),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      DEMO_PORT: String(port),
      SMARIHA_DASHBOARD_USERNAME: username,
      SMARIHA_DASHBOARD_PASSWORD_SHA256: createHash('sha256').update(password).digest('hex'),
      SMARIHA_DASHBOARD_SESSION_SECRET: 'smariha-dashboard-test-session-secret-0123456789',
      OPENAI_API_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Demo server did not start');
});

after(() => {
  if (demo && !demo.killed) demo.kill();
});

test('Smariha dashboard requires login and grants a protected session', async () => {
  const entry = await fetch(`${origin}/smariha-dashboard/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/smariha-dashboard/login.html');
  assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const loginPage = await fetch(`${origin}/smariha-dashboard/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /スマリハ管理/);
  assert.match(loginHtml, /name="username"/);
  assert.match(loginHtml, /name="password"/);
  assert.doesNotMatch(loginHtml, /analytics\.js|cookie-consent/);

  const protectedAsset = await fetch(`${origin}/smariha-dashboard/app.js`, { redirect: 'manual' });
  assert.equal(protectedAsset.status, 401);
  const protectedTaisho = await fetch(`${origin}/smariha-dashboard/taisho/`, { redirect: 'manual' });
  assert.equal(protectedTaisho.status, 302);
  assert.equal(protectedTaisho.headers.get('location'), '/smariha-dashboard/login.html');

  const rejected = await fetch(`${origin}/smariha-dashboard/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password: 'wrong-password' }),
    redirect: 'manual',
  });
  assert.equal(rejected.status, 303);
  assert.equal(rejected.headers.get('location'), '/smariha-dashboard/login.html?error=invalid');
  assert.equal(rejected.headers.has('set-cookie'), false);

  const accepted = await fetch(`${origin}/smariha-dashboard/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/smariha-dashboard/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const dashboard = await fetch(`${origin}/smariha-dashboard/`, { headers: { cookie } });
  const dashboardHtml = await dashboard.text();
  assert.equal(dashboard.status, 200);
  assert.match(dashboardHtml, /大勝病院向け/);
  assert.match(dashboardHtml, /実績指数およびFIM管理MVP/);
  assert.match(dashboardHtml, /渓仁会病院向け/);
  assert.match(dashboardHtml, /院内連携パス管理MVP/);
  assert.match(dashboardHtml, /href="\/smariha-dashboard\/taisho\/"/);
  assert.match(dashboardHtml, /href="\/smariha-dashboard\/keijinkai\/"/);
  assert.doesNotMatch(dashboardHtml, /analytics\.js|cookie-consent/);

  const taisho = await fetch(`${origin}/smariha-dashboard/taisho/`, { headers: { cookie } });
  const taishoHtml = await taisho.text();
  assert.equal(taisho.status, 200);
  assert.match(taishoHtml, /大勝病院向け・実績指数およびFIM管理MVP/);

  const keijinkai = await fetch(`${origin}/smariha-dashboard/keijinkai/`, { headers: { cookie } });
  const keijinkaiHtml = await keijinkai.text();
  assert.equal(keijinkai.status, 200);
  assert.match(keijinkaiHtml, /渓仁会病院向け・院内連携パス管理MVP/);

  const logout = await fetch(`${origin}/smariha-dashboard/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/smariha-dashboard/login.html');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('Smariha scheduler reuses protected credentials with a scheduler-scoped session', async () => {
  const entry = await fetch(`${origin}/smariha-scheduler/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/smariha-scheduler/login.html');
  assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const loginPage = await fetch(`${origin}/smariha-scheduler/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /スマリハスケジューラー/);
  assert.match(loginHtml, /action="\/smariha-scheduler\/login"/);
  assert.doesNotMatch(loginHtml, /analytics\.js|cookie-consent/);

  const protectedAsset = await fetch(`${origin}/smariha-scheduler/app.js`, { redirect: 'manual' });
  assert.equal(protectedAsset.status, 401);

  const accepted = await fetch(`${origin}/smariha-scheduler/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/smariha-scheduler/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /Path=\/smariha-scheduler/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const scheduler = await fetch(`${origin}/smariha-scheduler/`, { headers: { cookie } });
  const schedulerHtml = await scheduler.text();
  assert.equal(scheduler.status, 200);
  assert.match(schedulerHtml, /療法士別スケジュール/);
  assert.match(schedulerHtml, /すべて架空/);
  assert.match(schedulerHtml, /AIスケジュール/);
  assert.doesNotMatch(schedulerHtml, /analytics\.js|cookie-consent/);

  const logout = await fetch(`${origin}/smariha-scheduler/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/smariha-scheduler/login.html');
  assert.match(logout.headers.get('set-cookie'), /Path=\/smariha-scheduler/);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('rehainfo source UI is linked as a protected fictional-data demo', async () => {
  const entry = await fetch(`${origin}/rehainfo/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/rehainfo/login.html');
  assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const loginPage = await fetch(`${origin}/rehainfo/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /SmartRehab-R_Available_Transparent\.png/);
  assert.match(loginHtml, /action="\/rehainfo\/login"/);
  assert.match(loginHtml, /rehainfo実装を使用した限定公開デモ/);

  const publicLogo = await fetch(`${origin}/rehainfo/images/SmartRehab-R_Available_Transparent.png`);
  assert.equal(publicLogo.status, 200);
  assert.equal(publicLogo.headers.get('content-type'), 'image/png');
  const protectedSource = await fetch(`${origin}/rehainfo/schedule/schedule.js`, { redirect: 'manual' });
  assert.equal(protectedSource.status, 401);
  const protectedPatients = await fetch(`${origin}/rehainfo/patient-demo.js`, { redirect: 'manual' });
  assert.equal(protectedPatients.status, 401);
  const protectedPatientList = await fetch(`${origin}/rehainfo/patient-list-source.js`, { redirect: 'manual' });
  assert.equal(protectedPatientList.status, 401);

  const accepted = await fetch(`${origin}/rehainfo/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/rehainfo/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /Path=\/rehainfo/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const page = await fetch(`${origin}/rehainfo/`, { headers: { cookie } });
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /<title>担当患者一覧<\/title>/);
  assert.match(html, /id="searchAccordion"/);
  assert.match(html, /患者氏名（カナ）/);
  assert.match(html, /id="radio_api"[^>]*checked/);
  assert.match(html, /公開デモ・すべて架空の患者データ/);
  assert.match(html, /\/rehainfo\/patient-list-source\.js\?v=20260910-1/);
  assert.match(html, /AI処方箋/);
  assert.match(html, /\/rehainfo\/schedule#schedule/);

  const patientListSource = await fetch(`${origin}/rehainfo/patient-list-source.js`, { headers: { cookie } });
  const patientListSourceCode = await patientListSource.text();
  assert.equal(patientListSource.status, 200);
  assert.equal((patientListSourceCode.match(/id:'DEMO2609\d{2}'/g) ?? []).length, 10);
  assert.match(patientListSourceCode, /assignedOnly\.checked/);

  const patientSource = await fetch(`${origin}/rehainfo/patient-demo.js`, { headers: { cookie } });
  const patientSourceCode = await patientSource.text();
  assert.equal(patientSource.status, 200);
  assert.equal((patientSourceCode.match(/id:'DEMO2609\d{2}'/g) ?? []).length, 10);
  assert.match(patientSourceCode, /smart-rehab-public-patients-v2/);
  assert.match(patientSourceCode, /\/rehainfo\/api\/prescriptions\/analyze/);
  assert.match(patientSourceCode, /state\.dischargeDates\[patient\.id\] = input\.value/);

  const unavailableAi = await fetch(`${origin}/rehainfo/api/prescriptions/analyze`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ patientId: 'DEMO260901', prescriptionDate: '2026-09-10', images: ['data:image/png;base64,AA=='] }),
  });
  assert.equal(unavailableAi.status, 503);
  assert.match((await unavailableAi.json()).message, /設定されていません/);

  const source = await fetch(`${origin}/rehainfo/schedule/schedule.js`, { headers: { cookie } });
  const sourceCode = await source.text();
  assert.equal(source.status, 200);
  assert.equal(createHash('sha256').update(sourceCode).digest('hex'), '76608c376e3a2f3dfef2404c212cdc5e0fa9c117a79b157ec0038a9bc131124a');
  assert.match(sourceCode, /const API = '\/rehainfo\/schedule\/api'/);

  const schedulePage = await fetch(`${origin}/rehainfo/schedule`, { headers: { cookie } });
  const scheduleHtml = await schedulePage.text();
  assert.equal(schedulePage.status, 200);
  assert.match(scheduleHtml, /rehab-schedule-page/);
  assert.match(scheduleHtml, /\/rehainfo\/schedule\/schedule\.js\?v=source-1\.3\.0/);

  const logout = await fetch(`${origin}/rehainfo/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/rehainfo/login.html');
  assert.match(logout.headers.get('set-cookie'), /Path=\/rehainfo/);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('Smariha suite protects every integrated demo module', async () => {
  const entry = await fetch(`${origin}/smariha/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/smariha/login.html');

  const loginPage = await fetch(`${origin}/smariha/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /スマリハ統合ポータル/);
  assert.match(loginHtml, /src="\/smariha\/smartrehab-logo\.png"/);
  assert.match(loginHtml, /action="\/smariha\/login"/);
  assert.doesNotMatch(loginHtml, /analytics\.js|cookie-consent/);

  const protectedAsset = await fetch(`${origin}/smariha/app.js`, { redirect: 'manual' });
  assert.equal(protectedAsset.status, 401);
  const publicLogo = await fetch(`${origin}/smariha/smartrehab-logo.png`, { redirect: 'manual' });
  assert.equal(publicLogo.status, 200);
  assert.equal(publicLogo.headers.get('content-type'), 'image/png');

  const accepted = await fetch(`${origin}/smariha/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/smariha/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /Path=\/smariha/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const portal = await fetch(`${origin}/smariha/`, { headers: { cookie } });
  const portalHtml = await portal.text();
  assert.equal(portal.status, 200);
  for (const copy of ['患者管理', 'リハビリ記録', '評価・FIM', 'スケジュール', '出退勤管理', '請求・実績', 'AI OCR', '承認・通知', '監査ログ']) {
    assert.ok(portalHtml.includes(copy), `スマリハ統合ポータルに機能がありません: ${copy}`);
  }
  assert.match(portalHtml, /提案用MVP/);
  assert.match(portalHtml, /架空データによる操作デモ/);
  assert.match(portalHtml, /実際の患者情報・電子カルテ・院内システムには接続していません/);
  assert.doesNotMatch(portalHtml, /analytics\.js|cookie-consent/);

  const logout = await fetch(`${origin}/smariha/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/smariha/login.html');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});
