export const hospitalModules = [
  { id: 'reception', name: '外来予約・受付・救急', area: '受付', icon: '受', workTypes: ['外来予約', '外来受付', '救急受付', 'トリアージ'], capabilities: ['予約の登録・変更・取消・一覧', '受付票印刷', 'オンライン資格確認・再来受付機連携（模擬）', '救急患者一覧・トリアージ登録'] },
  { id: 'specimen', name: '検体検査', area: '検査', icon: '検', workTypes: ['検体検査', '採血', '結果承認'], capabilities: ['オーダ・Doオーダ', '同意書・検体ラベル印刷', '検査受付', '結果登録・承認', '部門連携（模擬）'] },
  { id: 'microbiology', name: '細菌検査', area: '検査', icon: '菌', workTypes: ['培養検査', '感受性検査', '結果承認'], capabilities: ['オーダ・Doオーダ', '検体ラベル印刷', '検査受付', '結果登録・承認', '部門連携（模擬）'] },
  { id: 'pathology', name: '病理検査', area: '検査', icon: '病', workTypes: ['組織診', '細胞診', '結果承認'], capabilities: ['オーダ・Doオーダ', '検体ラベル印刷', '検査受付', '結果登録・承認', '部門連携（模擬）'] },
  { id: 'physiology', name: '生理検査', area: '検査', icon: '生', workTypes: ['心電図', '超音波', '肺機能'], capabilities: ['オーダ・Doオーダ', '検査受付', '結果登録・承認', '部門連携（模擬）'] },
  { id: 'radiology', name: '放射線検査', area: '検査', icon: '放', workTypes: ['一般撮影', 'CT', 'MRI'], capabilities: ['オーダ・Doオーダ', '同意書印刷', '検査受付', 'RIS/PACS連携（模擬）'] },
  { id: 'endoscopy', name: '内視鏡検査', area: '検査', icon: '内', workTypes: ['上部内視鏡', '下部内視鏡', '処置内視鏡'], capabilities: ['オーダ・Doオーダ', '同意書印刷', '検査受付', '部門連携（模擬）'] },
  { id: 'procedure', name: '処置', area: '治療', icon: '処', workTypes: ['創傷処置', '吸入', 'ギプス'], capabilities: ['オーダ・Doオーダ', '指示箋印刷', '実施登録', '対象患者一覧'] },
  { id: 'injection', name: '注射', area: '治療', icon: '注', workTypes: ['点滴', '静注', '皮下注'], capabilities: ['オーダ・Doオーダ', '同意書・注射箋・ラベル印刷', '患者・薬剤・看護師の三点認証', '実施登録'] },
  { id: 'dialysis', name: '透析', area: '治療', icon: '透', workTypes: ['血液透析', '透析予約', '透析記録'], capabilities: ['透析セット・Doオーダ', '透析ベッド予約', '同意書印刷', '経過表', '部門連携（模擬）'] },
  { id: 'rehabilitation', name: 'リハビリ', area: '治療', icon: 'リ', workTypes: ['PT', 'OT', 'ST'], capabilities: ['オーダ・Doオーダ', '療法士・枠予約', '計画書・同意書', '受付・実施記録', '部門連携（模擬）'] },
  { id: 'guidance', name: '各種指導', area: '治療', icon: '指', workTypes: ['栄養指導', '服薬指導', '生活指導'], capabilities: ['オーダ・Doオーダ', '指導計画書', '受付', '実施登録'] },
  { id: 'chemotherapy', name: '化学療法', area: '治療', icon: '化', workTypes: ['レジメン', '次クール計画', '投与実施'], capabilities: ['レジメン・次クール計画', 'ベッド予約', '患者・薬剤・看護師の三点認証', '実施登録・経過表'] },
  { id: 'surgery', name: '手術・輸血', area: '中央診療', icon: '手', workTypes: ['手術', '輸血', '術後管理'], capabilities: ['手術・輸血オーダ', '同意書印刷', '手術レポート', '部門連携（模擬）'] },
  { id: 'meals', name: '食事・栄養', area: '病棟', icon: '食', workTypes: ['食事オーダ', '栄養管理計画', '食止め'], capabilities: ['食事オーダ', '栄養管理計画書', '給食部門連携（模擬）'] },
  { id: 'home-care', name: '訪問診療', area: '在宅', icon: '訪', workTypes: ['訪問診療', '往診', '在宅計画'], capabilities: ['訪問診療計画書・同意書', '自由記録・SOAP・シェーマ', '記録ひな形', '部門連携（模擬）'] },
  { id: 'home-nursing', name: '訪問看護', area: '在宅', icon: '看', workTypes: ['訪問看護指示', '訪問看護記録', '褥瘡評価'], capabilities: ['指示書・同意書', '経過表・看護記録', '多職種連携・褥瘡管理', '予定管理・部門連携（模擬）'] },
  { id: 'home-rehab', name: '訪問リハビリ', area: '在宅', icon: '在', workTypes: ['訪問リハ指示', '訪問リハ計画', '実施記録'], capabilities: ['指示書・実施計画書・同意書', 'リハビリ記録', '部門連携（模擬）'] },
  { id: 'health-check', name: '健診', area: '予防', icon: '健', workTypes: ['健診予約', '健診受付', '保健指導'], capabilities: ['予約・一覧', '受付・内容変更・取消', '支援計画書', '部門連携（模擬）'] }
];

