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
    if (coordinates.length < 2)
        throw new Error("demo route requires at least two coordinates");
    const normalizedProgress = Math.max(0, Math.min(1, progress));
    const lengths = coordinates.slice(1).map((coordinate, index) => segmentLength(coordinates[index], coordinate));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    if (total <= 0)
        throw new Error("demo route length must be positive");
    let remaining = total * normalizedProgress;
    for (const [index, length] of lengths.entries()) {
        const from = coordinates[index];
        const to = coordinates[index + 1];
        if (remaining <= length || index === lengths.length - 1) {
            const ratio = length === 0 ? 0 : Math.min(1, remaining / length);
            return {
                coordinate: [
                    from[0] + (to[0] - from[0]) * ratio,
                    from[1] + (to[1] - from[1]) * ratio,
                ],
                bearing: bearing(from, to),
            };
        }
        remaining -= length;
    }
    return { coordinate: coordinates[coordinates.length - 1], bearing: 0 };
}
//# sourceMappingURL=continuousDemoDrive.js.map