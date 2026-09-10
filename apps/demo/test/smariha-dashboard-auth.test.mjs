import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { after, before, test } from 'node:test';

const username = 'dashboard-test-user';
const password = 'dashboard-test-password';
let demo;
let origin;
let demoOutput = '';

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
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  demo.stdout.on('data', (chunk) => { demoOutput += chunk.toString(); });
  demo.stderr.on('data', (chunk) => { demoOutput += chunk.toString(); });

  for (let attempt = 0; attempt < 60; attempt += 1) {
    try { if ((await fetch(`${origin}/`)).ok) return; } catch {}
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Demo server did not start\n${demoOutput}`);
});

after(() => {
  if (demo && !demo.killed) demo.kill();
});

test('legacy independently-authored Smariha pages redirect to the canonical source UI', async () => {
  const redirects = [
    ['/rehainfo/', '/rehainfo-main/'],
    ['/rehainfo/patient/9001/top', '/rehainfo-main/patient/9001/top'],
    ['/smariha/', '/rehainfo-main/'],
    ['/smariha/index.html', '/rehainfo-main/'],
    ['/smariha-dashboard/', '/rehainfo-main/'],
    ['/smariha-dashboard/taisho/', '/rehainfo-main/'],
    ['/smariha-dashboard/keijinkai/', '/rehainfo-main/'],
    ['/smariha-scheduler/', '/rehainfo-main/schedule'],
    ['/smariha-scheduler/app.js', '/rehainfo-main/schedule'],
  ];
  for (const [path, destination] of redirects) {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 302, path);
    assert.equal(response.headers.get('location'), destination, path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  }
});

test('canonical rehainfo source UI is login-protected and serves every audited source template', async () => {
  const entry = await fetch(`${origin}/rehainfo-main/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/rehainfo-main/login.html');
  assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const loginPage = await fetch(`${origin}/rehainfo-main/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /data-rehainfo-source-template="templates\/login\.html"/);
  assert.match(loginHtml, /メールアドレス/);
  assert.match(loginHtml, /action="\/rehainfo-main\/login"/);
  assert.match(loginHtml, /name="username"/);
  assert.match(loginHtml, /name="password"/);
  assert.doesNotMatch(loginHtml, /analytics\.js|cookie-consent/);

  for (const asset of [
    '/rehainfo-main/css/bootstrap.min.css',
    '/rehainfo-main/css/variables.css',
    '/rehainfo-main/images/SmartRehab-R_Available_Transparent.png',
    '/rehainfo-main/images/intep360.svg',
    '/rehainfo-main/js/Common.js',
  ]) assert.equal((await fetch(`${origin}${asset}`)).status, 200, asset);
  assert.equal((await fetch(`${origin}/rehainfo-main/source-demo-adapter.js`, { redirect: 'manual' })).status, 401);
  assert.equal((await fetch(`${origin}/rehainfo-main/schedule/schedule.js`, { redirect: 'manual' })).status, 401);
  const protectedPrescription = await fetch(`${origin}/rehainfo-main/prescriptions/patients`, { redirect: 'manual' });
  assert.equal(protectedPrescription.status, 302);
  assert.equal(protectedPrescription.headers.get('location'), '/rehainfo-main/login.html');

  const rejected = await fetch(`${origin}/rehainfo-main/login`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password: 'wrong-password' }), redirect: 'manual',
  });
  assert.equal(rejected.status, 303);
  assert.equal(rejected.headers.get('location'), '/rehainfo-main/login.html?error=invalid');
  assert.equal(rejected.headers.has('set-cookie'), false);

  const accepted = await fetch(`${origin}/rehainfo-main/login`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }), redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/rehainfo-main/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /Path=\/rehainfo-main/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Strict/);
  const cookie = setCookie.split(';')[0];

  const pages = [
    ['/', 'templates/patientList.html', '<title>担当患者一覧</title>', 'id="searchAccordion"'],
    ['/patient/9001/top', 'templates/patientTop.html', '<title>患者TOP</title>', 'id="patient-top-page"'],
    ['/patient/9001/treatment-soap/soap-list', 'templates/soapList.html', '<title>SOAP一覧</title>', 'id="soap-list-container"'],
    ['/ocr/patients', 'templates/ocr/patientList.html', '<title>患者一覧 - AIOCR</title>', 'data-ocr-page="patients"'],
    ['/ocr/patient/9001/evaluation-select', 'templates/ocr/evaluationSelect.html', '<title>評価シートを選択 - OCR Evaluation</title>', 'id="evaluation-sheet-search"'],
    ['/ocr/patient/9001/list', 'templates/ocr/ocrList.html', '<title>OCR一覧</title>', 'id="ocr-list-body"'],
    ['/prescriptions/patients', 'templates/ocr/patientList.html', '<title>患者一覧 - AI処方箋</title>', 'AI処方箋 患者一覧'],
    ['/prescriptions/patient/9001/read', 'templates/prescription/read.html', '<title>処方箋読込 - AI処方箋</title>', 'id="ocr-submit-btn"'],
    ['/prescriptions/patient/9001/list', 'templates/prescription/list.html', '<title>保存済み処方箋 - AI処方箋</title>', 'id="prescription-list-body"'],
    ['/schedule', 'templates/schedule/index.html', '<title>スケジュール | Smart Rehab</title>', 'id="rehab-schedule-page"'],
    ['/therapists', 'templates/schedule/therapists.html', '<title>療法士一覧 | Smart Rehab</title>', 'id="therapist-directory-page"'],
    ['/attendance', 'templates/schedule/attendance.html', '<title>出退勤管理 | Smart Rehab</title>', 'id="attendance-page"'],
    ['/ai-schedule', 'templates/schedule/ai.html', '<title>AIスケジュール | Smart Rehab</title>', 'id="generatePlan"'],
    ['/billing-management', 'templates/schedule/billing-management.html', '<title>算定管理 | Smart Rehab</title>', 'id="billingDate"'],
    ['/schedule-management', 'templates/schedule/operations.html', '<title>運用管理・集計 | Smart Rehab</title>', 'id="approveMonth"'],
  ];
  for (const [path, source, title, marker] of pages) {
    const response = await fetch(`${origin}/rehainfo-main${path}`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.ok(html.includes(`data-rehainfo-source-template="${source}"`), source);
    assert.ok(html.includes(title), title);
    assert.ok(html.includes(marker), marker);
    assert.match(html, /\/rehainfo-main\/source-demo-adapter\.js\?v=20260910-7/);
    assert.doesNotMatch(html, /patient-list-source|patient-demo|rehainfo-demo-notice/);
  }

  const adapter = await (await fetch(`${origin}/rehainfo-main/source-demo-adapter.js`, { headers: { cookie } })).text();
  assert.equal(new Set(adapter.match(/DEMO2609\d{2}/g) ?? []).size, 10);
  assert.doesNotMatch(adapter, /\/rehainfo(?!-main)/);
  assert.doesNotMatch(adapter, /api\.openai\.com|OPENAI_API_KEY/);
  for (const marker of ['REHAINFO_DEMO_PATIENT_COLUMNS', 'ATTENDANCE_API', 'BILLING_API', 'OPERATIONS_API', 'AI_API', 'PRESCRIPTION_REGISTER_API', 'OCR_REGISTER_API', 'SOAP_STORAGE_KEY', 'prescriptionSummary', 'ocrSummary']) assert.match(adapter, new RegExp(marker));

  for (const asset of [
    '/rehainfo-main/js/ocr/PatientList.js',
    '/rehainfo-main/js/ocr/EvaluationSelect.js',
    '/rehainfo-main/css/ocr/evaluationSelect.css',
    '/rehainfo-main/css/ocr/ocrList.css',
    '/rehainfo-main/css/patientTop.css',
    '/rehainfo-main/css/soapList.css',
    '/rehainfo-main/js/soapList.js',
    '/rehainfo-main/images/icons/ocr/magic-start.svg',
  ]) assert.equal((await fetch(`${origin}${asset}`, { headers: { cookie } })).status, 200, asset);

  const prescriptionRedirect = await fetch(`${origin}/rehainfo-main/prescriptions`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(prescriptionRedirect.status, 302);
  assert.equal(prescriptionRedirect.headers.get('location'), '/rehainfo-main/prescriptions/patients');

  const ocrRedirect = await fetch(`${origin}/rehainfo-main/ocr`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(ocrRedirect.status, 302);
  assert.equal(ocrRedirect.headers.get('location'), '/rehainfo-main/ocr/patients');

  const fakeImage = 'data:image/png;base64,iVBORw0KGgo=';
  const prescriptionAnalysis = await fetch(`${origin}/rehainfo-main/api/prescriptions/analyze`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ patientId: 'DEMO260901', prescriptionDate: '2026-09-10', images: [fakeImage] }),
  });
  assert.equal(prescriptionAnalysis.status, 200);
  assert.equal((await prescriptionAnalysis.json()).model, 'smariha-prescription-public-demo-simulation');

  const ocrAnalysis = await fetch(`${origin}/rehainfo-main/api/ocr/analyze`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ patientId: 'DEMO260901', evaluationId: 'FIM', evaluationDate: '2026-09-10', images: [fakeImage] }),
  });
  assert.equal(ocrAnalysis.status, 200);
  assert.equal((await ocrAnalysis.json()).model, 'smariha-aiocr-public-demo-simulation');

  const scheduleSource = await (await fetch(`${origin}/rehainfo-main/schedule/schedule.js`, { headers: { cookie } })).text();
  assert.match(scheduleSource, /\/rehainfo-main\/schedule\/api/);

  const logout = await fetch(`${origin}/rehainfo-main/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/rehainfo-main/login.html');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('committed public rehainfo pages cannot drift from copied upstream templates', () => {
  const result = spawnSync(process.execPath, ['scripts/sync-rehainfo-source-ui.mjs', '--check'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /rehainfo source UI check: ok/);
});
