export const DIAGNOSIS_OPTIONS = [
  "脳卒中（脳梗塞・脳出血）",
  "パーキンソン病",
  "脊髄損傷",
  "脳性麻痺",
  "神経・筋疾患",
  "関節・整形外科疾患",
  "その他・診断名不明",
] as const;

export type SuggestionContext =
  | "registration_symptom"
  | "registration_goal"
  | "intake_chief_complaint"
  | "intake_medical_history"
  | "intake_medications";

const commonSymptoms = [
  "歩くときに足が前へ出にくく、つまずきそうになることがあります。",
  "立ち上がりや歩き始めに不安定さを感じます。",
  "長く歩くと疲れやすく、途中で休憩が必要です。",
  "屋外や人の多い場所を歩くことに不安があります。",
  "段差や階段の上り下りに不安があります。",
  "歩くときに体のバランスを崩しやすいです。",
  "転倒への不安があり、外出を控えることがあります。",
  "足腰に力が入りにくく、歩行に介助が必要です。",
];

const symptomsByDiagnosis: Record<string, string[]> = {
  "脳卒中（脳梗塞・脳出血）": [
    "歩くときに片側の足が前へ出にくいです。",
    "片側の足に力が入りにくく、つまずくことがあります。",
    "立ち上がりや方向転換でバランスを崩しやすいです。",
    "歩くときに足先が床へ引っかかることがあります。",
  ],
  "パーキンソン病": [
    "歩き始めの一歩が出にくいことがあります。",
    "歩幅が小さくなり、足がすくむことがあります。",
    "方向転換や狭い場所で歩きにくさを感じます。",
    "姿勢が前かがみになり、歩く速さを調整しにくいです。",
  ],
  "脊髄損傷": [
    "足に力が入りにくく、立った姿勢を保つことが難しいです。",
    "立ち上がりや移乗に介助が必要です。",
    "歩くときに足の感覚がわかりにくいことがあります。",
    "長く立つと足腰が疲れやすいです。",
  ],
  "脳性麻痺": [
    "歩くときに足が突っ張り、動かしにくいことがあります。",
    "姿勢を保ちながら歩くことが難しいです。",
    "左右の足の動きに差があり、歩行が不安定です。",
  ],
  "神経・筋疾患": [
    "足の筋力が低下し、歩く距離が短くなっています。",
    "疲れやすく、日によって歩きやすさが変わります。",
    "立ち上がりや階段で足に力が入りにくいです。",
  ],
  "関節・整形外科疾患": [
    "歩くときに膝や股関節に痛みを感じます。",
    "立ち上がりや階段で足腰に痛みがあります。",
    "痛みをかばうため、左右で歩き方が違います。",
  ],
};

const commonGoals = [
  "転倒への不安を減らし、安全に歩けるようになりたいです。",
  "杖を使って近所を歩けるようになりたいです。",
  "休まずに歩ける距離を少しずつ伸ばしたいです。",
  "玄関や室内の段差を安全に越えられるようになりたいです。",
  "一人で立ち上がり、移動できるようになりたいです。",
  "家族と一緒に買い物や外出を楽しみたいです。",
  "階段を安全に上り下りできるようになりたいです。",
  "歩くときの姿勢と左右のバランスを整えたいです。",
];

const goalsByDiagnosis: Record<string, string[]> = {
  "脳卒中（脳梗塞・脳出血）": [
    "動かしにくい側の足を前へ出しやすくしたいです。",
    "杖を使って屋外を安定して歩けるようになりたいです。",
    "方向転換や段差でふらつかないようになりたいです。",
  ],
  "パーキンソン病": [
    "歩き始めの一歩を出しやすくしたいです。",
    "歩幅を広げ、一定の速さで歩けるようになりたいです。",
    "足のすくみを減らし、安心して外出したいです。",
  ],
  "脊髄損傷": [
    "支えを使って立っていられる時間を伸ばしたいです。",
    "ベッドや椅子への移乗を自分で行えるようになりたいです。",
    "足に体重をかけながら歩く練習をしたいです。",
  ],
  "脳性麻痺": [
    "体の姿勢を整え、少ない介助で歩けるようになりたいです。",
    "足の突っ張りを抑えながら歩く練習をしたいです。",
  ],
  "神経・筋疾患": [
    "疲れを調整しながら、必要な移動を続けられるようになりたいです。",
    "今できている立ち上がりや歩行を長く保ちたいです。",
  ],
  "関節・整形外科疾患": [
    "足腰への負担を減らし、痛みを抑えて歩きたいです。",
    "左右へ均等に体重をかけて歩けるようになりたいです。",
  ],
};

