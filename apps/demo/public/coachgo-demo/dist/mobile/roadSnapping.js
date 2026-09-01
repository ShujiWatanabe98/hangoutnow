const MAXIMUM_ROAD_SNAP_DISTANCE_METERS = 100;
export async function snapReportLocationToRoad(coordinate, accessToken, fetcher = fetch) {
    const [longitude, latitude] = coordinate;
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || accessToken.trim() === "") {
        throw new Error("道路上の登録位置を確認できませんでした。");
    }
    const nearbyLongitude = Math.min(180, longitude + 0.00005);
    const coordinates = `${longitude.toFixed(6)},${latitude.toFixed(6)};${nearbyLongitude.toFixed(6)},${latitude.toFixed(6)}`;
    const query = new URLSearchParams({
        access_token: accessToken,
        alternatives: "false",
        geometries: "geojson",
        overview: "false",
        steps: "false",
        approaches: "unrestricted;unrestricted",
    });
    const response = await fetcher(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${query.toString()}`);
    if (!response.ok)
        throw new Error("近くの道路を確認できませんでした。通信状態を確認してください。");
    const payload = await response.json();
    const waypoint = payload.code === "Ok" ? payload.waypoints?.[0] : undefined;
    const snappedLongitude = waypoint?.location?.[0];
    const snappedLatitude = waypoint?.location?.[1];
    const distance = waypoint?.distance;
    if (typeof snappedLongitude !== "number"
        || typeof snappedLatitude !== "number"
        || typeof distance !== "number"
        || !Number.isFinite(snappedLongitude)
        || !Number.isFinite(snappedLatitude)
        || !Number.isFinite(distance)
        || distance > MAXIMUM_ROAD_SNAP_DISTANCE_METERS) {
        throw new Error("100m以内に登録できる道路がありません。地図を動かして道路上を指定してください。");
    }
    return [snappedLongitude, snappedLatitude];
}
export { MAXIMUM_ROAD_SNAP_DISTANCE_METERS };
//# sourceMappingURL=roadSnapping.js.map