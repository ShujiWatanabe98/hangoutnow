import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const migrationFilePattern = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const migrationLockName = 'emedical-record-mock-schema-migration-v2';
const runtimeRolePattern = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const runtimeTables = [
  { name: 'emr_runtime_state', primaryKey: 'PRIMARY KEY (tenant_id, state_key)', permissions: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'emr_patient_projection', primaryKey: 'PRIMARY KEY (tenant_id, patient_id)', permissions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'emr_audit_event_projection', primaryKey: 'PRIMARY KEY (tenant_id, event_id)', permissions: ['SELECT', 'INSERT'] },
  { name: 'emr_auth_state', primaryKey: 'PRIMARY KEY (tenant_id, state_kind, key_hash)', permissions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'emr_auth_audit_event', primaryKey: 'PRIMARY KEY (tenant_id, event_id)', permissions: ['SELECT', 'INSERT'] },
  { name: 'emr_resource_projection', primaryKey: 'PRIMARY KEY (tenant_id, collection_name, resource_id)', permissions: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] },
  { name: 'emr_encounter_core', primaryKey: 'PRIMARY KEY (tenant_id, encounter_id)', permissions: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'emr_clinical_record_core', primaryKey: 'PRIMARY KEY (tenant_id, record_id)', permissions: ['SELECT', 'INSERT', 'UPDATE'] },
  { name: 'emr_clinical_record_revision', primaryKey: 'PRIMARY KEY (tenant_id, record_id, record_version)', permissions: ['SELECT', 'INSERT'] }
  ,{ name: 'emr_idempotency_receipt', primaryKey: 'PRIMARY KEY (tenant_id, receipt_id)', permissions: ['SELECT', 'INSERT', 'UPDATE'] }
  ,{ name: 'emr_outbox_event', primaryKey: 'PRIMARY KEY (tenant_id, event_id)', permissions: ['SELECT', 'INSERT', 'UPDATE'] }
  ,{ name: 'emr_inbox_message', primaryKey: 'PRIMARY KEY (tenant_id, source, message_id)', permissions: ['SELECT', 'INSERT', 'UPDATE'] }
];
export const deliveryConstraints = [
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_expiry_check', 'CHECK (expires_at > created_at)'],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_body_size_check', 'CHECK (octet_length(response_body::text) <= 1048576)'],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_headers_size_check', 'CHECK (octet_length(response_headers::text) <= 16384)'],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_fingerprint_check', "CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')"],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_id_check', "CHECK (btrim(receipt_id) <> '')"],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_operation_check', "CHECK (btrim(operation) <> '')"],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_pkey', 'PRIMARY KEY (tenant_id, receipt_id)'],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_response_check', "CHECK (state = 'processing' AND response_status IS NULL AND response_headers IS NULL AND response_body IS NULL OR state = 'completed' AND response_status >= 200 AND response_status <= 299 AND jsonb_typeof(response_headers) = 'object' AND response_body IS NOT NULL)"],
  ['emr_idempotency_receipt', 'emr_idempotency_receipt_state_check', "CHECK (state = ANY (ARRAY['processing', 'completed']))"],
  ['emr_outbox_event', 'emr_outbox_event_aggregate_id_check', "CHECK (btrim(aggregate_id) <> '')"],
  ['emr_outbox_event', 'emr_outbox_event_aggregate_type_check', "CHECK (btrim(aggregate_type) <> '')"],
  ['emr_outbox_event', 'emr_outbox_event_attempt_check', 'CHECK (attempt_count >= 0)'],
  ['emr_outbox_event', 'emr_outbox_event_headers_check', "CHECK (jsonb_typeof(headers) = 'object')"],
  ['emr_outbox_event', 'emr_outbox_event_headers_size_check', 'CHECK (octet_length(headers::text) <= 16384)'],
  ['emr_outbox_event', 'emr_outbox_event_id_check', "CHECK (btrim(event_id) <> '')"],
  ['emr_outbox_event', 'emr_outbox_event_lease_check', "CHECK (state = 'in_flight' AND btrim(lease_owner) <> '' AND lease_expires_at IS NOT NULL AND published_at IS NULL OR state <> 'in_flight' AND lease_owner IS NULL AND lease_expires_at IS NULL)"],
  ['emr_outbox_event', 'emr_outbox_event_payload_check', "CHECK (jsonb_typeof(payload) = 'object')"],
  ['emr_outbox_event', 'emr_outbox_event_payload_size_check', 'CHECK (octet_length(payload::text) <= 1048576)'],
  ['emr_outbox_event', 'emr_outbox_event_pkey', 'PRIMARY KEY (tenant_id, event_id)'],
  ['emr_outbox_event', 'emr_outbox_event_publish_check', "CHECK (state = 'published' AND published_at IS NOT NULL OR state <> 'published' AND published_at IS NULL)"],
  ['emr_outbox_event', 'emr_outbox_event_state_check', "CHECK (state = ANY (ARRAY['pending', 'in_flight', 'published', 'dead']))"],
  ['emr_outbox_event', 'emr_outbox_event_topic_check', "CHECK (btrim(topic) <> '')"],
  ['emr_outbox_event', 'emr_outbox_event_dead_check', "CHECK (state = 'dead' AND dead_at IS NOT NULL OR state <> 'dead' AND dead_at IS NULL)"],
  ['emr_inbox_message', 'emr_inbox_message_hash_check', "CHECK (payload_hash ~ '^[0-9a-f]{64}$')"],
  ['emr_inbox_message', 'emr_inbox_message_id_check', "CHECK (btrim(message_id) <> '')"],
  ['emr_inbox_message', 'emr_inbox_message_payload_check', "CHECK (jsonb_typeof(payload) = 'object')"],
  ['emr_inbox_message', 'emr_inbox_message_payload_size_check', 'CHECK (octet_length(payload::text) <= 1048576)'],
  ['emr_inbox_message', 'emr_inbox_message_pkey', 'PRIMARY KEY (tenant_id, source, message_id)'],
  ['emr_inbox_message', 'emr_inbox_message_processed_check', "CHECK (state = 'received' AND processed_at IS NULL OR state = 'processed' AND processed_at IS NOT NULL)"],
  ['emr_inbox_message', 'emr_inbox_message_source_check', "CHECK (btrim(source) <> '')"],
  ['emr_inbox_message', 'emr_inbox_message_state_check', "CHECK (state = ANY (ARRAY['received', 'processed']))"]
];
export const deliveryColumns = [
  ['emr_idempotency_receipt', 'tenant_id', 'text', true], ['emr_idempotency_receipt', 'receipt_id', 'text', true],
  ['emr_idempotency_receipt', 'operation', 'text', true], ['emr_idempotency_receipt', 'request_fingerprint', 'character(64)', true],
  ['emr_idempotency_receipt', 'state', 'text', true], ['emr_idempotency_receipt', 'response_status', 'integer', false],
  ['emr_idempotency_receipt', 'response_headers', 'jsonb', false], ['emr_idempotency_receipt', 'response_body', 'jsonb', false],
  ['emr_idempotency_receipt', 'created_at', 'timestamp with time zone', true], ['emr_idempotency_receipt', 'updated_at', 'timestamp with time zone', true],
  ['emr_idempotency_receipt', 'expires_at', 'timestamp with time zone', true],
  ['emr_outbox_event', 'tenant_id', 'text', true], ['emr_outbox_event', 'event_id', 'text', true],
  ['emr_outbox_event', 'topic', 'text', true], ['emr_outbox_event', 'aggregate_type', 'text', true],
  ['emr_outbox_event', 'aggregate_id', 'text', true], ['emr_outbox_event', 'payload', 'jsonb', true],
  ['emr_outbox_event', 'headers', 'jsonb', true], ['emr_outbox_event', 'state', 'text', true],
  ['emr_outbox_event', 'attempt_count', 'integer', true], ['emr_outbox_event', 'available_at', 'timestamp with time zone', true],
  ['emr_outbox_event', 'lease_owner', 'text', false], ['emr_outbox_event', 'lease_expires_at', 'timestamp with time zone', false],
  ['emr_outbox_event', 'published_at', 'timestamp with time zone', false], ['emr_outbox_event', 'last_error', 'text', false],
  ['emr_outbox_event', 'dead_at', 'timestamp with time zone', false],
  ['emr_outbox_event', 'created_at', 'timestamp with time zone', true], ['emr_outbox_event', 'updated_at', 'timestamp with time zone', true],
  ['emr_inbox_message', 'tenant_id', 'text', true], ['emr_inbox_message', 'source', 'text', true],
  ['emr_inbox_message', 'message_id', 'text', true], ['emr_inbox_message', 'payload_hash', 'character(64)', true],
  ['emr_inbox_message', 'payload', 'jsonb', true], ['emr_inbox_message', 'state', 'text', true],
  ['emr_inbox_message', 'received_at', 'timestamp with time zone', true], ['emr_inbox_message', 'processed_at', 'timestamp with time zone', false]
];
export const deliveryIndexes = [
  ['emr_idempotency_receipt_expiry_idx', 'CREATE INDEX emr_idempotency_receipt_expiry_idx ON public.emr_idempotency_receipt USING btree (tenant_id, expires_at)'],
  ['emr_outbox_event_due_idx', "CREATE INDEX emr_outbox_event_due_idx ON public.emr_outbox_event USING btree (tenant_id, available_at, created_at) WHERE (state = 'pending')"],
  ['emr_outbox_event_lease_expiry_idx', "CREATE INDEX emr_outbox_event_lease_expiry_idx ON public.emr_outbox_event USING btree (tenant_id, lease_expires_at) WHERE (state = 'in_flight')"]
];
const configuredDeliveryDefaults = new Map([
  ['emr_idempotency_receipt', 'created_at', 'now()'], ['emr_idempotency_receipt', 'updated_at', 'now()'],
  ['emr_outbox_event', 'headers', "'{}'::jsonb"], ['emr_outbox_event', 'state', "'pending'::text"],
  ['emr_outbox_event', 'attempt_count', '0'], ['emr_outbox_event', 'available_at', 'now()'],
  ['emr_outbox_event', 'created_at', 'now()'], ['emr_outbox_event', 'updated_at', 'now()'],
  ['emr_inbox_message', 'state', "'received'::text"], ['emr_inbox_message', 'received_at', 'now()']
].map(([table, column, value]) => [`${table}:${column}`, value]));
export const deliveryDefaults = deliveryColumns.map(([table, column]) => [
  table, column, configuredDeliveryDefaults.get(`${table}:${column}`) ?? null
]);
export const typedClinicalConstraints = [
  ['emr_encounter_core', 'emr_encounter_core_id_check', "CHECK (btrim(encounter_id) <> '')"],
  ['emr_encounter_core', 'emr_encounter_core_patient_id_check', "CHECK (btrim(patient_id) <> '')"],
  ['emr_encounter_core', 'emr_encounter_core_department_check', "CHECK (btrim(department) <> '')"],
  ['emr_encounter_core', 'emr_encounter_core_status_check', "CHECK (status = ANY (ARRAY['in-progress', 'finished']))"],
  ['emr_encounter_core', 'emr_encounter_core_practitioner_check', "CHECK (btrim(practitioner_id) <> '')"],
  ['emr_encounter_core', 'emr_encounter_core_classification_check', "CHECK (data_classification = 'FICTIONAL_DEMO')"],
  ['emr_encounter_core', 'emr_encounter_core_state_version_check', 'CHECK (state_version >= 1)'],
  ['emr_encounter_core', 'emr_encounter_core_payload_check', "CHECK (jsonb_typeof(payload) = 'object')"],
  ['emr_encounter_core', 'emr_encounter_core_pkey', 'PRIMARY KEY (tenant_id, encounter_id)'],
  ['emr_encounter_core', 'emr_encounter_core_tenant_id_patient_id_encounter_id_key', 'UNIQUE (tenant_id, patient_id, encounter_id)'],
  ['emr_encounter_core', 'emr_encounter_core_patient_fk', 'FOREIGN KEY (tenant_id, patient_id) REFERENCES emr_patient_projection(tenant_id, patient_id) ON DELETE RESTRICT'],
  ['emr_encounter_core', 'emr_encounter_core_period_check', 'CHECK (ended_at IS NULL OR ended_at >= started_at)'],
  ['emr_clinical_record_core', 'emr_clinical_record_core_id_check', "CHECK (btrim(record_id) <> '')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_patient_id_check', "CHECK (btrim(patient_id) <> '')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_encounter_id_check', "CHECK (btrim(encounter_id) <> '')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_department_check', "CHECK (btrim(department) <> '')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_author_check', "CHECK (btrim(author_name) <> '')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_author_staff_check', "CHECK (btrim(author_staff_id) <> '')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_status_check', "CHECK (status = ANY (ARRAY['draft', 'signed', 'amended', 'entered-in-error']))"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_record_version_check', 'CHECK (record_version >= 1)'],
  ['emr_clinical_record_core', 'emr_clinical_record_core_classification_check', "CHECK (data_classification = 'FICTIONAL_DEMO')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_state_version_check', 'CHECK (state_version >= 1)'],
  ['emr_clinical_record_core', 'emr_clinical_record_core_payload_check', "CHECK (jsonb_typeof(payload) = 'object')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_hash_check', "CHECK (payload_hash ~ '^[0-9a-f]{64}$')"],
  ['emr_clinical_record_core', 'emr_clinical_record_core_pkey', 'PRIMARY KEY (tenant_id, record_id)'],
  ['emr_clinical_record_core', 'emr_clinical_record_core_patient_fk', 'FOREIGN KEY (tenant_id, patient_id) REFERENCES emr_patient_projection(tenant_id, patient_id) ON DELETE RESTRICT'],
  ['emr_clinical_record_core', 'emr_clinical_record_core_encounter_fk', 'FOREIGN KEY (tenant_id, patient_id, encounter_id) REFERENCES emr_encounter_core(tenant_id, patient_id, encounter_id) ON DELETE RESTRICT'],
  ['emr_clinical_record_core', 'emr_clinical_record_core_signature_check', "CHECK (status = 'draft' AND signed_at IS NULL OR status <> 'draft' AND signed_at IS NOT NULL)"],
  ['emr_clinical_record_revision', 'emr_clinical_record_revision_version_check', 'CHECK (record_version >= 1)'],
  ['emr_clinical_record_revision', 'emr_clinical_record_revision_status_check', "CHECK (status = ANY (ARRAY['draft', 'signed', 'amended', 'entered-in-error']))"],
  ['emr_clinical_record_revision', 'emr_clinical_record_revision_payload_check', "CHECK (jsonb_typeof(payload) = 'object')"],
  ['emr_clinical_record_revision', 'emr_clinical_record_revision_hash_check', "CHECK (payload_hash ~ '^[0-9a-f]{64}$')"],
  ['emr_clinical_record_revision', 'emr_clinical_record_revision_state_version_check', 'CHECK (state_version >= 1)'],
  ['emr_clinical_record_revision', 'emr_clinical_record_revision_pkey', 'PRIMARY KEY (tenant_id, record_id, record_version)'],
  ['emr_clinical_record_revision', 'emr_clinical_record_revision_record_fk', 'FOREIGN KEY (tenant_id, record_id) REFERENCES emr_clinical_record_core(tenant_id, record_id) ON DELETE RESTRICT']
];
export const typedClinicalColumns = [
  ['emr_encounter_core', 'tenant_id', 'text', true], ['emr_encounter_core', 'encounter_id', 'text', true],
  ['emr_encounter_core', 'patient_id', 'text', true], ['emr_encounter_core', 'department', 'text', true],
  ['emr_encounter_core', 'status', 'text', true], ['emr_encounter_core', 'class_code', 'text', false],
  ['emr_encounter_core', 'started_at', 'timestamp with time zone', true], ['emr_encounter_core', 'ended_at', 'timestamp with time zone', false],
  ['emr_encounter_core', 'practitioner_id', 'text', true], ['emr_encounter_core', 'data_classification', 'text', true],
  ['emr_encounter_core', 'state_version', 'bigint', true], ['emr_encounter_core', 'payload', 'jsonb', true],
  ['emr_encounter_core', 'updated_at', 'timestamp with time zone', true],
  ['emr_clinical_record_core', 'tenant_id', 'text', true], ['emr_clinical_record_core', 'record_id', 'text', true],
  ['emr_clinical_record_core', 'patient_id', 'text', true], ['emr_clinical_record_core', 'encounter_id', 'text', true],
  ['emr_clinical_record_core', 'occurred_at', 'timestamp with time zone', true], ['emr_clinical_record_core', 'department', 'text', true],
  ['emr_clinical_record_core', 'author_name', 'text', true], ['emr_clinical_record_core', 'author_staff_id', 'text', true],
  ['emr_clinical_record_core', 'status', 'text', true], ['emr_clinical_record_core', 'record_version', 'integer', true],
  ['emr_clinical_record_core', 'signed_at', 'timestamp with time zone', false], ['emr_clinical_record_core', 'signed_by', 'text', false],
  ['emr_clinical_record_core', 'signed_by_staff_id', 'text', false], ['emr_clinical_record_core', 'signed_by_subject', 'text', false],
  ['emr_clinical_record_core', 'data_classification', 'text', true], ['emr_clinical_record_core', 'state_version', 'bigint', true],
  ['emr_clinical_record_core', 'payload', 'jsonb', true], ['emr_clinical_record_core', 'payload_hash', 'character(64)', true],
  ['emr_clinical_record_core', 'updated_at', 'timestamp with time zone', true],
  ['emr_clinical_record_revision', 'tenant_id', 'text', true], ['emr_clinical_record_revision', 'record_id', 'text', true],
  ['emr_clinical_record_revision', 'record_version', 'integer', true], ['emr_clinical_record_revision', 'patient_id', 'text', true],
  ['emr_clinical_record_revision', 'encounter_id', 'text', true], ['emr_clinical_record_revision', 'status', 'text', true],
  ['emr_clinical_record_revision', 'recorded_at', 'timestamp with time zone', true], ['emr_clinical_record_revision', 'payload', 'jsonb', true],
  ['emr_clinical_record_revision', 'payload_hash', 'character(64)', true], ['emr_clinical_record_revision', 'state_version', 'bigint', true]
];

function migrationError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function checksumSql(sql) {
  return createHash('sha256').update(sql.replace(/\r\n/g, '\n')).digest('hex');
}

function safeRoleIdentifier(role) {
  if (typeof role !== 'string' || !runtimeRolePattern.test(role)) {
    throw migrationError('EMR-MIGRATION-RUNTIME-ROLE-INVALID', 'EMR_RUNTIME_DATABASE_ROLE must be a safe unquoted PostgreSQL identifier.');
  }
  return `"${role}"`;
}

async function grantRuntimePrivileges(client, runtimeRole) {
  const quotedRole = safeRoleIdentifier(runtimeRole);
  const schemaOwner = await client.query(`SELECT owner.rolname AS owner_name,
      pg_has_role(current_user, owner.rolname, 'MEMBER') AS owner_member
    FROM pg_namespace n JOIN pg_roles owner ON owner.oid = n.nspowner
    WHERE n.nspname = 'public'`);
  if (!schemaOwner.rows[0]?.owner_member) {
    throw migrationError('EMR-MIGRATION-SCHEMA-OWNER-REQUIRED', 'Migration database role must own, or be a member of the owner of, the public schema.');
  }
  const roleResult = await client.query(`SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls
    FROM pg_roles WHERE rolname = $1`, [runtimeRole]);
  if (!roleResult.rowCount) throw migrationError('EMR-MIGRATION-RUNTIME-ROLE-MISSING', `Runtime database role ${runtimeRole} does not exist.`);
  const role = roleResult.rows[0];
  if (role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolbypassrls) {
    throw migrationError('EMR-MIGRATION-RUNTIME-ROLE-UNSAFE', `Runtime database role ${runtimeRole} has forbidden PostgreSQL role attributes.`);
  }
  const owners = await client.query(`SELECT DISTINCT owner.rolname AS owner_name,
      pg_has_role($1, owner.rolname, 'MEMBER') AS owner_member
    FROM pg_class c JOIN pg_roles owner ON owner.oid = c.relowner
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname = ANY($2::text[])`, [runtimeRole, ['emr_schema_migrations', ...runtimeTables.map((table) => table.name)]]);
  if (owners.rows.some((owner) => owner.owner_member)) {
    throw migrationError('EMR-MIGRATION-RUNTIME-ROLE-UNSAFE', `Runtime database role ${runtimeRole} is an owner or member of a database object owner role.`);
  }

  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC');
  await client.query('GRANT USAGE, CREATE ON SCHEMA public TO CURRENT_USER');
  await client.query(`REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${quotedRole}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${quotedRole}`);
  await client.query(`REVOKE ALL PRIVILEGES ON TABLE emr_schema_migrations FROM PUBLIC, ${quotedRole}`);
  await client.query(`GRANT SELECT ON TABLE emr_schema_migrations TO ${quotedRole}`);
  for (const table of runtimeTables) {
    await client.query(`REVOKE ALL PRIVILEGES ON TABLE ${table.name} FROM PUBLIC, ${quotedRole}`);
    await client.query(`GRANT ${table.permissions.join(', ')} ON TABLE ${table.name} TO ${quotedRole}`);
  }
  await client.query(`REVOKE ALL PRIVILEGES ON SEQUENCE emr_auth_audit_event_sequence_seq FROM PUBLIC, ${quotedRole}`);
  await client.query(`GRANT USAGE ON SEQUENCE emr_auth_audit_event_sequence_seq TO ${quotedRole}`);

  const effective = await client.query(`SELECT
      has_schema_privilege($1, 'public', 'CREATE') AS schema_create,
      has_table_privilege($1, 'emr_schema_migrations', 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS ledger_dangerous`, [runtimeRole]);
  if (effective.rows[0]?.schema_create || effective.rows[0]?.ledger_dangerous) {
    throw migrationError('EMR-MIGRATION-RUNTIME-ROLE-UNSAFE', `Runtime database role ${runtimeRole} retains dangerous inherited privileges (schema_create=${Boolean(effective.rows[0]?.schema_create)}, ledger_dangerous=${Boolean(effective.rows[0]?.ledger_dangerous)}).`);
  }
}

export async function loadMigrations({ directory = migrationDirectory } = {}) {
  const files = (await readdir(directory)).filter((name) => migrationFilePattern.test(name)).sort();
  const migrations = await Promise.all(files.map(async (file) => {
    const match = migrationFilePattern.exec(file);
    const sql = await readFile(path.join(directory, file), 'utf8');
    return { version: Number(match[1]), name: match[2], file, sql, checksum: checksumSql(sql) };
  }));
  if (!migrations.length) throw migrationError('EMR-SCHEMA-MIGRATIONS-MISSING', 'No PostgreSQL migrations were found.');
  migrations.forEach((migration, index) => {
    const expectedVersion = index + 1;
    if (migration.version !== expectedVersion) {
      throw migrationError('EMR-SCHEMA-MIGRATIONS-INVALID', `PostgreSQL migrations must be contiguous from 0001; expected ${expectedVersion}, found ${migration.version}.`);
    }
  });
  return migrations;
}

function expectedByVersion(migrations) {
  return new Map(migrations.map((migration) => [migration.version, migration]));
}

function validateAppliedRows(rows, migrations, { allowLegacy = false } = {}) {
  const expected = expectedByVersion(migrations);
  const latest = migrations.at(-1).version;
  for (const row of rows) {
    const version = Number(row.version);
    if (version > latest) {
      throw migrationError('EMR-SCHEMA-FUTURE-VERSION', `Database schema version ${version} is newer than application schema version ${latest}.`, { databaseVersion: version, expectedVersion: latest });
    }
    const migration = expected.get(version);
    if (!migration) throw migrationError('EMR-SCHEMA-MIGRATIONS-INVALID', `Database contains unknown schema migration ${version}.`);
    const legacy = row.name == null || row.checksum == null;
    if (legacy && allowLegacy) continue;
    if (legacy || row.name !== migration.name || String(row.checksum).trim() !== migration.checksum) {
      throw migrationError('EMR-SCHEMA-CHECKSUM-MISMATCH', `PostgreSQL migration ${String(version).padStart(4, '0')} does not match its immutable source.`, { migrationVersion: version });
    }
  }
}

export async function migrateDatabase(pool, { migrations, runtimeRole } = {}) {
  safeRoleIdentifier(runtimeRole);
  const resolvedMigrations = migrations || await loadMigrations();
  validateAppliedRows([], resolvedMigrations);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [migrationLockName]);
    await client.query(`CREATE TABLE IF NOT EXISTS emr_schema_migrations (
      version integer PRIMARY KEY,
      name text,
      checksum char(64),
      applied_at timestamptz NOT NULL DEFAULT now(),
      execution_ms integer NOT NULL DEFAULT 0,
      installed_by text NOT NULL DEFAULT current_user
    )`);
    await client.query('ALTER TABLE emr_schema_migrations ADD COLUMN IF NOT EXISTS name text');
    await client.query('ALTER TABLE emr_schema_migrations ADD COLUMN IF NOT EXISTS checksum char(64)');
    await client.query('ALTER TABLE emr_schema_migrations ADD COLUMN IF NOT EXISTS execution_ms integer NOT NULL DEFAULT 0');
    await client.query('ALTER TABLE emr_schema_migrations ADD COLUMN IF NOT EXISTS installed_by text NOT NULL DEFAULT current_user');

    const before = await client.query('SELECT version, name, checksum FROM emr_schema_migrations ORDER BY version');
    validateAppliedRows(before.rows, resolvedMigrations, { allowLegacy: true });
    const applied = new Map(before.rows.map((row) => [Number(row.version), row]));
    const legacyMaximum = Math.max(0, ...before.rows.filter((row) => row.name == null || row.checksum == null).map((row) => Number(row.version)));

    for (const migration of resolvedMigrations) {
      const row = applied.get(migration.version);
      const legacyAdoption = migration.version <= legacyMaximum && (!row || row.name == null || row.checksum == null);
      if (row && !legacyAdoption) continue;
      const startedAt = performance.now();
      await client.query(migration.sql);
      const executionMs = Math.max(0, Math.round(performance.now() - startedAt));
      await client.query(`INSERT INTO emr_schema_migrations (version, name, checksum, execution_ms)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (version) DO UPDATE SET name = EXCLUDED.name, checksum = EXCLUDED.checksum, execution_ms = EXCLUDED.execution_ms`,
      [migration.version, migration.name, migration.checksum, executionMs]);
    }
    await client.query('ALTER TABLE emr_schema_migrations ALTER COLUMN name SET NOT NULL');
    await client.query('ALTER TABLE emr_schema_migrations ALTER COLUMN checksum SET NOT NULL');
    const after = await client.query('SELECT version, name, checksum FROM emr_schema_migrations ORDER BY version');
    validateAppliedRows(after.rows, resolvedMigrations);
    if (after.rows.length !== resolvedMigrations.length) {
      throw migrationError('EMR-SCHEMA-MIGRATIONS-INCOMPLETE', `Expected ${resolvedMigrations.length} migrations, found ${after.rows.length}.`);
    }
    await grantRuntimePrivileges(client, runtimeRole);
    await client.query('COMMIT');
    return { version: resolvedMigrations.at(-1).version, applied: resolvedMigrations.length - before.rows.filter((row) => row.name != null && row.checksum != null).length, migrations: after.rows };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

function normalizePolicyExpression(value) {
  return String(value || '').replace(/::text/g, '').replace(/[()\s]/g, '');
}

function normalizeTriggerBody(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeConstraintDefinition(value) {
  return String(value || '').replace(/::(?:text|bpchar|bigint|integer)/gi, '').replace(/[()\s]/g, '').toLowerCase();
}

function schemaDrift(message, details = {}) {
  return migrationError('EMR-SCHEMA-DRIFT', message, details);
}

async function assertRuntimeSchemaStructure(queryable) {
  const roleResult = await queryable.query(`SELECT rolname, rolsuper, rolcreatedb, rolcreaterole, rolbypassrls,
      has_schema_privilege(current_user, 'public', 'CREATE') AS schema_create
    FROM pg_roles WHERE rolname = current_user`);
  const role = roleResult.rows[0];
  if (!role || role.rolsuper || role.rolcreatedb || role.rolcreaterole || role.rolbypassrls || role.schema_create) {
    throw schemaDrift('Runtime database role has unsafe attributes or CREATE privilege on public schema.');
  }

  const catalog = await queryable.query(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
      owner.rolname AS owner_name, pg_has_role(current_user, owner.rolname, 'MEMBER') AS owner_member,
      pg_get_constraintdef(pk.oid) AS primary_key,
      has_table_privilege(current_user, c.oid, 'SELECT') AS can_select,
      has_table_privilege(current_user, c.oid, 'INSERT') AS can_insert,
      has_table_privilege(current_user, c.oid, 'UPDATE') AS can_update,
      has_table_privilege(current_user, c.oid, 'DELETE') AS can_delete,
      has_table_privilege(current_user, c.oid, 'TRUNCATE') AS can_truncate,
      has_table_privilege(current_user, c.oid, 'REFERENCES') AS can_references,
      has_table_privilege(current_user, c.oid, 'TRIGGER') AS can_trigger
    FROM pg_class c
    JOIN pg_roles owner ON owner.oid = c.relowner
    LEFT JOIN pg_constraint pk ON pk.conrelid = c.oid AND pk.contype = 'p'
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname = ANY($1::text[])`, [['emr_schema_migrations', ...runtimeTables.map((table) => table.name)]]);
  const byName = new Map(catalog.rows.map((row) => [row.relname, row]));
  const ledger = byName.get('emr_schema_migrations');
  if (!ledger || ledger.owner_member || !ledger.can_select || ledger.can_insert || ledger.can_update || ledger.can_delete
      || ledger.can_truncate || ledger.can_references || ledger.can_trigger) {
    throw schemaDrift('Runtime role must have SELECT-only access to the migration ledger.');
  }
  for (const expected of runtimeTables) {
    const table = byName.get(expected.name);
    if (!table) throw schemaDrift(`Required runtime table ${expected.name} is missing.`);
    if (!table.relrowsecurity || !table.relforcerowsecurity || table.owner_member) {
      throw schemaDrift(`Runtime table ${expected.name} must force RLS and be owned by an independent role.`);
    }
    if (table.primary_key !== expected.primaryKey) throw schemaDrift(`Runtime table ${expected.name} has an unexpected primary key.`);
    for (const permission of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
      const actual = Boolean(table[`can_${permission.toLowerCase()}`]);
      if (actual !== expected.permissions.includes(permission)) throw schemaDrift(`Runtime table ${expected.name} has incorrect ${permission} privilege.`);
    }
    if (table.can_truncate || table.can_references || table.can_trigger) {
      throw schemaDrift(`Runtime table ${expected.name} exposes a dangerous table privilege.`);
    }
  }

  const structurallyCheckedTables = ['emr_encounter_core', 'emr_clinical_record_core', 'emr_clinical_record_revision', 'emr_idempotency_receipt', 'emr_outbox_event', 'emr_inbox_message'];
  const constraints = await queryable.query(`SELECT c.relname, constraint_row.conname,
      constraint_row.convalidated, pg_get_constraintdef(constraint_row.oid, true) AS definition
    FROM pg_constraint constraint_row
    JOIN pg_class c ON c.oid = constraint_row.conrelid
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname = ANY($1::text[])
    ORDER BY c.relname, constraint_row.conname`, [structurallyCheckedTables]);
  const expectedConstraintMap = new Map([...typedClinicalConstraints, ...deliveryConstraints].map(([table, name, definition]) => [`${table}:${name}`, normalizeConstraintDefinition(definition)]));
  const actualConstraintMap = new Map(constraints.rows.map((row) => [`${row.relname}:${row.conname}`, row]));
  if (actualConstraintMap.size !== expectedConstraintMap.size) throw schemaDrift('Typed clinical tables have an unexpected constraint set.');
  for (const [key, definition] of expectedConstraintMap) {
    const actual = actualConstraintMap.get(key);
    if (!actual || !actual.convalidated || normalizeConstraintDefinition(actual.definition) !== definition) {
      throw schemaDrift(`Typed clinical constraint ${key} is missing, unvalidated, or weakened.`);
    }
  }

  const columns = await queryable.query(`SELECT c.relname, attribute.attname,
      format_type(attribute.atttypid, attribute.atttypmod) AS data_type, attribute.attnotnull,
      pg_get_expr(default_row.adbin, default_row.adrelid) AS column_default
    FROM pg_attribute attribute
    JOIN pg_class c ON c.oid = attribute.attrelid
    LEFT JOIN pg_attrdef default_row ON default_row.adrelid = attribute.attrelid AND default_row.adnum = attribute.attnum
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relname = ANY($1::text[])
      AND attribute.attnum > 0 AND NOT attribute.attisdropped
    ORDER BY c.relname, attribute.attnum`, [structurallyCheckedTables]);
  const expectedColumnMap = new Map([...typedClinicalColumns, ...deliveryColumns].map(([table, column, dataType, notNull]) => [`${table}:${column}`, { dataType, notNull }]));
  const actualColumnMap = new Map(columns.rows.map((row) => [`${row.relname}:${row.attname}`, row]));
  if (actualColumnMap.size !== expectedColumnMap.size) throw schemaDrift('Typed clinical tables have an unexpected column set.');
  for (const [key, expected] of expectedColumnMap) {
    const actual = actualColumnMap.get(key);
    if (!actual || actual.data_type !== expected.dataType || Boolean(actual.attnotnull) !== expected.notNull) {
      throw schemaDrift(`Typed clinical column ${key} has an unexpected type or nullability.`);
    }
  }
  for (const [table, column, expectedDefault] of deliveryDefaults) {
    const actual = actualColumnMap.get(`${table}:${column}`);
    if (!actual || normalizeConstraintDefinition(actual.column_default) !== normalizeConstraintDefinition(expectedDefault)) {
      throw schemaDrift(`Reliable delivery column ${table}.${column} has an unexpected default.`);
    }
  }

  const indexes = await queryable.query(`SELECT indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND indexname = ANY($1::text[])`, [deliveryIndexes.map(([name]) => name)]);
  const actualIndexes = new Map(indexes.rows.map((row) => [row.indexname, normalizeConstraintDefinition(row.indexdef)]));
  for (const [name, definition] of deliveryIndexes) {
    if (actualIndexes.get(name) !== normalizeConstraintDefinition(definition)) throw schemaDrift(`Reliable delivery index ${name} is missing or has drifted.`);
  }

  const policies = await queryable.query(`SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
    FROM pg_policies WHERE schemaname = 'public' AND tablename = ANY($1::text[])`, [runtimeTables.map((table) => table.name)]);
  for (const expected of runtimeTables) {
    const matches = policies.rows.filter((policy) => policy.tablename === expected.name);
    const policy = matches[0];
    const roles = (Array.isArray(policy?.roles) ? policy.roles : String(policy?.roles || '').replace(/[{}]/g, '').split(','))
      .map((roleName) => String(roleName).trim()).filter(Boolean);
    const usingExpression = normalizePolicyExpression(policy?.qual);
    const checkExpression = normalizePolicyExpression(policy?.with_check);
    const tenantExpression = normalizePolicyExpression("tenant_id = current_setting('app.tenant_id', true)");
    if (matches.length !== 1 || policy.policyname !== 'emr_tenant_isolation' || policy.permissive !== 'PERMISSIVE'
        || policy.cmd !== 'ALL' || roles.length !== 1 || roles[0] !== 'public'
        || usingExpression !== tenantExpression || checkExpression !== tenantExpression) {
      throw schemaDrift(`Runtime table ${expected.name} must have exactly one restrictive tenant isolation boundary.`);
    }
  }

  const triggers = await queryable.query(`SELECT c.relname, t.tgname, t.tgenabled, t.tgtype, t.tgqual, t.tgnargs,
      function_schema.nspname AS function_schema, p.proname, p.prosrc
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_namespace function_schema ON function_schema.oid = p.pronamespace
    WHERE NOT t.tgisinternal AND c.relnamespace = 'public'::regnamespace
      AND c.relname = ANY($1::text[])`, [runtimeTables.map((table) => table.name)]);
  const triggerContracts = [
    ['emr_audit_event_projection', 'emr_audit_projection_immutable', 'emr_reject_audit_projection_mutation', "BEGIN RAISE EXCEPTION 'emr_audit_event_projection is append-only'; END;"],
    ['emr_auth_audit_event', 'emr_auth_audit_immutable', 'emr_reject_auth_audit_mutation', "BEGIN RAISE EXCEPTION 'emr_auth_audit_event is append-only'; END;"],
    ['emr_clinical_record_revision', 'emr_clinical_record_revision_immutable', 'emr_reject_clinical_revision_mutation', "BEGIN RAISE EXCEPTION 'emr_clinical_record_revision is append-only'; END;"]
  ];
  if (triggers.rows.length !== triggerContracts.length) {
    throw schemaDrift('Audit tables must contain only the expected append-only triggers.');
  }
  for (const [table, trigger, functionName, functionBody] of triggerContracts) {
    const matches = triggers.rows.filter((row) => row.relname === table && row.tgname === trigger);
    const actual = matches[0];
    if (matches.length !== 1 || actual.tgenabled !== 'O' || Number(actual.tgtype) !== 27
        || actual.tgqual != null || Number(actual.tgnargs) !== 0 || actual.function_schema !== 'public'
        || actual.proname !== functionName || normalizeTriggerBody(actual.prosrc) !== functionBody) {
      throw schemaDrift(`Required append-only trigger ${trigger} is missing, disabled, or weakened.`);
    }
  }

  const sequence = await queryable.query(`SELECT
      has_sequence_privilege(current_user, 'public.emr_auth_audit_event_sequence_seq', 'USAGE') AS can_use,
      has_sequence_privilege(current_user, 'public.emr_auth_audit_event_sequence_seq', 'SELECT') AS can_select,
      has_sequence_privilege(current_user, 'public.emr_auth_audit_event_sequence_seq', 'UPDATE') AS can_update`);
  if (!sequence.rows[0]?.can_use || sequence.rows[0]?.can_select || sequence.rows[0]?.can_update) {
    throw schemaDrift('Runtime identity sequence privileges have drifted.');
  }
}

export async function assertSchemaCurrent(queryable, { migrations } = {}) {
  const resolvedMigrations = migrations || await loadMigrations();
  let result;
  try {
    result = await queryable.query('SELECT version, name, checksum FROM emr_schema_migrations ORDER BY version');
  } catch (cause) {
    throw migrationError('EMR-SCHEMA-MIGRATION-REQUIRED', 'PostgreSQL schema is not initialized. Run npm run db:migrate before starting the application.', { cause });
  }
  validateAppliedRows(result.rows, resolvedMigrations);
  if (result.rows.length !== resolvedMigrations.length) {
    throw migrationError('EMR-SCHEMA-MIGRATION-REQUIRED', `PostgreSQL schema is incomplete (${result.rows.length}/${resolvedMigrations.length}). Run npm run db:migrate.`, { databaseVersion: result.rows.length ? Number(result.rows.at(-1).version) : 0, expectedVersion: resolvedMigrations.at(-1).version });
  }
  try {
    await assertRuntimeSchemaStructure(queryable);
  } catch (error) {
    if (error.code === 'EMR-SCHEMA-DRIFT') throw error;
    throw schemaDrift('PostgreSQL runtime schema inspection failed.', { cause: error });
  }
  return { version: resolvedMigrations.at(-1).version, migrations: result.rows };
}

export const expectedSchemaVersion = 8;