const historySuggestions = [
  "これまでに大きな病気や手術を受けたことはありません。",
  "過去に入院や手術を受けたことがあります。詳細は当日お伝えします。",
  "高血圧の治療を受けています。",
  "糖尿病の治療を受けています。",
  "心臓や血管の病気で治療を受けたことがあります。",
  "骨折や関節の手術を受けたことがあります。",
  "既往歴がわからないため、お薬手帳や診療情報を持参します。",
];

const medicationSuggestions = [
  "現在、定期的に服用している薬はありません。",
  "現在服用している薬があります。お薬手帳を持参します。",
  "薬の名前がわからないため、当日に確認をお願いします。",
  "血圧を下げる薬を服用しています。",
  "血液を固まりにくくする薬を服用しています。",
  "痛み止めを服用しています。",
  "服薬内容は家族と確認して当日にお伝えします。",
];

const trendKeywords = ["歩", "立ち上が", "転倒", "段差", "階段", "買い物", "外出", "移乗", "杖", "足", "膝", "腰", "バランス", "姿勢", "疲れ", "痛み", "仕事", "通勤"];

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

export function calculateAge(birthDate?: string | null) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null;
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const passed = today.getUTCMonth() > birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() >= birth.getUTCDate());
  if (!passed) age -= 1;
  return age >= 0 && age <= 130 ? age : null;
}

export function buildRehabSuggestions({
  context,
  diagnosisName,
  age,
  cohortTexts = [],
  ownCondition,
  ownGoal,
}: {
  context: SuggestionContext;
  diagnosisName?: string | null;
  age?: number | null;
  cohortTexts?: string[];
  ownCondition?: string | null;
  ownGoal?: string | null;
}) {
  if (context === "intake_medical_history") return historySuggestions;
  if (context === "intake_medications") return medicationSuggestions;

  const isGoal = context === "registration_goal";
  const diagnosisCandidates = isGoal ? goalsByDiagnosis[diagnosisName ?? ""] : symptomsByDiagnosis[diagnosisName ?? ""];
  let candidates = [...(diagnosisCandidates ?? []), ...(isGoal ? commonGoals : commonSymptoms)];

  if (context === "intake_chief_complaint") {
    candidates = [
      ...(ownCondition?.trim() ? [`登録時の症状：${ownCondition.trim()}`] : []),
      ...(ownGoal?.trim() ? [`HALで実現したいこと：${ownGoal.trim()}`] : []),
      ...candidates,
    ];
  }

  if (age !== null && age !== undefined) {
    if (age >= 65) {
      candidates.unshift(isGoal ? "近所への外出や買い物を安全に続けたいです。" : "外出や買い物の途中で、足の疲れやふらつきを感じます。");
    } else if (age < 50) {
      candidates.unshift(isGoal ? "仕事や通勤に必要な距離を安定して歩けるようになりたいです。" : "仕事や通勤で長く歩くと、足の疲れや歩きにくさを感じます。");
    }
  }

  const evidence = cohortTexts.join(" ");
  const ranked = unique(candidates).map((text, index) => ({
    text,
    index,
    score: trendKeywords.reduce((score, keyword) => score + (evidence.includes(keyword) && text.includes(keyword) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index);

  return ranked.map(({ text }) => text).slice(0, 9);
}
