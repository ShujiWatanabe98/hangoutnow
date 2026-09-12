const unsafeNames = new Set(['__proto__', 'prototype', 'constructor']);
const str = (options = {}) => ({ type: 'string', ...options });
const int = (options = {}) => ({ type: 'integer', ...options });
const num = (options = {}) => ({ type: 'number', ...options });
const bool = { type: 'boolean' };
const arr = (items, options = {}) => ({ type: 'array', items, ...options });
const obj = (properties, required = [], options = {}) => ({ type: 'object', properties, required, ...options });
const id = str({ minLength: 1, maxLength: 128, pattern: /^[A-Za-z0-9][A-Za-z0-9._:-]*$/ });
const short = str({ minLength: 1, maxLength: 300 });
const note = str({ maxLength: 4_000 });
const list = arr(str({ minLength: 1, maxLength: 200 }), { maxItems: 100 });

const schemas = {
  patientCreate: obj({
    id, name: str({ minLength: 1, maxLength: 100 }), kana: str({ minLength: 1, maxLength: 150 }),
    birthDate: str({ format: 'date' }), gender: str({ enum: ['male', 'female', 'other', 'unknown'] }),
    bloodType: str({ maxLength: 20 }), phone: str({ maxLength: 40 }), postalCode: str({ maxLength: 20 }),
    address: str({ maxLength: 300 }), department: short, allergies: list, alerts: list,
    insurance: obj({
      insurerNumber: str({ maxLength: 32 }), symbol: str({ maxLength: 50 }), number: str({ maxLength: 64 }),
      branchNumber: str({ maxLength: 16 }), status: str({ maxLength: 50 }), copayRate: num({ minimum: 0, maximum: 100 }),
      verifiedAt: { type: 'string', format: 'date-time', nullable: true, maxLength: 40 }
    })
  }, ['name', 'kana', 'birthDate', 'gender']),
  patientUpdate: obj({
    version: int({ minimum: 1 }), name: str({ minLength: 1, maxLength: 100 }), kana: str({ minLength: 1, maxLength: 150 }),
    phone: str({ maxLength: 40 }), postalCode: str({ maxLength: 20 }), address: str({ maxLength: 300 }),
    department: short, status: str({ minLength: 1, maxLength: 50 }), room: str({ maxLength: 50 }), allergies: list, alerts: list
  }, ['version']),
  encounter: obj({ patientId: id, department: short }, ['patientId', 'department']),
  record: obj({
    patientId: id, encounterId: id, department: short, author: str({ maxLength: 100 }),
    soap: obj({
      subjective: str({ maxLength: 10_000 }), objective: str({ maxLength: 10_000 }),
      assessment: str({ maxLength: 10_000 }), plan: str({ maxLength: 10_000 })
    }, ['subjective', 'objective', 'assessment', 'plan'])
  }, ['patientId', 'soap']),
  empty: obj({}),
  signature: obj({
    version: int({ minimum: 1 }), cosignAssignmentId: id, cosignReason: str({ minLength: 1, maxLength: 500 })
  }, ['version']),
  medication: obj({
    patientId: id, recordId: id, medicationCode: str({ minLength: 1, maxLength: 64 }), medicationDisplay: short,
    dosageText: str({ minLength: 1, maxLength: 1_000 }), days: int({ minimum: 1, maximum: 365 }),
    quantity: num({ exclusiveMinimum: 0, maximum: 1_000_000 }), unit: str({ minLength: 1, maxLength: 40 }),
    route: str({ maxLength: 100 }), requester: str({ maxLength: 100 })
  }, ['patientId', 'medicationCode', 'medicationDisplay', 'dosageText', 'quantity', 'unit']),
  injection: obj({
    patientId: id, medicationDisplay: short, dose: str({ minLength: 1, maxLength: 100 }),
    route: str({ minLength: 1, maxLength: 100 }), scheduledAt: str({ format: 'date-time', maxLength: 40 }), note
  }, ['patientId', 'medicationDisplay', 'dose', 'route']),
  lab: obj({
    patientId: id, recordId: id, code: str({ minLength: 1, maxLength: 64 }), name: short,
    priority: str({ enum: ['routine', 'urgent'] }), specimen: str({ maxLength: 200 }), note
  }, ['patientId', 'code', 'name']),
  labResult: obj({ version: int({ minimum: 1 }), result: str({ minLength: 1, maxLength: 4_000 }) }, ['version', 'result']),
  imaging: obj({ patientId: id, type: str({ minLength: 1, maxLength: 100 }), title: short, note }, ['patientId', 'type', 'title']),
  document: obj({ patientId: id, type: str({ minLength: 1, maxLength: 100 }), title: short, note }, ['patientId', 'type', 'title']),
  summary: obj({
    patientId: id, type: str({ minLength: 1, maxLength: 100 }), recipient: short,
    condition: note, course: str({ minLength: 1, maxLength: 20_000 }), format: str({ maxLength: 100 })
  }, ['patientId', 'type', 'recipient', 'condition', 'course']),
  eligibility: obj({ patientId: id, consent: bool }, ['patientId', 'consent']),
  electronicPrescription: obj({
    patientId: id,
    medicationRequestIds: arr(id, { minItems: 1, maxItems: 100 }),
    medicationRequestVersions: arr(int({ minimum: 1 }), { minItems: 1, maxItems: 100 })
  }, ['patientId', 'medicationRequestIds', 'medicationRequestVersions']),
  dispensingResult: obj({ version: int({ minimum: 1 }) }, ['version']),
  fhirBundle: obj({ resourceType: str({ enum: ['Bundle'] }), type: str({ minLength: 1, maxLength: 100 }) }, ['resourceType', 'type'], { additionalProperties: true }),
  fhirSend: obj({ patientId: id, documentType: str({ minLength: 1, maxLength: 100 }) }, ['patientId', 'documentType']),
  breakGlass: obj({
    patientId: id, reasonCode: str({ enum: ['emergency-care', 'patient-safety', 'system-downtime'] }),
    justification: str({ minLength: 10, maxLength: 500 }), durationMinutes: int({ minimum: 5, maximum: 30 })
  }, ['patientId', 'reasonCode', 'justification']),
  breakGlassRevoke: obj({ reason: str({ minLength: 1, maxLength: 200 }) }),
  nursing: obj({
    patientId: id, admissionId: id, type: str({ minLength: 1, maxLength: 100 }), title: short,
    content: str({ minLength: 1, maxLength: 20_000 }), authorStaffId: id
  }, ['patientId', 'type', 'title', 'content']),
  version: obj({ version: int({ minimum: 1 }) }, ['version']),
  activity: obj({
    moduleId: id, patientId: id, workType: str({ minLength: 1, maxLength: 200 }), title: short,
    priority: str({ enum: ['routine', 'urgent'] }), scheduledAt: str({ format: 'date-time', maxLength: 40 }),
    assignedStaffId: id, assignedTo: str({ maxLength: 100 }), note
  }, ['moduleId', 'patientId', 'workType', 'title']),
  activityUpdate: obj({
    version: int({ minimum: 1 }), title: short, priority: str({ enum: ['routine', 'urgent'] }),
    scheduledAt: str({ format: 'date-time', maxLength: 40 }), assignedStaffId: id, assignedTo: str({ maxLength: 100 }), note, result: note
  }, ['version']),
  activityTransition: obj({
    status: str({ enum: ['requested', 'accepted', 'in-progress', 'completed', 'approved', 'cancelled'] }),
    version: int({ minimum: 1 }), result: note,
    verificationId: id,
    verificationEvidence: obj({
      verificationId: id, patientId: id, orderId: id, performerStaffId: id, method: str({ enum: ['barcode'] })
    }, ['verificationId', 'patientId', 'orderId', 'performerStaffId', 'method'])
  }, ['status', 'version']),
  instructionTransition: obj({ status: str({ enum: ['accepted', 'completed', 'cancelled'] }), version: int({ minimum: 1 }), result: note }, ['status', 'version']),
  admission: obj({
    patientId: id, bedId: id, admissionType: str({ enum: ['planned', 'emergency'] }), attendingPhysician: str({ maxLength: 100 }),
    carePath: note, broughtMedications: note, plannedDischargeAt: str({ format: 'date-time', maxLength: 40 })
  }, ['patientId', 'bedId']),
  transfer: obj({ bedId: id, version: int({ minimum: 1 }) }, ['bedId', 'version']),
  discharge: obj({ version: int({ minimum: 1 }), dischargeSummary: str({ maxLength: 20_000 }) }, ['version']),
  medicationAdministrationTransition: obj({
    status: str({ enum: ['completed'] }), version: int({ minimum: 1 }),
    barcodeVerification: obj({ patient: bool, medication: bool, staff: bool }, ['patient', 'medication', 'staff'])
  }, ['status', 'version']),
  surgeryTransition: obj({ status: str({ enum: ['in-progress', 'completed'] }), version: int({ minimum: 1 }) }, ['status', 'version']),
  claimTransition: obj({ status: str({ enum: ['submitted'] }), version: int({ minimum: 1 }), resolved: bool }, ['status', 'version']),
  operationsTransition: obj({
    status: str({ enum: ['reviewing', 'completed', 'clarification-needed', 'acknowledged', 'resolved', 'closed', 'in-progress', 'cancelled', 'signed', 'reviewed', 'rejected', 'cosigned', 'correcting', 'resubmitted', 'accepted', 'validated-for-demo', 'activated-for-demo'] }),
    version: int({ minimum: 1 }), note: str({ minLength: 3, maxLength: 2_000 })
  }, ['status', 'version', 'note']),
  appointmentCreate: obj({ patientId: id, startsAt: str({ format: 'date-time', maxLength: 40 }), department: short, note }, ['patientId', 'startsAt', 'department']),
  appointmentUpdate: obj({ version: int({ minimum: 1 }), startsAt: str({ format: 'date-time', maxLength: 40 }), department: short, status: str({ enum: ['booked', 'arrived', 'cancelled', 'completed'] }), note }, ['version']),
  appointmentDelete: obj({ version: int({ minimum: 1 }) }, ['version']),
  billing: obj({
    patientId: id, encounterId: id,
    items: arr(obj({ code: str({ minLength: 1, maxLength: 64 }), name: short, quantity: num({ exclusiveMinimum: 0, maximum: 1_000_000 }), amount: num({ minimum: 0, maximum: 100_000_000 }) }, ['code', 'name', 'quantity', 'amount']), { minItems: 1, maxItems: 1_000 })
  }, ['patientId', 'encounterId', 'items']),
  adminMaster: obj({ id, category: short, code: str({ minLength: 1, maxLength: 64 }), display: short, active: bool }, ['category', 'code', 'display']),
  adminInventory: obj({ id, name: short, location: short, stock: num({ minimum: 0, maximum: 1_000_000 }), reorderPoint: num({ minimum: 0, maximum: 1_000_000 }), lot: str({ maxLength: 100 }), expiresOn: str({ format: 'date' }) }, ['name', 'location', 'stock', 'reorderPoint']),
  adminIncident: obj({ id, patientId: id, severity: str({ enum: ['level-0', 'level-1', 'level-2', 'level-3a', 'level-3b', 'level-4', 'level-5'] }), category: short, title: short, status: str({ enum: ['reported', 'reviewing', 'closed'] }), reporter: str({ maxLength: 100 }), reportedAt: str({ format: 'date-time', maxLength: 40 }) }, ['patientId', 'severity', 'category', 'title']),
  adminTemplate: obj({ id, category: short, title: short, active: bool }, ['category', 'title']),
  adminUser: obj({ id, name: str({ minLength: 1, maxLength: 100 }), role: str({ enum: ['physician', 'nurse', 'pharmacist', 'technician', 'therapist', 'dietitian', 'social-worker', 'clerk', 'administrator'] }), department: short, active: bool, mfaEnabled: bool, lastLoginAt: { type: 'string', format: 'date-time', nullable: true, maxLength: 40 } }, ['name', 'role', 'department']),
  adminUpdate: obj({ version: int({ minimum: 1 }), active: bool, name: str({ maxLength: 100 }), display: short, title: short, category: short, department: short, status: str({ maxLength: 50 }), stock: num({ minimum: 0, maximum: 1_000_000 }), reorderPoint: num({ minimum: 0, maximum: 1_000_000 }) }, ['version'])
};

