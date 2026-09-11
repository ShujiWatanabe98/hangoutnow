import pg from 'pg';
import { createHash } from 'node:crypto';
import { createStore } from './store.mjs';
import { assertSchemaCurrent } from './postgres-migrations.mjs';

const { Pool } = pg;
const stateKey = 'primary';

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

function deliveryError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function requireDeliveryText(value, field, maximum = 512) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum) {
    throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} must be non-empty and at most ${maximum} characters.`);
  }
  return value;
}

function requireSha256(value, field = 'fingerprint') {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) {
    throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} must be a lowercase SHA-256 hexadecimal digest.`);
  }
  return value;
}

function requirePlainObject(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} must be a JSON object.`);
  }
  return value;
}

function assertJsonSafe(value, field, seen = new WeakSet(), depth = 0) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains a non-finite number.`);
    return;
  }
  if (typeof value !== 'object') throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains a non-JSON value.`);
  if (depth > 40) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} exceeds the JSON nesting limit.`);
  if (seen.has(value)) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains a cyclic reference.`);
  seen.add(value);
  if (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains a non-plain object.`);
  }
  if (Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length !== value.length || keys.some((key, index) => key !== String(index))) {
      throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains a sparse or extended array.`);
    }
  }
  if (Object.getOwnPropertySymbols(value).length) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains symbol keys.`);
  for (const key of Object.keys(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains a prohibited key.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} contains an accessor.`);
    assertJsonSafe(descriptor.value, `${field}.${key}`, seen, depth + 1);
  }
  seen.delete(value);
}

function serializedJson(value, field, maximumBytes) {
  assertJsonSafe(value, field);
  const serialized = JSON.stringify(value);
  if (serialized === undefined || Buffer.byteLength(serialized, 'utf8') > maximumBytes) {
    throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} exceeds its ${maximumBytes}-byte JSON limit.`);
  }
  return serialized;
}

function safeReplayHeaders(headers) {
  requirePlainObject(headers, 'responseHeaders');
  const allowed = new Map([['content-type', 'content-type'], ['location', 'location'], ['etag', 'etag']]);
  const result = {};
  for (const [name, value] of Object.entries(headers)) {
    const normalized = String(name).toLowerCase();
    if (!allowed.has(normalized) || typeof value !== 'string' || value.length > 2000 || /[\r\n]/.test(value)) {
      throw deliveryError('EMR-IDEMPOTENCY-RESPONSE-UNSAFE', `Response header ${name} cannot be persisted for replay.`);
    }
    result[allowed.get(normalized)] = value;
  }
  if (result.location !== undefined
      && (!result.location.startsWith('/') || result.location.startsWith('//') || result.location.includes('\\'))) {
    throw deliveryError('EMR-IDEMPOTENCY-RESPONSE-UNSAFE', 'Replay Location must be a root-relative path.');
  }
  return result;
}

function requireDate(value, field, { future = false } = {}) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime()) || (future && date.getTime() <= Date.now())) {
    throw deliveryError('EMR-DELIVERY-INPUT-INVALID', `${field} must be ${future ? 'a future ' : 'a valid '}timestamp.`);
  }
  return date;
}

function deliveryRow(row) {
  if (!row) return null;
  return {
    ...row,
    attemptCount: row.attempt_count === undefined ? undefined : Number(row.attempt_count),
    responseStatus: row.response_status === undefined || row.response_status === null ? null : Number(row.response_status)
  };
}

const clinicalStatusTransitions = Object.freeze({
  draft: new Set(['draft', 'signed', 'entered-in-error']),
  signed: new Set(['amended', 'entered-in-error']),
  amended: new Set(['amended', 'entered-in-error']),
  'entered-in-error': new Set()
});

function clinicalConflict(code, record, message, existingVersion) {
  const error = new Error(message);
  error.code = code;
  error.recordId = record.record_id;
  error.recordVersion = Number(record.record_version);
  if (existingVersion !== undefined) error.existingVersion = Number(existingVersion);
  return error;
}

function sameInstant(left, right) {
  return Number.isFinite(Date.parse(left)) && Number.isFinite(Date.parse(right))
    && new Date(left).toISOString() === new Date(right).toISOString();
}

export function verifyAuthAuditRows(rows, { previousHash = null, priorCount = 0 } = {}) {
  for (const row of rows) {
    const storedPrevious = row.previous_hash ? String(row.previous_hash).trim() : null;
    if (storedPrevious !== previousHash) return { valid: false, count: priorCount + rows.length, eventId: row.event_id, reason: 'previous-hash-mismatch' };
    const payload = {
      eventId: row.event_id, recordedAt: new Date(row.recorded_at).toISOString(), action: row.action,
      subjectId: row.subject_id || null, practitionerId: row.practitioner_id || null,
      requestId: row.request_id, outcome: row.outcome, details: row.details || null,
      previousHash
    };
    const expected = createHash('sha256').update(stableJson(payload)).digest('hex');
    const actual = String(row.event_hash || '').trim();
    if (actual !== expected) return { valid: false, count: priorCount + rows.length, eventId: row.event_id, reason: 'event-hash-mismatch' };
    previousHash = actual;
  }
  return { valid: true, count: priorCount + rows.length, headHash: previousHash };
}

