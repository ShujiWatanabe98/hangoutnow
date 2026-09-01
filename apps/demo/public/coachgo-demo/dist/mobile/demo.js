import { buildHazardPointGuidance, createSessionUserHazardPoint, defaultSelectedCategories, filterHazardsByCategory, HAZARD_CATEGORIES, SYNTHETIC_HAZARD_POINTS, USER_REPORT_CATEGORIES, } from "./hazardMap.js?v=20260901-1";
import { COACHGO_MAP_LANGUAGE, COACHGO_MAP_LOCALE, COACHGO_MAP_STYLE, COACHGO_WASHI_AURORA_CONFIG, } from "./mapboxStyle.js?v=20260901-1";
import { buildNationalUnderpassMapPayload } from "./divertNaviUnderpasses.js?v=20260901-1";
import { KANAGAWA_POLICE_PRIORITY_POINTS } from "./kanagawaPolicePoints.js?v=20260901-1";
import { advanceDemoProgress, createDemoRouteSampler, FALLBACK_YOKOHAMA_TO_HON_ATSUGI_ROUTE, HON_ATSUGI_STATION, parseMapboxDrivingRoute, screenRelativeBearing, smoothBearing, YOKOHAMA_STATION, } from "./continuousDemoDrive.js?v=20260901-1";
import { createRouteApproachIndex, nearbyIndexedMonitoredPoints, nearbyMonitoredPointsAtLocation, voiceApproachMessage, } from "./voiceApproach.js?v=20260901-1";
import { recognizeVoiceHazardCategory } from "./voiceHazardReport.js?v=20260901-1";
import { createNaturalJapaneseSpeechPlan, NATURAL_JAPANESE_SPEECH_SETTINGS, selectNaturalJapaneseVoice, } from "./naturalSpeech.js?v=20260901-1";
import { interpolateUserLocation, screenRelativeUserHeading, shouldAnimateUserLocation, userLocationAnimationDuration, userLocationDistanceMeters, userLocationMovementBearing, } from "./smoothUserLocation.js?v=20260901-1";
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
const panelScroll = requiredElement("#category-panel .panel-scroll");
const panelBackdrop = requiredElement("#panel-backdrop");
const openSettingsButton = requiredElement("#open-settings");
const closePanelButton = requiredElement("#close-panel");
const mapLoadState = requiredElement("#map-load-state");
const sharedDataStatus = requiredElement("#shared-data-status");
const selectedCount = requiredElement("#selected-count");
const notificationPreview = requiredElement("#notification-preview");
const notificationTitle = requiredElement("#notification-title");
const notificationBody = requiredElement("#notification-body");
const connectionState = requiredElement("#connection-state");
const registrationDialog = requiredElement("#registration-dialog");
const registrationError = requiredElement("#registration-error");
const voiceReportButton = requiredElement("#voice-report-start");
const voiceReportStatus = requiredElement("#voice-report-status");
const voiceReportTranscript = requiredElement("#voice-report-transcript");
const microphonePermissionDialog = requiredElement("#microphone-permission-dialog");
const microphonePermissionDescription = requiredElement("#microphone-permission-description");
const microphonePermissionGuidance = requiredElement("#microphone-permission-guidance");
const grantMicrophonePermissionButton = requiredElement("#grant-microphone-permission");
const closeMicrophonePermissionButton = requiredElement("#close-microphone-permission");
const approachDetectionToggle = requiredElement("#approach-detection-toggle");
const approachDetectionState = requiredElement("#approach-detection-state");
const backgroundNotificationToggle = requiredElement("#background-notification-toggle");
const backgroundNotificationState = requiredElement("#background-notification-state");
const hazardVoiceToggle = requiredElement("#hazard-voice-toggle");
const hazardVoiceState = requiredElement("#hazard-voice-state");
const largeReportIconToggle = requiredElement("#large-report-icon-toggle");
const largeReportIconState = requiredElement("#large-report-icon-state");
const voiceInputToggle = requiredElement("#voice-input-toggle");
const voiceInputState = requiredElement("#voice-input-state");
const demoVisibilityToggle = requiredElement("#demo-visibility-toggle");
const demoVisibilityState = requiredElement("#demo-visibility-state");
const inputPermissionStatus = requiredElement("#input-permission-status");
const recenterMapButton = requiredElement("#recenter-map");
const registerHazardButton = requiredElement("#register-hazard");
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
let userLocationMarker = null;
const UNDERPASS_SOURCE_ID = "coachgo-underpasses";
const UNDERPASS_CLUSTER_LAYER_ID = "coachgo-underpass-clusters";
const UNDERPASS_CLUSTER_COUNT_LAYER_ID = "coachgo-underpass-cluster-count";
const UNDERPASS_POINT_LAYER_ID = "coachgo-underpass-points";
const ROAD_FLOODING_MARKER_IMAGE_ID = "coachgo-road-flooding-category-icon";
const HAZARD_CLUSTER_MAX_ZOOM = 12;
const HAZARD_CLUSTER_RADIUS = 48;
const CLUSTERED_HAZARD_CATEGORIES = [
    ...HAZARD_CATEGORIES.filter((category) => category.id !== "RAIN_CLOUD").map((category) => category.id),
    ...USER_REPORT_CATEGORIES.map((category) => category.id),
];
const RAINVIEWER_SOURCE_ID = "coachgo-rainviewer-radar";
const RAINVIEWER_LAYER_ID = "coachgo-rainviewer-radar-layer";
const RAINVIEWER_METADATA_URL = "https://api.rainviewer.com/public/weather-maps.json";
const DEMO_DRIVE_SOURCE_ID = "coachgo-yokohama-honatsugi-route";
const DEMO_DRIVE_CASING_LAYER_ID = "coachgo-yokohama-honatsugi-route-casing";
const DEMO_DRIVE_LAYER_ID = "coachgo-yokohama-honatsugi-route-line";
const DEMO_DRIVE_DURATION_MS = 60_000;
const DEFAULT_LOCATION_ZOOM = 15.8;
const DEMO_BEARING_LOOKAHEAD_METERS = 45;
const DEMO_BEARING_RESPONSE_MS = 190;
const DEMO_UI_UPDATE_INTERVAL_MS = 250;
const DEMO_BALANCED_CAMERA_INTERVAL_MS = 1_000 / 30;
const DEMO_FRAME_QUALITY_SAMPLE_SIZE = 45;
const DEMO_VOICE_SCENARIOS = [
    { id: "demo-voice-underpass", progress: 0.12, monitorCategory: "ROAD_FLOODING", name: "デモ道路冠水地点", kind: "UNDERPASS" },
    { id: "demo-voice-river", progress: 0.3, monitorCategory: "RIVER_FLOODING", name: "デモ河川氾濫地点", kind: "OTHER" },
    { id: "demo-voice-slope", progress: 0.48, monitorCategory: "LANDSLIDE", name: "デモ土砂災害地点", kind: "OTHER" },
    { id: "demo-voice-tsunami", progress: 0.66, monitorCategory: "TSUNAMI", name: "デモ津波注意地点", kind: "OTHER" },
    { id: "demo-voice-police", progress: 0.84, monitorCategory: "POLICE_ENFORCEMENT", name: "デモ交通安全重点地点", kind: "POLICE_PRIORITY" },
];
const selectedCategories = new Set(defaultSelectedCategories());
let selectedHazard = null;
let selectedSharedPoint = null;
let activeMapPopup = null;
let divertNaviMapData = null;
let sessionUserReports = [];
let approachDetectionEnabled = true;
let backgroundNotificationEnabled = true;
let hazardVoiceEnabled = true;
const INPUT_SETTINGS_STORAGE_KEY = "coachgo:input-settings-v1";
function readStoredInputSettings() {
    try {
        const stored = window.localStorage.getItem(INPUT_SETTINGS_STORAGE_KEY);
        if (stored === null)
            return { largeReportIcon: false, voiceInput: true, demoVisible: true };
        const parsed = JSON.parse(stored);
        return {
            largeReportIcon: parsed.largeReportIcon === true,
            voiceInput: parsed.voiceInput !== false,
            demoVisible: parsed.demoVisible !== false,
        };
    }
    catch {
        return { largeReportIcon: false, voiceInput: true, demoVisible: true };
    }
}
const storedInputSettings = readStoredInputSettings();
let largeReportIconEnabled = storedInputSettings.largeReportIcon;
let voiceInputEnabled = storedInputSettings.voiceInput;
let demoVisibilityEnabled = storedInputSettings.demoVisible;
let reportSequence = 0;
let lastReportId = null;
let undoReportTimer = null;
let currentUserLocation = [...SYNTHETIC_USER_LOCATION];
let renderedUserLocation = [...SYNTHETIC_USER_LOCATION];
let acceptedUserLocation = null;
let hasLiveUserLocation = false;
let foregroundLocationWatchId = null;
let userLocationArrow = null;
let userLocationAnimationSequence = 0;
let deviceHeadingDegrees = null;
let movementHeadingDegrees = null;
let movementHeadingValidUntil = -Infinity;
let rainViewerLoading = null;
let demoDriveRoute = null;
let demoDriveSampler = null;
let demoDriveMarker = null;
let demoDriveMarkerElement = null;
let demoVehicleGraphic = null;
let demoVehicleOverlay = null;
let demoVehicleOverlayGraphic = null;
let demoRouteApproachIndex = null;
let demoDriveAnimationStarted = false;
let demoDriveRunning = false;
let demoDriveProgress = 0;
let demoDriveLastFrameAt = null;
let demoSmoothedBearing = null;
let demoRenderQuality = "HIGH";
let demoFrameDurations = [];
let lastDemoUiUpdateAt = -Infinity;
let lastVoiceProximityCheckAt = 0;
let lastVoiceAnnouncementAt = -Infinity;
let activeNearbyPointIds = new Set();
let activeVoiceRecognition = null;
let activeVoiceCommandRecognition = null;
let voiceCommandRestartTimer = null;
let microphonePermissionGranted = false;
let microphonePermissionRequestPending = false;
let microphonePermissionReason = "voice-report";
let preferredJapaneseVoice = null;
let activeSpeechSequence = 0;
let demoCameraFollowStartsAt = -Infinity;
let lastDemoCameraFrameAt = -Infinity;
let panelTouchStartY = null;
let panelTouchLastY = null;
let panelTouchStartedAt = 0;
let panelTouchDragging = false;
const VOICE_PROXIMITY_CHECK_INTERVAL_MS = 750;
const VOICE_ANNOUNCEMENT_COOLDOWN_MS = 12_000;
const MOVEMENT_HEADING_HOLD_MS = 3_000;
const MOBILE_PANEL_QUERY = "(max-width: 760px)";
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
    window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "COACHGO_NATIVE_SPEECH_STOP" }));
    if ("speechSynthesis" in window)
        window.speechSynthesis.cancel();
}
function speakNaturalJapanese(message, force = false) {
    if (!hazardVoiceEnabled && !force) {
        demoPlaybackStatus.dataset.voiceState = "muted";
        return;
    }
    if (window.ReactNativeWebView !== undefined) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "COACHGO_NATIVE_SPEAK", message }));
        demoPlaybackStatus.dataset.voiceState = "native";
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
function resetPanelDrag() {
    panelTouchStartY = null;
    panelTouchLastY = null;
    panelTouchStartedAt = 0;
    panelTouchDragging = false;
    categoryPanel.classList.remove("dragging");
    categoryPanel.style.removeProperty("--sheet-drag-y");
}
function setPanelOpen(open) {
    const mobile = window.matchMedia(MOBILE_PANEL_QUERY).matches;
    const overlayOpen = mobile && open;
    resetPanelDrag();
    categoryPanel.classList.toggle("open", overlayOpen);
    openSettingsButton.setAttribute("aria-expanded", String(overlayOpen));
    panelBackdrop.hidden = !overlayOpen;
    categoryPanel.setAttribute("aria-hidden", mobile ? String(!overlayOpen) : "false");
    if (mobile && !overlayOpen)
        categoryPanel.setAttribute("inert", "");
    else
        categoryPanel.removeAttribute("inert");
}
function renderPermissionStatus() {
    const locationWatchState = connectionState.dataset.locationWatch ?? "not-requested";
    const locationPermissionLabel = !approachDetectionEnabled
        ? "不要（接近通知OFF）"
        : locationWatchState === "active"
            ? "許可済み"
            : locationWatchState === "denied"
                ? "未許可（サイト設定をご確認ください）"
                : locationWatchState === "unsupported"
                    ? "利用不可"
                    : locationWatchState === "error"
                        ? "確認できませんでした"
                        : "確認中";
    const notificationPermission = window.ReactNativeWebView !== undefined
        ? "アプリで確認"
        : !("Notification" in window)
            ? "利用不可"
            : window.Notification.permission === "granted"
                ? "許可済み"
                : window.Notification.permission === "denied"
                    ? "未許可（サイト設定をご確認ください）"
                    : "未確認";
    permissionStatusElement.hidden = false;
    permissionStatusElement.textContent = `位置情報: ${locationPermissionLabel} / 通知: ${backgroundNotificationEnabled ? notificationPermission : "不要（通知OFF）"}`;
    connectionState.classList.toggle("active", approachDetectionEnabled);
    connectionState.querySelector("span").textContent = approachDetectionEnabled
        ? "自動見守り中"
        : "自動見守り停止中";
    approachDetectionToggle.setAttribute("aria-checked", String(approachDetectionEnabled));
    approachDetectionState.dataset.state = approachDetectionEnabled ? "on" : "off";
    backgroundNotificationToggle.setAttribute("aria-checked", String(backgroundNotificationEnabled));
    backgroundNotificationState.dataset.state = backgroundNotificationEnabled ? "on" : "off";
    hazardVoiceToggle.setAttribute("aria-checked", String(hazardVoiceEnabled));
    hazardVoiceState.dataset.state = hazardVoiceEnabled ? "on" : "off";
}
function persistInputSettings() {
    try {
        window.localStorage.setItem(INPUT_SETTINGS_STORAGE_KEY, JSON.stringify({
            largeReportIcon: largeReportIconEnabled,
            voiceInput: voiceInputEnabled,
            demoVisible: demoVisibilityEnabled,
        }));
    }
    catch {
        // Storage may be unavailable in a private WebView. The current session still works.
    }
}
function renderInputSettings() {
    largeReportIconToggle.setAttribute("aria-checked", String(largeReportIconEnabled));
    largeReportIconState.dataset.state = largeReportIconEnabled ? "on" : "off";
    for (const button of [recenterMapButton, registerHazardButton, demoPlaybackButton]) {
        button.classList.toggle("large-input-icon", largeReportIconEnabled);
    }
    voiceInputToggle.setAttribute("aria-checked", String(voiceInputEnabled));
    voiceInputState.dataset.state = voiceInputEnabled ? "on" : "off";
    voiceReportButton.disabled = !voiceInputEnabled;
    inputPermissionStatus.hidden = false;
    if (!voiceInputEnabled) {
        inputPermissionStatus.dataset.state = "off";
        inputPermissionStatus.textContent = "音声入力はOFFです。";
    }
    else if (microphonePermissionGranted) {
        inputPermissionStatus.dataset.state = "ready";
        inputPermissionStatus.textContent = "マイクは許可されています。「登録」と話すと投稿画面が開きます。";
    }
    else {
        inputPermissionStatus.dataset.state = "idle";
        inputPermissionStatus.textContent = "音声投稿を使うときに、ブラウザがマイクの使用許可を確認します。";
    }
    demoVisibilityToggle.setAttribute("aria-checked", String(demoVisibilityEnabled));
    demoVisibilityState.dataset.state = demoVisibilityEnabled ? "on" : "off";
    demoPlaybackButton.hidden = !demoVisibilityEnabled;
    renderDemoMapVisibility();
}
function renderDemoMapVisibility() {
    const routeVisibility = demoVisibilityEnabled ? "visible" : "none";
    for (const layerId of [DEMO_DRIVE_CASING_LAYER_ID, DEMO_DRIVE_LAYER_ID]) {
        if (map?.getLayer(layerId) !== undefined) {
            map.setLayoutProperty(layerId, "visibility", routeVisibility);
        }
    }
    if (demoDriveMarkerElement !== null) {
        demoDriveMarkerElement.hidden = !demoVisibilityEnabled || demoDriveRunning;
    }
    if (demoVehicleOverlay !== null) {
        demoVehicleOverlay.hidden = !demoVisibilityEnabled || !demoDriveRunning;
    }
    demoPlaybackStatus.hidden = !demoVisibilityEnabled;
}
function clearVoiceCommandRestartTimer() {
    if (voiceCommandRestartTimer === null)
        return;
    window.clearTimeout(voiceCommandRestartTimer);
    voiceCommandRestartTimer = null;
}
function stopVoiceCommandRecognition() {
    clearVoiceCommandRestartTimer();
    const recognition = activeVoiceCommandRecognition;
    activeVoiceCommandRecognition = null;
    recognition?.abort();
}
function isRegistrationVoiceCommand(transcript) {
    return transcript.normalize("NFKC").replace(/[\s、。,.!?！？]/g, "").includes("登録");
}
function scheduleVoiceCommandRecognition(delayMs = 650) {
    clearVoiceCommandRestartTimer();
    if (!voiceInputEnabled || !microphonePermissionGranted || registrationDialog.open || document.hidden)
        return;
    voiceCommandRestartTimer = window.setTimeout(() => {
        voiceCommandRestartTimer = null;
        startVoiceCommandRecognition();
    }, delayMs);
}
function startVoiceCommandRecognition() {
    if (!voiceInputEnabled
        || !microphonePermissionGranted
        || registrationDialog.open
        || document.hidden
        || activeVoiceCommandRecognition !== null
        || activeVoiceRecognition !== null)
        return;
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Recognition === undefined) {
        inputPermissionStatus.dataset.state = "unavailable";
        inputPermissionStatus.textContent = "この端末は「登録」の音声待ち受けに対応していません。投稿ボタンをご利用ください。";
        return;
    }
    let commandHandled = false;
    const recognition = new Recognition();
    activeVoiceCommandRecognition = recognition;
    recognition.lang = "ja-JP";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
        inputPermissionStatus.dataset.state = "ready";
        inputPermissionStatus.textContent = "音声入力ON：「登録」と話すと投稿画面が開きます。";
    };
    recognition.onresult = (event) => {
        let transcript = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
            const result = event.results[index];
            if (result?.isFinal)
                transcript += result[0].transcript;
        }
        if (!isRegistrationVoiceCommand(transcript) || commandHandled)
            return;
        commandHandled = true;
        recognition.stop();
        openRegistrationDialog(true);
    };
    recognition.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            disableVoiceInputAfterMicrophoneFailure();
            return;
        }
        if (event.error !== "no-speech" && event.error !== "aborted") {
            inputPermissionStatus.dataset.state = "unavailable";
            inputPermissionStatus.textContent = "音声待ち受けを一時停止しました。自動的に再試行します。";
        }
    };
    recognition.onend = () => {
        if (activeVoiceCommandRecognition === recognition)
            activeVoiceCommandRecognition = null;
        if (!commandHandled)
            scheduleVoiceCommandRecognition();
    };
    try {
        recognition.start();
    }
    catch {
        activeVoiceCommandRecognition = null;
        inputPermissionStatus.dataset.state = "unavailable";
        inputPermissionStatus.textContent = "音声待ち受けを開始できませんでした。投稿ボタンをご利用ください。";
    }
}
function disableVoiceInputAfterMicrophoneFailure() {
    microphonePermissionGranted = false;
    voiceInputEnabled = false;
    stopVoiceCommandRecognition();
    persistInputSettings();
    renderInputSettings();
    inputPermissionStatus.hidden = false;
    inputPermissionStatus.dataset.state = "error";
    inputPermissionStatus.textContent = "マイクの使用許可が得られなかったため、音声入力をOFFにしました。";
    voiceReportStatus.dataset.state = "error";
    voiceReportStatus.textContent = "マイクを許可できなかったため、設定の音声入力をOFFにしました。";
}
async function requestMicrophonePermission() {
    if (!voiceInputEnabled) {
        inputPermissionStatus.hidden = false;
        inputPermissionStatus.dataset.state = "off";
        inputPermissionStatus.textContent = "音声入力はOFFです。";
        voiceReportStatus.dataset.state = "error";
        voiceReportStatus.textContent = "音声入力がOFFです。入力設定からONにしてください。";
        return false;
    }
    if (microphonePermissionGranted) {
        return true;
    }
    if (navigator.mediaDevices?.getUserMedia === undefined) {
        disableVoiceInputAfterMicrophoneFailure();
        return false;
    }
    inputPermissionStatus.hidden = false;
    inputPermissionStatus.dataset.state = "loading";
    inputPermissionStatus.textContent = "ブラウザの確認画面で、マイクの使用を「許可」してください。";
    voiceReportStatus.dataset.state = "permission";
    voiceReportStatus.textContent = "マイクの使用許可を確認しています。「許可」を選択してください。";
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        for (const track of stream.getTracks())
            track.stop();
        if (!voiceInputEnabled) {
            inputPermissionStatus.dataset.state = "off";
            inputPermissionStatus.textContent = "音声入力はOFFです。投稿ボタンとカテゴリー選択は利用できます。";
            return false;
        }
        microphonePermissionGranted = true;
        inputPermissionStatus.dataset.state = "ready";
        inputPermissionStatus.textContent = "音声入力ON：「登録」と話すと投稿画面が開きます。";
        return true;
    }
    catch {
        if (!voiceInputEnabled)
            return false;
        disableVoiceInputAfterMicrophoneFailure();
        return false;
    }
}
async function readMicrophonePermissionState() {
    if (navigator.permissions?.query === undefined)
        return "unknown";
    try {
        const status = await navigator.permissions.query({ name: "microphone" });
        return status.state;
    }
    catch {
        return "unknown";
    }
}
function showMicrophonePermissionDialog(reason) {
    microphonePermissionReason = reason;
    grantMicrophonePermissionButton.hidden = false;
    closeMicrophonePermissionButton.hidden = true;
    microphonePermissionDescription.textContent = reason === "voice-report"
        ? "音声で危険を登録するには、マイクの使用許可が必要です。"
        : "音声入力がONのため、マイクの使用許可を確認します。";
    microphonePermissionGuidance.dataset.state = "prompt";
    microphonePermissionGuidance.textContent = "「続ける」を押すとブラウザの確認画面が表示されます。マイクを使う場合は、そこで「許可」を選択してください。";
    grantMicrophonePermissionButton.textContent = "続ける";
    if (!microphonePermissionDialog.open)
        microphonePermissionDialog.showModal();
}
function showMicrophonePermissionDisabledDialog(reason) {
    microphonePermissionReason = reason;
    microphonePermissionDescription.textContent = "マイクの使用許可が得られなかったため、音声入力をOFFにしました。";
    microphonePermissionGuidance.dataset.state = "disabled";
    microphonePermissionGuidance.textContent = "マイクは現在ブロックされています。\n\niPhone / iPad（Safari）：アドレスバーの「ぁあ」→ Webサイトの設定 → マイク → 許可\nChrome / Android：アドレスバー左のサイト情報 → 権限 → マイク → 許可\n\n設定後、CoachGoの設定で音声入力をONにしてください。";
    grantMicrophonePermissionButton.hidden = true;
    closeMicrophonePermissionButton.hidden = false;
    closeMicrophonePermissionButton.textContent = "閉じる";
    if (!microphonePermissionDialog.open)
        microphonePermissionDialog.showModal();
}
async function ensureMicrophonePermission(reason) {
    if (microphonePermissionGranted)
        return true;
    const permissionState = await readMicrophonePermissionState();
    if (permissionState === "granted") {
        microphonePermissionGranted = true;
        return true;
    }
    if (permissionState === "denied") {
        disableVoiceInputAfterMicrophoneFailure();
        showMicrophonePermissionDisabledDialog(reason);
        return false;
    }
    showMicrophonePermissionDialog(reason);
    return false;
}
function selectHazard(point) {
    selectedHazard = point;
    selectedSharedPoint = null;
}
function sharedPointGuidance(point) {
    const synthetic = point.sourceOrganization === "CoachGo合成デモ";
    if (point.kind === "UNDERPASS") {
        return synthetic
            ? "実在地点ではない合成デモです。通知対象ではありません。"
            : "国土交通省が公開する道路冠水想定箇所です。現在の冠水情報ではありません。大雨時は進入前に道路管理者などの公的情報を確認してください。";
    }
    return synthetic
        ? "実在地点ではない合成デモです。通知対象ではなく、現在の取締り実施も示しません。"
        : "警察公開の交通安全重点地点を概略表示しています。現在取締り実施中を示す情報ではありません。速度と交通ルールを守って走行してください。";
}
function selectSharedPoint(point) {
    selectedSharedPoint = point;
    selectedHazard = null;
}
function clearMapPointSelection() {
    selectedHazard = null;
    selectedSharedPoint = null;
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
    displayPopup([point.longitude, point.latitude], popupContent(point.sourceKind === "USER_REPORT"
        ? `${categoryLabels[point.category]}・未確認`
        : categoryLabels[point.category], point.name, point.note ?? point.evidenceLabel, buildHazardPointGuidance(point), point.sourceKind === "USER_REPORT"));
    selectHazard(point);
}
function showSharedPointPopup(point) {
    const category = point.kind === "UNDERPASS" ? "アンダーパス・道路冠水注意箇所" : "警察・交通安全重点地点";
    const evidence = `${point.evidence} / 出典: ${point.sourceOrganization}${point.sourceUpdatedAt === null ? "" : `（${point.sourceUpdatedAt}更新）`}`;
    displayPopup([point.longitude, point.latitude], popupContent(category, point.name, evidence, sharedPointGuidance(point)));
    selectSharedPoint(point);
}
function categoryIcon(category) {
    return (HAZARD_CATEGORIES.find((candidate) => candidate.id === category)?.icon ??
        USER_REPORT_CATEGORIES.find((candidate) => candidate.id === category)?.icon ??
        "!");
}
function addUserLocationMarker() {
    if (map === null || window.mapboxgl === undefined || userLocationMarker !== null)
        return;
    const userLocationElement = document.createElement("div");
    userLocationElement.className = "user-location";
    userLocationElement.setAttribute("aria-label", "現在地");
    const locationHalo = document.createElement("span");
    locationHalo.className = "user-location-halo";
    const locationArrow = document.createElement("span");
    locationArrow.className = "user-location-arrow";
    locationArrow.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8 20.6 20 12 16.6 3.4 20 12 2.8Z"/></svg>';
    const locationLabel = document.createElement("span");
    locationLabel.className = "user-location-label";
    locationLabel.textContent = "現在地";
    userLocationElement.append(locationHalo, locationArrow, locationLabel);
    userLocationArrow = locationArrow;
    userLocationMarker = new window.mapboxgl.Marker({ element: userLocationElement, anchor: "center" })
        .setLngLat([renderedUserLocation[0], renderedUserLocation[1]])
        .addTo(map);
    updateUserLocationHeading(performance.now());
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
function voiceMonitorPoints(includeDemoFixtures = demoDriveRunning) {
    const route = demoDriveRoute;
    const sampler = demoDriveSampler;
    const demoScenarios = !includeDemoFixtures || route === null || sampler === null
        ? []
        : DEMO_VOICE_SCENARIOS.map((scenario) => {
            const position = sampler.positionAt(scenario.progress);
            return {
                id: scenario.id,
                monitorCategory: scenario.monitorCategory,
                name: scenario.name,
                longitude: position.coordinate[0],
                latitude: position.coordinate[1],
                kind: scenario.kind,
                alertDistanceMeters: 700,
            };
        });
    if (includeDemoFixtures)
        return demoScenarios;
    const shared = (divertNaviMapData?.items ?? []).flatMap((point) => (point.sourceOrganization === "CoachGo合成デモ" ? [] : [{
            id: point.id,
            monitorCategory: point.monitorCategory,
            name: point.name,
            longitude: point.longitude,
            latitude: point.latitude,
            kind: point.kind,
            alertDistanceMeters: point.kind === "POLICE_PRIORITY" ? 800 : 700,
        }]));
    const hazards = allHazards().flatMap((point) => (point.monitorCategory === null || point.sourceKind === "SYNTHETIC_FIXTURE" ? [] : [{
            id: point.id,
            monitorCategory: point.monitorCategory,
            name: point.name,
            longitude: point.longitude,
            latitude: point.latitude,
            kind: "OTHER",
            alertDistanceMeters: 800,
        }]));
    return [...demoScenarios, ...shared, ...hazards];
}
function rebuildDemoRouteApproachIndex() {
    if (demoDriveRoute === null || demoDriveSampler === null) {
        demoRouteApproachIndex = null;
        return;
    }
    const points = voiceMonitorPoints(true);
    const demoCategories = new Set(points.map((point) => point.monitorCategory));
    demoRouteApproachIndex = createRouteApproachIndex(demoDriveRoute, points, demoCategories);
    demoPlaybackStatus.dataset.indexedDemoPoints = String(demoRouteApproachIndex.points.length);
}
function speakMonitorApproach(point) {
    const message = voiceApproachMessage(point);
    demoPlaybackStatus.dataset.lastVoicePoint = point.id;
    demoPlaybackStatus.dataset.lastVoiceAnnouncement = message;
    speakNaturalJapanese(message);
}
function announceDemoStart() {
    const message = "コーチゴーの見守りデモを開始します";
    demoPlaybackStatus.dataset.lastVoicePoint = "demo-start";
    demoPlaybackStatus.dataset.lastVoiceAnnouncement = message;
    speakNaturalJapanese(message, true);
}
function announceDemoStop() {
    const message = "停止しました";
    demoPlaybackStatus.dataset.lastVoicePoint = "demo-stop";
    demoPlaybackStatus.dataset.lastVoiceAnnouncement = message;
    speakNaturalJapanese(message, true);
}
async function requestSystemNotificationPermission() {
    if (window.ReactNativeWebView !== undefined) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "COACHGO_NATIVE_NOTIFICATION_PERMISSION" }));
        renderPermissionStatus();
        return true;
    }
    if (!("Notification" in window)) {
        renderPermissionStatus();
        return false;
    }
    if (window.Notification.permission === "granted")
        return true;
    if (window.Notification.permission === "denied") {
        renderPermissionStatus();
        return false;
    }
    try {
        const permission = await window.Notification.requestPermission();
        renderPermissionStatus();
        return permission === "granted";
    }
    catch {
        renderPermissionStatus();
        return false;
    }
}
function monitorNotification(point) {
    const demoPrefix = point.id.startsWith("demo-voice-") ? "見守りデモ：" : "";
    if (point.kind === "UNDERPASS") {
        return {
            title: `${demoPrefix}道路冠水想定箇所に接近`,
            body: `${point.name}付近です。大雨時は無理に進入せず、道路状況を確認してください。`,
        };
    }
    if (point.kind === "POLICE_PRIORITY") {
        return {
            title: `${demoPrefix}交通安全重点地点に接近`,
            body: `${point.name}付近です。現在の取締り実施を示す情報ではありません。安全運転をお願いします。`,
        };
    }
    return {
        title: `${demoPrefix}${categoryLabels[point.monitorCategory]}の監視地点に接近`,
        body: `${point.name}付近です。周囲の状況に十分注意してください。`,
    };
}
function notifyMonitorApproach(point) {
    const notification = monitorNotification(point);
    notificationTitle.textContent = notification.title;
    notificationBody.textContent = notification.body;
    notificationPreview.hidden = false;
    demoPlaybackStatus.dataset.lastNotificationPoint = point.id;
    demoPlaybackStatus.dataset.lastNotificationTitle = notification.title;
    if (demoDriveRunning) {
        const history = (demoPlaybackStatus.dataset.notificationHistory ?? "")
            .split(",")
            .filter((id) => id.length > 0);
        if (!history.includes(point.id)) {
            history.push(point.id);
            demoPlaybackStatus.dataset.notificationHistory = history.join(",");
        }
    }
    if (window.ReactNativeWebView !== undefined) {
        window.ReactNativeWebView.postMessage(JSON.stringify({
            type: "COACHGO_NATIVE_NOTIFICATION",
            id: point.id,
            category: point.monitorCategory,
            title: notification.title,
            body: notification.body,
        }));
        return;
    }
    if ("Notification" in window && window.Notification.permission === "granted") {
        new window.Notification(notification.title, { body: notification.body, tag: `coachgo-${point.id}` });
    }
}
function checkDemoVoiceApproach(progress, now) {
    if (now - lastVoiceProximityCheckAt < VOICE_PROXIMITY_CHECK_INTERVAL_MS)
        return;
    lastVoiceProximityCheckAt = now;
    if (!approachDetectionEnabled || !demoDriveRunning) {
        activeNearbyPointIds.clear();
        return;
    }
    if (demoRouteApproachIndex === null)
        return;
    const nearby = nearbyIndexedMonitoredPoints(progress, demoRouteApproachIndex);
    const nearbyIds = new Set(nearby.map(({ point }) => point.id));
    const entered = nearby.find(({ point }) => !activeNearbyPointIds.has(point.id));
    activeNearbyPointIds = nearbyIds;
    if (entered === undefined)
        return;
    if (backgroundNotificationEnabled)
        notifyMonitorApproach(entered.point);
    if (hazardVoiceEnabled && now - lastVoiceAnnouncementAt >= VOICE_ANNOUNCEMENT_COOLDOWN_MS) {
        lastVoiceAnnouncementAt = now;
        speakMonitorApproach(entered.point);
    }
}
function checkLiveLocationApproach(location, now) {
    if (demoDriveRunning || now - lastVoiceProximityCheckAt < VOICE_PROXIMITY_CHECK_INTERVAL_MS)
        return;
    lastVoiceProximityCheckAt = now;
    if (!approachDetectionEnabled) {
        activeNearbyPointIds.clear();
        return;
    }
    const nearby = nearbyMonitoredPointsAtLocation(location, voiceMonitorPoints(false), selectedCategories);
    const nearbyIds = new Set(nearby.map(({ point }) => point.id));
    const entered = nearby.find(({ point }) => !activeNearbyPointIds.has(point.id));
    activeNearbyPointIds = nearbyIds;
    if (entered === undefined)
        return;
    // The native background task owns real-location iOS notifications. This avoids
    // a duplicate notification while the foreground WebView is also receiving GPS.
    if (backgroundNotificationEnabled && window.ReactNativeWebView === undefined) {
        notifyMonitorApproach(entered.point);
    }
    if (hazardVoiceEnabled
        && window.ReactNativeWebView === undefined
        && now - lastVoiceAnnouncementAt >= VOICE_ANNOUNCEMENT_COOLDOWN_MS) {
        lastVoiceAnnouncementAt = now;
        speakMonitorApproach(entered.point);
    }
}
function updateUserLocationHeading(now) {
    if (userLocationArrow === null)
        return;
    const moving = movementHeadingDegrees !== null && now <= movementHeadingValidUntil;
    const heading = moving ? movementHeadingDegrees : deviceHeadingDegrees;
    userLocationArrow.dataset.motion = moving ? "moving" : "stationary";
    userLocationArrow.dataset.headingSource = moving ? "movement" : "device";
    if (heading === null)
        return;
    const relativeHeading = screenRelativeUserHeading(heading, map?.getBearing() ?? 0);
    userLocationArrow.style.transform = `rotate(${relativeHeading}deg)`;
    userLocationArrow.dataset.heading = String(Math.round(heading));
}
function updateDeviceHeading(heading) {
    if (!Number.isFinite(heading))
        return;
    deviceHeadingDegrees = (heading + 360) % 360;
    updateUserLocationHeading(performance.now());
}
function animateUserLocation(target, startedAt, duration) {
    const from = renderedUserLocation;
    const sequence = userLocationAnimationSequence + 1;
    userLocationAnimationSequence = sequence;
    const frame = (now) => {
        if (sequence !== userLocationAnimationSequence)
            return;
        const progress = Math.max(0, Math.min(1, (now - startedAt) / duration));
        renderedUserLocation = interpolateUserLocation(from, target, progress);
        userLocationMarker?.setLngLat([renderedUserLocation[0], renderedUserLocation[1]]);
        updateUserLocationHeading(now);
        if (progress < 1) {
            window.requestAnimationFrame(frame);
            return;
        }
        renderedUserLocation = target;
        window.setTimeout(() => { updateUserLocationHeading(performance.now()); }, MOVEMENT_HEADING_HOLD_MS);
    };
    window.requestAnimationFrame(frame);
}
function handleUserLocationSample(target, now, focusOnFirstFix = false) {
    const firstLiveFix = !hasLiveUserLocation;
    currentUserLocation = [target[0], target[1]];
    hasLiveUserLocation = true;
    if (acceptedUserLocation === null) {
        acceptedUserLocation = target;
        renderedUserLocation = target;
        userLocationMarker?.setLngLat([target[0], target[1]]);
        connectionState.dataset.locationMotion = "stationary";
        updateUserLocationHeading(now);
        if (firstLiveFix && focusOnFirstFix) {
            map?.easeTo({ center: [target[0], target[1]], zoom: DEFAULT_LOCATION_ZOOM, pitch: 22, bearing: 0, duration: 650 });
        }
        return;
    }
    const distanceMeters = userLocationDistanceMeters(acceptedUserLocation, target);
    if (!shouldAnimateUserLocation(acceptedUserLocation, target)) {
        movementHeadingValidUntil = -Infinity;
        connectionState.dataset.locationMotion = "stationary";
        updateUserLocationHeading(now);
        return;
    }
    const duration = userLocationAnimationDuration(distanceMeters);
    movementHeadingDegrees = userLocationMovementBearing(acceptedUserLocation, target);
    movementHeadingValidUntil = now + duration + MOVEMENT_HEADING_HOLD_MS;
    acceptedUserLocation = target;
    connectionState.dataset.locationMotion = "moving";
    connectionState.dataset.locationDistanceMeters = distanceMeters.toFixed(1);
    animateUserLocation(target, now, duration);
}
function handleDeviceOrientation(event) {
    const compassEvent = event;
    if (typeof compassEvent.webkitCompassHeading === "number") {
        updateDeviceHeading(compassEvent.webkitCompassHeading);
        return;
    }
    if (event.absolute && typeof event.alpha === "number") {
        const screenAngle = window.screen.orientation?.angle ?? 0;
        updateDeviceHeading(360 - event.alpha + screenAngle);
    }
}
function requestDeviceHeadingPermission() {
    const constructor = window.DeviceOrientationEvent;
    if (typeof constructor?.requestPermission !== "function")
        return;
    void constructor.requestPermission()
        .then((permission) => {
        connectionState.dataset.headingPermission = permission;
    })
        .catch(() => {
        connectionState.dataset.headingPermission = "error";
    });
}
window.addEventListener("deviceorientationabsolute", handleDeviceOrientation);
window.addEventListener("deviceorientation", handleDeviceOrientation);
window.addEventListener("coachgo:native-heading", ((event) => {
    const detail = event.detail;
    if (typeof detail?.heading === "number")
        updateDeviceHeading(detail.heading);
}));
function stopForegroundLocationMonitoring() {
    if (foregroundLocationWatchId === null || !("geolocation" in navigator))
        return;
    navigator.geolocation.clearWatch(foregroundLocationWatchId);
    foregroundLocationWatchId = null;
    connectionState.dataset.locationWatch = "stopped";
}
function startForegroundLocationMonitoring() {
    if (!approachDetectionEnabled || foregroundLocationWatchId !== null)
        return;
    if (!("geolocation" in navigator)) {
        connectionState.dataset.locationWatch = "unsupported";
        return;
    }
    foregroundLocationWatchId = navigator.geolocation.watchPosition((position) => {
        const longitude = position.coords.longitude;
        const latitude = position.coords.latitude;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude))
            return;
        const location = [longitude, latitude];
        const now = performance.now();
        handleUserLocationSample(location, now, true);
        connectionState.dataset.locationWatch = "active";
        renderPermissionStatus();
        checkLiveLocationApproach(location, now);
    }, (error) => {
        connectionState.dataset.locationWatch = error.code === error.PERMISSION_DENIED ? "denied" : "error";
        renderPermissionStatus();
    }, { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 });
    connectionState.dataset.locationWatch = "starting";
    renderPermissionStatus();
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
function categoryMarkerColor(category) {
    const reportCategory = USER_REPORT_CATEGORIES.find((candidate) => candidate.id === category);
    if (reportCategory !== undefined)
        return reportCategory.color;
    const monitorColors = {
        ROAD_FLOODING: "#007bff",
        RIVER_FLOODING: "#1f9aaa",
        LANDSLIDE: "#a86b2e",
        TSUNAMI: "#7c5ce5",
        POLICE_ENFORCEMENT: "#7540c8",
        RAIN_CLOUD: "#3478d4",
    };
    return monitorColors[category];
}
function categoryClusterLayerIds(category) {
    if (category === "ROAD_FLOODING") {
        return {
            source: UNDERPASS_SOURCE_ID,
            cluster: UNDERPASS_CLUSTER_LAYER_ID,
            count: UNDERPASS_CLUSTER_COUNT_LAYER_ID,
            point: UNDERPASS_POINT_LAYER_ID,
            image: ROAD_FLOODING_MARKER_IMAGE_ID,
        };
    }
    const slug = category.toLowerCase().replaceAll("_", "-");
    return {
        source: `coachgo-${slug}-points`,
        cluster: `coachgo-${slug}-clusters`,
        count: `coachgo-${slug}-cluster-count`,
        point: `coachgo-${slug}-unclustered`,
        image: `coachgo-${slug}-category-icon`,
    };
}
function clusteredHazardFeatureCollection(category) {
    const hazardFeatures = allHazards()
        .filter((point) => point.category === category)
        .map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        properties: { pointId: point.id, pointType: "hazard" },
    }));
    const sharedFeatures = (divertNaviMapData?.items ?? [])
        .filter((point) => point.monitorCategory === category)
        .map((point) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [point.longitude, point.latitude] },
        properties: { pointId: point.id, pointType: "shared" },
    }));
    return { type: "FeatureCollection", features: [...hazardFeatures, ...sharedFeatures] };
}
function clusteredCategoryVisible(category) {
    const monitorCategory = HAZARD_CATEGORIES.find((candidate) => candidate.id === category);
    return monitorCategory === undefined || selectedCategories.has(monitorCategory.id);
}
function showClusteredPoint(pointId, pointType) {
    if (pointType === "shared") {
        const point = divertNaviMapData?.items.find((candidate) => candidate.id === pointId);
        if (point !== undefined)
            showSharedPointPopup(point);
        return;
    }
    const point = allHazards().find((candidate) => candidate.id === pointId);
    if (point !== undefined)
        showHazardPopup(point);
}
function addClusteredHazardCategory(category) {
    if (map === null)
        return;
    const data = clusteredHazardFeatureCollection(category);
    const ids = categoryClusterLayerIds(category);
    const existingSource = map.getSource(ids.source);
    if (existingSource !== undefined) {
        existingSource.setData(data);
    }
    else {
        if (data.features.length === 0)
            return;
        map.addSource(ids.source, {
            type: "geojson",
            data,
            cluster: true,
            clusterMaxZoom: HAZARD_CLUSTER_MAX_ZOOM,
            clusterRadius: HAZARD_CLUSTER_RADIUS,
        });
        if (!map.hasImage(ids.image)) {
            map.addImage(ids.image, createCategoryMarkerImage(categoryIcon(category), categoryMarkerColor(category)), { pixelRatio: 2 });
        }
        map.addLayer({
            id: ids.cluster,
            type: "symbol",
            source: ids.source,
            filter: ["has", "point_count"],
            layout: {
                "icon-image": ids.image,
                "icon-size": ["step", ["get", "point_count"], 0.95, 20, 1.12, 100, 1.28],
                "icon-allow-overlap": true,
            },
        });
        map.addLayer({
            id: ids.count,
            type: "symbol",
            source: ids.source,
            filter: ["has", "point_count"],
            layout: {
                "text-field": ["get", "point_count_abbreviated"],
                "text-size": 12,
                "text-offset": [0, 2.2],
                "text-allow-overlap": true,
            },
            paint: { "text-color": categoryMarkerColor(category), "text-halo-color": "#ffffff", "text-halo-width": 2 },
        });
        map.addLayer({
            id: ids.point,
            type: "symbol",
            source: ids.source,
            filter: ["!", ["has", "point_count"]],
            layout: {
                "icon-image": ids.image,
                "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.65, 15, 0.95],
                "icon-allow-overlap": false,
            },
        });
        map.on("click", ids.cluster, (event) => {
            const feature = event.features?.[0];
            if (feature?.geometry?.type !== "Point" || !Array.isArray(feature.geometry.coordinates))
                return;
            const [longitude, latitude] = feature.geometry.coordinates;
            if (typeof longitude !== "number" || typeof latitude !== "number")
                return;
            map?.easeTo({ center: [longitude, latitude], zoom: Math.min((map?.getZoom() ?? 10) + 2, 15), duration: 420 });
        });
        map.on("click", ids.point, (event) => {
            const feature = event.features?.[0];
            const pointId = feature?.properties?.pointId;
            const pointType = feature?.properties?.pointType;
            if (typeof pointId === "string" && typeof pointType === "string")
                showClusteredPoint(pointId, pointType);
        });
        for (const layerId of [ids.cluster, ids.point]) {
            map.on("mouseenter", layerId, () => { if (map !== null)
                map.getCanvas().style.cursor = "pointer"; });
            map.on("mouseleave", layerId, () => { if (map !== null)
                map.getCanvas().style.cursor = ""; });
        }
    }
    const visibility = clusteredCategoryVisible(category) ? "visible" : "none";
    for (const layerId of [ids.cluster, ids.count, ids.point]) {
        if (map.getLayer(layerId) !== undefined)
            map.setLayoutProperty(layerId, "visibility", visibility);
    }
}
function renderClusteredHazardLayers() {
    if (map === null || !initialMapLoadCompleted)
        return;
    for (const category of CLUSTERED_HAZARD_CATEGORIES)
        addClusteredHazardCategory(category);
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
function focusDemoVehicle(duration = 750) {
    if (map === null || demoDriveSampler === null)
        return;
    const position = demoDriveSampler.positionAt(demoDriveProgress, DEMO_BEARING_LOOKAHEAD_METERS);
    demoSmoothedBearing = position.bearing;
    map.easeTo({
        center: [position.coordinate[0], position.coordinate[1]],
        zoom: 15.2,
        pitch: 44,
        bearing: position.bearing,
        duration,
    });
    demoCameraFollowStartsAt = performance.now() + duration;
    lastDemoCameraFrameAt = -Infinity;
}
function resetDemoRenderQuality() {
    demoRenderQuality = "HIGH";
    demoFrameDurations = [];
    lastDemoCameraFrameAt = -Infinity;
    demoPlaybackStatus.dataset.renderQuality = "high";
}
function recordDemoFrameDuration(elapsed) {
    if (elapsed <= 0 || !Number.isFinite(elapsed))
        return;
    demoFrameDurations.push(Math.min(elapsed, 250));
    if (demoFrameDurations.length < DEMO_FRAME_QUALITY_SAMPLE_SIZE)
        return;
    const average = demoFrameDurations.reduce((sum, duration) => sum + duration, 0) / demoFrameDurations.length;
    const longFrames = demoFrameDurations.filter((duration) => duration >= 34).length;
    demoFrameDurations = [];
    demoPlaybackStatus.dataset.averageFrameMs = average.toFixed(1);
    if (demoRenderQuality === "HIGH" && (average > 22 || longFrames >= 4)) {
        demoRenderQuality = "BALANCED";
        demoPlaybackStatus.dataset.renderQuality = "balanced";
        map?.jumpTo({ pitch: 30 });
    }
}
function followDemoVehicle(position, now) {
    const cameraInterval = demoRenderQuality === "HIGH" ? 0 : DEMO_BALANCED_CAMERA_INTERVAL_MS;
    if (map === null
        || !demoDriveRunning
        || now < demoCameraFollowStartsAt
        || now - lastDemoCameraFrameAt < cameraInterval)
        return;
    lastDemoCameraFrameAt = now;
    map.jumpTo({
        center: [position.coordinate[0], position.coordinate[1]],
        bearing: position.bearing,
    });
}
function createDemoVehicleElement(labelText) {
    const element = document.createElement("div");
    element.className = "continuous-demo-vehicle";
    element.setAttribute("role", "img");
    element.setAttribute("aria-label", "横浜駅から本厚木駅へ走行中のデモ車両");
    const graphic = document.createElement("span");
    graphic.className = "continuous-demo-vehicle-graphic";
    graphic.innerHTML = '<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 3 31 30l-11-5-11 5L20 3Z"/><path class="vehicle-window" d="m20 9 5 13-5-2.2-5 2.2 5-13Z"/></svg>';
    const label = document.createElement("span");
    label.className = "continuous-demo-vehicle-label";
    label.textContent = labelText;
    element.append(graphic, label);
    return { element, graphic };
}
function setDemoVehiclePresentation(running) {
    if (demoDriveMarkerElement !== null)
        demoDriveMarkerElement.hidden = running;
    if (demoVehicleOverlay !== null)
        demoVehicleOverlay.hidden = !running;
    if (!running && demoDriveMarker !== null && demoDriveSampler !== null) {
        const position = demoDriveSampler.positionAt(demoDriveProgress, DEMO_BEARING_LOOKAHEAD_METERS);
        demoDriveMarker.setLngLat([position.coordinate[0], position.coordinate[1]]);
        if (demoVehicleGraphic !== null) {
            const mapBearing = map?.getBearing() ?? 0;
            demoVehicleGraphic.style.transform = `rotate(${screenRelativeBearing(position.bearing, mapBearing)}deg)`;
        }
    }
}
function createDemoVehicleMarker() {
    if (map === null || window.mapboxgl === undefined || demoDriveMarker !== null)
        return;
    const markerVehicle = createDemoVehicleElement("デモ走行");
    demoDriveMarkerElement = markerVehicle.element;
    demoVehicleGraphic = markerVehicle.graphic;
    demoDriveMarker = new window.mapboxgl.Marker({ element: markerVehicle.element, anchor: "center" })
        .setLngLat([YOKOHAMA_STATION[0], YOKOHAMA_STATION[1]])
        .addTo(map);
    const overlayVehicle = createDemoVehicleElement("デモ走行");
    overlayVehicle.element.classList.add("continuous-demo-vehicle-overlay");
    overlayVehicle.element.hidden = true;
    map.getContainer().append(overlayVehicle.element);
    demoVehicleOverlay = overlayVehicle.element;
    demoVehicleOverlayGraphic = overlayVehicle.graphic;
}
function animateContinuousDemoDrive() {
    if (demoDriveAnimationStarted
        || !demoDriveRunning
        || demoDriveRoute === null
        || demoDriveSampler === null
        || demoDriveMarker === null)
        return;
    demoDriveAnimationStarted = true;
    const tick = (now) => {
        if (!demoDriveRunning || demoDriveRoute === null || demoDriveSampler === null || demoDriveMarker === null) {
            demoDriveAnimationStarted = false;
            demoDriveLastFrameAt = null;
            return;
        }
        const elapsed = demoDriveLastFrameAt === null ? 0 : now - demoDriveLastFrameAt;
        demoDriveLastFrameAt = now;
        recordDemoFrameDuration(elapsed);
        demoDriveProgress = advanceDemoProgress(demoDriveProgress, elapsed, DEMO_DRIVE_DURATION_MS, demoDriveRunning);
        const target = demoDriveSampler.positionAt(demoDriveProgress, DEMO_BEARING_LOOKAHEAD_METERS);
        demoSmoothedBearing = demoSmoothedBearing === null
            ? target.bearing
            : smoothBearing(demoSmoothedBearing, target.bearing, elapsed, DEMO_BEARING_RESPONSE_MS);
        const position = { coordinate: target.coordinate, bearing: demoSmoothedBearing };
        followDemoVehicle(position, now);
        if (demoVehicleOverlayGraphic !== null) {
            const mapBearing = map?.getBearing() ?? 0;
            demoVehicleOverlayGraphic.style.transform = `rotate(${screenRelativeBearing(position.bearing, mapBearing)}deg)`;
        }
        if (now - lastDemoUiUpdateAt >= DEMO_UI_UPDATE_INTERVAL_MS) {
            lastDemoUiUpdateAt = now;
            demoPlaybackStatus.dataset.demoProgress = String(Math.floor(demoDriveProgress * 100));
            demoPlaybackStatus.dataset.vehicleLongitude = position.coordinate[0].toFixed(6);
            demoPlaybackButton.dataset.completedCategories = String(Math.floor(demoDriveProgress * 100));
        }
        checkDemoVoiceApproach(demoDriveProgress, now);
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
    demoDriveSampler = createDemoRouteSampler(demoDriveRoute);
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
    rebuildDemoRouteApproachIndex();
    demoPlaybackStatus.dataset.routeMode = routeMode;
    demoPlaybackButton.disabled = false;
    renderDemoPlaybackState();
    renderDemoMapVisibility();
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
        renderMap();
        if (hasLiveUserLocation && !demoDriveRunning) {
            activeNearbyPointIds.clear();
            lastVoiceProximityCheckAt = 0;
            checkLiveLocationApproach(currentUserLocation, performance.now());
        }
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
            center: currentUserLocation,
            zoom: DEFAULT_LOCATION_ZOOM,
            pitch: 22,
            bearing: 0,
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
            addUserLocationMarker();
            updateDemoPlaybackAvailability();
            renderMap();
            void initializeContinuousDemoDrive(token);
        });
        map.on("rotate", () => { updateUserLocationHeading(performance.now()); });
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
    renderClusteredHazardLayers();
    updateRainViewerLayer();
    if (selectedSharedPoint !== null && !selectedCategories.has(selectedSharedPoint.monitorCategory)) {
        removeActiveMapPopup();
    }
    if (selectedHazard !== null && !visible.some((point) => point.id === selectedHazard?.id)) {
        removeActiveMapPopup();
    }
}
openSettingsButton.addEventListener("click", () => {
    setPanelOpen(!categoryPanel.classList.contains("open"));
});
closePanelButton.addEventListener("click", () => setPanelOpen(false));
panelBackdrop.addEventListener("click", () => setPanelOpen(false));
document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && categoryPanel.classList.contains("open"))
        setPanelOpen(false);
});
panelScroll.addEventListener("touchstart", (event) => {
    if (!window.matchMedia(MOBILE_PANEL_QUERY).matches || !categoryPanel.classList.contains("open"))
        return;
    if (panelScroll.scrollTop > 0 || event.touches.length !== 1)
        return;
    const touch = event.touches[0];
    if (touch === undefined)
        return;
    panelTouchStartY = touch.clientY;
    panelTouchLastY = touch.clientY;
    panelTouchStartedAt = performance.now();
    panelTouchDragging = false;
}, { passive: true });
panelScroll.addEventListener("touchmove", (event) => {
    if (panelTouchStartY === null || event.touches.length !== 1)
        return;
    const touch = event.touches[0];
    if (touch === undefined)
        return;
    panelTouchLastY = touch.clientY;
    const dragDistance = Math.max(0, touch.clientY - panelTouchStartY);
    if (dragDistance < 6)
        return;
    panelTouchDragging = true;
    event.preventDefault();
    categoryPanel.classList.add("dragging");
    categoryPanel.style.setProperty("--sheet-drag-y", `${dragDistance}px`);
}, { passive: false });
function finishPanelSwipe() {
    if (panelTouchStartY === null || panelTouchLastY === null) {
        resetPanelDrag();
        return;
    }
    const dragDistance = Math.max(0, panelTouchLastY - panelTouchStartY);
    const elapsed = Math.max(1, performance.now() - panelTouchStartedAt);
    const shouldClose = panelTouchDragging && (dragDistance >= 88 || dragDistance / elapsed >= 0.55);
    resetPanelDrag();
    if (shouldClose)
        setPanelOpen(false);
}
panelScroll.addEventListener("touchend", finishPanelSwipe, { passive: true });
panelScroll.addEventListener("touchcancel", () => resetPanelDrag(), { passive: true });
window.matchMedia(MOBILE_PANEL_QUERY).addEventListener("change", () => setPanelOpen(false));
setPanelOpen(false);
approachDetectionToggle.addEventListener("click", () => {
    approachDetectionEnabled = !approachDetectionEnabled;
    if (!approachDetectionEnabled) {
        notificationPreview.hidden = true;
        cancelNaturalJapaneseSpeech();
        activeNearbyPointIds.clear();
        stopForegroundLocationMonitoring();
    }
    else {
        startForegroundLocationMonitoring();
    }
    renderPermissionStatus();
});
backgroundNotificationToggle.addEventListener("click", () => {
    backgroundNotificationEnabled = !backgroundNotificationEnabled;
    if (backgroundNotificationEnabled) {
        void requestSystemNotificationPermission();
        activeNearbyPointIds.clear();
        lastVoiceProximityCheckAt = 0;
        if (hasLiveUserLocation)
            checkLiveLocationApproach(currentUserLocation, performance.now());
    }
    renderPermissionStatus();
});
hazardVoiceToggle.addEventListener("click", () => {
    hazardVoiceEnabled = !hazardVoiceEnabled;
    if (!hazardVoiceEnabled) {
        cancelNaturalJapaneseSpeech();
        demoPlaybackStatus.dataset.voiceState = "muted";
        activeNearbyPointIds.clear();
    }
    else {
        activeNearbyPointIds.clear();
        lastVoiceProximityCheckAt = 0;
        if (hasLiveUserLocation)
            checkLiveLocationApproach(currentUserLocation, performance.now());
    }
    renderPermissionStatus();
});
largeReportIconToggle.addEventListener("click", () => {
    largeReportIconEnabled = !largeReportIconEnabled;
    persistInputSettings();
    renderInputSettings();
});
voiceInputToggle.addEventListener("click", () => {
    voiceInputEnabled = !voiceInputEnabled;
    persistInputSettings();
    if (!voiceInputEnabled) {
        stopVoiceCommandRecognition();
        activeVoiceRecognition?.abort();
        if (microphonePermissionDialog.open)
            microphonePermissionDialog.close();
        inputPermissionStatus.dataset.state = "off";
        inputPermissionStatus.textContent = "音声入力はOFFです。投稿ボタンとカテゴリー選択は利用できます。";
    }
    else {
        void ensureMicrophonePermission("settings").then((permissionGranted) => {
            if (permissionGranted) {
                scheduleVoiceCommandRecognition(250);
                renderInputSettings();
            }
        });
    }
    renderInputSettings();
});
demoVisibilityToggle.addEventListener("click", () => {
    demoVisibilityEnabled = !demoVisibilityEnabled;
    if (!demoVisibilityEnabled && demoDriveRunning)
        demoPlaybackButton.click();
    persistInputSettings();
    renderInputSettings();
    if (demoVisibilityEnabled)
        focusContinuousDemoRoute();
    else
        returnToCurrentLocation();
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
        activeNearbyPointIds.clear();
        lastVoiceProximityCheckAt = 0;
        if (hasLiveUserLocation && !demoDriveRunning) {
            checkLiveLocationApproach(currentUserLocation, performance.now());
        }
    });
}
demoPlaybackButton.addEventListener("click", () => {
    demoDriveRunning = !demoDriveRunning;
    demoDriveLastFrameAt = null;
    if (!demoDriveRunning) {
        cancelNaturalJapaneseSpeech();
        announceDemoStop();
        setDemoVehiclePresentation(false);
        activeNearbyPointIds.clear();
        lastVoiceProximityCheckAt = 0;
        if (hasLiveUserLocation)
            checkLiveLocationApproach(currentUserLocation, performance.now());
    }
    else {
        demoDriveProgress = 0;
        demoPlaybackStatus.dataset.notificationHistory = "";
        demoSmoothedBearing = null;
        lastDemoUiUpdateAt = -Infinity;
        resetDemoRenderQuality();
        setDemoVehiclePresentation(true);
        activeNearbyPointIds.clear();
        lastVoiceAnnouncementAt = -Infinity;
        lastVoiceProximityCheckAt = 0;
    }
    renderDemoPlaybackState();
    if (demoDriveRunning) {
        if (backgroundNotificationEnabled)
            void requestSystemNotificationPermission();
        focusDemoVehicle();
        announceDemoStart();
        animateContinuousDemoDrive();
    }
});
requiredElement("#dismiss-notification").addEventListener("click", () => {
    notificationPreview.hidden = true;
});
function openRegistrationDialog(startListening) {
    stopVoiceCommandRecognition();
    registrationError.textContent = "";
    voiceReportStatus.dataset.state = "idle";
    voiceReportStatus.textContent = voiceInputEnabled
        ? "「音声で危険を登録」を押して、危険の種類を話してください。"
        : "音声入力はOFFです。カテゴリーを押して登録してください。";
    voiceReportTranscript.hidden = true;
    voiceReportTranscript.textContent = "";
    if (!registrationDialog.open)
        registrationDialog.showModal();
    if (startListening && voiceInputEnabled) {
        window.setTimeout(() => startHazardVoiceRecognition(), 220);
    }
}
registerHazardButton.addEventListener("click", () => {
    openRegistrationDialog(false);
});
requiredElement("#close-registration").addEventListener("click", () => {
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
    const recognition = activeVoiceRecognition;
    activeVoiceRecognition = null;
    recognition?.stop();
    registrationDialog.close();
    setPanelOpen(false);
    renderMap();
    showUndoReport(report);
    speakReportConfirmation(categoryLabels[category]);
    scheduleVoiceCommandRecognition(1_000);
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
async function startHazardVoiceRecognition() {
    if (!voiceInputEnabled) {
        voiceReportStatus.dataset.state = "error";
        voiceReportStatus.textContent = "音声入力がOFFです。入力設定からONにしてください。";
        return;
    }
    if (activeVoiceRecognition !== null) {
        activeVoiceRecognition.stop();
        return;
    }
    if (microphonePermissionRequestPending)
        return;
    stopVoiceCommandRecognition();
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (Recognition === undefined) {
        voiceReportStatus.dataset.state = "error";
        voiceReportStatus.textContent = "このブラウザは音声入力に対応していません。Chromeでお試しください。";
        return;
    }
    const permissionGranted = await ensureMicrophonePermission("voice-report");
    if (!permissionGranted || !registrationDialog.open)
        return;
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
        registerSessionHazard(match.category, currentUserLocation);
    };
    recognition.onerror = (event) => {
        voiceReportStatus.dataset.state = "error";
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
            disableVoiceInputAfterMicrophoneFailure();
            showMicrophonePermissionDisabledDialog("voice-report");
            return;
        }
        voiceReportStatus.textContent = event.error === "not-allowed" || event.error === "service-not-allowed"
            ? "音声登録にはマイクの許可が必要です。サイト設定でマイクを許可してください。"
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
}
voiceReportButton.addEventListener("click", () => {
    void startHazardVoiceRecognition();
});
grantMicrophonePermissionButton.addEventListener("click", async () => {
    if (microphonePermissionRequestPending)
        return;
    microphonePermissionRequestPending = true;
    grantMicrophonePermissionButton.disabled = true;
    grantMicrophonePermissionButton.textContent = "許可を確認しています…";
    const permissionGranted = await requestMicrophonePermission();
    microphonePermissionRequestPending = false;
    grantMicrophonePermissionButton.disabled = false;
    if (!permissionGranted) {
        showMicrophonePermissionDisabledDialog(microphonePermissionReason);
        return;
    }
    microphonePermissionDialog.close();
    renderInputSettings();
    if (microphonePermissionReason === "voice-report" && registrationDialog.open) {
        void startHazardVoiceRecognition();
    }
    else {
        scheduleVoiceCommandRecognition(250);
    }
});
closeMicrophonePermissionButton.addEventListener("click", () => {
    microphonePermissionDialog.close();
});
microphonePermissionDialog.addEventListener("cancel", (event) => {
    if (closeMicrophonePermissionButton.hidden)
        event.preventDefault();
});
registrationDialog.addEventListener("close", () => {
    const recognition = activeVoiceRecognition;
    activeVoiceRecognition = null;
    recognition?.abort();
    scheduleVoiceCommandRecognition();
});
document.addEventListener("visibilitychange", () => {
    if (document.hidden)
        stopVoiceCommandRecognition();
    else
        scheduleVoiceCommandRecognition(250);
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
function showCurrentLocationOnMap(location, message) {
    map?.easeTo({ center: [location[0], location[1]], zoom: DEFAULT_LOCATION_ZOOM, pitch: 22, bearing: 0, duration: 650 });
    locationStatus.textContent = message;
    window.setTimeout(() => { locationStatus.hidden = true; }, 2_500);
}
function returnToCurrentLocation() {
    requestDeviceHeadingPermission();
    locationStatus.hidden = false;
    locationStatus.textContent = "現在地を取得中…";
    if (hasLiveUserLocation) {
        showCurrentLocationOnMap(currentUserLocation, "現在地に戻りました。");
        return;
    }
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
        const location = [longitude, latitude];
        const now = performance.now();
        handleUserLocationSample(location, now);
        checkLiveLocationApproach(location, now);
        showCurrentLocationOnMap(location, "現在地を表示しました。");
    }, (error) => {
        locationStatus.textContent = error.code === error.PERMISSION_DENIED
            ? "現在地の表示には位置情報の許可が必要です。"
            : "現在地を取得できませんでした。通信状態をご確認ください。";
    }, { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 });
}
recenterMapButton.addEventListener("click", returnToCurrentLocation);
renderPermissionStatus();
renderInputSettings();
renderMap();
void loadDivertNaviMapData();
initializeMapbox();
async function requestEnabledPermissionsAtStartup() {
    if (voiceInputEnabled) {
        const permissionState = await readMicrophonePermissionState();
        if (permissionState === "granted") {
            microphonePermissionGranted = true;
            scheduleVoiceCommandRecognition(250);
            renderInputSettings();
        }
    }
    if (backgroundNotificationEnabled)
        await requestSystemNotificationPermission();
    if (approachDetectionEnabled)
        startForegroundLocationMonitoring();
}
void requestEnabledPermissionsAtStartup();
//# sourceMappingURL=demo.js.map