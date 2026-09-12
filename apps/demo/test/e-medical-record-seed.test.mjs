import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from '../e-medical-record-mock/src/store.mjs';
import { patientBundle } from '../e-medical-record-mock/src/fhir.mjs';

const patientScopedCollections = [
  'encounters', 'conditions', 'records', 'vitalSigns', 'medicationRequests',
  'prescriptions', 'labOrders', 'eligibilityChecks', 'appointments', 'billingCharges',
  'patientContexts', 'careTeams', 'patientConsents', 'activities', 'documents'
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
    assert.ok(patient.functionalStatus);
    assert.ok(patient.communicationNeeds);
    assert.ok(patient.infectionPrecautions);
    assert.ok(patient.careContext?.careSetting);
    assert.ok(patient.careContext?.location);
    assert.ok(patient.careContext?.nextAction);
    assert.ok(patient.careContext?.clinicalRisks);
    const condition = store.conditions.find((item) => item.patientId === patient.id);
    assert.ok(condition?.code, `condition is required for ${patient.id}`);
    if (!patient.smartRehabId) {
      assert.equal(condition.code, expectedConditionCodes[patient.department], `condition must match ${patient.department}`);
    }
    const rehabilitationPlan = store.rehabilitationPlans.find((item) => item.patientId === patient.id);
    if (rehabilitationPlan) {
      assert.ok(rehabilitationPlan.primaryDiagnosis);
      assert.ok(rehabilitationPlan.rehabilitationClass);
      assert.ok(rehabilitationPlan.startDate);
    }
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
  assert.equal(store.documents.length, 100);
  assert.ok(store.summaries.length >= 30 && store.summaries.length < 100);
  assert.ok(store.receivedBundles.length >= 15 && store.receivedBundles.length < 100);
  assert.ok(store.sentBundles.length >= 15 && store.sentBundles.length < 100);
  assert.ok(store.rehabilitationPlans.length >= 50 && store.rehabilitationPlans.length < 100);
  assert.ok(store.labOrders.some((item) => item.status === 'requested'));
  assert.ok(store.labOrders.some((item) => item.status === 'completed'));
  assert.ok(store.prescriptions.some((item) => item.status === 'submitted'));
  assert.ok(store.prescriptions.some((item) => item.status === 'dispensed'));
  assert.ok(store.activities.length >= 250);
  assert.equal(new Set(store.activities.map((item) => item.moduleId)).size, 19);
  assert.equal(store.patientContexts.length, 100);
  assert.equal(store.careTeams.length, 100);
  assert.equal(store.patientConsents.length, 400);
  assert.ok(store.nursingRecords.length >= 45);
});

test('100名全員が最新病院モックの患者コンテキストと業務データを持つ', () => {
  const store = createStore();
  for (const patient of store.patients) {
    const context = store.patientContexts.find((item) => item.patientId === patient.id);
    const team = store.careTeams.find((item) => item.patientId === patient.id);
    const consents = store.patientConsents.filter((item) => item.patientId === patient.id);
    const activities = store.activities.filter((item) => item.patientId === patient.id);
    assert.equal(patient.careContext.id, context.id);
    assert.ok(team.members.length >= 3, `care team is required for ${patient.id}`);
    assert.equal(consents.length, 4, `four consent purposes are required for ${patient.id}`);
    assert.ok(activities.length >= 2, `hospital activities are required for ${patient.id}`);
    if (context.careSetting === '入院') {
      assert.ok(store.admissions.some((item) => item.patientId === patient.id && item.status === 'admitted'));
      assert.ok(store.nursingRecords.some((item) => item.patientId === patient.id));
    }
    if (context.careSetting === '救急外来') assert.ok(context.triage?.level);
  }
});

