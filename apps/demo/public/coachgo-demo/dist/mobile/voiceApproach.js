const earthRadiusMeters = 6_371_000;
export function distanceBetweenCoordinatesMeters(from, to) {
    const latitude1 = from[1] * Math.PI / 180;
    const latitude2 = to[1] * Math.PI / 180;
    const latitudeDelta = (to[1] - from[1]) * Math.PI / 180;
    const longitudeDelta = (to[0] - from[0]) * Math.PI / 180;
    const haversine = Math.sin(latitudeDelta / 2) ** 2
        + Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
export function nearbyMonitoredPoints(location, points, selectedCategories) {
    return points.flatMap((point) => {
        if (!selectedCategories.has(point.monitorCategory))
            return [];
        const distanceMeters = distanceBetweenCoordinatesMeters(location, [point.longitude, point.latitude]);
        return distanceMeters <= point.alertDistanceMeters ? [{ point, distanceMeters }] : [];
    }).sort((left, right) => left.distanceMeters - right.distanceMeters);
}
export function voiceApproachMessage(point) {
    if (point.kind === "UNDERPASS") {
        return `この先は、道路冠水の監視地点です。${point.name}付近です。大雨のときは進入せず、道路の状況を確認してください。`;
    }
    if (point.kind === "POLICE_PRIORITY") {
        return `この先は、警察が公開する交通安全の重点地点です。${point.name}付近です。現在の取り締まり情報ではありません。交通ルールを守って走行してください。`;
    }
    const labels = {
        RIVER_FLOODING: "河川氾濫",
        LANDSLIDE: "土砂災害",
        TSUNAMI: "津波",
    };
    return `この先は、${labels[point.monitorCategory] ?? "危険"}の監視地点です。${point.name}付近です。周囲の状況に注意してください。`;
}
//# sourceMappingURL=voiceApproach.js.map