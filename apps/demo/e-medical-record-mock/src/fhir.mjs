export const profiles = {
  patient: 'http://jpfhir.jp/fhir/core/StructureDefinition/JP_Patient',
  encounter: 'http://jpfhir.jp/fhir/core/StructureDefinition/JP_Encounter',
  condition: 'http://jpfhir.jp/fhir/core/StructureDefinition/JP_Condition',
  observation: 'http://jpfhir.jp/fhir/core/StructureDefinition/JP_Observation_Common',
  medicationRequest: 'http://jpfhir.jp/fhir/core/StructureDefinition/JP_MedicationRequest',
  medicationDispense: 'http://jpfhir.jp/fhir/core/StructureDefinition/JP_MedicationDispense',
  serviceRequest: 'http://jpfhir.jp/fhir/core/StructureDefinition/JP_ServiceRequest'
};

const genderMap = { male: 'male', female: 'female', other: 'other', unknown: 'unknown' };

export function patientResource(patient) {
  return {
    resourceType: 'Patient', id: patient.id,
    meta: { profile: [profiles.patient], lastUpdated: new Date().toISOString() },
    identifier: [{ system: 'https://mock.example.jp/fhir/IdSystem/patient-id', value: patient.id }],
    active: true,
    name: [{ use: 'official', text: patient.name, family: patient.name.split(' ')[0], given: [patient.name.split(' ')[1]] }, { use: 'usual', text: patient.kana }],
    telecom: [{ system: 'phone', value: patient.phone, use: 'home' }],
    gender: genderMap[patient.gender] ?? 'unknown', birthDate: patient.birthDate,
    address: [{ use: 'home', text: patient.address, postalCode: patient.postalCode, country: 'JP' }],
    communication: [{ language: { coding: [{ system: 'urn:ietf:bcp:47', code: patient.preferredLanguage || 'ja-JP', display: '日本語' }] }, preferred: true }],
    ...(patient.maritalStatus ? { maritalStatus: { text: patient.maritalStatus } } : {}),
    ...(patient.emergencyContact ? { contact: [{
      relationship: [{ text: patient.emergencyContact.relationship }],
      name: { text: patient.emergencyContact.name },
      telecom: [{ system: 'phone', value: patient.emergencyContact.phone }]
    }] } : {}),
    ...(patient.primaryPhysician ? { generalPractitioner: [{ reference: 'Practitioner/PRACT-001', display: patient.primaryPhysician }] } : {})
  };
}

export function medicationRequestResource(order) {
  return {
    resourceType: 'MedicationRequest', id: order.id,
    meta: { profile: [profiles.medicationRequest], lastUpdated: new Date().toISOString() },
    identifier: [
      { system: 'http://jpfhir.jp/fhir/core/mhlw/IdSystem/Medication-RPGroupNumber', value: '1' },
      { system: 'http://jpfhir.jp/fhir/core/IdSystem/resourceInstance-identifier', value: order.id },
      ...(order.prescriptionId ? [{ system: 'http://jpfhir.jp/fhir/core/IdSystem/prescriptionDocumentID', value: order.prescriptionId }] : [])
    ],
    status: order.status, intent: order.intent,
    medicationCodeableConcept: {
      coding: [{ system: 'urn:oid:1.2.392.100495.20.2.74', code: order.medicationCode, display: order.medicationDisplay }],
      text: order.medicationDisplay
    },
    subject: { reference: `Patient/${order.patientId}` },
    authoredOn: order.authoredOn,
    requester: { reference: 'Practitioner/PRACT-001', display: order.requester },
    dosageInstruction: [{ text: order.dosageText, route: { coding: [{ system: 'urn:oid:2.16.840.1.113883.3.1937.777.10.5.162', code: 'PO', display: order.route }] } }],
    dispenseRequest: { quantity: { value: order.quantity, unit: order.unit, system: 'http://unitsofmeasure.org', code: order.unit } }
  };
}