export const featureGroups = [
  { range: '3–15', name: '外来予約・受付・救急・患者管理', route: 'hospital', status: 'interactive-mock' },
  { range: '16–22', name: '診察・カルテ・紹介状', route: 'encounter', status: 'interactive-mock' },
  { range: '23–56', name: '検体・細菌・病理・生理・放射線・内視鏡', route: 'hospital', status: 'interactive-mock' },
  { range: '57–64', name: '処方・安全チェック・電子処方箋', route: 'prescriptions', status: 'interactive-mock' },
  { range: '65–101', name: '処置・注射・透析・リハ・指導・化学療法', route: 'hospital', status: 'interactive-mock' },
  { range: '102', name: '会計・レセコン連携', route: 'admin', status: 'interactive-mock' },
  { range: '103–119', name: '入院・病床・退院', route: 'wards', status: 'interactive-mock' },
  { range: '120–125', name: '患者状態・看護・多職種連携', route: 'nursing', status: 'interactive-mock' },
  { range: '126–133', name: '手術・輸血・食事', route: 'hospital', status: 'interactive-mock' },
  { range: '134–158', name: '訪問診療・看護・リハ・健診', route: 'hospital', status: 'interactive-mock' },
  { range: '159–168', name: '物品・安全・マスタ・文書管理', route: 'admin', status: 'interactive-mock' },
  { range: '169–174', name: 'ユーザー・権限・認証・排他制御', route: 'admin', status: 'partial-security-mock' }
];

export const hospitalProfile = {
  id: 'ORG-KTUMH-DEMO', tenantId: 'TENANT-KTUMH-DEMO', facilityCode: 'KTUMH-DEMO-001',
  name: '慶応技術大学病院', nameKana: 'ケイオウギジュツダイガクビョウイン',
  type: '特定機能病院を想定した大学病院モック', operator: '学校法人 慶応技術大学（架空）',
  address: '東京都港区架空1-1-1', phone: '03-0000-0000', timezone: 'Asia/Tokyo',
  dataClassification: 'FICTIONAL_DEMO', medicalRecordSystem: 'MediLink Chart 0.5.0',
  bedScope: { licensed: 24, modeled: 24 },
  notice: '病院名・所在地・患者・職員・資格番号・診療内容はすべて架空です。'
};

export const organizationUnits = [
  ['DEP-ADM', '病院管理部', 'administration'], ['DEP-MED', '診療部', 'clinical'], ['DEP-NUR', '看護部', 'nursing'],
  ['DEP-INT', '内科', 'clinical-department', 'DEP-MED'], ['DEP-ORT', '整形外科', 'clinical-department', 'DEP-MED'],
  ['DEP-CAR', '循環器内科', 'clinical-department', 'DEP-MED'], ['DEP-RES', '呼吸器内科', 'clinical-department', 'DEP-MED'],
  ['DEP-DIA', '糖尿病内科', 'clinical-department', 'DEP-MED'], ['DEP-BNE', '脳神経内科', 'clinical-department', 'DEP-MED'],
  ['DEP-NSG', '脳神経外科', 'clinical-department', 'DEP-MED'], ['DEP-NEU', '神経内科', 'clinical-department', 'DEP-MED'],
  ['DEP-GAS', '消化器内科', 'clinical-department', 'DEP-MED'], ['DEP-RHB', '回復期リハビリテーション科', 'clinical-department', 'DEP-MED'],
  ['DEP-ANE', '麻酔科', 'clinical-department', 'DEP-MED'],
  ['DEP-PHA', '薬剤部', 'pharmacy'], ['DEP-LAB', '臨床検査部', 'diagnostic'], ['DEP-RAD', '放射線部', 'diagnostic', 'DEP-MED'],
  ['DEP-REH', 'リハビリテーション部', 'allied-health'], ['DEP-NUT', '栄養管理部', 'allied-health'],
  ['DEP-MSW', '患者総合支援部', 'support'], ['DEP-CLM', '医事課', 'administration'],
  ['DEP-ICT', '医療情報システム室', 'administration'], ['DEP-SAF', '医療安全管理部', 'governance'],
  ['DEP-PAT', '病理診断部', 'diagnostic', 'DEP-MED'],
  ['WARD-3A', '一般病棟3A', 'ward', 'DEP-NUR'], ['WARD-4B', '一般病棟4B', 'ward', 'DEP-NUR'], ['WARD-5A', '回復期病棟5A', 'ward', 'DEP-NUR'],
  ['LOC-ER', '救急外来', 'care-location', 'DEP-MED'], ['LOC-OPD', '外来診療部', 'care-location', 'DEP-MED'], ['LOC-HOME', '在宅診療部', 'care-location', 'DEP-MED'],
  ['LOC-OR', '中央手術部', 'care-location', 'DEP-MED'], ['LOC-ICU', '集中治療部（データのみ）', 'care-location', 'DEP-MED']
].map(([id, name, type, parentId = 'ORG-KTUMH-DEMO']) => ({
  id, code: `KTUMH-${id}`, name, type, parentId, active: true, dataClassification: 'FICTIONAL_DEMO'
}));

