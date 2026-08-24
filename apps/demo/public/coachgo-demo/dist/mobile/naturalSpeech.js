export const NATURAL_JAPANESE_SPEECH_SETTINGS = {
    lang: "ja-JP",
    rate: 0.9,
    pitch: 1,
    volume: 1,
};
function voiceQualityScore(voice) {
    const language = voice.lang.toLowerCase();
    const name = voice.name.normalize("NFKC").toLowerCase();
    if (!language.startsWith("ja") && !name.includes("japanese") && !name.includes("日本語"))
        return -1;
    let score = language === "ja-jp" ? 300 : 220;
    if (name.includes("natural"))
        score += 1_000;
    if (name.includes("premium"))
        score += 900;
    if (name.includes("enhanced"))
        score += 850;
    if (name.includes("nanami"))
        score += 700;
    if (name.includes("google 日本語"))
        score += 650;
    if (name.includes("kyoko"))
        score += 600;
    if (name.includes("otoya"))
        score += 580;
    if (name.includes("ayumi"))
        score += 520;
    if (name.includes("haruka"))
        score += 500;
    if (name.includes("microsoft"))
        score += 180;
    if (name.includes("google"))
        score += 160;
    if (voice.default)
        score += 20;
    return score;
}
export function selectNaturalJapaneseVoice(voices) {
    let selected = null;
    let selectedScore = -1;
    for (const voice of voices) {
        const score = voiceQualityScore(voice);
        if (score > selectedScore) {
            selected = voice;
            selectedScore = score;
        }
    }
    return selected;
}
//# sourceMappingURL=naturalSpeech.js.map