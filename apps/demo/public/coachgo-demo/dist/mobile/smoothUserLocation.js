export const STATIONARY_DISTANCE_METERS = 8;
export const MIN_LOCATION_ANIMATION_MS = 500;
export const MAX_LOCATION_ANIMATION_MS = 1_400;
const earthRadiusMeters = 6_371_000;
export function userLocationDistanceMeters(from, to) {
    const latitude1 = from[1] * Math.PI / 180;
    const latitude2 = to[1] * Math.PI / 180;
    const latitudeDelta = (to[1] - from[1]) * Math.PI / 180;
    const longitudeDelta = (to[0] - from[0]) * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
export function shouldAnimateUserLocation(from, to, stationaryDistanceMeters = STATIONARY_DISTANCE_METERS) {
    return userLocationDistanceMeters(from, to) >= stationaryDistanceMeters;
}
export function userLocationMovementBearing(from, to) {
    const fromLatitude = from[1] * Math.PI / 180;
    const toLatitude = to[1] * Math.PI / 180;
    const longitudeDelta = (to[0] - from[0]) * Math.PI / 180;
    const y = Math.sin(longitudeDelta) * Math.cos(toLatitude);
    const x = Math.cos(fromLatitude) * Math.sin(toLatitude)
        - Math.sin(fromLatitude) * Math.cos(toLatitude) * Math.cos(longitudeDelta);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}
export function userLocationAnimationDuration(distanceMeters) {
    if (!Number.isFinite(distanceMeters) || distanceMeters < 0) {
        throw new Error("location distance must be a non-negative finite number");
    }
    return Math.max(MIN_LOCATION_ANIMATION_MS, Math.min(MAX_LOCATION_ANIMATION_MS, distanceMeters * 35));
}
function smoothStep(progress) {
    const bounded = Math.max(0, Math.min(1, progress));
    return bounded * bounded * (3 - 2 * bounded);
}
export function interpolateUserLocation(from, to, progress) {
    const eased = smoothStep(progress);
    return [
        from[0] + (to[0] - from[0]) * eased,
        from[1] + (to[1] - from[1]) * eased,
    ];
}
export function screenRelativeUserHeading(heading, mapBearing) {
    if (!Number.isFinite(heading) || !Number.isFinite(mapBearing)) {
        throw new Error("headings must be finite");
    }
    return ((heading - mapBearing + 540) % 360) - 180;
}
//# sourceMappingURL=smoothUserLocation.js.map