const routes = [
  ['POST', /^\/api\/v1\/patients$/, schemas.patientCreate, 'EMR-PAT-4220', 'Patient validation failed'],
  ['PUT', /^\/api\/v1\/patients\/[^/]+$/, schemas.patientUpdate, 'EMR-PAT-4220', 'Patient validation failed'],
  ['POST', /^\/api\/v1\/encounters$/, schemas.encounter, 'EMR-VAL-4220', 'Encounter validation failed'],
  ['POST', /^\/api\/v1\/records$/, schemas.record, 'EMR-VAL-4220', 'Clinical record validation failed'],
  ['PUT', /^\/api\/v1\/records\/[^/]+\/sign$/, schemas.signature, 'EMR-VAL-4220', 'Clinical record validation failed'],
  ['POST', /^\/api\/v1\/medication-requests$/, schemas.medication, 'EMR-MED-4220', 'Medication validation failed'],
  ['POST', /^\/api\/v1\/injection-orders$/, schemas.injection, 'EMR-INJ-4220', 'Injection validation failed'],
  ['POST', /^\/api\/v1\/lab-orders$/, schemas.lab, 'EMR-LAB-4220', 'Lab validation failed'],
  ['POST', /^\/api\/v1\/lab-orders\/[^/]+\/result$/, schemas.labResult, 'EMR-LAB-4220', 'Lab result validation failed'],
  ['POST', /^\/api\/v1\/imaging-orders$/, schemas.imaging, 'EMR-IMG-4220', 'Imaging validation failed'],
  ['POST', /^\/api\/v1\/documents$/, schemas.document, 'EMR-DOC-4220', 'Document validation failed'],
  ['POST', /^\/api\/v1\/summaries$/, schemas.summary, 'EMR-SUM-4220', 'Summary validation failed'],
  ['POST', /^\/api\/v1\/dx\/eligibility-verifications$/, schemas.eligibility, 'EMR-ELG-4220', 'Eligibility validation failed'],
  ['POST', /^\/api\/v1\/dx\/e-prescriptions$/, schemas.electronicPrescription, 'EMR-ERX-4220', 'Prescription validation failed'],
  ['POST', /^\/api\/v1\/dx\/e-prescriptions\/[^/]+\/dispensing-result$/, schemas.dispensingResult, 'EMR-ERX-4220', 'Dispensing result validation failed'],
  ['POST', /^\/api\/v1\/dx\/fhir-documents\/import$/, schemas.fhirBundle, 'EMR-FHIR-4220', 'FHIR validation failed'],
  ['POST', /^\/api\/v1\/dx\/fhir-documents\/send$/, schemas.fhirSend, 'EMR-FHIR-4220', 'FHIR send validation failed'],
  ['POST', /^\/api\/v1\/security\/break-glass$/, schemas.breakGlass, 'EMR-BREAKGLASS-4220', 'Emergency access validation failed'],
  ['POST', /^\/api\/v1\/security\/break-glass\/[^/]+\/revoke$/, schemas.breakGlassRevoke, 'EMR-BREAKGLASS-4220', 'Emergency access validation failed'],
  ['POST', /^\/api\/v1\/hospital\/nursing-records$/, schemas.nursing, 'EMR-NUR-4220', 'Nursing record validation failed'],
  ['POST', /^\/api\/v1\/hospital\/nursing-records\/[^/]+\/sign$/, schemas.signature, 'EMR-NUR-4220', 'Nursing record validation failed'],
  ['POST', /^\/api\/v1\/hospital\/activities$/, schemas.activity, 'EMR-HOSP-4220', 'Hospital activity validation failed'],
  ['PUT', /^\/api\/v1\/hospital\/activities\/[^/]+$/, schemas.activityUpdate, 'EMR-HOSP-4220', 'Hospital activity validation failed'],
  ['DELETE', /^\/api\/v1\/hospital\/activities\/[^/]+$/, schemas.version, 'EMR-HOSP-4220', 'Hospital activity validation failed'],
  ['POST', /^\/api\/v1\/hospital\/activities\/[^/]+\/transition$/, schemas.activityTransition, 'EMR-HOSP-4220', 'Hospital activity validation failed'],
  ['POST', /^\/api\/v1\/hospital\/handoffs\/[^/]+\/acknowledge$/, schemas.version, 'EMR-HAND-4220', 'Handoff validation failed'],
  ['POST', /^\/api\/v1\/hospital\/clinical-instructions\/[^/]+\/transition$/, schemas.instructionTransition, 'EMR-INST-4220', 'Clinical instruction validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admissions$/, schemas.admission, 'EMR-ADM-4220', 'Admission validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admissions\/[^/]+\/transfer$/, schemas.transfer, 'EMR-ADM-4220', 'Admission transfer validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admissions\/[^/]+\/discharge$/, schemas.discharge, 'EMR-ADM-4220', 'Admission discharge validation failed'],
  ['POST', /^\/api\/v1\/hospital\/advanced\/medication-administrations\/[^/]+\/transition$/, schemas.medicationAdministrationTransition, 'EMR-MAR-4220', 'Medication administration validation failed'],
  ['POST', /^\/api\/v1\/hospital\/advanced\/surgical-cases\/[^/]+\/transition$/, schemas.surgeryTransition, 'EMR-SURG-4220', 'Surgical case validation failed'],
  ['POST', /^\/api\/v1\/hospital\/advanced\/claims\/[^/]+\/transition$/, schemas.claimTransition, 'EMR-CLAIM-4220', 'Claim validation failed'],
  ['POST', /^\/api\/v1\/operations\/[^/]+\/[^/]+\/transition$/, schemas.operationsTransition, 'EMR-OPS-4220', 'Operational workflow validation failed'],
  ['POST', /^\/api\/v1\/appointments$/, schemas.appointmentCreate, 'EMR-APT-4220', 'Appointment validation failed'],
  ['PUT', /^\/api\/v1\/appointments\/[^/]+$/, schemas.appointmentUpdate, 'EMR-APT-4220', 'Appointment validation failed'],
  ['DELETE', /^\/api\/v1\/appointments\/[^/]+$/, schemas.appointmentDelete, 'EMR-APT-4220', 'Appointment validation failed'],
  ['POST', /^\/api\/v1\/billing\/charges$/, schemas.billing, 'EMR-BIL-4220', 'Billing validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admin\/masters$/, schemas.adminMaster, 'EMR-ADMIN-4220', 'Admin master validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admin\/inventory$/, schemas.adminInventory, 'EMR-ADMIN-4220', 'Admin inventory validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admin\/incidents$/, schemas.adminIncident, 'EMR-ADMIN-4220', 'Admin incident validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admin\/document-templates$/, schemas.adminTemplate, 'EMR-ADMIN-4220', 'Admin template validation failed'],
  ['POST', /^\/api\/v1\/hospital\/admin\/users$/, schemas.adminUser, 'EMR-ADMIN-4220', 'Admin user validation failed'],
  ['PUT', /^\/api\/v1\/hospital\/admin\/(?:users|masters|inventory|incidents|document-templates)\/[^/]+$/, schemas.adminUpdate, 'EMR-ADMIN-4220', 'Admin resource validation failed']
];

function error(errors, field, code, message) {
  if (!errors.some((item) => item.field === field && item.code === code)) errors.push({ field, code, message });
}

function unsafe(value, path, errors, depth = 0) {
  if (!value || typeof value !== 'object') return;
  if (depth > 64) { error(errors, path, 'max-depth', 'JSONの入れ子は64階層以下にしてください。'); return; }
  for (const key of Object.keys(value)) {
    const field = path ? `${path}.${key}` : key;
    if (unsafeNames.has(key)) error(errors, field, 'unsafe-key', '安全でないプロパティ名は使用できません。');
    unsafe(value[key], field, errors, depth + 1);
  }
}

export function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validDateTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(?:Z|([+-])(\d{2}):(\d{2}))?$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText = '0', , offsetHourText, offsetMinuteText] = match;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return false;
  if (Number(hourText) > 23 || Number(minuteText) > 59 || Number(secondText) > 59) return false;
  if (offsetHourText && (Number(offsetHourText) > 23 || Number(offsetMinuteText) > 59)) return false;
  return !Number.isNaN(Date.parse(value));
}