async function synchronizeProjections(client, store, version, tenantId) {
  const patients = store.patients.map((patient) => ({
    patient_id: patient.id, full_name: patient.name, kana: patient.kana, birth_date: patient.birthDate,
    gender: patient.gender, department: patient.department, encounter_status: patient.status,
    data_classification: patient.dataClassification, payload: patient
  }));
  const auditEvents = store.auditEvents.map((event) => ({
    event_id: event.id, recorded_at: event.recordedAt, action: event.action, resource_type: event.resourceType,
    resource_id: event.resourceId, practitioner_id: event.practitionerId, request_id: event.requestId,
    outcome: event.outcome, previous_hash: event.previousHash, integrity_hash: event.integrityHash, payload: event
  }));
  const encounters = store.encounters.map((encounter) => ({
    encounter_id: encounter.id, patient_id: encounter.patientId, department: encounter.department,
    status: encounter.status, class_code: encounter.classCode || null, started_at: encounter.startedAt,
    ended_at: encounter.endedAt || null, practitioner_id: encounter.practitionerId,
    data_classification: 'FICTIONAL_DEMO', payload: encounter
  }));
  const clinicalRecords = store.records.map((record) => ({
    record_id: record.id, patient_id: record.patientId, encounter_id: record.encounterId,
    occurred_at: record.occurredAt, department: record.department, author_name: record.author,
    author_staff_id: record.authorStaffId || null, status: record.status, record_version: record.version,
    signed_at: record.signedAt || null, signed_by: record.signedBy || null,
    signed_by_staff_id: record.signedByStaffId || null, signed_by_subject: record.signedBySubject || null,
    data_classification: 'FICTIONAL_DEMO', payload: record,
    payload_hash: createHash('sha256').update(stableJson(record)).digest('hex')
  }));
  const resources = Object.entries(store).flatMap(([collection_name, values]) => Array.isArray(values)
    ? values.filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && item.id).map((item) => ({
      collection_name,
      resource_id: item.id,
      patient_id: collection_name === 'patients' ? item.id : (typeof item.patientId === 'string' ? item.patientId : null),
      status: typeof item.status === 'string' ? item.status : null,
      data_classification: 'FICTIONAL_DEMO',
      payload: item
    }))
    : []);
  await client.query('DELETE FROM emr_patient_projection WHERE tenant_id = $1 AND NOT (patient_id = ANY($2::text[]))', [tenantId, patients.map((patient) => patient.patient_id)]);
  await client.query(`INSERT INTO emr_patient_projection
    (tenant_id, patient_id, full_name, kana, birth_date, gender, department, encounter_status, data_classification, state_version, payload, updated_at)
    SELECT $1, patient_id, full_name, kana, birth_date::date, gender, department, encounter_status, data_classification, $3, payload, now()
    FROM jsonb_to_recordset($2::jsonb) AS source(patient_id text, full_name text, kana text, birth_date text, gender text, department text, encounter_status text, data_classification text, payload jsonb)
    ON CONFLICT (tenant_id, patient_id) DO UPDATE SET
      full_name = EXCLUDED.full_name, kana = EXCLUDED.kana, birth_date = EXCLUDED.birth_date, gender = EXCLUDED.gender,
      department = EXCLUDED.department, encounter_status = EXCLUDED.encounter_status,
      data_classification = EXCLUDED.data_classification, state_version = EXCLUDED.state_version,
      payload = EXCLUDED.payload, updated_at = now()`, [tenantId, JSON.stringify(patients), version]);
  await client.query(`INSERT INTO emr_audit_event_projection
    (tenant_id, event_id, recorded_at, action, resource_type, resource_id, practitioner_id, request_id, outcome, previous_hash, integrity_hash, state_version, payload)
    SELECT $1, event_id, recorded_at::timestamptz, action, resource_type, resource_id, practitioner_id, request_id, outcome, previous_hash, integrity_hash, $3, payload
    FROM jsonb_to_recordset($2::jsonb) AS source(event_id text, recorded_at text, action text, resource_type text, resource_id text, practitioner_id text, request_id text, outcome text, previous_hash text, integrity_hash text, payload jsonb)
    ON CONFLICT (tenant_id, event_id) DO NOTHING`, [tenantId, JSON.stringify(auditEvents), version]);
  await client.query(`INSERT INTO emr_encounter_core
    (tenant_id, encounter_id, patient_id, department, status, class_code, started_at, ended_at, practitioner_id, data_classification, state_version, payload, updated_at)
    SELECT $1, encounter_id, patient_id, department, status, class_code, started_at::timestamptz, ended_at::timestamptz,
      practitioner_id, data_classification, $3, payload, now()
    FROM jsonb_to_recordset($2::jsonb) AS source(encounter_id text, patient_id text, department text, status text,
      class_code text, started_at text, ended_at text, practitioner_id text, data_classification text, payload jsonb)
    ON CONFLICT (tenant_id, encounter_id) DO UPDATE SET patient_id = EXCLUDED.patient_id,
      department = EXCLUDED.department, status = EXCLUDED.status, class_code = EXCLUDED.class_code,
      started_at = EXCLUDED.started_at, ended_at = EXCLUDED.ended_at, practitioner_id = EXCLUDED.practitioner_id,
      data_classification = EXCLUDED.data_classification, state_version = EXCLUDED.state_version,
      payload = EXCLUDED.payload, updated_at = now()`, [tenantId, JSON.stringify(encounters), version]);
  const currentClinicalRecords = clinicalRecords.length ? await client.query(`SELECT record_id, patient_id, encounter_id,
      occurred_at, author_staff_id, status, record_version, payload_hash
    FROM emr_clinical_record_core
    WHERE tenant_id = $1 AND record_id = ANY($2::text[])
    FOR UPDATE`, [tenantId, clinicalRecords.map((record) => record.record_id)]) : { rows: [] };
  const currentClinicalRecordById = new Map(currentClinicalRecords.rows.map((record) => [record.record_id, record]));
  for (const record of clinicalRecords) {
    const current = currentClinicalRecordById.get(record.record_id);
    if (!current) continue;
    const immutableIdentityChanged = current.patient_id !== record.patient_id
      || current.encounter_id !== record.encounter_id
      || current.author_staff_id !== record.author_staff_id
      || !sameInstant(current.occurred_at, record.occurred_at);
    if (immutableIdentityChanged) {
      throw clinicalConflict('EMR-CLINICAL-IDENTITY-CONFLICT', record,
        `Clinical record ${record.record_id} immutable identity does not match its persisted version.`, current.record_version);
    }
    const currentVersion = Number(current.record_version);
    if (record.record_version === currentVersion) {
      if (record.payload_hash !== String(current.payload_hash).trim()) {
        throw clinicalConflict('EMR-CLINICAL-VERSION-CONFLICT', record,
          `Clinical record ${record.record_id} version ${record.record_version} has already been persisted with different content.`, currentVersion);
      }
      continue;
    }
    if (record.record_version !== currentVersion + 1) {
      throw clinicalConflict('EMR-CLINICAL-VERSION-CONFLICT', record,
        `Clinical record ${record.record_id} must advance exactly one version from ${currentVersion}.`, currentVersion);
    }
    if (!clinicalStatusTransitions[current.status]?.has(record.status)) {
      throw clinicalConflict('EMR-CLINICAL-VERSION-CONFLICT', record,
        `Clinical record ${record.record_id} cannot transition from ${current.status} to ${record.status}.`, currentVersion);
    }
  }
  const revisionConflict = await client.query(`SELECT source.record_id, source.record_version
    FROM jsonb_to_recordset($2::jsonb) AS source(record_id text, record_version integer, payload_hash text)
    JOIN emr_clinical_record_revision revision
      ON revision.tenant_id = $1 AND revision.record_id = source.record_id AND revision.record_version = source.record_version
    WHERE revision.payload_hash <> source.payload_hash
    LIMIT 1`, [tenantId, JSON.stringify(clinicalRecords)]);
  if (revisionConflict.rowCount) {
    const conflict = revisionConflict.rows[0];
    const error = new Error(`Clinical record ${conflict.record_id} version ${conflict.record_version} has already been persisted with different content.`);
    error.code = 'EMR-CLINICAL-VERSION-CONFLICT';
    error.recordId = conflict.record_id;
    error.recordVersion = Number(conflict.record_version);
    throw error;
  }
  await client.query(`INSERT INTO emr_clinical_record_core
    (tenant_id, record_id, patient_id, encounter_id, occurred_at, department, author_name, author_staff_id,
      status, record_version, signed_at, signed_by, signed_by_staff_id, signed_by_subject,
      data_classification, state_version, payload, payload_hash, updated_at)
    SELECT $1, record_id, patient_id, encounter_id, occurred_at::timestamptz, department, author_name, author_staff_id,
      status, record_version, signed_at::timestamptz, signed_by, signed_by_staff_id, signed_by_subject,
      data_classification, $3, payload, payload_hash, now()
    FROM jsonb_to_recordset($2::jsonb) AS source(record_id text, patient_id text, encounter_id text, occurred_at text,
      department text, author_name text, author_staff_id text, status text, record_version integer, signed_at text,
      signed_by text, signed_by_staff_id text, signed_by_subject text, data_classification text, payload jsonb, payload_hash text)
    ON CONFLICT (tenant_id, record_id) DO UPDATE SET patient_id = EXCLUDED.patient_id,
      encounter_id = EXCLUDED.encounter_id, occurred_at = EXCLUDED.occurred_at, department = EXCLUDED.department,
      author_name = EXCLUDED.author_name, author_staff_id = EXCLUDED.author_staff_id, status = EXCLUDED.status,
      record_version = EXCLUDED.record_version, signed_at = EXCLUDED.signed_at, signed_by = EXCLUDED.signed_by,
      signed_by_staff_id = EXCLUDED.signed_by_staff_id, signed_by_subject = EXCLUDED.signed_by_subject,
      data_classification = EXCLUDED.data_classification, state_version = EXCLUDED.state_version,
      payload = EXCLUDED.payload, payload_hash = EXCLUDED.payload_hash, updated_at = now()`,
  [tenantId, JSON.stringify(clinicalRecords), version]);
  await client.query(`INSERT INTO emr_clinical_record_revision
    (tenant_id, record_id, record_version, patient_id, encounter_id, status, recorded_at, payload, payload_hash, state_version)
    SELECT $1, record_id, record_version, patient_id, encounter_id, status, now(), payload, payload_hash, $3
    FROM jsonb_to_recordset($2::jsonb) AS source(record_id text, record_version integer, patient_id text,
      encounter_id text, status text, payload jsonb, payload_hash text)
    ON CONFLICT (tenant_id, record_id, record_version) DO NOTHING`,
  [tenantId, JSON.stringify(clinicalRecords), version]);
  await client.query('DELETE FROM emr_resource_projection WHERE tenant_id = $1', [tenantId]);
  await client.query(`INSERT INTO emr_resource_projection
    (tenant_id, collection_name, resource_id, patient_id, status, data_classification, state_version, payload, updated_at)
    SELECT $1, collection_name, resource_id, patient_id, status, data_classification, $3, payload, now()
    FROM jsonb_to_recordset($2::jsonb) AS source(collection_name text, resource_id text, patient_id text, status text, data_classification text, payload jsonb)`,
  [tenantId, JSON.stringify(resources), version]);
}