test('架空大学病院の職員・勤務・受け持ち・申し送り・指示が入院患者へ整合している', () => {
  const store = createStore();
  const staffIds = new Set(store.staffMembers.map((item) => item.id));
  assert.equal(store.hospitalProfile.name, '慶応技術大学病院');
  assert.equal(store.hospitalProfile.dataClassification, 'FICTIONAL_DEMO');
  assert.equal(store.organizationUnits.length, 32);
  assert.equal(store.staffMembers.length, 61);
  assert.equal(store.staffMembers.filter((item) => item.role === 'physician').length, 14);
  assert.equal(store.staffMembers.filter((item) => item.role === 'nurse').length, 33);
  assert.equal(store.shiftAssignments.length, 27);
  assert.ok(store.staffMembers.every((item) => item.dataClassification === 'FICTIONAL_DEMO'));
  assert.ok(store.staffMembers.every((item) => item.professionalLicenseId.startsWith('DEMO-')));
  assert.ok(store.shiftAssignments.every((item) => staffIds.has(item.staffId)));

  for (const admission of store.admissions.filter((item) => item.status === 'admitted')) {
    const assignments = store.patientAssignments.filter((item) => item.admissionId === admission.id);
    const nurseShifts = new Set(assignments.filter((item) => item.profession === 'nurse').map((item) => item.shiftCode));
    assert.equal(assignments.length, 4, `four accountable staff assignments are required for ${admission.id}`);
    assert.deepEqual(nurseShifts, new Set(['day', 'evening', 'night']));
    assert.ok(assignments.every((item) => staffIds.has(item.staffId)));
    assert.equal(store.handoffs.filter((item) => item.admissionId === admission.id).length, 2);
    assert.equal(store.clinicalInstructions.filter((item) => item.admissionId === admission.id).length, 2);
    assert.equal(store.teamConferences.filter((item) => item.admissionId === admission.id).length, 1);
  }
});

test('各患者のFHIR Bundleに患者・傷病・処方・検査・バイタルを含む', () => {
  const store = createStore();

  for (const patient of store.patients) {
    const bundle = patientBundle(store, patient.id);
    const resources = bundle.entry.map((entry) => entry.resource);
    const resourceTypes = new Set(resources.map((resource) => resource.resourceType));
    assert.ok(resourceTypes.has('Patient'));
    assert.ok(resourceTypes.has('Condition'));
    assert.ok(resourceTypes.has('MedicationRequest'));
    assert.ok(resourceTypes.has('Organization'));
    assert.ok(resourceTypes.has('Practitioner'));
    assert.ok(resourceTypes.has('CareTeam'));
    assert.ok(resourceTypes.has('Consent'));
    assert.ok(resources.some((resource) => resource.resourceType === 'Observation' && resource.category?.[0]?.coding?.[0]?.code === 'laboratory'));
    assert.ok(resources.some((resource) => resource.resourceType === 'Observation' && resource.category?.[0]?.coding?.[0]?.code === 'vital-signs'));
  }
});

test('入院患者のFHIR Bundleに画像・薬剤実施・手術の専用リソースを含む', () => {
  const store = createStore(); const bundle = patientBundle(store, 'P0001001');
  const resources = bundle.entry.map((entry) => entry.resource); const types = new Set(resources.map((resource) => resource.resourceType));
  assert.ok(types.has('DiagnosticReport')); assert.ok(types.has('MedicationAdministration')); assert.ok(types.has('Procedure'));
  const report = resources.find((resource) => resource.resourceType === 'DiagnosticReport'); assert.equal(report.category[0].coding[0].code, 'RAD'); assert.ok(report.conclusion);
  const administration = resources.find((resource) => resource.resourceType === 'MedicationAdministration'); assert.equal(administration.subject.reference, 'Patient/P0001001'); assert.ok(administration.performer[0].actor.reference.startsWith('Practitioner/'));
  const procedure = resources.find((resource) => resource.resourceType === 'Procedure'); assert.equal(procedure.subject.reference, 'Patient/P0001001'); assert.ok(['preparation', 'in-progress', 'completed'].includes(procedure.status));
});

