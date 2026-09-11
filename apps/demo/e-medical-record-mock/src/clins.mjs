import { createHash } from 'node:crypto';

export const clinsVersion = '1.13.0';
export const fictionalInstitutionNumber = '1319999999';
const localPatientSystem = `urn:oid:1.2.392.100495.20.3.51.1${fictionalInstitutionNumber}`;
const institutionExtensionUrl = 'http://jpfhir.jp/fhir/clins/Extension/StructureDefinition/JP_eCS_InstitutionNumber';
const departmentExtensionUrl = 'http://jpfhir.jp/fhir/eCS/Extension/StructureDefinition/JP_eCS_Department';
const resourceIdentifierSystem = 'http://jpfhir.jp/fhir/core/IdSystem/resourceInstance-identifier';
const clinicalStatusSystem = 'http://terminology.hl7.org/CodeSystem/condition-clinical';
const verificationStatusSystem = 'http://terminology.hl7.org/CodeSystem/condition-ver-status';
const allergyClinicalStatusSystem = 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical';
const allergyVerificationStatusSystem = 'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification';
const medicationUnitSystem = 'http://jpfhir.jp/fhir/core/mhlw/CodeSystem/MedicationUnitMERIT9Code';
const medicationUnitCodes = { '錠': 'TAB', 'カプセル': 'CAP', '回分': 'DOSE', '枚': 'SHT', '包': 'PCK', '本': 'HON', '個': 'KO', 'mL': 'ML', 'mg': 'MG', 'g': 'G' };
const standardDiseaseCodes = Object.freeze({
  '高血圧症': { code: '20061593', display: '高血圧症' },
  '変形性膝関節症': { code: '20075847', display: '変形性膝関節症' },
  '慢性心不全': { code: '20076499', display: '慢性心不全' },
  '脳梗塞後遺症': { code: '20073150', display: '脳梗塞後遺症' },
  '右大腿骨頸部骨折術後': { code: '20069597', display: '大腿骨頚部骨折' },
  '肺炎後廃用症候群': { code: '20083830', display: '廃用症候群' },
  '慢性呼吸不全': { code: '20076428', display: '慢性呼吸不全' },
  '術後廃用症候群': { code: '20083830', display: '廃用症候群' },
  '腰椎圧迫骨折': { code: '20061755', display: '腰椎圧迫骨折' },
  '気管支喘息': { code: '20057913', display: '気管支喘息' },
  '2型糖尿病': { code: '20050020', display: '２型糖尿病' },
  '逆流性食道炎': { code: '20058108', display: '逆流性食道炎' },
  '廃用症候群': { code: '20083830', display: '廃用症候群' }
});
const clinsIcd10Overrides = Object.freeze({ 'S72.0': 'S7200', 'S32.0': 'S3200' });
const clinsIcd10Displays = Object.freeze({
  I10: '本態性（原発性＜一次性＞）高血圧（症）', M179: '膝関節症，詳細不明', I509: '心不全，詳細不明', I693: '脳梗塞の続発・後遺症',
  S7200: '大腿骨頚部骨折，閉鎖性', J961: '慢性呼吸不全', R53: '倦怠（感）及び疲労', S3200: '腰椎骨折，閉鎖性',
  J459: '喘息，詳細不明', E119: '２型＜インスリン非依存性＞糖尿病＜NIDDM＞，合併症を伴わないもの', K219: '食道炎を伴わない胃食道逆流症'
});

function uuidFor(value) {
  const hex = createHash('sha256').update(value).digest('hex').slice(0, 32).split('');
  hex[12] = '5'; hex[16] = ((Number.parseInt(hex[16], 16) & 3) | 8).toString(16);
  return `${hex.slice(0, 8).join('')}-${hex.slice(8, 12).join('')}-${hex.slice(12, 16).join('')}-${hex.slice(16, 20).join('')}-${hex.slice(20).join('')}`;
}

function splitName(text) {
  const parts = String(text).trim().split(/\s+/); return { family: parts[0], given: parts.slice(1).length ? parts.slice(1) : ['氏名未登録'] };
}

function xhtml(text) {
  const escaped = String(text || '').replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
  return `<div xmlns="http://www.w3.org/1999/xhtml">${escaped}</div>`;
}

function patientEntry(patient, timestamp) {
  const kanji = splitName(patient.name); const kana = splitName(patient.kana);
  const insurance = patient.insurance || {};
  const insuranceValue = `${String(insurance.insurerNumber || '99999999').padStart(8, '9').slice(0, 8)}:${insurance.symbol || '架空'}:${insurance.number || patient.id}:${insurance.branchNumber || '00'}`;
  return {
    fullUrl: `urn:uuid:${uuidFor(`clins-patient-${patient.id}`)}`,
    resource: {
      resourceType: 'Patient', id: `CLINS-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Patient_eCS|${clinsVersion}`] },
      identifier: [
        { system: localPatientSystem, value: patient.id },
        { system: 'http://jpfhir.jp/fhir/clins/Idsystem/JP_Insurance_memberID', value: insuranceValue }
      ],
      name: [
        { extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/iso21090-EN-representation', valueCode: 'IDE' }], text: patient.name, family: kanji.family, given: kanji.given },
        { extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/iso21090-EN-representation', valueCode: 'SYL' }], text: patient.kana, family: kana.family, given: kana.given }
      ],
      gender: patient.gender || 'unknown', birthDate: patient.birthDate,
      address: [{ text: patient.address || '東京都架空区1-1', postalCode: patient.postalCode || '100-0001' }]
    }
  };
}