export function observationResource(order) {
  return {
    resourceType: 'Observation', id: `OBS-${order.id}`,
    meta: { profile: [profiles.observation], lastUpdated: new Date().toISOString() },
    identifier: [{ system: 'https://mock.example.jp/fhir/IdSystem/lab-result-id', value: `OBS-${order.id}` }],
    status: order.status === 'completed' ? 'final' : 'registered',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'laboratory', display: 'Laboratory' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: order.code, display: order.name }], text: order.name },
    subject: { reference: `Patient/${order.patientId}` }, effectiveDateTime: order.requestedAt,
    ...(order.result ? { valueString: order.result } : {})
  };
}

export function vitalSignResource(vital) {
  const quantity = (value, unit, code) => ({ value, unit, system: 'http://unitsofmeasure.org', code });
  return {
    resourceType: 'Observation', id: vital.id,
    meta: { profile: [profiles.observation], lastUpdated: new Date().toISOString() },
    identifier: [{ system: 'https://mock.example.jp/fhir/IdSystem/vital-sign-id', value: vital.id }],
    status: 'final',
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/observation-category', code: 'vital-signs', display: 'Vital Signs' }] }],
    code: { coding: [{ system: 'http://loinc.org', code: '85353-1', display: 'Vital signs, weight, height, head circumference, oxygen saturation and BMI panel' }], text: 'バイタルサイン' },
    subject: { reference: `Patient/${vital.patientId}` },
    encounter: { reference: `Encounter/${vital.encounterId}` },
    effectiveDateTime: vital.observedAt,
    performer: [{ reference: 'Practitioner/PRACT-001', display: vital.performer }],
    component: [
      { code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] }, valueQuantity: quantity(vital.systolic, 'mmHg', 'mm[Hg]') },
      { code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] }, valueQuantity: quantity(vital.diastolic, 'mmHg', 'mm[Hg]') },
      { code: { coding: [{ system: 'http://loinc.org', code: '8867-4', display: 'Heart rate' }] }, valueQuantity: quantity(vital.pulse, '/min', '/min') },
      { code: { coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' }] }, valueQuantity: quantity(vital.temperatureC, '℃', 'Cel') },
      { code: { coding: [{ system: 'http://loinc.org', code: '59408-5', display: 'Oxygen saturation in Arterial blood by Pulse oximetry' }] }, valueQuantity: quantity(vital.spo2, '%', '%') },
      { code: { coding: [{ system: 'http://loinc.org', code: '8302-2', display: 'Body height' }] }, valueQuantity: quantity(vital.heightCm, 'cm', 'cm') },
      { code: { coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body weight' }] }, valueQuantity: quantity(vital.weightKg, 'kg', 'kg') },
      { code: { coding: [{ system: 'http://loinc.org', code: '39156-5', display: 'Body mass index' }] }, valueQuantity: quantity(vital.bmi, 'kg/m2', 'kg/m2') }
    ]
  };
}

export function conditionResource(conditionOrPatientId) {
  const condition = typeof conditionOrPatientId === 'string'
    ? { id: `COND-${conditionOrPatientId}-001`, patientId: conditionOrPatientId, code: 'I10', display: '高血圧症（架空データ）', recordedDate: '2026-07-18' }
    : conditionOrPatientId;
  return {
    resourceType: 'Condition', id: condition.id,
    meta: { profile: [profiles.condition] },
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: condition.clinicalStatus || 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: condition.verificationStatus || 'confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    code: { coding: [{ system: 'http://hl7.org/fhir/sid/icd-10', code: condition.code, display: condition.display }], text: condition.display },
    subject: { reference: `Patient/${condition.patientId}` }, recordedDate: condition.recordedDate
  };
}

export function encounterResource(encounter) {
  const status = encounter.status === 'in-progress' ? 'in-progress' : 'finished';
  return {
    resourceType: 'Encounter', id: encounter.id,
    meta: { profile: [profiles.encounter], lastUpdated: new Date().toISOString() },
    identifier: [{ system: 'https://mock.example.jp/fhir/IdSystem/encounter-id', value: encounter.id }],
    status,
    class: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: encounter.classCode || (encounter.entryExit === '入院' ? 'IMP' : 'AMB'),
      display: encounter.entryExit === '入院' ? 'inpatient encounter' : 'ambulatory'
    },
    serviceType: { text: encounter.department },
    subject: { reference: `Patient/${encounter.patientId}` },
    participant: [{ individual: { reference: `Practitioner/${encounter.practitionerId}`, display: encounter.practitionerName || '担当医師' } }],
    period: { start: encounter.startedAt, ...(encounter.endedAt ? { end: encounter.endedAt } : {}) },
    location: [{ location: { display: encounter.wardName || `${encounter.department}外来` }, status: 'active' }]
  };
}

