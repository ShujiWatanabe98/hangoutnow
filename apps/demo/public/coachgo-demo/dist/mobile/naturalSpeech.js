export const NATURAL_JAPANESE_SPEECH_SETTINGS = {
    lang: "ja-JP",
    rate: 1.08,
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
        score += 1_100;
    if (name.includes("neural"))
        score += 1_050;
    if (name.includes("premium"))
        score += 1_000;
    if (name.includes("enhanced"))
        score += 950;
    if (name.includes("online"))
        score += 500;
    if (name.includes("nanami"))
        score += 760;
    if (name.includes("keita"))
        score += 740;
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
    if (!voice.localService)
        score += 40;
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
export function createNaturalJapaneseSpeechPlan(message) {
    const sentences = message
        .match(/[^。！？]+[。！？]?/gu)
        ?.map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length > 0) ?? [];
    return sentences.map((text, index) => {
        const isLast = index === sentences.length - 1;
        const isPlaceName = /付近です[。！？]$/u.test(text);
        const isSafetyInstruction = /進入|確認|注意|安全運転|交通ルール/u.test(text);
        return {
            text,
            rate: isPlaceName ? 1 : isSafetyInstruction ? 1.03 : NATURAL_JAPANESE_SPEECH_SETTINGS.rate,
            pauseAfterMs: isLast ? 0 : isPlaceName ? 260 : 170,
        };
    });
}
//# sourceMappingURL=naturalSpeech.js.map