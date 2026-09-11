import http from 'node:http';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { audit, createStore, makeId, verifyAuditChain } from './src/store.mjs';
import { allowedTransitions, featureGroups, hospitalModules, hospitalProfile, organizationUnits } from './src/hospital.mjs';
import { capabilityStatement, careTeamResource, clinicalDocumentBundle, conditionResource, consentResource, diagnosticReportResource, encounterResource, medicationAdministrationResource, medicationRequestResource, observationResource, operationOutcome, organizationResource, patientBundle, patientResource, practitionerResource, procedureResource, rehabilitationServiceRequestResource, vitalSignResource } from './src/fhir.mjs';
import { loadRuntimeConfig } from './src/runtime-config.mjs';
import { createAuthService } from './src/auth.mjs';
import { createPostgresStore } from './src/postgres-store.mjs';
import { applyCors, createRateLimiter } from './src/http-security.mjs';
import { clinsAllergyBundle, clinsConditionBundle, clinsDischargeSummaryBundle, clinsInformationBundles, clinsLaboratoryBundle, clinsMedicationBundle, clinsPatientSummaryBundle, clinsReferralBundle, healthCheckupBundle } from './src/clins.mjs';
import { applyPublicDeploymentGate, assessProductionReadiness } from './src/readiness.mjs';
import { validateClinicalWrite } from './src/validation.mjs';
import { createBffAuthService } from './src/bff-auth.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const sessionCookieName = '__Host-emr_session';
const loginCookieName = '__Host-emr_login';
function parseCookies(req) {
  return Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf('='); return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}
function secureCookie(name, value, { maxAge = 600, sameSite = 'Strict' } = {}) {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=${sameSite}`;
}
function clearSecureCookie(name, sameSite = 'Strict') { return `${name}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=${sameSite}`; }
async function sendJson(res, status, body, headers = {}) {
  const pendingIdempotency = res._emrIdempotency; res._emrIdempotency = null;
  const releaseMutation = res._emrMutationRelease; res._emrMutationRelease = null;
  try {
    if ((status < 200 || status >= 300) && res._emrPersist) {
      const persist = res._emrPersist; res._emrPersist = null;
      persist.rollback();
    }
    if (status >= 200 && status < 300 && pendingIdempotency && !pendingIdempotency.dbNative) {
      const pending = pendingIdempotency;
      pending.store.idempotencyRecords.push({
        ...pending.record, statusCode: status, responseBody: structuredClone(body), responseHeaders: structuredClone(headers),
        completedAt: new Date().toISOString()
      });
      headers = { ...headers, 'Idempotency-Key': pending.record.key };
    }
    if (status >= 200 && status < 300 && res._emrPersist) {
      const persist = res._emrPersist; res._emrPersist = null;
      try {
        const persisted = await persist.save(pendingIdempotency?.dbNative ? {
          receipt: pendingIdempotency.receipt,
          response: { status, headers, body },
          outboxEvents: deliveryOutboxEvents(pendingIdempotency, body, status)
        } : null);
        if (pendingIdempotency?.dbNative && persisted?.response) {
          status = persisted.response.status;
          body = persisted.response.body;
          headers = { ...persisted.response.headers };
        }
        if (pendingIdempotency?.dbNative) headers = { ...headers, 'Idempotency-Key': pendingIdempotency.key };
        if (persisted?.replayed) {
          persist.rollback();
          if (persist.reload) await persist.reload();
          status = persisted.response.status;
          body = persisted.response.body;
          headers = { ...persisted.response.headers, 'Idempotency-Key': pendingIdempotency.key, 'Idempotency-Replayed': 'true' };
        }
      }
      catch (error) {
        persist.rollback();
        const idempotencyConflict = error.code === 'EMR-IDEMPOTENCY-FINGERPRINT-CONFLICT';
        const conflict = error.code === 'EMR-PERSISTENCE-CONFLICT';
        let reloadFailed = false;
        if (conflict && persist.reload) {
          try { await persist.reload(); } catch { reloadFailed = true; }
        }
        status = (idempotencyConflict || (conflict && !reloadFailed)) ? 409 : 503;
        const code = idempotencyConflict ? 'EMR-IDEMPOTENCY-4090' : (conflict && !reloadFailed ? 'EMR-PERSISTENCE-CONFLICT' : (reloadFailed ? 'EMR-PERSIST-5030' : (error.code || 'EMR-PERSIST-5030')));
        body = {
          type: `https://mock.example.jp/problems/${code}`,
          title: idempotencyConflict ? 'Idempotency key conflict' : (conflict && !reloadFailed ? 'Persistence version conflict' : 'Persistence unavailable'),
          status,
          detail: idempotencyConflict ? '同じIdempotency-Keyが異なる要求内容に使用されています。' : (conflict && !reloadFailed ? '別のインスタンスが先に更新しました。最新状態へ同期したため、画面を再読込して変更をやり直してください。' : '診療データを安全に保存できなかったため操作を取り消しました。'),
          code,
          requestId: res.getHeader('X-Request-ID')
        };
        headers = {};
      }
    }
    const data = JSON.stringify(body, null, 2);
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store', ...headers });
    res.end(data);
  } finally {
    pendingIdempotency?.release();
    releaseMutation?.();
  }
}

function sendProblem(res, status, code, title, detail, requestId, errors) {
  return sendJson(res, status, { type: `https://mock.example.jp/problems/${code}`, title, status, detail, code, requestId, ...(errors ? { errors } : {}) }, { 'X-Request-ID': requestId });
}

function restoreStore(target, snapshot) {
  for (const key of Object.keys(target)) delete target[key];
  Object.assign(target, snapshot);
}

function createMutex() {
  let tail = Promise.resolve();
  return {
    async acquire() {
      let unlock;
      const current = new Promise((resolve) => { unlock = resolve; });
      const previous = tail;
      tail = previous.then(() => current);
      await previous;
      let released = false;
      return () => {
        if (released) return;
        released = true;
        unlock();
      };
    }
  };
}

async function readBody(req) {
  if (Object.hasOwn(req, '_emrParsedBody')) return req._emrParsedBody;
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw Object.assign(new Error('payload too large'), { status: 413 });
    chunks.push(chunk);
  }
  if (!chunks.length) { req._emrParsedBody = {}; return req._emrParsedBody; }
  const text = Buffer.concat(chunks).toString('utf8');
  if ((req.headers['content-type'] || '').includes('application/x-www-form-urlencoded')) req._emrParsedBody = Object.fromEntries(new URLSearchParams(text));
  else {
    try { req._emrParsedBody = JSON.parse(text); } catch { throw Object.assign(new Error('invalid JSON'), { status: 400 }); }
  }
  return req._emrParsedBody;
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
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function idempotencyFingerprint({ principal, method, target, body }) {
  return createHash('sha256').update(canonicalJson({ tenantId: principal.tenant_id, subject: principal.sub, method, target, body })).digest('hex');
}

function idempotencyReceiptId(principal, key) {
  return `IDEM-${createHash('sha256').update(canonicalJson({ tenantId: principal.tenant_id, subject: principal.sub, key })).digest('hex')}`;
}

function deliveryOutboxEvents(pending, responseBody, status) {
  if (!pending?.dbNative || status < 200 || status >= 300) return [];
  const route = pending.pathname;
  let contract = null;
  if (pending.method === 'POST' && route === '/api/v1/dx/eligibility-verifications') contract = ['medical-dx.eligibility.requested', 'EligibilityVerification'];
  else if (pending.method === 'POST' && route === '/api/v1/dx/e-prescriptions') contract = ['medical-dx.e-prescription.requested', 'ePrescription'];
  else if (pending.method === 'POST' && route === '/api/v1/dx/fhir-documents/send') contract = ['medical-dx.fhir-document.requested', 'FHIRDocument'];
  else if (pending.method === 'POST' && /^\/api\/v1\/hospital\/advanced\/claims\/[^/]+\/transition$/.test(route)) contract = ['claims.submission.requested', 'Claim'];
  else if (pending.method === 'POST' && route === '/api/v1/billing/charges') contract = ['billing.charge.queued', 'BillingCharge'];
  if (!contract || typeof responseBody?.id !== 'string') return [];
  return [{
    eventId: `OUT-${createHash('sha256').update(canonicalJson({ receiptId: pending.receipt.receiptId, executionId: pending.deliveryExecutionId })).digest('hex')}`,
    topic: contract[0], aggregateType: contract[1], aggregateId: responseBody.id,
    payload: { schemaVersion: 1, resourceType: contract[1], resourceId: responseBody.id, action: 'accepted-for-delivery' },
    headers: { 'x-correlation-id': pending.requestId }
  }];
}

const supportedRoles = new Set(['physician', 'nurse', 'pharmacist', 'technician', 'therapist', 'dietitian', 'social-worker', 'clerk', 'administrator', 'system']);
function requestRole(req, principal, runtimeConfig) {
  if (runtimeConfig.mode === 'demo') return String(req.headers['x-demo-role'] || 'physician');
  const claims = [principal.emr_role, ...(Array.isArray(principal.roles) ? principal.roles : [])];
  return claims.find((role) => supportedRoles.has(role)) || 'none';
}
const clinicalAuthorRoles = ['physician', 'nurse', 'pharmacist', 'technician', 'therapist', 'dietitian', 'social-worker'];
const productionMutationRolePolicies = [
  [['POST'], /^\/api\/v1\/security\/break-glass$/, ['physician', 'nurse']],
  [['POST'], /^\/api\/v1\/security\/break-glass\/[^/]+\/revoke$/, ['physician', 'nurse', 'administrator']],
  [['POST', 'PUT'], /^\/api\/v1\/patients(?:\/[^/]+)?$/, ['physician', 'nurse', 'clerk', 'administrator']],
  [['POST'], /^\/api\/v1\/encounters$/, clinicalAuthorRoles],
  [['POST'], /^\/api\/v1\/records$/, ['physician']],
  [['PUT'], /^\/api\/v1\/records\/[^/]+\/sign$/, ['physician']],
  [['POST'], /^\/api\/v1\/medication-requests$/, ['physician']],
  [['POST'], /^\/api\/v1\/injection-orders$/, ['physician', 'nurse']],
  [['POST'], /^\/api\/v1\/lab-orders$/, ['physician', 'nurse']],
  [['POST'], /^\/api\/v1\/lab-orders\/[^/]+\/result$/, ['technician', 'physician', 'system']],
  [['POST'], /^\/api\/v1\/imaging-orders$/, ['physician', 'nurse']],
  [['POST'], /^\/api\/v1\/(?:documents|summaries)$/, clinicalAuthorRoles],
  [['POST'], /^\/api\/v1\/dx\/eligibility-verifications$/, ['physician', 'nurse', 'clerk', 'system']],
  [['POST'], /^\/api\/v1\/dx\/e-prescriptions$/, ['physician', 'system']],
  [['POST'], /^\/api\/v1\/dx\/e-prescriptions\/[^/]+\/dispensing-result$/, ['pharmacist', 'system']],
  [['POST'], /^\/api\/v1\/dx\/fhir-documents\/import$/, ['physician', 'administrator', 'system']],
  [['POST'], /^\/api\/v1\/dx\/fhir-documents\/send$/, ['physician', 'system']],
  [['POST'], /^\/api\/v1\/hospital\/handoffs\/[^/]+\/acknowledge$/, ['nurse', 'administrator']],
  [['POST'], /^\/api\/v1\/hospital\/clinical-instructions\/[^/]+\/transition$/, ['physician', 'nurse', 'administrator']],
  [['POST', 'PUT', 'DELETE'], /^\/api\/v1\/hospital\/activities(?:\/[^/]+(?:\/transition)?)?$/, [...clinicalAuthorRoles, 'clerk', 'administrator']],
  [['POST'], /^\/api\/v1\/hospital\/admissions(?:\/[^/]+\/(?:transfer|discharge))?$/, ['physician', 'nurse', 'clerk', 'administrator']],
  [['POST'], /^\/api\/v1\/hospital\/nursing-records(?:\/[^/]+\/sign)?$/, ['nurse']],
  [['POST'], /^\/api\/v1\/hospital\/advanced\/medication-administrations\/[^/]+\/transition$/, ['nurse', 'administrator']],
  [['POST'], /^\/api\/v1\/hospital\/advanced\/surgical-cases\/[^/]+\/transition$/, ['physician', 'administrator']],
  [['POST'], /^\/api\/v1\/hospital\/advanced\/claims\/[^/]+\/transition$/, ['clerk', 'administrator']],
  [['POST'], /^\/api\/v1\/hospital\/admin\/(?:inventory|incidents)$/, ['nurse', 'administrator']],
  [['POST', 'PUT'], /^\/api\/v1\/hospital\/admin\/[^/]+(?:\/[^/]+)?$/, ['administrator']],
  [['POST', 'PUT', 'DELETE'], /^\/api\/v1\/appointments(?:\/[^/]+)?$/, ['physician', 'nurse', 'clerk', 'administrator']],
  [['POST'], /^\/api\/v1\/billing\/charges$/, ['clerk', 'administrator', 'system']]
];
function allowedProductionMutationRoles(method, pathname) {
  return productionMutationRolePolicies.find(([methods, pattern]) => methods.includes(method) && pattern.test(pathname))?.[2] || null;
}
function supportedClaimedRoles(principal) {
  return [...new Set([principal.emr_role, ...(Array.isArray(principal.roles) ? principal.roles : [])].filter((role) => supportedRoles.has(role)))];
}

function activeCosignAssignment(record, signerStaffId, body) {
  if (!body?.cosignAssignmentId || !body?.cosignReason) return null;
  return (record.cosignAssignments || []).find((assignment) => assignment.id === body.cosignAssignmentId
    && assignment.assignedStaffId === signerStaffId && assignment.status === 'active'
    && assignment.reason === body.cosignReason) || null;
}

const medicationExecutionModules = new Set(['injection', 'chemotherapy']);
function oauthScopeContext(principal) {
  const scopes = String(principal.scope || '').split(/\s+/).filter(Boolean);
  const hasUserScope = scopes.some((scope) => scope.startsWith('user/'));
  const hasSystemScope = scopes.some((scope) => scope.startsWith('system/'));
  if (hasUserScope === hasSystemScope) return 'invalid';
  return hasUserScope ? 'user' : 'system';
}
function scopeAllows(principal, method, pathname) {
  const action = ['GET', 'HEAD', 'OPTIONS'].includes(method) ? 'read' : 'write';
  const scopes = new Set(String(principal.scope || '').split(/\s+/).filter(Boolean));
  const context = oauthScopeContext(principal);
  if (context === 'invalid') return false;
  const fhirResource = pathname.match(/^\/fhir\/r4\/([^/]+)/)?.[1];
  return scopes.has(`${context}/*.*`) || scopes.has(`${context}/*.${action}`)
    || Boolean(fhirResource && scopes.has(`${context}/${fhirResource}.${action}`));
}

function chartPatientId(pathname) {
  const apiMatch = pathname.match(/^\/api\/v1\/(?:dx\/)?patients\/([^/]+)/);
  if (apiMatch) return decodeURIComponent(apiMatch[1]);
  const fhirMatch = pathname.match(/^\/fhir\/r4\/Patient\/([^/]+)/);
  return fhirMatch ? decodeURIComponent(fhirMatch[1]) : null;
}
function hasTreatmentRelationship(store, principal, patientId) {
  if (Array.isArray(principal.patient_ids) && principal.patient_ids.includes(patientId)) return true;
  return Boolean(principal.practitioner_id && store.patientAssignments.some((assignment) => assignment.patientId === patientId
    && assignment.staffId === principal.practitioner_id && assignment.status === 'active'));
}
function activeBreakGlassGrant(store, principal, patientId, grantId, now = Date.now()) {
  if (!grantId) return null;
  return store.breakGlassGrants.find((grant) => grant.id === grantId && grant.patientId === patientId
    && grant.requestedBySub === principal.sub && grant.practitionerId === principal.practitioner_id
    && grant.status === 'active' && Date.parse(grant.expiresAt) > now) || null;
}

