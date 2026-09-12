const fiction = { dataClassification: 'FICTIONAL_DEMO', version: 1 };

function at(day, hour, minute = 0) {
  return `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
}

function minutesAfter(value, minutes) {
  return new Date(Date.parse(value) + (minutes * 60 * 1000)).toISOString();
}

export const operationalCollectionMap = Object.freeze({
  'medication-reconciliations': 'medicationReconciliations',
  'medication-safety-alerts': 'medicationSafetyAlerts',
  'critical-result-alerts': 'criticalResultAlerts',
  'clinical-tasks': 'clinicalTasks',
  'nursing-risk-assessments': 'nursingRiskAssessments',
  'record-lifecycle': 'recordLifecycleCases',
  'claim-adjudications': 'claimAdjudications',
  'integration-endpoints': 'integrationEndpoints',
  'downtime-procedures': 'downtimeProcedures',
  'academic-programs': 'academicPrograms',
  'master-data-releases': 'masterDataReleases',
});

export const operationalTransitionPolicies = Object.freeze({
  'medication-reconciliations': {
    roles: ['physician', 'pharmacist', 'nurse', 'administrator'],
    transitions: { pending: ['reviewing'], reviewing: ['completed', 'clarification-needed'], 'clarification-needed': ['reviewing'], completed: [] },
    resourceType: 'MedicationReconciliation',
  },
  'medication-safety-alerts': {
    roles: ['physician', 'pharmacist', 'administrator'],
    transitions: { open: ['acknowledged', 'resolved'], acknowledged: ['resolved'], resolved: [] },
    resourceType: 'MedicationSafetyAlert',
  },
  'critical-result-alerts': {
    roles: ['physician', 'nurse', 'technician', 'administrator'],
    transitions: { open: ['acknowledged'], acknowledged: ['closed'], closed: [] },
    resourceType: 'CriticalResultAlert',
  },
  'clinical-tasks': {
    roles: ['physician', 'nurse', 'pharmacist', 'technician', 'therapist', 'dietitian', 'social-worker', 'administrator'],
    transitions: { pending: ['in-progress', 'completed', 'cancelled'], 'in-progress': ['completed', 'cancelled'], completed: [], cancelled: [] },
    resourceType: 'ClinicalTask',
  },
  'nursing-risk-assessments': {
    roles: ['nurse', 'physician', 'administrator'],
    transitions: { draft: ['signed'], signed: ['reviewed'], reviewed: [] },
    resourceType: 'NursingRiskAssessment',
  },
  'record-lifecycle': {
    roles: ['physician', 'administrator'],
    transitions: { requested: ['reviewed', 'rejected'], reviewed: ['cosigned', 'rejected'], cosigned: [], rejected: [] },
    resourceType: 'ClinicalRecordLifecycle',
  },
  'claim-adjudications': {
    roles: ['clerk', 'administrator'],
    transitions: { returned: ['correcting'], correcting: ['resubmitted'], resubmitted: ['accepted', 'returned'], accepted: [] },
    resourceType: 'ClaimAdjudication',
  },
  'downtime-procedures': {
    roles: ['administrator'],
    transitions: { scheduled: ['in-progress', 'completed'], 'in-progress': ['completed'], completed: [] },
    resourceType: 'DowntimeProcedure',
  },
  'master-data-releases': {
    roles: ['administrator'],
    transitions: { 'review-required': ['validated-for-demo'], 'validated-for-demo': ['activated-for-demo'], 'activated-for-demo': [] },
    resourceType: 'MasterDataRelease',
  },
});

export function createRealWorldOperationsSeed({ patients, hospital, medicationRequests, labOrders, records, advancedHospital }) {
  const pharmacists = hospital.staffMembers.filter((item) => item.role === 'pharmacist');
  const nurses = hospital.staffMembers.filter((item) => item.role === 'nurse');
  const physicians = hospital.staffMembers.filter((item) => item.role === 'physician');
  const technicians = hospital.staffMembers.filter((item) => item.role === 'technician');
  const clerk = hospital.staffMembers.find((item) => item.role === 'clerk');
  const administrator = hospital.staffMembers.find((item) => item.role === 'administrator');

  const medicationReconciliations = hospital.admissions.map((admission, index) => {
    const patient = patients.find((item) => item.id === admission.patientId);
    const medications = medicationRequests.filter((item) => item.patientId === patient.id).slice(0, 4);
    return {
      id: `MEDREC-${String(index + 1).padStart(3, '0')}`, patientId: patient.id, admissionId: admission.id,
      source: index % 3 === 0 ? '持参薬手帳・本人確認' : index % 3 === 1 ? '紹介状・本人確認' : '前医処方・家族確認',
      medicationRequestIds: medications.map((item) => item.id), discrepancies: index % 4 === 0 ? ['服用時点の相違（架空）'] : [],
      pharmacistId: pharmacists[index % pharmacists.length].id, physicianId: admission.attendingPhysicianId,
      status: index % 4 === 0 ? 'clarification-needed' : index % 3 === 0 ? 'reviewing' : 'completed',
      completedAt: index % 3 === 0 ? null : at(10, 11, index), ...fiction,
    };
  });

  const alertCategories = ['allergy', 'renal-dose', 'interaction', 'duplication', 'pregnancy', 'maximum-dose'];
  const medicationSafetyAlerts = medicationRequests.slice(0, 36).map((order, index) => {
    const patient = patients.find((item) => item.id === order.patientId);
    const category = alertCategories[index % alertCategories.length];
    const severities = ['critical', 'high', 'moderate'];
    const status = index % 5 === 0 ? 'open' : index % 3 === 0 ? 'acknowledged' : 'resolved';
    return {
      id: `MEDSAFE-${String(index + 1).padStart(3, '0')}`, patientId: patient.id, medicationRequestId: order.id,
      category, severity: severities[index % severities.length], medicationDisplay: order.medicationDisplay,
      evidence: category === 'renal-dose' ? `eGFR ${42 + (index % 18)} mL/min/1.73m2（架空）` : `${category}ルールに該当（架空）`,
      recommendation: category === 'allergy' ? 'アレルギー歴と代替薬を確認' : '処方医と薬剤師による確認が必要',
      knowledgeBase: 'FICTIONAL-DRUG-SAFETY-2026.09', pharmacistId: pharmacists[index % pharmacists.length].id,
      detectedAt: at(11, 8, index % 60), status, acknowledgedAt: status === 'open' ? null : at(11, 8, (index + 4) % 60),
      resolvedAt: status === 'resolved' ? at(11, 9, index % 60) : null, overrideReason: status === 'resolved' ? '臨床的妥当性を確認（架空）' : null,
      ...fiction,
    };
  });

  const abnormalLabs = labOrders.filter((item) => item.resultDetail && item.resultDetail.interpretation !== 'N');
  const criticalResultAlerts = abnormalLabs.slice(0, 24).map((order, index) => {
    const status = index % 4 === 0 ? 'open' : index % 3 === 0 ? 'acknowledged' : 'closed';
    return {
      id: `CRIT-${String(index + 1).padStart(3, '0')}`, patientId: order.patientId, labOrderId: order.id,
      analyte: order.resultDetail.analyte, value: order.resultDetail.value, unit: order.resultDetail.unit,
      severity: index % 5 === 0 ? 'critical' : 'high', detectedAt: order.resultDetail.verifiedAt,
      escalationDueAt: minutesAfter(order.resultDetail.verifiedAt, index % 5 === 0 ? 10 : 30),
      notifyingStaffId: technicians[index % technicians.length].id, responsiblePhysicianId: patients.find((item) => item.id === order.patientId).primaryPhysicianId,
      status, acknowledgedAt: status === 'open' ? null : minutesAfter(order.resultDetail.verifiedAt, 6),
      closedAt: status === 'closed' ? minutesAfter(order.resultDetail.verifiedAt, 18) : null,
      readBackConfirmed: status === 'closed', ...fiction,
    };
  });

  const taskBlueprints = [
    ['result-review', '検査結果確認', 'physician'], ['medication-reconciliation', '持参薬・処方突合', 'pharmacist'],
    ['nursing-observation', '看護観察と再評価', 'nurse'], ['discharge-planning', '退院支援調整', 'social-worker'],
    ['rehabilitation', 'リハビリ評価', 'therapist'],
  ];
  const clinicalTasks = patients.map((patient, index) => {
    const [category, title, role] = taskBlueprints[index % taskBlueprints.length];
    const staff = hospital.staffMembers.find((item) => item.role === role && item.active) || patient.primaryPhysicianId;
    const status = index % 7 === 0 ? 'pending' : index % 5 === 0 ? 'in-progress' : 'completed';
    return {
      id: `TASK-${String(index + 1).padStart(3, '0')}`, patientId: patient.id, category, title: `${title}（架空）`,
      priority: index % 11 === 0 ? 'stat' : index % 4 === 0 ? 'urgent' : 'routine', assignedRole: role,
      assignedStaffId: typeof staff === 'string' ? staff : staff.id, dueAt: at(11 + (index % 3), 9 + (index % 8), index % 60),
      status, escalationLevel: status === 'pending' && index % 11 === 0 ? 2 : 0, completedAt: status === 'completed' ? at(11, 10, index % 60) : null,
      ...fiction,
    };
  });

  const assessmentTypes = [
    { type: 'fall-risk', tool: 'Morse相当（架空）', threshold: 45 },
    { type: 'pressure-injury', tool: 'Braden相当（架空）', threshold: 12 },
    { type: 'delirium', tool: 'せん妄スクリーニング（架空）', threshold: 3 },
  ];
  const nursingRiskAssessments = hospital.admissions.flatMap((admission, admissionIndex) => assessmentTypes.map((blueprint, assessmentIndex) => {
    const score = blueprint.type === 'fall-risk' ? 30 + ((admissionIndex * 7) % 45)
      : blueprint.type === 'pressure-injury' ? 9 + (admissionIndex % 11) : admissionIndex % 6;
    const atRisk = blueprint.type === 'pressure-injury' ? score <= blueprint.threshold : score >= blueprint.threshold;
    return {
      id: `NRSK-${String(admissionIndex + 1).padStart(3, '0')}-${assessmentIndex + 1}`, patientId: admission.patientId,
      admissionId: admission.id, assessmentType: blueprint.type, instrument: blueprint.tool, score, atRisk,
      interventions: atRisk ? ['環境調整', '定時再評価', 'チーム共有'].map((item) => `${item}（架空）`) : ['標準観察（架空）'],
      assessorStaffId: hospital.patientAssignments.find((item) => item.admissionId === admission.id && item.shiftCode === 'day')?.staffId || nurses[0].id,
      assessedAt: at(11, 7 + assessmentIndex, admissionIndex), nextReviewAt: at(12, 7 + assessmentIndex, admissionIndex),
      status: assessmentIndex === 0 && admissionIndex % 5 === 0 ? 'draft' : assessmentIndex === 2 ? 'reviewed' : 'signed', ...fiction,
    };
  }));

  const signedRecords = records.filter((item) => item.status === 'signed');
  const recordLifecycleCases = signedRecords.filter((_, index) => index % 18 === 0).slice(0, 15).map((record, index) => {
    const reviewer = physicians.find((item) => item.department === record.department && item.id !== record.authorStaffId) || physicians[0];
    const status = ['requested', 'reviewed', 'cosigned'][index % 3];
    return {
      id: `RLC-${String(index + 1).padStart(3, '0')}`, patientId: record.patientId, recordId: record.id,
      lifecycleType: index % 2 === 0 ? 'amendment' : 'supervisor-cosign', reason: index % 2 === 0 ? '診療後判明事項の追記（架空）' : '研修医記録の上級医確認（架空）',
      originalVersion: record.version, requestedByStaffId: record.authorStaffId, reviewerStaffId: reviewer.id,
      requestedAt: at(11, 12, index), status, reviewedAt: status === 'requested' ? null : at(11, 13, index),
      cosignedAt: status === 'cosigned' ? at(11, 14, index) : null, ...fiction,
    };
  });

  const claimAdjudications = advancedHospital.claimSubmissions.map((claim, index) => {
    const status = index % 13 === 0 ? 'returned' : index % 9 === 0 ? 'resubmitted' : 'accepted';
    return {
      id: `ADJ-${String(index + 1).padStart(4, '0')}`, patientId: claim.patientId, claimId: claim.id,
      payer: '審査支払機関接続モック', status, responseCode: status === 'returned' ? 'DEMO-A1' : 'DEMO-ACCEPTED',
      reasons: status === 'returned' ? ['傷病名と診療行為の整合確認（架空）'] : [],
      correctionOwnerStaffId: clerk.id, submittedAt: at(11, 16, index % 60), respondedAt: at(12, 9, index % 60),
      correctedAt: null, ...fiction,
    };
  });

  const integrationBlueprints = [
    ['online-eligibility', 'オンライン資格確認', 'ONS・閉域網', '正規資格確認往復試験'],
    ['e-prescription', '電子処方箋管理サービス', 'ONS・HPKI', '正規送信・取消・調剤結果試験'],
    ['emr-sharing', '電子カルテ情報共有サービス', 'FHIR/JP-CLINS', '紹介状・6情報・健診・患者サマリー接続試験'],
    ['lis', '検体検査LIS', 'HL7 v2/FHIR', 'オーダ・採取・結果・取消・クリティカル値試験'],
    ['ris-pacs', 'RIS/PACS', 'HL7 v2/DICOM', 'MWL・画像・読影・訂正レポート試験'],
    ['pathology', '病理システム', 'HL7/FHIR', '検体追跡・診断・追加報告試験'],
    ['endoscopy', '内視鏡システム', 'HL7/DICOM', '予約・実施・画像・レポート試験'],
    ['pharmacy', '薬剤部・自動払出', 'HL7/FHIR/バーコード', '監査・払出・返却・棚卸試験'],
    ['devices', '医療機器・生体情報', 'IEEE 11073/ベンダIF', '時刻同期・患者照合・欠測・再送試験'],
    ['operating-room', '手術・麻酔システム', 'HL7/DICOM/ベンダIF', '予定・麻酔・機器・実施記録試験'],
    ['blood-bank', '輸血管理', 'HL7/バーコード', '交差適合・払出・実施・副反応試験'],
    ['dialysis', '透析装置・透析管理', 'ベンダIF', '処方・装置値・アラーム・実績試験'],
    ['claims', 'レセコン・オンライン請求', 'レセ電仕様', '算定・返戻・再請求・支払結果試験'],
    ['master-data', '標準マスター配信', 'MEDIS/JLAC/JJ1017', '差分取込・影響確認・ロールバック試験'],
  ];
  const integrationEndpoints = integrationBlueprints.map(([id, name, protocol, evidence], index) => ({
    id: `INT-${id.toUpperCase()}`, systemId: id, name, protocol, mode: 'mock-boundary-only', status: 'connection-test-required',
    interfaceDefinition: index % 3 === 0 ? 'draft' : 'documented', requiredExternalEvidence: evidence,
    lastSuccessfulConnectionAt: null, owner: ['医療情報部', '各部門責任者', '医事課'][index % 3], ...fiction,
  }));

  const downtimeBlueprints = [
    ['read-only', '停止時参照・患者サマリー配布', '全診療部門'], ['medication', '薬剤指示・実施の紙運用と復旧突合', '薬剤部・病棟'],
    ['orders', '検査・画像・処方オーダの代替運用', '外来・病棟'], ['critical-results', 'クリティカル値の電話連絡', '検査部'],
    ['recovery', '復旧後の二重入力防止と差分突合', '医療情報部'], ['cyber-bcp', 'ランサムウェア想定の隔離・縮退運用', '経営・医療情報部'],
    ['regional-disaster', '広域災害時の診療継続', '災害対策本部'], ['backup-restore', 'PITR・別障害ドメイン復元', '基盤運用'],
  ];
  const downtimeProcedures = downtimeBlueprints.map(([code, name, owner], index) => ({
    id: `BCP-${String(index + 1).padStart(2, '0')}`, code, name, owner, status: index < 2 ? 'completed' : index < 5 ? 'scheduled' : 'in-progress',
    lastExerciseAt: index < 2 ? '2026-09-01T13:00:00+09:00' : null, nextExerciseAt: `2026-${String(10 + (index % 3)).padStart(2, '0')}-15T13:00:00+09:00`,
    evidenceLevel: index < 2 ? 'local-tabletop-demo' : 'external-hospital-drill-required', recoveryReconciliationRequired: true,
    coordinatorStaffId: administrator.id, ...fiction,
  }));

  const academicPrograms = [
    ['clinical-trials', '治験・臨床試験', '被験者候補、同意、Visit、併用薬、有害事象、原資料確認'],
    ['transplant', '臓器移植', '候補評価、待機、ドナー、免疫抑制、長期フォロー'],
    ['genomics', 'ゲノム医療', '検体、解析同意、バリアント、エキスパートパネル'],
    ['cell-therapy', '細胞・遺伝子治療', '製造ロット、Chain of Identity、投与、長期追跡'],
    ['radiation-oncology', '放射線治療', '治療計画、照射、線量、QA、完遂判定'],
    ['cancer-board', 'がんゲノム・キャンサーボード', '症例提示、推奨、患者説明、治療選択'],
    ['resident-supervision', '研修医・専攻医指導', '指導医割当、共同署名、権限段階化'],
    ['registries', '疾患レジストリ', '症例抽出、品質確認、提出、訂正'],
    ['biobank', 'バイオバンク', '研究同意、検体、保管、払出、撤回'],
  ].map(([code, name, capabilities], index) => ({
    id: `ACA-${String(index + 1).padStart(2, '0')}`, code, name, capabilities: capabilities.split('、'), status: 'workflow-mock',
    linkedPatientIds: patients.filter((_, patientIndex) => patientIndex % (11 + index) === 0).slice(0, 5).map((item) => item.id),
    externalSystemsRequired: true, governanceApprovalRequired: true, ...fiction,
  }));

  const masterDataReleases = [
    ['disease', '標準病名・修飾語', 'MEDIS'], ['medication', 'HOT/YJ医薬品', 'MEDIS・薬価'],
    ['laboratory', 'JLAC10/LOINC', '関連標準団体'], ['radiology', 'JJ1017', 'JAHIS/JIRA'],
    ['procedures', '手術・処置', 'MEDIS・診療報酬'], ['claims', '診療行為・医薬品・器材・DPC', '審査支払機関'],
    ['drug-safety', '添付文書・安全性情報', 'PMDA'],
  ].map(([domain, name, authority], index) => ({
    id: `MREL-${String(index + 1).padStart(2, '0')}`, domain, name, authority, sourceVersion: '2026-09 fictional snapshot',
    status: index < 2 ? 'validated-for-demo' : 'review-required', effectiveOn: `2026-09-${String(index + 1).padStart(2, '0')}`,
    impactCount: 4 + index * 3, rollbackPackagePrepared: true, licenseReviewRequired: true, ...fiction,
  }));

  return {
    medicationReconciliations, medicationSafetyAlerts, criticalResultAlerts, clinicalTasks, nursingRiskAssessments,
    recordLifecycleCases, claimAdjudications, integrationEndpoints, downtimeProcedures, academicPrograms, masterDataReleases,
  };
}