export function validateStoreShape(store) {
  if (store && store.breakGlassGrants === undefined) store.breakGlassGrants = [];
  if (store && store.idempotencyRecords === undefined) store.idempotencyRecords = [];
  const required = ['patients', 'encounters', 'records', 'medicationRequests', 'labOrders', 'auditEvents', 'breakGlassGrants', 'idempotencyRecords', 'staffMembers'];
  const missing = required.filter((name) => !Array.isArray(store?.[name]));
  if (missing.length) throw new Error(`Invalid persisted EMR state: missing collections ${missing.join(', ')}`);
  const fail = (message) => {
    const error = new Error(`Invalid persisted EMR state: ${message}`);
    error.code = 'EMR-PERSISTED-STATE-INVALID';
    throw error;
  };
  const uniqueIndex = (collection, label) => {
    const index = new Map();
    for (const item of collection) {
      if (!item || typeof item.id !== 'string' || !item.id.trim()) fail(`${label} contains an invalid ID`);
      if (index.has(item.id)) fail(`${label} contains duplicate ID ${item.id}`);
      index.set(item.id, item);
    }
    return index;
  };
  const patients = uniqueIndex(store.patients, 'patients');
  const encounters = uniqueIndex(store.encounters, 'encounters');
  const staffMembers = uniqueIndex(store.staffMembers, 'staffMembers');
  uniqueIndex(store.records, 'records');
  const activePhysician = (staffId) => {
    const staff = staffMembers.get(staffId);
    return staff && staff.active === true && staff.role === 'physician' ? staff : null;
  };
  for (const encounter of store.encounters) {
    if (!patients.has(encounter.patientId)) fail(`encounter ${encounter.id} references unknown patient ${encounter.patientId}`);
    if (!['in-progress', 'finished'].includes(encounter.status)) fail(`encounter ${encounter.id} has invalid status`);
    if (typeof encounter.department !== 'string' || !encounter.department.trim()) fail(`encounter ${encounter.id} has invalid department`);
    if (typeof encounter.practitionerId !== 'string' || !encounter.practitionerId.trim()) fail(`encounter ${encounter.id} has invalid practitionerId`);
    if (!activePhysician(encounter.practitionerId)) fail(`encounter ${encounter.id} practitionerId must reference an active physician`);
    if (!Number.isFinite(Date.parse(encounter.startedAt))) fail(`encounter ${encounter.id} has invalid startedAt`);
    if (encounter.endedAt && (!Number.isFinite(Date.parse(encounter.endedAt)) || Date.parse(encounter.endedAt) < Date.parse(encounter.startedAt))) fail(`encounter ${encounter.id} has invalid endedAt`);
  }
  for (const record of store.records) {
    const encounter = encounters.get(record.encounterId);
    if (!patients.has(record.patientId)) fail(`record ${record.id} references unknown patient ${record.patientId}`);
    if (!encounter) fail(`record ${record.id} references unknown encounter ${record.encounterId}`);
    if (encounter.patientId !== record.patientId) fail(`record ${record.id} and encounter ${record.encounterId} reference different patients`);
    if (!Number.isInteger(record.version) || record.version < 1) fail(`record ${record.id} has invalid version`);
    if (!['draft', 'signed', 'amended', 'entered-in-error'].includes(record.status)) fail(`record ${record.id} has invalid status`);
    if (typeof record.department !== 'string' || !record.department.trim()) fail(`record ${record.id} has invalid department`);
    if (typeof record.author !== 'string' || !record.author.trim()) fail(`record ${record.id} has invalid author`);
    if (typeof record.authorStaffId !== 'string' || !record.authorStaffId.trim()) fail(`record ${record.id} has invalid authorStaffId`);
    if (!activePhysician(record.authorStaffId)) fail(`record ${record.id} authorStaffId must reference an active physician`);
    if (!record.soap || ['subjective', 'objective', 'assessment', 'plan'].some((field) => typeof record.soap[field] !== 'string' || !record.soap[field].trim())) fail(`record ${record.id} has invalid SOAP content`);
    if (!Number.isFinite(Date.parse(record.occurredAt))) fail(`record ${record.id} has invalid occurredAt`);
    if (Date.parse(record.occurredAt) < Date.parse(encounter.startedAt)
        || (encounter.endedAt && Date.parse(record.occurredAt) > Date.parse(encounter.endedAt))) {
      fail(`record ${record.id} occurred outside encounter ${encounter.id}`);
    }
    if ((record.status === 'draft') === Boolean(record.signedAt)) fail(`record ${record.id} has inconsistent signature state`);
    if (record.signedAt && !Number.isFinite(Date.parse(record.signedAt))) fail(`record ${record.id} has invalid signedAt`);
    if (record.status !== 'draft') {
      if (typeof record.signedBy !== 'string' || !record.signedBy.trim()
          || typeof record.signedByStaffId !== 'string' || !record.signedByStaffId.trim()
          || typeof record.signedBySubject !== 'string' || !record.signedBySubject.trim()) {
        fail(`record ${record.id} has incomplete signature metadata`);
      }
      const signer = activePhysician(record.signedByStaffId);
      if (!signer) fail(`record ${record.id} signedByStaffId must reference an active physician`);
      if (record.signedBy !== signer.name) fail(`record ${record.id} signedBy does not match signedByStaffId`);
      if (Date.parse(record.signedAt) < Date.parse(record.occurredAt)) fail(`record ${record.id} was signed before it occurred`);
    }
  }
  return store;
}