function institutionExtension() {
  return { url: institutionExtensionUrl, valueIdentifier: { system: 'http://jpfhir.jp/fhir/core/IdSystem/insurance-medical-institution-no', value: fictionalInstitutionNumber } };
}

function clinicalExtensions(patient) {
  return [institutionExtension(), { url: departmentExtensionUrl, valueCodeableConcept: { text: patient.department || '内科' } }];
}

function clinicalBundle(patient, resourceType, resource, timestamp) {
  const patientItem = patientEntry(patient, timestamp);
  resource.subject = resource.subject || { reference: patientItem.fullUrl };
  if (resource.resourceType === 'AllergyIntolerance') {
    delete resource.subject; resource.patient = { reference: patientItem.fullUrl };
  }
  return {
    resourceType: 'Bundle', id: `CLINS-${resourceType.toUpperCase()}-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/clins/StructureDefinition/JP_Bundle_CLINS|${clinsVersion}`], tag: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/BundleResourceType_CS', code: resourceType }] },
    identifier: { system: 'http://jpfhir.jp/fhir/clins/bundle-identifier', value: `${fictionalInstitutionNumber}^${timestamp.slice(0, 4)}^${patient.id.replace(/[^A-Za-z0-9-]/g, '').slice(0, 24)}-${resourceType.slice(0, 4).toUpperCase()}` },
    type: 'collection', timestamp,
    entry: [patientItem, { fullUrl: `urn:uuid:${uuidFor(`clins-${resourceType}-${patient.id}`)}`, resource }]
  };
}

function containedEncounter(patient, sourceId, timestamp) {
  const id = `ENC-${sourceId}`;
  return {
    resourceType: 'Encounter', id, language: 'ja',
    meta: { profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Encounter_eCS|${clinsVersion}`] },
    identifier: [{ system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}-${sourceId}` }],
    status: 'finished',
    class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: patient.careContext?.careSetting === '入院' ? 'IMP' : 'AMB', display: patient.careContext?.careSetting === '入院' ? 'inpatient encounter' : 'ambulatory' }
  };
}

export function clinsConditionBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  const condition = store.conditions.find((item) => item.patientId === patientId);
  if (!patient || !condition) return null;
  const standardDisease = standardDiseaseCodes[condition.display];
  if (!standardDisease) return null;
  const timestamp = new Date(condition.recordedDate || '2026-09-11T00:00:00+09:00').toISOString();
  const clinicalCode = condition.clinicalStatus || 'active';
  const verificationCode = condition.verificationStatus || 'confirmed';
  const encounter = containedEncounter(patient, condition.id, timestamp);
  const icd10Code = clinsIcd10Overrides[condition.code] || String(condition.code).replace(/\./g, '');
  const resource = {
    resourceType: 'Condition', id: `CLINS-${condition.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Condition_eCS|${clinsVersion}`] },
    extension: clinicalExtensions(patient),
    contained: [encounter],
    identifier: [{ system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}-${condition.id}` }],
    clinicalStatus: { coding: [{ system: clinicalStatusSystem, code: clinicalCode, display: clinicalCode === 'active' ? 'Active' : clinicalCode }] },
    verificationStatus: { coding: [{ system: verificationStatusSystem, code: verificationCode, display: verificationCode === 'confirmed' ? 'Confirmed' : verificationCode }] },
    category: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-category', code: 'problem-list-item', display: 'Problem List Item' }] }],
    code: { coding: [
      { system: 'http://medis.or.jp/CodeSystem/master-disease-keyNumber', code: standardDisease.code, display: standardDisease.display },
      { system: 'http://jpfhir.jp/fhir/core/mhlw/CodeSystem/ICD10-2013-full', code: icd10Code, display: clinsIcd10Displays[icd10Code] || condition.display }
    ], text: condition.display },
    subject: undefined, encounter: { reference: `#${encounter.id}` }, onsetDateTime: timestamp, recordedDate: timestamp
  };
  return clinicalBundle(patient, 'Condition', resource, timestamp);
}