function validate(value, schema, field, errors) {
  if (value === null && schema.nullable) return;
  if (schema.type === 'object') {
    if (!isPlainObject(value)) { error(errors, field, 'type', 'JSONオブジェクトを指定してください。'); return; }
    for (const key of schema.required || []) {
      if (!Object.hasOwn(value, key) || value[key] === null || value[key] === '') error(errors, `${field}.${key}`, 'required', '必須項目です。');
    }
    for (const key of Object.keys(value)) {
      if (!Object.hasOwn(schema.properties, key)) {
        if (!schema.additionalProperties) error(errors, `${field}.${key}`, 'unknown-field', '定義されていない項目です。');
      } else validate(value[key], schema.properties[key], `${field}.${key}`, errors);
    }
    return;
  }
  if (schema.type === 'array') {
    if (!Array.isArray(value)) { error(errors, field, 'type', '配列を指定してください。'); return; }
    if (schema.minItems !== undefined && value.length < schema.minItems) error(errors, field, 'min-items', `${schema.minItems}件以上指定してください。`);
    if (schema.maxItems !== undefined && value.length > schema.maxItems) error(errors, field, 'max-items', `${schema.maxItems}件以下にしてください。`);
    value.forEach((item, index) => validate(item, schema.items, `${field}[${index}]`, errors));
    return;
  }
  if (schema.type === 'string') {
    if (typeof value !== 'string') { error(errors, field, 'type', '文字列を指定してください。'); return; }
    if (schema.minLength !== undefined && value.length < schema.minLength) error(errors, field, 'min-length', `${schema.minLength}文字以上にしてください。`);
    if (schema.maxLength !== undefined && value.length > schema.maxLength) error(errors, field, 'max-length', `${schema.maxLength}文字以下にしてください。`);
    if (schema.enum && !schema.enum.includes(value)) error(errors, field, 'enum', `許可値: ${schema.enum.join(', ')}`);
    if (schema.pattern && !schema.pattern.test(value)) error(errors, field, 'pattern', '形式が正しくありません。');
    if (schema.format === 'date' && !validDate(value)) error(errors, field, 'date', 'YYYY-MM-DD形式の実在する日付を指定してください。');
    if (schema.format === 'date-time' && !validDateTime(value)) error(errors, field, 'date-time', 'ISO 8601形式の日時を指定してください。');
    return;
  }
  if (schema.type === 'integer') {
    if (!Number.isInteger(value)) { error(errors, field, 'type', '整数を指定してください。'); return; }
  } else if (schema.type === 'number') {
    if (typeof value !== 'number' || !Number.isFinite(value)) { error(errors, field, 'type', '有限の数値を指定してください。'); return; }
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') error(errors, field, 'type', '真偽値を指定してください。');
    return;
  }
  if (schema.minimum !== undefined && value < schema.minimum) error(errors, field, 'minimum', `${schema.minimum}以上にしてください。`);
  if (schema.exclusiveMinimum !== undefined && value <= schema.exclusiveMinimum) error(errors, field, 'exclusive-minimum', `${schema.exclusiveMinimum}より大きい値にしてください。`);
  if (schema.maximum !== undefined && value > schema.maximum) error(errors, field, 'maximum', `${schema.maximum}以下にしてください。`);
}

export function validateClinicalWrite({ method, pathname, contentType, body }) {
  const route = routes.find(([expectedMethod, pattern]) => expectedMethod === method && pattern.test(pathname));
  if (!route) return { matched: false, errors: [] };
  const [, , schema, code, title] = route;
  const errors = [];
  const normalizedContentType = String(contentType || '').toLowerCase();
  const fhirJsonAllowed = pathname === '/api/v1/dx/fhir-documents/import' && normalizedContentType.startsWith('application/fhir+json');
  if (!normalizedContentType.startsWith('application/json') && !fhirJsonAllowed) error(errors, 'body', 'content-type', 'Content-Type: application/json を指定してください。FHIR文書受信では application/fhir+json も利用できます。');
  unsafe(body, 'body', errors);
  validate(body, schema, 'body', errors);
  return { matched: true, code, title, detail: '入力内容を確認してください。', errors };
}