const rehabExtensionBase = 'https://method-more.com/fhir/StructureDefinition';

export function rehabilitationServiceRequestResource(plan) {
  const extensions = [
    ['rehabilitation-class', { valueString: plan.rehabilitationClass }],
    ['care-setting', { valueCode: plan.entryExit === '入院' ? 'inpatient' : 'outpatient' }],
    ['ward-name', { valueString: plan.wardName }],
    ['planned-units-per-day', { valueInteger: plan.plannedUnitsPerDay }],
    ['impairment', { valueString: plan.impairments.join('、') }],
    ['risk', { valueString: plan.risks.join('、') }],
    ['rehabilitation-goal', { valueString: plan.goal }],
    ['fim-total', { valueInteger: plan.fim.total }],
    ['fim-motor', { valueInteger: plan.fim.motor }],
    ['fim-cognitive', { valueInteger: plan.fim.cognitive }],
    ['fim-previous-total', { valueInteger: plan.fim.previousTotal }]
  ].map(([name, value]) => ({ url: `${rehabExtensionBase}/${name}`, ...value }));
  if (plan.targetDischargeDate) extensions.push({ url: `${rehabExtensionBase}/target-discharge-date`, valueDate: plan.targetDischargeDate });
  return {
    resourceType: 'ServiceRequest', id: plan.id,
    meta: { profile: [profiles.serviceRequest], lastUpdated: new Date().toISOString() },
    identifier: [{ system: 'https://mock.example.jp/fhir/IdSystem/rehabilitation-order-id', value: plan.id }],
    status: plan.status, intent: plan.intent,
    category: [{ coding: [{ system: 'https://method-more.com/fhir/CodeSystem/service-category', code: 'rehabilitation', display: 'リハビリテーション' }] }],
    code: {
      coding: [{ system: 'https://method-more.com/fhir/CodeSystem/rehabilitation-class', code: plan.rehabilitationClass, display: `${plan.rehabilitationClass}リハビリテーション` }],
      text: `${plan.rehabilitationClass}リハビリテーション実施依頼`
    },
    subject: { reference: `Patient/${plan.patientId}` },
    encounter: { reference: `Encounter/${plan.encounterId}` },
    authoredOn: plan.authoredOn,
    requester: { reference: 'Practitioner/PRACT-001', display: plan.requester },
    performerType: plan.professions.map((profession) => ({ coding: [{ system: 'https://method-more.com/fhir/CodeSystem/rehabilitation-profession', code: profession, display: profession }] })),
    reasonReference: [{ reference: `Condition/${plan.conditionId}`, display: plan.primaryDiagnosis }],
    occurrencePeriod: { start: `${plan.startDate}T09:00:00+09:00`, ...(plan.targetDischargeDate ? { end: `${plan.targetDischargeDate}T17:00:00+09:00` } : {}) },
    note: [{ text: `機能障害：${plan.impairments.join('、')}。注意事項：${plan.risks.join('、')}。目標：${plan.goal}` }],
    extension: extensions
  };
}