export function clinsAllergyBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  if (!patient) return null;
  const timestamp = patient.careContext?.lastUpdatedAt || '2026-09-11T09:00:00+09:00';
  const allergy = patient.allergies?.[0];
  const allergyCoding = allergy === 'ペニシリン'
    ? { system: 'http://snomed.info/sct', code: '764146007', display: 'Penicillin' }
    : allergy === 'ヨード造影剤'
      ? { system: 'http://snomed.info/sct', code: '418815008', display: 'Iodinated contrast media' }
      : { system: 'http://snomed.info/sct', code: '716186003', display: 'No known allergy' };
  const resource = {
    resourceType: 'AllergyIntolerance', id: `CLINS-ALG-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_AllergyIntolerance_eCS|${clinsVersion}`] },
    extension: clinicalExtensions(patient),
    identifier: [{ system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}-ALG-${patient.id}` }],
    clinicalStatus: { coding: [{ system: allergyClinicalStatusSystem, code: 'active', display: 'Active' }] },
    verificationStatus: { coding: [{ system: allergyVerificationStatusSystem, code: 'confirmed', display: 'Confirmed' }] },
    type: 'allergy', category: [allergy === 'ヨード造影剤' ? 'environment' : 'medication'], criticality: allergy ? 'high' : 'unable-to-assess',
    code: { coding: [allergyCoding], text: allergy || '既知のアレルギーなし' },
    recordedDate: timestamp
  };
  return clinicalBundle(patient, 'AllergyIntolerance', resource, timestamp);
}

export function clinsMedicationBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  const order = store.medicationRequests.find((item) => item.patientId === patientId);
  if (!patient || !order) return null;
  const timestamp = order.authoredOn;
  const categoryCode = patient.careContext?.careSetting === '入院' ? 'IHP' : 'OHP';
  const resource = {
    resourceType: 'MedicationRequest', id: `CLINS-${order.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_MedicationRequest_eCS|${clinsVersion}`] },
    extension: clinicalExtensions(patient),
    identifier: [
      { system: 'http://jpfhir.jp/fhir/core/mhlw/IdSystem/Medication-RPGroupNumber', value: '1' },
      { system: 'http://jpfhir.jp/fhir/core/mhlw/IdSystem/MedicationAdministrationIndex', value: '1' },
      { system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}-${order.id}` }
    ],
    status: 'completed', intent: 'order',
    category: [{ coding: [{ system: 'http://jpfhir.jp/fhir/core/CodeSystem/JP_MedicationCategoryMERIT9_CS', code: categoryCode, display: categoryCode === 'IHP' ? '入院処方' : '外来処方' }] }],
    medicationCodeableConcept: { coding: [{ system: 'http://jpfhir.jp/fhir/eCS/CodeSystem/MedicationCodeNocoded_CS', code: 'NOCODED', display: '標準コードなし' }], text: order.medicationDisplay },
    authoredOn: timestamp,
    dosageInstruction: [{
      extension: [{ url: 'http://jpfhir.jp/fhir/core/Extension/StructureDefinition/JP_MedicationDosage_PeriodOfUse', valuePeriod: { start: timestamp } }],
      text: order.dosageText,
      timing: { code: { coding: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/JP_CLINS_MedicationUsage_Uncoded_CS', code: '0X0XXXXXXXXX0000', display: 'ダミー用法コード' }], text: order.dosageText } },
      route: { text: order.route || '経口' }
    }],
    dispenseRequest: {
      quantity: { value: order.quantity, unit: order.unit, system: medicationUnitSystem, code: medicationUnitCodes[order.unit] || 'UNT' },
      expectedSupplyDuration: { value: order.days || 1, unit: '日', system: 'http://unitsofmeasure.org', code: 'd' }
    }
  };
  const patientItem = patientEntry(patient, timestamp); resource.subject = { reference: patientItem.fullUrl };
  return {
    resourceType: 'Bundle', id: `CLINS-MEDICATION-COLLECTION-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp }, type: 'collection', timestamp,
    entry: [patientItem, { fullUrl: `urn:uuid:${uuidFor(`clins-MedicationRequest-${patient.id}`)}`, resource }]
  };
}

function referralPractitionerEntry(name, id, timestamp) {
  return {
    fullUrl: `urn:uuid:${uuidFor(`referral-practitioner-${id}`)}`,
    resource: {
      resourceType: 'Practitioner', id, language: 'ja',
      meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Practitioner_eCS|${clinsVersion}`] },
      name: [{ extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/iso21090-EN-representation', valueCode: 'IDE' }], use: 'official', text: name }]
    }
  };
}

function referralOrganizationEntry({ id, number, name, department, timestamp }) {
  return {
    fullUrl: `urn:uuid:${uuidFor(`referral-organization-${id}`)}`,
    resource: {
      resourceType: 'Organization', id, language: 'ja',
      meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Organization_eCS'] },
      extension: [
        { url: 'http://jpfhir.jp/fhir/core/Extension/StructureDefinition/JP_Organization_PrefectureNo', valueCoding: { system: 'http://jpfhir.jp/fhir/core/mhlw/CodeSystem/PrefectureNo-2digits', code: '13' } },
        { url: 'http://jpfhir.jp/fhir/core/Extension/StructureDefinition/JP_Organization_InsuranceOrganizationCategory', valueCoding: { system: 'http://jpfhir.jp/fhir/core/mhlw/CodeSystem/MedicationFeeScoreType', code: '1' } },
        { url: 'http://jpfhir.jp/fhir/core/Extension/StructureDefinition/JP_Organization_InsuranceOrganizationNo', valueIdentifier: { system: 'http://jpfhir.jp/fhir/core/mhlw/IdSystem/MedicalOrganizationID', value: number.slice(3) } },
        { url: departmentExtensionUrl, valueCodeableConcept: { text: department } }
      ],
      identifier: [{ system: 'http://jpfhir.jp/fhir/core/IdSystem/insurance-medical-institution-no', value: number }],
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'prov' }] }],
      name, telecom: [{ system: 'phone', value: '03-0000-0000' }],
      address: [{ text: '東京都架空区1-1', postalCode: '100-0001', country: 'JP' }]
    }
  };
}