const advancedCollections = {
  'imaging-reports': 'imagingReports', 'pharmacy-reviews': 'pharmacyReviews',
  'medication-administrations': 'medicationAdministrations', 'surgical-cases': 'surgicalCases',
  'anesthesia-records': 'anesthesiaRecords', 'transfusion-orders': 'transfusionOrders',
  'pathology-specimens': 'pathologySpecimens', 'microbiology-results': 'microbiologyResults',
  'dialysis-sessions': 'dialysisSessions', 'chemotherapy-regimens': 'chemotherapyRegimens',
  'icu-flowsheets': 'icuFlowsheets', 'infection-control': 'infectionControlCases',
  'dpc-episodes': 'dpcEpisodes', claims: 'claimSubmissions', 'discharge-plans': 'dischargePlans'
};

const patientResourceLookups = [
  [/^\/api\/v1\/records\/([^/]+)\/sign$/, 'records'],
  [/^\/api\/v1\/lab-orders\/([^/]+)\/result$/, 'labOrders'],
  [/^\/api\/v1\/dx\/e-prescriptions\/([^/]+)\/(?:receipt|dispensing-result)$/, 'prescriptions'],
  [/^\/api\/v1\/hospital\/handoffs\/([^/]+)\/acknowledge$/, 'handoffs'],
  [/^\/api\/v1\/hospital\/clinical-instructions\/([^/]+)\/transition$/, 'clinicalInstructions'],
  [/^\/api\/v1\/hospital\/activities\/([^/]+)(?:\/transition)?$/, 'activities'],
  [/^\/api\/v1\/hospital\/admissions\/([^/]+)\/(?:transfer|discharge)$/, 'admissions'],
  [/^\/api\/v1\/hospital\/nursing-records\/([^/]+)\/sign$/, 'nursingRecords'],
  [/^\/api\/v1\/hospital\/admin\/incidents\/([^/]+)$/, 'incidents'],
  [/^\/api\/v1\/appointments\/([^/]+)$/, 'appointments'],
  [/^\/fhir\/r4\/MedicationRequest\/([^/]+)$/, 'medicationRequests'],
  [/^\/fhir\/r4\/CareTeam\/([^/]+)$/, 'careTeams'],
  [/^\/fhir\/r4\/Consent\/([^/]+)$/, 'patientConsents'],
  [/^\/fhir\/r4\/DiagnosticReport\/([^/]+)$/, 'imagingReports'],
  [/^\/fhir\/r4\/MedicationAdministration\/([^/]+)$/, 'medicationAdministrations'],
  [/^\/fhir\/r4\/Procedure\/([^/]+)$/, 'surgicalCases']
];

const patientSensitivePrefixes = [
  '/api/v1/dashboard', '/api/v1/patients', '/api/v1/encounters', '/api/v1/records',
  '/api/v1/medication-requests', '/api/v1/injection-orders', '/api/v1/lab-orders',
  '/api/v1/imaging-orders', '/api/v1/documents', '/api/v1/summaries',
  '/api/v1/dx/eligibility-verifications', '/api/v1/dx/e-prescriptions', '/api/v1/dx/fhir-documents',
  '/api/v1/hospital/patient-assignments', '/api/v1/hospital/handoffs',
  '/api/v1/hospital/clinical-instructions', '/api/v1/hospital/team-conferences',
  '/api/v1/hospital/activities', '/api/v1/hospital/beds', '/api/v1/hospital/admissions',
  '/api/v1/hospital/nursing-records', '/api/v1/hospital/advanced', '/api/v1/hospital/admin/incidents', '/api/v1/appointments',
  '/api/v1/billing/charges', '/fhir/r4/Patient', '/fhir/r4/MedicationRequest',
  '/fhir/r4/Observation', '/fhir/r4/Condition', '/fhir/r4/Encounter', '/fhir/r4/ServiceRequest',
  '/fhir/r4/CareTeam', '/fhir/r4/Consent', '/fhir/r4/DiagnosticReport',
  '/fhir/r4/MedicationAdministration', '/fhir/r4/Procedure'
];

