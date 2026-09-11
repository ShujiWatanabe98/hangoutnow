import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../e-medical-record-mock/src/store.mjs';
import { patientBundle } from '../e-medical-record-mock/src/fhir.mjs';

const patientScopedCollections = [
  'encounters', 'conditions', 'records', 'vitalSigns', 'medicationRequests',
  'prescriptions', 'labOrders', 'eligibilityChecks', 'appointments', 'billingCharges'
];

test('100名の架空患者に現場想定の基本診療データが揃う', () => {
  const store = createStore();
  const patientIds = new Set(store.patients.map((patient) => patient.id));
  const expectedConditionCodes = {
    内科: 'I10', 整形外科: 'M17.9', 循環器内科: 'I50.9', 呼吸器内科: 'J45.9',
    糖尿病内科: 'E11.9', 脳神経内科: 'I69.3', 脳神経外科: 'I69.3', 神経内科: 'I69.3',
    消化器内科: 'K21.9', 回復期リハビリテーション科: 'R53'
  };

  assert.equal(store.patients.length, 100);
  assert.equal(patientIds.size, 100);
  assert.equal(new Set(store.patients.map((patient) => patient.name)).size, 100);

  for (const patient of store.patients) {
    assert.equal(patient.dataClassification, 'FICTIONAL_DEMO');
    assert.match(patient.address, /架空/);
    assert.ok(patient.insurance?.insurerNumber);
    assert.ok(patient.emergencyContact?.phone);
    assert.ok(patient.primaryPhysician);
    assert.ok(patient.bmi > 10 && patient.bmi < 50);
    const condition = store.conditions.find((item) => item.patientId === patient.id);
    const rehabilitationPlan = store.rehabilitationPlans.find((item) => item.patientId === patient.id);
    if (patient.smartRehabId) {
      assert.equal(patient.smartRehabId, patient.id, `${patient.id} must use the EMR patient ID in Smart Rehab`);
      assert.equal(condition.display, rehabilitationPlan.primaryDiagnosis);
    }
    else assert.equal(condition.code, expectedConditionCodes[patient.department], `condition must match ${patient.department}`);
    const hospitalization = store.encounters.find((item) => item.patientId === patient.id && item.classCode === 'IMP');
    assert.ok(hospitalization?.startedAt, `${patient.id} must have a hospitalization start date`);
  }

  for (const collectionName of patientScopedCollections) {
    const coveredPatients = new Set(store[collectionName].map((item) => item.patientId));
    assert.equal(coveredPatients.size, 100, `${collectionName} must cover every patient`);
  }
});

test('オーダ・会計・診療履歴の参照が欠けていない', () => {
  const store = createStore();
  const patientIds = new Set(store.patients.map((item) => item.id));
  const encounterIds = new Set(store.encounters.map((item) => item.id));
  const recordIds = new Set(store.records.map((item) => item.id));
  const medicationIds = new Set(store.medicationRequests.map((item) => item.id));
  const prescriptionIds = new Set(store.prescriptions.map((item) => item.id));

  for (const record of store.records) {
    assert.ok(patientIds.has(record.patientId));
    assert.ok(encounterIds.has(record.encounterId), `missing encounter ${record.encounterId}`);
  }
  for (const medication of store.medicationRequests) {
    assert.ok(patientIds.has(medication.patientId));
    assert.ok(recordIds.has(medication.recordId), `missing record ${medication.recordId}`);
    assert.ok(prescriptionIds.has(medication.prescriptionId), `missing prescription ${medication.prescriptionId}`);
  }
  for (const prescription of store.prescriptions) {
    assert.ok(prescription.medicationRequestIds.length >= 1);
    prescription.medicationRequestIds.forEach((id) => assert.ok(medicationIds.has(id), `missing medication ${id}`));
  }
  for (const dispense of store.dispenses) assert.ok(prescriptionIds.has(dispense.prescriptionId));
  for (const charge of store.billingCharges) assert.ok(encounterIds.has(charge.encounterId));
});