test('高度診療データと職員参照が架空病院データへ整合している', () => {
  const store = createStore();
  const patientIds = new Set(store.patients.map((item) => item.id));
  const staffIds = new Set(store.staffMembers.map((item) => item.id));
  const advancedCollections = ['imagingReports', 'pharmacyReviews', 'medicationAdministrations', 'surgicalCases', 'anesthesiaRecords', 'transfusionOrders', 'pathologySpecimens', 'microbiologyResults', 'dialysisSessions', 'chemotherapyRegimens', 'icuFlowsheets', 'infectionControlCases', 'dpcEpisodes', 'claimSubmissions', 'dischargePlans'];
  const expectedCounts = [51, 131, 26, 5, 5, 4, 12, 10, 6, 6, 3, 10, 15, 100, 15];
  advancedCollections.forEach((name, index) => {
    assert.equal(store[name].length, expectedCounts[index], `${name} count`);
    assert.ok(store[name].every((item) => patientIds.has(item.patientId)), `${name} patient reference`);
    assert.ok(store[name].every((item) => item.dataClassification === 'FICTIONAL_DEMO'), `${name} classification`);
  });
  assert.equal(store.masters.length, 38);
  assert.equal(store.inventory.length, 20);
  assert.equal(store.labOrders.filter((item) => item.resultDetail).length, 89);
  assert.ok(store.labOrders.filter((item) => item.status === 'completed').every((item) => Number.isFinite(item.resultDetail.value) && item.resultDetail.unit && item.resultDetail.referenceRange.text && ['H', 'L', 'N'].includes(item.resultDetail.interpretation)));
  assert.ok(store.activities.every((item) => staffIds.has(item.assignedStaffId)));
  assert.ok(store.nursingRecords.every((item) => staffIds.has(item.authorStaffId)));
  assert.ok(store.records.every((item) => staffIds.has(item.authorStaffId)));
  assert.ok(store.medicationRequests.every((item) => staffIds.has(item.requesterStaffId)));
  for (const admission of store.admissions) {
    assert.ok(store.dpcEpisodes.some((item) => item.admissionId === admission.id));
    assert.ok(store.dischargePlans.some((item) => item.admissionId === admission.id));
    assert.ok(store.medicationAdministrations.filter((item) => item.admissionId === admission.id)
      .every((item) => item.patientId === admission.patientId));
  }
});

test('現場運用データは閉ループ安全管理と外部接続境界を架空データで表す', () => {
  const store = createStore();
  const patientIds = new Set(store.patients.map((item) => item.id));
  const patientCollections = [
    'medicationReconciliations', 'medicationSafetyAlerts', 'criticalResultAlerts',
    'clinicalTasks', 'nursingRiskAssessments', 'recordLifecycleCases', 'claimAdjudications'
  ];
  for (const name of patientCollections) {
    assert.ok(store[name].length > 0, `${name} must not be empty`);
    assert.ok(store[name].every((item) => patientIds.has(item.patientId)), `${name} patient reference`);
    assert.ok(store[name].every((item) => item.dataClassification === 'FICTIONAL_DEMO' && item.version === 1), `${name} classification and version`);
  }
  assert.equal(store.integrationEndpoints.length, 14);
  assert.ok(store.integrationEndpoints.every((item) => item.status === 'connection-test-required'));
  assert.ok(store.integrationEndpoints.every((item) => item.mode === 'mock-boundary-only' && item.lastSuccessfulConnectionAt === null));
  assert.equal(store.downtimeProcedures.length, 8);
  assert.equal(store.academicPrograms.length, 9);
  assert.equal(store.masterDataReleases.length, 7);
});

test('スマリハ連携済み10名は最新版電カルの架空患者・リハ計画へ一致する', () => {
  const store = createStore();
  const linkedPatients = store.patients.filter((item) => item.smartRehabId);
  assert.equal(linkedPatients.length, 10);
  assert.ok(linkedPatients.every((item) => item.smartRehabId === item.id));

  const patient = linkedPatients.find((item) => item.id === 'SR-DEMO260902');
  const plan = store.rehabilitationPlans.find((item) => item.patientId === patient.id);
  assert.deepEqual({ name: patient.name, birthDate: patient.birthDate, department: patient.department }, {
    name: '鈴木 正一', birthDate: '1952-11-03', department: '整形外科'
  });
  assert.equal(patient.dataClassification, 'FICTIONAL_DEMO');
  assert.equal(patient.careContext.careSetting, '外来');
  assert.equal(plan.rehabilitationClass, '運動器');
  assert.equal(plan.primaryDiagnosis, '右大腿骨頸部骨折術後');
  assert.equal(plan.entryExit, '外来');
  assert.equal(plan.wardName, '整形外科外来');
  assert.deepEqual(plan.professions, ['PT', 'OT']);
});