function safeDecodePathSegment(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function patientIdFromResourcePath(store, pathname) {
  for (const [pattern, collectionName] of patientResourceLookups) {
    const resourceMatch = pathname.match(pattern);
    if (!resourceMatch) continue;
    return store[collectionName].find((item) => item.id === safeDecodePathSegment(resourceMatch[1]))?.patientId || null;
  }
  const advancedMatch = pathname.match(/^\/api\/v1\/hospital\/advanced\/([^/]+)\/([^/]+)\/transition$/);
  if (advancedMatch && advancedCollections[advancedMatch[1]]) {
    return store[advancedCollections[advancedMatch[1]]].find((item) => item.id === safeDecodePathSegment(advancedMatch[2]))?.patientId || null;
  }
  return null;
}

function requestPatientContext(store, pathname, url, body = null) {
  const fhirReference = url.searchParams.get('patient') || url.searchParams.get('subject') || '';
  const fhirPatientId = /^Patient\/([^/]+)$/.exec(fhirReference)?.[1] || null;
  const pathPatientId = chartPatientId(pathname) || patientIdFromResourcePath(store, pathname);
  const queryPatientIds = [url.searchParams.get('patientId'), fhirPatientId].filter(Boolean);
  const queryPatientId = queryPatientIds[0] || null;
  const bodyPatientId = typeof body?.patientId === 'string' && body.patientId ? body.patientId : null;
  const assertedIds = [...queryPatientIds, bodyPatientId].filter(Boolean);
  const allIds = [pathPatientId, ...assertedIds].filter(Boolean);
  return {
    patientId: pathPatientId || queryPatientId || bodyPatientId || null,
    conflict: new Set(allIds).size > 1,
    pathPatientId,
    queryPatientId,
    bodyPatientId
  };
}

function isPatientSensitivePath(pathname) {
  return patientSensitivePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function advancedForPatient(store, patientId) {
  return Object.fromEntries(Object.values(advancedCollections).map((key) => [key, store[key].filter((item) => item.patientId === patientId)]));
}

async function serveStatic(pathname, res) {
  const relative = ['/', '/auth/callback'].includes(pathname) ? 'index.html' : pathname.replace(/^\//, '');
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

export function createAppServer({ store = createStore(), runtimeConfig = loadRuntimeConfig(), repository = null, authService = null, bffAuthService = null } = {}) {
  if (runtimeConfig.mode === 'production' && !repository) throw new Error('Production server requires PostgreSQL repository.');
  const auth = authService || createAuthService(runtimeConfig);
  const bffAuth = bffAuthService || (runtimeConfig.mode === 'production' && runtimeConfig.sessionEncryptionKey
    ? createBffAuthService(runtimeConfig, { authService: auth, repository }) : null);
  const rateLimiter = createRateLimiter({ max: runtimeConfig.rateLimitPerMinute || (runtimeConfig.mode === 'production' ? 120 : 1000) });
  const durableDeliveryEnabled = runtimeConfig.mode === 'production'
    && runtimeConfig.persistence === 'postgres'
    && typeof repository?.lookupIdempotencyReceipt === 'function';
  const idempotencyInFlight = new Map();
  const mutationMutex = createMutex();
  let draining = false;
  let authenticationAuditHealthy = true;
  const contentSecurityPolicy = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:; connect-src 'self'";
  const persistSecurityAudit = async (entry) => {
    try {
      if (repository?.appendAuthAudit) {
        const event = { id: makeId('AUD-AUTH'), recordedAt: new Date().toISOString(), ...entry };
        await repository.appendAuthAudit(event);
        return event;
      }
      const release = await mutationMutex.acquire();
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const snapshot = structuredClone(store);
          audit(store, entry);
          try {
            if (repository) await repository.save(store);
            return;
          } catch (error) {
            restoreStore(store, snapshot);
            if (attempt === 0 && error.code === 'EMR-PERSISTENCE-CONFLICT' && repository?.reload) {
              const latest = await repository.reload();
              restoreStore(store, latest);
              continue;
            }
            throw error;
          }
        }
      } finally { release(); }
    } catch (error) {
      authenticationAuditHealthy = false;
      console.error(JSON.stringify({ level: 'error', event: 'auth-audit-write-failed', requestId: entry.requestId, category: 'persistence-unavailable' }));
      throw error;
    }
  };
  const server = http.createServer(async (req, res) => {
    const requestId = makeId('REQ');
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname.replace(/\/$/, '') || '/';
    const isApi = pathname.startsWith('/api/v1') || pathname.startsWith('/fhir/r4');
    const isProtectedHttpSurface = isApi || pathname === '/oauth/token' || pathname.startsWith('/auth/');
    res.setHeader('X-Request-ID', requestId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    if (runtimeConfig.mode === 'production') res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Content-Security-Policy', contentSecurityPolicy);

    try {
      if (isProtectedHttpSurface && !applyCors(req, res, runtimeConfig)) return sendProblem(res, 403, 'EMR-ORIGIN-4030', 'Origin not allowed', 'このOriginからのAPIアクセスは許可されていません。', requestId);
      if (isProtectedHttpSurface && req.method === 'OPTIONS') { res.writeHead(204, { 'Content-Length': '0' }); return res.end(); }
      if (isProtectedHttpSurface) {
        const clientKey = req.socket.remoteAddress || 'unknown';
        const limit = rateLimiter.check(clientKey);
        res.setHeader('RateLimit-Limit', limit.limit);
        res.setHeader('RateLimit-Remaining', limit.remaining);
        res.setHeader('RateLimit-Reset', Math.ceil(limit.resetAt / 1000));
        if (!limit.allowed) {
          res.setHeader('Retry-After', Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000)));
          if (pathname.startsWith('/fhir/r4')) return sendJson(res, 429, operationOutcome('throttled', '要求回数の上限を超えました。時間をおいて再試行してください。'));
          return sendProblem(res, 429, 'EMR-RATE-4290', 'Too many requests', '要求回数の上限を超えました。時間をおいて再試行してください。', requestId);
        }
      }
      if (req.method === 'GET' && pathname === '/healthz') return sendJson(res, 200, {
        status: 'ok', service: 'eMedicalRecordMock', version: '0.5.0', hospital: hospitalProfile.name, dataMode: `fictional-${runtimeConfig.persistence}`, runtimeMode: runtimeConfig.mode, deploymentStage: runtimeConfig.deploymentStage || (runtimeConfig.mode === 'production' ? 'validation' : 'demo'),
        capabilities: {
          smartRehabPrescriptionImport: true,
          smartRehabPatientImport: true,
          fhirMedicationRequestSearch: true,
          fhirClinicalContextSearch: true,
          hospitalWorkflows: true,
          inpatientBedBoard: true,
          nursingRecords: true,
          staffRosterAndShifts: true,
          patientAssignments: true,
          handoffsAndClinicalInstructions: true,
          multidisciplinaryConferences: true,
          roleBasedAdministration: true,
          advancedClinicalRecords: true,
          surgeryAnesthesiaTransfusion: true,
          pathologyMicrobiology: true,
          dialysisChemotherapyIcu: true,
          dpcClaimsAndDischargePlanning: true,
          breakGlassEmergencyAccess: true,
          idempotentMutationReceipts: true,
          authorizationCodePkce: true
        }
      });
      if (draining && pathname !== '/readyz') return sendProblem(res, 503, 'EMR-DRAINING-5030', 'Service draining', '安全な終了処理中のため新しい要求を受け付けていません。', requestId);
      if (req.method === 'GET' && pathname === '/auth/config') return sendJson(res, 200, runtimeConfig.mode === 'production'
        ? { mode: 'production', authentication: 'bff-oidc-cookie', csrf: 'required-for-mutations' }
        : { mode: 'demo' });
      if (runtimeConfig.mode === 'production' && req.method === 'GET' && pathname === '/auth/login') {
        if (!bffAuth) return sendProblem(res, 503, 'EMR-BFF-5030', 'BFF unavailable', 'BFF認証セッションを初期化できません。', requestId);
        const login = await bffAuth.beginLogin(url.searchParams.get('returnTo'));
        await persistSecurityAudit({ action: 'auth:login-started', resourceType: 'Authentication', resourceId: 'oidc', requestId, outcome: 'success' });
        res.writeHead(302, { Location: login.authorizationUrl, 'Cache-Control': 'no-store', 'Set-Cookie': secureCookie(loginCookieName, login.transactionId, { sameSite: 'Lax' }) });
        return res.end();
      }
      if (runtimeConfig.mode === 'production' && req.method === 'GET' && pathname === '/auth/callback') {
        if (!bffAuth) return sendProblem(res, 503, 'EMR-BFF-5030', 'BFF unavailable', 'BFF認証セッションを初期化できません。', requestId);
        const transactionId = parseCookies(req)[loginCookieName];
        let completedSessionId = null;
        try {
          if (url.searchParams.get('error')) throw Object.assign(new Error('OIDC authorization was rejected.'), { status: 401 });
          const login = await bffAuth.completeLogin({ transactionId, state: url.searchParams.get('state'), code: url.searchParams.get('code') });
          completedSessionId = login.sessionId;
          await persistSecurityAudit({ action: 'auth:login-success', resourceType: 'Authentication', resourceId: login.principal.sub, practitionerId: login.principal.practitioner_id, requestId, outcome: 'success' });
          const maxAge = Math.max(1, Math.floor((login.expiresAt - Date.now()) / 1000));
          res.writeHead(303, { Location: login.returnTo, 'Cache-Control': 'no-store', 'Set-Cookie': [clearSecureCookie(loginCookieName, 'Lax'), secureCookie(sessionCookieName, login.sessionId, { maxAge })] });
          return res.end();
        } catch (error) {
          if (completedSessionId) await bffAuth.logout(completedSessionId).catch(() => {});
          try {
            await persistSecurityAudit({ action: 'auth:login-failure', resourceType: 'Authentication', resourceId: 'oidc', requestId, outcome: 'failure', details: { category: error.status === 401 ? 'verification-failed' : 'service-failure' } });
          } catch {}
          res.setHeader('Set-Cookie', clearSecureCookie(loginCookieName, 'Lax'));
          res.writeHead(303, { Location: '/?auth_error=oidc_login_failed', 'Cache-Control': 'no-store' });
          return res.end();
        }
      }
      if (runtimeConfig.mode === 'production' && req.method === 'GET' && pathname === '/auth/session') {
        const session = bffAuth ? await bffAuth.getSession(parseCookies(req)[sessionCookieName]) : null;
        if (!session) return sendJson(res, 200, { authenticated: false });
        const role = session.principal.emr_role || (Array.isArray(session.principal.roles) ? session.principal.roles[0] : null);
        return sendJson(res, 200, { authenticated: true, csrfToken: session.csrfToken, expiresAt: new Date(session.expiresAt).toISOString(), user: { sub: session.principal.sub, practitionerId: session.principal.practitioner_id, role, name: session.idClaims.name || session.idClaims.preferred_username || session.idClaims.sub } });
      }
      if (runtimeConfig.mode === 'production' && req.method === 'POST' && pathname === '/auth/logout') {
        const sessionId = parseCookies(req)[sessionCookieName]; const session = bffAuth ? await bffAuth.getSession(sessionId) : null;
        if (!session || !bffAuth.verifyCsrf(session, req.headers['x-csrf-token'])) {
          await persistSecurityAudit({ action: 'security:csrf-denied', resourceType: 'Authentication', resourceId: session?.principal?.sub || 'anonymous', practitionerId: session?.principal?.practitioner_id, requestId, outcome: 'failure', details: { target: '/auth/logout' } });
          return sendProblem(res, 403, 'EMR-CSRF-4030', 'CSRF validation failed', '有効なCSRFトークンが必要です。', requestId);
        }
        await persistSecurityAudit({ action: 'auth:logout-requested', resourceType: 'Authentication', resourceId: session.principal.sub, practitionerId: session.principal.practitioner_id, requestId, outcome: 'success' });
        await bffAuth.logout(sessionId); res.setHeader('Set-Cookie', clearSecureCookie(sessionCookieName));
        let logoutUrl = null;
        if (runtimeConfig.oidcEndSessionUrl) {
          const target = new URL(runtimeConfig.oidcEndSessionUrl);
          target.searchParams.set('post_logout_redirect_uri', runtimeConfig.publicBaseUrl);
          logoutUrl = target.href;
        }
        return sendJson(res, 200, { loggedOut: true, logoutUrl });
      }
      if (req.method === 'GET' && pathname === '/readyz') {
        const integrity = verifyAuditChain(store);
        const database = repository ? await repository.health() : { healthy: runtimeConfig.mode === 'demo', adapter: 'in-memory' };
        let reliableDelivery = { enabled: false, adapter: runtimeConfig.mode === 'demo' ? 'in-memory-demo' : 'not-configured' };
        if (durableDeliveryEnabled && typeof repository.deliveryHealth === 'function') {
          try { reliableDelivery = { enabled: true, adapter: 'postgres-outbox', ...(await repository.deliveryHealth()) }; }
          catch (error) { reliableDelivery = { enabled: true, adapter: 'postgres-outbox', observable: false, error: error.code || 'delivery-health-unavailable' }; }
        }
        const browserSessionStore = { durable: runtimeConfig.mode === 'demo' || Boolean(bffAuth?.durable), adapter: runtimeConfig.mode === 'demo' ? 'not-applicable' : (bffAuth?.durable ? 'postgres' : 'memory') };
        const authenticationAudit = { healthy: authenticationAuditHealthy && (database.authAuditIntegrity?.valid ?? true), ...(database.authAuditIntegrity ? { integrity: database.authAuditIntegrity } : {}) };
        const ready = !draining && runtimeConfig.productionReady && integrity.valid && database.healthy && browserSessionStore.durable && authenticationAudit.healthy;
        return sendJson(res, ready ? 200 : 503, { status: ready ? 'ready' : 'not-ready', runtimeMode: runtimeConfig.mode, persistence: runtimeConfig.persistence, database, reliableDelivery, browserSessionStore, auditIntegrity: integrity, authenticationAudit, productionReady: runtimeConfig.productionReady, draining });
      }
      if (req.method === 'POST' && pathname === '/oauth/token') {
        if (!runtimeConfig.demoAuthEnabled) return sendProblem(res, 404, 'EMR-AUTH-4040', 'Not found', 'デモトークン発行機能は本番モードでは利用できません。', requestId);
        const body = await readBody(req);
        if (body.grant_type !== 'client_credentials') return sendProblem(res, 400, 'EMR-AUTH-4001', 'Unsupported grant type', 'grant_type must be client_credentials in this mock.', requestId);
        return sendJson(res, 200, { access_token: auth.issueDemoToken({ sub: body.client_id || 'demo-web', scope: body.scope }), token_type: 'Bearer', expires_in: 300, scope: body.scope || 'system/*.read system/*.write' });
      }

      let principal = null;
      let accessContext = runtimeConfig.mode === 'production' ? 'invalid' : 'demo';
      let authenticatedPractitioner = null;
      let breakGlassPatientId = null;
      if (isApi) {
        const browserSession = runtimeConfig.mode === 'production' && bffAuth ? await bffAuth.getSession(parseCookies(req)[sessionCookieName]) : null;
        principal = browserSession?.principal || await auth.verify((req.headers.authorization || '').replace(/^Bearer\s+/i, ''));
        if (!principal) {
          if (pathname.startsWith('/fhir/r4')) return sendJson(res, 401, operationOutcome('login', '有効なBearerトークンが必要です'), { 'WWW-Authenticate': 'Bearer realm="eMedicalRecordMock"' });
          return sendProblem(res, 401, 'EMR-AUTH-4010', 'Unauthorized', '有効なBearerトークンが必要です。', requestId);
        }
        if (runtimeConfig.mode === 'production' && principal.tenant_id !== runtimeConfig.tenantId) return sendProblem(res, 401, 'EMR-AUTH-4011', 'Tenant mismatch', 'トークンのテナントが一致しません。', requestId);
        if (!scopeAllows(principal, req.method, pathname)) return sendProblem(res, 403, 'EMR-SCOPE-4030', 'Insufficient scope', 'この操作に必要なOAuthスコープがありません。', requestId);
        accessContext = oauthScopeContext(principal);
        if (runtimeConfig.mode === 'production') {
          const role = requestRole(req, principal, runtimeConfig);
          if ((accessContext === 'system' && role !== 'system') || (accessContext === 'user' && role === 'system')) {
            return sendProblem(res, 403, 'EMR-SCOPE-ACTOR-4030', 'Invalid OAuth actor context', '利用者用scopeとシステム用scopeを認証主体の種別と一致させてください。', requestId);
          }
          if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && role === 'none') {
            return sendProblem(res, 403, 'EMR-RBAC-4031', 'Authenticated role required', '変更操作には認証済みロールが必要です。', requestId);
          }
          if (accessContext === 'user') {
            const practitionerMatches = store.staffMembers.filter((item) => item.id === principal.practitioner_id && item.active === true);
            if (practitionerMatches.length !== 1) {
              return sendProblem(res, 403, 'EMR-PRACTITIONER-4030', 'Active practitioner required', '認証された職員IDが有効な院内職員に一意に一致しません。', requestId);
            }
            [authenticatedPractitioner] = practitionerMatches;
            const claimedRoles = supportedClaimedRoles(principal);
            if (claimedRoles.length !== 1 || claimedRoles[0] !== authenticatedPractitioner.role) {
              return sendProblem(res, 403, 'EMR-PRACTITIONER-ROLE-4030', 'Practitioner role mismatch', '認証トークンの職種を有効な院内職員情報に一意に一致させてください。', requestId);
            }
          }
          if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
            const allowedRoles = allowedProductionMutationRoles(req.method, pathname);
            if (!allowedRoles || !allowedRoles.includes(role)) {
              return sendProblem(res, 403, 'EMR-RBAC-4032', 'Mutation role forbidden', 'この職種には指定された変更操作を実行する権限がありません。', requestId);
            }
          }
          if (browserSession && !['GET', 'HEAD', 'OPTIONS'].includes(req.method) && !bffAuth.verifyCsrf(browserSession, req.headers['x-csrf-token'])) {
            await persistSecurityAudit({ action: 'security:csrf-denied', resourceType: 'Authentication', resourceId: principal.sub, practitionerId: principal.practitioner_id, requestId, outcome: 'failure', details: { target: pathname } });
            return sendProblem(res, 403, 'EMR-CSRF-4030', 'CSRF validation failed', 'Cookie認証による変更操作には有効なCSRFトークンが必要です。', requestId);
          }
        }
      }

      const hasVisiblePatientAccess = (patientId) => runtimeConfig.mode !== 'production' || accessContext === 'system'
        || hasTreatmentRelationship(store, principal, patientId) || breakGlassPatientId === patientId;
      const visiblePatientItems = (items) => runtimeConfig.mode !== 'production' || accessContext === 'system'
        ? items
        : items.filter((item) => typeof item?.patientId === 'string' && hasVisiblePatientAccess(item.patientId));
      const visiblePatients = (items) => runtimeConfig.mode !== 'production' || accessContext === 'system'
        ? items
        : items.filter((item) => hasVisiblePatientAccess(item.id));

      const mutationRequest = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
      if (isApi && mutationRequest) {
        const inputValidation = validateClinicalWrite({
          method: req.method,
          pathname,
          contentType: req.headers['content-type'],
          body: await readBody(req)
        });
        if (inputValidation.matched && inputValidation.errors.length) {
          return sendProblem(res, 422, inputValidation.code, inputValidation.title, inputValidation.detail, requestId, inputValidation.errors);
        }
      }
      const accessBody = runtimeConfig.mode === 'production' && isApi && mutationRequest ? await readBody(req) : null;
      const patientContext = requestPatientContext(store, pathname, url, accessBody);
      if (patientContext.conflict) {
        return sendProblem(res, 409, 'EMR-PATIENT-CONTEXT-4090', 'Conflicting patient context', 'パス、クエリ、本文の患者IDが一致しません。', requestId);
      }
      const controlledPatientId = patientContext.patientId;
      const breakGlassControlPath = pathname === '/api/v1/security/break-glass'
        || /^\/api\/v1\/security\/break-glass\/[^/]+\/revoke$/.test(pathname);
      if (runtimeConfig.mode === 'production' && accessContext === 'user' && !breakGlassControlPath) {
        if (isPatientSensitivePath(pathname) && mutationRequest && !controlledPatientId && pathname !== '/api/v1/patients') {
          return sendProblem(res, 403, 'EMR-PATIENT-CONTEXT-4031', 'Patient context required', '患者関連の変更操作には解決可能な患者コンテキストが必要です。', requestId);
        }
        if (controlledPatientId) {
          const readOnlyRequest = ['GET', 'HEAD'].includes(req.method);
          const grant = readOnlyRequest ? activeBreakGlassGrant(store, principal, controlledPatientId, req.headers['x-break-glass-grant']) : null;
          if (!hasTreatmentRelationship(store, principal, controlledPatientId) && !grant) {
            return sendProblem(res, 403, 'EMR-PATIENT-ACCESS-4030', 'Treatment relationship required', '診療関係または有効な緊急アクセスが必要です。', requestId);
          }
          if (grant) {
            breakGlassPatientId = controlledPatientId;
            const snapshot = structuredClone(store);
            audit(store, { action: 'break-glass:access', resourceType: 'Patient', resourceId: controlledPatientId, practitionerId: principal.practitioner_id, requestId, details: { grantId: grant.id, reasonCode: grant.reasonCode } });
            try { await repository.save(store); }
            catch (error) {
              restoreStore(store, snapshot);
              return sendProblem(res, 503, 'EMR-PERSIST-5030', 'Persistence unavailable', '緊急アクセス監査を保存できないため参照を中止しました。', requestId);
            }
          }
        }
      }

      if (repository && isApi && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        res._emrMutationRelease = await mutationMutex.acquire();
        const snapshot = structuredClone(store);
        res._emrPersist = {
          save: (delivery = null) => repository.save(structuredClone(store), delivery),
          rollback: () => restoreStore(store, snapshot),
          reload: typeof repository.reload === 'function' ? async () => restoreStore(store, await repository.reload()) : null
        };
      }

      if (runtimeConfig.mode === 'production' && isApi && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const key = String(req.headers['idempotency-key'] || '');
        if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/.test(key)) {
          return sendProblem(res, 428, 'EMR-IDEMPOTENCY-4280', 'Idempotency key required', '変更要求には8〜128文字のIdempotency-Keyが必要です。', requestId);
        }
        const requestBody = await readBody(req);
        const target = `${pathname}${url.search}`;
        const fingerprint = idempotencyFingerprint({ principal, method: req.method, target, body: requestBody });
        const now = Date.now();
        if (durableDeliveryEnabled) {
          const receiptId = idempotencyReceiptId(principal, key);
          const operation = `${req.method} ${pathname}`;
          let previous;
          try {
            previous = await repository.lookupIdempotencyReceipt({ receiptId, operation, requestFingerprint: fingerprint });
          } catch (error) {
            if (error.code === 'EMR-IDEMPOTENCY-FINGERPRINT-CONFLICT') {
              return sendProblem(res, 409, 'EMR-IDEMPOTENCY-4090', 'Idempotency key conflict', '同じIdempotency-Keyが異なる要求内容に使用されています。', requestId);
            }
            return sendProblem(res, 503, 'EMR-PERSIST-5030', 'Persistence unavailable', '再実行制御の状態を安全に確認できないため操作を開始できません。', requestId);
          }
          if (previous?.state === 'completed') {
            res._emrPersist = null;
            return sendJson(res, previous.response.status, previous.response.body, {
              ...previous.response.headers,
              'Idempotency-Key': key,
              'Idempotency-Replayed': 'true'
            });
          }
          res._emrIdempotency = {
            dbNative: true,
            key,
            pathname,
            method: req.method,
            requestId,
            deliveryExecutionId: makeId('DELIVERY'),
            receipt: {
              receiptId,
              operation,
              requestFingerprint: fingerprint,
              expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString()
            },
            release: () => {}
          };
        } else {
        store.idempotencyRecords = store.idempotencyRecords.filter((item) => Date.parse(item.expiresAt) > now);
        const flightKey = `${principal.tenant_id}\u0000${principal.sub}\u0000${key}`;
        const inFlight = idempotencyInFlight.get(flightKey);
        if (inFlight) {
          if (inFlight.fingerprint !== fingerprint) return sendProblem(res, 409, 'EMR-IDEMPOTENCY-4090', 'Idempotency key conflict', '同じIdempotency-Keyが異なる要求内容に使用されています。', requestId);
          await inFlight.done;
        }
        const previous = store.idempotencyRecords.find((item) => item.tenantId === principal.tenant_id && item.principalSub === principal.sub && item.key === key);
        if (previous) {
          if (previous.fingerprint !== fingerprint) return sendProblem(res, 409, 'EMR-IDEMPOTENCY-4090', 'Idempotency key conflict', '同じIdempotency-Keyが異なる要求内容に使用されています。', requestId);
          res._emrPersist = null;
          return sendJson(res, previous.statusCode, previous.responseBody, { ...previous.responseHeaders, 'Idempotency-Key': key, 'Idempotency-Replayed': 'true' });
        }
        let releaseFlight;
        const flight = { fingerprint, done: new Promise((resolve) => { releaseFlight = resolve; }) };
        idempotencyInFlight.set(flightKey, flight);
        res._emrIdempotency = {
          store,
          record: {
            id: makeId('IDEM'), key, tenantId: principal.tenant_id, principalSub: principal.sub,
            method: req.method, target, fingerprint, createdAt: new Date(now).toISOString(),
            expiresAt: new Date(now + 24 * 60 * 60 * 1000).toISOString(), dataClassification: 'FICTIONAL_DEMO'
          },
          release: () => {
            if (idempotencyInFlight.get(flightKey) === flight) idempotencyInFlight.delete(flightKey);
            releaseFlight();
          }
        };
        }
      }

      if (req.method === 'POST' && pathname === '/api/v1/security/break-glass') {
        const role = requestRole(req, principal, runtimeConfig);
        if (!['physician', 'nurse'].includes(role)) return sendProblem(res, 403, 'EMR-BREAKGLASS-4030', 'Clinical role required', '緊急アクセスは医師または看護師のみ申請できます。', requestId);
        if (!principal.sub || !principal.practitioner_id) return sendProblem(res, 403, 'EMR-BREAKGLASS-4031', 'Identified practitioner required', '利用者IDと職員IDを確認できません。', requestId);
        const body = await readBody(req);
        const reasonCodes = new Set(['emergency-care', 'patient-safety', 'system-downtime']);
        const durationMinutes = Number(body.durationMinutes || 15);
        if (!store.patients.some((patient) => patient.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        if (!reasonCodes.has(body.reasonCode) || typeof body.justification !== 'string' || body.justification.trim().length < 10 || body.justification.length > 500
          || !Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 30) {
          return sendProblem(res, 422, 'EMR-BREAKGLASS-4220', 'Emergency access validation failed', '理由区分、10文字以上の理由、5〜30分の有効時間が必要です。', requestId);
        }
        const now = Date.now();
        const grant = {
          id: makeId('BRK'), tenantId: runtimeConfig.tenantId, patientId: body.patientId,
          requestedBySub: principal.sub, practitionerId: principal.practitioner_id, role,
          reasonCode: body.reasonCode, justification: body.justification.trim(),
          activatedAt: new Date(now).toISOString(), expiresAt: new Date(now + durationMinutes * 60_000).toISOString(),
          status: 'active', dataClassification: 'FICTIONAL_DEMO', version: 1
        };
        store.breakGlassGrants.push(grant);
        audit(store, { action: 'break-glass:activate', resourceType: 'Patient', resourceId: grant.patientId, practitionerId: principal.practitioner_id, requestId, details: { grantId: grant.id, reasonCode: grant.reasonCode, justification: grant.justification, expiresAt: grant.expiresAt } });
        return sendJson(res, 201, grant, { Location: `/api/v1/security/break-glass/${grant.id}` });
      }
      if (req.method === 'GET' && pathname === '/api/v1/security/break-glass') {
        if (requestRole(req, principal, runtimeConfig) !== 'administrator') return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', '緊急アクセス監査一覧には管理者権限が必要です。', requestId);
        return sendJson(res, 200, { items: store.breakGlassGrants, total: store.breakGlassGrants.length });
      }
      let securityParams = match(pathname, '/api/v1/security/break-glass/:id/revoke');
      if (req.method === 'POST' && securityParams) {
        const grant = store.breakGlassGrants.find((item) => item.id === securityParams.id);
        if (!grant) return sendProblem(res, 404, 'EMR-BREAKGLASS-4040', 'Emergency access not found', '緊急アクセス記録が見つかりません。', requestId);
        const role = requestRole(req, principal, runtimeConfig);
        if (role !== 'administrator' && grant.requestedBySub !== principal.sub) return sendProblem(res, 403, 'EMR-BREAKGLASS-4032', 'Revocation forbidden', 'この緊急アクセスを終了する権限がありません。', requestId);
        if (grant.status !== 'active') return sendProblem(res, 409, 'EMR-BREAKGLASS-4090', 'Emergency access is not active', '緊急アクセスは既に終了しています。', requestId);
        const body = await readBody(req);
        grant.status = 'revoked'; grant.revokedAt = new Date().toISOString(); grant.revocationReason = String(body.reason || '利用終了').slice(0, 200); grant.version += 1;
        audit(store, { action: 'break-glass:revoke', resourceType: 'Patient', resourceId: grant.patientId, practitionerId: principal.practitioner_id, requestId, details: { grantId: grant.id, reason: grant.revocationReason } });
        return sendJson(res, 200, grant);
      }

      if (req.method === 'GET' && pathname === '/api/v1/dashboard') {
        const patients = visiblePatients(store.patients); const patientIds = new Set(patients.map((patient) => patient.id));
        return sendJson(res, 200, {
          date: '2026-09-11', counts: {
            waiting: patients.filter((patient) => ['受付済', '診察待ち'].includes(patient.status)).length,
            unsigned: store.records.filter((record) => patientIds.has(record.patientId) && record.status !== 'signed').length,
            pendingLabs: store.labOrders.filter((order) => patientIds.has(order.patientId) && order.status !== 'completed').length,
            dxErrors: 0
          },
          patients
        });
      }
      if (req.method === 'GET' && pathname === '/api/v1/patients') {
        const query = (url.searchParams.get('q') || '').toLowerCase();
        const list = visiblePatients(store.patients).filter((p) => !query || [p.id, p.name, p.kana, p.department].some((v) => String(v).toLowerCase().includes(query)));
        return sendJson(res, 200, { items: list, total: list.length });
      }
      if (req.method === 'POST' && pathname === '/api/v1/patients') {
        const body = await readBody(req); const missing = requireFields(body, ['name', 'kana', 'birthDate', 'gender']);
        if (missing.length) return sendProblem(res, 422, 'EMR-PAT-4220', 'Patient validation failed', '患者基本情報が不足しています。', requestId, missing);
        const patient = {
          id: body.id || makeId('PAT'), name: body.name, kana: body.kana, birthDate: body.birthDate, gender: body.gender,
          bloodType: body.bloodType || '未確認', phone: body.phone || '', postalCode: body.postalCode || '', address: body.address || '',
          insurance: body.insurance || { status: '確認待ち', copayRate: 30, verifiedAt: null }, allergies: body.allergies || [], alerts: body.alerts || [],
          department: body.department || '内科', nextAppointment: '未定', lastVisit: '初診', status: '登録済', room: '—',
          dataClassification: 'FICTIONAL_DEMO', version: 1, createdAt: new Date().toISOString()
        };
        if (store.patients.some((item) => item.id === patient.id)) return sendProblem(res, 409, 'EMR-PAT-4090', 'Patient already exists', '同じ患者IDが登録されています。', requestId);
        store.patients.push(patient); audit(store, { action: 'create', resourceType: 'Patient', resourceId: patient.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, patient, { Location: `/api/v1/patients/${patient.id}` });
      }
      let params = match(pathname, '/api/v1/patients/:id');
      if (req.method === 'GET' && params) {
        const patient = store.patients.find((p) => p.id === params.id);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        return sendJson(res, 200, patient);
      }
      if (req.method === 'PUT' && params) {
        const body = await readBody(req); const patient = store.patients.find((p) => p.id === params.id);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        if (body.version !== (patient.version || 1)) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が患者情報を更新しました。再読込してください。', requestId);
        ['name', 'kana', 'phone', 'postalCode', 'address', 'department', 'status', 'room'].forEach((key) => { if (body[key] !== undefined) patient[key] = body[key]; });
        if (Array.isArray(body.allergies)) patient.allergies = body.allergies;
        if (Array.isArray(body.alerts)) patient.alerts = body.alerts;
        patient.version = (patient.version || 1) + 1; patient.updatedAt = new Date().toISOString();
        audit(store, { action: 'update', resourceType: 'Patient', resourceId: patient.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, patient, { ETag: `W/\"${patient.version}\"` });
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
        patientContext: store.patientContexts.find((item) => item.patientId === params.id),
        careTeam: store.careTeams.find((item) => item.patientId === params.id),
        consents: store.patientConsents.filter((item) => item.patientId === params.id),
        hospitalActivities: store.activities.filter((item) => item.patientId === params.id),
        nursingRecords: store.nursingRecords.filter((item) => item.patientId === params.id),
        patientAssignments: store.patientAssignments.filter((item) => item.patientId === params.id),
        handoffs: store.handoffs.filter((item) => item.patientId === params.id),
        clinicalInstructions: store.clinicalInstructions.filter((item) => item.patientId === params.id),
        teamConferences: store.teamConferences.filter((item) => item.patientId === params.id),
        advancedClinical: advancedForPatient(store, params.id),
        admission: store.admissions.find((item) => item.patientId === params.id && item.status === 'admitted') || null,
        bed: store.beds.find((item) => item.patientId === params.id) || null,
        receivedFhirDocuments: store.receivedBundles.filter((item) => item.patientId === params.id),
        sentFhirDocuments: store.sentBundles.filter((item) => item.patientId === params.id)
      });
      params = match(pathname, '/api/v1/patients/:id/hospital-context');
      if (req.method === 'GET' && params) {
        const patient = store.patients.find((item) => item.id === params.id);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        return sendJson(res, 200, {
          patient, context: store.patientContexts.find((item) => item.patientId === params.id),
          careTeam: store.careTeams.find((item) => item.patientId === params.id),
          consents: store.patientConsents.filter((item) => item.patientId === params.id),
          activities: store.activities.filter((item) => item.patientId === params.id),
          nursingRecords: store.nursingRecords.filter((item) => item.patientId === params.id),
          patientAssignments: store.patientAssignments.filter((item) => item.patientId === params.id),
          handoffs: store.handoffs.filter((item) => item.patientId === params.id),
          clinicalInstructions: store.clinicalInstructions.filter((item) => item.patientId === params.id),
          teamConferences: store.teamConferences.filter((item) => item.patientId === params.id),
          advancedClinical: advancedForPatient(store, params.id),
          admission: store.admissions.find((item) => item.patientId === params.id && item.status === 'admitted') || null,
          bed: store.beds.find((item) => item.patientId === params.id) || null
        });
      }
      if (req.method === 'POST' && pathname === '/api/v1/encounters') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'department']);
        if (missing.length) return sendProblem(res, 422, 'EMR-VAL-4220', 'Validation failed', '必須項目が不足しています。', requestId, missing);
        if (!store.patients.some((patient) => patient.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const practitionerId = authenticatedPractitioner?.id || principal.practitioner_id;
        if (!practitionerId) return sendProblem(res, 403, 'EMR-PRACTITIONER-4031', 'Identified practitioner required', '診療開始には職員IDを確認できる認証主体が必要です。', requestId);
        const startedAt = new Date().toISOString();
        const encounter = { id: makeId('ENC'), patientId: body.patientId, department: body.department, status: 'in-progress', startedAt, practitionerId };
        store.encounters.push(encounter);
        audit(store, { action: 'create', resourceType: 'Encounter', resourceId: encounter.id, practitionerId, requestId });
        return sendJson(res, 201, encounter, { Location: `/api/v1/encounters/${encounter.id}` });
      }
      if (req.method === 'POST' && pathname === '/api/v1/records') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'soap']);
        if (missing.length) return sendProblem(res, 422, 'EMR-VAL-4220', 'Validation failed', '患者とSOAPは必須です。', requestId, missing);
        if (requestRole(req, principal, runtimeConfig) !== 'physician') return sendProblem(res, 403, 'EMR-RBAC-4030', 'Physician required', 'SOAP診療記録の作成には医師ロールが必要です。', requestId);
        const patient = store.patients.find((item) => item.id === body.patientId);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const author = runtimeConfig.mode === 'production' ? authenticatedPractitioner : store.staffMembers.find((item) => item.id === principal.practitioner_id) || store.staffMembers.find((item) => item.role === 'physician');
        const practitionerId = author?.id || principal.practitioner_id;
        if (!practitionerId) return sendProblem(res, 403, 'EMR-PRACTITIONER-4031', 'Identified practitioner required', '診療記録の作成には職員IDを確認できる認証主体が必要です。', requestId);
        const occurredAt = new Date().toISOString();
        let encounter = body.encounterId ? store.encounters.find((item) => item.id === body.encounterId) : null;
        if (body.encounterId && !encounter) return sendProblem(res, 404, 'EMR-ENC-4040', 'Encounter not found', '診療情報が見つかりません。', requestId);
        if (encounter && encounter.patientId !== patient.id) return sendProblem(res, 409, 'EMR-ENC-4090', 'Encounter patient mismatch', '指定した診療情報は別の患者に属しています。', requestId);
        if (encounter && encounter.status !== 'in-progress') return sendProblem(res, 409, 'EMR-ENC-4091', 'Encounter already closed', '終了済みの診療へ新しい診療記録は追加できません。訂正記録の手続きを使用してください。', requestId);
        if (!encounter) {
          encounter = { id: makeId('ENC'), patientId: patient.id, department: body.department || patient.department || '内科', status: 'in-progress', startedAt: occurredAt, practitionerId };
          store.encounters.push(encounter);
          audit(store, { action: 'create', resourceType: 'Encounter', resourceId: encounter.id, practitionerId, requestId, details: { source: 'clinical-record-create' } });
        }
        const record = { id: makeId('REC'), patientId: patient.id, encounterId: encounter.id, occurredAt, department: body.department || encounter.department || patient.department || '内科', author: runtimeConfig.mode === 'production' ? author?.name || principal.sub : body.author || author?.name || principal.sub, authorStaffId: practitionerId, authorSubject: principal.sub, status: 'draft', version: 1, soap: body.soap };
        store.records.push(record); audit(store, { action: 'create', resourceType: 'ClinicalRecord', resourceId: record.id, practitionerId, requestId });
        return sendJson(res, 201, record, { ETag: `W/\"${record.version}\"`, Location: `/api/v1/records/${record.id}` });
      }
      params = match(pathname, '/api/v1/records/:id/sign');
      if (req.method === 'PUT' && params) {
        const body = await readBody(req); const record = store.records.find((r) => r.id === params.id);
        if (!record) return sendProblem(res, 404, 'EMR-REC-4040', 'Record not found', '診療記録が見つかりません。', requestId);
        if (record.status !== 'draft') return sendProblem(res, 409, 'EMR-REC-4091', 'Record is not signable', '下書き状態の診療記録だけを確定できます。', requestId);
        if (body.version !== record.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が診療記録を更新しました。再読込してください。', requestId);
        if (requestRole(req, principal, runtimeConfig) !== 'physician') return sendProblem(res, 403, 'EMR-RBAC-4030', 'Physician required', 'SOAP診療記録の確定には医師ロールが必要です。', requestId);
        const signer = authenticatedPractitioner || store.staffMembers.find((item) => item.id === principal.practitioner_id)
          || (runtimeConfig.mode === 'demo' ? store.staffMembers.find((item) => item.id === record.authorStaffId) : null);
        const signerStaffId = signer?.id || principal.practitioner_id;
        if (!principal.sub || !signerStaffId) return sendProblem(res, 403, 'EMR-PRACTITIONER-4031', 'Identified practitioner required', '診療記録の確定には利用者IDと職員IDを確認できる認証主体が必要です。', requestId);
        const cosignAssignment = activeCosignAssignment(record, signerStaffId, body);
        if (signerStaffId !== record.authorStaffId && !cosignAssignment) return sendProblem(res, 403, 'EMR-SIGNER-4030', 'Author or delegated cosigner required', '記録者本人または事前登録された代行署名者だけが確定できます。', requestId);
        record.status = 'signed'; record.signedAt = new Date().toISOString(); record.version = body.version + 1;
        record.signedBy = signer?.name || principal.sub;
        record.signedByStaffId = signerStaffId;
        record.signedBySubject = principal.sub;
        if (cosignAssignment) {
          cosignAssignment.status = 'used'; cosignAssignment.usedAt = record.signedAt; cosignAssignment.usedBySubject = principal.sub;
          record.cosignReason = body.cosignReason; record.cosignAssignmentId = cosignAssignment.id;
        }
        audit(store, { action: 'sign', resourceType: 'ClinicalRecord', resourceId: record.id, practitionerId: signerStaffId, requestId });
        return sendJson(res, 200, record, { ETag: `W/\"${record.version}\"` });
      }

      if (req.method === 'POST' && pathname === '/api/v1/medication-requests') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'medicationCode', 'medicationDisplay', 'dosageText', 'quantity', 'unit']);
        if (missing.length) return sendProblem(res, 422, 'EMR-MED-4220', 'Medication validation failed', '処方必須項目が不足しています。', requestId, missing);
        const patient = store.patients.find((item) => item.id === body.patientId);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const linkedRecord = body.recordId ? store.records.find((item) => item.id === body.recordId) : null;
        if (body.recordId && !linkedRecord) return sendProblem(res, 404, 'EMR-REC-4040', 'Record not found', '関連する診療記録が見つかりません。', requestId);
        if (linkedRecord && linkedRecord.patientId !== patient.id) return sendProblem(res, 409, 'EMR-REC-4090', 'Record patient mismatch', '関連する診療記録は別の患者に属しています。', requestId);
        const requester = runtimeConfig.mode === 'production' ? authenticatedPractitioner : store.staffMembers.find((item) => item.id === principal.practitioner_id) || store.staffMembers.find((item) => item.role === 'physician');
        const order = { id: makeId('MEDREQ'), patientId: patient.id, recordId: linkedRecord?.id || null, status: 'active', intent: 'order', authoredOn: new Date().toISOString(), requester: runtimeConfig.mode === 'production' ? requester?.name || principal.sub : body.requester || requester.name, requesterStaffId: requester?.id || null, requesterSubject: principal.sub, medicationCode: body.medicationCode, medicationDisplay: body.medicationDisplay, dosageText: body.dosageText, days: Number(body.days || 1), quantity: Number(body.quantity), unit: body.unit, route: body.route || '経口', erxStatus: 'draft', version: 1 };
        store.medicationRequests.push(order); audit(store, { action: 'create', resourceType: 'MedicationRequest', resourceId: order.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, { order, fhir: medicationRequestResource(order) }, { Location: `/fhir/r4/MedicationRequest/${order.id}` });
      }
      if (req.method === 'GET' && pathname === '/api/v1/medication-requests') return sendJson(res, 200, { items: visiblePatientItems(store.medicationRequests).filter((m) => !url.searchParams.get('patientId') || m.patientId === url.searchParams.get('patientId')).map((item) => ({ ...item, version: item.version || 1 })) });
      if (req.method === 'POST' && pathname === '/api/v1/injection-orders') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'medicationDisplay', 'dose', 'route']);
        if (missing.length) return sendProblem(res, 422, 'EMR-INJ-4220', 'Injection validation failed', '注射オーダ必須項目が不足しています。', requestId, missing);
        if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const order = { id: makeId('INJ'), ...body, status: 'active', requestedAt: new Date().toISOString(), version: 1 }; store.injectionOrders.push(order);
        audit(store, { action: 'create', resourceType: 'InjectionOrder', resourceId: order.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, order);
      }
      if (req.method === 'POST' && pathname === '/api/v1/lab-orders') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'code', 'name']);
        if (missing.length) return sendProblem(res, 422, 'EMR-LAB-4220', 'Lab validation failed', '検査オーダ必須項目が不足しています。', requestId, missing);
        if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const linkedRecord = body.recordId ? store.records.find((item) => item.id === body.recordId) : null;
        if (body.recordId && !linkedRecord) return sendProblem(res, 404, 'EMR-REC-4040', 'Record not found', '関連する診療記録が見つかりません。', requestId);
        if (linkedRecord && linkedRecord.patientId !== body.patientId) return sendProblem(res, 409, 'EMR-REC-4090', 'Record patient mismatch', '関連する診療記録は別の患者に属しています。', requestId);
        const order = { id: makeId('LAB'), ...body, recordId: linkedRecord?.id || null, priority: body.priority || 'routine', status: 'requested', requestedAt: new Date().toISOString(), version: 1 }; store.labOrders.push(order);
        audit(store, { action: 'create', resourceType: 'LabOrder', resourceId: order.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, order, { Location: `/api/v1/lab-orders/${order.id}` });
      }
      params = match(pathname, '/api/v1/lab-orders/:id/result');
      if (req.method === 'POST' && params) {
        const body = await readBody(req); const order = store.labOrders.find((o) => o.id === params.id);
        if (!order) return sendProblem(res, 404, 'EMR-LAB-4040', 'Lab order not found', '検査オーダが見つかりません。', requestId);
        if (order.status !== 'requested') return sendProblem(res, 409, 'EMR-LAB-4090', 'Lab result already finalized', '検査結果は既に確定済みです。訂正記録を追加してください。', requestId);
        if (body.version !== (order.version || 1)) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が検査オーダを更新しました。', requestId);
        order.status = 'completed'; order.result = body.result; order.completedAt = new Date().toISOString(); order.version = (order.version || 1) + 1;
        audit(store, { action: 'complete', resourceType: 'LabOrder', resourceId: order.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, { order, fhir: observationResource(order) });
      }
      if (req.method === 'GET' && pathname === '/api/v1/lab-orders') return sendJson(res, 200, { items: visiblePatientItems(store.labOrders).filter((o) => !url.searchParams.get('patientId') || o.patientId === url.searchParams.get('patientId')).map((item) => ({ ...item, version: item.version || 1 })) });
      if (req.method === 'POST' && pathname === '/api/v1/imaging-orders') {
        const body = await readBody(req); if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const order = { id: makeId('IMG'), ...body, status: 'requested', requestedAt: new Date().toISOString(), version: 1 }; store.imagingOrders.push(order); audit(store, { action: 'create', resourceType: 'ImagingOrder', resourceId: order.id, practitionerId: principal.practitioner_id, requestId }); return sendJson(res, 201, order);
      }
      if (req.method === 'POST' && pathname === '/api/v1/documents') {
        const body = await readBody(req); if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const doc = { id: makeId('DOC'), ...body, status: 'final', authoredAt: new Date().toISOString(), version: 1 }; store.documents.push(doc); audit(store, { action: 'create', resourceType: 'ClinicalDocument', resourceId: doc.id, practitionerId: principal.practitioner_id, requestId }); return sendJson(res, 201, doc);
      }
      if (req.method === 'POST' && pathname === '/api/v1/summaries') {
        const body = await readBody(req); if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const item = { id: makeId('SUM'), ...body, status: 'final', authoredAt: new Date().toISOString(), version: 1 }; store.summaries.push(item); audit(store, { action: 'create', resourceType: 'ClinicalSummary', resourceId: item.id, practitionerId: principal.practitioner_id, requestId }); return sendJson(res, 201, item);
      }

      if (req.method === 'POST' && pathname === '/api/v1/dx/eligibility-verifications') {
        const body = await readBody(req); const patient = store.patients.find((p) => p.id === body.patientId);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        if (body.consent !== true) return sendProblem(res, 422, 'EMR-ELG-4221', 'Consent required', '資格情報の確認には患者同意が必要です。', requestId);
        if (durableDeliveryEnabled) {
          const result = { id: makeId('ELG'), patientId: patient.id, status: 'accepted-for-delivery', queuedAt: new Date().toISOString(), consent: true };
          store.eligibilityChecks.push(result);
          audit(store, { action: 'queue', resourceType: 'EligibilityVerification', resourceId: result.id, practitionerId: principal.practitioner_id, requestId });
          return sendJson(res, 202, result);
        }
        const result = { id: makeId('ELG'), patientId: patient.id, status: 'qualified', verifiedAt: new Date().toISOString(), insurerNumber: patient.insurance.insurerNumber, copayRate: patient.insurance.copayRate, consent: body.consent === true };
        store.eligibilityChecks.push(result); patient.insurance.status = '有効'; patient.insurance.verifiedAt = result.verifiedAt;
        audit(store, { action: 'verify', resourceType: 'EligibilityVerification', resourceId: result.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, result);
      }
      params = match(pathname, '/api/v1/dx/patients/:id/medication-history');
      if (req.method === 'GET' && params) return sendJson(res, 200, { patientId: params.id, consentConfirmed: true, items: [{ medication: '降圧薬A（架空）', dispensedAt: '2026-08-15', source: 'オンライン資格確認スタブ' }] });
      if (req.method === 'POST' && pathname === '/api/v1/dx/e-prescriptions') {
        const body = await readBody(req);
        const requestedIds = body.medicationRequestIds || [];
        if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        if (new Set(requestedIds).size !== requestedIds.length) return sendProblem(res, 422, 'EMR-ERX-4221', 'Duplicate medication request', '同じ処方オーダを重複して指定できません。', requestId);
        if (body.medicationRequestVersions.length !== requestedIds.length) return sendProblem(res, 422, 'EMR-ERX-4222', 'Medication version mismatch', '処方オーダIDごとに版数を指定してください。', requestId);
        const orders = requestedIds.map((id) => store.medicationRequests.find((item) => item.id === id));
        if (orders.some((item) => !item)) return sendProblem(res, 422, 'EMR-ERX-4223', 'Medication request not found', '指定された処方オーダをすべて確認できません。', requestId);
        if (orders.some((item) => item.patientId !== body.patientId)) return sendProblem(res, 409, 'EMR-ERX-4091', 'Medication patient mismatch', '別の患者の処方オーダは送信できません。', requestId);
        if (orders.some((item) => item.status !== 'active' || item.erxStatus !== 'draft' || item.prescriptionId)) return sendProblem(res, 409, 'EMR-ERX-4092', 'Medication already submitted', '未送信かつ有効な処方オーダだけを送信できます。', requestId);
        const stale = orders.some((item, index) => body.medicationRequestVersions[index] !== (item.version || 1));
        if (stale) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が処方オーダを更新しました。', requestId);
        const rx = durableDeliveryEnabled
          ? { id: makeId('RX'), patientId: body.patientId, medicationRequestIds: requestedIds, status: 'accepted-for-delivery', queuedAt: new Date().toISOString(), version: 1 }
          : { id: makeId('RX'), patientId: body.patientId, medicationRequestIds: requestedIds, status: 'submitted', sentAt: new Date().toISOString(), receiptId: makeId('RCPT'), confirmationCode: String(Math.floor(100000 + Math.random() * 900000)), version: 1 };
        orders.forEach((o) => { o.prescriptionId = rx.id; o.erxStatus = durableDeliveryEnabled ? 'queued' : 'submitted'; o.version = (o.version || 1) + 1; }); store.prescriptions.push(rx);
        audit(store, { action: durableDeliveryEnabled ? 'queue' : 'submit', resourceType: 'ePrescription', resourceId: rx.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 202, rx, { Location: `/api/v1/dx/e-prescriptions/${rx.id}` });
      }
      params = match(pathname, '/api/v1/dx/e-prescriptions/:id/receipt');
      if (req.method === 'GET' && params) {
        const rx = store.prescriptions.find((p) => p.id === params.id); if (!rx) return sendProblem(res, 404, 'EMR-ERX-4040', 'Prescription not found', '電子処方箋が見つかりません。', requestId);
        if (rx.status === 'accepted-for-delivery') return sendJson(res, 200, { prescriptionId: rx.id, receiptId: null, confirmationCode: null, acceptedForDeliveryAt: rx.queuedAt, status: rx.status });
        return sendJson(res, 200, { prescriptionId: rx.id, receiptId: rx.receiptId, confirmationCode: rx.confirmationCode || '000000', issuedAt: rx.sentAt, status: rx.status });
      }
      params = match(pathname, '/api/v1/dx/e-prescriptions/:id/dispensing-result');
      if (req.method === 'POST' && params) {
        const body = await readBody(req); const rx = store.prescriptions.find((p) => p.id === params.id); if (!rx) return sendProblem(res, 404, 'EMR-ERX-4040', 'Prescription not found', '電子処方箋が見つかりません。', requestId);
        if (rx.status !== 'submitted') return sendProblem(res, 409, 'EMR-ERX-4093', 'Prescription already finalized', 'この電子処方箋の調剤結果は既に確定済みです。', requestId);
        if (body.version !== (rx.version || 1)) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が電子処方箋を更新しました。', requestId);
        const result = { id: makeId('DISP'), prescriptionId: rx.id, patientId: rx.patientId, pharmacy: '架空中央薬局', dispensedAt: new Date().toISOString(), status: 'completed', note: '処方どおり調剤（模擬応答）' };
        store.dispenses.push(result); rx.status = 'dispensed'; rx.version = (rx.version || 1) + 1; store.medicationRequests.filter((o) => rx.medicationRequestIds.includes(o.id)).forEach((o) => { o.erxStatus = 'dispensed'; o.version = (o.version || 1) + 1; });
        audit(store, { action: 'complete', resourceType: 'DispensingResult', resourceId: result.id, practitionerId: principal.practitioner_id, requestId, details: { prescriptionId: rx.id } });
        return sendJson(res, 200, result);
      }
      if (req.method === 'GET' && pathname === '/api/v1/dx/e-prescriptions') return sendJson(res, 200, { items: visiblePatientItems(store.prescriptions).map((item) => ({ ...item, version: item.version || 1 })), dispenses: visiblePatientItems(store.dispenses) });
      if (req.method === 'GET' && pathname === '/api/v1/dx/fhir-documents') return sendJson(res, 200, { items: visiblePatientItems(store.receivedBundles) });
      if (req.method === 'POST' && pathname === '/api/v1/dx/fhir-documents/import') {
        const body = await readBody(req); if (body.resourceType !== 'Bundle') return sendProblem(res, 422, 'EMR-FHIR-4220', 'FHIR validation failed', 'resourceType=Bundle が必要です。', requestId);
        const patientId = url.searchParams.get('patientId') || null;
        if (patientId && !store.patients.some((patient) => patient.id === patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const item = { id: body.id || makeId('BUNDLE'), patientId, receivedAt: new Date().toISOString(), source: body.source || '他院（デモ）', status: 'received-unvalidated', validation: { performed: false, reason: 'formal-validator-not-connected' }, bundle: body };
        store.receivedBundles.push(item); audit(store, { action: 'import-unvalidated', resourceType: 'FHIRDocument', resourceId: item.id, practitionerId: principal.practitioner_id, requestId }); return sendJson(res, 201, item);
      }
      if (req.method === 'POST' && pathname === '/api/v1/dx/fhir-documents/send') {
        const body = await readBody(req); const bundle = clinicalDocumentBundle(store, body.patientId, body.documentType);
        if (!bundle) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const item = durableDeliveryEnabled
          ? { id: makeId('FHIRSEND'), patientId: body.patientId, destination: 'configured-connector', status: 'accepted-for-delivery', queuedAt: new Date().toISOString(), bundle }
          : { id: makeId('FHIRSEND'), patientId: body.patientId, destination: '電子カルテ情報共有サービス（模擬）', status: 'accepted', sentAt: new Date().toISOString(), bundle };
        store.sentBundles.push(item); audit(store, { action: durableDeliveryEnabled ? 'queue' : 'send', resourceType: 'FHIRDocument', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 202, durableDeliveryEnabled
          ? { id: item.id, status: item.status, queuedAt: item.queuedAt, documentType: body.documentType, destination: item.destination }
          : item);
      }
      params = match(pathname, '/api/v1/dx/patients/:id/fhir-bundle');
      if (req.method === 'GET' && params) { const bundle = patientBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-laboratory-bundle');
      if (req.method === 'GET' && params) { const bundle = clinsLaboratoryBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS data not found', '患者または検体検査結果が見つかりません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-condition-bundle');
      if (req.method === 'GET' && params) { const bundle = clinsConditionBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS data not found', '患者または傷病名情報が見つかりません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-allergy-bundle');
      if (req.method === 'GET' && params) { const bundle = clinsAllergyBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS data not found', '患者またはアレルギー情報が見つかりません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-medication-bundle');
      if (req.method === 'GET' && params) { const bundle = clinsMedicationBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS data not found', '患者または処方情報が見つかりません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-referral-bundle');
      if (req.method === 'GET' && params) { const bundle = clinsReferralBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS document not found', '診療情報提供書を生成できません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-discharge-summary-bundle');
      if (req.method === 'GET' && params) { const bundle = clinsDischargeSummaryBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS document not found', '退院時サマリーを生成できません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-patient-summary-bundle');
      if (req.method === 'GET' && params) { const bundle = clinsPatientSummaryBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS document not found', '患者サマリーを生成できません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/health-checkup-bundle');
      if (req.method === 'GET' && params) { const bundle = healthCheckupBundle(store, params.id); return bundle ? sendJson(res, 200, bundle) : sendProblem(res, 404, 'EMR-CHECKUP-4040', 'Checkup document not found', '健診結果報告書を生成できません。', requestId); }
      params = match(pathname, '/api/v1/dx/patients/:id/clins-information-bundles');
      if (req.method === 'GET' && params) { const bundles = clinsInformationBundles(store, params.id); return bundles.condition ? sendJson(res, 200, bundles) : sendProblem(res, 404, 'EMR-CLINS-4040', 'CLINS data not found', '患者のCLINS共有情報が見つかりません。', requestId); }
      if (req.method === 'GET' && pathname === '/api/v1/integrations/status') return sendJson(res, 200, { systems: [
        { id: 'lab', name: '検査システム', status: 'connected', mode: 'FHIR REST mock' }, { id: 'ris', name: '放射線システム', status: 'connected', mode: 'FHIR REST mock' },
        { id: 'billing', name: '会計システム', status: 'connected', mode: 'REST mock' }, { id: 'appointment', name: '予約システム', status: 'connected', mode: 'REST mock' }
      ] });

      if (req.method === 'GET' && pathname === '/api/v1/hospital/overview') return sendJson(res, 200, {
        hospital: hospitalProfile,
        organizationUnits,
        modules: hospitalModules.map((module) => ({ ...module, counts: store.activities.filter((item) => item.moduleId === module.id).reduce((counts, item) => ({ ...counts, [item.status]: (counts[item.status] || 0) + 1 }), {}) })),
        totals: {
          activities: store.activities.length,
          waiting: store.activities.filter((item) => ['requested', 'accepted'].includes(item.status)).length,
          inProgress: store.activities.filter((item) => item.status === 'in-progress').length,
          occupiedBeds: store.beds.filter((item) => item.status === 'occupied').length,
          availableBeds: store.beds.filter((item) => item.status === 'available').length,
          openIncidents: store.incidents.filter((item) => item.status !== 'closed').length,
          staffMembers: store.staffMembers.length,
          nurses: store.staffMembers.filter((item) => item.role === 'nurse').length,
          onDutyStaff: store.shiftAssignments.filter((item) => item.status === 'on-duty').length,
          pendingHandoffs: store.handoffs.filter((item) => item.status === 'pending').length,
          openInstructions: store.clinicalInstructions.filter((item) => item.status === 'accepted').length
        }
      });
      if (req.method === 'GET' && pathname === '/api/v1/hospital/organization') return sendJson(res, 200, { hospital: hospitalProfile, items: organizationUnits });
      if (req.method === 'GET' && pathname === '/api/v1/hospital/staff') {
        const role = url.searchParams.get('role'); const department = url.searchParams.get('department');
        const items = store.staffMembers.filter((item) => (!role || item.role === role) && (!department || item.department === department));
        return sendJson(res, 200, { items, total: items.length });
      }
      if (req.method === 'GET' && pathname === '/api/v1/hospital/shifts') {
        const ward = url.searchParams.get('ward'); const shiftCode = url.searchParams.get('shiftCode');
        const items = store.shiftAssignments.filter((item) => (!ward || item.ward === ward) && (!shiftCode || item.shiftCode === shiftCode));
        return sendJson(res, 200, { date: '2026-09-11', items, total: items.length });
      }
      if (req.method === 'GET' && pathname === '/api/v1/hospital/patient-assignments') {
        const patientId = url.searchParams.get('patientId'); const ward = url.searchParams.get('ward');
        const items = visiblePatientItems(store.patientAssignments).filter((item) => (!patientId || item.patientId === patientId) && (!ward || item.ward === ward));
        return sendJson(res, 200, { items, total: items.length });
      }
      if (req.method === 'GET' && pathname === '/api/v1/hospital/handoffs') {
        const patientId = url.searchParams.get('patientId'); const ward = url.searchParams.get('ward'); const status = url.searchParams.get('status');
        const items = visiblePatientItems(store.handoffs).filter((item) => (!patientId || item.patientId === patientId) && (!ward || item.ward === ward) && (!status || item.status === status));
        return sendJson(res, 200, { items, total: items.length });
      }
      params = match(pathname, '/api/v1/hospital/handoffs/:id/acknowledge');
      if (req.method === 'POST' && params) {
        const role = requestRole(req, principal, runtimeConfig); const body = await readBody(req);
        if (!['nurse', 'administrator'].includes(role)) return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', '申し送り確認は看護師または管理者ロールで実行してください。', requestId);
        const item = store.handoffs.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-HAND-4040', 'Handoff not found', '申し送りが見つかりません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が申し送りを更新しました。', requestId);
        if (!['pending', 'scheduled'].includes(item.status)) return sendProblem(res, 409, 'EMR-HAND-4091', 'Already acknowledged', 'この申し送りは確認済みです。', requestId);
        item.status = 'acknowledged'; item.acknowledgedAt = new Date().toISOString(); item.version += 1;
        audit(store, { action: 'acknowledge', resourceType: 'Handoff', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item);
      }
      if (req.method === 'GET' && pathname === '/api/v1/hospital/clinical-instructions') {
        const patientId = url.searchParams.get('patientId'); const status = url.searchParams.get('status');
        const items = visiblePatientItems(store.clinicalInstructions).filter((item) => (!patientId || item.patientId === patientId) && (!status || item.status === status));
        return sendJson(res, 200, { items, total: items.length });
      }
      params = match(pathname, '/api/v1/hospital/clinical-instructions/:id/transition');
      if (req.method === 'POST' && params) {
        const role = requestRole(req, principal, runtimeConfig); const body = await readBody(req);
        if (!['physician', 'nurse', 'administrator'].includes(role)) return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', '診療指示の状態更新権限がありません。', requestId);
        const item = store.clinicalInstructions.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-INST-4040', 'Instruction not found', '診療指示が見つかりません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が診療指示を更新しました。', requestId);
        const next = ({ ordered: ['accepted', 'cancelled'], accepted: ['completed', 'cancelled'], completed: [], cancelled: [] })[item.status] || [];
        if (!next.includes(body.status)) return sendProblem(res, 409, 'EMR-INST-4091', 'Invalid transition', `${item.status} から ${body.status} へは変更できません。`, requestId);
        item.status = body.status; item.version += 1;
        if (body.status === 'accepted') item.acknowledgedAt = new Date().toISOString();
        if (body.status === 'completed') { item.completedAt = new Date().toISOString(); item.result = body.result || '指示を実施し記録済み（架空）'; }
        audit(store, { action: `transition:${body.status}`, resourceType: 'ClinicalInstruction', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item);
      }
      if (req.method === 'GET' && pathname === '/api/v1/hospital/team-conferences') {
        const patientId = url.searchParams.get('patientId'); const status = url.searchParams.get('status');
        const items = visiblePatientItems(store.teamConferences).filter((item) => (!patientId || item.patientId === patientId) && (!status || item.status === status));
        return sendJson(res, 200, { items, total: items.length });
      }
      if (req.method === 'GET' && pathname === '/api/v1/hospital/modules') return sendJson(res, 200, { items: hospitalModules });
      if (req.method === 'GET' && pathname === '/api/v1/hospital/features') return sendJson(res, 200, {
        standard: '中小病院向け電子カルテ及びレセプトコンピュータ標準仕様書（基本要件）1.0版・別紙様式1',
        assessedAt: '2026-09-11', mode: 'interactive-local-mock', items: featureGroups,
        caveat: '実通信、実機、正式validator、負荷・可用性試験、認証審査は未実施'
      });
      if (req.method === 'GET' && pathname === '/api/v1/hospital/audit-integrity') {
        const role = requestRole(req, principal, runtimeConfig);
        if (role !== 'administrator') return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', '監査整合性の確認には管理者権限が必要です。', requestId);
        const clinicalAudit = verifyAuditChain(store);
        const database = repository?.health ? await repository.health() : { healthy: true };
        const authenticationAudit = {
          ...(database.authAuditIntegrity || {}),
          source: database.authAuditIntegrity ? 'postgres' : 'shared-demo-audit-chain',
          valid: authenticationAuditHealthy && database.healthy !== false && (database.authAuditIntegrity?.valid ?? clinicalAudit.valid)
        };
        return sendJson(res, 200, { ...clinicalAudit, authenticationAudit });
      }
      if (req.method === 'GET' && pathname === '/api/v1/hospital/activities') {
        const moduleId = url.searchParams.get('moduleId'); const patientId = url.searchParams.get('patientId'); const status = url.searchParams.get('status');
        const items = visiblePatientItems(store.activities).filter((item) => (!moduleId || item.moduleId === moduleId) && (!patientId || item.patientId === patientId) && (!status || item.status === status));
        return sendJson(res, 200, { items, total: items.length });
      }
      if (req.method === 'POST' && pathname === '/api/v1/hospital/activities') {
        const body = await readBody(req); const missing = requireFields(body, ['moduleId', 'patientId', 'workType', 'title']);
        if (missing.length) return sendProblem(res, 422, 'EMR-HOSP-4220', 'Hospital activity validation failed', '部門業務の必須項目が不足しています。', requestId, missing);
        const module = hospitalModules.find((item) => item.id === body.moduleId);
        if (!module) return sendProblem(res, 422, 'EMR-HOSP-4221', 'Unknown module', '指定された部門はありません。', requestId);
        const patient = store.patients.find((item) => item.id === body.patientId);
        if (!patient) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const requestedAssignee = body.assignedStaffId || body.assignedTo;
        const assigned = requestedAssignee
          ? store.staffMembers.find((staff) => staff.active && (staff.id === body.assignedStaffId || staff.name === body.assignedTo))
          : (authenticatedPractitioner || store.staffMembers.find((staff) => staff.active));
        if (!assigned) return sendProblem(res, 422, 'EMR-HOSP-4222', 'Assigned staff not found', '指定された有効な担当職員が見つかりません。', requestId);
        if (body.assignedStaffId && body.assignedTo && (assigned.id !== body.assignedStaffId || assigned.name !== body.assignedTo)) return sendProblem(res, 422, 'EMR-HOSP-4223', 'Assigned staff mismatch', '担当職員IDと氏名が一致しません。', requestId);
        if (!module.workTypes.includes(body.workType)) return sendProblem(res, 422, 'EMR-HOSP-4224', 'Invalid work type', '業務種別が指定部門に属していません。', requestId);
        if (medicationExecutionModules.has(module.id)) {
          const role = requestRole(req, principal, runtimeConfig);
          if (!['physician', 'nurse'].includes(role)) return sendProblem(res, 403, 'EMR-RBAC-4033', 'Clinical activity role required', '注射・化学療法業務の登録は医師または看護師に限定されています。', requestId);
          if (assigned.role !== 'nurse') return sendProblem(res, 422, 'EMR-HOSP-4225', 'Nurse assignment required', '注射・化学療法の実施担当には有効な看護師を指定してください。', requestId);
        }
        const item = { id: makeId(`HOSP-${module.id.toUpperCase()}`), moduleId: module.id, patientId: patient.id, workType: body.workType, title: body.title, status: 'requested', priority: body.priority || 'routine', scheduledAt: body.scheduledAt || new Date().toISOString(), assignedStaffId: assigned.id, assignedTo: assigned.name, note: body.note || '', result: '', version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        store.activities.push(item); audit(store, { action: 'create', resourceType: `HospitalActivity/${module.id}`, resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, item, { Location: `/api/v1/hospital/activities/${item.id}` });
      }
      params = match(pathname, '/api/v1/hospital/activities/:id');
      if (req.method === 'PUT' && params) {
        const body = await readBody(req); const item = store.activities.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-HOSP-4040', 'Activity not found', '部門業務が見つかりません。', requestId);
        if (['completed', 'approved', 'cancelled'].includes(item.status)) return sendProblem(res, 409, 'EMR-HOSP-4091', 'Finalized activity', '完了・承認・取消済みの業務は更新できません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が更新しました。再読込してください。', requestId);
        let assigned = null;
        if (body.assignedStaffId !== undefined || body.assignedTo !== undefined) {
          assigned = store.staffMembers.find((staff) => staff.active
            && (body.assignedStaffId === undefined || staff.id === body.assignedStaffId)
            && (body.assignedTo === undefined || staff.name === body.assignedTo));
          if (!assigned) return sendProblem(res, 422, 'EMR-HOSP-4222', 'Assigned staff not found', '指定された有効な担当職員が見つかりません。', requestId);
        }
        if (medicationExecutionModules.has(item.moduleId)) {
          const role = requestRole(req, principal, runtimeConfig);
          const assignedStaffId = assigned?.id || item.assignedStaffId;
          if (!['physician', 'nurse'].includes(role)) return sendProblem(res, 403, 'EMR-RBAC-4033', 'Clinical activity role required', '注射・化学療法業務の更新は医師または担当看護師に限定されています。', requestId);
          if (role === 'nurse' && runtimeConfig.mode === 'production' && authenticatedPractitioner?.id !== item.assignedStaffId) return sendProblem(res, 403, 'EMR-ACTIVITY-ASSIGNEE-4030', 'Assigned nurse required', 'この業務に割り当てられた看護師だけが更新できます。', requestId);
          if (store.staffMembers.find((staff) => staff.id === assignedStaffId)?.role !== 'nurse') return sendProblem(res, 422, 'EMR-HOSP-4225', 'Nurse assignment required', '注射・化学療法の実施担当には有効な看護師を指定してください。', requestId);
        }
        ['title', 'priority', 'scheduledAt', 'note', 'result'].forEach((key) => { if (body[key] !== undefined) item[key] = body[key]; });
        if (assigned) { item.assignedStaffId = assigned.id; item.assignedTo = assigned.name; }
        item.version += 1; item.updatedAt = new Date().toISOString(); audit(store, { action: 'update', resourceType: `HospitalActivity/${item.moduleId}`, resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item, { ETag: `W/\"${item.version}\"` });
      }
      if (req.method === 'DELETE' && params) {
        const body = await readBody(req); const item = store.activities.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-HOSP-4040', 'Activity not found', '部門業務が見つかりません。', requestId);
        if (['completed', 'approved'].includes(item.status)) return sendProblem(res, 409, 'EMR-HOSP-4091', 'Finalized activity', '完了・承認済みの記録は削除できません。取消記録を追加してください。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が更新しました。再読込してください。', requestId);
        if (medicationExecutionModules.has(item.moduleId)) {
          const role = requestRole(req, principal, runtimeConfig);
          const assignedNurse = store.staffMembers.find((staff) => staff.id === item.assignedStaffId && staff.active && staff.role === 'nurse');
          const assignedActor = runtimeConfig.mode !== 'production' || authenticatedPractitioner?.id === assignedNurse?.id;
          if (!(role === 'physician' || (role === 'nurse' && assignedNurse && assignedActor))) return sendProblem(res, 403, 'EMR-ACTIVITY-ASSIGNEE-4030', 'Clinical cancellation forbidden', '注射・化学療法業務の取消は医師または担当看護師に限定されています。', requestId);
        }
        item.status = 'cancelled'; item.version += 1; item.updatedAt = new Date().toISOString();
        audit(store, { action: 'cancel', resourceType: `HospitalActivity/${item.moduleId}`, resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item);
      }
      params = match(pathname, '/api/v1/hospital/activities/:id/transition');
      if (req.method === 'POST' && params) {
        const body = await readBody(req); const item = store.activities.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-HOSP-4040', 'Activity not found', '部門業務が見つかりません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が更新しました。再読込してください。', requestId);
        if (!allowedTransitions(item.status).includes(body.status)) return sendProblem(res, 409, 'EMR-HOSP-4092', 'Invalid transition', `${item.status} から ${body.status} へは変更できません。`, requestId);
        if (medicationExecutionModules.has(item.moduleId)) {
          const role = requestRole(req, principal, runtimeConfig);
          const assignedNurse = store.staffMembers.find((staff) => staff.id === item.assignedStaffId && staff.active && staff.role === 'nurse');
          const assignedActor = runtimeConfig.mode !== 'production' || authenticatedPractitioner?.id === assignedNurse?.id;
          const assignedNurseAction = role === 'nurse' && assignedNurse && assignedActor && ['accepted', 'in-progress', 'completed', 'cancelled'].includes(body.status);
          const physicianOrderAction = role === 'physician' && ['accepted', 'approved', 'cancelled'].includes(body.status);
          if (!(assignedNurseAction || physicianOrderAction)) return sendProblem(res, 403, 'EMR-ACTIVITY-ASSIGNEE-4030', 'Assigned clinical staff required', '注射・化学療法の実施は担当看護師、指示確認・承認・取消は医師または担当看護師に限定されています。', requestId);
          if (body.status === 'in-progress') {
            const evidence = body.verificationEvidence || {};
            if (!evidence.verificationId || evidence.patientId !== item.patientId || evidence.orderId !== item.id
              || evidence.performerStaffId !== item.assignedStaffId || evidence.method !== 'barcode') {
              return sendProblem(res, 422, 'EMR-SAFE-4220', 'Persisted three point verification required', '患者・業務オーダ・担当看護師に紐づくバーコード照合証跡が必要です。', requestId);
            }
            item.barcodeVerification = { ...evidence, verifiedAt: new Date().toISOString(), recordedBySubject: principal.sub };
          }
          if (body.status === 'completed') {
            const evidence = item.barcodeVerification;
            if (!evidence || body.verificationId !== evidence.verificationId || evidence.patientId !== item.patientId
              || evidence.orderId !== item.id || evidence.performerStaffId !== item.assignedStaffId || evidence.method !== 'barcode') {
              return sendProblem(res, 422, 'EMR-SAFE-4220', 'Persisted three point verification required', '保存済みの患者・業務オーダ・担当看護師照合証跡を確認できません。', requestId);
            }
          }
        }
        item.status = body.status; if (body.result !== undefined) item.result = body.result;
        item.version += 1; item.updatedAt = new Date().toISOString();
        audit(store, { action: `transition:${body.status}`, resourceType: `HospitalActivity/${item.moduleId}`, resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, { ...item, nextStatuses: allowedTransitions(item.status) });
      }

      if (req.method === 'GET' && pathname === '/api/v1/hospital/beds') {
        const admissions = visiblePatientItems(store.admissions); const patientIds = new Set(admissions.map((item) => item.patientId));
        const items = runtimeConfig.mode !== 'production' || accessContext === 'system'
          ? store.beds
          : store.beds.map((bed) => bed.patientId && !patientIds.has(bed.patientId) ? { ...bed, patientId: null } : bed);
        return sendJson(res, 200, { items, admissions });
      }
      if (req.method === 'POST' && pathname === '/api/v1/hospital/admissions') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'bedId']);
        if (missing.length) return sendProblem(res, 422, 'EMR-ADM-4220', 'Admission validation failed', '患者と病床を指定してください。', requestId, missing);
        const bed = store.beds.find((item) => item.id === body.bedId); const patient = store.patients.find((item) => item.id === body.patientId);
        if (!bed || !patient) return sendProblem(res, 404, 'EMR-ADM-4040', 'Admission target not found', '患者または病床が見つかりません。', requestId);
        if (!['available', 'reserved'].includes(bed.status)) return sendProblem(res, 409, 'EMR-BED-4090', 'Bed unavailable', 'この病床には入院できません。', requestId);
        if (store.admissions.some((item) => item.patientId === patient.id && item.status === 'admitted')) return sendProblem(res, 409, 'EMR-ADM-4090', 'Already admitted', '患者は既に入院中です。', requestId);
        const admission = { id: makeId('ADM'), patientId: patient.id, bedId: bed.id, ward: bed.ward, status: 'admitted', admissionType: body.admissionType || 'planned', attendingPhysician: body.attendingPhysician || '佐藤 医師', carePath: body.carePath || '標準入院診療計画（架空）', broughtMedications: body.broughtMedications || '確認中', plannedDischargeAt: body.plannedDischargeAt || '', version: 1 };
        bed.status = 'occupied'; bed.patientId = patient.id; bed.admittedAt = new Date().toISOString(); bed.version += 1; store.admissions.push(admission);
        audit(store, { action: 'admit', resourceType: 'Admission', resourceId: admission.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, admission);
      }
      params = match(pathname, '/api/v1/hospital/admissions/:id/transfer');
      if (req.method === 'POST' && params) {
        const body = await readBody(req); const admission = store.admissions.find((item) => item.id === params.id && item.status === 'admitted');
        const target = store.beds.find((item) => item.id === body.bedId); const current = admission && store.beds.find((item) => item.id === admission.bedId);
        if (!admission || !target) return sendProblem(res, 404, 'EMR-ADM-4040', 'Admission target not found', '入院または移動先病床が見つかりません。', requestId);
        if (target.status !== 'available') return sendProblem(res, 409, 'EMR-BED-4090', 'Bed unavailable', '移動先病床は空床ではありません。', requestId);
        if (body.version !== admission.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が入院情報を更新しました。', requestId);
        if (current) { current.status = 'cleaning'; current.patientId = null; current.admittedAt = null; current.version += 1; }
        target.status = 'occupied'; target.patientId = admission.patientId; target.admittedAt = new Date().toISOString(); target.version += 1;
        admission.bedId = target.id; admission.ward = target.ward; admission.version += 1; admission.transferredAt = new Date().toISOString();
        audit(store, { action: 'transfer', resourceType: 'Admission', resourceId: admission.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, admission);
      }
      params = match(pathname, '/api/v1/hospital/admissions/:id/discharge');
      if (req.method === 'POST' && params) {
        const body = await readBody(req); const admission = store.admissions.find((item) => item.id === params.id && item.status === 'admitted');
        if (!admission) return sendProblem(res, 404, 'EMR-ADM-4040', 'Admission not found', '入院情報が見つかりません。', requestId);
        if (body.version !== admission.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が入院情報を更新しました。', requestId);
        const bed = store.beds.find((item) => item.id === admission.bedId); if (bed) { bed.status = 'cleaning'; bed.patientId = null; bed.admittedAt = null; bed.version += 1; }
        admission.status = 'discharged'; admission.dischargedAt = new Date().toISOString(); admission.dischargeSummary = body.dischargeSummary || '退院時サマリー作成済み（架空）'; admission.version += 1;
        audit(store, { action: 'discharge', resourceType: 'Admission', resourceId: admission.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, admission);
      }

      if (req.method === 'GET' && pathname === '/api/v1/hospital/nursing-records') {
        const patientId = url.searchParams.get('patientId'); return sendJson(res, 200, { items: visiblePatientItems(store.nursingRecords).filter((item) => !patientId || item.patientId === patientId) });
      }
      if (req.method === 'POST' && pathname === '/api/v1/hospital/nursing-records') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'type', 'title', 'content']);
        if (missing.length) return sendProblem(res, 422, 'EMR-NUR-4220', 'Nursing record validation failed', '看護記録の必須項目が不足しています。', requestId, missing);
        if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const admission = body.admissionId ? store.admissions.find((item) => item.id === body.admissionId) : null;
        if (body.admissionId && !admission) return sendProblem(res, 404, 'EMR-ADM-4040', 'Admission not found', '入院情報が見つかりません。', requestId);
        if (admission && admission.patientId !== body.patientId) return sendProblem(res, 409, 'EMR-ADM-4091', 'Admission patient mismatch', '入院情報は別の患者に属しています。', requestId);
        const author = runtimeConfig.mode === 'production' ? authenticatedPractitioner : store.staffMembers.find((item) => item.id === body.authorStaffId && item.role === 'nurse') || store.staffMembers.find((item) => item.role === 'nurse');
        const record = { id: makeId('NUR'), patientId: body.patientId, admissionId: body.admissionId || null, type: body.type, title: body.title, content: body.content, status: 'draft', author: author?.name || principal.sub, authorStaffId: author?.id || null, authorSubject: principal.sub, recordedAt: new Date().toISOString(), version: 1 };
        store.nursingRecords.push(record); audit(store, { action: 'create', resourceType: 'NursingRecord', resourceId: record.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, record);
      }
      params = match(pathname, '/api/v1/hospital/nursing-records/:id/sign');
      if (req.method === 'POST' && params) {
        const body = await readBody(req); const record = store.nursingRecords.find((item) => item.id === params.id);
        if (!record) return sendProblem(res, 404, 'EMR-NUR-4040', 'Nursing record not found', '看護記録が見つかりません。', requestId);
        if (record.status !== 'draft') return sendProblem(res, 409, 'EMR-NUR-4090', 'Nursing record is not signable', '下書き状態の看護記録だけを確定できます。', requestId);
        if (body.version !== record.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が看護記録を更新しました。', requestId);
        const signer = authenticatedPractitioner || store.staffMembers.find((item) => item.id === principal.practitioner_id)
          || (runtimeConfig.mode === 'demo' ? store.staffMembers.find((item) => item.id === record.authorStaffId) : null);
        const signerStaffId = signer?.id || principal.practitioner_id;
        const cosignAssignment = activeCosignAssignment(record, signerStaffId, body);
        if (signerStaffId !== record.authorStaffId && !cosignAssignment) return sendProblem(res, 403, 'EMR-SIGNER-4030', 'Author or delegated cosigner required', '記録者本人または事前登録された代行署名者だけが確定できます。', requestId);
        record.status = 'signed'; record.signedAt = new Date().toISOString(); record.version += 1;
        record.signedBy = signer?.name || principal.sub;
        record.signedByStaffId = signerStaffId;
        record.signedBySubject = principal.sub;
        if (cosignAssignment) {
          cosignAssignment.status = 'used'; cosignAssignment.usedAt = record.signedAt; cosignAssignment.usedBySubject = principal.sub;
          record.cosignReason = body.cosignReason; record.cosignAssignmentId = cosignAssignment.id;
        }
        audit(store, { action: 'sign', resourceType: 'NursingRecord', resourceId: record.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, record);
      }

      if (req.method === 'GET' && pathname === '/api/v1/hospital/advanced/overview') {
        const totals = Object.fromEntries(Object.entries(advancedCollections).map(([resource, key]) => [resource, visiblePatientItems(store[key]).length]));
        return sendJson(res, 200, {
          totals, completedLabsWithNumericResults: visiblePatientItems(store.labOrders).filter((item) => item.resultDetail).length,
          clinicalMasters: store.masters.length, inventoryLots: store.inventory.length,
          dataClassification: 'FICTIONAL_DEMO', persistence: 'in-memory'
        });
      }
      params = match(pathname, '/api/v1/hospital/advanced/:resource');
      if (req.method === 'GET' && params && advancedCollections[params.resource]) {
        const patientId = url.searchParams.get('patientId'); const status = url.searchParams.get('status');
        const items = visiblePatientItems(store[advancedCollections[params.resource]]).filter((item) => (!patientId || item.patientId === patientId) && (!status || item.status === status));
        return sendJson(res, 200, { items, total: items.length, dataClassification: 'FICTIONAL_DEMO' });
      }
      params = match(pathname, '/api/v1/hospital/advanced/medication-administrations/:id/transition');
      if (req.method === 'POST' && params) {
        const role = requestRole(req, principal, runtimeConfig);
        if (!['nurse', 'administrator'].includes(role)) return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', '薬剤実施は看護師または管理者ロールで操作してください。', requestId);
        const body = await readBody(req); const item = store.medicationAdministrations.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-MAR-4040', 'Medication administration not found', '薬剤実施記録が見つかりません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が薬剤実施記録を更新しました。', requestId);
        if (item.status !== 'scheduled' || body.status !== 'completed') return sendProblem(res, 409, 'EMR-MAR-4090', 'Invalid transition', `${item.status} から ${body.status} へは変更できません。`, requestId);
        const verified = body.barcodeVerification || {};
        if (!verified.patient || !verified.medication || !verified.staff) return sendProblem(res, 422, 'EMR-SAFE-4220', 'Three point verification required', '患者・薬剤・実施者の三点認証が必要です。', requestId);
        item.status = 'completed'; item.barcodeVerification = { ...verified, verifiedAt: new Date().toISOString() };
        item.administeredAt = new Date().toISOString(); item.version += 1;
        audit(store, { action: 'complete', resourceType: 'MedicationAdministration', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item, { ETag: `W/\"${item.version}\"` });
      }
      params = match(pathname, '/api/v1/hospital/advanced/surgical-cases/:id/transition');
      if (req.method === 'POST' && params) {
        const role = requestRole(req, principal, runtimeConfig);
        if (!['physician', 'administrator'].includes(role)) return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', '手術進行は医師または管理者ロールで操作してください。', requestId);
        const body = await readBody(req); const item = store.surgicalCases.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-SURG-4040', 'Surgical case not found', '手術記録が見つかりません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が手術記録を更新しました。', requestId);
        const next = { scheduled: 'in-progress', 'in-progress': 'completed' }[item.status];
        if (!next || body.status !== next) return sendProblem(res, 409, 'EMR-SURG-4090', 'Invalid transition', `${item.status} から ${body.status} へは変更できません。`, requestId);
        if (!item.checklist.patientIdentity || !item.checklist.procedureSite || !item.checklist.consent) return sendProblem(res, 422, 'EMR-SAFE-4221', 'Surgical checklist incomplete', '患者・術式部位・同意の確認が必要です。', requestId);
        item.status = next; item.updatedAt = new Date().toISOString(); item.version += 1;
        audit(store, { action: `transition:${next}`, resourceType: 'SurgicalCase', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item, { ETag: `W/\"${item.version}\"` });
      }
      params = match(pathname, '/api/v1/hospital/advanced/claims/:id/transition');
      if (req.method === 'POST' && params) {
        const role = requestRole(req, principal, runtimeConfig);
        if (!['clerk', 'administrator'].includes(role)) return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', 'レセプト送信は医事または管理者ロールで操作してください。', requestId);
        const body = await readBody(req); const item = store.claimSubmissions.find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-CLAIM-4040', 'Claim not found', 'レセプトが見つかりません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者がレセプトを更新しました。', requestId);
        if (!['ready', 'review-required'].includes(item.status) || body.status !== 'submitted') return sendProblem(res, 409, 'EMR-CLAIM-4090', 'Invalid transition', `${item.status} から ${body.status} へは変更できません。`, requestId);
        if (item.status === 'review-required' && body.resolved !== true) return sendProblem(res, 422, 'EMR-CLAIM-4220', 'Claim review required', '整合性エラーを解消してから送信してください。', requestId);
        if (durableDeliveryEnabled) {
          item.status = 'accepted-for-delivery'; item.queuedAt = new Date().toISOString(); item.response = '配信キュー受付済み（外部送信完了ではありません）'; item.version += 1;
          audit(store, { action: 'queue', resourceType: 'Claim', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
          return sendJson(res, 202, item, { ETag: `W/\"${item.version}\"` });
        }
        item.status = 'submitted'; item.submittedAt = new Date().toISOString(); item.response = '受付済み（ローカル模擬・外部送信なし）'; item.version += 1;
        audit(store, { action: 'submit-mock', resourceType: 'Claim', resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item, { ETag: `W/\"${item.version}\"` });
      }

      const adminCollections = { users: 'users', masters: 'masters', inventory: 'inventory', incidents: 'incidents', 'document-templates': 'documentTemplates', audit: 'auditEvents' };
      params = match(pathname, '/api/v1/hospital/admin/:resource');
      if (req.method === 'GET' && params && adminCollections[params.resource]) {
        const items = params.resource === 'incidents'
          ? visiblePatientItems(store[adminCollections[params.resource]])
          : store[adminCollections[params.resource]];
        return sendJson(res, 200, { items });
      }
      if (req.method === 'POST' && params && adminCollections[params.resource] && params.resource !== 'audit') {
        const role = requestRole(req, principal, runtimeConfig);
        if (role !== 'administrator' && !(role === 'nurse' && ['inventory', 'incidents'].includes(params.resource))) return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', 'この職種には管理情報を登録する権限がありません。', requestId);
        const body = await readBody(req); const collection = store[adminCollections[params.resource]];
        if (params.resource === 'incidents' && !store.patients.some((patient) => patient.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        if (body.id && collection.some((candidate) => candidate.id === body.id)) return sendProblem(res, 409, 'EMR-ADMIN-4090', 'Admin resource already exists', '同じ管理対象IDが既に登録されています。', requestId);
        const item = { id: body.id || makeId(params.resource.slice(0, 3).toUpperCase()), ...body, version: 1, createdAt: new Date().toISOString() };
        collection.push(item); audit(store, { action: 'create', resourceType: params.resource, resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 201, item);
      }
      params = match(pathname, '/api/v1/hospital/admin/:resource/:id');
      if (req.method === 'PUT' && params && adminCollections[params.resource] && params.resource !== 'audit') {
        const role = requestRole(req, principal, runtimeConfig);
        if (role !== 'administrator') return sendProblem(res, 403, 'EMR-RBAC-4030', 'Forbidden', '管理者権限が必要です。', requestId);
        const body = await readBody(req); const item = store[adminCollections[params.resource]].find((candidate) => candidate.id === params.id);
        if (!item) return sendProblem(res, 404, 'EMR-ADM-4041', 'Admin resource not found', '管理対象が見つかりません。', requestId);
        if (body.version !== item.version) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が管理対象を更新しました。', requestId);
        Object.entries(body).forEach(([key, value]) => { if (!['id', 'version', 'createdAt'].includes(key)) item[key] = value; }); item.version += 1; item.updatedAt = new Date().toISOString();
        audit(store, { action: 'update', resourceType: params.resource, resourceId: item.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, item);
      }

      if (req.method === 'GET' && pathname === '/api/v1/appointments') return sendJson(res, 200, { items: visiblePatientItems(store.appointments).filter((a) => !url.searchParams.get('patientId') || a.patientId === url.searchParams.get('patientId')).map((item) => ({ ...item, version: item.version || 1 })) });
      if (req.method === 'POST' && pathname === '/api/v1/appointments') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'startsAt', 'department']);
        if (missing.length) return sendProblem(res, 422, 'EMR-APT-4220', 'Appointment validation failed', '予約必須項目が不足しています。', requestId, missing);
        if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const appointment = { id: makeId('APT'), ...body, status: 'booked', version: 1, createdAt: new Date().toISOString() }; store.appointments.push(appointment); audit(store, { action: 'create', resourceType: 'Appointment', resourceId: appointment.id, practitionerId: principal.practitioner_id, requestId }); return sendJson(res, 201, appointment);
      }
      params = match(pathname, '/api/v1/appointments/:id');
      if (req.method === 'PUT' && params) {
        const body = await readBody(req); const appointment = store.appointments.find((item) => item.id === params.id);
        if (!appointment) return sendProblem(res, 404, 'EMR-APT-4040', 'Appointment not found', '予約が見つかりません。', requestId);
        if (['cancelled', 'completed'].includes(appointment.status)) return sendProblem(res, 409, 'EMR-APT-4090', 'Appointment finalized', '取消・完了済みの予約は更新できません。', requestId);
        if (body.version !== (appointment.version || 1)) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が予約を更新しました。', requestId);
        const nextStatuses = { booked: ['arrived', 'cancelled'], arrived: ['completed', 'cancelled'] }[appointment.status] || [];
        if (body.status !== undefined && body.status !== appointment.status && !nextStatuses.includes(body.status)) return sendProblem(res, 409, 'EMR-APT-4091', 'Invalid appointment transition', `${appointment.status} から ${body.status} へは変更できません。`, requestId);
        ['startsAt', 'department', 'status', 'note'].forEach((key) => { if (body[key] !== undefined) appointment[key] = body[key]; }); appointment.version = (appointment.version || 1) + 1; appointment.updatedAt = new Date().toISOString();
        audit(store, { action: 'update', resourceType: 'Appointment', resourceId: appointment.id, practitionerId: principal.practitioner_id, requestId });
        return sendJson(res, 200, appointment);
      }
      if (req.method === 'DELETE' && params) {
        const body = await readBody(req); const appointment = store.appointments.find((item) => item.id === params.id);
        if (!appointment) return sendProblem(res, 404, 'EMR-APT-4040', 'Appointment not found', '予約が見つかりません。', requestId);
        if (['cancelled', 'completed'].includes(appointment.status)) return sendProblem(res, 409, 'EMR-APT-4090', 'Appointment finalized', '取消・完了済みの予約は更新できません。', requestId);
        if (body.version !== (appointment.version || 1)) return sendProblem(res, 409, 'EMR-LOCK-4090', 'Version conflict', '他の利用者が予約を更新しました。', requestId);
        appointment.status = 'cancelled'; appointment.cancelledAt = new Date().toISOString(); appointment.version = (appointment.version || 1) + 1; audit(store, { action: 'cancel', resourceType: 'Appointment', resourceId: appointment.id, practitionerId: principal.practitioner_id, requestId }); return sendJson(res, 200, appointment);
      }
      if (req.method === 'POST' && pathname === '/api/v1/billing/charges') {
        const body = await readBody(req); const missing = requireFields(body, ['patientId', 'encounterId', 'items']);
        if (missing.length) return sendProblem(res, 422, 'EMR-BIL-4220', 'Billing validation failed', '会計連携必須項目が不足しています。', requestId, missing);
        if (!store.patients.some((item) => item.id === body.patientId)) return sendProblem(res, 404, 'EMR-PAT-4040', 'Patient not found', '患者が見つかりません。', requestId);
        const encounter = store.encounters.find((item) => item.id === body.encounterId);
        if (!encounter) return sendProblem(res, 404, 'EMR-ENC-4040', 'Encounter not found', '診療情報が見つかりません。', requestId);
        if (encounter.patientId !== body.patientId) return sendProblem(res, 409, 'EMR-ENC-4090', 'Encounter patient mismatch', '診療情報は別の患者に属しています。', requestId);
        const charge = { id: makeId('CHG'), ...body, status: 'queued', queuedAt: new Date().toISOString(), version: 1 }; store.billingCharges.push(charge); audit(store, { action: 'queue', resourceType: 'BillingCharge', resourceId: charge.id, practitionerId: principal.practitioner_id, requestId }); return sendJson(res, 202, charge);
      }

      if (req.method === 'GET' && pathname === '/fhir/r4/metadata') return sendJson(res, 200, capabilityStatement());
      if (req.method === 'GET' && pathname === '/fhir/r4/Patient') {
        const name = (url.searchParams.get('name') || '').toLowerCase();
        const patients = visiblePatients(store.patients).filter((patient) => !name
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
        const orders = visiblePatientItems(store.medicationRequests).filter((order) => !patientId || order.patientId === patientId);
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
        const labs = visiblePatientItems(store.labOrders).filter((item) => !patientId || item.patientId === patientId).map(observationResource);
        const vitals = visiblePatientItems(store.vitalSigns).filter((item) => !patientId || item.patientId === patientId).map(vitalSignResource);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: labs.length + vitals.length, entry: labs.concat(vitals).map((resource) => ({ resource })) });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/Condition') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, '');
        const conditions = visiblePatientItems(store.conditions).filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: conditions.length, entry: conditions.map((item) => ({ resource: conditionResource(item) })) });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/Encounter') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, '');
        const encounters = visiblePatientItems(store.encounters)
          .filter((item) => !patientId || item.patientId === patientId)
          .sort((left, right) => {
            const leftPriority = left.status === 'in-progress' ? 2 : left.classCode === 'IMP' ? 1 : 0;
            const rightPriority = right.status === 'in-progress' ? 2 : right.classCode === 'IMP' ? 1 : 0;
            return rightPriority - leftPriority || Date.parse(right.startedAt) - Date.parse(left.startedAt);
          });
        return sendJson(res, 200, {
          resourceType: 'Bundle', type: 'searchset', total: encounters.length,
          entry: encounters.map((item) => ({ resource: encounterResource(item) }))
        }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/ServiceRequest') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, '');
        const category = url.searchParams.get('category') || '';
        const plans = visiblePatientItems(store.rehabilitationPlans).filter((item) => (!patientId || item.patientId === patientId) && (!category || category === 'rehabilitation'));
        return sendJson(res, 200, {
          resourceType: 'Bundle', type: 'searchset', total: plans.length,
          entry: plans.map((item) => ({ resource: rehabilitationServiceRequestResource(item) }))
        }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      if (req.method === 'GET' && pathname === '/fhir/r4/Organization') {
        const resource = organizationResource(store.hospitalProfile);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: 1, entry: [{ resource }] }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/Organization/:id');
      if (req.method === 'GET' && params) return params.id === store.hospitalProfile.id ? sendJson(res, 200, organizationResource(store.hospitalProfile)) : sendJson(res, 404, operationOutcome('not-found', 'Organization not found'));
      if (req.method === 'GET' && pathname === '/fhir/r4/Practitioner') {
        const name = (url.searchParams.get('name') || '').toLowerCase(); const items = store.staffMembers.filter((item) => !name || item.name.toLowerCase().includes(name));
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: items.length, entry: items.map((item) => ({ resource: practitionerResource(item) })) }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/Practitioner/:id');
      if (req.method === 'GET' && params) { const item = store.staffMembers.find((candidate) => candidate.id === params.id); return item ? sendJson(res, 200, practitionerResource(item)) : sendJson(res, 404, operationOutcome('not-found', 'Practitioner not found')); }
      if (req.method === 'GET' && pathname === '/fhir/r4/CareTeam') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, ''); const items = visiblePatientItems(store.careTeams).filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: items.length, entry: items.map((item) => ({ resource: careTeamResource(item) })) }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/CareTeam/:id');
      if (req.method === 'GET' && params) { const item = store.careTeams.find((candidate) => candidate.id === params.id); return item ? sendJson(res, 200, careTeamResource(item)) : sendJson(res, 404, operationOutcome('not-found', 'CareTeam not found')); }
      if (req.method === 'GET' && pathname === '/fhir/r4/Consent') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, ''); const items = visiblePatientItems(store.patientConsents).filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: items.length, entry: items.map((item) => ({ resource: consentResource(item) })) }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/Consent/:id');
      if (req.method === 'GET' && params) { const item = store.patientConsents.find((candidate) => candidate.id === params.id); return item ? sendJson(res, 200, consentResource(item)) : sendJson(res, 404, operationOutcome('not-found', 'Consent not found')); }
      if (req.method === 'GET' && pathname === '/fhir/r4/DiagnosticReport') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, ''); const items = visiblePatientItems(store.imagingReports).filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: items.length, entry: items.map((item) => ({ resource: diagnosticReportResource(item) })) }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/DiagnosticReport/:id');
      if (req.method === 'GET' && params) { const item = store.imagingReports.find((candidate) => candidate.id === params.id); return item ? sendJson(res, 200, diagnosticReportResource(item)) : sendJson(res, 404, operationOutcome('not-found', 'DiagnosticReport not found')); }
      if (req.method === 'GET' && pathname === '/fhir/r4/MedicationAdministration') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, ''); const items = visiblePatientItems(store.medicationAdministrations).filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: items.length, entry: items.map((item) => ({ resource: medicationAdministrationResource(item) })) }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/MedicationAdministration/:id');
      if (req.method === 'GET' && params) { const item = store.medicationAdministrations.find((candidate) => candidate.id === params.id); return item ? sendJson(res, 200, medicationAdministrationResource(item)) : sendJson(res, 404, operationOutcome('not-found', 'MedicationAdministration not found')); }
      if (req.method === 'GET' && pathname === '/fhir/r4/Procedure') {
        const patientId = (url.searchParams.get('patient') || '').replace(/^Patient\//, ''); const items = visiblePatientItems(store.surgicalCases).filter((item) => !patientId || item.patientId === patientId);
        return sendJson(res, 200, { resourceType: 'Bundle', type: 'searchset', total: items.length, entry: items.map((item) => ({ resource: procedureResource(item) })) }, { 'Content-Type': 'application/fhir+json; charset=utf-8' });
      }
      params = match(pathname, '/fhir/r4/Procedure/:id');
      if (req.method === 'GET' && params) { const item = store.surgicalCases.find((candidate) => candidate.id === params.id); return item ? sendJson(res, 200, procedureResource(item)) : sendJson(res, 404, operationOutcome('not-found', 'Procedure not found')); }

      if (isApi) return pathname.startsWith('/fhir/r4') ? sendJson(res, 404, operationOutcome('not-found', 'Endpoint not found')) : sendProblem(res, 404, 'EMR-API-4040', 'Endpoint not found', '指定されたAPIはありません。', requestId);
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.setHeader('Allow', 'GET, HEAD');
        return sendProblem(res, 405, 'EMR-METHOD-4050', 'Method not allowed', 'この画面ではGETまたはHEADだけを利用できます。', requestId);
      }
      if (await serveStatic(pathname, res)) return;
      return sendProblem(res, 404, 'EMR-WEB-4040', 'Page not found', 'ページが見つかりません。', requestId);
    } catch (error) {
      const status = error.status || 500;
      const code = status === 400 ? 'EMR-JSON-4000' : status === 413 ? 'EMR-PAYLOAD-4130' : 'EMR-SRV-5000';
      return sendProblem(res, status, code, 'Request failed', error.status ? error.message : '処理中にエラーが発生しました。', requestId);
    }
  });
  server.beginDraining = () => { draining = true; };
  server.isDraining = () => draining;
  return server;
}

export function createGracefulShutdown({ server, repository = null, drainMs = 5000, timeoutMs = 30000, logger = console, terminate = (code) => process.exit(code) } = {}) {
  let started = false;
  let repositoryClosed = false;
  const closeRepository = async () => {
    if (repositoryClosed || !repository) return;
    repositoryClosed = true;
    await repository.close();
  };
  return (signal = 'SIGTERM') => {
    if (started) return false;
    started = true;
    server.beginDraining?.();
    logger.info?.(`Graceful shutdown started (${signal}); draining for ${drainMs}ms.`);
    const forceTimer = setTimeout(() => {
      logger.error?.(`Graceful shutdown exceeded ${timeoutMs}ms; terminating remaining connections.`);
      server.closeAllConnections?.();
      terminate(1);
    }, timeoutMs);
    forceTimer.unref?.();
    const drainTimer = setTimeout(() => {
      server.close(() => {
        void closeRepository()
          .then(() => clearTimeout(forceTimer))
          .catch((error) => {
            logger.error?.(`PostgreSQL shutdown failed: ${error.message}`);
            terminate(1);
          });
      });
    }, drainMs);
    drainTimer.unref?.();
    return true;
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = Number(process.env.PORT || 4173);
  const start = async () => {
    let runtimeConfig = loadRuntimeConfig();
    if (runtimeConfig.mode === 'production' && runtimeConfig.deploymentStage === 'public') runtimeConfig = applyPublicDeploymentGate(runtimeConfig, await assessProductionReadiness({ root }));
    let store = createStore(); let repository = null;
    if (runtimeConfig.persistence === 'postgres') ({ store, repository } = await createPostgresStore({ databaseUrl: runtimeConfig.databaseUrl, ssl: runtimeConfig.databaseSsl, tenantId: runtimeConfig.tenantId }));
    const host = runtimeConfig.mode === 'production' ? '0.0.0.0' : '127.0.0.1';
    const server = createAppServer({ store, runtimeConfig, repository });
    const displayUrl = runtimeConfig.mode === 'production' ? runtimeConfig.publicBaseUrl : `http://127.0.0.1:${port}`;
    server.listen(port, host, () => console.log(`eMedicalRecordMock running at ${displayUrl} (${runtimeConfig.mode}/${runtimeConfig.persistence})`));
    const shutdown = createGracefulShutdown({ server, repository, drainMs: runtimeConfig.shutdownDrainMs, timeoutMs: runtimeConfig.shutdownTimeoutMs });
    process.once('SIGTERM', () => shutdown('SIGTERM')); process.once('SIGINT', () => shutdown('SIGINT'));
  };
  start().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
