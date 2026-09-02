import { createSessionUserHazardPoint, USER_REPORT_CATEGORIES, } from "./hazardMap.js?v=20260902-1";
const categoryIds = new Set(USER_REPORT_CATEGORIES.map((category) => category.id));
function isRecord(value) {
    return typeof value === "object" && value !== null;
}
function parseSharedUserReport(value) {
    if (!isRecord(value))
        return null;
    if (typeof value.id !== "string"
        || typeof value.category !== "string"
        || !categoryIds.has(value.category)
        || typeof value.longitude !== "number"
        || !Number.isFinite(value.longitude)
        || value.longitude < -180
        || value.longitude > 180
        || typeof value.latitude !== "number"
        || !Number.isFinite(value.latitude)
        || value.latitude < -90
        || value.latitude > 90
        || typeof value.createdAt !== "string"
        || typeof value.expiresAt !== "string"
        || typeof value.ownedByCurrentDevice !== "boolean")
        return null;
    return value;
}
async function responseError(response) {
    const payload = await response.json().catch(() => null);
    const message = typeof payload?.message === "string" ? payload.message : `HTTP ${response.status}`;
    return new Error(message);
}
export async function loadSharedUserReports(apiUrl, ownerToken, fetcher = fetch) {
    const response = await fetcher(apiUrl, {
        headers: { accept: "application/json", "x-coachgo-owner-token": ownerToken },
        cache: "no-store",
    });
    if (!response.ok)
        throw await responseError(response);
    const value = await response.json();
    if (!isRecord(value) || !Array.isArray(value.reports) || typeof value.refreshedAt !== "string") {
        throw new Error("共有投稿サーバーの応答形式が正しくありません");
    }
    const reports = value.reports.map(parseSharedUserReport);
    if (reports.some((report) => report === null))
        throw new Error("共有投稿データが正しくありません");
    return { reports: reports, refreshedAt: value.refreshedAt };
}
export async function createSharedUserReport(apiUrl, ownerToken, category, coordinates, fetcher = fetch) {
    const response = await fetcher(apiUrl, {
        method: "POST",
        headers: { accept: "application/json", "content-type": "application/json" },
        body: JSON.stringify({ ownerToken, category, longitude: coordinates[0], latitude: coordinates[1] }),
    });
    if (!response.ok)
        throw await responseError(response);
    const report = parseSharedUserReport(await response.json());
    if (report === null)
        throw new Error("登録結果が正しくありません");
    return report;
}
export async function deleteSharedUserReport(apiUrl, ownerToken, reportId, fetcher = fetch) {
    const response = await fetcher(`${apiUrl}/${encodeURIComponent(reportId)}`, {
        method: "DELETE",
        headers: { "x-coachgo-owner-token": ownerToken },
    });
    if (!response.ok)
        throw await responseError(response);
}
export function sharedUserReportHazard(report) {
    return {
        ...createSessionUserHazardPoint({
            id: report.id,
            category: report.category,
            longitude: report.longitude,
            latitude: report.latitude,
        }),
        note: `ユーザー投稿・未確認（${new Date(report.createdAt).toLocaleString("ja-JP")}登録）`,
    };
}
//# sourceMappingURL=sharedUserReports.js.map