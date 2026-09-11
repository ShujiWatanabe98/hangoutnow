import http from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, createStore, makeId } from './src/store.mjs';
import { capabilityStatement, clinicalDocumentBundle, conditionResource, encounterResource, medicationRequestResource, observationResource, operationOutcome, patientBundle, patientResource, rehabilitationServiceRequestResource, vitalSignResource } from './src/fhir.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const signingSecret = process.env.EMR_MOCK_JWT_SECRET?.trim() || randomBytes(32).toString('hex');

function base64url(value) { return Buffer.from(value).toString('base64url'); }
function sign(input) { return createHmac('sha256', signingSecret).update(input).digest('base64url'); }

function issueToken({ sub = 'demo-client', practitionerId = 'PRACT-001', scope = 'system/*.read system/*.write' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: 'mock-dev-key' }));
  const payload = base64url(JSON.stringify({ iss: 'https://mock.example.jp/oauth', sub, aud: 'https://mock.example.jp/api', iat: now, exp: now + 300, scope, practitioner_id: practitionerId, tenant_id: 'TENANT-DEMO' }));
  return `${header}.${payload}.${sign(`${header}.${payload}`)}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return null;
  const expected = Buffer.from(sign(`${parts[0]}.${parts[1]}`));
  const actual = Buffer.from(parts[2]);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.exp <= Math.floor(Date.now() / 1000) || payload.aud !== 'https://mock.example.jp/api') return null;
    return payload;
  } catch { return null; }
}

function sendJson(res, status, body, headers = {}) {
  const data = JSON.stringify(body, null, 2);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}

function sendProblem(res, status, code, title, detail, requestId, errors) {
  sendJson(res, status, { type: `https://mock.example.jp/problems/${code}`, title, status, detail, code, requestId, ...(errors ? { errors } : {}) }, { 'X-Request-ID': requestId });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('invalid JSON'), { status: 400 }); }
}

function match(pathname, pattern) {
  const actual = pathname.split('/').filter(Boolean);
  const expected = pattern.split('/').filter(Boolean);
  if (actual.length !== expected.length) return null;
  const params = {};
  for (let i = 0; i < expected.length; i += 1) {
    if (expected[i].startsWith(':')) params[expected[i].slice(1)] = decodeURIComponent(actual[i]);
    else if (expected[i] !== actual[i]) return null;
  }
  return params;
}

function requireFields(body, fields) { return fields.filter((field) => body[field] === undefined || body[field] === null || body[field] === ''); }

