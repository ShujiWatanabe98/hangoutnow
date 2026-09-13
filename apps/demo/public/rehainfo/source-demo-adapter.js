(function () {
  'use strict';

  const API = '/rehainfo/schedule/api';
  const THERAPIST_API = '/rehainfo/therapists/api';
  const ATTENDANCE_API = '/rehainfo/attendance/api';
  const BILLING_API = '/rehainfo/billing-management/api';
  const OPERATIONS_API = '/rehainfo/schedule-management/api';
  const AI_API = '/rehainfo/ai-schedule/api';
  const OCR_PATIENT_API = '/rehainfo/api/ocr/patients';
  const OCR_UPLOAD_API = '/rehainfo/api/ocr/evaluation/upload-image';
  const OCR_REGISTER_API = '/rehainfo/api/ocr/evaluation/register';
  const OCR_ANALYZE_API = '/rehainfo/api/ocr/analyze';
  const PRESCRIPTION_REGISTER_API = '/rehainfo/api/prescriptions/register';
  const PRESCRIPTION_ANALYZE_API = '/rehainfo/api/prescriptions/analyze';
  const EMR_PRESCRIPTION_IMPORT_API = '/rehainfo/api/prescriptions/emr/import';
  const EMR_PATIENT_CANDIDATES_API = '/rehainfo/api/emr/patients';
  const EMR_PATIENT_LOOKUP_API = '/rehainfo/api/prescriptions/patient-lookup';
  const EMR_PATIENT_IMPORT_API = '/rehainfo/api/emr/patients/import';
  const EMR_OAUTH_TOKEN_API = '/rehainfo/emr/oauth/token';
  const EMR_FHIR_PATIENT_API = '/rehainfo/emr/fhir/r4/Patient';
  const EMR_FHIR_CONDITION_API = '/rehainfo/emr/fhir/r4/Condition';
  const EMR_FHIR_ENCOUNTER_API = '/rehainfo/emr/fhir/r4/Encounter';
  const EMR_FHIR_SERVICE_REQUEST_API = '/rehainfo/emr/fhir/r4/ServiceRequest';
  const EMR_FHIR_MEDICATION_REQUEST_API = '/rehainfo/emr/fhir/r4/MedicationRequest';
  const STORAGE_KEY = 'rehainfo-source-ui-demo-v1';
  const PRESCRIPTION_STORAGE_KEY = 'rehainfo-source-ui-prescriptions-v1';
  const OCR_STORAGE_KEY = 'rehainfo-source-ui-ocr-v1';
  const SOAP_STORAGE_KEY = 'rehainfo-source-ui-soap-v1';
  const IMPORTED_PATIENT_STORAGE_KEY = 'rehainfo-source-ui-emr-patients-v2';
  const PATIENT_DISCHARGE_STORAGE_KEY = 'rehainfo-source-ui-patient-discharges-v1';
  const WORKFLOW_STORAGE_KEY = 'rehainfo-source-ui-workflows-v1';
  const originalFetch = window.fetch.bind(window);
  const uploadedPrescriptionImages = new Map();
  let emrMockAccessToken = '';
  const activePatientMatch = /^\/rehainfo\/patient\/([^/]+)\/(?:top|treatment-soap\/soap-list)\/?$/.exec(location.pathname);
  window.REHAINFO_ACTIVE_REC_ID = activePatientMatch ? decodeURIComponent(activePatientMatch[1]) : '';
  window.navigateToPatientList = function () { window.location.href = '/rehainfo/ocr/patients'; };
  window.handleOnclickBack = function () { window.history.back(); };
  window.sortTable = window.sortTable || function () {};

  const therapists = [
    { id: 'PT01', name: '開発 太郎', subLabel: 'PT', nameKana: 'カイハツ タロウ', employmentType: '常勤', phone: '', email: 'pt01@example.local', team: 'PTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'PT02', name: '理学 花子', subLabel: 'PT', nameKana: 'リガク ハナコ', employmentType: '常勤', phone: '', email: 'pt02@example.local', team: 'PTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'OT01', name: '作業 一郎', subLabel: 'OT', nameKana: 'サギョウ イチロウ', employmentType: '常勤', phone: '', email: 'ot01@example.local', team: 'OTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'OT02', name: '高橋 美穂', subLabel: 'OT', nameKana: 'タカハシ ミホ', employmentType: '常勤', phone: '', email: 'ot02@example.local', team: 'OTチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'ST01', name: '言語 美咲', subLabel: 'ST', nameKana: 'ゲンゴ ミサキ', employmentType: '常勤', phone: '', email: 'st01@example.local', team: 'STチーム1', ward: null, monthlyTargetUnits: null },
    { id: 'ST02', name: '山本 遥', subLabel: 'ST', nameKana: 'ヤマモト ハルカ', employmentType: '常勤', phone: '', email: 'st02@example.local', team: 'STチーム1', ward: null, monthlyTargetUnits: null }
  ];
  hydrateTherapists();

  const patients = [
    ['SR-DEMO260901', '佐藤 和子', '女性・回復期', '回復期3階A'],
    ['SR-DEMO260902', '鈴木 正一', '男性・回復期', '回復期2階B'],
    ['SR-DEMO260903', '高橋 幸子', '女性・整形外科', '整形外科4階'],
    ['SR-DEMO260904', '田中 博', '男性・神経内科', '神経内科5階'],
    ['SR-DEMO260905', '伊藤 洋子', '女性・回復期', '回復期2階A'],
    ['SR-DEMO260906', '渡辺 清', '男性・循環器', '循環器6階'],
    ['SR-DEMO260907', '山本 恵子', '女性・呼吸器', '呼吸器5階'],
    ['SR-DEMO260908', '中村 隆', '男性・回復期', '回復期3階B'],
    ['SR-DEMO260909', '小林 久美子', '女性・外科', '外科4階'],
    ['SR-DEMO260910', '加藤 一郎', '男性・回復期', '回復期2階B']
  ].map(function (item) {
    return { id: item[0], name: item[1], subLabel: item[2], nameKana: null, employmentType: null, phone: null, email: null, team: null, ward: item[3], monthlyTargetUnits: null };
  });

  const smartRehabDetails = [
    ['脳梗塞後遺症', ['右片麻痺', '歩行障害'], ['転倒リスク', '嚥下状態を確認'], '病棟内歩行を見守りで実施し自宅退院する', ['PT', 'OT', 'ST'], 3, '2026/11/15', 88, 61, 27, 82, '佐々木 医師'],
    ['右大腿骨頸部骨折術後', ['右下肢筋力低下', '移乗動作低下'], ['転倒リスク', '右股関節荷重指示'], '歩行器で病棟内移動を自立する', ['PT', 'OT'], 3, '2026/11/20', 72, 49, 23, 66, '佐々木 医師'],
    ['変形性膝関節症', ['右膝関節可動域制限', '疼痛'], ['疼痛増悪', '転倒リスク'], '階段昇降を手すり使用で獲得する', ['PT', 'OT'], 2, '2026/11/28', 78, 53, 25, 73, '松本 医師'],
    ['脳梗塞後遺症', ['左片麻痺', '失語症'], ['転倒リスク', '再発予防'], '屋内歩行と日常会話能力を改善する', ['PT', 'OT', 'ST'], 3, '2026/12/05', 65, 42, 23, 58, '高木 医師'],
    ['肺炎後廃用症候群', ['全身持久力低下', 'ADL低下'], ['起立性低血圧', '低栄養'], '身辺動作を見守りレベルまで改善する', ['PT', 'OT'], 2, '2026/11/30', 69, 45, 24, 63, '松本 医師'],
    ['慢性心不全', ['運動耐容能低下'], ['心不全増悪', '血圧変動'], '安全な有酸素運動を自己管理できる', ['PT'], 2, '', 112, 81, 31, 106, '加納 医師'],
    ['慢性呼吸不全', ['呼吸困難', '運動耐容能低下'], ['SpO2低下', '呼吸困難増悪'], '呼吸法を用いて病棟内移動を行う', ['PT', 'OT'], 2, '2026/12/10', 74, 49, 25, 68, '高木 医師'],
    ['脳梗塞後遺症', ['左上肢機能低下', '構音障害'], ['転倒リスク', '誤嚥リスク'], '食事と更衣を一部介助まで改善する', ['PT', 'OT', 'ST'], 3, '2026/12/12', 62, 40, 22, 56, '佐々木 医師'],
    ['術後廃用症候群', ['体幹筋力低下', '持久力低下'], ['創部負荷', '疲労'], '屋外歩行を休憩なしで10分継続する', ['PT'], 2, '', 110, 79, 31, 104, '松本 医師'],
    ['腰椎圧迫骨折', ['体幹可動域制限', '腰痛'], ['再骨折', '転倒リスク'], '装具を使用して更衣と移動を自立する', ['PT', 'OT'], 2, '2026/12/15', 70, 47, 23, 64, '加納 医師']
  ];
  const patientListRows = [
    ['SR-DEMO260901', '佐藤 和子', 'サトウ カズコ', '女性', '1948/04/12', '78歳', '脳血管疾患等', '2026/08/18', '入院', '回復期3階A', '2026/08/16'],
    ['SR-DEMO260902', '鈴木 正一', 'スズキ ショウイチ', '男性', '1952/11/03', '73歳', '運動器', '2026/08/20', '入院', '回復期2階B', '2026/08/18'],
    ['SR-DEMO260903', '高橋 幸子', 'タカハシ サチコ', '女性', '1941/07/26', '85歳', '運動器', '2026/08/22', '入院', '整形外科4階', '2026/08/20'],
    ['SR-DEMO260904', '田中 博', 'タナカ ヒロシ', '男性', '1958/01/19', '68歳', '脳血管疾患等', '2026/08/25', '入院', '神経内科5階', '2026/08/23'],
    ['SR-DEMO260905', '伊藤 洋子', 'イトウ ヨウコ', '女性', '1949/09/07', '77歳', '廃用症候群', '2026/08/28', '入院', '回復期2階A', '2026/08/26'],
    ['SR-DEMO260906', '渡辺 清', 'ワタナベ キヨシ', '男性', '1955/06/15', '71歳', '心大血管疾患', '2026/09/01', '外来', '循環器6階', '2026/07/09', '2026/07/17'],
    ['SR-DEMO260907', '山本 恵子', 'ヤマモト ケイコ', '女性', '1946/02/08', '80歳', '呼吸器', '2026/09/02', '入院', '呼吸器5階', '2026/08/31'],
    ['SR-DEMO260908', '中村 隆', 'ナカムラ タカシ', '男性', '1960/12/21', '65歳', '脳血管疾患等', '2026/09/03', '入院', '回復期3階B', '2026/09/01'],
    ['SR-DEMO260909', '小林 久美子', 'コバヤシ クミコ', '女性', '1951/05/30', '75歳', '廃用症候群', '2026/09/04', '外来', '外科4階', '2026/07/09', '2026/07/20'],
    ['SR-DEMO260910', '加藤 一郎', 'カトウ イチロウ', '男性', '1944/10/11', '81歳', '運動器', '2026/09/05', '入院', '回復期2階B', '2026/09/03']
  ].map(function (item, index) {
    const detail = smartRehabDetails[index];
    return {
      patientId: item[0], patientName: item[1], patientNameKana: item[2], gender: item[3], birth: item[4], age: item[5],
      rehabilitationClass: item[6], startDate: item[7], entryExit: item[8], wardName: item[9], serviceName: 'スマートリハビリテーション病院',
      hospitalizationStartDate: item[10], hospitalizationEndDate: item[11] || '',
      recId: String(9001 + index), groupId: 'DEMO-GROUP', fitbitId: '', patientActive: 'T', treatmentTimes: index + 1,
      rehabStartTime: null, assigned: index < 8, externalEmrId: item[0],
      primaryDiagnosis: detail[0], impairments: detail[1], risks: detail[2], goal: detail[3], professions: detail[4],
      plannedUnitsPerDay: detail[5], targetDischargeDate: detail[6],
      fim: { total: detail[7], motor: detail[8], cognitive: detail[9], previousTotal: detail[10] },
      attendingPhysician: detail[11]
    };
  });
  patientListRows.push(...readImportedPatientStore());
  patientListRows.forEach(normalizePatientAdmissionFields);
  applyPatientDischargeState(patientListRows);

  window.REHAINFO_DEMO_PATIENT_COLUMNS = {
    '患者ID': 'patientId', '患者氏名': 'patientName', '患者氏名（カナ）': 'patientNameKana', '性別': 'gender',
    '生年月日': 'birth', '年齢': 'age', 'リハビリテーション区分': 'rehabilitationClass', '起算日': 'startDate',
    '入外区分': 'entryExit', '病棟名': 'wardName'
  };
  window.REHAINFO_DEMO_PATIENTS = patientListRows;

  const orcaMasters = [
    ['180755710', 'H001', '脳血管疾患等リハビリテーション料（１）（理学療法士による場合）', 'PT', 185],
    ['180745310', 'H002', '運動器リハビリテーション料（１）（理学療法士による場合）', 'PT', 185],
    ['180755810', 'H001', '脳血管疾患等リハビリテーション料（１）（作業療法士による場合）', 'OT', 185],
    ['180745410', 'H002', '運動器リハビリテーション料（１）（作業療法士による場合）', 'OT', 185],
    ['180755910', 'H001', '脳血管疾患等リハビリテーション料（１）（言語聴覚士による場合）', 'ST', 185],
    ['180750510', 'H003', '呼吸器リハビリテーション料（１）', 'ST', 180]
  ].map(function (item) {
    return { code: item[0], sectionCode: item[1], name: item[2], therapistRole: item[3], pointsPerUnit: item[4], effectiveFrom: '2026-06-01' };
  });

  const baseEntries = [
    [1001, '09:00', '09:40', 'SR-DEMO260901', 'PT01', 2, '歩行・バランス練習', '180755710'],
    [1002, '10:00', '10:40', 'SR-DEMO260902', 'PT01', 2, '関節可動域・筋力訓練', '180745310'],
    [1003, '11:00', '12:00', 'SR-DEMO260903', 'PT01', 3, '起立・移乗動作訓練', '180755710'],
    [1004, '13:40', '14:40', 'SR-DEMO260904', 'PT01', 3, '階段・屋外歩行練習', '180755710'],
    [1005, '10:00', '10:40', 'SR-DEMO260905', 'PT02', 2, '歩行・バランス練習', '180755710'],
    [1006, '13:00', '14:00', 'SR-DEMO260906', 'PT02', 3, '起立・移乗動作訓練', '180745310'],
    [1007, '09:00', '09:40', 'SR-DEMO260907', 'OT01', 2, '更衣・整容動作訓練', '180755810'],
    [1008, '11:00', '11:40', 'SR-DEMO260908', 'OT01', 2, '上肢機能訓練', '180745410'],
    [1009, '10:00', '11:00', 'SR-DEMO260909', 'OT02', 3, 'ADL訓練', '180755810'],
    [1010, '14:00', '14:40', 'SR-DEMO260910', 'OT02', 2, '認知・作業課題', '180755810'],
    [1011, '09:00', '09:40', 'SR-DEMO260903', 'ST01', 2, '嚥下訓練', '180755910'],
    [1012, '13:00', '13:40', 'SR-DEMO260908', 'ST02', 2, '言語訓練', '180755910']
  ];

  const baselineReservationHistory = [
    [2001, '2026-06-08', '09:00', '09:40', 'SR-DEMO260901', 'PT01', 2],
    [2002, '2026-07-13', '10:00', '10:40', 'SR-DEMO260902', 'PT01', 2],
    [2003, '2026-08-03', '11:00', '12:00', 'SR-DEMO260903', 'PT01', 3],
    [2004, '2026-08-17', '13:40', '14:40', 'SR-DEMO260904', 'PT01', 3],
    [2005, '2026-08-24', '09:00', '09:40', 'SR-DEMO260905', 'PT01', 2],
    [2006, '2026-09-07', '10:00', '10:40', 'SR-DEMO260906', 'PT01', 2],
    [2011, '2026-07-06', '09:00', '09:40', 'SR-DEMO260905', 'PT02', 2],
    [2012, '2026-08-10', '13:00', '14:00', 'SR-DEMO260906', 'PT02', 3],
    [2021, '2026-07-07', '09:00', '09:40', 'SR-DEMO260907', 'OT01', 2],
    [2022, '2026-08-11', '11:00', '11:40', 'SR-DEMO260908', 'OT01', 2],
    [2031, '2026-07-08', '10:00', '11:00', 'SR-DEMO260909', 'OT02', 3],
    [2032, '2026-08-12', '14:00', '14:40', 'SR-DEMO260910', 'OT02', 2],
    [2041, '2026-08-13', '09:00', '09:40', 'SR-DEMO260903', 'ST01', 2],
    [2051, '2026-08-14', '13:00', '13:40', 'SR-DEMO260908', 'ST02', 2]
  ];

  function json(body, status) {
    return new Response(JSON.stringify(body), { status: status || 200, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
  }

  function readStore() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch (_) { return {}; }
  }

  function writeStore(store) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }

  function readWorkflowStore() {
    try {
      const value = JSON.parse(localStorage.getItem(WORKFLOW_STORAGE_KEY) || '{}');
      return value && typeof value === 'object' ? value : {};
    } catch (_) {
      return {};
    }
  }

  function writeWorkflowStore(value) {
    localStorage.setItem(WORKFLOW_STORAGE_KEY, JSON.stringify(value));
  }

  function hydrateTherapists() {
    const workflow = readWorkflowStore();
    const additions = Array.isArray(workflow.therapists) ? workflow.therapists : [];
    additions.forEach(function (saved) {
      const existing = therapists.find(function (item) { return item.id === saved.id; });
      if (existing) Object.assign(existing, saved);
      else therapists.push(saved);
    });
    const order = Array.isArray(workflow.therapistOrder) ? workflow.therapistOrder : [];
    if (order.length) {
      therapists.sort(function (left, right) {
        const leftIndex = order.indexOf(left.id);
        const rightIndex = order.indexOf(right.id);
        return (leftIndex < 0 ? 9999 : leftIndex) - (rightIndex < 0 ? 9999 : rightIndex);
      });
    }
  }

  function persistTherapists() {
    const workflow = readWorkflowStore();
    workflow.therapists = therapists;
    workflow.therapistOrder = therapists.map(function (item) { return item.id; });
    writeWorkflowStore(workflow);
  }

  function readPrescriptionStore() {
    try {
      const records = JSON.parse(localStorage.getItem(PRESCRIPTION_STORAGE_KEY) || '[]');
      return Array.isArray(records) ? records : [];
    } catch (_) {
      return [];
    }
  }

  function writePrescriptionStore(records) {
    localStorage.setItem(PRESCRIPTION_STORAGE_KEY, JSON.stringify(records.slice(0, 100)));
  }

  function readImportedPatientStore() {
    try {
      const records = JSON.parse(localStorage.getItem(IMPORTED_PATIENT_STORAGE_KEY) || '[]');
      return Array.isArray(records) ? records.filter(function (record) {
        return record && record.patientId && record.patientName && record.recId && record.externalEmrId;
      }) : [];
    } catch (_) {
      return [];
    }
  }

  function writeImportedPatientStore(records) {
    localStorage.setItem(IMPORTED_PATIENT_STORAGE_KEY, JSON.stringify(records.slice(0, 50)));
  }

  function normalizePatientAdmissionFields(patient) {
    if (!patient.hospitalizationStartDate) {
      patient.hospitalizationStartDate = patient.startDate || '';
    }
    if (!patient.hospitalizationEndDate) patient.hospitalizationEndDate = '';
    return patient;
  }

  function readPatientDischargeStore() {
    try {
      const records = JSON.parse(localStorage.getItem(PATIENT_DISCHARGE_STORAGE_KEY) || '{}');
      return records && typeof records === 'object' && !Array.isArray(records) ? records : {};
    } catch (_) {
      return {};
    }
  }

  function writePatientDischargeStore(records) {
    localStorage.setItem(PATIENT_DISCHARGE_STORAGE_KEY, JSON.stringify(records));
  }

  function applyPatientDischargeState(rows) {
    const records = readPatientDischargeStore();
    rows.forEach(function (patient) {
      const dischargeDate = records[patient.recId];
      if (!dischargeDate) return;
      patient.hospitalizationEndDate = String(dischargeDate).replaceAll('-', '/');
      patient.entryExit = '退院';
      patient.patientActive = 'F';
    });
  }

  function prescriptionPatient(recId) {
    return patientListRows.find(function (item) { return item.recId === String(recId); });
  }

  function prescriptionRouteRecId() {
    const match = /^\/rehainfo\/prescriptions\/patient\/([^/]+)\/(?:read|list)\/?$/.exec(location.pathname);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function prescriptionPatientAddFlow() {
    return new URLSearchParams(location.search).get('flow') === 'patient-add';
  }

  function prescriptionPatientAddQuery() {
    return prescriptionPatientAddFlow() ? '?flow=patient-add' : '';
  }

  function ocrRouteRecId() {
    const match = /^\/rehainfo\/ocr\/patient\/([^/]+)\/(?:evaluation-select|list)\/?$/.exec(location.pathname);
    return match ? decodeURIComponent(match[1]) : '';
  }

  function readListStore(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeListStore(key, records) {
    localStorage.setItem(key, JSON.stringify(records.slice(0, 100)));
  }

  function fileAsDataUrl(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('画像を読み込めませんでした。')); };
      reader.readAsDataURL(file);
    });
  }

  function prescriptionSummary(result) {
    const lines = [];
    if (result.patient && typeof result.patient === 'object') {
      const patientName = [result.patient.familyName, result.patient.firstName].filter(Boolean).join(' ');
      if (result.patient.patientId) lines.push(`患者ID：${result.patient.patientId}`);
      if (patientName) lines.push(`患者名：${patientName}`);
    }
    if (result.prescriptionDate) lines.push(`処方日：${result.prescriptionDate}`);
    if (result.medicalInstitution) lines.push(`医療機関：${result.medicalInstitution}`);
    if (result.doctorName) lines.push(`医師：${result.doctorName}`);
    if (Array.isArray(result.medications)) {
      result.medications.forEach(function (item, index) {
        const values = [item.name, item.amount, item.unit, item.usage, item.days, item.notes].filter(Boolean);
        if (values.length) lines.push(`薬剤${index + 1}：${values.join(' ')}`);
      });
    }
    if (result.notes) lines.push(`備考：${result.notes}`);
    if (Array.isArray(result.warnings) && result.warnings.filter(Boolean).length) lines.push(`要確認：${result.warnings.filter(Boolean).join('／')}`);
    return lines.join('\n') || '処方箋の文字を読み取れませんでした';
  }

  function emrPrescriptionSummary(resource) {
    const medication = resource.medicationCodeableConcept?.text
      || resource.medicationCodeableConcept?.coding?.[0]?.display
      || '薬剤名未設定';
    const dispense = resource.dispenseRequest || {};
    const quantity = dispense.quantity || {};
    const dosage = resource.dosageInstruction?.[0]?.text || '';
    const requester = resource.requester?.display || '';
    return [
      resource.authoredOn ? `処方日：${String(resource.authoredOn).slice(0, 10).replaceAll('-', '/')}` : '',
      '取得元：電カルモック（HL7 FHIR R4 / JP Core MedicationRequest）',
      requester ? `医師：${requester}` : '',
      '薬剤',
      `・${medication}${quantity.value ? ` ${quantity.value}${quantity.unit || ''}` : ''}${dosage ? ` ${dosage}` : ''}`,
      '備考：電カルモックの架空処方データです'
    ].filter(Boolean).join('\n');
  }

  async function fetchEmrResource(url, retry) {
    if (!emrMockAccessToken) {
      const tokenResponse = await originalFetch(EMR_OAUTH_TOKEN_API, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'smart-rehab-public-demo', scope: 'system/*.read' })
      });
      const token = await tokenResponse.json().catch(function () { return {}; });
      if (!tokenResponse.ok || !token.access_token) throw new Error('電カルモックの認証に失敗しました。');
      emrMockAccessToken = token.access_token;
    }
    const response = await originalFetch(url, {
      method: 'GET', credentials: 'same-origin',
      headers: { Accept: 'application/fhir+json', Authorization: `Bearer ${emrMockAccessToken}` }
    });
    if (response.status === 401 && retry !== false) {
      emrMockAccessToken = '';
      return fetchEmrResource(url, false);
    }
    return response;
  }

  function fetchEmrMedicationRequests(patientReference) {
    return fetchEmrResource(`${EMR_FHIR_MEDICATION_REQUEST_API}?patient=${encodeURIComponent(patientReference)}`);
  }

  function patientName(resource, use) {
    const name = (resource.name || []).find(function (item) { return item.use === use; }) || {};
    return name.text || [name.family].concat(name.given || []).filter(Boolean).join(' ');
  }

  function patientAge(birthDate) {
    const birth = new Date(`${birthDate}T00:00:00`);
    if (Number.isNaN(birth.getTime())) return '';
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    if (today.getMonth() < birth.getMonth() || (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())) age -= 1;
    return `${Math.max(0, age)}歳`;
  }

  function bundleResources(bundle, resourceType) {
    return (bundle?.entry || []).map(function (entry) { return entry.resource || {}; })
      .filter(function (resource) { return resource.resourceType === resourceType; });
  }

  function patientReferenceId(resource) {
    return String(resource?.subject?.reference || '').replace(/^Patient\//, '');
  }

  function extensionValue(resource, name) {
    const suffix = `/StructureDefinition/${name}`;
    const extension = (resource?.extension || []).find(function (item) { return String(item.url || '').endsWith(suffix); });
    if (!extension) return undefined;
    const valueKey = Object.keys(extension).find(function (key) { return key.startsWith('value'); });
    return valueKey ? extension[valueKey] : undefined;
  }

  function splitClinicalList(value) {
    return String(value || '').split(/[、,]/).map(function (item) { return item.trim(); }).filter(Boolean);
  }

  function smartRehabPatientFromFhir(resource, clinical) {
    const context = clinical || {};
    const serviceRequest = context.serviceRequest || {};
    const encounter = context.encounter || {};
    const hospitalizationEncounter = context.hospitalizationEncounter || (encounter.class?.code === 'IMP' ? encounter : {});
    const condition = context.condition || {};
    const externalEmrId = String(resource.id || '');
    const birthDate = String(resource.birthDate || '');
    const officialName = patientName(resource, 'official') || '氏名未設定';
    const careSetting = extensionValue(serviceRequest, 'care-setting');
    const encounterClass = encounter.class?.code || '';
    const isInpatient = careSetting === 'inpatient' || encounterClass === 'IMP';
    const entryExit = isInpatient ? '入院' : careSetting === 'outpatient' || encounterClass === 'AMB' ? '外来' : '';
    const rehabilitationClass = extensionValue(serviceRequest, 'rehabilitation-class') || serviceRequest.code?.coding?.[0]?.code || '未設定';
    const startDate = String(serviceRequest.occurrencePeriod?.start || serviceRequest.authoredOn || '').slice(0, 10);
    const encounterStartDate = String(hospitalizationEncounter.period?.start || '').slice(0, 10);
    const encounterEndDate = String(hospitalizationEncounter.period?.end || '').slice(0, 10);
    // FHIR R4 ServiceRequest.performerType is a single CodeableConcept (0..1),
    // whose coding array can contain more than one requested profession. Keep
    // accepting the former array-shaped demo payload as a compatibility guard.
    const performerTypes = Array.isArray(serviceRequest.performerType)
      ? serviceRequest.performerType
      : serviceRequest.performerType ? [serviceRequest.performerType] : [];
    const professions = performerTypes.reduce(function (values, role) {
      const codingValues = Array.isArray(role?.coding)
        ? role.coding.map(function (coding) { return coding.code || coding.display; }).filter(Boolean)
        : [];
      return values.concat(codingValues.length ? codingValues : role?.text ? [role.text] : []);
    }, []).filter(function (value, index, values) { return values.indexOf(value) === index; });
    return {
      patientId: externalEmrId,
      patientName: officialName,
      patientNameKana: patientName(resource, 'usual') || '',
      gender: resource.gender === 'female' ? '女性' : resource.gender === 'male' ? '男性' : resource.gender ? 'その他' : '',
      birth: birthDate.replaceAll('-', '/'),
      age: patientAge(birthDate),
      rehabilitationClass: rehabilitationClass,
      startDate: startDate.replaceAll('-', '/'),
      entryExit: entryExit,
      hospitalizationStartDate: (encounterStartDate || startDate).replaceAll('-', '/'),
      hospitalizationEndDate: encounterEndDate.replaceAll('-', '/'),
      wardName: extensionValue(serviceRequest, 'ward-name') || encounter.location?.[0]?.location?.display || '未配属',
      serviceName: 'スマートリハビリテーション病院',
      recId: `EMR-${externalEmrId}`,
      groupId: 'DEMO-GROUP',
      fitbitId: '',
      patientActive: 'T',
      treatmentTimes: 0,
      rehabStartTime: null,
      assigned: true,
      externalEmrId: externalEmrId,
      importedFrom: 'eMedicalRecordMock',
      fictionalDemoOnly: true,
      primaryDiagnosis: serviceRequest.reasonReference?.[0]?.display || condition.code?.text || condition.code?.coding?.[0]?.display || '未設定',
      impairments: splitClinicalList(extensionValue(serviceRequest, 'impairment')),
      risks: splitClinicalList(extensionValue(serviceRequest, 'risk')),
      goal: extensionValue(serviceRequest, 'rehabilitation-goal') || '目標未設定',
      professions: professions,
      plannedUnitsPerDay: Number(extensionValue(serviceRequest, 'planned-units-per-day') || 0),
      targetDischargeDate: String(extensionValue(serviceRequest, 'target-discharge-date') || '').replaceAll('-', '/'),
      fim: {
        total: Number(extensionValue(serviceRequest, 'fim-total') || 0),
        motor: Number(extensionValue(serviceRequest, 'fim-motor') || 0),
        cognitive: Number(extensionValue(serviceRequest, 'fim-cognitive') || 0),
        previousTotal: Number(extensionValue(serviceRequest, 'fim-previous-total') || 0)
      },
      attendingPhysician: serviceRequest.requester?.display || resource.generalPractitioner?.[0]?.display || '担当医未設定'
    };
  }

  async function lookupSmartRehabPatientFromEmr(externalEmrId) {
    let resolvedEmrId = externalEmrId;
    let patientReference = encodeURIComponent(`Patient/${resolvedEmrId}`);
    let responses;
    try {
      responses = await Promise.all([
        fetchEmrResource(`${EMR_FHIR_PATIENT_API}/${encodeURIComponent(resolvedEmrId)}`),
        fetchEmrResource(`${EMR_FHIR_CONDITION_API}?patient=${patientReference}`),
        fetchEmrResource(`${EMR_FHIR_ENCOUNTER_API}?patient=${patientReference}`),
        fetchEmrResource(`${EMR_FHIR_SERVICE_REQUEST_API}?patient=${patientReference}&category=rehabilitation`)
      ]);
    } catch (_) {
      throw new Error('電カルモックの認証に失敗しました。');
    }
    let payloads = await Promise.all(responses.map(function (response) { return response.json().catch(function () { return {}; }); }));
    let resource = payloads[0];
    if ((!responses[0].ok || resource.resourceType !== 'Patient') && !externalEmrId.startsWith('SR-')) {
      resolvedEmrId = `SR-${externalEmrId}`;
      patientReference = encodeURIComponent(`Patient/${resolvedEmrId}`);
      responses = await Promise.all([
        fetchEmrResource(`${EMR_FHIR_PATIENT_API}/${encodeURIComponent(resolvedEmrId)}`),
        fetchEmrResource(`${EMR_FHIR_CONDITION_API}?patient=${patientReference}`),
        fetchEmrResource(`${EMR_FHIR_ENCOUNTER_API}?patient=${patientReference}`),
        fetchEmrResource(`${EMR_FHIR_SERVICE_REQUEST_API}?patient=${patientReference}&category=rehabilitation`)
      ]);
      payloads = await Promise.all(responses.map(function (response) { return response.json().catch(function () { return {}; }); }));
      resource = payloads[0];
    }
    if (!responses[0].ok || resource.resourceType !== 'Patient' || resource.id !== resolvedEmrId) {
      throw new Error(`患者ID「${externalEmrId}」に一致する患者が電カルに見つかりません。`);
    }
    if (responses.slice(1).some(function (response) { return !response.ok; })) {
      throw new Error('電カルモックから患者の診療・リハ情報を取得できませんでした。');
    }
    const serviceRequest = bundleResources(payloads[3], 'ServiceRequest').find(function (item) { return item.status === 'active'; });
    const patientEncounters = bundleResources(payloads[2], 'Encounter');
    const currentEncounter = patientEncounters.find(function (item) { return item.status === 'in-progress'; }) || patientEncounters[0];
    return {
      patient: smartRehabPatientFromFhir(resource, {
        condition: bundleResources(payloads[1], 'Condition')[0],
        encounter: currentEncounter,
        hospitalizationEncounter: patientEncounters.find(function (item) { return item.class?.code === 'IMP'; }),
        serviceRequest: serviceRequest
      }),
      eligible: Boolean(serviceRequest),
      resolvedEmrId: resolvedEmrId
    };
  }

  async function prescriptionApi(url, options) {
    const parsed = new URL(url, location.origin);
    const method = String(options.method || 'GET').toUpperCase();
    if (method === 'GET' && parsed.pathname === OCR_PATIENT_API) {
      const responsibleOnly = parsed.searchParams.get('responsibleOnly') !== 'false';
      const rows = patientListRows.filter(function (item) { return !responsibleOnly || item.assigned; }).map(function (item) {
        return { recId: item.recId, patientId: item.patientId, patientName: item.patientName, gender: item.gender, age: parseInt(item.age, 10) };
      });
      return json({ success: true, patients: rows });
    }
    if (method === 'GET' && parsed.pathname === EMR_PATIENT_CANDIDATES_API) {
      let responses;
      try {
        responses = await Promise.all([
          fetchEmrResource(EMR_FHIR_PATIENT_API),
          fetchEmrResource(EMR_FHIR_CONDITION_API),
          fetchEmrResource(EMR_FHIR_ENCOUNTER_API),
          fetchEmrResource(`${EMR_FHIR_SERVICE_REQUEST_API}?category=rehabilitation`)
        ]);
      } catch (_) {
        return json({ success: false, errorMessage: '電カルモックの認証に失敗しました。' }, 502);
      }
      const bundles = await Promise.all(responses.map(function (response) { return response.json().catch(function () { return {}; }); }));
      if (responses.some(function (response) { return !response.ok; }) || bundles.some(function (bundle) { return bundle.resourceType !== 'Bundle'; })) {
        return json({ success: false, errorMessage: '電カルモックから患者・傷病・受診・リハ依頼情報を取得できませんでした。' }, 502);
      }
      const patients = bundleResources(bundles[0], 'Patient');
      const conditions = bundleResources(bundles[1], 'Condition');
      const encounters = bundleResources(bundles[2], 'Encounter');
      const serviceRequests = bundleResources(bundles[3], 'ServiceRequest');
      const existingIds = new Set(patientListRows.map(function (patient) { return patient.externalEmrId; }).filter(Boolean));
      const candidates = patients.filter(function (resource) { return resource.id; })
        .map(function (resource) {
          const serviceRequest = serviceRequests.find(function (item) { return patientReferenceId(item) === resource.id && item.status === 'active'; });
          const patientEncounters = encounters.filter(function (item) { return patientReferenceId(item) === resource.id; });
          const currentEncounter = patientEncounters.find(function (item) { return item.status === 'in-progress'; }) || patientEncounters[0];
          const mapped = smartRehabPatientFromFhir(resource, {
            condition: conditions.find(function (item) { return patientReferenceId(item) === resource.id; }),
            encounter: currentEncounter,
            hospitalizationEncounter: patientEncounters.find(function (item) { return item.class?.code === 'IMP'; }),
            serviceRequest: serviceRequest
          });
          return {
            externalEmrId: mapped.externalEmrId,
            patientName: mapped.patientName,
            patientNameKana: mapped.patientNameKana,
            gender: mapped.gender,
            birth: mapped.birth,
            age: mapped.age,
            primaryDiagnosis: mapped.primaryDiagnosis,
            rehabilitationClass: mapped.rehabilitationClass,
            entryExit: mapped.entryExit,
            wardName: mapped.wardName,
            hospitalizationStartDate: mapped.hospitalizationStartDate,
            hospitalizationEndDate: mapped.hospitalizationEndDate,
            eligible: Boolean(serviceRequest),
            alreadyAdded: existingIds.has(mapped.externalEmrId)
          };
        });
      return json({ success: true, standard: 'HL7 FHIR R4 / JP Core Patient・Condition・Encounter・ServiceRequest', patients: candidates });
    }
    if (method === 'GET' && parsed.pathname === EMR_PATIENT_LOOKUP_API) {
      const patientId = String(parsed.searchParams.get('patientId') || '').trim();
      if (!/^[A-Za-z0-9.-]{1,64}$/.test(patientId)) {
        return json({ success: false, errorMessage: '患者IDは64文字以内の半角英数字・ハイフン・ピリオドで入力してください。' }, 400);
      }
      try {
        const lookup = await lookupSmartRehabPatientFromEmr(patientId);
        const alreadyAdded = patientListRows.some(function (patient) {
          return [patientId, lookup.resolvedEmrId].includes(patient.externalEmrId)
            || [patientId, lookup.resolvedEmrId].includes(patient.patientId);
        });
        return json({
          success: true,
          patient: lookup.patient,
          emrLookup: {
            status: 'matched',
            message: `患者ID「${patientId}」から電カル情報を取得しました。`,
            standard: 'HL7 FHIR R4 / JP Core Patient・Condition・Encounter・ServiceRequest',
            eligible: lookup.eligible,
            alreadyAdded: alreadyAdded
          }
        });
      } catch (error) {
        return json({ success: true, patient: { patientId: patientId }, emrLookup: { status: 'not-found', message: error.message || '電カル情報を取得できませんでした。', alreadyAdded: false } });
      }
    }
    if (method === 'POST' && parsed.pathname === EMR_PATIENT_IMPORT_API) {
      let payload;
      try { payload = JSON.parse(options.body || '{}'); } catch (_) { payload = {}; }
      const externalEmrId = String(payload.externalEmrId || '');
      if (!/^[A-Za-z0-9.-]{1,64}$/.test(externalEmrId)) {
        return json({ success: false, errorMessage: '追加する患者を確認してください。' }, 400);
      }
      const existing = patientListRows.find(function (patient) { return patient.externalEmrId === externalEmrId; });
      if (existing) return json({ success: true, alreadyAdded: true, patient: existing, message: 'この患者は追加済みです。' });
      let responses;
      try {
        const patientReference = encodeURIComponent(`Patient/${externalEmrId}`);
        responses = await Promise.all([
          fetchEmrResource(`${EMR_FHIR_PATIENT_API}/${encodeURIComponent(externalEmrId)}`),
          fetchEmrResource(`${EMR_FHIR_CONDITION_API}?patient=${patientReference}`),
          fetchEmrResource(`${EMR_FHIR_ENCOUNTER_API}?patient=${patientReference}`),
          fetchEmrResource(`${EMR_FHIR_SERVICE_REQUEST_API}?patient=${patientReference}&category=rehabilitation`)
        ]);
      } catch (_) {
        return json({ success: false, errorMessage: '電カルモックの認証に失敗しました。' }, 502);
      }
      const payloads = await Promise.all(responses.map(function (response) { return response.json().catch(function () { return {}; }); }));
      const resource = payloads[0];
      if (responses.some(function (response) { return !response.ok; }) || resource.resourceType !== 'Patient' || resource.id !== externalEmrId) {
        return json({ success: false, errorMessage: '電カルモックから患者・リハ情報を取得できませんでした。' }, 502);
      }
      const serviceRequest = bundleResources(payloads[3], 'ServiceRequest').find(function (item) { return item.status === 'active'; });
      if (!serviceRequest) return json({ success: false, errorMessage: 'この患者には有効なリハビリテーション依頼がありません。' }, 422);
      const patientEncounters = bundleResources(payloads[2], 'Encounter');
      const currentEncounter = patientEncounters.find(function (item) { return item.status === 'in-progress'; }) || patientEncounters[0];
      const importedPatient = smartRehabPatientFromFhir(resource, {
        condition: bundleResources(payloads[1], 'Condition')[0],
        encounter: currentEncounter,
        hospitalizationEncounter: patientEncounters.find(function (item) { return item.class?.code === 'IMP'; }),
        serviceRequest: serviceRequest
      });
      normalizePatientAdmissionFields(importedPatient);
      const importedPatients = readImportedPatientStore();
      importedPatients.push(importedPatient);
      writeImportedPatientStore(importedPatients);
      patientListRows.push(importedPatient);
      window.REHAINFO_DEMO_PATIENTS = patientListRows;
      return json({ success: true, alreadyAdded: false, patient: importedPatient, message: `${importedPatient.patientName}さんをスマリハに追加しました。` });
    }
    if (method === 'POST' && parsed.pathname === OCR_UPLOAD_API) {
      const form = options.body;
      const file = form instanceof FormData ? form.get('file') : null;
      if (!(file instanceof File) || !file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) {
        return json({ message: 'PNG・JPEG・WebP画像を1枚10MB以内で選択してください。' }, 400);
      }
      const imageId = `PUBLIC-RX-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      uploadedPrescriptionImages.set(imageId, await fileAsDataUrl(file));
      return json({ success: true, imageId: imageId });
    }
    if (method === 'POST' && parsed.pathname === EMR_PRESCRIPTION_IMPORT_API) {
      const targetPatient = prescriptionPatient(parsed.searchParams.get('recId'));
      if (!targetPatient) return json({ success: false, errorMessage: '対象患者を確認してください。' }, 400);
      const patientReference = `Patient/${targetPatient.externalEmrId || targetPatient.patientId}`;
      let fhirResponse;
      try {
        fhirResponse = await fetchEmrMedicationRequests(patientReference);
      } catch (_) {
        return json({ success: false, errorMessage: '電カルモックの認証に失敗しました。' }, 502);
      }
      const bundle = await fhirResponse.json().catch(function () { return {}; });
      if (!fhirResponse.ok || bundle.resourceType !== 'Bundle') {
        return json({ success: false, errorMessage: '電カルモックから処方箋を取得できませんでした。' }, fhirResponse.status || 502);
      }
      const records = readPrescriptionStore();
      let importedCount = 0;
      let skippedCount = 0;
      (bundle.entry || []).forEach(function (entry) {
        const resource = entry.resource || {};
        const externalId = String(resource.id || '');
        if (resource.resourceType !== 'MedicationRequest' || resource.subject?.reference !== patientReference || !externalId) return;
        if (records.some(function (record) { return record.source === 'emr-mock' && record.externalId === externalId; })) {
          skippedCount += 1;
          return;
        }
        records.unshift({
          id: `EMR-${externalId}`,
          externalId: externalId,
          source: 'emr-mock',
          recId: targetPatient.recId,
          patientId: targetPatient.patientId,
          evaluationDate: resource.authoredOn ? String(resource.authoredOn).slice(0, 10).replaceAll('-', '/') : '',
          summary: emrPrescriptionSummary(resource),
          status: 'OCR_DONE',
          createdAt: new Date().toISOString(),
          standard: 'HL7 FHIR R4 / JP Core MedicationRequest',
          fictionalDemoOnly: true
        });
        importedCount += 1;
      });
      writePrescriptionStore(records);
      const message = importedCount > 0
        ? `電カルモックから処方箋${importedCount}件を取得しました。`
        : '電カルモックの処方箋はすでに取得済みです。';
      return json({ success: true, importedCount: importedCount, skippedCount: skippedCount, message: message });
    }
    if (method === 'POST' && parsed.pathname === PRESCRIPTION_REGISTER_API) {
      let payload;
      try { payload = JSON.parse(options.body || '{}'); } catch (_) { payload = {}; }
      const targetPatient = prescriptionPatient(payload.recId);
      const imageIds = Array.isArray(payload.imageIds) ? payload.imageIds : [];
      const images = imageIds.map(function (id) { return uploadedPrescriptionImages.get(String(id)); }).filter(Boolean);
      if (!targetPatient || images.length < 1 || images.length > 4) {
        return json({ success: false, errorMessage: '患者と処方箋画像（最大4枚）を確認してください。' }, 400);
      }
      const normalizedDate = String(payload.evaluationDate || '').replaceAll('/', '-');
      const analyzedResponse = await originalFetch(PRESCRIPTION_ANALYZE_API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patientId: targetPatient.patientId, prescriptionDate: normalizedDate, images: images })
      });
      const analyzed = await analyzedResponse.json().catch(function () { return {}; });
      if (!analyzedResponse.ok || !analyzed.result) {
        return json({ success: false, errorMessage: analyzed.message || 'AI処方箋の読取に失敗しました。' }, analyzedResponse.status || 502);
      }
      const record = {
        id: `PUBLIC-RX-${Date.now()}`,
        recId: String(payload.recId),
        patientId: targetPatient.patientId,
        evaluationDate: analyzed.result.prescriptionDate || String(payload.evaluationDate || ''),
        summary: prescriptionSummary(analyzed.result),
        status: 'OCR_DONE',
        createdAt: new Date().toISOString(),
        model: analyzed.model || '',
        patient: analyzed.result.patient || {},
        fictionalDemoOnly: true
      };
      writePrescriptionStore([record].concat(readPrescriptionStore()));
      imageIds.forEach(function (id) { uploadedPrescriptionImages.delete(String(id)); });
      return json({ success: true, prescriptionId: record.id, status: record.status });
    }
    return null;
  }

  function ocrSummary(result) {
    const lines = [];
    if (result.summary) lines.push(result.summary);
    if (Array.isArray(result.findings)) result.findings.filter(Boolean).forEach(function (item) { lines.push(`・${item}`); });
    if (Array.isArray(result.warnings) && result.warnings.filter(Boolean).length) lines.push(`要確認：${result.warnings.filter(Boolean).join('／')}`);
    return lines.join('\n') || '評価シートの文字を読み取れませんでした';
  }

  async function ocrApi(url, options) {
    const parsed = new URL(url, location.origin);
    const method = String(options.method || 'GET').toUpperCase();
    if (method !== 'POST' || parsed.pathname !== OCR_REGISTER_API) return null;
    let payload;
    try { payload = JSON.parse(options.body || '{}'); } catch (_) { payload = {}; }
    const targetPatient = prescriptionPatient(payload.recId);
    const imageIds = Array.isArray(payload.imageIds) ? payload.imageIds : [];
    const images = imageIds.map(function (id) { return uploadedPrescriptionImages.get(String(id)); }).filter(Boolean);
    const allowedSheets = ['FIM', 'BBS', 'SLTA', 'WAIS-IV', 'WMS-R', 'BIT', 'CAT-R', 'STEF'];
    if (!targetPatient || !allowedSheets.includes(String(payload.evaluationId)) || images.length < 1 || images.length > 20) {
      return json({ success: false, errorMessage: '患者・評価シート・画像（最大20枚）を確認してください。' }, 400);
    }
    const normalizedDate = String(payload.evaluationDate || '').replaceAll('/', '-');
    const analyzedResponse = await originalFetch(OCR_ANALYZE_API, {
      method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId: targetPatient.patientId, evaluationId: String(payload.evaluationId), evaluationDate: normalizedDate, images: images })
    });
    const analyzed = await analyzedResponse.json().catch(function () { return {}; });
    if (!analyzedResponse.ok || !analyzed.result) {
      return json({ success: false, errorMessage: analyzed.message || 'AIOCRの読取に失敗しました。' }, analyzedResponse.status || 502);
    }
    const record = {
      id: `PUBLIC-OCR-${Date.now()}`, recId: String(payload.recId), evaluationId: String(payload.evaluationId),
      evaluationDate: String(payload.evaluationDate || ''), summary: ocrSummary(analyzed.result), status: '完了',
      createdAt: new Date().toISOString(), model: analyzed.model || '', fictionalDemoOnly: true
    };
    writeListStore(OCR_STORAGE_KEY, [record].concat(readListStore(OCR_STORAGE_KEY)));
    imageIds.forEach(function (id) { uploadedPrescriptionImages.delete(String(id)); });
    return json({ success: true, evaluationId: record.id, status: record.status });
  }

  function defaultSoapRecords() {
    return [{
      treatmentDate: '2026/09/10', treatmentTimes: 1, actualByRole: 'PhysicalTherapist',
      treatmentStartTime: '09:00', treatmentEndTime: '09:40', actualMinutes: 40, userName: '公開デモ 理学療法士',
      treatmentS: [{ freetext: '歩行時の不安は少なくなったとの訴え。' }],
      treatmentO: [{ freeText: '平行棒内を見守りで10m歩行。疼痛の増悪なし。', evaluationDetail: [], inTreatmentDetail: [], outTreatmentDetail: [], eventDetail: [] }],
      treatmentA: [{ freeText: '立位バランスと右下肢支持性が改善傾向。', problemList: [] }],
      treatmentP: [{ freeText: '歩行練習と下肢筋力訓練を継続する。', evaluationList: [], inTreatmentList: [], outTreatmentList: [] }]
    }];
  }

  function readSoapStore(recId) {
    try {
      const store = JSON.parse(localStorage.getItem(SOAP_STORAGE_KEY) || '{}');
      return Array.isArray(store[recId]) ? store[recId] : defaultSoapRecords();
    } catch (_) { return defaultSoapRecords(); }
  }

  function writeSoapStore(recId, records) {
    let store;
    try { store = JSON.parse(localStorage.getItem(SOAP_STORAGE_KEY) || '{}'); } catch (_) { store = {}; }
    store[recId] = records;
    localStorage.setItem(SOAP_STORAGE_KEY, JSON.stringify(store));
  }

  async function soapApi(url, options) {
    const parsed = new URL(url, location.origin);
    const match = /^\/rehainfo\/patient\/([^/]+)\/(?:treatment-soap\/([^/?]+)|delete-treatment-soap)$/.exec(parsed.pathname);
    if (!match) return null;
    const recId = decodeURIComponent(match[1]);
    const action = match[2] || 'delete';
    const method = String(options.method || 'GET').toUpperCase();
    const records = readSoapStore(recId);
    if (action === 'list' && method === 'GET') return json({ treatmentSoapList: records, previousMonth: null, nextMonth: null });
    if (action === 'previous-soap' && method === 'GET') return json(records[records.length - 1] || defaultSoapRecords()[0]);
    if (action === 'get-last-5-soap' && method === 'GET') return json(records.slice(0, 5));
    if ((action === 'save' || action === 'save-list') && method === 'POST') {
      let payload;
      try { payload = JSON.parse(options.body || 'null'); } catch (_) { payload = null; }
      if (Array.isArray(payload) && payload.length) writeSoapStore(recId, payload);
      else if (payload && typeof payload === 'object') {
        const next = records.filter(function (item) { return !(item.treatmentDate === payload.treatmentDate && item.treatmentTimes === payload.treatmentTimes); });
        writeSoapStore(recId, [payload].concat(next));
      }
      return json({ success: true });
    }
    if (action === 'add-new-soap' && method === 'POST') {
      const date = parsed.searchParams.get('treatmentDate') || new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
      const next = defaultSoapRecords()[0];
      next.treatmentDate = date;
      next.treatmentTimes = 1 + records.filter(function (item) { return item.treatmentDate === date; }).length;
      next.treatmentStartTime = null; next.treatmentEndTime = null; next.actualMinutes = null;
      writeSoapStore(recId, [next].concat(records));
      return json({ success: true });
    }
    if (action === 'delete' && method === 'POST') {
      let payload;
      if (options.body instanceof URLSearchParams) payload = { treatmentDate: options.body.get('treatmentDate'), treatmentTimes: Number(options.body.get('treatmentTimes')) };
      else { try { payload = JSON.parse(options.body || '{}'); } catch (_) { payload = {}; } }
      writeSoapStore(recId, records.filter(function (item) { return !(item.treatmentDate === payload.treatmentDate && item.treatmentTimes === payload.treatmentTimes); }));
      return json({ success: true });
    }
    if (method === 'GET') return json(records[0] || defaultSoapRecords()[0]);
    return json({ success: true });
  }

  function therapist(id) {
    return therapists.find(function (item) { return item.id === id; });
  }

  function patient(id) {
    return patients.find(function (item) { return item.id === id; });
  }

  function billing(code) {
    return orcaMasters.find(function (item) { return item.code === code; });
  }

  function enrich(entry) {
    const assigned = therapist(entry.therapistId);
    const target = patient(entry.patientId);
    const item = billing(entry.orcaCode);
    return Object.assign({
      status: '予約', conflictOverride: false, versionNo: 1, requiredRole: null,
      preferredPeriod: null, billingAutoSelected: true, unassigned: false
    }, entry, {
      patientName: target ? target.name : entry.patientName || '担当未定',
      therapistName: assigned ? assigned.name : entry.therapistName || '担当未定',
      therapistRole: assigned ? assigned.subLabel : entry.requiredRole || '',
      billingName: item ? item.name : '',
      billingUnitPoints: item ? item.pointsPerUnit : 0,
      billingPoints: item ? item.pointsPerUnit * Number(entry.units || 0) : 0,
      billingMasterVersion: '厚労省 医科診療行為マスター 2026-06-01',
      billingSelectionReason: entry.billingSelectionReason || '患者の疾患別リハ情報と担当職種から自動選択しました。'
    });
  }

  function assignmentPatientPool() {
    const result = patients.slice();
    patientListRows.forEach(function (row) {
      if (result.some(function (item) { return item.id === row.patientId; })) return;
      result.push({
        id: row.patientId,
        name: row.patientName,
        subLabel: [row.gender, row.rehabilitationClass].filter(Boolean).join('・'),
        ward: row.wardName || '-'
      });
    });
    return result;
  }

  function allTherapistReservationEntries() {
    const baseline = baselineReservationHistory.map(function (item) {
      return enrich({ id: item[0], date: item[1], startTime: item[2], endTime: item[3], patientId: item[4], therapistId: item[5], units: item[6], note: '過去担当実績', orcaCode: '180755710' });
    });
    const store = readStore();
    const stored = Object.keys(store).sort().flatMap(function (date) {
      return Array.isArray(store[date]) ? store[date] : [];
    });
    const seen = new Set();
    return baseline.concat(stored).filter(function (entry) {
      const key = [entry.id, entry.date, entry.patientId, entry.therapistId].join('|');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function therapistPatientAssignments(therapistId) {
    const workflow = readWorkflowStore();
    const assignments = workflow.therapistPatientAssignments || {};
    return Array.isArray(assignments[therapistId]) ? assignments[therapistId] : [];
  }

  function persistTherapistPatientAssignment(therapistId, patientId) {
    const workflow = readWorkflowStore();
    workflow.therapistPatientAssignments = workflow.therapistPatientAssignments || {};
    const assignments = Array.isArray(workflow.therapistPatientAssignments[therapistId])
      ? workflow.therapistPatientAssignments[therapistId] : [];
    if (!assignments.includes(patientId)) assignments.push(patientId);
    workflow.therapistPatientAssignments[therapistId] = assignments;
    writeWorkflowStore(workflow);
  }

  function therapistPatientOverview(therapistId) {
    if (!therapist(therapistId)) return null;
    const patientPool = assignmentPatientPool();
    const patientById = new Map(patientPool.map(function (item) { return [item.id, item]; }));
    const summaries = new Map();
    const allReservations = allTherapistReservationEntries();
    allReservations.forEach(function (entry) {
      if (entry.therapistId !== therapistId || entry.status === '中止') return;
      const target = patientById.get(entry.patientId);
      if (!target) return;
      if (!summaries.has(entry.patientId)) {
        summaries.set(entry.patientId, {
          patientId: target.id, patientName: target.name, patientCategory: target.subLabel, ward: target.ward,
          appointmentCount: 0, totalUnits: 0, firstDate: null, lastDate: null
        });
      }
      const summary = summaries.get(entry.patientId);
      summary.appointmentCount += 1;
      summary.totalUnits += Number(entry.units || 0);
      if (!summary.firstDate || entry.date < summary.firstDate) summary.firstDate = entry.date;
      if (!summary.lastDate || entry.date > summary.lastDate) summary.lastDate = entry.date;
    });
    const byName = function (left, right) {
      return String(left.patientName || '').localeCompare(String(right.patientName || ''), 'ja')
        || String(left.patientId).localeCompare(String(right.patientId));
    };
    const reservationPatients = Array.from(summaries.values()).sort(byName);
    const reservationIds = new Set(reservationPatients.map(function (item) { return item.patientId; }));
    const explicitIds = new Set(therapistPatientAssignments(therapistId));
    const noReservationPatients = [];
    const patientCandidates = [];
    patientPool.forEach(function (target) {
      if (reservationIds.has(target.id)) return;
      const item = { patientId: target.id, patientName: target.name, patientCategory: target.subLabel, ward: target.ward, appointmentCount: 0, totalUnits: 0, firstDate: null, lastDate: null };
      if (explicitIds.has(target.id)) noReservationPatients.push(item);
      else patientCandidates.push(item);
    });
    noReservationPatients.sort(byName);

    const today = new Date().toISOString().slice(0, 10);
    const wardHistory = new Map();
    const categoryHistory = new Map();
    allReservations.forEach(function (entry) {
      if (entry.therapistId !== therapistId || entry.status === '中止' || !entry.date || entry.date >= today) return;
      const target = patientById.get(entry.patientId);
      if (!target) return;
      wardHistory.set(target.ward, (wardHistory.get(target.ward) || 0) + 1);
      categoryHistory.set(target.subLabel, (categoryHistory.get(target.subLabel) || 0) + 1);
    });
    patientCandidates.forEach(function (candidate) {
      const sameWard = wardHistory.get(candidate.ward) || 0;
      const sameCategory = categoryHistory.get(candidate.patientCategory) || 0;
      candidate.candidateScore = sameWard * 3 + sameCategory;
      candidate.candidateReason = sameWard || sameCategory
        ? `過去担当：同病棟${sameWard}件・同区分${sameCategory}件`
        : '過去実績がないため患者名順';
    });
    patientCandidates.sort(function (left, right) {
      return right.candidateScore - left.candidateScore || byName(left, right);
    });
    return {
      reservationPatients: reservationPatients,
      noReservationPatients: noReservationPatients,
      patientCandidates: patientCandidates,
      scheduledPatients: reservationPatients,
      assignedWithoutReservations: noReservationPatients,
      unassignedPatients: patientCandidates
    };
  }

  function defaultEntries(date) {
    return baseEntries.map(function (item) {
      return enrich({ id: item[0], date: date, startTime: item[1], endTime: item[2], patientId: item[3], therapistId: item[4], units: item[5], note: item[6], orcaCode: item[7] });
    });
  }

  function entriesFor(date) {
    const store = readStore();
    if (!Array.isArray(store[date])) {
      store[date] = defaultEntries(date);
      writeStore(store);
    }
    return store[date];
  }

  function saveEntries(date, entries) {
    const store = readStore();
    store[date] = entries;
    writeStore(store);
  }

  function availability(date) {
    return therapists.map(function (item, index) {
      return { date: date, therapistId: item.id, therapistName: item.name, role: item.subLabel, scheduledStart: index === 5 ? '09:00' : '08:30', scheduledEnd: '17:30', workType: '通常勤務', clockIn: '08:28', breakStart: '12:00', breakEnd: '13:00', clockOut: '', status: '勤務中' };
    });
  }

  function daysInMonth(month) {
    const parts = month.split('-');
    return new Date(Number(parts[0]), Number(parts[1]), 0).getDate();
  }

  function attendanceMonth(month) {
    const records = [];
    therapists.forEach(function (item, therapistIndex) {
      for (let day = 1; day <= daysInMonth(month); day += 1) {
        const date = `${month}-${String(day).padStart(2, '0')}`;
        const weekday = new Date(`${date}T12:00:00`).getDay();
        const off = weekday === 0 || weekday === 6;
        records.push({
          date: date, therapistId: item.id, therapistName: item.name, role: item.subLabel,
          workType: off ? '公休' : therapistIndex === 1 && day % 5 === 0 ? '遅番' : '通常勤務',
          scheduledStart: off ? '' : '08:30', scheduledEnd: off ? '' : '17:30',
          clockIn: off ? '' : '08:28', clockOut: '', breakStart: off ? '' : '12:00', breakEnd: off ? '' : '13:00',
          status: off ? '公休' : '勤務中'
        });
      }
    });
    const workflow = readWorkflowStore();
    const savedRecords = workflow.attendance && Array.isArray(workflow.attendance[month]) ? workflow.attendance[month] : [];
    const savedByKey = new Map(savedRecords.map(function (record) { return [`${record.therapistId}|${record.date}`, record]; }));
    records.forEach(function (record, index) {
      const saved = savedByKey.get(`${record.therapistId}|${record.date}`);
      if (saved) records[index] = Object.assign({}, record, saved);
    });
    return { therapists: therapists, records: records };
  }

  function billingData(date) {
    const month = date.slice(0, 7);
    const workflow = readWorkflowStore();
    const targets = workflow.billingTargets || {};
    const rows = therapists.map(function (item, index) {
      const savedTarget = targets[`${month}|${item.id}`] || {};
      return {
        therapistId: item.id, therapistRole: item.subLabel, therapistName: item.name,
        dailyScheduledPoints: 1480 + index * 120, dailyConfirmedPoints: 1110 + index * 90, dailyTargetPoints: savedTarget.dailyTargetPoints ?? 1800,
        weeklyScheduledPoints: 8200 + index * 500, weeklyConfirmedPoints: 7400 + index * 420, weeklyTargetPoints: savedTarget.weeklyTargetPoints ?? 9000,
        monthlyScheduledPoints: 35000 + index * 1800, monthlyConfirmedPoints: 32600 + index * 1650, monthlyTargetPoints: savedTarget.monthlyTargetPoints ?? 39000,
        monthlyResultImported: true, monthlyResultUnits: 170 + index * 8, monthlyWorkedDays: 20
      };
    });
    return {
      success: true, date: date, weekStart: date, weekEnd: date, targetMonth: month, canEdit: true, therapists: rows,
      totals: { dailyScheduledPoints: 10680, dailyConfirmedPoints: 7965, weeklyScheduledPoints: 56700, weeklyConfirmedPoints: 50700, monthlyScheduledPoints: 237000, monthlyConfirmedPoints: 220350 },
      hospitalPerformance: {
        hospitalName: 'スマートリハビリテーション病院', label: `${month} 院内計画・確定実績`, therapistCount: therapists.length, operatingDays: 20,
        targetPoints: 240000, targetUnits: 1200, resultPoints: 220350, resultUnits: 1102, achievementRate: 91.8, unitAchievementRate: 91.8,
        pointDifference: -19650, averageUnitsPerTherapist: 183.7, averageUnitsPerWorkedDay: 9.2,
        roleBreakdown: ['PT', 'OT', 'ST'].map(function (role) { return { role: role, therapistCount: 2, targetUnits: 400, resultUnits: 367, targetPoints: 80000, resultPoints: 73450, achievementRate: 91.8, averageUnitsPerWorkedDay: 9.2 }; }),
        dataNotice: '公開版は架空データのみを使用しています。'
      }
    };
  }

  function operationsData(month) {
    const enrichedEntries = entriesFor(`${month}-10`).map(enrich);
    const therapistRows = therapists.map(function (item, index) {
      return { therapist_id: item.id, therapist_role: item.subLabel, therapist_name: item.name, reservation_count: 18 + index, reserved_units: 40 + index * 2, coded_count: 18 + index, uncoded_count: 0, scheduled_billing_points: 7400 + index * 360, confirmed_billing_points: 6900 + index * 320, utilization_rate: 86 + index };
    });
    return {
      role: 'MANAGER', approved: (readWorkflowStore().approvedMonths || []).includes(month), canApprove: true,
      totals: { reservation_count: 123, reserved_units: 270, coded_count: 123, uncoded_count: 0, scheduled_billing_points: 49800, confirmed_billing_points: 46100 },
      therapists: therapistRows,
      hospitals: [{ service_id: 'DEMO-HOSPITAL', group_id: 'DEMO-GROUP', reservation_count: 123, reserved_units: 270, coded_count: 123, uncoded_count: 0, scheduled_billing_points: 49800, confirmed_billing_points: 46100 }],
      patients: patientListRows.slice(0, 6).map(function (item, index) { return { rec_id: item.patientId, patient_name: item.patientName, reservation_count: 4 + index, reserved_units: 8 + index, actual_units: 7 + index, cancelled_units: 1 }; }),
      pending: enrichedEntries.slice(0, 3).map(function (item) { return { schedule_date: item.date, start_time: item.startTime, patient_name: item.patientName, therapist_name: item.therapistName, units: item.units, orca_code: item.orcaCode, billing_points: item.billingPoints, status: item.status }; }),
      history: [{ create_at: new Date().toISOString(), action: '登録', status: '予約', patient_name: '佐藤 和子', therapist_name: '開発 太郎', detail: '公開デモ予約を登録', create_by: '公開デモ' }]
    };
  }

  function aiPatients() {
    return patientListRows.map(function (item, index) { return { id: item.patientId, name: item.patientName, patientType: index % 2 ? '継続患者' : '回復期患者', ward: item.wardName }; });
  }

  function readAiPlans() {
    const plans = readWorkflowStore().aiPlans;
    return Array.isArray(plans) ? plans : [];
  }

  function writeAiPlans(plans) {
    const workflow = readWorkflowStore();
    workflow.aiPlans = plans.slice(-20);
    writeWorkflowStore(workflow);
  }

  function aiPlanSummary(record) {
    return {
      plan_id: record.plan.plan_id,
      target_month: record.plan.target_month,
      status: record.plan.status,
      selected_patient_count: record.plan.selected_patient_count
    };
  }

  function showPatientActionDialog(title, lines) {
    let dialog = document.getElementById('patientActionDemoDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'patientActionDemoDialog';
      dialog.style.cssText = 'max-width:620px;width:calc(100% - 32px);border:0;border-radius:14px;padding:24px;box-shadow:0 24px 70px #0005;';
      dialog.innerHTML = '<h2 data-action-title style="font-size:20px;margin:0 0 16px"></h2><div data-action-body style="line-height:1.8;white-space:pre-line"></div><div style="text-align:right;margin-top:20px"><button type="button" data-action-close class="btn btn-primary">閉じる</button></div>';
      dialog.querySelector('[data-action-close]').addEventListener('click', function () { dialog.close(); });
      document.body.appendChild(dialog);
    }
    dialog.querySelector('[data-action-title]').textContent = title;
    dialog.querySelector('[data-action-body]').textContent = lines.join('\n');
    dialog.showModal();
  }

  function openPersonalNoteDialog() {
    let dialog = document.getElementById('personalNoteDemoDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'personalNoteDemoDialog';
      dialog.style.cssText = 'max-width:680px;width:calc(100% - 32px);border:0;border-radius:14px;padding:24px;box-shadow:0 24px 70px #0005;';
      dialog.innerHTML = '<form method="dialog"><h2 style="font-size:20px">個人ノート</h2><p>公開版は架空データ専用です。内容はこのブラウザ内にのみ保存されます。</p><textarea data-personal-note rows="10" style="width:100%;padding:12px" aria-label="個人ノート本文"></textarea><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button type="button" data-note-cancel class="btn btn-secondary">キャンセル</button><button type="button" data-note-save class="btn btn-primary">保存</button></div></form>';
      dialog.querySelector('[data-note-cancel]').addEventListener('click', function () { dialog.close(); });
      dialog.querySelector('[data-note-save]').addEventListener('click', function () {
        const workflow = readWorkflowStore();
        workflow.personalNote = dialog.querySelector('[data-personal-note]').value;
        writeWorkflowStore(workflow);
        dialog.close();
        showEmrPatientNotice('個人ノートをブラウザ内に保存しました。', 'success');
      });
      document.body.appendChild(dialog);
    }
    dialog.querySelector('[data-personal-note]').value = readWorkflowStore().personalNote || '';
    dialog.showModal();
  }

  function openManualPatientDialog() {
    let dialog = document.getElementById('manualPatientDemoDialog');
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'manualPatientDemoDialog';
      dialog.style.cssText = 'max-width:720px;width:calc(100% - 32px);border:0;border-radius:14px;padding:24px;box-shadow:0 24px 70px #0005;';
      dialog.innerHTML = '<form data-manual-patient><h2 style="font-size:20px">患者登録</h2><p>公開版には架空患者のみ登録してください。必須項目を入力すると患者一覧へ追加されます。</p><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px"><label>患者ID<input required name="patientId" class="form-control" value="DEMO-NEW-001"></label><label>患者氏名<input required name="patientName" class="form-control" value="検証 花子"></label><label>氏名カナ<input required name="patientNameKana" class="form-control" value="ケンショウ ハナコ"></label><label>性別<select name="gender" class="form-select"><option>女性</option><option>男性</option><option>その他</option></select></label><label>生年月日<input required name="birth" type="date" class="form-control" value="1960-01-01"></label><label>リハ区分<input required name="rehabilitationClass" class="form-control" value="脳血管疾患等"></label><label>リハ開始日<input required name="startDate" type="date" class="form-control" value="2026-09-01"></label><label>入外区分<select name="entryExit" class="form-select"><option>外来</option><option>入院</option></select></label></div><div data-manual-error class="text-danger mt-2"></div><div style="display:flex;justify-content:flex-end;gap:10px;margin-top:16px"><button type="button" data-manual-cancel class="btn btn-secondary">キャンセル</button><button type="submit" class="btn btn-primary">患者として登録</button></div></form>';
      dialog.querySelector('[data-manual-cancel]').addEventListener('click', function () { dialog.close(); });
      dialog.querySelector('[data-manual-patient]').addEventListener('submit', function (event) {
        event.preventDefault();
        const form = event.currentTarget;
        const data = Object.fromEntries(new FormData(form).entries());
        const error = dialog.querySelector('[data-manual-error]');
        if (patientListRows.some(function (item) { return item.patientId === data.patientId; })) {
          error.textContent = '同じ患者IDが登録済みです。';
          return;
        }
        const recId = `MANUAL-${Date.now()}`;
        const patient = normalizePatientAdmissionFields({
          patientId: data.patientId, patientName: data.patientName, patientNameKana: data.patientNameKana,
          gender: data.gender, birth: data.birth.replaceAll('-', '/'), age: patientAge(data.birth),
          rehabilitationClass: data.rehabilitationClass, startDate: data.startDate.replaceAll('-', '/'), entryExit: data.entryExit,
          wardName: data.entryExit === '入院' ? '回復期病棟' : '', hospitalizationStartDate: data.entryExit === '入院' ? data.startDate.replaceAll('-', '/') : '',
          serviceName: 'スマートリハビリテーション病院', recId: recId, groupId: 'DEMO-GROUP', patientActive: 'T',
          treatmentTimes: 0, assigned: true, externalEmrId: data.patientId, fictionalDemoOnly: true,
          primaryDiagnosis: '評価中', impairments: [], risks: [], goal: '目標設定中', professions: ['PT'], plannedUnitsPerDay: 1,
          targetDischargeDate: '', fim: { total: 0, motor: 0, cognitive: 0, previousTotal: 0 }, attendingPhysician: '担当医未設定'
        });
        const saved = readImportedPatientStore();
        saved.push(patient); writeImportedPatientStore(saved); patientListRows.push(patient); refreshSmartRehabPatientLists();
        dialog.close();
        showEmrPatientNotice(`${patient.patientName}さんを患者一覧へ追加しました。`, 'success');
      });
      document.body.appendChild(dialog);
    }
    dialog.querySelector('[data-manual-error]').textContent = '';
    dialog.showModal();
  }

  function createAiPlan(month, patientIds) {
    const selected = aiPatients().filter(function (item) { return patientIds.includes(item.id); });
    const planId = Date.now();
    const analyses = selected.map(function (item, index) {
      const row = patientListRows.find(function (patient) { return patient.patientId === item.id; }) || {};
      const role = (row.professions || ['PT'])[index % Math.max(1, (row.professions || ['PT']).length)] || 'PT';
      return {
        patient_id: item.id, patient_name: item.name, patient_type: item.patientType,
        analysis: `${row.primaryDiagnosis || '疾患情報'}と現在の目標・予定を基に、負荷と休息の間隔を調整しました。`,
        required_role: role, weekly_frequency: Math.max(2, Number(row.plannedUnitsPerDay || 2)), units_per_session: 2
      };
    });
    const proposals = analyses.map(function (item, index) {
      const roleCandidates = therapists.filter(function (candidate) { return candidate.subLabel === item.required_role; });
      const assigned = roleCandidates[index % Math.max(1, roleCandidates.length)] || therapists[index % therapists.length];
      const day = 3 + (index % 24);
      const hour = 9 + (index % 7);
      return {
        proposal_id: planId + index + 1, proposal_type: '新規提案', schedule_date: `${month}-${String(day).padStart(2, '0')}`,
        patient_id: item.patient_id, patient_name: item.patient_name, therapist_id: assigned.id,
        therapist_name: assigned.name, therapist_role: assigned.subLabel, matching_score: 92 - index,
        matching_reason: `${item.required_role}の担当範囲と月間勤務枠が適合`, start_time: `${String(hour).padStart(2, '0')}:00`,
        end_time: `${String(hour).padStart(2, '0')}:40`, units: item.units_per_session, status: '承認待ち'
      };
    });
    const selectedTherapists = Array.from(new Set(proposals.map(function (item) { return item.therapist_id; }))).map(therapist);
    const approvals = selectedTherapists.map(function (item) {
      const count = proposals.filter(function (proposal) { return proposal.therapist_id === item.id; }).length;
      return { therapist_id: item.id, therapist_name: item.name, therapist_role: item.subLabel, proposal_count: count, matching_score: 90 + count, matching_reason: '職種・勤務枠・既存予約の空きを確認', status: '承認待ち' };
    });
    return {
      plan: { plan_id: planId, target_month: month, status: '療法士承認待ち', selected_patient_count: selected.length },
      patients: analyses, therapists: approvals, proposals: proposals
    };
  }

  function bootstrap(date) {
    const entries = entriesFor(date).map(enrich);
    const capacity = {};
    therapists.forEach(function (item) {
      const used = entries.filter(function (entry) { return entry.therapistId === item.id && !entry.unassigned; }).reduce(function (sum, entry) { return sum + Number(entry.units || 0); }, 0);
      capacity[item.id] = Math.max(0, 10 - used);
    });
    return {
      date: date, patients: patients, therapists: therapists, periodStart: date, periodEnd: date,
      entries: entries, maxDailyUnits: 9, minimumGapMinutes: 2,
      monthlyUnits: { total: 8140, reserved: 8140 },
      staffAvailability: availability(date),
      patientEvents: [
        { id: 2001, date: date, startTime: '10:00', endTime: '10:40', patientId: 'SR-DEMO260904', patientName: '田中 博', eventType: 'CT', title: 'CT検査', conflictLevel: 'BLOCK', sourceSystem: '電子カルテ連携デモ' },
        { id: 2002, date: date, startTime: '14:00', endTime: '14:40', patientId: 'SR-DEMO260907', patientName: '山本 恵子', eventType: '診察', title: '主治医診察', conflictLevel: 'WARNING', sourceSystem: '電子カルテ連携デモ' }
      ],
      unassignedEntries: entries.filter(function (entry) { return entry.unassigned; }),
      capacity: capacity, orcaMasters: orcaMasters,
      billingMasterVersion: '厚労省 医科診療行為マスター 2026-06-01'
    };
  }

  async function demoApi(url, options) {
    const parsed = new URL(url, location.origin);
    const path = parsed.pathname.slice(API.length);
    const method = String(options.method || 'GET').toUpperCase();
    const payload = options.body ? JSON.parse(options.body) : {};
    const date = parsed.searchParams.get('date') || payload.date || new Date().toISOString().slice(0, 10);

    if (method === 'GET' && path === '/bootstrap') return json(bootstrap(date));
    if (method === 'GET' && path === '/billing-checks') {
      const role = (therapist(parsed.searchParams.get('therapistId')) || {}).subLabel || 'PT';
      const item = orcaMasters.find(function (candidate) { return candidate.therapistRole === role; });
      return json({ ruleVersion: '公開デモ用ルール 2026-09', suggestion: { item: item, reason: 'リハビリ内容・疾患別リハ情報・療法士職種から候補を表示しています。' }, checks: [{ level: 'OK', message: '当日の患者単位数は上限内です。' }, { level: 'OK', message: '療法士と患者の予定重複はありません。' }] });
    }

    const actualMatch = /^\/entries\/(\d+)\/actual$/.exec(path);
    if (method === 'GET' && actualMatch) {
      const all = Object.values(readStore()).flat();
      const entry = all.find(function (item) { return String(item.id) === actualMatch[1]; });
      return json({ success: Boolean(entry), actual: { status: entry ? entry.status : '予約', actualTherapistId: entry ? entry.therapistId : '', location: 'リハビリ室', actualStart: entry ? entry.startTime : '', actualEnd: entry ? entry.endTime : '', actualUnits: entry ? entry.units : 1, cancelReason: '', note: '' } }, entry ? 200 : 404);
    }

    const workflowMatch = /^\/entries\/(\d+)\/workflow$/.exec(path);
    if (method === 'PUT' && workflowMatch) {
      const store = readStore();
      Object.keys(store).forEach(function (key) { store[key] = store[key].map(function (entry) { return String(entry.id) === workflowMatch[1] ? Object.assign({}, entry, { status: payload.status, versionNo: Number(entry.versionNo || 0) + 1 }) : entry; }); });
      writeStore(store);
      return json({ success: true });
    }

    const entryMatch = /^\/entries\/(\d+)$/.exec(path);
    if (method === 'DELETE' && entryMatch) {
      const store = readStore();
      Object.keys(store).forEach(function (key) { store[key] = store[key].filter(function (entry) { return String(entry.id) !== entryMatch[1]; }); });
      writeStore(store);
      return json({ success: true });
    }
    if (method === 'PUT' && entryMatch) {
      const entries = entriesFor(payload.date);
      const next = enrich(Object.assign({}, payload, { id: Number(entryMatch[1]), versionNo: Number(payload.versionNo || 0) + 1 }));
      saveEntries(payload.date, entries.map(function (entry) { return String(entry.id) === entryMatch[1] ? next : entry; }));
      return json({ success: true, entry: next, gapAdjusted: false });
    }
    if (method === 'POST' && path === '/entries') {
      const next = enrich(Object.assign({}, payload, { id: Date.now(), versionNo: 1 }));
      const entries = entriesFor(payload.date);
      entries.push(next);
      saveEntries(payload.date, entries);
      return json({ success: true, entry: next, gapAdjusted: false }, 201);
    }
    if (method === 'POST' && path === '/bulk-complete') {
      const ids = (payload.ids || []).map(String);
      const store = readStore();
      Object.keys(store).forEach(function (key) { store[key] = store[key].map(function (entry) { return ids.includes(String(entry.id)) ? Object.assign({}, entry, { status: '実施済み' }) : entry; }); });
      writeStore(store);
      return json({ success: true, updated: ids.length });
    }
    if (method === 'POST' && path === '/copy') {
      const source = entriesFor(payload.sourceDate);
      let copied = 0;
      (payload.targetDates || []).forEach(function (targetDate) {
        const clones = source.map(function (entry, index) { return Object.assign({}, entry, { id: Date.now() + copied + index, date: targetDate, status: '予約' }); });
        saveEntries(targetDate, clones);
        copied += clones.length;
      });
      return json({ success: true, copied: copied, skipped: 0 });
    }
    return json({ success: false, message: '公開デモではこの操作を利用できません。' }, 404);
  }

  async function sourceApi(url, options) {
    const parsed = new URL(url, location.origin);
    const method = String(options.method || 'GET').toUpperCase();
    if ([OCR_PATIENT_API, OCR_UPLOAD_API, PRESCRIPTION_REGISTER_API, EMR_PRESCRIPTION_IMPORT_API, EMR_PATIENT_CANDIDATES_API, EMR_PATIENT_LOOKUP_API, EMR_PATIENT_IMPORT_API].includes(parsed.pathname)) return prescriptionApi(url, options);
    if (parsed.pathname === OCR_REGISTER_API) return ocrApi(url, options);
    if (/^\/rehainfo\/patient\/[^/]+\/(?:treatment-soap\/|delete-treatment-soap)/.test(parsed.pathname)) return soapApi(url, options);
    const dischargeMatch = /^\/rehainfo\/patientInfoRest\/([^/]+)\/discharge$/.exec(parsed.pathname);
    if (dischargeMatch) {
      if (method !== 'POST') return json({ success: false, message: '対応していない操作です。' }, 405);
      let dischargePayload = {};
      try { dischargePayload = JSON.parse(options.body || '{}'); } catch (_) { dischargePayload = {}; }
      const patient = patientListRows.find(function (item) { return item.recId === decodeURIComponent(dischargeMatch[1]); });
      const dischargeDate = String(dischargePayload.dischargeDate || '').slice(0, 10);
      const hospitalizationStartDate = String(patient?.hospitalizationStartDate || '').replaceAll('/', '-').slice(0, 10);
      if (!patient) return json({ success: false, message: '対象患者を確認してください。' }, 404);
      if (patient.entryExit !== '入院') return json({ success: false, message: '入院中の患者ではありません。' }, 409);
      if (!hospitalizationStartDate) return json({ success: false, message: '入院日が入力されていないため退院できません。' }, 422);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dischargeDate) || dischargeDate < hospitalizationStartDate) {
        return json({ success: false, message: '退院日は入院日以降の日付を入力してください。' }, 422);
      }
      const dischargeRecords = readPatientDischargeStore();
      dischargeRecords[patient.recId] = dischargeDate;
      writePatientDischargeStore(dischargeRecords);
      patient.hospitalizationEndDate = dischargeDate.replaceAll('-', '/');
      patient.entryExit = '退院';
      patient.patientActive = 'F';
      return json({ success: true, patient: patient });
    }
    let payload = {};
    if (options.body && typeof options.body === 'string') {
      try { payload = JSON.parse(options.body); } catch (_) { payload = {}; }
    }
    if (parsed.pathname.startsWith(API)) return demoApi(url, options);
    if (parsed.pathname.startsWith(THERAPIST_API)) {
	  if (parsed.pathname === `${THERAPIST_API}/assigned-patients`) {
		if (method === 'GET') {
		  const therapistId = parsed.searchParams.get('therapistId') || '';
		  const overview = therapistPatientOverview(therapistId);
		  if (!overview) return json({ success: false, message: '対象療法士が見つかりません。' }, 404);
		  return json(Object.assign({ success: true, therapistId: therapistId, patients: overview.reservationPatients, count: overview.reservationPatients.length }, overview));
		}
		if (method === 'POST') {
		  if (!therapist(payload.therapistId)) return json({ success: false, message: '対象療法士が見つかりません。' }, 404);
		  if (!assignmentPatientPool().some(function (item) { return item.id === payload.patientId; })) return json({ success: false, message: '対象患者が見つかりません。' }, 404);
		  persistTherapistPatientAssignment(payload.therapistId, payload.patientId);
		  return json({ success: true, message: '担当患者に設定しました。' });
		}
	  }
	  if (method === 'GET' && parsed.pathname === THERAPIST_API) return json({ therapists: therapists });
      if (method === 'POST' && parsed.pathname === THERAPIST_API) {
        if (!payload.id || !payload.name) return json({ success: false, message: '療法士IDと氏名を入力してください。' }, 422);
        if (therapists.some(function (item) { return item.id === payload.id; })) return json({ success: false, message: '同じ療法士IDが登録済みです。' }, 409);
        therapists.push(Object.assign({ monthlyTargetUnits: 0, team: '', ward: null }, payload));
        persistTherapists();
        return json({ success: true });
      }
      if (method === 'PUT' && parsed.pathname.endsWith('/monthly-target')) {
        const targetTherapist = therapist(payload.therapistId);
        if (!targetTherapist) return json({ success: false, message: '対象療法士が見つかりません。' }, 404);
        targetTherapist.monthlyTargetUnits = Number(payload.targetUnits || 0);
        persistTherapists();
        return json({ success: true });
      }
    }
    if (parsed.pathname.startsWith(ATTENDANCE_API)) {
      if (method === 'GET') return json(attendanceMonth(parsed.searchParams.get('month') || new Date().toISOString().slice(0, 7)));
      if (method === 'PUT' && parsed.pathname.endsWith('/order') && Array.isArray(payload)) {
        therapists.sort(function (left, right) { return payload.indexOf(left.id) - payload.indexOf(right.id); });
        persistTherapists();
        return json({ success: true });
      }
      if (method === 'PUT' && (parsed.pathname.endsWith('/record') || parsed.pathname.endsWith('/records'))) {
        const updates = Array.isArray(payload) ? payload : [payload];
        const workflow = readWorkflowStore();
        workflow.attendance = workflow.attendance || {};
        updates.forEach(function (update) {
          if (!update.date || !update.therapistId) return;
          const month = String(update.date).slice(0, 7);
          const monthRecords = Array.isArray(workflow.attendance[month]) ? workflow.attendance[month] : [];
          const index = monthRecords.findIndex(function (item) { return item.date === update.date && item.therapistId === update.therapistId; });
          if (index >= 0) monthRecords[index] = Object.assign({}, monthRecords[index], update);
          else monthRecords.push(update);
          workflow.attendance[month] = monthRecords;
        });
        writeWorkflowStore(workflow);
        return json({ success: true, updated: updates.length });
      }
    }
    if (parsed.pathname.startsWith(BILLING_API)) {
      if (method === 'GET') return json(billingData(parsed.searchParams.get('date') || new Date().toISOString().slice(0, 10)));
      if (method === 'PUT' && parsed.pathname.endsWith('/targets')) {
        const workflow = readWorkflowStore();
        workflow.billingTargets = workflow.billingTargets || {};
        workflow.billingTargets[`${payload.targetMonth}|${payload.therapistId}`] = payload;
        writeWorkflowStore(workflow);
        return json({ success: true });
      }
    }
    if (parsed.pathname.startsWith(OPERATIONS_API)) {
      const month = parsed.searchParams.get('month') || new Date().toISOString().slice(0, 7);
      if (parsed.pathname.endsWith('/dashboard')) return json(operationsData(month));
      if (parsed.pathname.endsWith('/integration')) return json({ source: 'fictional-public-demo', month: month, externalClinicalSystemsConnected: false, generatedAt: new Date().toISOString() });
      if (parsed.pathname.endsWith('/approve')) {
        const workflow = readWorkflowStore();
        workflow.approvedMonths = Array.from(new Set((workflow.approvedMonths || []).concat(month)));
        writeWorkflowStore(workflow);
        return json({ success: true });
      }
    }
    if (parsed.pathname.startsWith(AI_API)) {
      const plans = readAiPlans();
      if (parsed.pathname.endsWith('/patients')) return json({ patients: aiPatients(), plans: plans.map(aiPlanSummary) });
      if (method === 'POST' && parsed.pathname.endsWith('/generate')) {
        const ids = Array.isArray(payload.patientIds) ? payload.patientIds : [];
        if (!ids.length) return json({ success: false, message: '患者を選択してください。' }, 422);
        const nextPlan = createAiPlan(payload.month || new Date().toISOString().slice(0, 7), ids);
        plans.push(nextPlan);
        writeAiPlans(plans);
        return json({ success: true, proposalCount: nextPlan.proposals.length, planId: nextPlan.plan.plan_id });
      }
      const planMatch = /\/plans\/(\d+)(?:\/(approve|apply))?$/.exec(parsed.pathname);
      if (planMatch) {
        const selectedPlan = plans.find(function (item) { return String(item.plan.plan_id) === planMatch[1]; });
        if (!selectedPlan) return json({ success: false, message: '計画が見つかりません。' }, 404);
        if (!planMatch[2] && method === 'GET') return json(selectedPlan);
        if (planMatch[2] === 'approve' && method === 'POST') {
          const therapistId = parsed.searchParams.get('therapistId');
          const approval = selectedPlan.therapists.find(function (item) { return item.therapist_id === therapistId; });
          if (!approval) return json({ success: false, message: '承認対象の療法士が見つかりません。' }, 404);
          approval.status = '承認済み';
          selectedPlan.proposals.filter(function (item) { return item.therapist_id === therapistId; }).forEach(function (item) { item.status = '承認済み'; });
          if (selectedPlan.therapists.every(function (item) { return item.status === '承認済み'; })) selectedPlan.plan.status = '全療法士承認済み';
          writeAiPlans(plans);
          return json({ success: true });
        }
        if (planMatch[2] === 'apply' && method === 'POST') {
          if (selectedPlan.plan.status !== '全療法士承認済み') return json({ success: false, message: '全療法士の承認後に反映してください。' }, 409);
          selectedPlan.proposals.forEach(function (proposal, index) {
            const entries = entriesFor(proposal.schedule_date);
            entries.push(enrich({ id: Date.now() + index, date: proposal.schedule_date, startTime: proposal.start_time, endTime: proposal.end_time, patientId: proposal.patient_id, therapistId: proposal.therapist_id, units: proposal.units, note: 'AI月間案から反映', orcaCode: proposal.therapist_role === 'OT' ? '180755810' : proposal.therapist_role === 'ST' ? '180755910' : '180755710', status: '予約' }));
            saveEntries(proposal.schedule_date, entries);
            proposal.status = '本予約反映済み';
          });
          selectedPlan.plan.status = '本予約反映済み';
          writeAiPlans(plans);
          return json({ success: true, applied: selectedPlan.proposals.length, skipped: 0 });
        }
      }
    }
    return null;
  }

  function refreshSmartRehabPatientLists() {
    window.REHAINFO_DEMO_PATIENTS = patientListRows;
    window.patientListAllRows = patientListRows.slice();
    const responsibleOnly = Boolean((document.getElementById('responsibleOnlyToggle') || {}).checked);
    try {
      if (typeof window.loadAllPatients === 'function') {
        window.loadAllPatients(responsibleOnly);
      } else if (typeof window.onChangeInput === 'function') {
        window.onChangeInput();
      } else if (typeof window.patientListApplyFilteredRows === 'function') {
        window.patientListApplyFilteredRows(patientListRows);
      }
    } catch (error) {
      console.error('患者一覧の再描画に失敗しました:', error);
    }
  }

  function showEmrPatientNotice(message, type) {
    if (typeof window.showNotice === 'function') {
      window.showNotice(message, type);
      return;
    }
    const notice = document.createElement('div');
    const success = type === 'success';
    notice.className = success ? 'alert alert-success' : 'alert alert-danger';
    notice.setAttribute('role', 'status');
    notice.style.cssText = `position:fixed;top:20px;right:20px;z-index:10001;padding:12px 20px;border-radius:5px;max-width:440px;background:${success ? '#dcfce7' : '#f8d7da'};color:${success ? '#166534' : '#721c24'};border:1px solid ${success ? '#86efac' : '#f5c6cb'};`;
    notice.textContent = message;
    document.body.appendChild(notice);
    window.setTimeout(function () { notice.remove(); }, 5000);
  }

  function ensureEmrPatientDialog() {
    let dialog = document.getElementById('emrPatientImportDialog');
    if (dialog) return dialog;
    const style = document.createElement('style');
    style.textContent = `
      #emrPatientImportDialog { width: min(1180px, calc(100vw - 32px)); max-height: calc(100vh - 48px); padding: 0; border: 0; border-radius: 10px; box-shadow: 0 24px 80px rgba(0,0,0,.28); color: #202B4C; }
      #emrPatientImportDialog::backdrop { background: rgba(13, 22, 45, .55); }
      .emr-patient-dialog-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 20px 24px 16px; border-bottom: 1px solid #d9dee8; }
      .emr-patient-dialog-header h2 { margin: 0 0 4px; font-size: 22px; }
      .emr-patient-dialog-header p { margin: 0; color: #59657b; font-size: 13px; }
      .emr-patient-dialog-close { border: 0; background: transparent; color: #202B4C; font-size: 28px; line-height: 1; cursor: pointer; }
      .emr-patient-dialog-body { padding: 18px 24px 24px; overflow: auto; }
      .emr-patient-dialog-status { min-height: 24px; margin: 0 0 12px; color: #4d5b73; }
      .emr-patient-dialog-table { width: 100%; border-collapse: collapse; background: #fff; }
      .emr-patient-dialog-table th, .emr-patient-dialog-table td { padding: 11px 10px; border-bottom: 1px solid #e4e8ef; text-align: left; vertical-align: middle; }
      .emr-patient-dialog-table th { background: #f4f6f9; font-size: 13px; white-space: nowrap; }
      .emr-patient-dialog-table td { font-size: 14px; }
      .emr-patient-dialog-table small { display: block; color: #6b7587; margin-top: 2px; }
      .emr-patient-dialog-add { min-width: 76px; min-height: 38px; border: 1px solid #202B4C; border-radius: 5px; background: #202B4C; color: #fff; font-weight: 600; cursor: pointer; }
      .emr-patient-dialog-add:disabled { border-color: #b8c0ce; background: #e4e8ef; color: #667085; cursor: default; }
      @media (max-width: 680px) { .emr-patient-dialog-table th:nth-child(3), .emr-patient-dialog-table td:nth-child(3), .emr-patient-dialog-table th:nth-child(5), .emr-patient-dialog-table td:nth-child(5), .emr-patient-dialog-table th:nth-child(6), .emr-patient-dialog-table td:nth-child(6) { display: none; } }
    `;
    document.head.appendChild(style);
    dialog = document.createElement('dialog');
    dialog.id = 'emrPatientImportDialog';
    dialog.setAttribute('aria-labelledby', 'emrPatientImportDialogTitle');
    const header = document.createElement('div');
    header.className = 'emr-patient-dialog-header';
    const heading = document.createElement('div');
    const title = document.createElement('h2');
    title.id = 'emrPatientImportDialogTitle';
    title.textContent = '電カルから患者追加';
    const description = document.createElement('p');
    description.textContent = '電カルモックの架空患者をFHIR R4 / JP Core Patient形式で取得しています。';
    heading.append(title, description);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'emr-patient-dialog-close';
    close.setAttribute('aria-label', '閉じる');
    close.textContent = '×';
    close.addEventListener('click', function () { dialog.close(); });
    header.append(heading, close);
    const body = document.createElement('div');
    body.className = 'emr-patient-dialog-body';
    const status = document.createElement('p');
    status.className = 'emr-patient-dialog-status';
    status.setAttribute('role', 'status');
    const table = document.createElement('table');
    table.className = 'emr-patient-dialog-table';
    const head = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['患者ID', '患者名', '主病名', 'リハ依頼', '入院日', '生年月日', '性別', '操作'].forEach(function (label) {
      const cell = document.createElement('th');
      cell.scope = 'col';
      cell.textContent = label;
      headRow.appendChild(cell);
    });
    head.appendChild(headRow);
    const rows = document.createElement('tbody');
    rows.id = 'emrPatientImportCandidates';
    table.append(head, rows);
    body.append(status, table);
    dialog.append(header, body);
    document.body.appendChild(dialog);
    return dialog;
  }

  function renderEmrPatientCandidates(dialog, candidates) {
    const rows = dialog.querySelector('#emrPatientImportCandidates');
    rows.replaceChildren();
    candidates.forEach(function (candidate) {
      const row = document.createElement('tr');
      const idCell = document.createElement('td');
      idCell.textContent = candidate.externalEmrId;
      const nameCell = document.createElement('td');
      const name = document.createElement('strong');
      name.textContent = candidate.patientName;
      const kana = document.createElement('small');
      kana.textContent = candidate.patientNameKana;
      nameCell.append(name, kana);
      const diagnosisCell = document.createElement('td');
      diagnosisCell.textContent = candidate.primaryDiagnosis;
      const rehabCell = document.createElement('td');
      rehabCell.textContent = candidate.eligible ? `${candidate.rehabilitationClass} / ${candidate.entryExit}` : 'リハ依頼なし';
      if (candidate.eligible) {
        const ward = document.createElement('small');
        ward.textContent = candidate.wardName;
        rehabCell.appendChild(ward);
      }
      const admissionCell = document.createElement('td');
      admissionCell.textContent = candidate.hospitalizationStartDate;
      const birthCell = document.createElement('td');
      birthCell.textContent = `${candidate.birth}${candidate.age ? `（${candidate.age}）` : ''}`;
      const genderCell = document.createElement('td');
      genderCell.textContent = candidate.gender;
      const actionCell = document.createElement('td');
      const add = document.createElement('button');
      add.type = 'button';
      add.className = 'emr-patient-dialog-add';
      add.textContent = candidate.alreadyAdded ? '追加済み' : candidate.eligible ? '追加' : '対象外';
      add.disabled = candidate.alreadyAdded || !candidate.eligible;
      add.addEventListener('click', async function () {
        add.disabled = true;
        add.textContent = '追加中…';
        try {
          const response = await fetch(EMR_PATIENT_IMPORT_API, {
            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({ externalEmrId: candidate.externalEmrId })
          });
          const result = await response.json().catch(function () { return {}; });
          if (!response.ok || !result.success) {
            add.disabled = false;
            add.textContent = '追加';
            const message = result.errorMessage || '患者をスマリハに追加できませんでした。';
            dialog.querySelector('.emr-patient-dialog-status').textContent = message;
            showEmrPatientNotice(message, 'error');
            return;
          }
          candidate.alreadyAdded = true;
          add.textContent = '追加済み';
          refreshSmartRehabPatientLists();
          showEmrPatientNotice(result.message || '患者をスマリハに追加しました。', 'success');
        } catch (error) {
          add.disabled = false;
          add.textContent = '追加';
          const message = error?.message || '患者をスマリハに追加できませんでした。';
          dialog.querySelector('.emr-patient-dialog-status').textContent = message;
          showEmrPatientNotice(message, 'error');
        }
      });
      actionCell.appendChild(add);
      [idCell, nameCell, diagnosisCell, rehabCell, admissionCell, birthCell, genderCell, actionCell].forEach(function (cell) { row.appendChild(cell); });
      rows.appendChild(row);
    });
  }

  async function openEmrPatientImportDialog() {
    const dialog = ensureEmrPatientDialog();
    const status = dialog.querySelector('.emr-patient-dialog-status');
    const rows = dialog.querySelector('#emrPatientImportCandidates');
    status.textContent = '電カルモックから患者一覧を取得中です…';
    rows.replaceChildren();
    dialog.showModal();
    try {
      const response = await fetch(EMR_PATIENT_CANDIDATES_API, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
      const result = await response.json().catch(function () { return {}; });
      if (!response.ok || !result.success) {
        status.textContent = result.errorMessage || '電カルモックから患者一覧を取得できませんでした。';
        return;
      }
      const eligibleCount = result.patients.filter(function (patient) { return patient.eligible; }).length;
      status.textContent = `${result.patients.length}名を取得しました。リハ依頼あり ${eligibleCount}名を追加できます。追加済みの患者は再追加できません。`;
      renderEmrPatientCandidates(dialog, result.patients);
    } catch (_) {
      status.textContent = '電カルモックから患者一覧を取得できませんでした。';
    }
  }

  const prescriptionPatientRequiredFields = {
    patientId: '患者IDを入力してください。', birth: '生年月日を入力してください。',
    familyName: '姓を入力してください。', firstName: '名を入力してください。',
    familyNameKana: '姓カナを入力してください。', firstNameKana: '名カナを入力してください。',
    gender: '性別を選択してください。', entryExit: '入外区分を選択してください。',
    rehabilitationClass: 'リハビリテーション区分を入力してください。',
    rehabilitationStartDate: 'リハビリ開始日を入力してください。'
  };

  function prescriptionPatientFormValue(form, name) {
    return String(new FormData(form).get(name) || '').trim();
  }

  function clearPrescriptionPatientErrors(form) {
    form.querySelectorAll('.invalid').forEach(function (field) { field.classList.remove('invalid'); });
    form.querySelectorAll('.field-error').forEach(function (error) { error.textContent = ''; });
  }

  function showPrescriptionPatientErrors(form, errors) {
    clearPrescriptionPatientErrors(form);
    Object.keys(errors).forEach(function (name) {
      const field = form.elements.namedItem(name);
      const error = form.querySelector(`[data-error-for="${name}"]`);
      if (field) field.classList.add('invalid');
      if (error) error.textContent = errors[name];
    });
    const first = form.querySelector('.invalid');
    if (first) first.focus();
  }

  function splitPrescriptionPatientName(value) {
    const parts = String(value || '').trim().split(/[\s　]+/).filter(Boolean);
    return { familyName: parts[0] || '', firstName: parts.slice(1).join(' ') };
  }

  function prescriptionPatientDraft(record) {
    const source = record.patient && typeof record.patient === 'object' ? record.patient : {};
    const name = splitPrescriptionPatientName(source.patientName || source.name);
    const kana = splitPrescriptionPatientName(source.patientNameKana || source.nameKana);
    return {
      patientId: String(source.patientId || record.patientId || ''),
      birth: String(source.birth || source.birthDate || '').replaceAll('/', '-').slice(0, 10),
      familyName: String(source.familyName || name.familyName || ''), firstName: String(source.firstName || name.firstName || ''),
      familyNameKana: String(source.familyNameKana || kana.familyName || ''), firstNameKana: String(source.firstNameKana || kana.firstName || ''),
      gender: String(source.gender || ''), entryExit: String(source.entryExit || ''),
      rehabilitationClass: String(source.rehabilitationClass || ''),
      rehabilitationStartDate: String(source.rehabilitationStartDate || source.startDate || '').replaceAll('/', '-').slice(0, 10),
      hospitalizationStartDate: String(source.hospitalizationStartDate || '').replaceAll('/', '-').slice(0, 10),
      wardName: String(source.wardName || ''), primaryDiagnosis: String(source.primaryDiagnosis || '')
    };
  }

  function applyPrescriptionPatientDraft(form, draft, preserveWhenMissing) {
    Object.keys(draft).forEach(function (name) {
      const field = form.elements.namedItem(name);
      const value = String(draft[name] || '');
      if (field && (!preserveWhenMissing || value)) field.value = value;
    });
  }

  function prescriptionPatientMissingFields(form) {
    const missing = {};
    Object.keys(prescriptionPatientRequiredFields).forEach(function (name) {
      if (!prescriptionPatientFormValue(form, name)) missing[name] = prescriptionPatientRequiredFields[name];
    });
    if (prescriptionPatientFormValue(form, 'entryExit') === '入院') {
      if (!prescriptionPatientFormValue(form, 'hospitalizationStartDate')) missing.hospitalizationStartDate = '入院日を入力してください。';
      if (!prescriptionPatientFormValue(form, 'wardName')) missing.wardName = '病棟名を入力してください。';
    }
    return missing;
  }

  async function resolvePrescriptionPatientFromEmr(record, form, status) {
    const patientId = prescriptionPatientFormValue(form, 'patientId');
    if (!patientId) {
      showPrescriptionPatientErrors(form, { patientId: '患者IDを入力してください。' });
      status.className = 'patient-dialog-status error';
      status.textContent = '患者IDを入力してから取得してください。';
      return false;
    }
    status.className = 'patient-dialog-status';
    status.textContent = '患者IDから電カル情報を取得しています。';
    const response = await fetch(`${EMR_PATIENT_LOOKUP_API}?patientId=${encodeURIComponent(patientId)}`, {
      credentials: 'same-origin', headers: { Accept: 'application/json' }
    });
    const result = await response.json().catch(function () { return {}; });
    const lookup = result.emrLookup || {};
    if (!response.ok || !result.success || lookup.status !== 'matched') {
      const message = lookup.message || result.errorMessage || '患者IDに一致する患者が電カルに見つかりません。';
      showPrescriptionPatientErrors(form, { patientId: message });
      status.className = 'patient-dialog-status error';
      status.textContent = message;
      return true;
    }
    record.emrPatient = result.patient || {};
    const draft = prescriptionPatientDraft({ patient: record.emrPatient, patientId: patientId });
    // A new patient ID replaces the previous draft completely so that fields
    // absent from the EMR never retain another patient's values.
    applyPrescriptionPatientDraft(form, draft, false);
    const missing = prescriptionPatientMissingFields(form);
    showPrescriptionPatientErrors(form, missing);
    status.className = Object.keys(missing).length ? 'patient-dialog-status' : 'patient-dialog-status success';
    status.textContent = lookup.alreadyAdded
      ? 'この患者は登録済みです。「患者として追加」を押すと処方箋を紐付けて患者一覧を表示します。'
      : `${lookup.message} ${Object.keys(missing).length ? '電カルでも取得できなかった必須項目を入力してください。' : '登録内容を確認して「患者として追加」を押してください。'}`;
    return true;
  }

  function validatePrescriptionPatient(form) {
    const errors = {};
    Object.keys(prescriptionPatientRequiredFields).forEach(function (name) {
      if (!prescriptionPatientFormValue(form, name)) errors[name] = prescriptionPatientRequiredFields[name];
    });
    const patientId = prescriptionPatientFormValue(form, 'patientId');
    if (patientId && !/^[A-Za-z0-9._-]{1,64}$/.test(patientId)) errors.patientId = '患者IDは半角英数字・ハイフン・アンダースコア・ピリオドで入力してください。';
    if (prescriptionPatientFormValue(form, 'entryExit') === '入院') {
      if (!prescriptionPatientFormValue(form, 'hospitalizationStartDate')) errors.hospitalizationStartDate = '入院日を入力してください。';
      if (!prescriptionPatientFormValue(form, 'wardName')) errors.wardName = '病棟名を入力してください。';
    }
    return errors;
  }

  function registerPrescriptionPatient(record, form) {
    const patientId = prescriptionPatientFormValue(form, 'patientId');
    const birth = prescriptionPatientFormValue(form, 'birth');
    const entryExit = prescriptionPatientFormValue(form, 'entryExit');
    const emrPatient = record.emrPatient || {};
    const matchingIds = [patientId, emrPatient.patientId, emrPatient.externalEmrId].filter(Boolean);
    const existingPatient = patientListRows.find(function (candidate) {
      return matchingIds.includes(candidate.patientId) || matchingIds.includes(candidate.externalEmrId);
    });
    if (existingPatient) {
      const existingImport = { patientId: existingPatient.patientId, recId: existingPatient.recId, importedAt: new Date().toISOString() };
      record.patientImport = existingImport;
      const existingPrescriptions = readPrescriptionStore();
      const existingTarget = existingPrescriptions.find(function (item) { return item.id === record.id; });
      if (existingTarget) existingTarget.patientImport = existingImport;
      writePrescriptionStore(existingPrescriptions);
      return { patient: existingPatient, alreadyAdded: true };
    }
    const recId = `RX-${patientId}-${Date.now()}`;
    const patient = normalizePatientAdmissionFields({
      patientId: patientId,
      patientName: `${prescriptionPatientFormValue(form, 'familyName')} ${prescriptionPatientFormValue(form, 'firstName')}`,
      patientNameKana: `${prescriptionPatientFormValue(form, 'familyNameKana')} ${prescriptionPatientFormValue(form, 'firstNameKana')}`,
      gender: prescriptionPatientFormValue(form, 'gender'), birth: birth.replaceAll('-', '/'), age: patientAge(birth),
      rehabilitationClass: prescriptionPatientFormValue(form, 'rehabilitationClass'),
      startDate: prescriptionPatientFormValue(form, 'rehabilitationStartDate').replaceAll('-', '/'), entryExit: entryExit,
      hospitalizationStartDate: prescriptionPatientFormValue(form, 'hospitalizationStartDate').replaceAll('-', '/'),
      hospitalizationEndDate: emrPatient.hospitalizationEndDate || '', wardName: entryExit === '入院' ? prescriptionPatientFormValue(form, 'wardName') : '',
      serviceName: 'スマートリハビリテーション病院', recId: recId, groupId: 'DEMO-GROUP', fitbitId: '', patientActive: 'T',
      treatmentTimes: 0, rehabStartTime: null, assigned: true, externalEmrId: emrPatient.externalEmrId || patientId,
      importedFrom: record.emrPatient ? 'prescription-ocr+emr-id' : 'prescription-ocr', fictionalDemoOnly: true,
      primaryDiagnosis: prescriptionPatientFormValue(form, 'primaryDiagnosis') || emrPatient.primaryDiagnosis || '未設定',
      impairments: emrPatient.impairments || [], risks: emrPatient.risks || [], goal: emrPatient.goal || '目標未設定',
      professions: emrPatient.professions || ['PT'], plannedUnitsPerDay: Number(emrPatient.plannedUnitsPerDay || 0),
      targetDischargeDate: emrPatient.targetDischargeDate || '', fim: emrPatient.fim || { total: 0, motor: 0, cognitive: 0, previousTotal: 0 },
      attendingPhysician: emrPatient.attendingPhysician || '担当医未設定', sourcePrescriptionId: record.id
    });
    const importedPatients = readImportedPatientStore();
    importedPatients.push(patient);
    writeImportedPatientStore(importedPatients);
    patientListRows.push(patient);
    window.REHAINFO_DEMO_PATIENTS = patientListRows;
    const prescriptions = readPrescriptionStore();
    const target = prescriptions.find(function (item) { return item.id === record.id; });
    const patientImport = { patientId: patientId, recId: recId, importedAt: new Date().toISOString() };
    record.patientImport = patientImport;
    if (target) target.patientImport = patientImport;
    writePrescriptionStore(prescriptions);
    return { patient: patient, alreadyAdded: false };
  }

  async function openPrescriptionPatientDialog(record) {
    const dialog = document.getElementById('prescriptionPatientDialog');
    const form = document.getElementById('prescriptionPatientForm');
    const status = document.getElementById('prescriptionPatientStatus');
    const submit = document.getElementById('prescriptionPatientSubmit');
    if (!dialog || !form || !status || !submit) return;
    clearPrescriptionPatientErrors(form);
    const draft = prescriptionPatientDraft(record);
    applyPrescriptionPatientDraft(form, draft, false);
    let missing = prescriptionPatientMissingFields(form);
    status.className = 'patient-dialog-status';
    status.textContent = record.patientImport ? 'この処方箋から患者を追加済みです。'
      : draft.patientId ? '患者IDから電カル情報を取得しています。'
        : Object.keys(missing).length ? '患者IDと不足している必須項目を入力してください。' : '読取結果を確認して「患者として追加」を押してください。';
    submit.disabled = Boolean(record.patientImport);
    if (!record.patientImport) showPrescriptionPatientErrors(form, missing);
    const lookupButton = document.getElementById('prescriptionPatientLookup');
    if (lookupButton) lookupButton.onclick = async function () {
      lookupButton.disabled = true;
      try {
        submit.disabled = !(await resolvePrescriptionPatientFromEmr(record, form, status));
      } finally {
        lookupButton.disabled = false;
      }
    };
    form.onsubmit = function (event) {
      event.preventDefault();
      const errors = validatePrescriptionPatient(form);
      if (Object.keys(errors).length) {
        status.className = 'patient-dialog-status error';
        status.textContent = '赤く表示された必須項目を確認してください。';
        showPrescriptionPatientErrors(form, errors);
        return;
      }
      submit.disabled = true;
      const registration = registerPrescriptionPatient(record, form);
      const patient = registration.patient;
      status.className = 'patient-dialog-status success';
      status.textContent = registration.alreadyAdded
        ? `${patient.patientName}さんの登録済み患者情報に処方箋を紐付けました。患者一覧を表示します。`
        : `${patient.patientName}さんを患者として追加しました。`;
      submit.textContent = registration.alreadyAdded ? '登録済み患者を表示' : '追加しました';
      window.setTimeout(function () {
        window.location.href = registration.alreadyAdded && patient.recId
          ? `/rehainfo/patient/${encodeURIComponent(patient.recId)}/top`
          : `/rehainfo/?patientId=${encodeURIComponent(patient.patientId)}`;
      }, 250);
    };
    dialog.showModal();
    if (!record.patientImport && draft.patientId) {
      try {
        submit.disabled = !(await resolvePrescriptionPatientFromEmr(record, form, status));
      } catch (error) {
        status.className = 'patient-dialog-status error';
        status.textContent = error.message || '電カル情報を取得できませんでした。';
        submit.disabled = false;
      }
    }
    missing = prescriptionPatientMissingFields(form);
    const first = form.querySelector('.invalid');
    if (first && Object.keys(missing).length) first.focus();
  }

  window.fetch = function (input, options) {
    const url = typeof input === 'string' ? input : input.url;
    const path = new URL(url, location.origin).pathname;
    if ([API, THERAPIST_API, ATTENDANCE_API, BILLING_API, OPERATIONS_API, AI_API].some(function (prefix) { return path.startsWith(prefix); })
        || [OCR_PATIENT_API, OCR_UPLOAD_API, OCR_REGISTER_API, PRESCRIPTION_REGISTER_API, EMR_PRESCRIPTION_IMPORT_API, EMR_PATIENT_CANDIDATES_API, EMR_PATIENT_LOOKUP_API, EMR_PATIENT_IMPORT_API].includes(path)
        || /^\/rehainfo\/patient\/[^/]+\/(?:treatment-soap\/|delete-treatment-soap)/.test(path)
        || /^\/rehainfo\/patientInfoRest\/[^/]+\/discharge$/.test(path)) {
      return sourceApi(url, options || {});
    }
    return originalFetch(input, options);
  };

  document.addEventListener('DOMContentLoaded', function () {
    const personalNoteButton = document.getElementById('speechMemoButton');
    if (personalNoteButton) {
      personalNoteButton.removeAttribute('onclick');
      personalNoteButton.addEventListener('click', openPersonalNoteDialog);
    }
    const patientRegisterButton = document.getElementById('patientRegister');
    if (patientRegisterButton) patientRegisterButton.addEventListener('click', function (event) { event.preventDefault(); openManualPatientDialog(); });
    const patientListButton = document.getElementById('patientListButton');
    if (patientListButton) patientListButton.addEventListener('click', function (event) { event.preventDefault(); window.location.href = '/rehainfo/'; });
    const presetForm = document.querySelector('form[action="/rehainfo/adminEvaluationPreset"]');
    if (presetForm) presetForm.addEventListener('submit', function (event) {
      event.preventDefault();
      showPatientActionDialog('評価項目設定', ['FIM・BBS・10m歩行・握力を使用中です。', '公開版では架空データ用の標準設定を表示しています。']);
    });
    const emrPatientImportButton = document.getElementById('emrPatientImportButton');
    if (emrPatientImportButton) emrPatientImportButton.addEventListener('click', openEmrPatientImportDialog);
    const prescriptionPatientDialog = document.getElementById('prescriptionPatientDialog');
    if (prescriptionPatientDialog) {
      prescriptionPatientDialog.querySelectorAll('.patient-dialog-close, .patient-dialog-cancel').forEach(function (button) {
        button.addEventListener('click', function () { prescriptionPatientDialog.close(); });
      });
    }
    const prescriptionPage = document.body.dataset.prescriptionPage || '';
    const patientPage = document.body.dataset.patientPage || '';
    const ocrPage = document.body.dataset.ocrPage || '';
    const recId = prescriptionRouteRecId() || ocrRouteRecId() || window.REHAINFO_ACTIVE_REC_ID;
    const targetPatient = prescriptionPatient(recId);
    if (targetPatient && patientPage) {
      const patientValues = {
        patientId: `患者ID：${targetPatient.patientId}`, name: targetPatient.patientName, nameKana: targetPatient.patientNameKana,
        gender: targetPatient.gender, age: targetPatient.age, birth: targetPatient.birth,
        doctor: `主治医：${targetPatient.attendingPhysician || '担当医未設定'}`,
        disease: `${targetPatient.primaryDiagnosis || targetPatient.rehabilitationClass}：${(targetPatient.impairments || []).join('、') || '機能障害評価中'}`,
        treatmentTimes: `${targetPatient.treatmentTimes}回目`
      };
      Object.keys(patientValues).forEach(function (field) {
        document.querySelectorAll(`[data-patient-field="${field}"]`).forEach(function (element) { element.textContent = patientValues[field]; });
      });
    }
    if (patientPage === 'top' && targetPatient) {
      const soap = document.querySelector('[data-patient-action="soap"]');
      if (soap) soap.href = `/rehainfo/patient/${encodeURIComponent(recId)}/treatment-soap/soap-list`;
      const fim = targetPatient.fim || { total: 0, motor: 0, cognitive: 0, previousTotal: 0 };
      const startDate = new Date(String(targetPatient.startDate || '').replaceAll('/', '-'));
      const hospitalizationDays = targetPatient.entryExit === '入院' && !Number.isNaN(startDate.getTime())
        ? Math.max(1, Math.floor((Date.now() - startDate.getTime()) / 86400000) + 1) : 0;
      const fimGain = fim.total - fim.previousTotal;
      const text = {
        hospitalizationDays: targetPatient.entryExit === '入院' ? `在棟日数：${hospitalizationDays}日` : '外来リハビリ',
        totalScore: String(fim.total), exerciseScore: String(fim.motor), cognitiveScore: String(fim.cognitive),
        calculationFim: hospitalizationDays ? (fimGain / hospitalizationDays).toFixed(2) : '—',
        lastTotalScore: `前回：${fim.previousTotal}`, lastExerciseScore: `前回：${Math.max(0, fim.motor - fimGain)}`,
        lastCognitiveScore: `前回：${fim.cognitive}`, fimGain: `FIM利得：${fimGain}`
      };
      Object.keys(text).forEach(function (id) { const element = document.getElementById(id); if (element) element.textContent = text[id]; });
      const evaluationTable = document.getElementById('evaluationTable');
      if (evaluationTable) evaluationTable.insertAdjacentHTML('beforeend', '<tr><td>10m歩行</td><td>18.2秒</td></tr><tr><td>BBS</td><td>42点</td></tr><tr><td>握力（右）</td><td>18.5kg</td></tr>');
      const dashboardLists = {
        problemsList: (targetPatient.impairments || []).concat(targetPatient.risks || []),
        goalAndTargetList: [targetPatient.goal || '目標未設定'].concat(targetPatient.targetDischargeDate ? [`退院目標：${targetPatient.targetDischargeDate}`] : []),
        treatmentList: (targetPatient.professions || []).map(function (role) { return `${role}：${targetPatient.plannedUnitsPerDay || 0}単位/日`; })
      };
      Object.keys(dashboardLists).forEach(function (id) {
        const element = document.getElementById(id);
        if (element) { element.textContent = ''; dashboardLists[id].forEach(function (value) { const row = document.createElement('span'); row.className = 'text text-13 text-white d-block'; row.textContent = value; element.appendChild(row); }); }
      });
      document.querySelectorAll('.dashboard-loading-overlay').forEach(function (element) { element.classList.add('d-none'); });
      const dashboardButton = document.getElementById('dashboard');
      const calendarButton = document.getElementById('calendar');
      const dashboardContent = document.getElementById('dashboardContent');
      const calendarContent = document.getElementById('calendarContent');
      if (dashboardButton && calendarButton && dashboardContent && calendarContent) {
        dashboardButton.addEventListener('click', function () { dashboardContent.classList.remove('d-none'); calendarContent.classList.add('d-none'); dashboardButton.classList.add('active'); calendarButton.classList.remove('active'); });
        calendarButton.addEventListener('click', function () { dashboardContent.classList.add('d-none'); calendarContent.classList.remove('d-none'); calendarButton.classList.add('active'); dashboardButton.classList.remove('active'); });
      }
      const planTable = document.getElementById('plan_table');
      if (planTable) planTable.innerHTML = '<table class="table table-bordered bg-white"><thead><tr><th>日付</th><th>9:00</th><th>10:00</th><th>13:40</th></tr></thead><tbody><tr><td>9/10</td><td>歩行練習</td><td>自主訓練</td><td>評価</td></tr><tr><td>9/11</td><td>筋力訓練</td><td>病棟ADL</td><td>歩行練習</td></tr></tbody></table>';
      document.querySelectorAll('.button-square').forEach(function (element) {
        if (element === soap || element.dataset.bsTarget === '#aiPromptVerifyModal') return;
        element.removeAttribute('onclick');
        element.addEventListener('click', function (event) {
          event.preventDefault();
          const label = (element.querySelector('.btn-text') || {}).textContent?.trim() || '患者機能';
          if (element.id === 'treatmentImplementButton') {
            window.location.href = `/rehainfo/patient/${encodeURIComponent(recId)}/treatment-soap/soap-list`;
            return;
          }
          if (label === 'カメラ起動') {
            const input = document.createElement('input');
            input.type = 'file'; input.accept = 'image/*'; input.setAttribute('capture', 'environment');
            input.addEventListener('change', function () { if (input.files?.length) showPatientActionDialog('カメラ画像', ['架空データ用の画像を1件選択しました。', '画像はまだ外部へ送信されていません。']); });
            input.click();
            return;
          }
          const details = {
            '評価計画': ['FIM・BBS・10m歩行を今週評価', `次回評価日：${targetPatient.targetDischargeDate || '計画調整中'}`],
            '問題点': targetPatient.impairments.concat(targetPatient.risks),
            'ゴール・目標値': [targetPatient.goal, `1日計画：${targetPatient.plannedUnitsPerDay}単位`],
            '治療計画': targetPatient.professions.map(function (role) { return `${role}：週次計画を設定済み`; }),
            '治療記録': [`実施回数：${targetPatient.treatmentTimes}回`, `FIM合計：${targetPatient.fim.total}点`],
            'イベント': ['主治医診察：14:00', '病棟カンファレンス：16:00'],
            '代診表': ['本日の代診：なし', '担当療法士の勤務状況を確認済み']
          };
          showPatientActionDialog(label, details[label] || ['架空患者データで内容を表示しています。']);
        });
      });
    }
    if (patientPage === 'soap') {
      const pt = document.getElementById('btn-role-PhysicalTherapist');
      if (pt) pt.classList.add('active');
      const notice = document.createElement('p');
      notice.className = 'alert alert-warning py-2 mt-2 mb-0';
      notice.textContent = '公開版は架空データ専用です。入力したSOAPはこのブラウザ内にのみ保存されます。';
      const title = document.querySelector('.header-soap-list');
      if (title) title.insertAdjacentElement('afterend', notice);
    }
    if (ocrPage === 'read' && targetPatient) {
      const recIdInput = document.getElementById('patient-rec-id');
      const dateInput = document.getElementById('evaluation-date');
      const title = document.querySelector('[data-ocr-patient-title]');
      if (recIdInput) recIdInput.value = recId;
      if (dateInput && !dateInput.value) dateInput.value = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (title) title.textContent = `${targetPatient.patientName}さんの評価シートを選択`;
      const dropdown = document.getElementById('autocomplete-dropdown');
      const input = document.getElementById('evaluation-sheet-search');
      const sheets = [['FIM', 'FIM'], ['BBS', 'Berg Balance Scale'], ['SLTA', '標準失語症検査'], ['WAIS-IV', 'WAIS-IV'], ['WMS-R', 'WMS-R'], ['BIT', 'BIT行動性無視検査'], ['CAT-R', 'CAT-R'], ['STEF', 'STEF']];
      if (dropdown && input) {
        dropdown.textContent = '';
        sheets.forEach(function (sheet) {
          const item = document.createElement('div'); item.className = 'autocomplete-item'; item.dataset.id = sheet[0]; item.dataset.value = sheet[1]; item.textContent = sheet[1];
          item.addEventListener('click', function () { input.value = sheet[1]; input.dataset.sheetId = sheet[0]; dropdown.style.display = 'none'; });
          dropdown.appendChild(item);
        });
      }
      const emptyText = document.querySelector('.empty-state-text');
      if (emptyText) emptyText.innerHTML = '評価シートを選択し、架空の評価画像を選択またはカメラで撮影してください<br>画像は読取時のみ外部AIへ送信され、結果は必ず原本と照合してください';
    }
    if (ocrPage === 'list' && targetPatient) {
      const title = document.querySelector('[data-ocr-patient-title]');
      const table = document.getElementById('ocr-list-table');
      const body = document.getElementById('ocr-list-body');
      const empty = document.getElementById('ocr-list-empty');
      const records = readListStore(OCR_STORAGE_KEY).filter(function (item) { return item.recId === recId; }).slice(0, 10);
      if (title) title.textContent = `${targetPatient.patientName}さんのOCR一覧`;
      if (body) {
        body.textContent = '';
        records.forEach(function (item) {
          const row = document.createElement('tr');
          [item.evaluationId, item.status, item.evaluationDate].forEach(function (value) { const cell = document.createElement('td'); cell.textContent = value; row.appendChild(cell); });
          const actionCell = document.createElement('td'); const button = document.createElement('button'); button.type = 'button'; button.className = 'btn-action'; button.textContent = '集計・サマリ';
          button.addEventListener('click', function () { window.alert(item.summary); }); actionCell.appendChild(button); row.appendChild(actionCell); body.appendChild(row);
        });
      }
      if (table) table.hidden = records.length === 0;
      if (empty) empty.hidden = records.length > 0;
      const scan = document.querySelector('[data-ocr-scan-button]');
      if (scan) scan.addEventListener('click', function () { window.location.href = `/rehainfo/ocr/patient/${encodeURIComponent(recId)}/evaluation-select`; });
    }
    if (prescriptionPage === 'read' && targetPatient) {
      const recIdInput = document.getElementById('patient-rec-id');
      const dateInput = document.getElementById('evaluation-date');
      const title = document.querySelector('[data-prescription-patient-title]');
      const note = document.querySelector('.prescription-note');
      if (recIdInput) recIdInput.value = recId;
      if (dateInput && !dateInput.value) dateInput.value = new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' });
      if (title) title.textContent = `${targetPatient.patientName}さんの処方箋読込`;
      if (note) note.textContent = '公開版では架空の処方箋画像のみ使用してください。画像は読取時のみ外部AIへ送信され、結果は必ず原本と照合してください。';
    }
    if (prescriptionPage === 'list' && targetPatient) {
      const title = document.querySelector('[data-prescription-patient-title]');
      const readLink = document.querySelector('[data-prescription-read-link]');
      const table = document.getElementById('prescription-list-table');
      const body = document.getElementById('prescription-list-body');
      const empty = document.getElementById('prescription-list-empty');
      const warning = document.querySelector('.warning');
      const records = readPrescriptionStore().filter(function (item) { return item.recId === recId; }).slice(0, 10);
      const patientAddFlow = prescriptionPatientAddFlow();
      if (title) title.textContent = `${targetPatient.patientName}さんの保存済み処方箋`;
      if (readLink) readLink.href = `/rehainfo/prescriptions/patient/${encodeURIComponent(recId)}/read${prescriptionPatientAddQuery()}`;
      if (warning) warning.textContent = '公開版は架空データ専用です。電カル取得データとAI読取結果は参考情報のため、必ず原本と照合してください。';
      if (body) {
        body.textContent = '';
        const patientColumn = table ? table.querySelector('thead th:last-child') : null;
        if (patientColumn && patientColumn.textContent.includes('患者登録') && !patientAddFlow) patientColumn.remove();
        records.forEach(function (item) {
          const row = document.createElement('tr');
          const dateCell = document.createElement('td');
          const resultCell = document.createElement('td');
          const statusCell = document.createElement('td');
          const createdCell = document.createElement('td');
          const badge = document.createElement('span');
          dateCell.textContent = item.evaluationDate || '';
          resultCell.className = 'result';
          resultCell.textContent = item.summary || '';
          badge.className = 'status status-done';
          badge.textContent = '保存済み';
          statusCell.appendChild(badge);
          createdCell.textContent = new Date(item.createdAt).toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
          [dateCell, resultCell, statusCell, createdCell].forEach(function (cell) { row.appendChild(cell); });
          if (patientAddFlow) {
            const actionCell = document.createElement('td');
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'btn-patient-add';
            add.textContent = item.patientImport ? '登録済み患者を表示' : '患者として追加';
            add.addEventListener('click', function () {
              if (item.patientImport?.patientId) {
                window.location.href = item.patientImport.recId
                  ? `/rehainfo/patient/${encodeURIComponent(item.patientImport.recId)}/top`
                  : `/rehainfo/?patientId=${encodeURIComponent(item.patientImport.patientId)}`;
                return;
              }
              openPrescriptionPatientDialog(item);
            });
            actionCell.appendChild(add);
            row.appendChild(actionCell);
          }
          body.appendChild(row);
        });
      }
      if (table) table.hidden = records.length === 0;
      if (empty) empty.hidden = records.length > 0;
    }

    if (document.getElementById('patientListTable') || document.getElementById('table-div')) {
      const applyPatientFilters = function () {
        const kana = (document.getElementById('condition_patientName') || {}).value || '';
        const id = (document.getElementById('condition_patientId') || {}).value || '';
        const assignedOnly = Boolean((document.getElementById('radio_api') || {}).checked);
        const additionalField = (document.getElementById('select_additional') || {}).value || '';
        const additionalValue = (document.getElementById('patientListAdditionalSearchForm') || {}).value || '';
        const rows = patientListRows.filter(function (item) {
          return (!kana || item.patientNameKana.includes(kana)) && (!id || item.patientId.includes(id))
            && (!assignedOnly || item.assigned) && (!additionalField || !additionalValue || String(item[additionalField] || '').includes(additionalValue));
        });
        if (typeof window.patientListApplyFilteredRows === 'function') window.patientListApplyFilteredRows(rows);
      };
      window.onChangeInput = applyPatientFilters;
      ['condition_patientName', 'condition_patientId'].forEach(function (id) {
        const input = document.getElementById(id);
        if (input) input.addEventListener('input', applyPatientFilters);
      });
      const assigned = document.getElementById('radio_api');
      if (assigned) assigned.addEventListener('change', applyPatientFilters);
      const requestedPatientId = new URLSearchParams(location.search).get('patientId');
      const patientIdInput = document.getElementById('condition_patientId');
      if (requestedPatientId && patientIdInput) patientIdInput.value = requestedPatientId;
      applyPatientFilters();
      window.onPatientClick = function (_event, _groupId, selectedRecId) { window.location.href = `/rehainfo/patient/${encodeURIComponent(selectedRecId)}/top`; };
    }

    document.addEventListener('submit', function (event) {
      const form = event.target;
      if (form instanceof HTMLFormElement && form.id !== 'prescriptionPatientForm' && form.action && !form.action.endsWith('/rehainfo/login')) {
        event.preventDefault();
        window.alert('この公開版ではローカル実画面の表示確認のみ行えます。');
      }
    }, true);
  });
}());