const physicianBlueprints = [
  ['佐藤 医師', '内科'], ['松本 医師', '整形外科'], ['加納 医師', '循環器内科'], ['森 医師', '呼吸器内科'],
  ['石井 医師', '糖尿病内科'], ['藤田 医師', '脳神経内科'], ['河合 医師', '脳神経外科'], ['小林 医師', '神経内科'],
  ['中村 医師', '消化器内科'], ['橋本 医師', '回復期リハビリテーション科'], ['救急当直 医師', '救急外来'], ['麻酔担当 医師', '麻酔科'],
  ['放射線担当 医師', '放射線部'], ['病理担当 医師', '病理診断部']
];

const nurseNames = [
  '山田 看護師', '青木 看護師', '伊藤 看護師', '上野 看護師', '大野 看護師', '岡田 看護師', '川島 看護師', '菊池 看護師', '黒田 看護師',
  '小泉 看護師', '近藤 看護師', '斎藤 看護師', '清水 看護師', '杉本 看護師', '高木 看護師', '竹内 看護師', '田辺 看護師', '千葉 看護師',
  '塚本 看護師', '中川 看護師', '西村 看護師', '野口 看護師', '長谷川 看護師', '林 看護師', '平野 看護師', '福田 看護師', '前田 看護師',
  '外来看護師01', '外来看護師02', '外来看護師03', '救急看護師01', '救急看護師02', '在宅看護師01'
];

function createStaffMembers() {
  const physicians = physicianBlueprints.map(([name, department], index) => ({
    id: `STF-PHY-${String(index + 1).padStart(3, '0')}`, employeeNo: `E-PHY-${String(index + 1).padStart(3, '0')}`,
    name, role: 'physician', jobTitle: index < 3 ? '診療科責任者' : '医員', department,
    qualifications: ['医師免許（架空）'], skills: [department, index === 10 ? '救急対応' : '診療オーダ'],
    professionalLicenseId: `DEMO-MD-${String(index + 1).padStart(5, '0')}`
  }));
  const nurses = nurseNames.map((name, index) => {
    const department = index < 9 ? '一般病棟3A' : index < 18 ? '一般病棟4B' : index < 27 ? '回復期病棟5A' : index < 30 ? '外来診療部' : index < 32 ? '救急外来' : '在宅診療部';
    return {
      id: `STF-NUR-${String(index + 1).padStart(3, '0')}`, employeeNo: `E-NUR-${String(index + 1).padStart(3, '0')}`,
      name, role: 'nurse', jobTitle: index % 9 === 0 ? '看護師長' : index % 9 === 1 ? '主任看護師' : '看護師', department,
      qualifications: ['看護師免許（架空）', ...(index % 7 === 0 ? ['認定看護分野（架空）'] : [])],
      skills: [department.includes('病棟') ? '病棟看護' : department, index % 3 === 0 ? '静脈注射' : '患者観察'],
      professionalLicenseId: `DEMO-RN-${String(index + 1).padStart(5, '0')}`
    };
  });
  const allied = [
    ['井上 薬剤師', 'pharmacist', '薬剤部', ['病棟薬剤業務', '持参薬確認']], ['吉田 薬剤師', 'pharmacist', '薬剤部', ['抗菌薬適正使用', '服薬指導']],
    ['渡辺 薬剤師', 'pharmacist', '薬剤部', ['化学療法', '調剤監査']], ['山口 薬剤師', 'pharmacist', '薬剤部', ['医薬品情報', '夜間対応']],
    ['鈴木 理学療法士', 'therapist', 'リハビリテーション部', ['理学療法', '歩行評価']], ['阿部 作業療法士', 'therapist', 'リハビリテーション部', ['作業療法', 'ADL評価']],
    ['池田 言語聴覚士', 'therapist', 'リハビリテーション部', ['言語療法', '嚥下評価']], ['高橋 臨床検査技師', 'technician', '臨床検査部', ['検体検査', '生理検査']],
    ['木村 診療放射線技師', 'technician', '放射線部', ['一般撮影', 'CT']], ['遠藤 管理栄養士', 'dietitian', '栄養管理部', ['栄養評価', '食事調整']],
    ['三浦 医療ソーシャルワーカー', 'social-worker', '患者総合支援部', ['退院支援', '社会資源調整']], ['田中 医事', 'clerk', '医事課', ['患者受付', '診療報酬']],
    ['医療情報 管理者', 'administrator', '医療情報システム室', ['アカウント管理', '監査']], ['医療安全 管理者', 'administrator', '医療安全管理部', ['医療安全', 'インシデント管理']]
  ].map(([name, role, department, skills], index) => ({
    id: `STF-ALL-${String(index + 1).padStart(3, '0')}`, employeeNo: `E-ALL-${String(index + 1).padStart(3, '0')}`,
    name, role, jobTitle: role === 'administrator' ? '管理担当' : name.split(' ').at(-1), department,
    qualifications: [`${name.split(' ').at(-1)}資格（架空）`], skills, professionalLicenseId: `DEMO-ALL-${String(index + 1).padStart(5, '0')}`
  }));
  return [...physicians, ...nurses, ...allied].map((staff) => ({
    ...staff, departmentUnitId: organizationUnits.find((unit) => unit.name === staff.department)?.id || null,
    active: true, employmentType: '常勤', mfaEnabled: true, lastLoginAt: '2026-09-11T08:45:00+09:00',
    dataClassification: 'FICTIONAL_DEMO', version: 1
  }));
}

