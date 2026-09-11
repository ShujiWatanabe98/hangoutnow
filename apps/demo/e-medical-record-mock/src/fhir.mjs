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
    address: [{ use: 'home', text: patient.address, postalCode: patient.postalCode, country: 'JP' }]
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
    valueString: order.result ?? '結果待ち'
  };
}

export function conditionResource(patientId) {
  return {
    resourceType: 'Condition', id: `COND-${patientId}-001`,
    meta: { profile: [profiles.condition] },
    clinicalStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }] },
    verificationStatus: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-ver-status', code: 'confirmed' }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item' }] }],
    code: { text: '高血圧症（架空データ）' }, subject: { reference: `Patient/${patientId}` }, recordedDate: '2026-07-18'
  };
}

export function patientBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  if (!patient) return null;
  const entries = [patientResource(patient), conditionResource(patientId)];
  store.medicationRequests.filter((item) => item.patientId === patientId).forEach((item) => entries.push(medicationRequestResource(item)));
  store.labOrders.filter((item) => item.patientId === patientId).forEach((item) => entries.push(observationResource(item)));
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
      { title: '傷病・プロブレム', entry: [{ reference: `Condition/COND-${patientId}-001` }] },
      { title: '処方', entry: store.medicationRequests.filter((item) => item.patientId === patientId).map((item) => ({ reference: `MedicationRequest/${item.id}` })) },
      { title: '検査結果', entry: store.labOrders.filter((item) => item.patientId === patientId).map((item) => ({ reference: `Observation/OBS-${item.id}` })) }
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
      resource: ['Patient', 'MedicationRequest', 'Observation', 'Condition'].map((type) => ({ type, interaction: [{ code: 'read' }, { code: 'search-type' }] })) }]
  };
}