export class PostgresStoreRepository {
  constructor(pool, { tenantId = 'TENANT-DEMO', authAuditDeepCheckIntervalMs = 300_000, authAuditStatementTimeoutMs = 2000, deliveryStatementTimeoutMs = 5000, deliveryLockTimeoutMs = 2000 } = {}) {
    if (!/^[A-Z0-9][A-Z0-9_-]{2,63}$/.test(tenantId)) throw new Error('Invalid EMR tenant ID.');
    if (!Number.isInteger(authAuditDeepCheckIntervalMs) || authAuditDeepCheckIntervalMs < 0 || authAuditDeepCheckIntervalMs > 3_600_000) throw new Error('Invalid authentication audit deep-check interval.');
    if (!Number.isInteger(authAuditStatementTimeoutMs) || authAuditStatementTimeoutMs < 100 || authAuditStatementTimeoutMs > 10_000) throw new Error('Invalid authentication audit statement timeout.');
    if (!Number.isInteger(deliveryStatementTimeoutMs) || deliveryStatementTimeoutMs < 500 || deliveryStatementTimeoutMs > 30_000) throw new Error('Invalid delivery statement timeout.');
    if (!Number.isInteger(deliveryLockTimeoutMs) || deliveryLockTimeoutMs < 100 || deliveryLockTimeoutMs > deliveryStatementTimeoutMs) throw new Error('Invalid delivery lock timeout.');
    this.pool = pool;
    this.tenantId = tenantId;
    this.version = 0;
    this.saveQueue = Promise.resolve();
    this.authAuditIntegrityCache = null;
    this.authAuditDeepCheckIntervalMs = authAuditDeepCheckIntervalMs;
    this.authAuditStatementTimeoutMs = authAuditStatementTimeoutMs;
    this.deliveryStatementTimeoutMs = deliveryStatementTimeoutMs;
    this.deliveryLockTimeoutMs = deliveryLockTimeoutMs;
  }

