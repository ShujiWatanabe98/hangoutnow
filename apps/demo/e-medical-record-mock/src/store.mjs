import { randomUUID } from 'node:crypto';

const now = '2026-09-11T09:00:00+09:00';

const seedPatients = [
  {
    id: 'P0001001', name: '青空 花子', kana: 'アオゾラ ハナコ', birthDate: '1958-04-12', gender: 'female',
    bloodType: 'A+', phone: '090-0000-1001', postalCode: '100-0001', address: '東京都千代田区架空1-2-3',
    insurance: { insurerNumber: '06139999', symbol: '架空', number: '1001', branchNumber: '01', status: '有効', copayRate: 30, verifiedAt: now },
    allergies: ['ペニシリン'], alerts: ['転倒リスク'], department: '内科', nextAppointment: '2026-09-18 10:30',
    lastVisit: '2026-08-28', status: '受付済', room: '診察室1'
  },
  {
    id: 'P0001002', name: '緑川 健太', kana: 'ミドリカワ ケンタ', birthDate: '1976-11-03', gender: 'male',
    bloodType: 'O+', phone: '090-0000-1002', postalCode: '150-0001', address: '東京都渋谷区架空4-5-6',
    insurance: { insurerNumber: '06139998', symbol: '架空', number: '1002', branchNumber: '02', status: '有効', copayRate: 30, verifiedAt: now },
    allergies: [], alerts: [], department: '整形外科', nextAppointment: '2026-09-11 11:00',
    lastVisit: '2026-09-01', status: '診察待ち', room: '待合'
  },
  {
    id: 'P0001003', name: '桜井 そら', kana: 'サクライ ソラ', birthDate: '1991-02-20', gender: 'female',
    bloodType: 'B+', phone: '090-0000-1003', postalCode: '220-0001', address: '神奈川県横浜市架空7-8-9',
    insurance: { insurerNumber: '06139997', symbol: '架空', number: '1003', branchNumber: '00', status: '確認待ち', copayRate: 30, verifiedAt: null },
    allergies: ['ヨード造影剤'], alerts: ['妊娠可能性を確認'], department: '内科', nextAppointment: '2026-09-11 13:30',
    lastVisit: '2026-07-14', status: '予約', room: '—'
  },
  {
    id: 'P0001004', name: '白波 一郎', kana: 'シラナミ イチロウ', birthDate: '1947-09-08', gender: 'male',
    bloodType: 'AB+', phone: '090-0000-1004', postalCode: '330-0001', address: '埼玉県さいたま市架空10-11',
    insurance: { insurerNumber: '06139996', symbol: '架空', number: '1004', branchNumber: '01', status: '有効', copayRate: 20, verifiedAt: now },
    allergies: [], alerts: ['抗凝固薬服用'], department: '循環器内科', nextAppointment: '2026-09-25 09:00',
    lastVisit: '2026-08-30', status: '会計待ち', room: '会計'
  }
];