test('部門データと外部連携データは臨床的な有無のばらつきを持つ', () => {
  const store = createStore();

  assert.ok(store.records.length >= 200);
  assert.ok(store.medicationRequests.length > 110);
  assert.ok(store.injectionOrders.length >= 25 && store.injectionOrders.length < 100);
  assert.ok(store.imagingOrders.length >= 30 && store.imagingOrders.length < 100);
  assert.ok(store.documents.length >= 45 && store.documents.length < 100);
  assert.ok(store.summaries.length >= 30 && store.summaries.length < 100);
  assert.ok(store.receivedBundles.length >= 15 && store.receivedBundles.length < 100);
  assert.ok(store.sentBundles.length >= 15 && store.sentBundles.length < 100);
  assert.ok(store.rehabilitationPlans.length >= 50 && store.rehabilitationPlans.length < 100);
  assert.ok(store.rehabilitationPlans.every((item) => item.rehabilitationClass && item.primaryDiagnosis && item.impairments.length && item.risks.length && item.goal));
  assert.ok(store.rehabilitationPlans.some((item) => item.entryExit === '入院'));
  assert.ok(store.rehabilitationPlans.some((item) => item.entryExit === '外来'));
  assert.ok(store.labOrders.some((item) => item.status === 'requested'));
  assert.ok(store.labOrders.some((item) => item.status === 'completed'));
  assert.ok(store.prescriptions.some((item) => item.status === 'submitted'));
  assert.ok(store.prescriptions.some((item) => item.status === 'dispensed'));
});

test('各患者のFHIR Bundleに診療情報を、リハ対象患者には依頼と受診情報を含む', () => {
  const store = createStore();

  for (const patient of store.patients) {
    const bundle = patientBundle(store, patient.id);
    const resources = bundle.entry.map((entry) => entry.resource);
    const resourceTypes = new Set(resources.map((resource) => resource.resourceType));
    assert.ok(resourceTypes.has('Patient'));
    assert.ok(resourceTypes.has('Condition'));
    assert.ok(resourceTypes.has('MedicationRequest'));
    assert.ok(resources.some((resource) => resource.resourceType === 'Observation' && resource.category?.[0]?.coding?.[0]?.code === 'laboratory'));
    assert.ok(resources.some((resource) => resource.resourceType === 'Observation' && resource.category?.[0]?.coding?.[0]?.code === 'vital-signs'));
    assert.ok(resourceTypes.has('Encounter'));
    const hospitalization = resources.find((resource) => resource.resourceType === 'Encounter' && resource.class?.code === 'IMP');
    assert.ok(hospitalization?.period?.start, `${patient.id} FHIR Bundle must include a hospitalization start date`);
    const rehabilitationPlan = store.rehabilitationPlans.find((item) => item.patientId === patient.id);
    assert.equal(resourceTypes.has('ServiceRequest'), Boolean(rehabilitationPlan));
    if (rehabilitationPlan) {
      const request = resources.find((resource) => resource.resourceType === 'ServiceRequest');
      assert.equal(request.subject.reference, `Patient/${patient.id}`);
      assert.equal(request.category[0].coding[0].code, 'rehabilitation');
      assert.ok(request.extension.some((item) => item.url.endsWith('/rehabilitation-class')));
      assert.ok(request.extension.some((item) => item.url.endsWith('/fim-total')));
    }
  }
});

test('スマリハ連携済み10名は電カルと同一の患者基本情報・リハ計画を持つ', () => {
  const store = createStore();
  const patient = store.patients.find((item) => item.id === 'SR-DEMO260902');
  const plan = store.rehabilitationPlans.find((item) => item.patientId === patient.id);

  assert.deepEqual({ name: patient.name, birthDate: patient.birthDate, department: patient.department }, {
    name: '鈴木 正一', birthDate: '1952-11-03', department: '整形外科'
  });
  assert.equal(plan.rehabilitationClass, '運動器');
  assert.equal(plan.primaryDiagnosis, '右大腿骨頸部骨折術後');
  assert.equal(plan.entryExit, '入院');
  assert.equal(plan.wardName, '回復期2階B');
  assert.deepEqual(plan.professions, ['PT', 'OT']);
});