  async initialize(seedStore = createStore()) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await assertSchemaCurrent(client);
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`emedical-record-mock:${this.tenantId}:${stateKey}`]);
      let result = await client.query('SELECT version, payload FROM emr_runtime_state WHERE tenant_id = $1 AND state_key = $2 FOR UPDATE', [this.tenantId, stateKey]);
      if (!result.rowCount) {
        validateStoreShape(seedStore);
        result = await client.query('INSERT INTO emr_runtime_state (tenant_id, state_key, version, payload, audit_head_hash) VALUES ($1, $2, 1, $3::jsonb, $4) RETURNING version, payload', [this.tenantId, stateKey, JSON.stringify(seedStore), seedStore.auditEvents.at(-1)?.integrityHash || null]);
      }
      const loadedStore = validateStoreShape(typeof result.rows[0].payload === 'string' ? JSON.parse(result.rows[0].payload) : result.rows[0].payload);
      await synchronizeProjections(client, loadedStore, Number(result.rows[0].version), this.tenantId);
      await client.query('COMMIT');
      this.version = Number(result.rows[0].version);
      return loadedStore;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  }

  async save(store, delivery = null) {
    const run = async () => {
      validateStoreShape(store);
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        await client.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
        if (delivery) {
          await client.query("SELECT set_config('statement_timeout', $1, true)", [String(this.deliveryStatementTimeoutMs)]);
          await client.query("SELECT set_config('lock_timeout', $1, true)", [String(this.deliveryLockTimeoutMs)]);
          const reservation = await this.reserveIdempotencyReceipt(client, delivery.receipt);
          if (reservation.replayed) {
            await client.query('COMMIT');
            return {
              replayed: true,
              response: {
                status: reservation.receipt.responseStatus,
                headers: reservation.receipt.response_headers,
                body: reservation.receipt.response_body
              }
            };
          }
        }
        const result = await client.query(`UPDATE emr_runtime_state
          SET payload = $1::jsonb, audit_head_hash = $2, version = version + 1, updated_at = now()
          WHERE tenant_id = $3 AND state_key = $4 AND version = $5 RETURNING version`, [JSON.stringify(store), store.auditEvents.at(-1)?.integrityHash || null, this.tenantId, stateKey, this.version]);
        if (!result.rowCount) {
          const error = new Error('Persisted EMR state was updated by another instance. Reload is required.');
          error.code = 'EMR-PERSISTENCE-CONFLICT';
          throw error;
        }
        const nextVersion = Number(result.rows[0].version);
        await synchronizeProjections(client, store, nextVersion, this.tenantId);
        let completedReceipt = null;
        if (delivery) {
          for (const event of delivery.outboxEvents || []) await this.enqueueOutbox(client, event);
          completedReceipt = await this.completeIdempotencyReceipt(client, {
            receiptId: delivery.receipt.receiptId,
            responseStatus: delivery.response.status,
            responseHeaders: delivery.response.headers,
            responseBody: delivery.response.body
          });
        }
        await client.query('COMMIT');
        this.version = nextVersion;
        return delivery ? {
          replayed: false,
          version: this.version,
          response: {
            status: completedReceipt.responseStatus,
            headers: completedReceipt.response_headers,
            body: completedReceipt.response_body
          }
        } : this.version;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => {});
        throw error;
      } finally {
        client.release();
      }
    };
    this.saveQueue = this.saveQueue.catch(() => {}).then(run);
    return this.saveQueue;
  }

  async reload() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
      const result = await client.query('SELECT version, payload FROM emr_runtime_state WHERE tenant_id = $1 AND state_key = $2', [this.tenantId, stateKey]);
      if (!result.rowCount) {
        const error = new Error('Persisted EMR state is missing.'); error.code = 'EMR-PERSISTENCE-MISSING'; throw error;
      }
      await client.query('COMMIT');
      this.version = Number(result.rows[0].version);
      return validateStoreShape(typeof result.rows[0].payload === 'string' ? JSON.parse(result.rows[0].payload) : result.rows[0].payload);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async health() {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
      await client.query("SELECT set_config('statement_timeout', $1, true)", [String(this.authAuditStatementTimeoutMs)]);
      await client.query('SELECT 1');
      const now = Date.now();
      const deepCheck = !this.authAuditIntegrityCache?.valid || now >= this.authAuditIntegrityCache.nextDeepCheckAt;
      const rows = (await client.query(`SELECT sequence, event_id, recorded_at, action, subject_id, practitioner_id,
        request_id, outcome, details, previous_hash, event_hash
        FROM emr_auth_audit_event WHERE tenant_id = $1${deepCheck ? '' : ' AND sequence > $2'} ORDER BY sequence`,
      deepCheck ? [this.tenantId] : [this.tenantId, this.authAuditIntegrityCache.lastSequence])).rows;
      await client.query('COMMIT');
      const authAuditIntegrity = verifyAuthAuditRows(rows, deepCheck ? {} : {
        previousHash: this.authAuditIntegrityCache.headHash,
        priorCount: this.authAuditIntegrityCache.count
      });
      if (authAuditIntegrity.valid) {
        this.authAuditIntegrityCache = {
          ...authAuditIntegrity,
          lastSequence: Number(rows.at(-1)?.sequence ?? (deepCheck ? 0 : this.authAuditIntegrityCache.lastSequence)),
          nextDeepCheckAt: deepCheck ? now + this.authAuditDeepCheckIntervalMs : this.authAuditIntegrityCache.nextDeepCheckAt,
          verificationMode: deepCheck ? 'deep' : 'incremental'
        };
      } else this.authAuditIntegrityCache = null;
      return { healthy: authAuditIntegrity.valid, adapter: 'postgres', tenantId: this.tenantId, version: this.version, authAuditIntegrity };
    }
    catch (error) { await client.query('ROLLBACK').catch(() => {}); return { healthy: false, adapter: 'postgres', error: error.code || 'database-unavailable' }; }
    finally { client.release(); }
  }

  async authStateQuery(callback) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
      await client.query('DELETE FROM emr_auth_state WHERE tenant_id = $1 AND expires_at <= now()', [this.tenantId]);
      const result = await callback(client);
      await client.query('COMMIT'); return result;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; }
    finally { client.release(); }
  }

  async putAuthState(kind, opaqueId, ciphertext, expiresAt) {
    const keyHash = createHash('sha256').update(opaqueId).digest('base64url');
    return this.authStateQuery((client) => client.query(`INSERT INTO emr_auth_state (tenant_id, state_kind, key_hash, ciphertext, expires_at)
      VALUES ($1, $2, $3, $4, $5) ON CONFLICT (tenant_id, state_kind, key_hash)
      DO UPDATE SET ciphertext = EXCLUDED.ciphertext, expires_at = EXCLUDED.expires_at`, [this.tenantId, kind, keyHash, ciphertext, new Date(expiresAt)]));
  }

  async getAuthState(kind, opaqueId) {
    const keyHash = createHash('sha256').update(opaqueId).digest('base64url');
    const result = await this.authStateQuery((client) => client.query('SELECT ciphertext FROM emr_auth_state WHERE tenant_id = $1 AND state_kind = $2 AND key_hash = $3 AND expires_at > now()', [this.tenantId, kind, keyHash]));
    return result.rows[0]?.ciphertext || null;
  }

  async takeAuthState(kind, opaqueId) {
    const keyHash = createHash('sha256').update(opaqueId).digest('base64url');
    const result = await this.authStateQuery((client) => client.query('DELETE FROM emr_auth_state WHERE tenant_id = $1 AND state_kind = $2 AND key_hash = $3 AND expires_at > now() RETURNING ciphertext', [this.tenantId, kind, keyHash]));
    return result.rows[0]?.ciphertext || null;
  }

  async deleteAuthState(kind, opaqueId) {
    const keyHash = createHash('sha256').update(opaqueId).digest('base64url');
    await this.authStateQuery((client) => client.query('DELETE FROM emr_auth_state WHERE tenant_id = $1 AND state_kind = $2 AND key_hash = $3', [this.tenantId, kind, keyHash]));
  }

  async appendAuthAudit(event) {
    const client = await this.pool.connect();
    try {
      const recordedAt = new Date(event.recordedAt).toISOString();
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`emedical-record-mock:${this.tenantId}:auth-audit`]);
      const previous = await client.query('SELECT event_hash FROM emr_auth_audit_event WHERE tenant_id = $1 ORDER BY sequence DESC LIMIT 1', [this.tenantId]);
      const previousHash = previous.rows[0]?.event_hash || null;
      const payload = {
        eventId: event.id, recordedAt, action: event.action,
        subjectId: event.resourceId || null, practitionerId: event.practitionerId || null,
        requestId: event.requestId, outcome: event.outcome || 'success', details: event.details || null,
        previousHash
      };
      const eventHash = createHash('sha256').update(stableJson(payload)).digest('hex');
      const result = await client.query(`INSERT INTO emr_auth_audit_event
        (tenant_id, event_id, recorded_at, action, subject_id, practitioner_id, request_id, outcome, details, previous_hash, event_hash)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11) RETURNING sequence`,
      [this.tenantId, event.id, recordedAt, event.action, event.resourceId || null, event.practitionerId || null, event.requestId, event.outcome || 'success', JSON.stringify(event.details || null), previousHash, eventHash]);
      await client.query('COMMIT');
      return { ...event, sequence: Number(result.rows[0].sequence), previousHash, eventHash };
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async withDeliveryTransaction(callback) {
    if (typeof callback !== 'function') throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'A transaction callback is required.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query("SELECT set_config('app.tenant_id', $1, true)", [this.tenantId]);
      await client.query("SELECT set_config('statement_timeout', $1, true)", [String(this.deliveryStatementTimeoutMs)]);
      await client.query("SELECT set_config('lock_timeout', $1, true)", [String(this.deliveryLockTimeoutMs)]);
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally { client.release(); }
  }

  async lookupIdempotencyReceipt({ receiptId, operation, requestFingerprint }) {
    requireDeliveryText(receiptId, 'receiptId');
    requireDeliveryText(operation, 'operation', 200);
    requireSha256(requestFingerprint, 'requestFingerprint');
    return this.withDeliveryTransaction(async (client) => {
      const row = (await client.query(`SELECT * FROM emr_idempotency_receipt
        WHERE tenant_id = $1 AND receipt_id = $2 AND expires_at > now()`, [this.tenantId, receiptId])).rows[0];
      if (!row) return null;
      if (row.operation !== operation || String(row.request_fingerprint).trim() !== requestFingerprint) {
        throw deliveryError('EMR-IDEMPOTENCY-FINGERPRINT-CONFLICT', 'The idempotency key was already used for a different request.', { receiptId });
      }
      const receipt = deliveryRow(row);
      return row.state === 'completed' ? {
        state: 'completed',
        response: { status: receipt.responseStatus, headers: receipt.response_headers, body: receipt.response_body }
      } : { state: row.state };
    });
  }

  async reserveIdempotencyReceipt(client, { receiptId, operation, requestFingerprint, expiresAt }) {
    requireDeliveryText(receiptId, 'receiptId');
    requireDeliveryText(operation, 'operation', 200);
    requireSha256(requestFingerprint, 'requestFingerprint');
    const expiry = requireDate(expiresAt, 'expiresAt', { future: true });
    const inserted = await client.query(`INSERT INTO emr_idempotency_receipt
      (tenant_id, receipt_id, operation, request_fingerprint, state, expires_at)
      VALUES ($1, $2, $3, $4, 'processing', $5)
      ON CONFLICT (tenant_id, receipt_id) DO UPDATE SET operation = EXCLUDED.operation,
        request_fingerprint = EXCLUDED.request_fingerprint, state = 'processing', response_status = NULL,
        response_headers = NULL, response_body = NULL, created_at = now(), updated_at = now(), expires_at = EXCLUDED.expires_at
      WHERE emr_idempotency_receipt.expires_at <= now() RETURNING *`,
    [this.tenantId, receiptId, operation, requestFingerprint, expiry]);
    const row = inserted.rows[0] || (await client.query(`SELECT * FROM emr_idempotency_receipt
      WHERE tenant_id = $1 AND receipt_id = $2 FOR UPDATE`, [this.tenantId, receiptId])).rows[0];
    if (!row) throw deliveryError('EMR-IDEMPOTENCY-RECEIPT-MISSING', 'Idempotency receipt disappeared while it was being reserved.');
    if (row.operation !== operation || String(row.request_fingerprint).trim() !== requestFingerprint) {
      throw deliveryError('EMR-IDEMPOTENCY-FINGERPRINT-CONFLICT', 'The idempotency key was already used for a different request.', { receiptId });
    }
    return { acquired: Boolean(inserted.rowCount), replayed: row.state === 'completed', receipt: deliveryRow(row) };
  }

  async completeIdempotencyReceipt(client, { receiptId, responseStatus, responseHeaders = {}, responseBody }) {
    requireDeliveryText(receiptId, 'receiptId');
    if (!Number.isInteger(responseStatus) || responseStatus < 200 || responseStatus > 299) {
      throw deliveryError('EMR-IDEMPOTENCY-RESPONSE-UNSAFE', 'Only committed 2xx responses may be persisted for replay.');
    }
    const replayHeaders = safeReplayHeaders(responseHeaders);
    const serializedHeaders = serializedJson(replayHeaders, 'responseHeaders', 16_384);
    const serializedBody = serializedJson(responseBody, 'responseBody', 1_048_576);
    if (responseBody === undefined) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'responseBody is required.');
    const result = await client.query(`UPDATE emr_idempotency_receipt SET state = 'completed',
      response_status = $3, response_headers = $4::jsonb, response_body = $5::jsonb, updated_at = now()
      WHERE tenant_id = $1 AND receipt_id = $2 AND state = 'processing' RETURNING *`,
    [this.tenantId, receiptId, responseStatus, serializedHeaders, serializedBody]);
    if (!result.rowCount) throw deliveryError('EMR-IDEMPOTENCY-STATE-CONFLICT', 'The idempotency receipt is not in processing state.', { receiptId });
    return deliveryRow(result.rows[0]);
  }

  async executeIdempotent({ receiptId, operation, requestFingerprint, expiresAt }, callback) {
    if (typeof callback !== 'function') throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'An idempotent command callback is required.');
    return this.withDeliveryTransaction(async (client) => {
      const reservation = await this.reserveIdempotencyReceipt(client, { receiptId, operation, requestFingerprint, expiresAt });
      if (reservation.replayed) {
        return { replayed: true, response: {
          status: reservation.receipt.responseStatus,
          headers: reservation.receipt.response_headers,
          body: reservation.receipt.response_body
        } };
      }
      const response = await callback(client);
      if (!response || typeof response !== 'object') throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'The idempotent command must return a response object.');
      const completed = await this.completeIdempotencyReceipt(client, {
        receiptId, responseStatus: response.status, responseHeaders: response.headers || {}, responseBody: response.body
      });
      return { replayed: false, response: { status: completed.responseStatus, headers: completed.response_headers, body: completed.response_body } };
    });
  }

  async enqueueOutbox(client, { eventId, topic, aggregateType, aggregateId, payload, headers = {}, availableAt = new Date() }) {
    requireDeliveryText(eventId, 'eventId');
    requireDeliveryText(topic, 'topic', 200);
    requireDeliveryText(aggregateType, 'aggregateType', 200);
    requireDeliveryText(aggregateId, 'aggregateId');
    requirePlainObject(payload, 'payload');
    requirePlainObject(headers, 'headers');
    const serializedPayload = serializedJson(payload, 'payload', 1_048_576);
    const serializedHeaders = serializedJson(headers, 'headers', 16_384);
    const due = requireDate(availableAt, 'availableAt');
    const result = await client.query(`INSERT INTO emr_outbox_event
      (tenant_id, event_id, topic, aggregate_type, aggregate_id, payload, headers, available_at)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
      ON CONFLICT (tenant_id, event_id) DO NOTHING RETURNING *`,
    [this.tenantId, eventId, topic, aggregateType, aggregateId, serializedPayload, serializedHeaders, due]);
    if (result.rowCount) return deliveryRow(result.rows[0]);
    const existing = (await client.query('SELECT * FROM emr_outbox_event WHERE tenant_id = $1 AND event_id = $2 FOR UPDATE', [this.tenantId, eventId])).rows[0];
    if (!existing || existing.topic !== topic || existing.aggregate_type !== aggregateType || existing.aggregate_id !== aggregateId
        || stableJson(existing.payload) !== stableJson(payload) || stableJson(existing.headers) !== stableJson(headers)) {
      throw deliveryError('EMR-OUTBOX-EVENT-CONFLICT', 'The outbox event ID was already used for different content.', { eventId });
    }
    return deliveryRow(existing);
  }

  async claimOutbox({ workerId, limit = 25, leaseMs = 30_000, maxAttempts = 10 } = {}) {
    requireDeliveryText(workerId, 'workerId', 200);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'limit must be from 1 through 100.');
    if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300_000) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'leaseMs must be from 1000 through 300000.');
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'maxAttempts must be from 1 through 100.');
    return this.withDeliveryTransaction(async (client) => {
      await client.query(`UPDATE emr_outbox_event SET
        state = CASE WHEN attempt_count >= $2 THEN 'dead' ELSE 'pending' END,
        lease_owner = NULL, lease_expires_at = NULL,
        available_at = CASE WHEN attempt_count >= $2 THEN available_at ELSE LEAST(available_at, now()) END,
        last_error = CASE WHEN attempt_count >= $2 THEN 'lease-expired-max-attempts' ELSE last_error END,
        dead_at = CASE WHEN attempt_count >= $2 THEN now() ELSE NULL END,
        updated_at = now()
        WHERE tenant_id = $1 AND state = 'in_flight' AND lease_expires_at <= now()`, [this.tenantId, maxAttempts]);
      const result = await client.query(`WITH candidates AS (
          SELECT event_id FROM emr_outbox_event WHERE tenant_id = $1 AND state = 'pending'
            AND attempt_count < $5 AND available_at <= now()
          ORDER BY available_at, created_at, event_id FOR UPDATE SKIP LOCKED LIMIT $2
        )
        UPDATE emr_outbox_event event SET state = 'in_flight', attempt_count = event.attempt_count + 1,
          lease_owner = $3, lease_expires_at = now() + ($4::integer * interval '1 millisecond'), updated_at = now()
        FROM candidates WHERE event.tenant_id = $1 AND event.event_id = candidates.event_id RETURNING event.*`,
      [this.tenantId, limit, workerId, leaseMs, maxAttempts]);
      return result.rows.map(deliveryRow);
    });
  }

  async extendOutboxLease({ eventId, workerId, leaseMs = 30_000 }) {
    requireDeliveryText(eventId, 'eventId');
    requireDeliveryText(workerId, 'workerId', 200);
    if (!Number.isInteger(leaseMs) || leaseMs < 1000 || leaseMs > 300_000) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'leaseMs must be from 1000 through 300000.');
    return this.withDeliveryTransaction(async (client) => {
      const result = await client.query(`UPDATE emr_outbox_event
        SET lease_expires_at = now() + ($4::integer * interval '1 millisecond'), updated_at = now()
        WHERE tenant_id = $1 AND event_id = $2 AND state = 'in_flight' AND lease_owner = $3
          AND lease_expires_at > now() RETURNING lease_expires_at`, [this.tenantId, eventId, workerId, leaseMs]);
      if (!result.rowCount) throw deliveryError('EMR-OUTBOX-LEASE-LOST', 'The outbox lease is no longer owned by this worker.', { eventId });
      return result.rows[0];
    });
  }

  async acknowledgeOutbox({ eventId, workerId }) {
    requireDeliveryText(eventId, 'eventId');
    requireDeliveryText(workerId, 'workerId', 200);
    return this.withDeliveryTransaction(async (client) => {
      const result = await client.query(`UPDATE emr_outbox_event SET state = 'published', published_at = now(),
        lease_owner = NULL, lease_expires_at = NULL, last_error = NULL, updated_at = now()
        WHERE tenant_id = $1 AND event_id = $2 AND state = 'in_flight' AND lease_owner = $3
          AND lease_expires_at > now() RETURNING *`, [this.tenantId, eventId, workerId]);
      if (!result.rowCount) throw deliveryError('EMR-OUTBOX-LEASE-LOST', 'The outbox lease is no longer owned by this worker.', { eventId });
      return deliveryRow(result.rows[0]);
    });
  }

  async failOutbox({ eventId, workerId, error, retryDelayMs = 1000, maxAttempts = 10, terminal = false }) {
    requireDeliveryText(eventId, 'eventId');
    requireDeliveryText(workerId, 'workerId', 200);
    if (!Number.isInteger(retryDelayMs) || retryDelayMs < 0 || retryDelayMs > 86_400_000) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'retryDelayMs is outside its safety bound.');
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 100) throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'maxAttempts must be from 1 through 100.');
    const errorCode = typeof error?.code === 'string' && /^[A-Za-z0-9_.:-]{1,120}$/.test(error.code)
      ? error.code : 'publisher-failure';
    return this.withDeliveryTransaction(async (client) => {
      const result = await client.query(`UPDATE emr_outbox_event SET
          state = CASE WHEN $7::boolean OR attempt_count >= $4 THEN 'dead' ELSE 'pending' END,
          available_at = CASE WHEN $7::boolean OR attempt_count >= $4 THEN available_at ELSE now() + ($5::integer * interval '1 millisecond') END,
          lease_owner = NULL, lease_expires_at = NULL, last_error = $6,
          dead_at = CASE WHEN $7::boolean OR attempt_count >= $4 THEN now() ELSE NULL END, updated_at = now()
        WHERE tenant_id = $1 AND event_id = $2 AND state = 'in_flight' AND lease_owner = $3
          AND lease_expires_at > now() RETURNING *`, [this.tenantId, eventId, workerId, maxAttempts, retryDelayMs, errorCode, terminal]);
      if (!result.rowCount) throw deliveryError('EMR-OUTBOX-LEASE-LOST', 'The outbox lease is no longer owned by this worker.', { eventId });
      return deliveryRow(result.rows[0]);
    });
  }

  async receiveInboxMessage(client, { source, messageId, payloadHash, payload }) {
    requireDeliveryText(source, 'source', 200);
    requireDeliveryText(messageId, 'messageId');
    requireSha256(payloadHash, 'payloadHash');
    requirePlainObject(payload, 'payload');
    const serializedPayload = serializedJson(payload, 'payload', 1_048_576);
    const canonicalPayload = JSON.parse(serializedPayload);
    const calculatedHash = createHash('sha256').update(stableJson(canonicalPayload)).digest('hex');
    if (payloadHash !== calculatedHash) throw deliveryError('EMR-INBOX-HASH-MISMATCH', 'payloadHash does not match the canonical payload.', { source, messageId });
    const inserted = await client.query(`INSERT INTO emr_inbox_message
      (tenant_id, source, message_id, payload_hash, payload) VALUES ($1, $2, $3, $4, $5::jsonb)
      ON CONFLICT (tenant_id, source, message_id) DO NOTHING RETURNING *`,
    [this.tenantId, source, messageId, calculatedHash, serializedPayload]);
    const row = inserted.rows[0] || (await client.query(`SELECT * FROM emr_inbox_message
      WHERE tenant_id = $1 AND source = $2 AND message_id = $3 FOR UPDATE`, [this.tenantId, source, messageId])).rows[0];
    if (!row) throw deliveryError('EMR-INBOX-MESSAGE-MISSING', 'Inbox message disappeared while it was being received.');
    if (String(row.payload_hash).trim() !== calculatedHash) {
      throw deliveryError('EMR-INBOX-HASH-CONFLICT', 'The inbox message ID was already used for different content.', { source, messageId });
    }
    return { acquired: Boolean(inserted.rowCount), duplicate: !inserted.rowCount, processed: row.state === 'processed', message: deliveryRow(row) };
  }

  async markInboxProcessed(client, { source, messageId }) {
    requireDeliveryText(source, 'source', 200);
    requireDeliveryText(messageId, 'messageId');
    const result = await client.query(`UPDATE emr_inbox_message SET state = 'processed', processed_at = now()
      WHERE tenant_id = $1 AND source = $2 AND message_id = $3 AND state = 'received' RETURNING *`,
    [this.tenantId, source, messageId]);
    if (!result.rowCount) throw deliveryError('EMR-INBOX-STATE-CONFLICT', 'Inbox message is missing or already processed.', { source, messageId });
    return deliveryRow(result.rows[0]);
  }

  async processInboxMessage({ source, messageId, payloadHash, payload }, callback) {
    if (typeof callback !== 'function') throw deliveryError('EMR-DELIVERY-INPUT-INVALID', 'An inbox processing callback is required.');
    return this.withDeliveryTransaction(async (client) => {
      const received = await this.receiveInboxMessage(client, { source, messageId, payloadHash, payload });
      if (received.processed) return { duplicate: true, processed: false };
      const result = await callback(client);
      await this.markInboxProcessed(client, { source, messageId });
      return { duplicate: received.duplicate, processed: true, result };
    });
  }

  async deliveryHealth() {
    return this.withDeliveryTransaction(async (client) => {
      const result = await client.query(`SELECT
        count(*) FILTER (WHERE state = 'pending' AND available_at <= now())::integer AS pending_due,
        count(*) FILTER (WHERE state = 'in_flight')::integer AS in_flight,
        count(*) FILTER (WHERE state = 'in_flight' AND lease_expires_at <= now())::integer AS expired_leases,
        count(*) FILTER (WHERE state = 'dead')::integer AS dead,
        min(available_at) FILTER (WHERE state = 'pending') AS next_available_at
        FROM emr_outbox_event WHERE tenant_id = $1`, [this.tenantId]);
      const receipts = await client.query(`SELECT
        count(*) FILTER (WHERE state = 'processing')::integer AS processing_receipts,
        count(*) FILTER (WHERE expires_at <= now())::integer AS expired_receipts
        FROM emr_idempotency_receipt WHERE tenant_id = $1`, [this.tenantId]);
      return { ...result.rows[0], ...receipts.rows[0] };
    });
  }

  async close() { await this.pool.end(); }
}