function referralSection(title, code, display, text, entries) {
  return {
    title, code: { coding: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/document-section', code, display }] },
    text: { status: 'additional', div: xhtml(text) }, ...(entries ? { entry: entries } : {})
  };
}

export function clinsReferralBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  const condition = store.conditions.find((item) => item.patientId === patientId);
  const medication = store.medicationRequests.find((item) => item.patientId === patientId);
  if (!patient || !condition || !medication) return null;
  const timestamp = '2026-09-11T12:00:00+09:00';
  const patientItem = patientEntry(patient, timestamp);
  const author = referralPractitionerEntry(patient.primaryPhysician || '架空 担当医', `REF-AUTH-${patient.id}`, timestamp);
  const recipient = referralPractitionerEntry('連携先 架空医師', `REF-TO-${patient.id}`, timestamp);
  const source = referralOrganizationEntry({ id: `REF-FROM-${patient.id}`, number: fictionalInstitutionNumber, name: '慶応技術大学病院（架空）', department: patient.department, timestamp });
  const destination = referralOrganizationEntry({ id: `REF-DEST-${patient.id}`, number: '1319999998', name: '連携先架空病院', department: '地域連携科', timestamp });
  const compositionFullUrl = `urn:uuid:${uuidFor(`referral-composition-${patient.id}`)}`;
  const allergyText = patient.allergies?.length ? patient.allergies.join('、') : '既知のアレルギーなし';
  const composition = {
    resourceType: 'Composition', id: `REF-COMP-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eReferral/StructureDefinition/JP_Composition_eReferral|${clinsVersion}`] },
    extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/composition-clinicaldocument-versionNumber', valueString: '1.0' }],
    identifier: { system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}^2026^${patient.id}-REF` },
    status: 'final',
    type: { coding: [{ system: 'http://jpfhir.jp/fhir/Common/CodeSystem/doc-typecodes', code: '57133-1', display: '診療情報提供書' }] },
    category: [{ coding: [{ system: 'http://jpfhir.jp/fhir/Common/CodeSystem/doc-subtypecodes', code: patient.careContext?.careSetting === '入院' ? 'INPATIENT' : 'OUTPATIENT', display: patient.careContext?.careSetting === '入院' ? '入院中文書' : '外来文書' }] }],
    subject: { reference: patientItem.fullUrl, type: 'Patient', display: patient.name }, date: timestamp,
    author: [{ reference: author.fullUrl, type: 'Practitioner', display: patient.primaryPhysician }, { reference: source.fullUrl, type: 'Organization', display: source.resource.name }],
    title: '診療情報提供書', custodian: { reference: source.fullUrl, type: 'Organization', display: source.resource.name },
    event: [{ code: [{ text: '診療情報提供書発行' }], period: { start: timestamp.slice(0, 10) } }],
    section: [
      referralSection('紹介元情報', '920', '紹介元情報セクション', `${source.resource.name} ${patient.department} ${patient.primaryPhysician}`, [{ reference: source.fullUrl, type: 'Organization' }, { reference: author.fullUrl, type: 'Practitioner' }]),
      referralSection('紹介先情報', '910', '紹介先情報セクション', `${destination.resource.name} 地域連携科 ${recipient.resource.name[0].text}`, [{ reference: destination.fullUrl, type: 'Organization' }, { reference: recipient.fullUrl, type: 'Practitioner' }]),
      {
        title: '構造情報', code: { coding: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/document-section', code: '300', display: '構造情報セクション' }] },
        section: [
          referralSection('紹介目的', '950', '紹介目的セクション', '継続診療と情報共有をお願いします。'),
          referralSection('傷病名・主訴', '340', '傷病名・主訴セクション', condition.display),
          referralSection('現病歴', '360', '現病歴セクション', `${condition.recordedDate.slice(0, 10)}から${condition.display}で診療中です。`),
          referralSection('アレルギー・不耐性反応', '510', 'アレルギー・不耐性反応セクション', allergyText),
          referralSection('感染症情報', '520', '感染症情報セクション', patient.infectionPrecautions || '標準予防策'),
          referralSection('投薬指示', '430', '投薬指示セクション', `${medication.medicationDisplay} ${medication.dosageText}`)
        ]
      },
      referralSection('備考・連絡情報', '220', '備考・連絡情報セクション', '全記載内容は架空データです。外部送信は行いません。')
    ]
  };
  return {
    resourceType: 'Bundle', id: `CLINS-REFERRAL-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/clins/StructureDefinition/JP_Bundle_eReferral|${clinsVersion}`] },
    identifier: { system: 'http://jpfhir.jp/fhir/clins/bundle-identifier', value: `${fictionalInstitutionNumber}^2026^${patient.id}-Referral` },
    type: 'document', timestamp,
    entry: [{ fullUrl: compositionFullUrl, resource: composition }, patientItem, author, recipient, source, destination]
  };
}

export function clinsDischargeSummaryBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  const condition = store.conditions.find((item) => item.patientId === patientId);
  const medication = store.medicationRequests.find((item) => item.patientId === patientId);
  if (!patient || !condition || !medication) return null;
  const timestamp = '2026-09-11T16:00:00+09:00';
  const admissionDate = patient.admission?.admittedAt?.slice(0, 10) || '2026-08-25';
  const dischargeDate = patient.admission?.dischargedAt?.slice(0, 10) || '2026-09-11';
  const patientItem = patientEntry(patient, timestamp);
  const author = referralPractitionerEntry(patient.primaryPhysician || '架空 担当医', `DIS-AUTH-${patient.id}`, timestamp);
  const organization = referralOrganizationEntry({ id: `DIS-ORG-${patient.id}`, number: fictionalInstitutionNumber, name: '慶応技術大学病院（架空）', department: patient.department, timestamp });
  const encounterFullUrl = `urn:uuid:${uuidFor(`discharge-encounter-${patient.id}`)}`;
  const encounter = {
    fullUrl: encounterFullUrl,
    resource: {
      resourceType: 'Encounter', id: `DIS-ENC-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Encounter_eCS|${clinsVersion}`] },
      identifier: [{ system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}-DIS-${patient.id}` }],
      status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'IMP', display: 'inpatient encounter' },
      subject: { reference: patientItem.fullUrl, display: patient.name },
      period: { start: `${admissionDate}T09:00:00+09:00`, end: `${dischargeDate}T15:00:00+09:00` }
    }
  };
  const courseFullUrl = `urn:uuid:${uuidFor(`discharge-course-${patient.id}`)}`;
  const course = {
    fullUrl: courseFullUrl,
    resource: {
      resourceType: 'DocumentReference', id: `DIS-COURSE-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/core/StructureDefinition/JP_DocumentReference'] },
      status: 'current', type: { text: '入院中経過' }, subject: { reference: patientItem.fullUrl }, date: timestamp,
      content: [{ attachment: { contentType: 'text/plain', language: 'ja', data: Buffer.from(`${condition.display}に対して診療を行い、状態は安定しました。`).toString('base64'), title: '入院中経過（架空）' } }]
    }
  };
  const compositionFullUrl = `urn:uuid:${uuidFor(`discharge-composition-${patient.id}`)}`;
  const ref = (fullUrl, type) => [{ reference: fullUrl, type }];
  const structured = {
    title: '構造情報',
    code: { coding: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/document-section', code: '300', display: '構造情報セクション' }] },
    section: [
      referralSection('入院時詳細', '322', '入院時詳細セクション', `${admissionDate} 入院`, ref(encounterFullUrl, 'Encounter')),
      referralSection('入院時診断', '342', '入院時診断セクション', condition.display),
      referralSection('主訴', '352', '主訴セクション', condition.display),
      referralSection('入院理由', '312', '入院理由セクション', `${condition.display}の精査・加療`),
      referralSection('現病歴', '360', '現病歴セクション', `${condition.recordedDate.slice(0, 10)}から診療継続中`),
      referralSection('入院中経過', '333', '入院中経過セクション', '治療により全身状態は安定しました。', ref(courseFullUrl, 'DocumentReference')),
      referralSection('退院時詳細', '324', '退院時詳細セクション', `${dischargeDate} 退院`, ref(encounterFullUrl, 'Encounter')),
      referralSection('退院時診断', '344', '退院時診断セクション', condition.display),
      referralSection('退院時投薬指示', '444', '退院時投薬指示セクション', `${medication.medicationDisplay} ${medication.dosageText}`),
      referralSection('退院時方針指示', '424', '退院時方針指示セクション', '外来で継続診療し、症状増悪時は受診してください。')
    ]
  };
  const composition = {
    resourceType: 'Composition', id: `DIS-COMP-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eDischargeSummary/StructureDefinition/JP_Composition_eDischargeSummary|${clinsVersion}`] },
    extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/composition-clinicaldocument-versionNumber', valueString: '1.0' }],
    identifier: { system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}^2026^${patient.id}-DIS` },
    status: 'final',
    type: { coding: [{ system: 'http://jpfhir.jp/fhir/Common/CodeSystem/doc-typecodes', code: '18842-5', display: '退院時サマリー' }] },
    category: [{ coding: [{ system: 'http://jpfhir.jp/fhir/Common/CodeSystem/doc-subtypecodes', code: 'DISCHARGE', display: '退院時文書' }] }],
    subject: { reference: patientItem.fullUrl, type: 'Patient', display: patient.name },
    encounter: { reference: encounterFullUrl, type: 'Encounter' }, date: timestamp,
    author: [{ reference: author.fullUrl, type: 'Practitioner', display: patient.primaryPhysician }, { reference: organization.fullUrl, type: 'Organization', display: organization.resource.name }],
    title: '退院時サマリー', custodian: { reference: organization.fullUrl, type: 'Organization', display: organization.resource.name },
    event: [{ period: { start: `${admissionDate}T09:00:00+09:00`, end: `${dischargeDate}T15:00:00+09:00` } }],
    section: [structured]
  };
  return {
    resourceType: 'Bundle', id: `CLINS-DISCHARGE-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/clins/StructureDefinition/JP_Bundle_eDischargeSummary|${clinsVersion}`] },
    identifier: { system: 'http://jpfhir.jp/fhir/clins/bundle-identifier', value: `${fictionalInstitutionNumber}^2026^${patient.id}-Discharge` },
    type: 'document', timestamp,
    entry: [{ fullUrl: compositionFullUrl, resource: composition }, patientItem, author, organization, encounter, course]
  };
}

