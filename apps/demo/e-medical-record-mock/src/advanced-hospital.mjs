const fiction = { dataClassification: 'FICTIONAL_DEMO', version: 1 };

const labProfiles = [
  { match: /血液|CBC|白血球/, analyte: '白血球数', value: 6.2, unit: '10^3/uL', low: 3.3, high: 8.6, codeSystem: 'JLAC10/LOINC（架空対応）' },
  { match: /CRP|炎症/, analyte: 'CRP', value: 0.12, unit: 'mg/dL', low: 0, high: 0.14, codeSystem: 'JLAC10/LOINC（架空対応）' },
  { match: /HbA1c|糖尿/, analyte: 'HbA1c', value: 6.8, unit: '%', low: 4.6, high: 6.2, codeSystem: 'JLAC10/LOINC（架空対応）' },
  { match: /BNP|心不全/, analyte: 'BNP', value: 85, unit: 'pg/mL', low: 0, high: 18.4, codeSystem: 'JLAC10/LOINC（架空対応）' },
  { match: /腎|クレアチニン/, analyte: 'クレアチニン', value: 0.83, unit: 'mg/dL', low: 0.46, high: 0.79, codeSystem: 'JLAC10/LOINC（架空対応）' },
  { match: /.*/, analyte: '検査結果', value: 72, unit: 'U/L', low: 30, high: 100, codeSystem: 'JLAC10/LOINC（架空対応）' }
];

function at(day, hour, minute = 0) {
  return `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+09:00`;
}

function minutesAfter(value, minutes) {
  return new Date(Date.parse(value) + (minutes * 60 * 1000)).toISOString();
}

function administrationHours(dosageText) {
  if (/疼痛時|必要時|頓用/.test(dosageText)) return [];
  const frequency = Number(dosageText.match(/1日(\d+)回/)?.[1] || 1);
  if (frequency >= 3) return [8, 12, 18];
  if (frequency === 2) return [9, 18];
  return [/夕|就寝/.test(dosageText) ? 18 : 9];
}

function localDateAt(timestamp, hour) {
  const localDate = new Date(timestamp + (9 * 60 * 60 * 1000)).toISOString().slice(0, 10);
  return `${localDate}T${String(hour).padStart(2, '0')}:00:00+09:00`;
}