async function serveStatic(pathname, res) {
  const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const target = normalize(join(publicDir, relative));
  if (!target.startsWith(publicDir)) return false;
  try {
    const data = await readFile(target);
    const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };
    res.writeHead(200, { 'Content-Type': types[extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow, noarchive' });
    res.end(data);
    return true;
  } catch { return false; }
}

export function createAppServer({ store = createStore() } = {}) {
  return http.createServer(async (req, res) => {
    const requestId = req.headers['x-request-id'] || makeId('REQ');
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'");

    try {
      if (req.method === 'GET' && pathname === '/healthz') return sendJson(res, 200, {
        status: 'ok', service: 'eMedicalRecordMock', version: '0.2.0', dataMode: 'fictional-in-memory',
        capabilities: { smartRehabPrescriptionImport: true, fhirMedicationRequestSearch: true }
      });
      if (req.method === 'POST' && pathname === '/oauth/token') {
        const body = await readBody(req);
        if (body.grant_type !== 'client_credentials') return sendProblem(res, 400, 'EMR-AUTH-4001', 'Unsupported grant type', 'grant_type must be client_credentials in this mock.', requestId);
        return sendJson(res, 200, { access_token: issueToken({ sub: body.client_id || 'demo-web', scope: body.scope }), token_type: 'Bearer', expires_in: 300, scope: body.scope || 'system/*.read system/*.write' });
      }

      const isApi = pathname.startsWith('/api/v1') || pathname.startsWith('/fhir/r4');
      let principal = null;
      if (isApi) {
        principal = verifyToken((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
        if (!principal) {
          if (pathname.startsWith('/fhir/r4')) return sendJson(res, 401, operationOutcome('login', '有効なBearerトークンが必要です'), { 'WWW-Authenticate': 'Bearer realm="eMedicalRecordMock"' });
          return sendProblem(res, 401, 'EMR-AUTH-4010', 'Unauthorized', '有効なBearerトークンが必要です。', requestId);
        }
      }

      if (req.method === 'GET' && pathname === '/api/v1/dashboard') return sendJson(res, 200, {
        date: '2026-09-11', counts: { waiting: store.patients.filter((p) => ['受付済', '診察待ち'].includes(p.status)).length, unsigned: store.records.filter((r) => r.status !== 'signed').length, pendingLabs: store.labOrders.filter((o) => o.status !== 'completed').length, dxErrors: 0 },
        patients: store.patients
      });
      if (req.method === 'GET' && pathname === '/api/v1/patients') {
        const query = (url.searchParams.get('q') || '').toLowerCase();
        const list = store.patients.filter((p) => !query || [p.id, p.name, p.kana, p.department].some((v) => String(v).toLowerCase().includes(query)));
        return sendJson(res, 200, { items: list, total: list.length });
      }
      let params = match(pathname, '/api/v1/patients/:id');
      if (req.method === 'GET' && params) {
        const patient = store.patients.find((p) => p.id === params.id);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        return sendJson(res, 200, patient);
      }
      params = match(pathname, '/api/v1/patients/:id/records');
      if (req.method === 'GET' && params) return sendJson(res, 200, { items: store.records.filter((r) => r.patientId === params.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)) });
      params = match(pathname, '/api/v1/patients/:id/summary');
      if (req.method === 'GET' && params) return sendJson(res, 200, {
        patient: store.patients.find((p) => p.id === params.id),
        encounters: store.encounters.filter((item) => item.patientId === params.id),
        conditions: store.conditions.filter((item) => item.patientId === params.id),
        rehabilitationPlans: store.rehabilitationPlans.filter((item) => item.patientId === params.id),
        records: store.records.filter((item) => item.patientId === params.id),
        vitalSigns: store.vitalSigns.filter((item) => item.patientId === params.id),
        medications: store.medicationRequests.filter((item) => item.patientId === params.id),
        prescriptions: store.prescriptions.filter((item) => item.patientId === params.id),
        dispenses: store.dispenses.filter((item) => item.patientId === params.id),
        labs: store.labOrders.filter((item) => item.patientId === params.id),
        injections: store.injectionOrders.filter((item) => item.patientId === params.id),
        imaging: store.imagingOrders.filter((item) => item.patientId === params.id),
        documents: store.documents.filter((item) => item.patientId === params.id),
        summaries: store.summaries.filter((item) => item.patientId === params.id),
        eligibilityChecks: store.eligibilityChecks.filter((item) => item.patientId === params.id),
        appointments: store.appointments.filter((item) => item.patientId === params.id),
        billingCharges: store.billingCharges.filter((item) => item.patientId === params.id),
        receivedFhirDocuments: store.receivedBundles.filter((item) => item.patientId === params.id),
        sentFhirDocuments: store.sentBundles.filter((item) => item.patientId === params.id)
      });
      if (req.method === 'POST' && pathname === '/api/v1/encounters') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'department']);
        if (missing.length) return sendProblem(res, 422, 'EMR-VAL-4220', 'Validation failed', '必須項目が不足しています。', requestId, missing);
        const encounter = { id: makeId('ENC'), patientId: body.patientId, department: body.department, status: 'in-progress', startedAt: new Date().toISOString(), practitionerId: principal.practitioner_id };
        store.encounters.push(encounter);
        audit(store, { action: 'create', resourceType: 'Encounter', resourceId: encounter.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, encounter, { Location: `/api/v1/encounters/${encounter.id}` });
      }
      if (req.method === 'POST' && pathname === '/api/v1/records') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'soap']);
        if (missing.length) return sendProblem(res, 422, 'EMR-VAL-4220', 'Validation failed', '患者とSOAPは必須です。', requestId, missing);
        const record = { id: makeId('REC'), patientId: body.patientId, encounterId: body.encounterId || makeId('ENC'), occurredAt: new Date().toISOString(), department: body.department || '内科', author: body.author || 'デモ医師', status: 'draft', version: 1, soap: body.soap };
        store.records.push(record); audit(store, { action: 'create', resourceType: 'ClinicalRecord', resourceId: record.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, record, { ETag: `W/\"${record.version}\"`, Location: `/api/v1/records/${record.id}` });
      }
      params = match(pathname, '/api/v1/records/:id/sign');
      if (req.method === 'PUT' && params) {
        const record = store.records.find((r) => r.id === params.id);
        if (!record) return sendProblem(res, 404, 'EMR-REC-4040', 'Record not found', '診療記録が見つかりません。', requestId);
        if (record.status === 'signed') return sendProblem(res, 409, 'EMR-REC-4091', 'Already signed', 'この診療記録は既に確定済みです。', requestId);
        record.status = 'signed'; record.signedAt = new Date().toISOString(); record.version += 1;
        audit(store, { action: 'sign', resourceType: 'ClinicalRecord', resourceId: record.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, record, { ETag: `W/\"${record.version}\"` });
      }

      if (req.method === 'POST' && pathname === '/api/v1/medication-requests') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'medicationCode', 'medicationDisplay', 'dosageText', 'quantity', 'unit']);
        if (missing.length) return sendProblem(res, 422, 'EMR-MED-4220', 'Medication validation failed', '処方必須項目が不足しています。', requestId, missing);
        const order = { id: makeId('MEDREQ'), patientId: body.patientId, recordId: body.recordId, status: 'active', intent: 'order', authoredOn: new Date().toISOString(), requester: body.requester || 'デモ医師', medicationCode: body.medicationCode, medicationDisplay: body.medicationDisplay, dosageText: body.dosageText, days: Number(body.days || 1), quantity: Number(body.quantity), unit: body.unit, route: body.route || '経口', erxStatus: 'draft' };
        store.medicationRequests.push(order); audit(store, { action: 'create', resourceType: 'MedicationRequest', resourceId: order.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, { order, fhir: medicationRequestResource(order) }, { Location: `/fhir/r4/MedicationRequest/${order.id}` });
      }
      if (req.method === 'GET' && pathname === '/api/v1/medication-requests') return sendJson(res, 200, { items: store.medicationRequests.filter((m) => !url.searchParams.get('patientId') || m.patientId === url.searchParams.get('patientId')) });
      if (req.method === 'POST' && pathname === '/api/v1/injection-orders') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'medicationDisplay', 'dose', 'route']);
        if (missing.length) return sendProblem(res, 422, 'EMR-INJ-4220', 'Injection validation failed', '注射オーダ必須項目が不足しています。', requestId, missing);
        const order = { id: makeId('INJ'), ...body, status: 'active', requestedAt: new Date().toISOString() }; store.injectionOrders.push(order);
        return sendJson(res, 201, order);
      }
      if (req.method === 'POST' && pathname === '/api/v1/lab-orders') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'code', 'name']);
        if (missing.length) return sendProblem(res, 422, 'EMR-LAB-4220', 'Lab validation failed', '検査オーダ必須項目が不足しています。', requestId, missing);
        const order = { id: makeId('LAB'), ...body, priority: body.priority || 'routine', status: 'requested', requestedAt: new Date().toISOString() }; store.labOrders.push(order);
        return sendJson(res, 201, order, { Location: `/api/v1/lab-orders/${order.id}` });
      }
      params = match(pathname, '/api/v1/lab-orders/:id/result');
      if (req.method === 'POST' && params) {
        const body = await readBody(req); const order = store.labOrders.find((o) => o.id === params.id);
        if (!order) return sendProblem(res, 404, 'EMR-LAB-4040', 'Lab order not found', '検査オーダが見つかりません。', requestId);
        order.status = 'completed'; order.result = body.result || '基準範囲内（デモ）'; order.completedAt = new Date().toISOString();
        return sendJson(res, 200, { order, fhir: observationResource(order) });
      }
      if (req.method === 'GET' && pathname === '/api/v1/lab-orders') return sendJson(res, 200, { items: store.labOrders.filter((o) => !url.searchParams.get('patientId') || o.patientId === url.searchParams.get('patientId')) });
      if (req.method === 'POST' && pathname === '/api/v1/imaging-orders') { const body = await readBody(req); const order = { id: makeId('IMG'), ...body, status: 'requested', requestedAt: new Date().toISOString() }; store.imagingOrders.push(order); return sendJson(res, 201, order); }
      if (req.method === 'POST' && pathname === '/api/v1/documents') { const body = await readBody(req); const doc = { id: makeId('DOC'), ...body, status: 'final', authoredAt: new Date().toISOString() }; store.documents.push(doc); return sendJson(res, 201, doc); }
      if (req.method === 'POST' && pathname === '/api/v1/summaries') { const body = await readBody(req); const item = { id: makeId('SUM'), ...body, status: 'final', authoredAt: new Date().toISOString() }; store.summaries.push(item); return sendJson(res, 201, item); }

      if (req.method === 'POST' && pathname === '/api/v1/dx/eligibility-verifications') {
        const body = await readBody(req); const patient = store.patients.find((p) => p.id === body.patientId);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const result = { id: makeId('ELG'), patientId: patient.id, status: 'qualified', verifiedAt: new Date().toISOString(), insurerNumber: patient.insurance.insurerNumber, copayRate: patient.insurance.copayRate, consent: body.consent === true };
        store.eligibilityChecks.push(result); patient.insurance.status = '有効'; patient.insurance.verifiedAt = result.verifiedAt;
        return sendJson(res, 200, result);
      }
      params = match(pathname, '/api/v1/dx/patients/:id/medication-history');
      if (req.method === 'GET' && params) return sendJson(res, 200, { patientId: params.id, consentConfirmed: true, items: [{ medication: '降圧薬A（架空）', dispensedAt: '2026-08-15', source: 'オンライン資格確認スタブ' }] });
      if (req.method === 'POST' && pathname === '/api/v1/dx/e-prescriptions') {
        const body = await readBody(req); const orders = store.medicationRequests.filter((m) => (body.medicationRequestIds || []).includes(m.id));
        if (!body.patientId || !orders.length) return sendProblem(res, 422, 'EMR-ERX-4220', 'Prescription validation failed', '患者と1件以上の処方オーダが必要です。', requestId);
        const rx = { id: makeId('RX'), patientId: body.patientId, medicationRequestIds: orders.map((o) => o.id), status: 'submitted', sentAt: new Date().toISOString(), receiptId: makeId('RCPT'), confirmationCode: String(Math.floor(100000 + Math.random() * 900000)) };
        orders.forEach((o) => { o.prescriptionId = rx.id; o.erxStatus = 'submitted'; }); store.prescriptions.push(rx);
        audit(store, { action: 'submit', resourceType: 'ePrescription', resourceId: rx.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 202, rx, { Location: `/api/v1/dx/e-prescriptions/${rx.id}` });
      }
      params = match(pathname, '/api/v1/dx/e-prescriptions/:id/receipt');
      if (req.method === 'GET' && params) {
        const rx = store.prescriptions.find((p) => p.id === params.id); if (!rx) return sendProblem(res, 404, 'EMR-ERX-4040', 'Prescription not found', '電子処方箋が見つかりません。', requestId);
        return sendJson(res, 200, { prescriptionId: rx.id, receiptId: rx.receiptId, confirmationCode: rx.confirmationCode || '000000', issuedAt: rx.sentAt, status: rx.status });
      }
      params = match(pathname, '/api/v1/dx/e-prescriptions/:id/dispensing-result');
      if (req.method === 'POST' && params) {
        const rx = store.prescriptions.find((p) => p.id === params.id); if (!rx) return sendProblem(res, 404, 'EMR-ERX-4040', 'Prescription not found', '電子処方箋が見つかりません。', requestId);
        const result = { id: makeId('DISP'), prescriptionId: rx.id, patientId: rx.patientId, pharmacy: '架空中央薬局', dispensedAt: new Date().toISOString(), status: 'completed', note: '処方どおり調剤（模擬応答）' };
        store.dispenses.push(result); rx.status = 'dispensed'; store.medicationRequests.filter((o) => rx.medicationRequestIds.includes(o.id)).forEach((o) => { o.erxStatus = 'dispensed'; });
        return sendJson(res, 200, result);
      }
      if (req.method === 'GET' && pathname === '/api/v1/dx/e-prescriptions') return sendJson(res, 200, { items: store.prescriptions, dispenses: store.dispenses });
      if (req.method === 'GET' && pathname === '/api/v1/dx/fhir-documents') return sendJson(res, 200, { items: store.receivedBundles });
      if (req.method === 'POST' && pathname === '/api/v1/dx/fhir-documents/import') {
        const body = await readBody(req); if (body.resourceType !== 'Bundle') return sendProblem(res, 422, 'EMR-FHIR-4220', 'FHIR validation failed', 'resourceType=Bundle が必要です。', requestId);
        const item = { id: body.id || makeId('BUNDLE'), receivedAt: new Date().toISOString(), source: body.source || '他院（デモ）', status: 'validated', bundle: body };
        store.receivedBundles.push(item); return sendJson(res, 201, item);
      }
      if (req.method === 'POST' && pathname === '/api/v1/dx/fhir-documents/send') {
        const body = await readBody(req); const bundle = clinicalDocumentBundle(store, body.patientId, body.documentType);
        if (!bundle) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const item = { id: makeId('FHIRSEND'), patientId: body.patientId, destination: '電子カルテ情報共有サービス（模擬）', status: 'accepted', sentAt: new Date().toISOString(), bundle };
        store.sentBundles.push(item); audit(store, { action: 'send', resourceType: 'FHIRDocument', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 202, item);
      }
      params = match(pathname, '/api/v1/dx/patients/:id/fhir-bundle');
      if (req.method === 'GET' && params) { const bundle = patientBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId); }
      if (req.method === 'GET' && pathname === '/api/v1/integrations/status') return sendJson(res, 200, { systems: [
        { id: 'lab', name: '検査システム', status: 'connected', mode: 'FHIR REST mock' }, { id: 'ris', name: '放射線システム', status: 'connected', mode: 'FHIR REST mock' },
        { id: 'billing', name: '会計システム', status: 'connected', mode: 'REST mock' }, { id: 'appointment', name: '予約システム', status: 'connected', mode: 'REST mock' }
      ] });
      if (req.method === 'GET' && pathname === '/api/v1/appointments') return sendJson(res, 200, { items: store.appointments.filter((a) => !url.searchParams.get('patientId') || a.patientId === url.searchParams.get('patientId')) });
      if (req.method === 'POST' && pathname === '/api/v1/appointments') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'startsAt', 'department']);
        if (missing.length) return sendProblem(res, 422, 'EMR-APT-4220', 'Appointment validation failed', '予約必須項目が不足しています。', requestId, missing);
        const appointment = { id: makeId('APT'), ...body, status: 'booked', createdAt: new Date().toISOString() }; store.appointments.push(appointment); return sendJson(res, 201, appointment);
      }
      if (req.method === 'POST' && pathname === '/api/v1/billing/charges') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'encounterId', 'items']);
        if (missing.length) return sendProblem(res, 422, 'EMR-BIL-4220', 'Billing validation failed', '会計連携必須項目が不足しています。', requestId, missing);
        const charge = { id: makeId('CHG'), ...body, status: 'queued', queuedAt: new Date().toISOString() }; store.billingCharges.push(charge); return sendJson(res, 202, charge);
      }

      if (req.method === 'GET' && pathname === '/fhir/r4/metadata') return sendJson(res, 200, capabilityStatement());
      if (req.method === 'GET' && pathname === '/fhir/r4/Patient') {
        const name = (url.searchParams.get('name') || '').toLowerCase();
        const patients = store.patients.filter((patient) => !name
          || [patient.id, patient.name, patient.kana].some((value) => String(value).toLowerCase().includes(name)));
        return sendJson(res, 200, {
          resourceType: 'Bundle', type: 'searchset', total: patients.length,
          entry: patients.map((patient) => ({
            fullUrl: `https://method-more.com/rehainfo/emr/fhir/r4/Patient/${patient.id}`,
            resource: patientResource(patient)
          }))
        }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/Patient/:id');
      if (req.method === 'GET' && params) { const p = store.patients.find((x) => x.id === params.id); return p ? sendJson(res, 200, patientResource(p)) : sendJson(res, 404, operationOutcome('not-found', 'Patient not found')); }
      params = match(pathname, '/fhir/r4/MedicationRequest/:id');
      if (req.method === 'GET' && params) { const o = store.medicationRequests.find((x) => x.id === params.id); return o ? sendJson(res, 200, medicationRequestResource(o)) : sendJson(res, 404, operationOutcome('not-found', 'MedicationRequest not found')); }
      if (req.method === 'GET' && pathname === '/fhir/r4/MedicationRequest') {
        const patientReference = url.searchParams.get('patient') || '';
        const patientId = patientReference.replace(/^Patient\//, '');
        const orders = store.medicationRequests.filter((order) => !patientId || order.patientId === patientId);
        return sendJson(res, 200, {
          resourceType: 'Bundle', type: 'searchset', total: orders.length,
          entry: orders.map((order) => ({
            fullUrl: `https://method-more.com/rehainfo/emr/fhir/r4/MedicationRequest/${order.id}`,
            resource: medicationRequestResource(order)
          }))
        }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/Observation') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, '');
        const labs = store.labOrders.filter((item) => !patientId || item.patientId === patientId).map(observationResource);
        const vitals = store.vitalSigns.filter((item) => !patientId || item.patientId === patientId).map(vitalSignResource);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: labs.length + vitals.length, entry: labs.concat(vitals).map((resource) => ({ resource })) });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/Condition') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, '');
        const conditions = store.conditions.filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: conditions.length, entry: conditions.map((item) => ({ resource: conditionResource(item) })) });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/Encounter') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, '');
        const encounters = store.encounters.filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, {
          resourceType: 'Bundle', type: 'searchset', total: encounters.length,
          entry: encounters.map((item) => ({ resource: encounterResource(item) }))
        }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/ServiceRequest') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, '');
        const category = url.searchParams.get('category') || '';
        const plans = store.rehabilitationPlans.filter((item) => (!patientId || item.patientId === patientId) && (!category || category === 'rehabilitation'));
        return sendJson(res, 200, {
          resourceType: 'Bundle', type: 'searchset', total: plans.length,
          entry: plans.map((item) => ({ resource: rehabilitationServiceRequestResource(item) }))
        }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }

      if (isApi) return pathname.startsWith('/fhir/r4') ? sendJson(res, 404, operationOutcome('not-found', 'Endpoint not found')) : sendProblem(res, 404, 'EMR-API-4040', 'Endpoint not found', '指定されたAPIはありません。', requestId);
      if (await serveStatic(pathname, res)) return;
      return sendProblem(res, 404, 'EMR-WEB-4040', 'Page not found', 'ページが見つかりません。', requestId);
    } catch (error) {
      return sendProblem(res, error.status || 500, error.status === 400 ? 'EMR-JSON-4000' : 'EMR-SRV-5000', 'Request failed', error.status ? error.message : '処理中にエラーが発生しました。', requestId);
    }
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  createAppServer().listen(port, '127.0.0.1', () => console.log(`eMedicalRecordMock running at http://127.0.0.1:${port}`));
}