const smartRehabPatients = [
  ['DEMO260901', '佐藤 和子', 'サトウ カズコ', '1948-04-12', 'female', '回復期リハビリテーション科'],
  ['DEMO260902', '鈴木 正一', 'スズキ ショウイチ', '1951-09-03', 'male', '脳神経外科'],
  ['DEMO260903', '高橋 幸子', 'タカハシ サチコ', '1955-01-28', 'female', '整形外科'],
  ['DEMO260904', '田中 博', 'タナカ ヒロシ', '1958-06-17', 'male', '神経内科'],
  ['DEMO260905', '伊藤 洋子', 'イトウ ヨウコ', '1962-11-09', 'female', '回復期リハビリテーション科'],
  ['DEMO260906', '渡辺 清', 'ワタナベ キヨシ', '1966-03-21', 'male', '循環器内科'],
  ['DEMO260907', '山本 恵子', 'ヤマモト ケイコ', '1970-08-14', 'female', '呼吸器内科'],
  ['DEMO260908', '中村 隆', 'ナカムラ タカシ', '1974-12-05', 'male', '回復期リハビリテーション科'],
  ['DEMO260909', '小林 久美子', 'コバヤシ クミコ', '1979-05-26', 'female', '整形外科'],
  ['DEMO260910', '加藤 一郎', 'カトウ イチロウ', '1983-10-18', 'male', '回復期リハビリテーション科']
].map(([smartRehabId, name, kana, birthDate, gender, department], index) => ({
  id: `SR-${smartRehabId}`, smartRehabId, name, kana, birthDate, gender,
  bloodType: '未確認', phone: `090-0000-26${String(index + 1).padStart(2, '0')}`,
  postalCode: '100-0001', address: `東京都架空区スマリハ${index + 1}番地`,
  insurance: { insurerNumber: '06139000', symbol: '架空', number: smartRehabId, branchNumber: '00', status: '有効', copayRate: 30, verifiedAt: now },
  allergies: [], alerts: ['スマリハ連携確認用の架空患者'], department,
  nextAppointment: '2026-09-18 10:00', lastVisit: '2026-09-10', status: '連携対象', room: 'リハビリ室'
}));

const seedRecords = [
  {
    id: 'REC-20260828-001', patientId: 'P0001001', encounterId: 'ENC-20260828-001', occurredAt: '2026-08-28T10:15:00+09:00',
    department: '内科', author: '佐藤 医師', status: 'signed', version: 2,
    soap: {
      subjective: '2週間前から朝の咳が続く。発熱なし。',
      objective: '体温36.6℃、SpO2 98%、呼吸音清。',
      assessment: '急性上気道炎後の遷延性咳嗽を疑う。',
      plan: '去痰薬を7日分処方。悪化時は再診。'
    },
    signedAt: '2026-08-28T10:30:00+09:00'
  },
  {
    id: 'REC-20260718-001', patientId: 'P0001001', encounterId: 'ENC-20260718-001', occurredAt: '2026-07-18T09:40:00+09:00',
    department: '内科', author: '佐藤 医師', status: 'signed', version: 1,
    soap: {
      subjective: '定期受診。体調変化なし。', objective: '血圧128/76 mmHg。',
      assessment: '高血圧症、コントロール良好。', plan: '現行処方を継続。'
    }, signedAt: '2026-07-18T09:52:00+09:00'
  }
];

const seedMedicationRequests = [
  {
    id: 'MEDREQ-20260828-001', patientId: 'P0001001', recordId: 'REC-20260828-001', status: 'active', intent: 'order',
    authoredOn: '2026-08-28T10:22:00+09:00', requester: '佐藤 医師', medicationCode: '103831601',
    medicationDisplay: 'カルボシステイン錠250mg（架空処方）', dosageText: '1回2錠 1日3回 毎食後', days: 7, quantity: 42,
    unit: '錠', route: '経口', prescriptionId: 'RX-20260828-0001', erxStatus: 'dispensed'
  }
];