export async function createPostgresStore({ databaseUrl, ssl = false, pool, tenantId = 'TENANT-DEMO' } = {}) {
  if (!pool && !databaseUrl) throw new Error('EMR_DATABASE_URL is required for PostgreSQL persistence.');
  const resolvedPool = pool || new Pool({ connectionString: databaseUrl, ssl: ssl ? { rejectUnauthorized: true } : false, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  const repository = new PostgresStoreRepository(resolvedPool, { tenantId });
  try {
    const store = await repository.initialize(createStore());
    return { store, repository };
  } catch (error) {
    if (!pool) await resolvedPool.end().catch(() => {});
    throw error;
  }
}

export async function createPostgresDeliveryRepository({ databaseUrl, ssl = false, pool, tenantId = 'TENANT-DEMO' } = {}) {
  if (!pool && !databaseUrl) throw new Error('EMR_DATABASE_URL is required for PostgreSQL delivery.');
  const resolvedPool = pool || new Pool({ connectionString: databaseUrl, ssl: ssl ? { rejectUnauthorized: true } : false, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 10_000 });
  const repository = new PostgresStoreRepository(resolvedPool, { tenantId });
  const client = await resolvedPool.connect();
  try {
    await client.query('BEGIN');
    await assertSchemaCurrent(client);
    await client.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    await client.query('SELECT 1 FROM emr_outbox_event WHERE tenant_id = $1 LIMIT 1', [tenantId]);
    await client.query('COMMIT');
    return repository;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (!pool) await resolvedPool.end().catch(() => {});
    throw error;
  } finally { client.release(); }
}