const statusCycle = ['requested', 'accepted', 'in-progress', 'completed', 'approved'];

const departmentModules = {
  '内科': ['specimen', 'physiology'],
  '整形外科': ['radiology', 'rehabilitation'],
  '循環器内科': ['physiology', 'specimen'],
  '呼吸器内科': ['physiology', 'radiology'],
  '糖尿病内科': ['specimen', 'guidance'],
  '脳神経内科': ['radiology', 'rehabilitation'],
  '脳神経外科': ['radiology', 'rehabilitation'],
  '神経内科': ['radiology', 'rehabilitation'],
  '消化器内科': ['endoscopy', 'specimen'],
  '回復期リハビリテーション科': ['rehabilitation', 'guidance']
};

function careSettingFor(patient, index, admission) {
  if (admission) return '入院';
  if (index % 17 === 0) return '救急外来';
  if (index % 13 === 0) return '健診';
  if (index % 11 === 0 || patient.livingSituation === '施設入所') return '在宅・訪問';
  return '外来';
}

function journeyModuleFor(setting, index) {
  if (setting === '入院') return index % 2 === 0 ? 'meals' : 'injection';
  if (setting === '救急外来') return 'reception';
  if (setting === '健診') return 'health-check';
  if (setting === '在宅・訪問') return ['home-care', 'home-nursing', 'home-rehab'][index % 3];
  return 'reception';
}