export function clinsPatientSummaryBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  const conditionBundle = clinsConditionBundle(store, patientId);
  if (!patient || !conditionBundle) return null;
  const timestamp = '2026-09-11T17:00:00+09:00';
  const patientItem = patientEntry(patient, timestamp);
  const practitioner = referralPractitionerEntry(patient.primaryPhysician || '架空 担当医', `PCS-AUTH-${patient.id}`, timestamp);
  const organization = referralOrganizationEntry({ id: `PCS-ORG-${patient.id}`, number: fictionalInstitutionNumber, name: '慶応技術大学病院（架空）', department: patient.department, timestamp });
  const encounterFullUrl = `urn:uuid:${uuidFor(`pcs-encounter-${patient.id}`)}`;
  const careSettingInpatient = patient.careContext?.careSetting === '入院';
  const encounter = {
    fullUrl: encounterFullUrl,
    resource: {
      resourceType: 'Encounter', id: `PCS-ENC-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Encounter_eCS|${clinsVersion}`] },
      identifier: [{ system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}-PCS-${patient.id}` }], status: 'finished',
      class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: careSettingInpatient ? 'IMP' : 'AMB', display: careSettingInpatient ? 'inpatient encounter' : 'ambulatory' },
      subject: { reference: patientItem.fullUrl }, period: { start: '2026-09-01T09:00:00+09:00', end: timestamp }
    }
  };
  const carePlanFullUrl = `urn:uuid:${uuidFor(`pcs-care-plan-${patient.id}`)}`;
  const carePlan = {
    fullUrl: carePlanFullUrl,
    resource: {
      resourceType: 'CarePlan', id: `PCS-PLAN-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_CarePlan_ePCS|${clinsVersion}`] },
      identifier: [{ system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}-PCS-PLAN-${patient.id}` }],
      status: 'active', intent: 'plan', title: '療養計画',
      description: '服薬を継続し、定期受診と生活機能の維持を図ります。全内容は架空です。',
      subject: { reference: patientItem.fullUrl },
      period: { start: '2026-09-11', end: '2026-12-11' }, created: timestamp
    }
  };
  const sourceCondition = conditionBundle.entry[1];
  sourceCondition.resource.subject = { reference: patientItem.fullUrl };
  const compositionFullUrl = `urn:uuid:${uuidFor(`pcs-composition-${patient.id}`)}`;
  const composition = {
    resourceType: 'Composition', id: `PCS-COMP-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/ePCS/StructureDefinition/JP_Composition_ePCS|${clinsVersion}`] },
    extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/composition-clinicaldocument-versionNumber', valueString: '1.0' }],
    identifier: { system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}^2026^${patient.id}-PCS` }, status: 'final',
    type: { coding: [{ system: 'http://jpfhir.jp/fhir/Common/CodeSystem/doc-typecodes', code: '56447-6', display: '計画書' }] },
    category: [{ coding: [{ system: 'http://jpfhir.jp/fhir/Common/CodeSystem/doc-subtypecodes', code: careSettingInpatient ? 'INPATIENT' : 'OUTPATIENT', display: careSettingInpatient ? '入院中文書' : '外来文書' }] }],
    subject: { reference: patientItem.fullUrl, type: 'Patient', display: patient.name }, encounter: { reference: encounterFullUrl, type: 'Encounter' }, date: timestamp,
    author: [{ reference: practitioner.fullUrl, type: 'Practitioner', display: patient.primaryPhysician }, { reference: organization.fullUrl, type: 'Organization', display: organization.resource.name }],
    title: '患者サマリー（療養計画書）',
    section: [{
      title: '計画サマリー',
      code: { coding: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/document-section', code: '422', display: '計画サマリーセクション' }] },
      entry: [{ reference: carePlanFullUrl, type: 'CarePlan' }, { reference: sourceCondition.fullUrl, type: 'Condition' }]
    }]
  };
  return {
    resourceType: 'Bundle', id: `CLINS-PCS-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/clins/StructureDefinition/JP_Bundle_ePCS|${clinsVersion}`] },
    identifier: { system: 'http://jpfhir.jp/fhir/clins/bundle-identifier', value: `${fictionalInstitutionNumber}^2026^${patient.id}-PCS` },
    type: 'document', timestamp,
    entry: [{ fullUrl: compositionFullUrl, resource: composition }, patientItem, practitioner, organization, encounter, carePlan, sourceCondition]
  };
}

export function healthCheckupBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  if (!patient) return null;
  const timestamp = '2026-09-11T18:00:00+09:00';
  const checkupDate = '2026-09-11';
  const patientItem = patientEntry(patient, timestamp);
  patientItem.resource.meta.profile = ['http://jpfhir.jp/fhir/clins/StructureDefinition/JP_Patient_eCheckupGeneral'];
  for (const name of patientItem.resource.name) name.use = 'official';
  const practitioner = referralPractitionerEntry(patient.primaryPhysician || '架空 健診医', `CHECK-AUTH-${patient.id}`, timestamp);
  practitioner.resource.meta.profile = ['http://jpfhir.jp/fhir/eCheckup/StructureDefinition/JP_Practitioner_eCheckupGeneral'];
  const organizationFullUrl = `urn:uuid:${uuidFor(`checkup-organization-${patient.id}`)}`;
  const organization = {
    fullUrl: organizationFullUrl,
    resource: {
      resourceType: 'Organization', id: `CHECK-ORG-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/eCheckup/StructureDefinition/JP_Organization_eCheckupGeneral'] },
      extension: [{ url: departmentExtensionUrl, valueCodeableConcept: { text: '健診センター' } }],
      identifier: [{ system: 'http://jpfhir.jp/fhir/core/IdSystem/insurance-medical-institution-no', value: fictionalInstitutionNumber }],
      type: [
        { coding: [{ system: 'http://jpfhir.jp/fhir/eCheckup/CodeSystem/report-organization-code', code: 'exec-org' }] },
        { coding: [{ system: 'http://jpfhir.jp/fhir/eCheckup/CodeSystem/report-organization-code', code: 'doc-org' }] }
      ],
      name: '慶応技術大学病院健診センター（架空）', telecom: [{ system: 'phone', value: '03-0000-0000' }],
      address: [{ text: '東京都架空区1-1', postalCode: '100-0001', country: 'JP' }]
    }
  };
  const insurerFullUrl = `urn:uuid:${uuidFor(`checkup-insurer-${patient.id}`)}`;
  const insurer = {
    fullUrl: insurerFullUrl,
    resource: {
      resourceType: 'Organization', id: `CHECK-INS-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/eCheckup/StructureDefinition/JP_OrganizationInsurer_eCheckupGeneral'] },
      identifier: [{ system: 'http://jpfhir.jp/fhir/core/mhlw/IdSystem/InsurerNumber', value: String(patient.insurance?.insurerNumber || '06999999').padStart(8, '0').slice(0, 8) }],
      type: [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/organization-type', code: 'ins' }] }],
      name: '架空健康保険組合'
    }
  };
  const coverageFullUrl = `urn:uuid:${uuidFor(`checkup-coverage-${patient.id}`)}`;
  const coverage = {
    fullUrl: coverageFullUrl,
    resource: {
      resourceType: 'Coverage', id: `CHECK-COV-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/eCheckup/StructureDefinition/JP_CoverageService_eCheckupGeneral'] },
      identifier: [{ system: 'http://jpfhir.jp/fhir/clins/Idsystem/JP_Insurance_memberID', value: `${patient.insurance?.insurerNumber || '06999999'}:${patient.insurance?.symbol || '架空'}:${patient.insurance?.number || patient.id}:${patient.insurance?.branchNumber || '00'}` }],
      status: 'active', type: { coding: [{ system: 'urn:oid:1.2.392.200119.6.208', code: '1', display: '受診券' }] },
      subscriberId: `DEMO-${patient.id}`, beneficiary: { reference: patientItem.fullUrl },
      period: { start: '2026-04-01', end: '2027-03-31' }, payor: [{ reference: insurerFullUrl }]
    }
  };
  const encounterFullUrl = `urn:uuid:${uuidFor(`checkup-encounter-${patient.id}`)}`;
  const encounter = {
    fullUrl: encounterFullUrl,
    resource: {
      resourceType: 'Encounter', id: `CHECK-ENC-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/eCheckup/StructureDefinition/JP_Encounter_eCheckupGeneral'] },
      status: 'finished', class: { system: 'http://jpfhir.jp/fhir/eCheckup/CodeSystem/encounter-category', code: 'checkup', display: '健診' },
      period: { start: checkupDate, end: checkupDate }, serviceProvider: { reference: organizationFullUrl }
    }
  };
  const heightFullUrl = `urn:uuid:${uuidFor(`checkup-height-${patient.id}`)}`;
  const height = 150 + (Number.parseInt(patient.id.replace(/\D/g, '').slice(-2), 10) % 31);
  const observation = {
    fullUrl: heightFullUrl,
    resource: {
      resourceType: 'Observation', id: `CHECK-HEIGHT-${patient.id}`, language: 'ja',
      meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/eCheckup/StructureDefinition/JP_Observation_eCheckupGeneral'] },
      status: 'final', category: [{ coding: [{ system: 'http://jpfhir.jp/fhir/core/CodeSystem/JP_SimpleObservationCategory_CS', code: 'body-measurement' }] }],
      code: { coding: [{ system: 'urn:oid:1.2.392.200119.6.1005', code: '9N001000000000001', display: '身長' }] },
      subject: { reference: patientItem.fullUrl }, effectiveDateTime: checkupDate,
      performer: [{ reference: practitioner.fullUrl }], valueQuantity: { value: height, unit: 'cm', system: 'http://unitsofmeasure.org', code: 'cm' }
    }
  };
  const compositionFullUrl = `urn:uuid:${uuidFor(`checkup-composition-${patient.id}`)}`;
  const composition = {
    resourceType: 'Composition', id: `CHECK-COMP-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/eCheckup/StructureDefinition/JP_Composition_eCheckupGeneral'] },
    extension: [{ url: 'http://hl7.org/fhir/StructureDefinition/composition-clinicaldocument-versionNumber', valueString: '1.0' }],
    identifier: { system: resourceIdentifierSystem, value: `${fictionalInstitutionNumber}^2026^${patient.id}-CHECK` }, status: 'final',
    type: { coding: [{ system: 'http://jpfhir.jp/fhir/Common/CodeSystem/doc-typecodes', code: '53576-5', display: '検診・健診報告書' }] },
    category: [{ coding: [{ system: 'urn:oid:1.2.392.200119.6.1001', code: '10', display: '特定健診情報' }] }],
    subject: { reference: patientItem.fullUrl }, encounter: { reference: encounterFullUrl }, date: timestamp,
    author: [{ reference: practitioner.fullUrl }, { reference: organizationFullUrl }], title: '健康診断結果のお知らせ',
    custodian: { reference: organizationFullUrl },
    event: [{ code: [{ coding: [{ system: 'urn:oid:1.2.392.200119.6.1002', code: '010', display: '特定健康診査' }] }], period: { start: checkupDate, end: checkupDate }, detail: [{ reference: encounterFullUrl }] }],
    section: [{
      title: '特定健診検査結果セクション',
      code: { coding: [{ system: 'http://jpfhir.jp/fhir/eCheckup/CodeSystem/section-code', code: '01011', display: '特定健診検査結果セクション' }] },
      text: { status: 'generated', div: xhtml(`身長 ${height} cm`) }, entry: [{ reference: coverageFullUrl }, { reference: heightFullUrl }]
    }]
  };
  return {
    resourceType: 'Bundle', id: `CHECKUP-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: ['http://jpfhir.jp/fhir/clins/StructureDefinition/JP_Bundle_eCheckupGeneral'] },
    identifier: { system: 'http://jpfhir.jp/fhir/clins/bundle-identifier', value: `${fictionalInstitutionNumber}^2026^${patient.id}-Checkup` },
    type: 'document', timestamp,
    entry: [{ fullUrl: compositionFullUrl, resource: composition }, patientItem, organization, insurer, practitioner, encounter, coverage, observation]
  };
}

function observationEntry(patient, order, patientFullUrl, timestamp) {
  const detail = order.resultDetail;
  const encounterId = `ENC-${order.id}`; const practitionerId = `PRACT-${order.id}`;
  const observation = {
    resourceType: 'Observation', id: `CLINS-OBS-${order.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Observation_LabResult_eCS|${clinsVersion}`] },
    contained: [
      { resourceType: 'Encounter', id: encounterId, language: 'ja', meta: { profile: [`http://jpfhir.jp/fhir/eCS/StructureDefinition/JP_Encounter_eCS|${clinsVersion}`] }, identifier: [{ system: 'http://jpfhir.jp/fhir/core/IdSystem/resourceInstance-identifier', value: order.recordId || order.id }], status: 'finished', class: { system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode', code: 'AMB', display: 'ambulatory' } },
      { resourceType: 'Practitioner', id: practitionerId, language: 'ja', meta: { profile: ['http://jpfhir.jp/fhir/core/StructureDefinition/JP_Practitioner'] }, identifier: [{ system: `urn:oid:1.2.392.100495.20.3.41.1${fictionalInstitutionNumber}`, value: 'DEMO-LAB-001' }], name: [{ text: detail?.verifiedBy || '架空 臨床検査技師' }] }
    ],
    extension: clinicalExtensions(patient),
    identifier: [{ system: 'http://jpfhir.jp/fhir/core/IdSystem/resourceInstance-identifier', value: `${fictionalInstitutionNumber}-${order.id}` }],
    status: order.status === 'completed' ? 'final' : 'preliminary',
    category: [{ coding: [{ system: 'http://jpfhir.jp/fhir/core/CodeSystem/JP_SimpleObservationCategory_CS', code: 'laboratory' }] }],
    code: { coding: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/JP_CLINS_ObsLabResult_LocalCode_CS', code: String(order.code || order.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 32) || 'DEMO', display: detail?.analyte || order.name }], text: detail?.analyte || order.name },
    subject: { reference: patientFullUrl }, encounter: { reference: `#${encounterId}` },
    effectiveDateTime: detail?.measuredAt || order.requestedAt, issued: detail?.verifiedAt || detail?.measuredAt || order.requestedAt,
    performer: [{ reference: `#${practitionerId}` }], specimen: { type: 'Specimen', display: order.specimen || '検体' }
  };
  if (detail && Number.isFinite(detail.value)) {
    observation.valueQuantity = { value: detail.value, unit: detail.unit };
    observation.referenceRange = [{ low: { value: detail.referenceRange.low, unit: detail.unit }, high: { value: detail.referenceRange.high, unit: detail.unit }, text: detail.referenceRange.text }];
    observation.interpretation = [{ coding: [{ system: 'http://terminology.hl7.org/CodeSystem/v3-ObservationInterpretation', code: detail.interpretation }] }];
  } else observation.valueString = order.result || '結果確認済み（架空）';
  return { fullUrl: `urn:uuid:${uuidFor(`clins-observation-${order.id}`)}`, resource: observation };
}

export function clinsInformationBundles(store, patientId) {
  return {
    condition: clinsConditionBundle(store, patientId),
    allergyIntolerance: clinsAllergyBundle(store, patientId),
    laboratoryObservation: clinsLaboratoryBundle(store, patientId),
    medicationRequest: clinsMedicationBundle(store, patientId),
    referralDocument: clinsReferralBundle(store, patientId),
    dischargeSummary: clinsDischargeSummaryBundle(store, patientId),
    patientSummary: clinsPatientSummaryBundle(store, patientId),
    healthCheckup: healthCheckupBundle(store, patientId)
  };
}

export function clinsLaboratoryBundle(store, patientId) {
  const patient = store.patients.find((item) => item.id === patientId);
  const order = store.labOrders.find((item) => item.patientId === patientId);
  if (!patient || !order) return null;
  const timestamp = order.resultDetail?.verifiedAt || order.resultDetail?.measuredAt || order.requestedAt;
  const patientItem = patientEntry(patient, timestamp);
  return {
    resourceType: 'Bundle', id: `CLINS-LAB-${patient.id}`, language: 'ja',
    meta: { lastUpdated: timestamp, profile: [`http://jpfhir.jp/fhir/clins/StructureDefinition/JP_Bundle_CLINS|${clinsVersion}`], tag: [{ system: 'http://jpfhir.jp/fhir/clins/CodeSystem/BundleResourceType_CS', code: 'Observation' }] },
    identifier: { system: 'http://jpfhir.jp/fhir/clins/bundle-identifier', value: `${fictionalInstitutionNumber}^2026^${patient.id.replace(/[^A-Za-z0-9-]/g, '').slice(0, 28)}-OBS` },
    type: 'collection', timestamp,
    entry: [patientItem, observationEntry(patient, order, patientItem.fullUrl, timestamp)]
  };
}
