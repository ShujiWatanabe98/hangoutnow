export const HAZARD_CATEGORIES = [
    {
        id: "ROAD_FLOODING",
        label: "道路冠水",
        description: "アンダーパスや低い道路",
        icon: "🌧️",
        selectedByDefault: true,
    },
    {
        id: "RIVER_FLOODING",
        label: "河川氾濫",
        description: "河川沿いの浸水想定",
        icon: "🌊",
        selectedByDefault: false,
    },
    {
        id: "LANDSLIDE",
        label: "土砂災害",
        description: "崖や急傾斜地の周辺",
        icon: "⛰️",
        selectedByDefault: false,
    },
    {
        id: "TSUNAMI",
        label: "津波",
        description: "沿岸部の浸水想定",
        icon: "🌊",
        selectedByDefault: false,
    },
    {
        id: "POLICE_ENFORCEMENT",
        label: "警察取締",
        description: "警察が公開する重点地点等",
        icon: "🚨",
        selectedByDefault: true,
    },
    {
        id: "RAIN_CLOUD",
        label: "雨雲",
        description: "RainViewerの雨雲レーダー",
        icon: "🌧️",
        selectedByDefault: true,
    },
];
export const USER_REPORT_CATEGORIES = [
    { id: "FLOOD", label: "冠水", icon: "🌊", color: "#008cff", primary: true },
    { id: "ACCIDENT", label: "事故", icon: "⚠️", color: "#ff4f5e", primary: true },
    { id: "ROADWORK", label: "工事", icon: "🚧", color: "#ffad00", primary: true },
    { id: "POLICE", label: "取り締まり", icon: "🚨", color: "#9b5cff", primary: true },
    { id: "OBJECT", label: "落下物", icon: "📦", color: "#e37a23", primary: true },
    { id: "BROKEN_DOWN", label: "故障車", icon: "🚙", color: "#e0574f", primary: true },
    { id: "CONGESTION", label: "渋滞", icon: "🚗", color: "#d9485f", primary: true },
    { id: "ROAD_DAMAGE", label: "路面損傷", icon: "🕳️", color: "#795548", primary: true },
    { id: "HAIL", label: "雹", icon: "🧊", color: "#7c63d9", primary: false },
    { id: "HEAVY_RAIN", label: "激しい雨", icon: "🌧️", color: "#3478d4", primary: false },
    { id: "STRONG_WIND", label: "強風", icon: "💨", color: "#1f9aaa", primary: false },
    { id: "HEAVY_SNOW", label: "豪雪・凍結", icon: "❄️", color: "#4e86d8", primary: false },
    { id: "LOW_VISIBILITY", label: "視界不良", icon: "🌫️", color: "#66788a", primary: false },
    { id: "ANIMAL", label: "動物", icon: "🦌", color: "#8a6b3f", primary: false },
    { id: "WRONG_WAY", label: "逆走車", icon: "⛔", color: "#d33939", primary: false },
    { id: "SIGN_ISSUE", label: "標識注意", icon: "🚸", color: "#d98b18", primary: false },
];
export const SYNTHETIC_HAZARD_POINTS = [
    {
        id: "synthetic-river-001",
        category: "RIVER_FLOODING",
        monitorCategory: "RIVER_FLOODING",
        name: "合成河川沿い区間",
        structure: "RIVER",
        distanceMeters: 1_200,
        longitude: 139.693,
        latitude: 35.699,
        evidenceLabel: "合成浸水想定区域",
        note: null,
        sourceKind: "SYNTHETIC_FIXTURE",
        verificationStatus: "FIXTURE_ONLY",
    },
    {
        id: "synthetic-slope-001",
        category: "LANDSLIDE",
        monitorCategory: "LANDSLIDE",
        name: "合成急傾斜地区間",
        structure: "SLOPE",
        distanceMeters: 2_100,
        longitude: 139.751,
        latitude: 35.704,
        evidenceLabel: "合成土砂災害警戒区域",
        note: null,
        sourceKind: "SYNTHETIC_FIXTURE",
        verificationStatus: "FIXTURE_ONLY",
    },
    {
        id: "synthetic-coast-001",
        category: "TSUNAMI",
        monitorCategory: "TSUNAMI",
        name: "合成沿岸区間",
        structure: "COAST",
        distanceMeters: 3_800,
        longitude: 139.744,
        latitude: 35.664,
        evidenceLabel: "合成津波浸水想定",
        note: null,
        sourceKind: "SYNTHETIC_FIXTURE",
        verificationStatus: "FIXTURE_ONLY",
    },
];
export function defaultSelectedCategories() {
    return new Set(HAZARD_CATEGORIES.filter((category) => category.selectedByDefault).map((category) => category.id));
}
export function filterHazardsByCategory(points, selectedCategories) {
    return points.filter((point) => point.sourceKind === "USER_REPORT" ||
        (point.monitorCategory !== null && selectedCategories.has(point.monitorCategory)));
}
export function buildApproachNotification(point) {
    if (point.sourceKind !== "USER_REPORT")
        return null;
    const policeDisclaimer = point.category === "POLICE"
        ? "現在の取締実施を示す情報ではありません。交通ルールを守って走行してください。"
        : "周囲の状況を確認してください。";
    return {
        title: "ユーザー登録の未確認地点に接近",
        body: `自分で登録した未確認の${point.name}があります。${policeDisclaimer}`,
        action: "SLOW_DOWN",
        productionEligible: false,
    };
}
export function buildHazardPointGuidance(point) {
    if (point.sourceKind === "USER_REPORT") {
        return buildApproachNotification(point).body;
    }
    if (point.category === "POLICE_ENFORCEMENT") {
        return "合成の警察公開重点地点です。現在の取締実施を示す情報ではありません。交通ルールを守って走行してください。";
    }
    if (point.structure === "UNDERPASS") {
        return "合成のアンダーパス地点です。大雨時は水深を確認できないため、実在する地点では公的情報を確認してください。";
    }
    return "選択した危険カテゴリーの合成表示地点です。実在する危険や現在の発生状況を示しません。";
}
export function createSessionUserHazardPoint(input) {
    const category = USER_REPORT_CATEGORIES.find((candidate) => candidate.id === input.category);
    if (category === undefined)
        throw new Error("unknown user report category");
    if (!Number.isFinite(input.longitude) ||
        !Number.isFinite(input.latitude) ||
        input.longitude < -180 ||
        input.longitude > 180 ||
        input.latitude < -90 ||
        input.latitude > 90) {
        throw new Error("user hazard map position must be a valid longitude and latitude");
    }
    return {
        id: input.id,
        category: input.category,
        monitorCategory: null,
        name: category.label,
        structure: "REPORTED",
        distanceMeters: 0,
        longitude: input.longitude,
        latitude: input.latitude,
        evidenceLabel: input.category === "POLICE"
            ? "ユーザー登録・未確認・現在の取締実施を示す情報ではありません"
            : "ユーザー登録・未確認",
        note: null,
        sourceKind: "USER_REPORT",
        verificationStatus: "UNVERIFIED",
    };
}
//# sourceMappingURL=hazardMap.js.map