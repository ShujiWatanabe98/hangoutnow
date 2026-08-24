function isHttps(value) {
    if (typeof value !== "string")
        return false;
    try {
        return new URL(value).protocol === "https:";
    }
    catch {
        return false;
    }
}
function isValidCoordinate(value) {
    return Array.isArray(value)
        && value.length === 2
        && Number.isFinite(value[0])
        && Number.isFinite(value[1])
        && value[0] >= 20
        && value[0] <= 46
        && value[1] >= 122
        && value[1] <= 154;
}
function validatePublicUnderpassFeed(value) {
    if (value === null || typeof value !== "object")
        throw new Error("underpass feed must be an object");
    const feed = value;
    if (feed.schemaVersion !== 1 || !Array.isArray(feed.items) || !isHttps(feed.sourceIndexUrl)) {
        throw new Error("unsupported underpass feed contract");
    }
    if (feed.coverage === undefined
        || feed.coverage.requestedPrefectures !== feed.coverage.importedPrefectures
        || !Array.isArray(feed.coverage.failedPrefectures)
        || feed.coverage.failedPrefectures.length !== 0
        || feed.coverage.itemCount !== feed.items.length) {
        throw new Error("underpass feed is incomplete or its summary does not match items");
    }
    const invalidItems = feed.items.filter((item) => item.type !== "UNDERPASS"
        || item.active !== true
        || typeof item.id !== "string"
        || typeof item.name !== "string"
        || typeof item.prefectureCode !== "string"
        || !isValidCoordinate(item.coordinate)
        || !isHttps(item.sourceKmlUrl)
        || !Number.isFinite(item.warningLeadDistanceMeters)
        || item.warningLeadDistanceMeters <= 0);
    if (invalidItems.length > 0)
        throw new Error(`underpass feed contains ${invalidItems.length} invalid items`);
    return feed;
}
export function buildNationalUnderpassMapPayload(value) {
    const feed = validatePublicUnderpassFeed(value);
    const underpasses = feed.items.map((point) => ({
        id: point.id,
        kind: "UNDERPASS",
        monitorCategory: "ROAD_FLOODING",
        name: point.name,
        longitude: point.coordinate[1],
        latitude: point.coordinate[0],
        sourceOrganization: point.sourceOrganization,
        sourceUpdatedAt: point.sourceUpdatedAt,
        evidence: "国土交通省の道路冠水想定箇所",
        note: "現在の冠水情報ではありません。大雨時は進入前に道路管理者などの公的情報を確認してください。",
    }));
    return {
        schemaVersion: 1,
        generatedAt: feed.generatedAt,
        scope: { prefectureCode: "ALL", prefectureName: "全国" },
        counts: { underpasses: underpasses.length, policePriorityLocations: 0 },
        attribution: {
            underpasses: "国土交通省 道路防災情報WEBマップを加工して表示",
            police: "",
        },
        limitations: [
            "道路冠水想定箇所であり、現在の冠水状況ではありません。",
            feed.coverage.note,
        ],
        items: underpasses,
    };
}
//# sourceMappingURL=divertNaviUnderpasses.js.map