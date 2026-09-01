import { userLocationDistanceMeters } from "./smoothUserLocation.js";
export const SAME_USER_REPORT_RADIUS_METERS = 50;
export function aggregateNearbyUserReports(reports, radiusMeters = SAME_USER_REPORT_RADIUS_METERS) {
    const groups = [];
    for (const report of reports) {
        if (report.sourceKind !== "USER_REPORT")
            continue;
        const nearby = groups.find((group) => (group.representative.category === report.category
            && userLocationDistanceMeters([group.representative.longitude, group.representative.latitude], [report.longitude, report.latitude]) <= radiusMeters));
        if (nearby === undefined) {
            groups.push({ representative: report, reportIds: [report.id] });
        }
        else {
            nearby.reportIds.push(report.id);
        }
    }
    return groups.map((group) => ({
        representative: group.representative,
        count: group.reportIds.length,
        reportIds: group.reportIds,
    }));
}
//# sourceMappingURL=userReportAggregation.js.map