export function createAdvancedHospitalSeed({ patients, hospital, labOrders, imagingOrders, medicationRequests, billingCharges }) {
  const patient = (id) => patients.find((item) => item.id === id);
  const admission = (id) => hospital.admissions.find((item) => item.patientId === id);
  const staffByRole = (role) => hospital.staffMembers.filter((item) => item.role === role);
  const physicians = staffByRole('physician'); const nurses = staffByRole('nurse'); const pharmacists = staffByRole('pharmacist');
  const radiologist = physicians.find((item) => item.department === '放射線部');
  const pathologist = physicians.find((item) => item.department === '病理診断部');
  const anesthesiologist = physicians.find((item) => item.department === '麻酔科');
  const admittedPatientIds = new Set(hospital.admissions.map((item) => item.patientId));
  const clinicalAsOf = Date.parse('2026-09-11T09:00:00+09:00');

  labOrders.forEach((order, index) => {
    const profile = labProfiles.find((item) => item.match.test(`${order.code} ${order.name}`));
    const adjustment = ((index % 5) - 2) * (profile.value * 0.04);
    const value = Number((profile.value + adjustment).toFixed(profile.value < 10 ? 2 : 1));
    order.resultDetail = order.status === 'completed' ? {
      analyte: profile.analyte, value, unit: profile.unit, referenceRange: { low: profile.low, high: profile.high, text: `${profile.low}–${profile.high} ${profile.unit}` },
      interpretation: value < profile.low ? 'L' : value > profile.high ? 'H' : 'N', codeSystem: profile.codeSystem,
      measuredAt: order.requestedAt, verifiedBy: '高橋 臨床検査技師', verifiedAt: at(11, 10, index % 60)
    } : null;
  });

  imagingOrders.forEach((order) => {
    if (order.status === 'reported') return;
    order.status = 'reported';
    order.report = '明らかな急性異常所見なし（架空読影結果）';
    order.reportedAt = minutesAfter(order.requestedAt, 180);
  });
  const imagingReports = imagingOrders.map((order, index) => ({
    id: `IMGRPT-${String(index + 1).padStart(3, '0')}`, imagingOrderId: order.id, patientId: order.patientId,
    modality: /CT/.test(order.type) ? 'CT' : /MRI/.test(order.type) ? 'MR' : 'CR', bodySite: order.title || order.type,
    accessionNumber: `ACC-DEMO-${String(index + 1).padStart(6, '0')}`, studyInstanceUid: `1.2.392.200036.9116.2.999.${index + 1}`,
    status: 'final', findings: index % 6 === 0 ? '軽度の慢性変化を認める（架空）' : '明らかな急性異常所見を認めない（架空）',
    impression: index % 6 === 0 ? '経過観察を推奨（架空）' : '臨床的に有意な異常なし（架空）',
    radiologistId: radiologist.id, radiologistName: radiologist.name,
    reportedAt: order.reportedAt, pacsStatus: 'stored-mock', ...fiction
  }));

  const pharmacyReviews = medicationRequests.map((order, index) => {
    const clarificationNeeded = order.erxStatus === 'submitted' && !admittedPatientIds.has(order.patientId);
    return {
      id: `PHREV-${String(index + 1).padStart(4, '0')}`, medicationRequestId: order.id, patientId: order.patientId,
      pharmacistId: pharmacists[index % pharmacists.length].id, pharmacistName: pharmacists[index % pharmacists.length].name,
      checks: {
        allergy: 'passed', duplication: index % 17 === 0 ? 'warning-reviewed' : 'passed', interaction: 'passed',
        dose: clarificationNeeded ? 'clarification-needed' : 'passed', renalFunction: 'reviewed'
      },
      status: clarificationNeeded ? 'clarification-needed' : 'verified',
      note: clarificationNeeded ? '用量を処方医へ照会中（架空）' : '処方監査済み（架空）',
      reviewedAt: minutesAfter(order.authoredOn, 5), ...fiction
    };
  });

  const medicationAdministrations = hospital.admissions.flatMap((item, index) => {
    const meds = medicationRequests.filter((order) => order.patientId === item.patientId
      && pharmacyReviews.find((review) => review.medicationRequestId === order.id)?.status === 'verified');
    const assigned = hospital.patientAssignments.find((assignment) => assignment.admissionId === item.id && assignment.shiftCode === 'day');
    const bed = hospital.beds.find((candidate) => candidate.id === item.bedId);
    const scheduledAdministrations = meds.flatMap((med) => {
      const orderStart = Date.parse(med.authoredOn);
      const orderEnd = orderStart + (med.days * 24 * 60 * 60 * 1000);
      const administrationDay = med.status === 'active' ? clinicalAsOf : Math.max(orderStart, Date.parse(bed.admittedAt));
      if (administrationDay > orderEnd) return [];
      return administrationHours(med.dosageText).map((hour) => {
      const scheduledAt = localDateAt(administrationDay, hour);
      const status = Date.parse(scheduledAt) <= clinicalAsOf ? 'completed' : 'scheduled';
      return {
        patientId: item.patientId, admissionId: item.id, medicationRequestId: med.id,
        medicationDisplay: med.medicationDisplay, scheduledAt, route: med.route, dose: med.dosageText,
        performerStaffId: assigned.staffId, performerName: assigned.staffName, status,
        barcodeVerification: status === 'completed' ? { patient: true, medication: true, staff: true, verifiedAt: minutesAfter(scheduledAt, 2) } : null,
        omissionReason: null, administeredAt: status === 'completed' ? minutesAfter(scheduledAt, 5) : null, ...fiction
      };
    });
    });
    return scheduledAdministrations.map((administration, scheduleIndex) => ({
      id: `MAR-${String(index + 1).padStart(3, '0')}-${scheduleIndex + 1}`,
      ...administration
    }));
  });

  const surgicalBlueprints = [
    { admissionId: 'ADM-001', procedureName: '腎動脈造影検査（架空）', surgeonDepartment: '循環器内科', diagnosis: '高血圧症', day: 12 },
    { admissionId: 'ADM-002', procedureName: '人工膝関節置換術（架空）', surgeonDepartment: '整形外科', diagnosis: '変形性膝関節症', day: 13 },
    { admissionId: 'ADM-007', procedureName: '右心カテーテル検査（架空）', surgeonDepartment: '循環器内科', diagnosis: '慢性心不全', day: 14 },
    { admissionId: 'ADM-014', procedureName: '脳血管造影検査（架空）', surgeonDepartment: '脳神経外科', diagnosis: '脳梗塞後遺症', day: 15 },
    { admissionId: 'ADM-015', procedureName: '腹腔鏡下噴門形成術（架空）', surgeonDepartment: '消化器内科', diagnosis: '逆流性食道炎', day: 16 }
  ];
  const surgicalCases = surgicalBlueprints.map((blueprint, index) => {
    const item = hospital.admissions.find((admissionItem) => admissionItem.id === blueprint.admissionId);
    const p = patient(item.patientId);
    const surgeon = physicians.find((physician) => physician.department === blueprint.surgeonDepartment && physician.active);
    return {
      id: `SURGCASE-${String(index + 1).padStart(3, '0')}`, patientId: item.patientId, admissionId: item.id,
      procedureCode: `DEMO-K-${String(6000 + index)}`, procedureName: blueprint.procedureName,
      operatingRoom: `手術室${(index % 3) + 1}`, scheduledStart: at(blueprint.day, 9), scheduledEnd: at(blueprint.day, 12),
      surgeonId: surgeon.id, surgeonName: surgeon.name, anesthesiologistId: anesthesiologist.id, anesthesiologistName: anesthesiologist.name,
      consentId: hospital.patientConsents.find((consent) => consent.patientId === p.id && consent.purposeCode === 'clinicalCare')?.id,
      checklist: { patientIdentity: true, procedureSite: true, consent: true, antibiotics: index % 2 === 0, implant: index % 3 === 1 },
      status: 'scheduled', operativeDiagnosis: `${blueprint.diagnosis}（架空）`, surgeonDepartment: blueprint.surgeonDepartment, ...fiction
    };
  });

  const anesthesiaRecords = surgicalCases.map((item, index) => ({
    id: `ANES-${String(index + 1).padStart(3, '0')}`, surgicalCaseId: item.id, patientId: item.patientId,
    asaClass: `ASA-PS ${1 + (index % 3)}`, method: index % 2 ? '全身麻酔＋区域麻酔' : '全身麻酔', airway: '気管挿管（架空）',
    anesthesiologistId: item.anesthesiologistId, preAssessment: '麻酔リスクと絶飲食を確認（架空）', intraoperativeEvents: [],
    recoveryStatus: item.status === 'in-progress' ? '術中' : '未開始', ...fiction
  }));

  const transfusionOrders = hospital.admissions.filter((_, index) => index % 4 === 0).map((item, index) => ({
    id: `TRANS-${String(index + 1).padStart(3, '0')}`, patientId: item.patientId, admissionId: item.id, product: index % 2 ? '濃厚血小板' : '赤血球液-LR',
    bloodType: patient(item.patientId).bloodType, units: 2, indication: '周術期貧血・出血対応（架空）', crossmatch: 'compatible', irradiated: true,
    status: index === 0 ? 'issued' : 'ordered', orderedBy: item.attendingPhysician, issuedAt: index === 0 ? at(11, 11, 20) : null, ...fiction
  }));

  const pathologySpecimens = patients.filter((_, index) => index % 9 === 0).map((p, index) => ({
    id: `PATH-${String(index + 1).padStart(3, '0')}`, patientId: p.id, accessionNumber: `P-DEMO-26-${String(index + 1).padStart(5, '0')}`,
    specimenType: index % 2 ? '生検組織' : '手術材料', bodySite: p.department, collectedAt: at(9 + (index % 3), 10), receivedAt: at(9 + (index % 3), 11),
    status: index % 3 === 0 ? 'reported' : 'processing', diagnosis: index % 3 === 0 ? '悪性所見を認めない（架空）' : null,
    pathologistId: pathologist.id, pathologist: pathologist.name, blockCount: 1 + (index % 4), ...fiction
  }));

  const microbiologyResults = patients.filter((_, index) => index % 10 === 0).map((p, index) => ({
    id: `MICRO-${String(index + 1).padStart(3, '0')}`, patientId: p.id, specimen: index % 2 ? '喀痰' : '尿', collectedAt: at(9, 8, index),
    organism: index % 4 === 0 ? 'Escherichia coli（架空）' : '有意菌なし', colonyCount: index % 4 === 0 ? '10^5 CFU/mL' : null,
    susceptibility: index % 4 === 0 ? [{ agent: 'CEZ', interpretation: 'S' }, { agent: 'LVFX', interpretation: 'R' }] : [],
    status: 'final', infectionControlNotified: index % 4 === 0, ...fiction
  }));

  const dialysisSessions = patients.filter((p, index) => p.department === '循環器内科' && index % 2 === 0).slice(0, 6).map((p, index) => ({
    id: `DIAL-${String(index + 1).padStart(3, '0')}`, patientId: p.id, station: `透析${index + 1}`, scheduledAt: at(11 + (index % 2), 8),
    prescription: { durationMinutes: 240, bloodFlowMlMin: 200, dialysateFlowMlMin: 500, anticoagulant: 'ヘパリン（架空）' },
    preWeightKg: p.weightKg, targetWeightKg: Number((p.weightKg - 1.5).toFixed(1)), preBloodPressure: '148/82', postBloodPressure: null,
    status: index === 0 ? 'in-progress' : 'scheduled', machineIntegration: 'mock', ...fiction
  }));

  const chemotherapyRegimens = patients.filter((p, index) => p.department === '消化器内科' && index % 2 === 0).slice(0, 6).map((p, index) => ({
    id: `CHEMO-${String(index + 1).padStart(3, '0')}`, patientId: p.id, regimenCode: `REG-DEMO-${index + 1}`, regimenName: ['mFOLFOX6相当', 'CapeOX相当'][index % 2] + '（架空）',
    cycle: 1 + (index % 4), day: 1, bodySurfaceArea: Number((1.55 + index * 0.03).toFixed(2)), doseAdjustments: index % 3 === 0 ? ['腎機能により80%投与（架空）'] : [],
    pharmacistVerified: true, consentConfirmed: true, scheduledAt: at(12 + index, 10), status: index === 0 ? 'ready' : 'planned', ...fiction
  }));

  const icuFlowsheets = hospital.admissions.filter((_, index) => index % 5 === 0).map((item, index) => ({
    id: `ICU-${String(index + 1).padStart(3, '0')}`, patientId: item.patientId, admissionId: item.id, bed: `ICU-${index + 1}`,
    startedAt: at(10, 15), status: index === 0 ? 'active' : 'completed', deviceData: { heartRate: 74 + index, spo2: 97, invasiveBloodPressure: '122/68', ventilatorMode: index === 0 ? 'CPAP' : 'none' },
    consciousness: 'GCS E4V5M6', fluidBalanceMl: 120 - (index * 30), vasopressor: 'なし', recordedBy: nurses[30 + (index % 2)].name, ...fiction
  }));

  const infectionControlCases = patients.filter((p, index) => p.infectionPrecautions !== '標準予防策' || index % 19 === 0).map((p, index) => ({
    id: `ICT-${String(index + 1).padStart(3, '0')}`, patientId: p.id, organismOrRisk: index % 2 ? '接触予防策対象（架空）' : '発熱・感染症評価（架空）',
    precautions: p.infectionPrecautions, onsetAt: at(10, 7, index), status: index % 3 === 0 ? 'monitoring' : 'resolved', isolationRoom: admission(p.id)?.ward || '外来隔離室', reportedToPublicHealth: false, ...fiction
  }));

  const dpcEpisodes = hospital.admissions.map((item, index) => ({
    id: `DPC-${String(index + 1).padStart(3, '0')}`, patientId: item.patientId, admissionId: item.id, dpcCode: `DEMO-${String(100000 + index)}`,
    principalDiagnosis: patient(item.patientId).department + '主病（架空）', admissionRoute: item.admissionType, severity: index % 3,
    estimatedLengthOfStay: 10 + (index % 8), coefficient: Number((1.0000 + index * 0.002).toFixed(4)), status: 'coding', coder: '田中 医事', ...fiction
  }));

  const claimSubmissions = billingCharges.map((charge, index) => ({
    id: `CLAIM-${String(index + 1).padStart(4, '0')}`, patientId: charge.patientId, encounterId: charge.encounterId, billingChargeId: charge.id,
    claimMonth: charge.queuedAt.slice(0, 7), payerType: '医療保険（架空）', totalPoints: charge.totalPoints,
    validation: charge.status === 'queued' ? ['会計計算の完了待ち（架空）'] : index % 14 === 0 ? ['傷病名整合性を確認（架空）'] : [],
    status: charge.status === 'queued' || index % 14 === 0 ? 'review-required' : 'ready', submittedAt: null, response: null, ...fiction
  }));

  const dischargePlans = hospital.admissions.map((item, index) => ({
    id: `DISPLAN-${String(index + 1).padStart(3, '0')}`, patientId: item.patientId, admissionId: item.id, targetDischargeAt: item.plannedDischargeAt,
    destination: ['自宅', '回復期病院', '介護施設'][index % 3], barriers: index % 3 === 0 ? ['家族指導', '住宅環境調整'] : ['服薬自己管理'],
    requiredServices: ['退院時共同指導', ...(index % 2 ? ['訪問看護'] : ['外来フォロー'])], coordinator: '三浦 医療ソーシャルワーカー',
    status: index % 4 === 0 ? 'assessment' : 'planning', lastConferenceId: hospital.teamConferences.find((conference) => conference.admissionId === item.id)?.id, ...fiction
  }));

  const clinicalMasters = [
    ...Array.from({ length: 12 }, (_, index) => ({ id: `MST-MED-X-${index + 1}`, category: '医薬品', code: `DEMO-YJ-${String(index + 1).padStart(5, '0')}`, display: `院内採用薬${index + 1}（架空）`, active: true, version: 1 })),
    ...Array.from({ length: 8 }, (_, index) => ({ id: `MST-LAB-X-${index + 1}`, category: '検査', code: `DEMO-JLAC-${String(index + 1).padStart(4, '0')}`, display: `院内検査${index + 1}（架空）`, active: true, version: 1 })),
    ...Array.from({ length: 8 }, (_, index) => ({ id: `MST-FEE-X-${index + 1}`, category: '医事', code: `DEMO-FEE-${String(index + 1).padStart(4, '0')}`, display: `診療行為${index + 1}（架空）`, active: true, version: 1 })),
    ...Array.from({ length: 6 }, (_, index) => ({ id: `MST-PROC-X-${index + 1}`, category: '手術・処置', code: `DEMO-K-${String(index + 1).padStart(4, '0')}`, display: `手術処置${index + 1}（架空）`, active: true, version: 1 }))
  ];
  const inventoryLots = Array.from({ length: 18 }, (_, index) => ({
    id: `INV-X-${String(index + 1).padStart(3, '0')}`, name: ['輸液セット', '検体容器', '手術用ガウン', '注射針', 'カテーテル', '個人防護具'][index % 6] + ` ${index + 1}（架空）`,
    location: ['一般病棟3A', '一般病棟4B', '回復期病棟5A', '中央材料室', '手術部', '検査部'][index % 6], stock: 12 + index * 3,
    reorderPoint: 15, lot: `LOT-DEMO-X-${String(index + 1).padStart(3, '0')}`, expiresOn: `2027-${String((index % 9) + 1).padStart(2, '0')}-28`, version: 1
  }));

  return {
    imagingReports, pharmacyReviews, medicationAdministrations, surgicalCases, anesthesiaRecords, transfusionOrders,
    pathologySpecimens, microbiologyResults, dialysisSessions, chemotherapyRegimens, icuFlowsheets, infectionControlCases,
    dpcEpisodes, claimSubmissions, dischargePlans, clinicalMasters, inventoryLots
  };
}
