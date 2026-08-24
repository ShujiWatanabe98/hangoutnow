import { buildApproachNotification, createSessionUserHazardPoint, defaultSelectedCategories, filterHazardsByCategory, HAZARD_CATEGORIES, SYNTHETIC_HAZARD_POINTS, USER_REPORT_CATEGORIES, } from "./hazardMap.js";
import { COACHGO_MAP_LANGUAGE, COACHGO_MAP_LOCALE, COACHGO_MAP_STYLE, COACHGO_WASHI_AURORA_CONFIG, } from "./mapboxStyle.js";
import { buildNationalUnderpassMapPayload } from "./divertNaviUnderpasses.js?v=20260824-1";
import { KANAGAWA_POLICE_PRIORITY_POINTS } from "./kanagawaPolicePoints.js?v=20260824-1";
import { advanceDemoProgress, demoRoutePositionAt, FALLBACK_YOKOHAMA_TO_HON_ATSUGI_ROUTE, HON_ATSUGI_STATION, parseMapboxDrivingRoute, YOKOHAMA_STATION, } from "./continuousDemoDrive.js?v=20260824-2";
import { nearbyMonitoredPoints, voiceApproachMessage, } from "./voiceApproach.js?v=20260824-4";
import { recognizeVoiceHazardCategory } from "./voiceHazardReport.js?v=20260824-1";
import { createNaturalJapaneseSpeechPlan, NATURAL_JAPANESE_SPEECH_SETTINGS, selectNaturalJapaneseVoice, } from "./naturalSpeech.js?v=20260824-2";
function syntheticSharedMapPayload() {
    return {
        schemaVersion: 1,
        generatedAt: "2026-08-23T00:00:00.000Z",
        scope: { prefectureCode: "13", prefectureName: "東京都・合成デモ" },
        counts: { underpasses: 1, policePriorityLocations: 1 },
        attribution: {
            underpasses: "CoachGo合成デモデータ",
            police: "CoachGo合成デモデータ",
        },
        limitations: [
            "実在地点、現在の冠水、現在の取締り実施を示すデータではありません。",
            "ホームページ公開版は外部データの再配布条件を確認するまで合成地点だけを表示します。",
        ],
        items: [
            {
                id: "synthetic-shared-underpass",
                kind: "UNDERPASS",
                monitorCategory: "ROAD_FLOODING",
                name: "合成アンダーパス区間",
                longitude: 139.715,
                latitude: 35.686,
                sourceOrganization: "CoachGo合成デモ",
                sourceUpdatedAt: null,
                evidence: "合成地点（実在地点ではありません）",
                note: "現在の冠水情報ではありません。大雨時は公的情報を確認してください。",
            },
            {
                id: "synthetic-shared-police",
                kind: "POLICE_PRIORITY",
                monitorCategory: "POLICE_ENFORCEMENT",
                name: "合成交通安全重点区間",
                longitude: 139.768,
                latitude: 35.676,
                sourceOrganization: "CoachGo合成デモ",
                sourceUpdatedAt: null,
                evidence: "合成地点（実在地点ではありません）",
                note: "現在の取締り実施を示す情報ではありません。交通ルールを守って走行してください。",
            },
        ],
    };
}
const SYNTHETIC_USER_LOCATION = [139.728, 35.681];
const categoryLabels = Object.fromEntries([...HAZARD_CATEGORIES, ...USER_REPORT_CATEGORIES].map((category) => [category.id, category.label]));
function requiredElement(selector) {
    const element = document.querySelector(selector);
    if (element === null)
        throw new Error(`missing demo element: ${selector}`);
    return element;
}
const categoryPanel = requiredElement("#category-panel");
const panelBackdrop = requiredElement("#panel-backdrop");
const mapLoadState = requiredElement("#map-load-state");
const sharedDataStatus = requiredElement("#shared-data-status");
const selectedCount = requiredElement("#selected-count");
const notificationPreview = requiredElement("#notification-preview");
const connectionState = requiredElement("#connection-state");
const registrationDialog = requiredElement("#registration-dialog");
const registrationError = requiredElement("#registration-error");
const voiceReportButton = requiredElement("#voice-report-start");
const voiceReportStatus = requiredElement("#voice-report-status");
const voiceReportTranscript = requiredElement("#voice-report-transcript");
const approachDetectionToggle = requiredElement("#approach-detection-toggle");
const approachDetectionState = requiredElement("#approach-detection-state");
const backgroundNotificationToggle = requiredElement("#background-notification-toggle");
const backgroundNotificationState = requiredElement("#background-notification-state");
const hazardVoiceToggle = requiredElement("#hazard-voice-toggle");
const hazardVoiceState = requiredElement("#hazard-voice-state");
const undoReportToast = requiredElement("#undo-report-toast");
const undoReportTitle = requiredElement("#undo-report-title");
const permissionStatusElement = requiredElement("#permission-status");
const demoPlaybackButton = requiredElement("#demo-playback");
const demoPlaybackLabel = requiredElement("#demo-playback-label");
const demoPlaybackStatus = requiredElement("#demo-playback-status");
const locationStatus = requiredElement("#location-status");
const rainViewerStatus = requiredElement("#rainviewer-status");
let map = null;
let initialMapLoadCompleted = false;
let initialMapLoadTimeout = null;
const mapMarkers = new Map();
const sessionUserReportMarkers = new Map();
let userLocationMarker = null;
const sharedDataMarkers = new Map();
const UNDERPASS_SOURCE_ID = "coachgo-underpasses";
const UNDERPASS_CLUSTER_LAYER_ID = "coachgo-underpass-clusters";
const UNDERPASS_CLUSTER_COUNT_LAYER_ID = "coachgo-underpass-cluster-count";
const UNDERPASS_POINT_LAYER_ID = "coachgo-underpass-points";
const ROAD_FLOODING_MARKER_IMAGE_ID = "coachgo-road-flooding-category-icon";
const RAINVIEWER_SOURCE_ID = "coachgo-rainviewer-radar";
const RAINVIEWER_LAYER_ID = "coachgo-rainviewer-radar-layer";
const RAINVIEWER_METADATA_URL = "https://api.rainviewer.com/public/weather-maps.json";
const DEMO_DRIVE_SOURCE_ID = "coachgo-yokohama-honatsugi-route";
const DEMO_DRIVE_CASING_LAYER_ID = "coachgo-yokohama-honatsugi-route-casing";
const DEMO_DRIVE_LAYER_ID = "coachgo-yokohama-honatsugi-route-line";
const DEMO_DRIVE_DURATION_MS = 60_000;
const selectedCategories = new Set(defaultSelectedCategories());
let selectedHazard = null;
let selectedSharedPoint = null;
let activeMapPopup = null;
let divertNaviMapData = null;
let sessionUserReports = [];
let approachDetectionEnabled = true;
let backgroundNotificationEnabled = true;
let hazardVoiceEnabled = true;
let reportSequence = 0;
let lastReportId = null;
let undoReportTimer = null;
let currentUserLocation = [...SYNTHETIC_USER_LOCATION];
let rainViewerLoading = null;
let demoDriveRoute = null;
let demoDriveMarker = null;
let demoVehicleGraphic = null;
let demoDriveAnimationStarted = false;
let demoDriveRunning = true;
let demoDriveProgress = 0;
let demoDriveLastFrameAt = null;
let lastVoiceProximityCheckAt = 0;
let lastVoiceAnnouncementAt = -Infinity;
let activeNearbyPointIds = new Set();
let activeVoiceRecognition = null;
let preferredJapaneseVoice = null;
let activeSpeechSequence = 0;
const VOICE_PROXIMITY_CHECK_INTERVAL_MS = 750;
const VOICE_ANNOUNCEMENT_COOLDOWN_MS = 12_000;
function refreshPreferredJapaneseVoice() {
    if (!("speechSynthesis" in window))
        return;
    preferredJapaneseVoice = selectNaturalJapaneseVoice(window.speechSynthesis.getVoices());
    demoPlaybackStatus.dataset.voiceName = preferredJapaneseVoice?.name ?? "browser-default-ja-JP";
}
function prepareNaturalJapaneseUtterance(utterance, rate) {
    const settings = NATURAL_JAPANESE_SPEECH_SETTINGS;
    const voice = preferredJapaneseVoice
        ?? selectNaturalJapaneseVoice(window.speechSynthesis.getVoices());
    utterance.lang = settings.lang;
    utterance.rate = rate;
    utterance.pitch = settings.pitch;
    utterance.volume = settings.volume;
    if (voice !== null) {
        preferredJapaneseVoice = voice;
        utterance.voice = voice;
        demoPlaybackStatus.dataset.voiceName = voice.name;
    }
    demoPlaybackStatus.dataset.voiceRate = String(rate);
}
function cancelNaturalJapaneseSpeech() {
    activeSpeechSequence += 1;
    if ("speechSynthesis" in window)
        window.speechSynthesis.cancel();
}
function speakNaturalJapanese(message) {
    if (!hazardVoiceEnabled) {
        demoPlaybackStatus.dataset.voiceState = "muted";
        return;
    }
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
        demoPlaybackStatus.dataset.voiceState = "unsupported";
        return;
    }
    const plan = createNaturalJapaneseSpeechPlan(message);
    const sequence = activeSpeechSequence + 1;
    activeSpeechSequence = sequence;
    window.speechSynthesis.cancel();
    demoPlaybackStatus.dataset.voiceSegmentCount = String(plan.length);
    const speakSegment = (index) => {
        if (sequence !== activeSpeechSequence)
            return;
        const segment = plan[index];
        if (segment === undefined) {
            demoPlaybackStatus.dataset.voiceState = "ready";
            return;
        }
        const utterance = new SpeechSynthesisUtterance(segment.text);
        prepareNaturalJapaneseUtterance(utterance, segment.rate);
        demoPlaybackStatus.dataset.voiceSegment = String(index + 1);
        utterance.onstart = () => {
            if (sequence === activeSpeechSequence)
                demoPlaybackStatus.dataset.voiceState = "speaking";
        };
        utterance.onend = () => {
            if (sequence !== activeSpeechSequence)
                return;
            if (segment.pauseAfterMs === 0) {
                speakSegment(index + 1);
                return;
            }
            window.setTimeout(() => { speakSegment(index + 1); }, segment.pauseAfterMs);
        };
        utterance.onerror = () => {
            if (sequence === activeSpeechSequence)
                demoPlaybackStatus.dataset.voiceState = "error";
        };
        window.speechSynthesis.speak(utterance);
    };
    speakSegment(0);
}
if ("speechSynthesis" in window) {
    refreshPreferredJapaneseVoice();
    window.speechSynthesis.addEventListener("voiceschanged", refreshPreferredJapaneseVoice);
}
function allHazards() {
    return [...SYNTHETIC_HAZARD_POINTS, ...sessionUserReports];
}
function setPanelOpen(open) {
    categoryPanel.classList.toggle("open", open);
    panelBackdrop.hidden = !open || !window.matchMedia("(max-width: 760px)").matches;
}
function renderPermissionStatus() {
    permissionStatusElement.textContent = `接近検知: ${approachDetectionEnabled ? "ON" : "OFF"} / バックグラウンド通知: ${backgroundNotificationEnabled ? "ON" : "OFF"} / 読み上げ: ${hazardVoiceEnabled ? "ON" : "OFF"}（合成PoC）`;
    connectionState.classList.toggle("active", approachDetectionEnabled);
    connectionState.querySelector("span").textContent = approachDetectionEnabled
        ? "自動見守り中"
        : "地図表示中";
    approachDetectionToggle.setAttribute("aria-checked", String(approachDetectionEnabled));
    approachDetectionState.dataset.state = approachDetectionEnabled ? "on" : "off";
    backgroundNotificationToggle.setAttribute("aria-checked", String(backgroundNotificationEnabled));
    backgroundNotificationState.dataset.state = backgroundNotificationEnabled ? "on" : "off";
    hazardVoiceToggle.setAttribute("aria-checked", String(hazardVoiceEnabled));
    hazardVoiceState.dataset.state = hazardVoiceEnabled ? "on" : "off";
}
function selectHazard(point) {
    selectedHazard = point;
    selectedSharedPoint = null;
    for (const { element } of mapMarkers.values()) {
        element.classList.toggle("selected", element.dataset.hazard === point.id);
    }
    for (const marker of sessionUserReportMarkers.values()) {
        const element = marker.getElement();
        element.classList.toggle("selected", element.dataset.hazard === point.id);
    }
}
function sharedNotification(point) {
    const synthetic = point.sourceOrganization === "CoachGo合成デモ";
    if (point.kind === "UNDERPASS") {
        return {
            title: synthetic ? "合成アンダーパス地点に接近" : "アンダーパスの冠水に注意",
            body: synthetic
                ? "実在地点ではない合成デモです。大雨時は水深を確認できないため、進入せず、公的情報を確認してください。"
                : "国土交通省が公開する道路冠水想定箇所です。現在の冠水情報ではありません。大雨時は進入前に道路管理者などの公的情報を確認してください。",
        };
    }
    return {
        title: synthetic ? "合成交通安全地点に接近" : "交通安全重点地点に接近",
        body: synthetic
            ? "実在地点ではない合成デモです。現在の取締り実施を示す情報ではありません。速度と交通ルールを守って走行してください。"
            : "警察公開の交通安全重点地点を概略表示しています。現在取締り実施中を示す情報ではありません。速度と交通ルールを守って走行してください。",
    };
}
function selectSharedPoint(point) {
    selectedSharedPoint = point;
    selectedHazard = null;
    for (const { element } of mapMarkers.values())
        element.classList.remove("selected");
    for (const { element } of sharedDataMarkers.values()) {
        element.classList.toggle("selected", element.dataset.sharedPoint === point.id);
    }
}
function clearMapPointSelection() {
    selectedHazard = null;
    selectedSharedPoint = null;
    for (const { element } of mapMarkers.values())
        element.classList.remove("selected");
    for (const marker of sessionUserReportMarkers.values())
        marker.getElement().classList.remove("selected");
    for (const { element } of sharedDataMarkers.values())
        element.classList.remove("selected");
}
function removeActiveMapPopup() {
    const popup = activeMapPopup;
    activeMapPopup = null;
    popup?.remove();
    clearMapPointSelection();
}
function popupContent(category, title, evidence, message, unverified = false) {
    const content = document.createElement("div");
    content.className = "coachgo-hazard-popup";
    const categoryElement = document.createElement("small");
    categoryElement.textContent = category;
    categoryElement.classList.toggle("unverified", unverified);
    const titleElement = document.createElement("strong");
    titleElement.textContent = title;
    const evidenceElement = document.createElement("p");
    evidenceElement.textContent = evidence;
    const messageElement = document.createElement("p");
    messageElement.className = "popup-message";
    messageElement.textContent = message;
    content.append(categoryElement, titleElement, evidenceElement, messageElement);
    return content;
}
function displayPopup(coordinates, content) {
    if (map === null || window.mapboxgl === undefined)
        return;
    removeActiveMapPopup();
    const popup = new window.mapboxgl.Popup({ offset: 14, closeButton: true, closeOnClick: true, maxWidth: "300px" })
        .setLngLat([coordinates[0], coordinates[1]])
        .setDOMContent(content)
        .addTo(map);
    activeMapPopup = popup;
    popup.on("close", () => {
        if (activeMapPopup !== popup)
            return;
        activeMapPopup = null;
        clearMapPointSelection();
    });
}
function showHazardPopup(point) {
    const notification = buildApproachNotification(point);
    displayPopup([point.longitude, point.latitude], popupContent(point.sourceKind === "USER_REPORT"
        ? `${categoryLabels[point.category]}・未確認`
        : categoryLabels[point.category], point.name, point.note ?? point.evidenceLabel, notification.body, point.sourceKind === "USER_REPORT"));
    selectHazard(point);
}
function showSharedPointPopup(point) {
    const notification = sharedNotification(point);
    const category = point.kind === "UNDERPASS" ? "アンダーパス・道路冠水注意箇所" : "警察・交通安全重点地点";
    const evidence = `${point.evidence} / 出典: ${point.sourceOrganization}${point.sourceUpdatedAt === null ? "" : `（${point.sourceUpdatedAt}更新）`}`;
    displayPopup([point.longitude, point.latitude], popupContent(category, point.name, evidence, notification.body));
    selectSharedPoint(point);
}
function categoryIcon(category) {
    return (HAZARD_CATEGORIES.find((candidate) => candidate.id === category)?.icon ??
        USER_REPORT_CATEGORIES.find((candidate) => candidate.id === category)?.icon ??
        "!");
}
function createHazardMarkerElement(point) {
    const marker = document.createElement("button");
    marker.type = "button";
    marker.className = `${point.sourceKind === "USER_REPORT" ? "user-report-marker" : "hazard-marker"} ${point.category.toLowerCase().replaceAll("_", "-")}`;
    marker.dataset.hazard = point.id;
    marker.setAttribute("aria-label", point.sourceKind === "USER_REPORT"
        ? `${point.name}、ユーザー登録の未確認地点`
        : `${point.name}、${categoryLabels[point.category]}、合成地点`);
    const label = document.createElement("span");
    label.textContent = categoryIcon(point.category);
    marker.append(label);
    marker.addEventListener("click", (event) => {
        event.stopPropagation();
        showHazardPopup(point);
    });
    return marker;
}
function addSyntheticMarkers() {
    if (map === null || window.mapboxgl === undefined || mapMarkers.size > 0)
        return;
    for (const point of SYNTHETIC_HAZARD_POINTS) {
        const element = createHazardMarkerElement(point);
        const marker = new window.mapboxgl.Marker({ element, anchor: "center" })
            .setLngLat([point.longitude, point.latitude])
            .addTo(map);
        element.setAttribute("role", "button");
        mapMarkers.set(point.id, { marker, element });
    }
    const userLocationElement = document.createElement("div");
    userLocationElement.className = "user-location";
    userLocationElement.setAttribute("aria-label", "現在地（デモ）");
    const locationHalo = document.createElement("span");
    locationHalo.className = "user-location-halo";
    const locationArrow = document.createElement("span");
    locationArrow.className = "user-location-arrow";
    locationArrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 20.6 20 12 16.6 3.4 20 12 2.8Z"/></svg>';
    const locationLabel = document.createElement("span");
    locationLabel.className = "user-location-label";
    locationLabel.textContent = "現在地";
    userLocationElement.append(locationHalo, locationArrow, locationLabel);
    userLocationMarker = new window.mapboxgl.Marker({ element: userLocationElement, anchor: "center" })
        .setLngLat(SYNTHETIC_USER_LOCATION)
        .addTo(map);
}
function updateDemoPlaybackAvailability() {
    demoPlaybackButton.disabled = !initialMapLoadCompleted || demoDriveRoute === null;
}
function renderDemoPlaybackState() {
    demoPlaybackButton.dataset.state = demoDriveRunning ? "running" : "stopped";
    demoPlaybackButton.setAttribute("aria-pressed", String(demoDriveRunning));
    demoPlaybackButton.setAttribute("aria-label", demoDriveRunning
        ? "横浜駅から本厚木駅のデモ走行を停止"
        : "横浜駅から本厚木駅のデモ走行を再生");
    demoPlaybackLabel.textContent = demoDriveRunning ? "停止" : "再生";
    demoPlaybackStatus.dataset.state = demoDriveRunning ? "running" : "stopped";
    demoPlaybackStatus.textContent = demoDriveRunning
        ? "自動デモ再生中　横浜駅 → 本厚木駅"
        : "デモ停止中　横浜駅 → 本厚木駅";
}
function voiceMonitorPoints() {
    const shared = (divertNaviMapData?.items ?? []).map((point) => ({
        id: point.id,
        monitorCategory: point.monitorCategory,
        name: point.name,
        longitude: point.longitude,
        latitude: point.latitude,
        kind: point.kind,
        alertDistanceMeters: point.kind === "POLICE_PRIORITY" ? 800 : 700,
    }));
    const hazards = allHazards().flatMap((point) => point.monitorCategory === null ? [] : [{
            id: point.id,
            monitorCategory: point.monitorCategory,
            name: point.name,
            longitude: point.longitude,
            latitude: point.latitude,
            kind: "OTHER",
            alertDistanceMeters: 800,
        }]);
    return [...shared, ...hazards];
}
function speakMonitorApproach(point) {
    const message = voiceApproachMessage(point);
    demoPlaybackStatus.dataset.lastVoicePoint = point.id;
    demoPlaybackStatus.dataset.lastVoiceAnnouncement = message;
    speakNaturalJapanese(message);
}
function checkDemoVoiceApproach(location, now) {
    if (now - lastVoiceProximityCheckAt < VOICE_PROXIMITY_CHECK_INTERVAL_MS)
        return;
    lastVoiceProximityCheckAt = now;
    if (!approachDetectionEnabled || !hazardVoiceEnabled || !demoDriveRunning) {
        activeNearbyPointIds.clear();
        return;
    }
    if (demoDriveRoute === null)
        return;
    const nearby = nearbyMonitoredPoints(location, demoDriveRoute, voiceMonitorPoints(), selectedCategories);
    const nearbyIds = new Set(nearby.map(({ point }) => point.id));
    const entered = nearby.find(({ point }) => !activeNearbyPointIds.has(point.id));
    activeNearbyPointIds = nearbyIds;
    if (entered === undefined || now - lastVoiceAnnouncementAt < VOICE_ANNOUNCEMENT_COOLDOWN_MS)
        return;
    lastVoiceAnnouncementAt = now;
    speakMonitorApproach(entered.point);
}
function createCategoryMarkerImage(icon, background) {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");
    if (context === null)
        throw new Error("category marker canvas is unavailable");
    context.beginPath();
    context.arc(32, 32, 27, 0, Math.PI * 2);
    context.fillStyle = background;
    context.fill();
    context.lineWidth = 6;
    context.strokeStyle = "#ffffff";
    context.stroke();
    context.font = '30px "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(icon, 32, 34);
    return context.getImageData(0, 0, 64, 64);
}
function isDivertNaviMapPayload(value) {
    if (value === null || typeof value !== "object")
        return false;
    const payload = value;
    return payload.schemaVersion === 1
        && Array.isArray(payload.items)
        && payload.counts !== undefined
        && Number.isInteger(payload.counts.underpasses)
        && Number.isInteger(payload.counts.policePriorityLocations);
}
function addSharedDataMarkers() {
    if (map === null || window.mapboxgl === undefined || divertNaviMapData === null || !initialMapLoadCompleted)
        return;
    addUnderpassLayers();
    if (sharedDataMarkers.size > 0)
        return;
    for (const point of divertNaviMapData.items) {
        if (point.kind === "UNDERPASS")
            continue;
        const element = document.createElement("button");
        element.type = "button";
        element.className = "shared-data-marker shared-police";
        element.dataset.sharedPoint = point.id;
        element.setAttribute("aria-label", `${point.name}、警察公開の交通安全重点地点`);
        const icon = document.createElement("span");
        icon.setAttribute("aria-hidden", "true");
        icon.textContent = categoryIcon("POLICE_ENFORCEMENT");
        element.append(icon);
        element.addEventListener("click", (event) => {
            event.stopPropagation();
            showSharedPointPopup(point);
        });
        const marker = new window.mapboxgl.Marker({ element, anchor: "center" })
            .setLngLat([point.longitude, point.latitude])
            .addTo(map);
        sharedDataMarkers.set(point.id, { marker, element, point });
    }
    renderMap();
}
function underpassFeatureCollection() {
    return {
        type: "FeatureCollection",
        features: (divertNaviMapData?.items ?? [])
            .filter((point) => point.kind === "UNDERPASS")
            .map((point) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
            properties: { pointId: point.id, name: point.name },
        })),
    };
}
function addUnderpassLayers() {
    if (map === null || divertNaviMapData === null)
        return;
    const data = underpassFeatureCollection();
    const existingSource = map.getSource(UNDERPASS_SOURCE_ID);
    if (existingSource !== undefined) {
        existingSource.setData(data);
        return;
    }
    map.addSource(UNDERPASS_SOURCE_ID, {
        type: "geojson",
        data,
        cluster: true,
        clusterMaxZoom: 12,
        clusterRadius: 48,
    });
    if (!map.hasImage(ROAD_FLOODING_MARKER_IMAGE_ID)) {
        map.addImage(ROAD_FLOODING_MARKER_IMAGE_ID, createCategoryMarkerImage(categoryIcon("ROAD_FLOODING"), "#007bff"), { pixelRatio: 2 });
    }
    map.addLayer({
        id: UNDERPASS_CLUSTER_LAYER_ID,
        type: "symbol",
        source: UNDERPASS_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
            "icon-image": ROAD_FLOODING_MARKER_IMAGE_ID,
            "icon-size": ["step", ["get", "point_count"], 0.95, 20, 1.12, 100, 1.28],
            "icon-allow-overlap": true,
        },
    });
    map.addLayer({
        id: UNDERPASS_CLUSTER_COUNT_LAYER_ID,
        type: "symbol",
        source: UNDERPASS_SOURCE_ID,
        filter: ["has", "point_count"],
        layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 12,
            "text-offset": [0, 2.2],
            "text-allow-overlap": true,
        },
        paint: { "text-color": "#0068d8", "text-halo-color": "#ffffff", "text-halo-width": 2 },
    });
    map.addLayer({
        id: UNDERPASS_POINT_LAYER_ID,
        type: "symbol",
        source: UNDERPASS_SOURCE_ID,
        filter: ["!", ["has", "point_count"]],
        layout: {
            "icon-image": ROAD_FLOODING_MARKER_IMAGE_ID,
            "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.65, 15, 0.95],
            "icon-allow-overlap": false,
        },
    });
    map.on("click", UNDERPASS_CLUSTER_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        if (feature?.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates))
            return;
        const [longitude, latitude] = feature.geometry.coordinates;
        if (typeof longitude !== "number" || typeof latitude !== "number")
            return;
        map?.easeTo({ center: [longitude, latitude], zoom: Math.min((map?.getZoom() ?? 10) + 2, 15), duration: 420 });
    });
    map.on("click", UNDERPASS_POINT_LAYER_ID, (event) => {
        const feature = event.features?.[0];
        const pointId = feature?.properties?.pointId;
        if (typeof pointId !== "string")
            return;
        const point = divertNaviMapData?.items.find((candidate) => candidate.id === pointId);
        if (point !== undefined)
            showSharedPointPopup(point);
    });
    for (const layerId of [UNDERPASS_CLUSTER_LAYER_ID, UNDERPASS_POINT_LAYER_ID]) {
        map.on("mouseenter", layerId, () => { if (map !== null)
            map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", layerId, () => { if (map !== null)
            map.getCanvas().style.cursor = ""; });
    }
}
function rainViewerFrame(value) {
    if (value === null || typeof value !== "object")
        throw new Error("RainViewer metadata is invalid");
    const metadata = value;
    const past = metadata.radar?.past;
    const latest = past?.[past.length - 1];
    if (typeof metadata.host !== "string"
        || !metadata.host.startsWith("https://")
        || typeof latest?.path !== "string"
        || !latest.path.startsWith("/")) {
        throw new Error("RainViewer latest radar frame is unavailable");
    }
    return { host: metadata.host, path: latest.path };
}
async function ensureRainViewerLayer() {
    if (map === null || map.getLayer(RAINVIEWER_LAYER_ID) !== undefined)
        return;
    rainViewerStatus.hidden = true;
    rainViewerStatus.dataset.state = "loading";
    rainViewerStatus.textContent = "";
    try {
        const response = await fetch(RAINVIEWER_METADATA_URL, { headers: { accept: "application/json" } });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        const frame = rainViewerFrame(await response.json());
        if (map === null)
            return;
        map.addSource(RAINVIEWER_SOURCE_ID, {
            type: "raster",
            tiles: [`${frame.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`],
            tileSize: 256,
            maxzoom: 7,
            attribution: '<a href="https://www.rainviewer.com/" target="_blank" rel="noreferrer">RainViewer</a>',
        });
        map.addLayer({
            id: RAINVIEWER_LAYER_ID,
            type: "raster",
            source: RAINVIEWER_SOURCE_ID,
            paint: { "raster-opacity": 0.32, "raster-fade-duration": 250 },
        }, map.getLayer(UNDERPASS_CLUSTER_LAYER_ID) !== undefined ? UNDERPASS_CLUSTER_LAYER_ID : undefined);
        map.setLayoutProperty(RAINVIEWER_LAYER_ID, "visibility", selectedCategories.has("RAIN_CLOUD") ? "visible" : "none");
        rainViewerStatus.dataset.state = "ready";
        rainViewerStatus.textContent = "";
    }
    catch (error) {
        rainViewerStatus.dataset.state = "unavailable";
        rainViewerStatus.textContent = "";
        rainViewerStatus.dataset.clientError = error instanceof Error ? error.message : "unknown RainViewer error";
    }
}
function updateRainViewerLayer() {
    const visible = selectedCategories.has("RAIN_CLOUD");
    if (!visible) {
        if (map?.getLayer(RAINVIEWER_LAYER_ID) !== undefined) {
            map.setLayoutProperty(RAINVIEWER_LAYER_ID, "visibility", "none");
        }
        rainViewerStatus.hidden = true;
        return;
    }
    rainViewerStatus.hidden = true;
    if (map?.getLayer(RAINVIEWER_LAYER_ID) !== undefined) {
        map.setLayoutProperty(RAINVIEWER_LAYER_ID, "visibility", "visible");
        rainViewerStatus.dataset.state = "ready";
        rainViewerStatus.textContent = "";
        return;
    }
    rainViewerLoading ??= ensureRainViewerLayer().finally(() => { rainViewerLoading = null; });
}
function demoRouteFeature(coordinates) {
    return {
        type: "Feature",
        properties: { from: "横浜駅", to: "本厚木駅" },
        geometry: { type: "LineString", coordinates },
    };
}
function demoRouteBounds(coordinates) {
    const longitudes = coordinates.map((coordinate) => coordinate[0]);
    const latitudes = coordinates.map((coordinate) => coordinate[1]);
    return [
        [Math.min(...longitudes), Math.min(...latitudes)],
        [Math.max(...longitudes), Math.max(...latitudes)],
    ];
}
function focusContinuousDemoRoute() {
    if (map === null || demoDriveRoute === null)
        return;
    map.fitBounds(demoRouteBounds(demoDriveRoute), {
        padding: { top: 72, right: 95, bottom: 72, left: 95 },
        pitch: 20,
        bearing: 0,
        duration: 700,
    });
    demoPlaybackStatus.hidden = false;
    demoPlaybackStatus.classList.add("focused");
    window.setTimeout(() => demoPlaybackStatus.classList.remove("focused"), 900);
}
function createDemoVehicleMarker() {
    if (map === null || window.mapboxgl === undefined || demoDriveMarker !== null)
        return;
    const element = document.createElement("div");
    element.className = "continuous-demo-vehicle";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "横浜駅から本厚木駅へ走行中のデモ車両");
    const graphic = document.createElement("span");
    graphic.className = "continuous-demo-vehicle-graphic";
    graphic.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 31 30l-11-5-11 5L20 3Z"/><path class="vehicle-window" d="m20 9 5 13-5-2.2-5 2.2 5-13Z"/></svg>';
    const label = document.createElement("span");
    label.className = "continuous-demo-vehicle-label";
    label.textContent = "デモ走行";
    element.append(graphic, label);
    demoVehicleGraphic = graphic;
    demoDriveMarker = new window.mapboxgl.Marker({ element, anchor: "center" })
        .setLngLat([YOKOHAMA_STATION[0], YOKOHAMA_STATION[1]])
        .addTo(map);
}
function animateContinuousDemoDrive() {
    if (demoDriveRoute === null || demoDriveMarker === null)
        return;
    const tick = (now) => {
        if (demoDriveRoute === null || demoDriveMarker === null)
            return;
        const elapsed = demoDriveLastFrameAt === null ? 0 : now - demoDriveLastFrameAt;
        demoDriveLastFrameAt = now;
        demoDriveProgress = advanceDemoProgress(demoDriveProgress, elapsed, DEMO_DRIVE_DURATION_MS, demoDriveRunning);
        const position = demoRoutePositionAt(demoDriveRoute, demoDriveProgress);
        demoDriveMarker.setLngLat([position.coordinate[0], position.coordinate[1]]);
        if (demoVehicleGraphic !== null)
            demoVehicleGraphic.style.transform = `rotate(${position.bearing}deg)`;
        demoPlaybackStatus.dataset.demoProgress = String(Math.floor(demoDriveProgress * 100));
        demoPlaybackStatus.dataset.vehicleLongitude = position.coordinate[0].toFixed(6);
        demoPlaybackButton.dataset.completedCategories = String(Math.floor(demoDriveProgress * 100));
        checkDemoVoiceApproach(position.coordinate, now);
        window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
}
async function initializeContinuousDemoDrive(token) {
    if (map === null || demoDriveRoute !== null)
        return;
    demoPlaybackStatus.hidden = false;
    demoPlaybackStatus.dataset.state = "loading";
    demoPlaybackStatus.textContent = "デモ走行ルートを準備中　横浜駅 → 本厚木駅";
    let routeMode = "MAPBOX";
    try {
        const coordinates = `${YOKOHAMA_STATION[0]},${YOKOHAMA_STATION[1]};${HON_ATSUGI_STATION[0]},${HON_ATSUGI_STATION[1]}`;
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?overview=full&geometries=geojson&access_token=${encodeURIComponent(token)}`;
        const response = await fetch(url, { headers: { accept: "application/json" } });
        if (!response.ok)
            throw new Error(`HTTP ${response.status}`);
        demoDriveRoute = parseMapboxDrivingRoute(await response.json());
    }
    catch (error) {
        routeMode = "FALLBACK";
        demoDriveRoute = FALLBACK_YOKOHAMA_TO_HON_ATSUGI_ROUTE;
        demoPlaybackStatus.dataset.clientError = error instanceof Error ? error.message : "unknown Directions error";
    }
    if (map === null)
        return;
    map.addSource(DEMO_DRIVE_SOURCE_ID, {
        type: "geojson",
        data: demoRouteFeature(demoDriveRoute),
    });
    map.addLayer({
        id: DEMO_DRIVE_CASING_LAYER_ID,
        type: "line",
        source: DEMO_DRIVE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
            "line-color": "#ffffff",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 7, 13, 12],
            "line-opacity": 0.88,
        },
    });
    map.addLayer({
        id: DEMO_DRIVE_LAYER_ID,
        type: "line",
        source: DEMO_DRIVE_SOURCE_ID,
        layout: { "line-cap": "round", "line-join": "round" },
        paint: {
            "line-color": "#155eef",
            "line-width": ["interpolate", ["linear"], ["zoom"], 8, 4, 13, 8],
            "line-opacity": 0.9,
            "line-blur": 0.4,
        },
    });
    createDemoVehicleMarker();
    demoPlaybackStatus.dataset.routeMode = routeMode;
    demoPlaybackButton.disabled = false;
    renderDemoPlaybackState();
    focusContinuousDemoRoute();
    if (!demoDriveAnimationStarted) {
        demoDriveAnimationStarted = true;
        animateContinuousDemoDrive();
    }
}
function withKanagawaPolice(payload) {
    const nonPolice = payload.items.filter((point) => point.kind !== "POLICE_PRIORITY");
    return {
        ...payload,
        counts: {
            ...payload.counts,
            policePriorityLocations: KANAGAWA_POLICE_PRIORITY_POINTS.length,
        },
        attribution: {
            ...payload.attribution,
            police: "神奈川県警察 15署の速度取締り指針を加工して概略表示",
        },
        limitations: [
            ...payload.limitations.filter((item) => !item.includes("警察地点")),
            "警察地点は公開された速度取締り重点区間の代表点であり、現在取締り実施中を示しません。",
        ],
        items: [...nonPolice, ...KANAGAWA_POLICE_PRIORITY_POINTS],
    };
}
async function loadDivertNaviMapData() {
    try {
        const runtimeConfig = window.COACHGO_CONFIG;
        const syntheticOnly = runtimeConfig?.dataMode === "SYNTHETIC_ONLY";
        const underpassDataUrl = runtimeConfig?.underpassDataUrl;
        const value = syntheticOnly
            ? syntheticSharedMapPayload()
            : underpassDataUrl
                ? await (async () => {
                    const response = await fetch(underpassDataUrl, { headers: { accept: "application/json" } });
                    if (!response.ok)
                        throw new Error(`HTTP ${response.status}`);
                    const publicPayload = buildNationalUnderpassMapPayload(await response.json());
                    return withKanagawaPolice(publicPayload);
                })()
                : await (async () => {
                    const response = await fetch(runtimeConfig?.mapDataUrl ?? "/api/divertnavi/map-points", {
                        headers: { accept: "application/json" },
                    });
                    if (!response.ok)
                        throw new Error(`HTTP ${response.status}`);
                    return withKanagawaPolice(await response.json());
                })();
        if (!isDivertNaviMapPayload(value))
            throw new Error("unsupported response");
        divertNaviMapData = value;
        sharedDataStatus.textContent = "";
        sharedDataStatus.hidden = true;
        sharedDataStatus.dataset.state = "ready";
        sharedDataStatus.dataset.underpassCount = String(value.counts.underpasses);
        sharedDataStatus.dataset.policeCount = String(value.counts.policePriorityLocations);
        updateDemoPlaybackAvailability();
        addSharedDataMarkers();
    }
    catch (error) {
        sharedDataStatus.textContent = "DivertNavi公開データを利用できません。合成地点のみ表示しています。";
        sharedDataStatus.hidden = false;
        sharedDataStatus.dataset.state = "unavailable";
        sharedDataStatus.dataset.clientError = error instanceof Error ? error.message : "unknown data error";
    }
}
function initializeMapbox() {
    const mapboxgl = window.mapboxgl;
    const token = window.COACHGO_CONFIG?.mapboxAccessToken ?? null;
    if (mapboxgl === undefined) {
        mapLoadState.textContent = "Mapbox GLを読み込めませんでした。ネットワークと配信設定を確認してください。";
        mapLoadState.classList.add("error");
        return;
    }
    if (token === null || !token.startsWith("pk.")) {
        mapLoadState.textContent = ".envにMapboxの公開トークン（MAPBOX_APIKEY）が設定されていません。";
        mapLoadState.classList.add("error");
        return;
    }
    try {
        initialMapLoadCompleted = false;
        map = new mapboxgl.Map({
            accessToken: token,
            container: "mapbox-map",
            style: COACHGO_MAP_STYLE,
            config: { basemap: { ...COACHGO_WASHI_AURORA_CONFIG } },
            language: COACHGO_MAP_LANGUAGE,
            locale: { ...COACHGO_MAP_LOCALE },
            localIdeographFontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
            center: SYNTHETIC_USER_LOCATION,
            zoom: 12.2,
            pitch: 34,
            bearing: -12,
            antialias: true,
            attributionControl: true,
        });
        initialMapLoadTimeout = window.setTimeout(() => {
            if (initialMapLoadCompleted)
                return;
            mapLoadState.hidden = false;
            mapLoadState.textContent = "Mapbox地図の初回読み込みが完了しません。トークンのURL制限と通信状態を確認してください。";
            mapLoadState.classList.add("error");
        }, 15_000);
        map.on("load", () => {
            initialMapLoadCompleted = true;
            if (initialMapLoadTimeout !== null)
                window.clearTimeout(initialMapLoadTimeout);
            initialMapLoadTimeout = null;
            mapLoadState.hidden = true;
            mapLoadState.classList.remove("error");
            addSyntheticMarkers();
            addSharedDataMarkers();
            updateDemoPlaybackAvailability();
            renderMap();
            void initializeContinuousDemoDrive(token);
        });
    }
    catch {
        if (initialMapLoadTimeout !== null)
            window.clearTimeout(initialMapLoadTimeout);
        initialMapLoadTimeout = null;
        mapLoadState.textContent = "Mapbox地図を初期化できませんでした。公開トークンの設定を確認してください。";
        mapLoadState.classList.add("error");
    }
}
function renderMap() {
    const visible = filterHazardsByCategory(allHazards(), selectedCategories);
    selectedCount.textContent = `${selectedCategories.size}件選択`;
    for (const button of document.querySelectorAll("[data-category]")) {
        const category = button.dataset.category;
        button.setAttribute("aria-pressed", String(selectedCategories.has(category)));
    }
    for (const { element } of mapMarkers.values()) {
        element.hidden = !visible.some((point) => point.id === element.dataset.hazard);
    }
    for (const { element, point } of sharedDataMarkers.values()) {
        element.hidden = !selectedCategories.has(point.monitorCategory);
    }
    if (map !== null) {
        const underpassesVisible = selectedCategories.has("ROAD_FLOODING") ? "visible" : "none";
        for (const layerId of [UNDERPASS_CLUSTER_LAYER_ID, UNDERPASS_CLUSTER_COUNT_LAYER_ID, UNDERPASS_POINT_LAYER_ID]) {
            if (map.getLayer(layerId) !== undefined)
                map.setLayoutProperty(layerId, "visibility", underpassesVisible);
        }
    }
    updateRainViewerLayer();
    for (const marker of sessionUserReportMarkers.values())
        marker.remove();
    sessionUserReportMarkers.clear();
    if (map !== null && window.mapboxgl !== undefined) {
        for (const report of sessionUserReports.filter((point) => visible.includes(point))) {
            const element = createHazardMarkerElement(report);
            const marker = new window.mapboxgl.Marker({ element, anchor: "center" })
                .setLngLat([report.longitude, report.latitude])
                .addTo(map);
            element.setAttribute("role", "button");
            sessionUserReportMarkers.set(report.id, marker);
        }
    }
    if (selectedSharedPoint !== null && !selectedCategories.has(selectedSharedPoint.monitorCategory)) {
        removeActiveMapPopup();
    }
    if (selectedHazard !== null && !visible.some((point) => point.id === selectedHazard?.id)) {
        removeActiveMapPopup();
    }
}
requiredElement("#close-panel").addEventListener("click", () => setPanelOpen(false));
panelBackdrop.addEventListener("click", () => setPanelOpen(false));
approachDetectionToggle.addEventListener("click", () => {
    approachDetectionEnabled = !approachDetectionEnabled;
    if (!approachDetectionEnabled) {
        notificationPreview.hidden = true;
        cancelNaturalJapaneseSpeech();
    }
    renderPermissionStatus();
});
backgroundNotificationToggle.addEventListener("click", () => {
    backgroundNotificationEnabled = !backgroundNotificationEnabled;
    renderPermissionStatus();
});
hazardVoiceToggle.addEventListener("click", () => {
    hazardVoiceEnabled = !hazardVoiceEnabled;
    if (!hazardVoiceEnabled) {
        cancelNaturalJapaneseSpeech();
        demoPlaybackStatus.dataset.voiceState = "muted";
        activeNearbyPointIds.clear();
    }
    renderPermissionStatus();
});
for (const button of document.querySelectorAll("[data-category]")) {
    button.addEventListener("click", () => {
        const category = button.dataset.category;
        if (selectedCategories.has(category))
            selectedCategories.delete(category);
        else {
            selectedCategories.add(category);
        }
        renderMap();
    });
}
demoPlaybackButton.addEventListener("click", () => {
    demoDriveRunning = !demoDriveRunning;
    demoDriveLastFrameAt = null;
    if (!demoDriveRunning)
        cancelNaturalJapaneseSpeech();
    renderDemoPlaybackState();
    if (demoDriveRunning)
        focusContinuousDemoRoute();
});
requiredElement("#dismiss-notification").addEventListener("click", () => {
    notificationPreview.hidden = true;
});
requiredElement("#register-hazard").addEventListener("click", () => {
    registrationError.textContent = "";
    voiceReportStatus.dataset.state = "idle";
    voiceReportStatus.textContent = "マイクを押して、危険の種類を話してください。";
    voiceReportTranscript.hidden = true;
    voiceReportTranscript.textContent = "";
    registrationDialog.showModal();
});
requiredElement("#close-registration").addEventListener("click", () => {
    activeVoiceRecognition?.abort();
    registrationDialog.close();
});
requiredElement("#show-all-reports").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const expanded = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(expanded));
    button.firstChild.textContent = expanded ? "表示を戻す " : "さらに表示（すべての危険） ";
    for (const additional of document.querySelectorAll("[data-additional-report]")) {
        additional.hidden = !expanded;
    }
});
function speakReportConfirmation(label) {
    speakNaturalJapanese(`${label}を、未確認の危険地点として登録しました。ご協力、ありがとうございます。`);
}
function showUndoReport(report) {
    if (undoReportTimer !== null)
        window.clearTimeout(undoReportTimer);
    lastReportId = report.id;
    undoReportTitle.textContent = `${categoryLabels[report.category]}を登録しました`;
    undoReportToast.hidden = false;
    undoReportTimer = window.setTimeout(() => {
        undoReportToast.hidden = true;
        lastReportId = null;
        undoReportTimer = null;
    }, 10_000);
}
function registerSessionHazard(category, coordinates) {
    reportSequence += 1;
    const report = createSessionUserHazardPoint({
        id: `session-user-report-${reportSequence}`,
        category,
        longitude: coordinates[0],
        latitude: coordinates[1],
    });
    sessionUserReports = [...sessionUserReports, report];
    registrationDialog.close();
    setPanelOpen(false);
    renderMap();
    showUndoReport(report);
    speakReportConfirmation(categoryLabels[category]);
    return report;
}
for (const button of document.querySelectorAll("[data-report-category]")) {
    button.addEventListener("click", () => {
        try {
            const category = button.dataset.reportCategory;
            const center = map?.getCenter();
            registerSessionHazard(category, [
                center?.lng ?? SYNTHETIC_USER_LOCATION[0],
                center?.lat ?? SYNTHETIC_USER_LOCATION[1],
            ]);
        }
        catch (error) {
            registrationError.textContent = error instanceof Error ? error.message : "登録できませんでした。";
        }
    });
}
voiceReportButton.addEventListener("click", () => {
    if (activeVoiceRecognition !== null) {
        activeVoiceRecognition.stop();
        return;
    }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Recognition === undefined) {
        voiceReportStatus.dataset.state = "error";
        voiceReportStatus.textContent = "このブラウザは音声入力に対応していません。Chromeでお試しください。";
        return;
    }
    let finalTranscript = "";
    let completed = false;
    const recognition = new Recognition();
    activeVoiceRecognition = recognition;
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
        voiceReportButton.setAttribute("aria-pressed", "true");
        voiceReportStatus.dataset.state = "listening";
        voiceReportStatus.textContent = "聞き取り中… 危険の種類を話してください。";
        voiceReportTranscript.hidden = true;
        voiceReportTranscript.textContent = "";
    };
    recognition.onresult = (event) => {
        let interimTranscript = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            if (result === undefined)
                continue;
            if (result.isFinal)
                finalTranscript += result[0].transcript;
            else
                interimTranscript += result[0].transcript;
        }
        const visibleTranscript = `${finalTranscript}${interimTranscript}`.trim();
        voiceReportTranscript.textContent = `認識: ${visibleTranscript}`;
        voiceReportTranscript.hidden = visibleTranscript.length === 0;
        if (finalTranscript.trim().length === 0 || completed)
            return;
        const match = recognizeVoiceHazardCategory(finalTranscript);
        if (match === null) {
            voiceReportStatus.dataset.state = "error";
            voiceReportStatus.textContent = "危険カテゴリーを判定できませんでした。もう一度お試しください。";
            return;
        }
        completed = true;
        voiceReportStatus.dataset.state = "registered";
        voiceReportStatus.textContent = `${categoryLabels[match.category]}を現在地へ登録します。`;
        recognition.stop();
        registerSessionHazard(match.category, currentUserLocation);
    };
    recognition.onerror = (event) => {
        voiceReportStatus.dataset.state = "error";
        voiceReportStatus.textContent = event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "音声登録にはマイクの許可が必要です。"
            : event.error === "no-speech"
                ? "音声を聞き取れませんでした。もう一度お試しください。"
                : "音声入力を開始できませんでした。";
    };
    recognition.onend = () => {
        activeVoiceRecognition = null;
        voiceReportButton.setAttribute("aria-pressed", "false");
        if (!completed && finalTranscript.trim().length === 0 && voiceReportStatus.dataset.state !== "error") {
            voiceReportStatus.dataset.state = "idle";
            voiceReportStatus.textContent = "音声入力が終了しました。マイクを押して再度お試しください。";
        }
    };
    try {
        recognition.start();
    }
    catch {
        activeVoiceRecognition = null;
        voiceReportStatus.dataset.state = "error";
        voiceReportStatus.textContent = "音声入力を開始できませんでした。";
    }
});
requiredElement("#undo-report").addEventListener("click", () => {
    if (lastReportId === null)
        return;
    sessionUserReports = sessionUserReports.filter((report) => report.id !== lastReportId);
    if (selectedHazard?.id === lastReportId)
        removeActiveMapPopup();
    lastReportId = null;
    if (undoReportTimer !== null)
        window.clearTimeout(undoReportTimer);
    undoReportTimer = null;
    undoReportToast.hidden = true;
    renderMap();
});
requiredElement("#recenter-map").addEventListener("click", () => {
    locationStatus.hidden = false;
    locationStatus.textContent = "現在地を取得中…";
    if (!("geolocation" in navigator)) {
        locationStatus.textContent = "この端末では現在地を取得できません。";
        return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
        const longitude = position.coords.longitude;
        const latitude = position.coords.latitude;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
            locationStatus.textContent = "現在地を確認できませんでした。";
            return;
        }
        currentUserLocation = [longitude, latitude];
        userLocationMarker?.setLngLat(currentUserLocation);
        map?.easeTo({ center: currentUserLocation, zoom: 15, pitch: 22, bearing: 0, duration: 650 });
        locationStatus.textContent = "現在地を表示しました。";
        window.setTimeout(() => { locationStatus.hidden = true; }, 2_500);
    }, (error) => {
        locationStatus.textContent = error.code === error.PERMISSION_DENIED
            ? "現在地の表示には位置情報の許可が必要です。"
            : "現在地を取得できませんでした。通信状態をご確認ください。";
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
});
renderPermissionStatus();
renderMap();
void loadDivertNaviMapData();
initializeMapbox();
//# sourceMappingURL=demo.js.map