export function patientBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  if (!patient) return null;
  const entries = [patientResource(patient)];
  store.encounters.filter((item) => item.patientId === patientId).forEach((item) => entries.push(encounterResource(item)));
  store.conditions.filter((item) => item.patientId === patientId).forEach((item) => entries.push(conditionResource(item)));
  store.rehabilitationPlans.filter((item) => item.patientId === patientId).forEach((item) => entries.push(rehabilitationServiceRequestResource(item)));
  store.medicationRequests.filter((item) => item.patientId === patientId).forEach((item) => entries.push(medicationRequestResource(item)));
  store.labOrders.filter((item) => item.patientId === patientId).forEach((item) => entries.push(observationResource(item)));
  store.vitalSigns.filter((item) => item.patientId === patientId).forEach((item) => entries.push(vitalSignResource(item)));
  return {
    resourceType: 'Bundle', id: `BUNDLE-${patientId}-${Date.now()}`, type: 'collection', timestamp: new Date().toISOString(),
    identifier: { system: 'http://jpfhir.jp/fhir/core/NamingSystem/jp-clins-bundle-identifier', value: `MOCK-${patientId}-${Date.now()}` },
    entry: entries.map((resource) => ({ fullUrl: `https://mock.example.jp/fhir/r4/${resource.resourceType}/${resource.id}`, resource }))
  };
}

export function clinicalDocumentBundle(store, patientId, documentType = '診療情報提供書') {
  const bundle = patientBundle(store, patientId);
  if (!bundle) return null;
  const timestamp = new Date().toISOString();
  const composition = {
    resourceType: 'Composition', id: `COMP-${patientId}-${Date.now()}`,
    status: 'final', type: { text: documentType }, subject: { reference: `Patient/${patientId}` },
    date: timestamp, author: [{ reference: 'Practitioner/PRACT-001', display: '佐藤 医師' }],
    title: `${documentType}（架空データ）`,
    section: [
      { title: '傷病・プロブレム', entry: store.conditions.filter((item) => item.patientId === patientId).map((item) => ({ reference: `Condition/${item.id}` })) },
      { title: 'リハビリテーション依頼', entry: store.rehabilitationPlans.filter((item) => item.patientId === patientId).map((item) => ({ reference: `ServiceRequest/${item.id}` })) },
      { title: '処方', entry: store.medicationRequests.filter((item) => item.patientId === patientId).map((item) => ({ reference: `MedicationRequest/${item.id}` })) },
      { title: '検査結果', entry: store.labOrders.filter((item) => item.patientId === patientId).map((item) => ({ reference: `Observation/OBS-${item.id}` })) },
      { title: 'バイタルサイン', entry: store.vitalSigns.filter((item) => item.patientId === patientId).map((item) => ({ reference: `Observation/${item.id}` })) }
    ]
  };
  bundle.type = 'document'; bundle.timestamp = timestamp;
  bundle.entry.unshift({ fullUrl: `https://mock.example.jp/fhir/r4/Composition/${composition.id}`, resource: composition });
  return bundle;
}

export function operationOutcome(code, diagnostics, severity = 'error') {
  return { resourceType: 'OperationOutcome', issue: [{ severity, code, diagnostics }] };
}

export function capabilityStatement() {
  return {
    resourceType: 'CapabilityStatement', id: 'emedical-record-mock', status: 'active', date: '2026-09-11', kind: 'instance',
    software: { name: 'eMedicalRecordMock', version: '0.2.0' }, fhirVersion: '4.0.1', format: ['json'],
    implementationGuide: ['http://jpfhir.jp/fhir/core/ImplementationGuide/jpfhir.jp.core'],
    rest: [{ mode: 'server', security: { cors: true, service: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/restful-security-service', code: 'OAuth' }] }] },
      resource: ['Patient', 'Encounter', 'Condition', 'ServiceRequest', 'MedicationRequest', 'Observation'].map((type) => ({ type, interaction: [{ code: 'read' }, { code: 'search-type' }] })) }]
  };
}
