export const YOKOHAMA_STATION = [139.622, 35.4662];
export const HON_ATSUGI_STATION = [139.3629, 35.4393];
export const FALLBACK_YOKOHAMA_TO_HON_ATSUGI_ROUTE = [
    YOKOHAMA_STATION,
    [139.606, 35.464],
    [139.578, 35.465],
    [139.548, 35.464],
    [139.518, 35.462],
    [139.486, 35.458],
    [139.454, 35.452],
    [139.422, 35.446],
    [139.392, 35.442],
    HON_ATSUGI_STATION,
];
export function screenRelativeBearing(vehicleBearing, mapBearing) {
    if (!Number.isFinite(vehicleBearing) || !Number.isFinite(mapBearing)) {
        throw new Error("bearings must be finite");
    }
    return ((vehicleBearing - mapBearing + 540) % 360) - 180;
}
export function advanceDemoProgress(progress, elapsedMilliseconds, durationMilliseconds, running) {
    if (!running)
        return progress;
    if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0) {
        throw new Error("demo duration must be positive");
    }
    const elapsed = Math.max(0, elapsedMilliseconds);
    return (progress + elapsed / durationMilliseconds) % 1;
}
function isCoordinate(value) {
    return Array.isArray(value)
        && value.length >= 2
        && typeof value[0] === "number"
        && typeof value[1] === "number"
        && Number.isFinite(value[0])
        && Number.isFinite(value[1])
        && value[0] >= 138
        && value[0] <= 141
        && value[1] >= 34
        && value[1] <= 37;
}
export function parseMapboxDrivingRoute(value) {
    if (value === null || typeof value !== "object")
        throw new Error("Directions response is invalid");
    const response = value;
    const coordinates = response.routes?.[0]?.geometry?.coordinates;
    if (response.code !== "Ok"
        || response.routes?.[0]?.geometry?.type !== "LineString"
        || !Array.isArray(coordinates)
        || coordinates.length < 2
        || !coordinates.every(isCoordinate)) {
        throw new Error("Directions route geometry is unavailable");
    }
    return coordinates;
}
function segmentLength(from, to) {
    const meanLatitudeRadians = ((from[1] + to[1]) / 2) * Math.PI / 180;
    const longitude = (to[0] - from[0]) * Math.cos(meanLatitudeRadians);
    const latitude = to[1] - from[1];
    return Math.hypot(longitude, latitude);
}
function bearing(from, to) {
    const longitude = (to[0] - from[0]) * Math.cos(((from[1] + to[1]) / 2) * Math.PI / 180);
    const latitude = to[1] - from[1];
    return Math.atan2(longitude, latitude) * 180 / Math.PI;
}
export function demoRoutePositionAt(coordinates, progress) {
    return createDemoRouteSampler(coordinates).positionAt(progress);
}
export function createDemoRouteSampler(coordinates) {
    if (coordinates.length < 2)
        throw new Error("demo route requires at least two coordinates");
    const segments = coordinates.slice(1).flatMap((coordinate, index) => {
        const from = coordinates[index];
        const length = segmentLength(from, coordinate);
        return length === 0 ? [] : [{ from, to: coordinate, length }];
    });
    const total = segments.reduce((sum, segment) => sum + segment.length, 0);
    if (total <= 0)
        throw new Error("demo route length must be positive");
    const cumulativeEnds = [];
    let cumulativeLength = 0;
    for (const segment of segments) {
        cumulativeLength += segment.length;
        cumulativeEnds.push(cumulativeLength);
    }
    return {
        positionAt(progress) {
            const target = total * Math.max(0, Math.min(1, progress));
            let low = 0;
            let high = cumulativeEnds.length - 1;
            while (low < high) {
                const middle = Math.floor((low + high) / 2);
                if (cumulativeEnds[middle] < target)
                    low = middle + 1;
                else
                    high = middle;
            }
            const segment = segments[low];
            const distanceBefore = low === 0 ? 0 : cumulativeEnds[low - 1];
            const ratio = Math.max(0, Math.min(1, (target - distanceBefore) / segment.length));
            return {
                coordinate: [
                    segment.from[0] + (segment.to[0] - segment.from[0]) * ratio,
                    segment.from[1] + (segment.to[1] - segment.from[1]) * ratio,
                ],
                bearing: bearing(segment.from, segment.to),
            };
        }
    };
}
//# sourceMappingURL=continuousDemoDrive.js.map