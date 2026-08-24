const VOICE_HAZARD_KEYWORDS = [
    { category: "FLOOD", keywords: ["道路冠水", "冠水", "水没", "浸水"] },
    { category: "ACCIDENT", keywords: ["交通事故", "事故", "衝突"] },
    { category: "ROADWORK", keywords: ["道路工事", "工事"] },
    { category: "POLICE", keywords: ["警察取締", "取り締まり", "取締まり", "取締"] },
    { category: "OBJECT", keywords: ["落下物", "障害物", "物が落ちて"] },
    { category: "BROKEN_DOWN", keywords: ["故障車", "車が故障", "故障した車"] },
    { category: "CONGESTION", keywords: ["交通渋滞", "渋滞", "混雑"] },
    { category: "ROAD_DAMAGE", keywords: ["道路陥没", "路面損傷", "道路の穴", "路面の穴", "陥没"] },
    { category: "HAIL", keywords: ["ひょう", "雹"] },
    { category: "HEAVY_RAIN", keywords: ["激しい雨", "大雨", "豪雨"] },
    { category: "STRONG_WIND", keywords: ["強風", "突風"] },
    { category: "HEAVY_SNOW", keywords: ["路面凍結", "豪雪", "凍結", "大雪"] },
    { category: "LOW_VISIBILITY", keywords: ["視界不良", "濃霧", "霧"] },
    { category: "ANIMAL", keywords: ["動物", "鹿", "シカ", "イノシシ"] },
    { category: "WRONG_WAY", keywords: ["逆走車", "逆走"] },
    { category: "SIGN_ISSUE", keywords: ["標識注意", "標識", "看板"] },
];
function normalizeTranscript(transcript) {
    return transcript.normalize("NFKC").toLowerCase().replace(/[\s、。,.!?！？・]/g, "");
}
export function recognizeVoiceHazardCategory(transcript) {
    const normalized = normalizeTranscript(transcript);
    if (normalized.length === 0)
        return null;
    for (const definition of VOICE_HAZARD_KEYWORDS) {
        for (const keyword of definition.keywords) {
            if (normalized.includes(normalizeTranscript(keyword))) {
                return { category: definition.category, matchedKeyword: keyword };
            }
        }
    }
    return null;
}
//# sourceMappingURL=voiceHazardReport.js.map