const smartRehabMedicationRequests = [
  ['DEMO260901', '106020001', 'アセトアミノフェン錠200mg（架空処方）', '1回1錠 疼痛時', 10, '錠', '2026-09-01T09:15:00+09:00', '佐々木 医師'],
  ['DEMO260902', '112400101', 'アムロジピン錠5mg（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '2026-09-02T10:10:00+09:00', '佐々木 医師'],
  ['DEMO260903', '114100201', 'ロキソプロフェン錠60mg（架空処方）', '1回1錠 1日3回 毎食後', 21, '錠', '2026-09-03T11:20:00+09:00', '松本 医師'],
  ['DEMO260904', '103831601', 'カルボシステイン錠250mg（架空処方）', '1回2錠 1日3回 毎食後', 42, '錠', '2026-09-04T13:30:00+09:00', '高木 医師'],
  ['DEMO260905', '122900301', 'エソメプラゾールカプセル20mg（架空処方）', '1回1カプセル 1日1回 朝食後', 14, 'カプセル', '2026-09-05T14:05:00+09:00', '松本 医師'],
  ['DEMO260906', '333200101', 'アスピリン錠100mg（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '2026-09-06T09:40:00+09:00', '加納 医師'],
  ['DEMO260907', '225100101', '吸入薬A（架空処方）', '1回1吸入 1日2回', 14, '回分', '2026-09-07T10:25:00+09:00', '高木 医師'],
  ['DEMO260908', '117902501', 'プレガバリンカプセル25mg（架空処方）', '1回1カプセル 1日2回 朝夕食後', 28, 'カプセル', '2026-09-08T15:10:00+09:00', '佐々木 医師'],
  ['DEMO260909', '114903001', 'セレコキシブ錠100mg（架空処方）', '1回1錠 1日2回 朝夕食後', 28, '錠', '2026-09-09T11:45:00+09:00', '松本 医師'],
  ['DEMO260910', '399902501', 'ビタミンD錠（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '2026-09-10T16:00:00+09:00', '加納 医師']
].map(([smartRehabId, medicationCode, medicationDisplay, dosageText, quantity, unit, authoredOn, requester]) => ({
  id: `MEDREQ-SR-${smartRehabId}`, patientId: `SR-${smartRehabId}`,
  recordId: `REC-SR-${smartRehabId}`, status: 'active', intent: 'order', authoredOn,
  requester, medicationCode, medicationDisplay, dosageText, days: 14, quantity, unit,
  route: medicationDisplay.includes('吸入') ? '吸入' : '経口', erxStatus: 'draft'
}));

const seedLabOrders = [
  { id: 'LAB-20260828-001', patientId: 'P0001001', recordId: 'REC-20260828-001', code: 'CBC', name: '末梢血液一般', priority: 'routine', status: 'completed', requestedAt: '2026-08-28T10:20:00+09:00', specimen: '静脈血', result: '基準範囲内' }
];

const seedDocuments = [
  { id: 'DOC-20260828-001', patientId: 'P0001001', type: '紹介状', title: '地域医療センターからの診療情報提供書', authoredAt: '2026-08-20T13:00:00+09:00', author: '地域医療センター', status: 'final', source: 'FHIR受信' }
];

const seedDispenses = [
  { id: 'DISP-20260829-001', prescriptionId: 'RX-20260828-0001', patientId: 'P0001001', pharmacy: '架空みらい薬局', dispensedAt: '2026-08-29T11:05:00+09:00', status: 'completed', note: '処方どおり調剤' }
];

export function createStore() {
  return {
    patients: structuredClone(seedPatients.concat(smartRehabPatients)), records: structuredClone(seedRecords),
    medicationRequests: structuredClone(seedMedicationRequests.concat(smartRehabMedicationRequests)), labOrders: structuredClone(seedLabOrders),
    injectionOrders: [], imagingOrders: [], documents: structuredClone(seedDocuments), summaries: [],
    dispenses: structuredClone(seedDispenses), billingCharges: [], prescriptions: [
      { id: 'RX-20260828-0001', patientId: 'P0001001', medicationRequestIds: ['MEDREQ-20260828-001'], status: 'dispensed', sentAt: '2026-08-28T10:31:00+09:00', receiptId: 'RCPT-20260828-1001' }
    ],
    eligibilityChecks: [], receivedBundles: [], sentBundles: [], auditEvents: [], appointments: [
      { id: 'APT-1001', patientId: 'P0001001', startsAt: '2026-09-18T10:30:00+09:00', department: '内科', status: 'booked' }
    ]
  };
}
export function makeId(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function audit(store, { action, resourceType, resourceId, practitionerId, requestId, outcome = 'success' }) {
  const event = { id: makeId('AUD'), recordedAt: new Date().toISOString(), action, resourceType, resourceId, practitionerId, requestId, outcome };
  store.auditEvents.push(event);
  return event;
}