export function createHospitalSeed(patients) {
  const staffMembers = createStaffMembers();
  const nurses = staffMembers.filter((staff) => staff.role === 'nurse');
  const physicians = staffMembers.filter((staff) => staff.role === 'physician');
  const pharmacists = staffMembers.filter((staff) => staff.role === 'pharmacist');
  const therapists = staffMembers.filter((staff) => staff.role === 'therapist');
  patients.forEach((patient) => {
    patient.departmentUnitId = organizationUnits.find((unit) => unit.name === patient.department)?.id || null;
  });
  const wards = ['一般病棟3A', '一般病棟4B', '回復期病棟5A'];
  const beds = wards.flatMap((ward, wardIndex) => Array.from({ length: 8 }, (_, bedIndex) => {
    const bedNo = `${ward.slice(-2)}-${String(bedIndex + 1).padStart(2, '0')}`;
    const occupied = bedIndex < 5;
    const patient = occupied ? patients[(wardIndex * 8 + bedIndex) % patients.length] : null;
    return {
      id: `BED-${wardIndex + 1}-${bedIndex + 1}`, ward, room: `${wardIndex + 3}0${Math.floor(bedIndex / 2) + 1}`, bedNo,
      status: occupied ? 'occupied' : bedIndex === 5 ? 'reserved' : bedIndex === 6 ? 'cleaning' : 'available',
      patientId: patient?.id || null, admittedAt: patient ? `2026-09-${String(1 + bedIndex).padStart(2, '0')}T10:00:00+09:00` : null,
      fallRisk: occupied && bedIndex % 2 === 0,
      isolation: patient?.infectionPrecautions !== '標準予防策' ? 'contact' : 'none', version: 1
    };
  }));
  const admissions = beds.filter((bed) => bed.patientId).map((bed, index) => {
    const patient = patients.find((item) => item.id === bed.patientId);
    const attending = physicians.find((staff) => staff.department === patient?.department) || physicians[0];
    return {
      id: `ADM-${String(index + 1).padStart(3, '0')}`, patientId: bed.patientId, bedId: bed.id, ward: bed.ward,
      departmentUnitId: patient.departmentUnitId,
      status: 'admitted', admissionType: index % 4 === 0 ? 'emergency' : 'planned', attendingPhysician: attending.name,
      attendingPhysicianId: attending.id,
      carePath: index % 3 === 0 ? '脳卒中地域連携パス（架空）' : '標準入院診療計画（架空）', broughtMedications: index % 2 === 0 ? '持参薬確認済み' : '確認中',
      plannedDischargeAt: `2026-09-${String(18 + (index % 8)).padStart(2, '0')}T10:00:00+09:00`, version: 1
    };
  });

  const specialModules = ['microbiology', 'pathology', 'surgery', 'dialysis', 'chemotherapy', 'procedure', 'injection'];
  const patientContexts = patients.map((patient, index) => {
    const admission = admissions.find((item) => item.patientId === patient.id);
    const bed = admission ? beds.find((item) => item.id === admission.bedId) : null;
    const careSetting = careSettingFor(patient, index, admission);
    const [primaryModule, secondaryModule] = departmentModules[patient.department] || ['specimen', 'guidance'];
    const clinicalRisks = [...new Set([
      ...patient.allergies,
      ...patient.alerts.filter((item) => !item.includes('デモ患者')),
      ...(Number(patient.birthDate.slice(0, 4)) < 1950 ? ['高齢者薬剤・せん妄リスク確認'] : []),
      ...(patient.smokingStatus === 'current' ? ['喫煙継続・呼吸状態確認'] : [])
    ])];
    const triage = careSetting === '救急外来' ? { level: `JTAS ${2 + (index % 3)}`, chiefComplaint: ['発熱', '胸部不快感', '転倒後疼痛'][index % 3], assessedAt: '2026-09-11T08:20:00+09:00' } : null;
    return {
      id: `CTX-${String(index + 1).padStart(3, '0')}`, patientId: patient.id, careSetting,
      departmentUnitId: patient.departmentUnitId,
      location: bed ? `${bed.ward} ${bed.room}号室 ${bed.bedNo}` : careSetting === '救急外来' ? '救急処置室' : careSetting === '在宅・訪問' ? patient.address : careSetting === '健診' ? '健診センター' : patient.room,
      primaryModule, secondaryModule, clinicalRisks, triage,
      careTeam: [
        physicians.find((staff) => staff.department === patient.department)?.name || physicians[index % physicians.length].name,
        admission ? nurses.find((staff) => staff.department === admission.ward)?.name : nurses[27 + (index % 6)].name,
        pharmacists[index % pharmacists.length].name,
        ...(primaryModule === 'rehabilitation' || secondaryModule === 'rehabilitation' ? [therapists[index % therapists.length].name] : [])
      ],
      consentStatus: { clinicalCare: '同意', informationSharing: index % 9 === 0 ? '確認待ち' : '同意', ePrescription: '同意', secondaryUse: index % 4 === 0 ? '不同意' : '未確認' },
      nextAction: careSetting === '入院' ? '病棟ラウンド・本日の予定確認' : careSetting === '救急外来' ? 'トリアージ後の医師診察' : careSetting === '在宅・訪問' ? '訪問予定と指示書確認' : careSetting === '健診' ? '健診項目受付' : '診察・部門オーダ確認',
      lastUpdatedAt: `2026-09-11T${String(8 + (index % 5)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}:00+09:00`, version: 1
    };
  });

  const activities = patientContexts.flatMap((context, patientIndex) => {
    const patient = patients[patientIndex];
    const journeyModule = journeyModuleFor(context.careSetting, patientIndex);
    const moduleIds = [journeyModule, context.primaryModule, patientIndex < specialModules.length ? specialModules[patientIndex] : context.secondaryModule];
    return [...new Set(moduleIds)].map((moduleId, itemIndex) => {
      const module = hospitalModules.find((candidate) => candidate.id === moduleId);
      const workType = module.workTypes[(patientIndex + itemIndex) % module.workTypes.length];
      const status = statusCycle[(patientIndex + itemIndex) % statusCycle.length];
      const completed = ['completed', 'approved'].includes(status);
      const assignedCandidates = [
        physicians.find((staff) => staff.department === patient.department) || physicians[patientIndex % physicians.length],
        nurses[patientIndex % nurses.length],
        staffMembers.find((staff) => staff.role === 'technician'),
        therapists[patientIndex % therapists.length]
      ];
      const assignedStaff = assignedCandidates[(patientIndex + itemIndex) % assignedCandidates.length];
      return {
        id: `HOSP-${String(patientIndex + 1).padStart(3, '0')}-${module.id.toUpperCase()}`,
        moduleId: module.id, patientId: patient.id, workType,
        title: `${workType}：${patient.department}診療（架空）`, status,
        priority: context.careSetting === '救急外来' || patientIndex % 19 === 0 ? 'urgent' : 'routine',
        scheduledAt: `2026-09-${String(11 + (patientIndex % 10)).padStart(2, '0')}T${String(8 + ((patientIndex + itemIndex) % 9)).padStart(2, '0')}:${String((patientIndex * 5) % 60).padStart(2, '0')}:00+09:00`,
        assignedStaffId: assignedStaff.id, assignedTo: assignedStaff.name,
        note: `${patient.name}の${module.name}業務。患者背景・アレルギー・同意を確認（すべて架空）。`,
        result: completed ? `${workType}を実施。重大な異常所見なし（架空）` : '',
        ...(completed && ['injection', 'chemotherapy'].includes(module.id) ? { barcodeVerification: { patient: true, medication: true, staff: true, verifiedAt: '2026-09-11T09:30:00+09:00' } } : {}),
        version: 1, createdAt: '2026-09-11T09:00:00+09:00', updatedAt: '2026-09-11T09:00:00+09:00'
      };
    });
  });

  const consentNames = { clinicalCare: '診療・処置', informationSharing: '診療情報共有', ePrescription: '電子処方箋', secondaryUse: '二次利用' };
  const patientConsents = patientContexts.flatMap((context, index) => Object.entries(context.consentStatus).map(([purpose, status], purposeIndex) => ({
    id: `CONS-${String(index + 1).padStart(3, '0')}-${purposeIndex + 1}`, patientId: context.patientId, purpose: consentNames[purpose], purposeCode: purpose, status,
    confirmedAt: status === '同意' || status === '不同意' ? `2026-09-${String(1 + (index % 10)).padStart(2, '0')}T10:00:00+09:00` : null,
    confirmedBy: status === '未確認' ? null : '田中 医事', version: 1
  })));
  const careTeams = patientContexts.map((context, index) => ({
    id: `TEAM-${String(index + 1).padStart(3, '0')}`, patientId: context.patientId,
    departmentUnitId: patients[index].departmentUnitId,
    name: `${patients[index].department}患者支援チーム（架空）`, status: 'active',
    members: context.careTeam.map((name, memberIndex) => {
      const staff = staffMembers.find((candidate) => candidate.name === name);
      return { staffId: staff?.id || null, name, role: ['主治医', '担当看護師', '担当薬剤師', '担当療法士'][memberIndex], profession: staff?.role || 'other' };
    }),
    updatedAt: context.lastUpdatedAt, dataClassification: 'FICTIONAL_DEMO', version: 1
  }));

  const shiftTemplates = [
    { code: 'day', label: '日勤', startsAt: '2026-09-11T08:30:00+09:00', endsAt: '2026-09-11T17:00:00+09:00' },
    { code: 'evening', label: '準夜勤', startsAt: '2026-09-11T16:30:00+09:00', endsAt: '2026-09-12T01:00:00+09:00' },
    { code: 'night', label: '深夜勤', startsAt: '2026-09-12T00:30:00+09:00', endsAt: '2026-09-12T09:00:00+09:00' }
  ];
  const shiftAssignments = wards.flatMap((ward, wardIndex) => shiftTemplates.flatMap((shift, shiftIndex) => {
    const wardNurses = nurses.filter((staff) => staff.department === ward);
    return wardNurses.slice(shiftIndex * 3, (shiftIndex + 1) * 3).map((staff, memberIndex) => ({
      id: `SHIFT-${wardIndex + 1}-${shiftIndex + 1}-${memberIndex + 1}`, staffId: staff.id, staffName: staff.name,
      ward, shiftCode: shift.code, shiftLabel: shift.label, startsAt: shift.startsAt, endsAt: shift.endsAt,
      duty: memberIndex === 0 ? 'リーダー' : memberIndex === 1 ? '受け持ち' : 'フリー', status: shift.code === 'day' ? 'on-duty' : 'scheduled',
      dataClassification: 'FICTIONAL_DEMO', version: 1
    }));
  }));

  const patientAssignments = admissions.flatMap((admission, index) => {
    const wardNurses = nurses.filter((staff) => staff.department === admission.ward);
    const physician = staffMembers.find((staff) => staff.id === admission.attendingPhysicianId);
    return [
      { staff: physician, assignmentType: '主治医', shiftCode: 'continuous', responsibility: '診療計画・指示・説明' },
      { staff: wardNurses[(index + 1) % 3], assignmentType: '日勤受け持ち', shiftCode: 'day', responsibility: '観察・ケア・記録・指示受け' },
      { staff: wardNurses[3 + ((index + 1) % 3)], assignmentType: '準夜受け持ち', shiftCode: 'evening', responsibility: '継続観察・申し送り' },
      { staff: wardNurses[6 + ((index + 1) % 3)], assignmentType: '深夜受け持ち', shiftCode: 'night', responsibility: '夜間観察・急変対応' }
    ].map(({ staff, assignmentType, shiftCode, responsibility }, memberIndex) => ({
      id: `PASSIGN-${String(index + 1).padStart(3, '0')}-${memberIndex + 1}`, patientId: admission.patientId, admissionId: admission.id,
      staffId: staff.id, staffName: staff.name, profession: staff.role, ward: admission.ward, assignmentType, shiftCode, responsibility,
      startsAt: shiftCode === 'continuous' ? beds.find((item) => item.id === admission.bedId)?.admittedAt : shiftTemplates.find((item) => item.code === shiftCode).startsAt,
      endsAt: shiftCode === 'continuous' ? null : shiftTemplates.find((item) => item.code === shiftCode).endsAt,
      status: 'active', dataClassification: 'FICTIONAL_DEMO', version: 1
    }));
  });

  for (const admission of admissions) {
    const assignedNurse = patientAssignments.find((item) => item.admissionId === admission.id && item.shiftCode === 'day');
    const context = patientContexts.find((item) => item.patientId === admission.patientId);
    const team = careTeams.find((item) => item.patientId === admission.patientId);
    if (assignedNurse && context && team) {
      context.careTeam[1] = assignedNurse.staffName;
      team.members[1] = { staffId: assignedNurse.staffId, name: assignedNurse.staffName, role: '担当看護師', profession: 'nurse' };
    }
  }

  const handoffs = admissions.flatMap((admission, index) => {
    const assignments = patientAssignments.filter((item) => item.admissionId === admission.id && item.profession === 'nurse');
    const patient = patients.find((item) => item.id === admission.patientId);
    return [
      { from: assignments.find((item) => item.shiftCode === 'day'), to: assignments.find((item) => item.shiftCode === 'evening'), at: '2026-09-11T16:35:00+09:00', status: index % 4 === 0 ? 'pending' : 'acknowledged' },
      { from: assignments.find((item) => item.shiftCode === 'evening'), to: assignments.find((item) => item.shiftCode === 'night'), at: '2026-09-12T00:35:00+09:00', status: 'scheduled' }
    ].map((handoff, handoffIndex) => ({
      id: `HAND-${String(index + 1).padStart(3, '0')}-${handoffIndex + 1}`, patientId: admission.patientId, admissionId: admission.id, ward: admission.ward,
      fromStaffId: handoff.from.staffId, fromStaffName: handoff.from.staffName, toStaffId: handoff.to.staffId, toStaffName: handoff.to.staffName,
      situation: `${patient.name}：${patient.alerts[0] || '特記事項なし'}、本日の状態は安定（架空）`,
      background: `${admission.carePath}、持参薬：${admission.broughtMedications}`, assessment: index % 3 === 0 ? '転倒リスクあり。移動時見守りを継続' : 'バイタル安定。計画どおり観察継続',
      recommendation: '指示と翌日の検査予定を確認し、変化時は当直医へ報告', scheduledAt: handoff.at, status: handoff.status,
      acknowledgedAt: handoff.status === 'acknowledged' ? handoff.at : null, dataClassification: 'FICTIONAL_DEMO', version: 1
    }));
  });

  const clinicalInstructions = admissions.flatMap((admission, index) => {
    const physician = staffMembers.find((staff) => staff.id === admission.attendingPhysicianId);
    const nurse = patientAssignments.find((item) => item.admissionId === admission.id && item.shiftCode === 'day');
    return [
      { instructionType: '観察指示', content: '体温・血圧・脈拍・SpO2を各勤務帯で測定し、基準外は報告（架空）', priority: 'routine', status: index % 4 === 0 ? 'accepted' : 'completed' },
      { instructionType: index % 2 === 0 ? '転倒予防指示' : '服薬確認指示', content: index % 2 === 0 ? '移動時見守りとナースコール使用を確認（架空）' : '持参薬と院内処方の重複を確認（架空）', priority: index % 5 === 0 ? 'urgent' : 'routine', status: 'accepted' }
    ].map((instruction, instructionIndex) => ({
      id: `INST-${String(index + 1).padStart(3, '0')}-${instructionIndex + 1}`, patientId: admission.patientId, admissionId: admission.id,
      authorStaffId: physician.id, authorName: physician.name, assignedStaffId: nurse.staffId, assignedStaffName: nurse.staffName,
      ...instruction, orderedAt: '2026-09-11T08:10:00+09:00', dueAt: instructionIndex === 0 ? '2026-09-11T17:00:00+09:00' : '2026-09-11T12:00:00+09:00',
      acknowledgedAt: '2026-09-11T08:20:00+09:00', completedAt: instruction.status === 'completed' ? '2026-09-11T10:00:00+09:00' : null,
      result: instruction.status === 'completed' ? '指示内容を実施し記録済み（架空）' : '', dataClassification: 'FICTIONAL_DEMO', version: 1
    }));
  });

  const teamConferences = admissions.map((admission, index) => {
    const team = careTeams.find((item) => item.patientId === admission.patientId);
    const dietitian = staffMembers.find((staff) => staff.role === 'dietitian');
    const socialWorker = staffMembers.find((staff) => staff.role === 'social-worker');
    return {
      id: `CONF-${String(index + 1).padStart(3, '0')}`, patientId: admission.patientId, admissionId: admission.id,
      title: index % 3 === 0 ? '入退院支援カンファレンス' : '多職種病棟カンファレンス',
      scheduledAt: `2026-09-${String(11 + (index % 5)).padStart(2, '0')}T13:30:00+09:00`, status: index % 4 === 0 ? 'planned' : 'completed',
      participants: [...team.members, { staffId: dietitian.id, name: dietitian.name, role: '管理栄養士' }, { staffId: socialWorker.id, name: socialWorker.name, role: '医療ソーシャルワーカー' }],
      agenda: ['現在の治療・看護上の課題', 'ADL・服薬・栄養', '退院先と支援者'],
      decisions: index % 4 === 0 ? [] : ['退院目標日を継続', '家族説明と地域連携を準備（架空）'],
      facilitatorStaffId: team.members[1].staffId, dataClassification: 'FICTIONAL_DEMO', version: 1
    };
  });

  const nursingRecords = admissions.flatMap((admission, index) => [
    { id: `NUR-${index + 1}-V`, patientId: admission.patientId, admissionId: admission.id, type: '経過表', title: 'バイタル・患者状態', content: `体温36.${4 + (index % 4)}℃、脈拍${64 + index}、SpO2 ${96 + (index % 3)}%、食事摂取${70 + (index % 4) * 10}%（架空）`, status: 'signed', author: patientAssignments.find((item) => item.admissionId === admission.id && item.shiftCode === 'day').staffName, recordedAt: '2026-09-11T08:30:00+09:00', version: 1 },
    { id: `NUR-${index + 1}-P`, patientId: admission.patientId, admissionId: admission.id, type: index % 3 === 0 ? '褥瘡評価' : '看護計画', title: index % 3 === 0 ? '褥瘡リスク評価' : '転倒予防計画', content: index % 3 === 0 ? 'DESIGN-R評価：皮膚観察と除圧を継続（架空）' : '移動時はナースコール使用、履物と動線を確認（架空）', status: 'draft', author: patientAssignments.find((item) => item.admissionId === admission.id && item.shiftCode === 'day').staffName, recordedAt: '2026-09-11T09:10:00+09:00', version: 1 },
    { id: `NUR-${index + 1}-T`, patientId: admission.patientId, admissionId: admission.id, type: '多職種連携', title: '本日のチーム共有', content: '医師・看護師・薬剤師・療法士で退院目標と服薬状況を共有（架空）', status: 'signed', author: patientAssignments.find((item) => item.admissionId === admission.id && item.shiftCode === 'day').staffName, recordedAt: '2026-09-11T10:00:00+09:00', version: 1 }
  ]).concat(patientContexts.filter((context) => context.careSetting === '在宅・訪問').map((context, index) => ({
    id: `NUR-HOME-${index + 1}`, patientId: context.patientId, admissionId: null, type: '訪問看護記録', title: '訪問時状態確認', content: '服薬、食事、排泄、皮膚状態を確認。家族へ連絡方法を説明（架空）', status: index % 2 === 0 ? 'signed' : 'draft', author: nurses.at(-1).name, authorStaffId: nurses.at(-1).id, recordedAt: '2026-09-11T11:00:00+09:00', version: 1
  })));
  nursingRecords.forEach((record) => {
    const author = staffMembers.find((staff) => staff.name === record.author) || nurses.at(-1);
    record.author = author.name;
    record.authorStaffId = author.id;
  });
  const users = staffMembers;
  const masters = [
    { id: 'MST-MED-001', category: '医薬品', code: '103831601', display: 'カルボシステイン錠250mg（架空）', active: true, version: 1 },
    { id: 'MST-LAB-001', category: '検査', code: '6690-2', display: '白血球数（架空）', active: true, version: 1 },
    { id: 'MST-MAT-001', category: '特定器材', code: 'DEMO-MAT-001', display: '人工関節材料（架空）', active: true, version: 1 },
    { id: 'MST-FEE-001', category: '医事', code: 'DEMO-FEE-001', display: '再診料（架空）', active: true, version: 1 }
  ];
  const inventory = [
    { id: 'INV-001', name: '滅菌ガーゼ（架空）', location: '中央材料室', stock: 84, reorderPoint: 30, lot: 'LOT-DEMO-01', expiresOn: '2027-03-31', version: 1 },
    { id: 'INV-002', name: '注射器10mL（架空）', location: '一般病棟3A', stock: 18, reorderPoint: 20, lot: 'LOT-DEMO-02', expiresOn: '2028-06-30', version: 1 }
  ];
  const incidents = [
    { id: 'SAFE-001', patientId: patients[0].id, severity: 'level-0', category: '転倒・転落', title: 'ベッド柵位置のヒヤリハット（架空）', status: 'reviewing', reporter: '山田 看護師', reportedAt: '2026-09-11T07:50:00+09:00', version: 1 }
  ];
  const documentTemplates = [
    { id: 'TPL-001', category: '同意書', title: '検査・処置同意書（架空ひな形）', active: true, version: 1 },
    { id: 'TPL-002', category: '診療計画', title: '入院診療計画書（架空ひな形）', active: true, version: 1 },
    { id: 'TPL-003', category: '看護', title: '看護計画（架空ひな形）', active: true, version: 1 }
  ];
  return {
    hospitalProfile, organizationUnits, staffMembers, activities, beds, admissions, nursingRecords, patientContexts, patientConsents,
    careTeams, shiftAssignments, patientAssignments, handoffs, clinicalInstructions, teamConferences,
    users, masters, inventory, incidents, documentTemplates
  };
}

export function allowedTransitions(status) {
  return ({ requested: ['accepted', 'cancelled'], accepted: ['in-progress', 'cancelled'], 'in-progress': ['completed', 'cancelled'], completed: ['approved'], approved: [], cancelled: [] })[status] || [];
}
