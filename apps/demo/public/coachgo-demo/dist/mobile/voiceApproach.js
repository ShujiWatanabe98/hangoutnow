const earthRadiusMeters = 6_371_000;
export const routePassageCorridorMeters = 75;
export function distanceBetweenCoordinatesMeters(from, to) {
    const latitude1 = from[1] * Math.PI / 180;
    const latitude2 = to[1] * Math.PI / 180;
    const latitudeDelta = (to[1] - from[1]) * Math.PI / 180;
    const longitudeDelta = (to[0] - from[0]) * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
function localMeters(coordinate, origin) {
    const radiansPerDegree = Math.PI / 180;
    const meanLatitude = (coordinate[1] + origin[1]) / 2 * radiansPerDegree;
    return [
        (coordinate[0] - origin[0]) * radiansPerDegree * earthRadiusMeters * Math.cos(meanLatitude),
        (coordinate[1] - origin[1]) * radiansPerDegree * earthRadiusMeters,
    ];
}
function projectCoordinateToRoute(coordinate, route) {
    if (route.length < 2)
        return null;
    let best = null;
    let distanceBeforeSegmentMeters = 0;
    for (let index = 0; index < route.length - 1; index += 1) {
        const from = route[index];
        const to = route[index + 1];
        const segmentLengthMeters = distanceBetweenCoordinatesMeters(from, to);
        if (segmentLengthMeters === 0)
            continue;
        const [segmentX, segmentY] = localMeters(to, from);
        const [pointX, pointY] = localMeters(coordinate, from);
        const squaredSegmentLength = segmentX ** 2 + segmentY ** 2;
        const ratio = Math.max(0, Math.min(1, (pointX * segmentX + pointY * segmentY) / squaredSegmentLength));
        const projectedX = segmentX * ratio;
        const projectedY = segmentY * ratio;
        const distanceFromRouteMeters = Math.hypot(pointX - projectedX, pointY - projectedY);
        const projection = {
            distanceAlongRouteMeters: distanceBeforeSegmentMeters + segmentLengthMeters * ratio,
            distanceFromRouteMeters,
        };
        if (best === null || projection.distanceFromRouteMeters < best.distanceFromRouteMeters)
            best = projection;
        distanceBeforeSegmentMeters += segmentLengthMeters;
    }
    return best;
}
export function nearbyMonitoredPoints(location, route, points, selectedCategories, passageCorridorMeters = routePassageCorridorMeters) {
    const currentProjection = projectCoordinateToRoute(location, route);
    if (currentProjection === null)
        return [];
    return points.flatMap((point) => {
        if (!selectedCategories.has(point.monitorCategory))
            return [];
        const pointProjection = projectCoordinateToRoute([point.longitude, point.latitude], route);
        if (pointProjection === null || pointProjection.distanceFromRouteMeters > passageCorridorMeters)
            return [];
        const distanceMeters = pointProjection.distanceAlongRouteMeters - currentProjection.distanceAlongRouteMeters;
        return distanceMeters >= 0 && distanceMeters <= point.alertDistanceMeters
            ? [{ point, distanceMeters, distanceFromRouteMeters: pointProjection.distanceFromRouteMeters }]
            : [];
    }).sort((left, right) => left.distanceMeters - right.distanceMeters);
}
export function voiceApproachMessage(point) {
    if (point.kind === "UNDERPASS") {
        return `この先に、道路冠水の監視地点があります。${point.name}付近です。大雨のときは、無理に進入せず、道路の状況を確認してください。`;
    }
    if (point.kind === "POLICE_PRIORITY") {
        return `この先は、警察が公開している交通安全の重点地点です。${point.name}付近です。現在の取り締まりを示す情報ではありません。安全運転をお願いします。`;
    }
    const labels = {
        RIVER_FLOODING: "河川氾濫",
        LANDSLIDE: "土砂災害",
        TSUNAMI: "津波",
    };
    return `この先に、${labels[point.monitorCategory] ?? "危険"}の監視地点があります。${point.name}付近です。周囲の状況に、十分注意してください。`;
}
//# sourceMappingURL=voiceApproach.js.map
