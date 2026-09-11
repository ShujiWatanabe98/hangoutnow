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
      SMARIHA_PRESCRIPTION_STUB_ENABLED: 'true',
      OPENAI_API_KEY: '',
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
    ['/smariha/', '/rehainfo/'],
    ['/smariha/index.html', '/rehainfo/'],
    ['/smariha-dashboard/', '/rehainfo/'],
    ['/smariha-dashboard/taisho/', '/rehainfo/'],
    ['/smariha-dashboard/keijinkai/', '/rehainfo/'],
    ['/smariha-scheduler/', '/rehainfo/schedule'],
    ['/smariha-scheduler/app.js', '/rehainfo/schedule'],
  ];
  for (const [path, destination] of redirects) {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 302, path);
    assert.equal(response.headers.get('location'), destination, path);
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  }
});

test('canonical rehainfo source UI is login-protected and serves every audited source template', async () => {
  const entry = await fetch(`${origin}/rehainfo/`, { redirect: 'manual' });
  assert.equal(entry.status, 302);
  assert.equal(entry.headers.get('location'), '/rehainfo/login.html');
  assert.equal(entry.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const loginPage = await fetch(`${origin}/rehainfo/login.html`);
  const loginHtml = await loginPage.text();
  assert.equal(loginPage.status, 200);
  assert.match(loginHtml, /data-rehainfo-source-template="templates\/login\.html"/);
  assert.match(loginHtml, /メールアドレス/);
  assert.match(loginHtml, /action="\/rehainfo\/login"/);
  assert.match(loginHtml, /name="username"/);
  assert.match(loginHtml, /name="password"/);
  assert.doesNotMatch(loginHtml, /analytics\.js|cookie-consent/);

  for (const asset of [
    '/rehainfo/css/bootstrap.min.css',
    '/rehainfo/css/variables.css',
    '/rehainfo/images/SmartRehab-R_Available_Transparent.png',
    '/rehainfo/images/intep360.svg',
    '/rehainfo/js/Common.js',
  ]) assert.equal((await fetch(`${origin}${asset}`)).status, 200, asset);
  assert.equal((await fetch(`${origin}/rehainfo/source-demo-adapter.js`, { redirect: 'manual' })).status, 401);
  assert.equal((await fetch(`${origin}/rehainfo/schedule/schedule.js`, { redirect: 'manual' })).status, 401);
  const protectedEmr = await fetch(`${origin}/rehainfo/emr/fhir/r4/MedicationRequest?patient=Patient%2FSR-DEMO260901`, { redirect: 'manual' });
  assert.equal(protectedEmr.status, 302);
  assert.equal(protectedEmr.headers.get('location'), '/rehainfo/login.html');
  const protectedPrescription = await fetch(`${origin}/rehainfo/prescriptions/patients`, { redirect: 'manual' });
  assert.equal(protectedPrescription.status, 302);
  assert.equal(protectedPrescription.headers.get('location'), '/rehainfo/login.html');
  const protectedEmrMock = await fetch(`${origin}/rehainfo/emr/`, { redirect: 'manual' });
  assert.equal(protectedEmrMock.status, 302);
  assert.equal(protectedEmrMock.headers.get('location'), '/rehainfo/login.html');
  assert.match(protectedEmrMock.headers.get('set-cookie'), /__Secure-smariha_return=emr/);
  assert.equal((await fetch(`${origin}/rehainfo/emr/app.js`, { redirect: 'manual' })).status, 401);
  assert.equal((await fetch(`${origin}/rehainfo/emr/oauth/token`, { method: 'POST', redirect: 'manual' })).status, 401);

  const rejected = await fetch(`${origin}/rehainfo/login`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password: 'wrong-password' }), redirect: 'manual',
  });
  assert.equal(rejected.status, 303);
  assert.equal(rejected.headers.get('location'), '/rehainfo/login.html?error=invalid');
  assert.equal(rejected.headers.has('set-cookie'), false);

  const accepted = await fetch(`${origin}/rehainfo/login`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }), redirect: 'manual',
  });
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/rehainfo/');
  const setCookie = accepted.headers.get('set-cookie');
  assert.match(setCookie, /Path=\/rehainfo/);

  const emrReturnCookie = protectedEmrMock.headers.get('set-cookie').split(';')[0];
  const acceptedForEmr = await fetch(`${origin}/rehainfo/login`, {
    method: 'POST',
    headers: { cookie: emrReturnCookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
    redirect: 'manual',
  });
  assert.equal(acceptedForEmr.status, 303);
  assert.equal(acceptedForEmr.headers.get('location'), '/rehainfo/emr/');
  assert.match(acceptedForEmr.headers.get('set-cookie'), /__Secure-smariha_return=;[^,]*Max-Age=0/);
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
    const response = await fetch(`${origin}/rehainfo${path}`, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200, path);
    assert.ok(html.includes(`data-rehainfo-source-template="${source}"`), source);
    assert.ok(html.includes(title), title);
    assert.ok(html.includes(marker), marker);
    assert.match(html, /\/rehainfo\/source-demo-adapter\.js\?v=20260911-10/);
    assert.doesNotMatch(html, /patient-list-source|patient-demo|rehainfo-demo-notice/);
  }

  for (const path of ['/', '/ocr/patients', '/prescriptions/patients']) {
    const html = await (await fetch(`${origin}/rehainfo${path}`, { headers: { cookie } })).text();
    assert.match(html, /id="emrPatientImportButton"[^>]*>電カルから患者追加<\/button>/, path);
  }

  const patientListHtml = await (await fetch(`${origin}/rehainfo/`, { headers: { cookie } })).text();
  assert.match(patientListHtml, /id="prescriptionPatientImportButton"[^>]*>処方箋から患者追加<\/button>[\s\S]*id="emrPatientImportButton"[^>]*>電カルから患者追加<\/button>/);
  assert.doesNotMatch(patientListHtml, /class="btn header-button gks-modify-header-btn"[^>]*prescriptions\/patients[^>]*>[\s\S]*?AI処方箋\s*<\/button>/);

  const adapter = await (await fetch(`${origin}/rehainfo/source-demo-adapter.js`, { headers: { cookie } })).text();
  assert.equal(new Set(adapter.match(/DEMO2609\d{2}/g) ?? []).size, 10);
  assert.doesNotMatch(adapter, /\/rehainfo-main(?:\/|$)/);
  assert.doesNotMatch(adapter, /外部AIへ送信せず|外部AIを使わないデモ用の固定結果/);
  assert.match(adapter, /画像は読取時のみ外部AIへ送信され、結果は必ず原本と照合してください/);
  for (const marker of ['REHAINFO_DEMO_PATIENT_COLUMNS', 'ATTENDANCE_API', 'BILLING_API', 'OPERATIONS_API', 'AI_API', 'PRESCRIPTION_REGISTER_API', 'EMR_PRESCRIPTION_IMPORT_API', 'EMR_PATIENT_CANDIDATES_API', 'EMR_PATIENT_IMPORT_API', 'EMR_OAUTH_TOKEN_API', 'EMR_FHIR_PATIENT_API', 'EMR_FHIR_CONDITION_API', 'EMR_FHIR_ENCOUNTER_API', 'EMR_FHIR_SERVICE_REQUEST_API', 'EMR_FHIR_MEDICATION_REQUEST_API', 'IMPORTED_PATIENT_STORAGE_KEY', 'PATIENT_DISCHARGE_STORAGE_KEY', 'OCR_REGISTER_API', 'SOAP_STORAGE_KEY', 'hospitalizationStartDate', 'hospitalizationEndDate', 'applyPatientDischargeState', 'patientInfoRest', 'prescriptionSummary', 'emrPrescriptionSummary', 'smartRehabPatientFromFhir', 'openEmrPatientImportDialog', 'ocrSummary']) assert.match(adapter, new RegExp(marker));

  const emrPageResponse = await fetch(`${origin}/rehainfo/emr/`, { headers: { cookie } });
  const emrPage = await emrPageResponse.text();
  assert.equal(emrPageResponse.status, 200);
  assert.equal(emrPageResponse.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');
  assert.match(emrPage, /MediLink Chart/);
  assert.match(emrPage, /架空データ専用・外部送信なし/);
  assert.match(emrPage, /href="\/rehainfo\/"/);
  const emrScript = await fetch(`${origin}/rehainfo/emr/app.js?v=20260911-1`, { headers: { cookie } });
  assert.equal(emrScript.status, 200);
  assert.equal(emrScript.headers.get('x-robots-tag'), 'noindex, nofollow, noarchive');

  const emrTokenResponse = await fetch(`${origin}/rehainfo/emr/oauth/token`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'public-demo-test', scope: 'system/*.read system/*.write' }),
  });
  assert.equal(emrTokenResponse.status, 200);
  const emrToken = (await emrTokenResponse.json()).access_token;
  assert.ok(emrToken);
  const emrApiHeaders = { cookie, authorization: `Bearer ${emrToken}` };
  const emrPatientsResponse = await fetch(`${origin}/rehainfo/emr/api/v1/patients`, { headers: emrApiHeaders });
  assert.equal(emrPatientsResponse.status, 200);
  const emrPatients = await emrPatientsResponse.json();
  assert.ok(emrPatients.total >= 4);
  assert.ok(emrPatients.items.every((patient) => patient.address.includes('架空')));
  const emrBundleResponse = await fetch(`${origin}/rehainfo/emr/api/v1/dx/patients/P0001001/fhir-bundle`, { headers: emrApiHeaders });
  assert.equal(emrBundleResponse.status, 200);
  assert.equal((await emrBundleResponse.json()).resourceType, 'Bundle');
  const emrFhirPatientsResponse = await fetch(`${origin}/rehainfo/emr/fhir/r4/Patient`, {
    headers: { ...emrApiHeaders, accept: 'application/fhir+json' },
  });
  assert.equal(emrFhirPatientsResponse.status, 200);
  assert.match(emrFhirPatientsResponse.headers.get('content-type'), /application\/fhir\+json/);
  const emrFhirPatients = await emrFhirPatientsResponse.json();
  assert.equal(emrFhirPatients.resourceType, 'Bundle');
  assert.equal(emrFhirPatients.total, emrPatients.total);
  assert.ok(emrFhirPatients.total >= 14);
  assert.ok(emrFhirPatients.entry.some((entry) => entry.resource.id === 'P0001001'));
  assert.ok(emrFhirPatients.entry.every((entry) => entry.resource.meta.profile.includes('http://jpfhir.jp/fhir/core/StructureDefinition/JP_Patient')));

  const rehabReference = encodeURIComponent('Patient/SR-DEMO260902');
  const [emrConditionsResponse, emrEncountersResponse, emrRehabRequestsResponse] = await Promise.all([
    fetch(`${origin}/rehainfo/emr/fhir/r4/Condition?patient=${rehabReference}`, { headers: { ...emrApiHeaders, accept: 'application/fhir+json' } }),
    fetch(`${origin}/rehainfo/emr/fhir/r4/Encounter?patient=${rehabReference}`, { headers: { ...emrApiHeaders, accept: 'application/fhir+json' } }),
    fetch(`${origin}/rehainfo/emr/fhir/r4/ServiceRequest?patient=${rehabReference}&category=rehabilitation`, { headers: { ...emrApiHeaders, accept: 'application/fhir+json' } }),
  ]);
  assert.equal(emrConditionsResponse.status, 200);
  assert.equal(emrEncountersResponse.status, 200);
  assert.equal(emrRehabRequestsResponse.status, 200);
  const emrConditions = await emrConditionsResponse.json();
  const emrEncounters = await emrEncountersResponse.json();
  const emrRehabRequests = await emrRehabRequestsResponse.json();
  assert.equal(emrConditions.entry[0].resource.code.text, '右大腿骨頸部骨折術後');
  assert.equal(emrEncounters.entry[0].resource.class.code, 'IMP');
  assert.equal(emrEncounters.entry[0].resource.location[0].location.display, '回復期2階B');
  assert.equal(emrRehabRequests.total, 1);
  assert.equal(emrRehabRequests.entry[0].resource.code.coding[0].code, '運動器');
  assert.equal(emrRehabRequests.entry[0].resource.reasonReference[0].display, '右大腿骨頸部骨折術後');
  assert.ok(emrRehabRequests.entry[0].resource.extension.some((item) => item.url.endsWith('/fim-total')));

  for (const asset of [
    '/rehainfo/js/ocr/PatientList.js',
    '/rehainfo/js/ocr/EvaluationSelect.js',
    '/rehainfo/css/ocr/evaluationSelect.css',
    '/rehainfo/css/ocr/ocrList.css',
    '/rehainfo/css/patientTop.css',
    '/rehainfo/css/soapList.css',
    '/rehainfo/js/soapList.js',
    '/rehainfo/images/icons/ocr/magic-start.svg',
  ]) assert.equal((await fetch(`${origin}${asset}`, { headers: { cookie } })).status, 200, asset);

  const patientListScript = await (await fetch(`${origin}/rehainfo/js/ocr/PatientList.js`, { headers: { cookie } })).text();
  assert.match(patientListScript, /電カル連携[\s\S]*処方箋読込/);

  const tokenResponse = await fetch(`${origin}/rehainfo/emr/oauth/token`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'smart-rehab-test', scope: 'system/MedicationRequest.read' }),
  });
  assert.equal(tokenResponse.status, 200);
  const accessToken = (await tokenResponse.json()).access_token;
  assert.ok(accessToken);

  const fhirResponse = await fetch(`${origin}/rehainfo/emr/fhir/r4/MedicationRequest?patient=Patient%2FSR-DEMO260904`, {
    headers: { cookie, accept: 'application/fhir+json', authorization: `Bearer ${accessToken}` },
  });
  assert.equal(fhirResponse.status, 200);
  assert.match(fhirResponse.headers.get('content-type'), /application\/fhir\+json/);
  assert.ok(fhirResponse.headers.get('x-request-id'));
  const fhirBundle = await fhirResponse.json();
  assert.equal(fhirBundle.resourceType, 'Bundle');
  assert.equal(fhirBundle.total, 1);
  assert.equal(fhirBundle.entry[0].resource.subject.reference, 'Patient/SR-DEMO260904');
  assert.ok(fhirBundle.entry[0].resource.meta.profile.includes('http://jpfhir.jp/fhir/core/StructureDefinition/JP_MedicationRequest'));

  const emrHealth = await fetch(`${origin}/rehainfo/emr/healthz`, { headers: { cookie } });
  assert.equal(emrHealth.status, 200);
  assert.equal((await emrHealth.json()).service, 'eMedicalRecordMock');

  const prescriptionRedirect = await fetch(`${origin}/rehainfo/prescriptions`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(prescriptionRedirect.status, 302);
  assert.equal(prescriptionRedirect.headers.get('location'), '/rehainfo/prescriptions/patients');

  const ocrRedirect = await fetch(`${origin}/rehainfo/ocr`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(ocrRedirect.status, 302);
  assert.equal(ocrRedirect.headers.get('location'), '/rehainfo/ocr/patients');

  const fakeImage = 'data:image/png;base64,iVBORw0KGgo=';
  const prescriptionAnalysis = await fetch(`${origin}/rehainfo/api/prescriptions/analyze`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ patientId: 'SR-DEMO260901', prescriptionDate: '2026-09-10', images: [fakeImage] }),
  });
  assert.equal(prescriptionAnalysis.status, 200);
  assert.equal((await prescriptionAnalysis.json()).model, 'smariha-prescription-local-stub');

  const ocrAnalysis = await fetch(`${origin}/rehainfo/api/ocr/analyze`, {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ patientId: 'SR-DEMO260901', evaluationId: 'FIM', evaluationDate: '2026-09-10', images: [fakeImage] }),
  });
  assert.equal(ocrAnalysis.status, 200);
  assert.equal((await ocrAnalysis.json()).model, 'smariha-aiocr-local-stub');

  const scheduleSource = await (await fetch(`${origin}/rehainfo/schedule/schedule.js`, { headers: { cookie } })).text();
  assert.equal(createHash('sha256').update(scheduleSource).digest('hex'), '76608c376e3a2f3dfef2404c212cdc5e0fa9c117a79b157ec0038a9bc131124a');

  const logout = await fetch(`${origin}/rehainfo/logout`, { headers: { cookie }, redirect: 'manual' });
  assert.equal(logout.status, 303);
  assert.equal(logout.headers.get('location'), '/rehainfo/login.html');
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
});

test('retired rehainfo-main URL is not served', async () => {
  for (const path of ['/rehainfo-main/', '/rehainfo-main/login.html', '/rehainfo-main/source-demo-adapter.js']) {
    const response = await fetch(`${origin}${path}`, { redirect: 'manual' });
    assert.equal(response.status, 404, path);
  }
});

test('committed public rehainfo pages cannot drift from copied upstream templates', () => {
  const result = spawnSync(process.execPath, ['scripts/sync-rehainfo-source-ui.mjs', '--check'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8',
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /rehainfo source UI check: ok/);
});
