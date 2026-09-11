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
  ['DEMO260902', '鈴木 正一', 'スズキ ショウイチ', '1952-11-03', 'male', '整形外科'],
  ['DEMO260903', '高橋 幸子', 'タカハシ サチコ', '1941-07-26', 'female', '整形外科'],
  ['DEMO260904', '田中 博', 'タナカ ヒロシ', '1958-01-19', 'male', '神経内科'],
  ['DEMO260905', '伊藤 洋子', 'イトウ ヨウコ', '1949-09-07', 'female', '回復期リハビリテーション科'],
  ['DEMO260906', '渡辺 清', 'ワタナベ キヨシ', '1955-06-15', 'male', '循環器内科'],
  ['DEMO260907', '山本 恵子', 'ヤマモト ケイコ', '1946-02-08', 'female', '呼吸器内科'],
  ['DEMO260908', '中村 隆', 'ナカムラ タカシ', '1960-12-21', 'male', '神経内科'],
  ['DEMO260909', '小林 久美子', 'コバヤシ クミコ', '1951-05-30', 'female', '回復期リハビリテーション科'],
  ['DEMO260910', '加藤 一郎', 'カトウ イチロウ', '1944-10-11', 'male', '整形外科']
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

const familyNames = [
  ['朝霧', 'アサギリ'], ['若葉', 'ワカバ'], ['星野', 'ホシノ'], ['水瀬', 'ミナセ'], ['月岡', 'ツキオカ'],
  ['風間', 'カザマ'], ['森川', 'モリカワ'], ['海野', 'ウミノ'], ['日向', 'ヒナタ'], ['雪村', 'ユキムラ']
];
const givenNames = [
  ['葵', 'アオイ', 'female'], ['悠真', 'ユウマ', 'male'], ['結衣', 'ユイ', 'female'], ['大輝', 'ダイキ', 'male'], ['美咲', 'ミサキ', 'female'],
  ['健介', 'ケンスケ', 'male'], ['さくら', 'サクラ', 'female'], ['一樹', 'カズキ', 'male'], ['七海', 'ナナミ', 'female']
];
const clinicalProfiles = [
  { department: '内科', condition: '高血圧症', icd10: 'I10', medicationIndex: 0, secondaryMedicationIndex: 10, labIndex: 4, imagingIndex: 0, subjective: '定期受診。自覚症状に大きな変化なし。', objective: '血圧132/78 mmHg、体温36.5℃。', assessment: '血圧は概ね安定している。', plan: '内服を継続し、家庭血圧を記録する。' },
  { department: '整形外科', condition: '変形性膝関節症', icd10: 'M17.9', medicationIndex: 1, secondaryMedicationIndex: 8, labIndex: 3, imagingIndex: 2, subjective: '歩行時に右膝痛がある。', objective: '右膝屈曲時に軽度疼痛、腫脹なし。', assessment: '変形性膝関節症による疼痛。', plan: '鎮痛薬と運動療法を継続する。' },
  { department: '循環器内科', condition: '慢性心不全', icd10: 'I50.9', medicationIndex: 11, secondaryMedicationIndex: 10, labIndex: 2, imagingIndex: 0, subjective: '労作時に軽い息切れがある。', objective: 'SpO2 97%、下腿浮腫は軽度。', assessment: '慢性心不全、増悪所見に乏しい。', plan: '体重と浮腫を観察し、現行治療を継続する。' },
  { department: '呼吸器内科', condition: '気管支喘息', icd10: 'J45.9', medicationIndex: 3, secondaryMedicationIndex: 13, labIndex: 0, imagingIndex: 0, subjective: '夜間に軽い咳がある。', objective: '呼吸音は清、SpO2 98%。', assessment: '気管支喘息は概ねコントロール良好。', plan: '吸入手技を再確認し治療を継続する。' },
  { department: '糖尿病内科', condition: '2型糖尿病', icd10: 'E11.9', medicationIndex: 14, secondaryMedicationIndex: 12, labIndex: 1, imagingIndex: 3, subjective: '口渇や低血糖症状はない。', objective: '随時血糖126 mg/dL。', assessment: '2型糖尿病、経過観察可能。', plan: '食事療法と内服を継続しHbA1cを確認する。' },
  { department: '脳神経内科', condition: '脳梗塞後遺症', icd10: 'I69.3', medicationIndex: 2, secondaryMedicationIndex: 12, labIndex: 2, imagingIndex: 1, subjective: '左上下肢の動かしにくさが続く。', objective: '左片麻痺は軽度、歩行器使用。', assessment: '脳梗塞後遺症、機能は安定。', plan: '再発予防薬とリハビリテーションを継続する。' },
  { department: '消化器内科', condition: '逆流性食道炎', icd10: 'K21.9', medicationIndex: 6, secondaryMedicationIndex: null, labIndex: 3, imagingIndex: 3, subjective: '食後に胸やけがある。', objective: '腹部平坦・軟、圧痛なし。', assessment: '逆流性食道炎を疑う。', plan: '酸分泌抑制薬を処方し生活指導を行う。' },
  { department: '回復期リハビリテーション科', condition: '廃用症候群', icd10: 'R53', medicationIndex: 7, secondaryMedicationIndex: 9, labIndex: 0, imagingIndex: 0, subjective: '起立時のふらつきがある。', objective: '見守り下で立位保持30秒可能。', assessment: '廃用による筋力低下。', plan: 'PT・OTによる起立歩行訓練を継続する。' }
];
const medicationCatalog = [
  ['112400101', 'アムロジピン錠5mg（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '経口'],
  ['114100201', 'ロキソプロフェン錠60mg（架空処方）', '1回1錠 1日3回 毎食後', 21, '錠', '経口'],
  ['333200101', 'アスピリン錠100mg（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '経口'],
  ['225100101', '吸入薬A（架空処方）', '1回1吸入 1日2回', 14, '回分', '吸入'],
  ['396901001', '糖尿病治療薬A（架空処方）', '1回1錠 1日2回 朝夕食後', 28, '錠', '経口'],
  ['117902501', 'プレガバリンカプセル25mg（架空処方）', '1回1カプセル 1日2回 朝夕食後', 28, 'カプセル', '経口'],
  ['232902101', '酸分泌抑制薬A（架空処方）', '1回1錠 1日1回 夕食後', 14, '錠', '経口'],
  ['399902501', 'ビタミンD錠（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '経口'],
  ['264672901', '消炎鎮痛貼付剤（架空処方）', '1日1回 患部に貼付', 14, '枚', '外用'],
  ['106020001', 'アセトアミノフェン錠200mg（架空処方）', '1回1錠 疼痛時', 10, '錠', '経口'],
  ['214904201', 'テルミサルタン錠20mg（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '経口'],
  ['213900501', 'フロセミド錠20mg（架空処方）', '1回1錠 1日1回 朝食後', 14, '錠', '経口'],
  ['218901101', 'ロスバスタチン錠2.5mg（架空処方）', '1回1錠 1日1回 夕食後', 14, '錠', '経口'],
  ['225970201', '気管支拡張吸入薬B（架空処方）', '1回1吸入 発作時', 20, '回分', '吸入'],
  ['396200201', 'メトホルミン錠250mg（架空処方）', '1回1錠 1日2回 朝夕食後', 28, '錠', '経口']
];
const labCatalog = [
  ['6690-2', '白血球数', '6.2 10*3/uL', '静脈血'], ['4548-4', 'HbA1c', '6.4 %', '静脈血'],
  ['2160-0', 'クレアチニン', '0.82 mg/dL', '血清'], ['1988-5', 'CRP', '0.08 mg/dL', '血清'],
  ['2951-2', 'ナトリウム', '140 mmol/L', '血清'], ['2823-3', 'カリウム', '4.1 mmol/L', '血清']
];
const injectionCatalog = [
  ['生理食塩液100mL（架空）', '100mL', '静脈内'], ['補液A 500mL（架空）', '500mL', '静脈内'],
  ['ビタミン製剤注射（架空）', '1管', '静脈内'], ['鎮痛薬注射（架空）', '1アンプル', '筋肉内']
];
const imagingCatalog = [
  ['胸部X線', '胸部正面', '定期評価'], ['頭部CT', '頭部単純', '経過確認'],
  ['膝関節MRI', '右膝', '疼痛精査'], ['腹部超音波', '上腹部', '定期検査']
];

const smartRehabPlanSeeds = {
  DEMO260901: ['脳血管疾患等', '脳梗塞後遺症', '2026-08-18', '入院', '回復期3階A', ['右片麻痺', '歩行障害'], ['転倒リスク', '嚥下状態を確認'], '病棟内歩行を見守りで実施し自宅退院する', ['PT', 'OT', 'ST']],
  DEMO260902: ['運動器', '右大腿骨頸部骨折術後', '2026-08-20', '入院', '回復期2階B', ['右下肢筋力低下', '移乗動作低下'], ['転倒リスク', '右股関節荷重指示'], '歩行器で病棟内移動を自立する', ['PT', 'OT']],
  DEMO260903: ['運動器', '変形性膝関節症', '2026-08-22', '入院', '整形外科4階', ['右膝関節可動域制限', '疼痛'], ['疼痛増悪', '転倒リスク'], '階段昇降を手すり使用で獲得する', ['PT', 'OT']],
  DEMO260904: ['脳血管疾患等', '脳梗塞後遺症', '2026-08-25', '入院', '神経内科5階', ['左片麻痺', '失語症'], ['転倒リスク', '再発予防'], '屋内歩行と日常会話能力を改善する', ['PT', 'OT', 'ST']],
  DEMO260905: ['廃用症候群', '肺炎後廃用症候群', '2026-08-28', '入院', '回復期2階A', ['全身持久力低下', 'ADL低下'], ['起立性低血圧', '低栄養'], '身辺動作を見守りレベルまで改善する', ['PT', 'OT']],
  DEMO260906: ['心大血管疾患', '慢性心不全', '2026-09-01', '外来', '循環器6階', ['運動耐容能低下'], ['心不全増悪', '血圧変動'], '安全な有酸素運動を自己管理できる', ['PT']],
  DEMO260907: ['呼吸器', '慢性呼吸不全', '2026-09-02', '入院', '呼吸器5階', ['呼吸困難', '運動耐容能低下'], ['SpO2低下', '呼吸困難増悪'], '呼吸法を用いて病棟内移動を行う', ['PT', 'OT']],
  DEMO260908: ['脳血管疾患等', '脳梗塞後遺症', '2026-09-03', '入院', '回復期3階B', ['左上肢機能低下', '構音障害'], ['転倒リスク', '誤嚥リスク'], '食事と更衣を一部介助まで改善する', ['PT', 'OT', 'ST']],
  DEMO260909: ['廃用症候群', '術後廃用症候群', '2026-09-04', '外来', '外科4階', ['体幹筋力低下', '持久力低下'], ['創部負荷', '疲労'], '屋外歩行を休憩なしで10分継続する', ['PT']],
  DEMO260910: ['運動器', '腰椎圧迫骨折', '2026-09-05', '入院', '回復期2階B', ['体幹可動域制限', '腰痛'], ['再骨折', '転倒リスク'], '装具を使用して更衣と移動を自立する', ['PT', 'OT']]
};
const smartRehabConditionCodes = {
  DEMO260901: 'I69.3', DEMO260902: 'S72.0', DEMO260903: 'M17.9', DEMO260904: 'I69.3', DEMO260905: 'R53',
  DEMO260906: 'I50.9', DEMO260907: 'J96.1', DEMO260908: 'I69.3', DEMO260909: 'R53', DEMO260910: 'S32.0'
};

const rehabilitationTemplates = {
  'M17.9': ['運動器', ['下肢筋力低下', '関節可動域制限'], ['疼痛増悪', '転倒リスク'], '屋内歩行と階段昇降能力を改善する', ['PT', 'OT']],
  'I50.9': ['心大血管疾患', ['運動耐容能低下'], ['心不全増悪', '血圧変動'], '安全な運動負荷を自己管理できる', ['PT']],
  'J45.9': ['呼吸器', ['呼吸機能低下', '運動耐容能低下'], ['SpO2低下', '呼吸困難増悪'], '呼吸法を用いて日常生活動作を行う', ['PT', 'OT']],
  'I69.3': ['脳血管疾患等', ['片麻痺', '歩行障害'], ['転倒リスク', '誤嚥リスク'], '移動と身辺動作を見守りレベルまで改善する', ['PT', 'OT', 'ST']],
  R53: ['廃用症候群', ['全身筋力低下', 'ADL低下'], ['起立性低血圧', '低栄養'], '基本動作と身辺動作を改善する', ['PT', 'OT']]
};

function clinicalProfileFor(patient, fallbackIndex) {
  const departmentAliases = { 脳神経外科: '脳神経内科', 神経内科: '脳神経内科' };
  const department = departmentAliases[patient.department] || patient.department;
  return clinicalProfiles.find((profile) => profile.department === department) || clinicalProfiles[fallbackIndex % clinicalProfiles.length];
}

function rehabilitationPlanFor(patient, profile, index, encounterId, conditionId) {
  const seeded = patient.smartRehabId ? smartRehabPlanSeeds[patient.smartRehabId] : null;
  const template = rehabilitationTemplates[profile.icd10];
  if (!seeded && !template) return null;
  const [rehabilitationClass, diagnosis, startDate, entryExit, wardName, impairments, risks, goal, professions] = seeded || [
    template[0], profile.condition, `2026-09-${String(1 + (index % 9)).padStart(2, '0')}`,
    index % 5 === 0 ? '外来' : '入院', index % 5 === 0 ? `${profile.department}外来` : `回復期${(index % 3) + 2}階${index % 2 ? 'B' : 'A'}`,
    template[1], template[2], template[3], template[4]
  ];
  const fimTotal = 58 + (index % 29);
  return {
    id: `REHAB-ORDER-${String(index + 1).padStart(3, '0')}`, patientId: patient.id, encounterId, conditionId,
    status: 'active', intent: 'order', authoredOn: `${startDate}T09:00:00+09:00`, startDate,
    targetDischargeDate: entryExit === '入院' ? `2026-1${index % 3}-${String(10 + (index % 18)).padStart(2, '0')}` : null,
    entryExit, wardName, rehabilitationClass, primaryDiagnosis: diagnosis,
    requester: patient.primaryPhysician, professions, plannedUnitsPerDay: 2 + (index % 2),
    impairments, risks, goal,
    fim: { total: fimTotal, motor: fimTotal - 24, cognitive: 24, previousTotal: Math.max(18, fimTotal - 6) }
  };
}

function isoAt(index, hour = 9) {
  return new Date(Date.UTC(2026, 8, 10 - (index % 28), hour, (index * 7) % 60)).toISOString();
}

function daysBefore(value, days) {
  return new Date(Date.parse(value) - (days * 24 * 60 * 60 * 1000)).toISOString();
}

function createAdditionalPatients(count) {
  return Array.from({ length: count }, (_, index) => {
    const [family, familyKana] = familyNames[index % familyNames.length];
    const [given, givenKana, gender] = givenNames[Math.floor(index / familyNames.length) % givenNames.length];
    const profile = clinicalProfiles[index % clinicalProfiles.length];
    const sequence = index + 1;
    const birthYear = 1932 + ((index * 7) % 72);
    const birthMonth = String((index % 12) + 1).padStart(2, '0');
    const birthDay = String((index % 27) + 1).padStart(2, '0');
    return {
      id: `P-DEMO-${String(sequence).padStart(3, '0')}`,
      name: `${family} ${given}`, kana: `${familyKana} ${givenKana}`,
      birthDate: `${birthYear}-${birthMonth}-${birthDay}`, gender,
      bloodType: ['A+', 'B+', 'O+', 'AB+', '未確認'][index % 5],
      phone: `090-1000-${String(sequence).padStart(4, '0')}`,
      postalCode: `1${String(100000 + sequence).slice(-6)}`,
      address: `東京都架空区電子カルテ${sequence}番地`,
      insurance: {
        insurerNumber: `0613${String(8000 + sequence).slice(-4)}`, symbol: '架空',
        number: `D${String(sequence).padStart(5, '0')}`, branchNumber: String(index % 10).padStart(2, '0'),
        status: index % 13 === 0 ? '確認待ち' : '有効', copayRate: index % 8 === 0 ? 20 : 30,
        verifiedAt: index % 13 === 0 ? null : now
      },
      allergies: index % 7 === 0 ? ['ペニシリン'] : index % 11 === 0 ? ['ヨード造影剤'] : [],
      alerts: [index % 5 === 0 ? '転倒リスク' : 'デモ患者・実在情報ではありません'],
      department: profile.department,
      nextAppointment: `2026-09-${String(12 + (index % 16)).padStart(2, '0')} ${String(9 + (index % 8)).padStart(2, '0')}:00`,
      lastVisit: `2026-09-${String(1 + (index % 10)).padStart(2, '0')}`,
      status: ['受付済', '診察待ち', '予約', '会計待ち'][index % 4],
      room: ['診察室1', '診察室2', '待合', '会計'][index % 4],
      dataClassification: 'FICTIONAL_DEMO'
    };
  });
}

function createComprehensiveSeed() {
  const patients = seedPatients.concat(smartRehabPatients, createAdditionalPatients(86)).map((patient, index) => {
    const heightCm = 148 + (index % 36);
    const weightKg = 44 + ((index * 3) % 47);
    return {
      ...patient,
      maritalStatus: ['既婚', '未婚', '死別', '既婚'][index % 4],
      preferredLanguage: 'ja-JP',
      occupation: ['退職', '会社員', '自営業', '主婦・主夫', 'パート勤務'][index % 5],
      emergencyContact: {
        name: `架空家族 ${String(index + 1).padStart(3, '0')}`,
        relationship: ['配偶者', '子', '兄弟姉妹'][index % 3],
        phone: `090-9000-${String(index + 1).padStart(4, '0')}`
      },
      primaryPhysician: ['佐藤 医師', '松本 医師', '高木 医師', '加納 医師'][index % 4],
      heightCm,
      weightKg,
      bmi: Number((weightKg / ((heightCm / 100) ** 2)).toFixed(1)),
      smokingStatus: ['never', 'former', 'never', 'current'][index % 4],
      alcoholUse: ['none', 'social', 'none', 'daily'][index % 4],
      careLevel: index % 9 === 0 ? `要介護${(index % 3) + 1}` : index % 7 === 0 ? '要支援1' : 'なし',
      livingSituation: ['家族同居', '独居', '家族同居', '施設入所'][index % 4],
      advanceDirective: index % 6 === 0 ? '確認済み' : '未確認',
      dataClassification: 'FICTIONAL_DEMO'
    };
  });
  if (patients.length !== 100) throw new Error(`fictional patient seed must contain 100 patients, got ${patients.length}`);

  const records = structuredClone(seedRecords);
  const medicationRequests = structuredClone(seedMedicationRequests.concat(smartRehabMedicationRequests));
  const labOrders = structuredClone(seedLabOrders);
  const documents = structuredClone(seedDocuments);
  const dispenses = structuredClone(seedDispenses);
  const injectionOrders = [];
  const imagingOrders = [];
  const summaries = [];
  const prescriptions = [
    { id: 'RX-20260828-0001', patientId: 'P0001001', medicationRequestIds: ['MEDREQ-20260828-001'], status: 'dispensed', sentAt: '2026-08-28T10:31:00+09:00', receiptId: 'RCPT-20260828-1001', confirmationCode: '810001' }
  ];
  const eligibilityChecks = [];
  const receivedBundles = [];
  const sentBundles = [];
  const auditEvents = [];
  const appointments = [
    { id: 'APT-1001', patientId: 'P0001001', startsAt: '2026-09-18T10:30:00+09:00', department: '内科', status: 'booked' }
  ];
  const billingCharges = [];
  const encounters = [];
  const conditions = [];
  const vitalSigns = [];
  const rehabilitationPlans = [];

  patients.forEach((patient, index) => {
    const key = String(index + 1).padStart(3, '0');
    const profile = clinicalProfileFor(patient, index);
    const occurredAt = isoAt(index, 0);
    const encounterId = `ENC-DEMO-${key}`;
    const conditionId = `COND-DEMO-${key}`;
    const rehabilitationPlan = rehabilitationPlanFor(patient, profile, index, encounterId, conditionId);
    encounters.push({
      id: encounterId, patientId: patient.id, department: patient.department,
      status: rehabilitationPlan?.entryExit === '入院' ? 'in-progress' : 'finished',
      classCode: rehabilitationPlan?.entryExit === '入院' ? 'IMP' : 'AMB',
      entryExit: rehabilitationPlan?.entryExit || '外来', wardName: rehabilitationPlan?.wardName || `${patient.department}外来`,
      startedAt: rehabilitationPlan?.startDate ? `${rehabilitationPlan.startDate}T08:30:00+09:00` : occurredAt,
      ...(rehabilitationPlan?.entryExit === '入院' ? {} : { endedAt: isoAt(index, 1) }),
      practitionerId: `PRACT-${String((index % 6) + 1).padStart(3, '0')}`
    });
    conditions.push({
      id: conditionId, patientId: patient.id, code: smartRehabConditionCodes[patient.smartRehabId] || profile.icd10,
      display: rehabilitationPlan?.primaryDiagnosis || profile.condition,
      clinicalStatus: 'active', verificationStatus: 'confirmed', recordedDate: occurredAt
    });
    if (rehabilitationPlan) rehabilitationPlans.push(rehabilitationPlan);
    const systolic = profile.icd10 === 'I10' ? 132 + (index % 11) : 112 + (index % 19);
    const diastolic = 68 + (index % 17);
    vitalSigns.push({
      id: `VITAL-DEMO-${key}`, patientId: patient.id, encounterId,
      observedAt: occurredAt, systolic, diastolic,
      pulse: 58 + (index % 31), temperatureC: Number((36.1 + ((index % 8) * 0.1)).toFixed(1)),
      spo2: profile.icd10 === 'J45.9' || profile.icd10 === 'I50.9' ? 95 + (index % 3) : 97 + (index % 3),
      heightCm: patient.heightCm, weightKg: patient.weightKg, bmi: patient.bmi,
      performer: patient.primaryPhysician
    });

    let record = records.find((item) => item.patientId === patient.id);
    if (!record) {
      record = {
        id: `REC-DEMO-${key}`, patientId: patient.id, encounterId, occurredAt,
        department: patient.department, author: ['佐藤 医師', '松本 医師', '高木 医師', '加納 医師'][index % 4],
        status: index % 10 === 0 ? 'draft' : 'signed', version: index % 10 === 0 ? 1 : 2,
        soap: { subjective: profile.subjective, objective: profile.objective, assessment: profile.assessment, plan: profile.plan },
        ...(index % 10 === 0 ? {} : { signedAt: isoAt(index, 1) })
      };
      records.push(record);
    }

    const targetVisitCount = 1 + (index % 4);
    for (let visit = records.filter((item) => item.patientId === patient.id).length; visit < targetVisitCount; visit += 1) {
      const historicalAt = daysBefore(occurredAt, visit * 28);
      const historicalEncounterId = `ENC-HIST-${key}-${visit + 1}`;
      encounters.push({
        id: historicalEncounterId, patientId: patient.id, department: patient.department,
        status: 'finished', startedAt: historicalAt,
        endedAt: new Date(Date.parse(historicalAt) + (45 * 60 * 1000)).toISOString(),
        practitionerId: `PRACT-${String((index % 6) + 1).padStart(3, '0')}`
      });
      records.push({
        id: `REC-HIST-${key}-${visit + 1}`, patientId: patient.id, encounterId: historicalEncounterId,
        occurredAt: historicalAt, department: patient.department, author: patient.primaryPhysician,
        status: 'signed', version: 1,
        soap: {
          subjective: `定期再診。${profile.subjective}`,
          objective: profile.objective,
          assessment: `${profile.condition}の経過観察。${profile.assessment}`,
          plan: profile.plan
        },
        signedAt: new Date(Date.parse(historicalAt) + (35 * 60 * 1000)).toISOString()
      });
    }

    let medication = medicationRequests.find((item) => item.patientId === patient.id);
    if (!medication) {
      const [medicationCode, medicationDisplay, dosageText, quantity, unit, route] = medicationCatalog[profile.medicationIndex];
      medication = {
        id: `MEDREQ-DEMO-${key}`, patientId: patient.id, recordId: record.id,
        status: 'active', intent: 'order', authoredOn: occurredAt,
        requester: record.author, medicationCode, medicationDisplay, dosageText,
        days: 14, quantity, unit, route, erxStatus: 'dispensed'
      };
      medicationRequests.push(medication);
    }

    medicationRequests.filter((item) => item.patientId === patient.id).forEach((item) => {
      if (!records.some((candidate) => candidate.id === item.recordId)) item.recordId = record.id;
    });
    if (index % 3 === 0 && profile.secondaryMedicationIndex !== null && medicationRequests.filter((item) => item.patientId === patient.id).length === 1) {
      const [medicationCode, medicationDisplay, dosageText, quantity, unit, route] = medicationCatalog[profile.secondaryMedicationIndex];
      medicationRequests.push({
        id: `MEDREQ-DEMO-${key}-02`, patientId: patient.id, recordId: record.id,
        status: 'active', intent: 'order', authoredOn: occurredAt,
        requester: record.author, medicationCode, medicationDisplay, dosageText,
        days: 14, quantity, unit, route, erxStatus: 'dispensed'
      });
    }

    let prescription = prescriptions.find((item) => item.patientId === patient.id);
    if (!prescription) {
      const prescriptionStatus = index % 11 === 0 ? 'submitted' : 'dispensed';
      prescription = {
        id: `RX-DEMO-${key}`, patientId: patient.id, medicationRequestIds: [],
        status: prescriptionStatus, sentAt: isoAt(index, 2), receiptId: `RCPT-DEMO-${key}`,
        confirmationCode: String(820000 + index)
      };
      prescriptions.push(prescription);
    }
    const patientMedications = medicationRequests.filter((item) => item.patientId === patient.id);
    prescription.medicationRequestIds = patientMedications.map((item) => item.id);
    patientMedications.forEach((item) => {
      item.prescriptionId = prescription.id;
      item.erxStatus = prescription.status;
    });

    if (prescription.status === 'dispensed' && !dispenses.some((item) => item.patientId === patient.id)) {
      dispenses.push({
        id: `DISP-DEMO-${key}`, prescriptionId: prescription.id, patientId: patient.id,
        pharmacy: `架空調剤薬局${(index % 5) + 1}`, dispensedAt: isoAt(index, 3),
        status: 'completed', note: '処方どおり調剤（架空データ）'
      });
    }

    if (!labOrders.some((item) => item.patientId === patient.id)) {
      const [code, name, result, specimen] = labCatalog[profile.labIndex];
      const labStatus = index % 9 === 0 ? 'requested' : 'completed';
      labOrders.push({
        id: `LAB-DEMO-${key}`, patientId: patient.id, recordId: record.id, code, name,
        priority: index % 12 === 0 ? 'urgent' : 'routine', status: labStatus,
        requestedAt: occurredAt, specimen,
        ...(labStatus === 'completed' ? { completedAt: isoAt(index, 2), result } : {})
      });
    }
    if (index % 4 === 0 || ['回復期リハビリテーション科', '循環器内科'].includes(patient.department)) {
      const [injectionName, dose, injectionRoute] = injectionCatalog[index % injectionCatalog.length];
      injectionOrders.push({
        id: `INJ-DEMO-${key}`, patientId: patient.id, recordId: record.id,
        medicationDisplay: injectionName, dose, route: injectionRoute, scheduledAt: isoAt(index, 2),
        status: index % 9 === 0 ? 'scheduled' : 'completed', requestedAt: occurredAt
      });
    }
    if (index % 3 === 0 || ['整形外科', '脳神経内科'].includes(patient.department)) {
      const [imagingType, imagingTitle, imagingNote] = imagingCatalog[profile.imagingIndex];
      imagingOrders.push({
        id: `IMG-DEMO-${key}`, patientId: patient.id, recordId: record.id,
        type: imagingType, title: imagingTitle, note: imagingNote,
        status: index % 8 === 0 ? 'requested' : 'reported', requestedAt: occurredAt,
        ...(index % 8 === 0 ? {} : { report: '明らかな急性異常所見なし（架空読影結果）', reportedAt: isoAt(index, 3) })
      });
    }
    if ((index % 2 === 0 || patient.id === 'P0001001') && !documents.some((item) => item.patientId === patient.id)) {
      documents.push({
        id: `DOC-DEMO-${key}`, patientId: patient.id,
        type: index % 2 === 0 ? '紹介状' : '検査報告書',
        title: `${profile.condition}に関する診療文書（架空）`,
        authoredAt: occurredAt, author: record.author, status: 'final',
        source: index % 3 === 0 ? 'FHIR受信' : '院内作成'
      });
    }
    if (index % 3 === 0 || patient.department === '回復期リハビリテーション科') {
      summaries.push({
        id: `SUM-DEMO-${key}`, patientId: patient.id,
        type: patient.department === '回復期リハビリテーション科' ? '退院時サマリー' : '診療情報提供書',
        recipient: `架空連携医療機関${(index % 6) + 1}`, condition: profile.condition,
        course: `${profile.assessment} ${profile.plan}`, format: 'FHIR R4 document mock',
        status: 'final', authoredAt: isoAt(index, 3)
      });
    }
    eligibilityChecks.push({
      id: `ELG-DEMO-${key}`, patientId: patient.id,
      status: patient.insurance.status === '有効' ? 'qualified' : 'pending',
      verifiedAt: isoAt(index, 1), insurerNumber: patient.insurance.insurerNumber,
      copayRate: patient.insurance.copayRate, consent: true
    });
    if (!appointments.some((item) => item.patientId === patient.id)) {
      appointments.push({
        id: `APT-DEMO-${key}`, patientId: patient.id,
        startsAt: `2026-09-${String(12 + (index % 16)).padStart(2, '0')}T${String(9 + (index % 8)).padStart(2, '0')}:00:00+09:00`,
        department: patient.department, status: 'booked'
      });
    }
    billingCharges.push({
      id: `CHG-DEMO-${key}`, patientId: patient.id, encounterId,
      items: [
        { code: 'DEMO-RECEIPT-001', display: '初再診料（架空）', points: 288 },
        { code: 'DEMO-RX-001', display: '処方料（架空）', points: 42 }
      ],
      totalPoints: 330, status: index % 7 === 0 ? 'queued' : 'accepted', queuedAt: isoAt(index, 3)
    });
    if (index % 5 === 0) receivedBundles.push({
      id: `FHIR-RECV-DEMO-${key}`, patientId: patient.id, receivedAt: occurredAt,
      source: `架空地域病院${(index % 4) + 1}`, status: 'validated',
      bundle: {
        resourceType: 'Bundle', id: `BUNDLE-RECV-DEMO-${key}`, type: 'document', timestamp: occurredAt,
        entry: [{ resource: { resourceType: 'Composition', id: `COMP-RECV-DEMO-${key}`, status: 'final', type: { text: '診療情報提供書' }, title: '受信診療情報提供書（架空）', date: occurredAt, subject: { reference: `Patient/${patient.id}` } } }]
      }
    });
    if (index % 6 === 0) sentBundles.push({
      id: `FHIR-SEND-DEMO-${key}`, patientId: patient.id,
      destination: `架空連携医療機関${(index % 6) + 1}`, status: 'accepted', sentAt: isoAt(index, 3),
      bundle: {
        resourceType: 'Bundle', id: `BUNDLE-SEND-DEMO-${key}`, type: 'document', timestamp: isoAt(index, 3),
        entry: [{ resource: { resourceType: 'Composition', id: `COMP-SEND-DEMO-${key}`, status: 'final', type: { text: '診療情報提供書' }, title: '送信診療情報提供書（架空）', date: isoAt(index, 3), subject: { reference: `Patient/${patient.id}` } } }]
      }
    });
    auditEvents.push({
      id: `AUD-DEMO-${key}`, recordedAt: isoAt(index, 3), action: 'seed',
      resourceType: 'PatientClinicalDataset', resourceId: patient.id,
      practitionerId: record.author, requestId: `REQ-SEED-${key}`, outcome: 'success'
    });
  });

  records.forEach((record) => {
    if (!encounters.some((encounter) => encounter.id === record.encounterId)) {
      encounters.push({
        id: record.encounterId, patientId: record.patientId, department: record.department,
        status: 'finished', startedAt: record.occurredAt,
        endedAt: new Date(Date.parse(record.occurredAt) + (45 * 60 * 1000)).toISOString(),
        practitionerId: 'PRACT-001'
      });
    }
  });

  return {
    patients, encounters, conditions, rehabilitationPlans, records, medicationRequests, labOrders,
    injectionOrders, imagingOrders, documents, summaries, dispenses, billingCharges,
    prescriptions, eligibilityChecks, receivedBundles, sentBundles, auditEvents, appointments,
    vitalSigns
  };
}

export function createStore() {
  return structuredClone(createComprehensiveSeed());
}

export function makeId(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export function audit(store, { action, resourceType, resourceId, practitionerId, requestId, outcome = 'success' }) {
  const event = { id: makeId('AUD'), recordedAt: new Date().toISOString(), action, resourceType, resourceId, practitionerId, requestId, outcome };
  store.auditEvents.push(event);
  return event;
}
