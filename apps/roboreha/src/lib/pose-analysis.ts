import type { NormalizedLandmark, PoseLandmarker } from "@mediapipe/tasks-vision";

export const ROBOREHA_POSE_ENGINE = "roboreha-pose-lite-1.1";
const publicBasePath = (
  process.env.NEXT_PUBLIC_ROBOREHA_BASE_PATH?.trim() ?? ""
).replace(/\/$/, "");
const publicAssetPath = (path: string) => `${publicBasePath}${path}`;

export type PosePoint = { x: number; y: number; z: number; visibility: number };
export type TrackedPose = {
  trackId: string;
  landmarks: PosePoint[];
  center: { x: number; y: number };
  bounds: { left: number; top: number; right: number; bottom: number };
  confidence: number;
};
export type PoseFrame = { timeSeconds: number; poses: TrackedPose[] };
export type PoseTrackSummary = {
  trackId: string;
  appearances: number;
  coveragePercent: number;
  averageConfidence: number;
  averageX: number;
};
export type VideoPoseAnalysis = {
  durationSeconds: number;
  width: number;
  height: number;
  sampledFps: number;
  frames: PoseFrame[];
  tracks: PoseTrackSummary[];
  previewDataUrl: string;
  previewPoses: TrackedPose[];
};
export type GaitMetrics = {
  walkingTimeSeconds: number | null;
  walkingSpeedMps: number | null;
  stepCount: number | null;
  cadenceSpm: number | null;
  leftStepLengthM: number | null;
  rightStepLengthM: number | null;
  symmetryPercent: number | null;
  trunkLeanDegrees: number | null;
  leftKneeFlexionDegrees: number | null;
  rightKneeFlexionDegrees: number | null;
  helperOverlapPercent: number | null;
  confidence: number;
};
export type GaitSummary = {
  metrics: GaitMetrics;
  qualityFlags: string[];
  poseSummary: Record<string, unknown>;
};
export type PoseMaximumMetrics = {
  waistAngleDegrees: number | null;
  kneeAngleDegrees: number | null;
  heelAngleDegrees: number | null;
  accelerationMps2: number | null;
  strideLengthM: number | null;
  confidence: number;
};

export const POSE_CONNECTIONS: Array<[number, number]> = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [27, 29], [29, 31],
  [24, 26], [26, 28], [28, 30], [30, 32],
];

let landmarkerPromise: Promise<PoseLandmarker> | null = null;
let nextVideoTimestampMs = 0;

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = import("@mediapipe/tasks-vision").then(async ({ FilesetResolver, PoseLandmarker }) => {
      const files = await FilesetResolver.forVisionTasks(publicAssetPath("/wasm/mediapipe"));
      return PoseLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: publicAssetPath("/models/pose_landmarker_lite.task") },
        runningMode: "VIDEO",
        numPoses: 2,
        minPoseDetectionConfidence: 0.35,
        minPosePresenceConfidence: 0.35,
        minTrackingConfidence: 0.35,
        outputSegmentationMasks: false,
      });
    });
  }
  return landmarkerPromise;
}

function waitFor(video: HTMLVideoElement, event: "loadedmetadata" | "seeked") {
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timeout);
      video.removeEventListener(event, done);
      video.removeEventListener("error", failed);
    };
    const done = () => { cleanup(); resolve(); };
    const failed = () => {
      const mediaError = video.error;
      cleanup();
      reject(new Error(
        mediaError?.code === MediaError.MEDIA_ERR_DECODE
          ? "動画の映像形式をブラウザで再生できませんでした。"
          : "動画を読み込めませんでした。",
      ));
    };
    const timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error("動画の読み込みがタイムアウトしました。"));
    }, 15_000);
    video.addEventListener(event, done, { once: true });
    video.addEventListener("error", failed, { once: true });
  });
}

function isBrowserVideoLoadFailure(reason: unknown) {
  if (!(reason instanceof Error)) return false;
  return [
    "動画を読み込めませんでした",
    "動画の映像形式をブラウザで再生できませんでした",
    "動画の読み込みがタイムアウトしました",
    "動画の再生時間を取得できませんでした",
  ].some((message) => reason.message.includes(message));
}

async function normalizeVideoForBrowser(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch(publicAssetPath("/api/video-normalize"), {
    method: "POST",
    body: form,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "動画をブラウザ再生用MP4へ変換できませんでした。");
  }
  const blob = await response.blob();
  const baseName = file.name.replace(/\.[^.]+$/, "") || "walking-video";
  return new File([blob], `${baseName}.mp4`, {
    type: "video/mp4",
    lastModified: Date.now(),
  });
}

export type BrowserCompatibleVideoAnalysis = {
  analysis: VideoPoseAnalysis;
  file: File;
  normalized: boolean;
};

export async function analyzeVideoFileWithFallback(
  file: File,
  onProgress?: (percent: number) => void,
  onNormalize?: () => void,
): Promise<BrowserCompatibleVideoAnalysis> {
  try {
    return {
      analysis: await analyzeVideoFile(file, onProgress),
      file,
      normalized: false,
    };
  } catch (reason) {
    if (!isBrowserVideoLoadFailure(reason)) throw reason;
    onNormalize?.();
    onProgress?.(0);
    const normalizedFile = await normalizeVideoForBrowser(file);
    return {
      analysis: await analyzeVideoFile(normalizedFile, onProgress),
      file: normalizedFile,
      normalized: true,
    };
  }
}

function pointVisibility(point: NormalizedLandmark) {
  return Number.isFinite(point.visibility) ? Number(point.visibility) : 0.5;
}

function toTrackedPose(landmarks: NormalizedLandmark[], trackId: string): TrackedPose {
  const points = landmarks.map((point) => ({ x: point.x, y: point.y, z: point.z, visibility: pointVisibility(point) }));
  const visible = points.filter((point) => point.visibility >= 0.25);
  const xs = visible.map((point) => point.x);
  const ys = visible.map((point) => point.y);
  const hipLeft = points[23];
  const hipRight = points[24];
  const center = hipLeft && hipRight
    ? { x: (hipLeft.x + hipRight.x) / 2, y: (hipLeft.y + hipRight.y) / 2 }
    : { x: xs.reduce((sum, value) => sum + value, 0) / Math.max(xs.length, 1), y: ys.reduce((sum, value) => sum + value, 0) / Math.max(ys.length, 1) };
  return {
    trackId,
    landmarks: points,
    center,
    bounds: {
      left: Math.min(...xs, center.x), top: Math.min(...ys, center.y),
      right: Math.max(...xs, center.x), bottom: Math.max(...ys, center.y),
    },
    confidence: visible.reduce((sum, point) => sum + point.visibility, 0) / Math.max(visible.length, 1),
  };
}

function assignTracks(
  rawPoses: NormalizedLandmark[][],
  active: Map<string, { x: number; y: number; lastTime: number }>,
  timestamp: number,
  nextTrack: { value: number },
) {
  const assigned = new Set<string>();
  return rawPoses.map((landmarks) => {
    const left = landmarks[23];
    const right = landmarks[24];
    const center = left && right ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 } : { x: 0.5, y: 0.5 };
    let bestId = "";
    let bestDistance = 0.34;
    for (const [id, previous] of active) {
      if (assigned.has(id) || timestamp - previous.lastTime > 4.5) continue;
      const distance = Math.hypot(center.x - previous.x, center.y - previous.y);
      if (distance < bestDistance) { bestDistance = distance; bestId = id; }
    }
    if (!bestId) bestId = `person-${nextTrack.value++}`;
    assigned.add(bestId);
    active.set(bestId, { ...center, lastTime: timestamp });
    return toTrackedPose(landmarks, bestId);
  });
}

function drawPreview(video: HTMLVideoElement, poses: TrackedPose[]) {
  const width = Math.min(video.videoWidth || 1280, 960);
  const height = Math.round(width * (video.videoHeight || 720) / Math.max(video.videoWidth || 1280, 1));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  context.drawImage(video, 0, 0, width, height);
  const colors = ["#19d39b", "#ff9b43", "#58a6ff", "#e879f9"];
  poses.forEach((pose, index) => {
    context.strokeStyle = colors[index % colors.length];
    context.fillStyle = colors[index % colors.length];
    context.lineWidth = Math.max(2, width / 320);
    POSE_CONNECTIONS.forEach(([start, end]) => {
      const a = pose.landmarks[start];
      const b = pose.landmarks[end];
      if (!a || !b || a.visibility < 0.25 || b.visibility < 0.25) return;
      context.beginPath(); context.moveTo(a.x * width, a.y * height); context.lineTo(b.x * width, b.y * height); context.stroke();
    });
    pose.landmarks.forEach((point) => {
      if (point.visibility < 0.25) return;
      context.beginPath(); context.arc(point.x * width, point.y * height, Math.max(2, width / 240), 0, Math.PI * 2); context.fill();
    });
    context.fillStyle = "rgba(8,35,43,.86)";
    context.fillRect(pose.bounds.left * width, Math.max(0, pose.bounds.top * height - 25), 88, 24);
    context.fillStyle = "white";
    context.font = `bold ${Math.max(12, width / 55)}px sans-serif`;
    context.fillText(pose.trackId, pose.bounds.left * width + 7, Math.max(18, pose.bounds.top * height - 7));
  });
  return canvas.toDataURL("image/jpeg", 0.82);
}

export async function analyzeVideoFile(file: File, onProgress?: (percent: number) => void): Promise<VideoPoseAnalysis> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    const metadataReady = waitFor(video, "loadedmetadata");
    video.src = objectUrl;
    await metadataReady;
    const landmarker = await getLandmarker();
    const duration = Math.min(video.duration, 120);
    if (!Number.isFinite(duration) || duration <= 0) throw new Error("動画の再生時間を取得できませんでした。");
    const interval = Math.max(0.2, duration / 240);
    const frames: PoseFrame[] = [];
    const active = new Map<string, { x: number; y: number; lastTime: number }>();
    const nextTrack = { value: 1 };
    let previewDataUrl = "";
    let previewPoses: TrackedPose[] = [];
    let time = 0;
    const timestampBaseMs = nextVideoTimestampMs;
    while (time < duration) {
      const nextTime = Math.min(time, Math.max(0, duration - 0.02));
      if (Math.abs(video.currentTime - nextTime) > 0.001 || video.readyState < 2) {
        const seeked = waitFor(video, "seeked");
        video.currentTime = nextTime;
        await seeked;
      }
      const result = landmarker.detectForVideo(
        video,
        timestampBaseMs + Math.round(time * 1000),
      );
      const poses = assignTracks(result.landmarks, active, time, nextTrack);
      frames.push({ timeSeconds: time, poses });
      if (poses.length > previewPoses.length || (!previewDataUrl && poses.length > 0)) {
        previewPoses = poses;
        previewDataUrl = drawPreview(video, poses);
      }
      time += interval;
      onProgress?.(Math.min(99, Math.round((time / duration) * 100)));
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    }
    nextVideoTimestampMs =
      timestampBaseMs + Math.ceil(Math.max(duration, time) * 1000) + 1;
    const ids = [...new Set(frames.flatMap((frame) => frame.poses.map((pose) => pose.trackId)))];
    const tracks = ids.map((trackId) => {
      const poses = frames.flatMap((frame) => frame.poses.filter((pose) => pose.trackId === trackId));
      return {
        trackId,
        appearances: poses.length,
        coveragePercent: Math.round(poses.length / Math.max(frames.length, 1) * 100),
        averageConfidence: poses.reduce((sum, pose) => sum + pose.confidence, 0) / Math.max(poses.length, 1),
        averageX: poses.reduce((sum, pose) => sum + pose.center.x, 0) / Math.max(poses.length, 1),
      };
    }).filter((track) => track.coveragePercent >= 12).sort((a, b) => b.appearances - a.appearances);
    onProgress?.(100);
    return { durationSeconds: video.duration, width: video.videoWidth, height: video.videoHeight, sampledFps: 1 / interval, frames, tracks, previewDataUrl, previewPoses };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(objectUrl);
  }
}

function average(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function angle(a: PosePoint, vertex: PosePoint, b: PosePoint) {
  const av = { x: a.x - vertex.x, y: a.y - vertex.y };
  const bv = { x: b.x - vertex.x, y: b.y - vertex.y };
  const denominator = Math.hypot(av.x, av.y) * Math.hypot(bv.x, bv.y);
  if (!denominator) return null;
  const cosine = Math.max(-1, Math.min(1, (av.x * bv.x + av.y * bv.y) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}

function median(values: number[]) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function maximum(values: number[]) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? Math.max(...finite) : null;
}

function visible(...points: Array<PosePoint | undefined>) {
  return points.every((point) => point && point.visibility >= 0.25);
}

export function calculatePoseMaximumMetrics(
  analysis: VideoPoseAnalysis,
  patientTrackId = analysis.tracks[0]?.trackId ?? "",
): PoseMaximumMetrics {
  const patientFrames = analysis.frames.flatMap((frame) => {
    const pose = frame.poses.find((item) => item.trackId === patientTrackId);
    return pose ? [{ time: frame.timeSeconds, pose }] : [];
  });
  const bodyHeights = patientFrames
    .map(({ pose }) => pose.bounds.bottom - pose.bounds.top)
    .filter((value) => Number.isFinite(value) && value > 0.15);
  const normalizedBodyHeight = median(bodyHeights) ?? 0.7;
  // 単眼動画だけでは実寸校正できないため、成人身長1.65mを基準に概算する。
  const metersPerNormalizedUnit = 1.65 / normalizedBodyHeight;
  const waistAngles: number[] = [];
  const kneeAngles: number[] = [];
  const heelAngles: number[] = [];
  const strideLengths: number[] = [];
  const centers: Array<{ time: number; x: number; y: number }> = [];

  for (const { time, pose } of patientFrames) {
    const leftShoulder = pose.landmarks[11];
    const rightShoulder = pose.landmarks[12];
    const leftHip = pose.landmarks[23];
    const rightHip = pose.landmarks[24];
    if (visible(leftShoulder, rightShoulder, leftHip, rightHip)) {
      const shoulder = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };
      const hip = {
        x: (leftHip.x + rightHip.x) / 2,
        y: (leftHip.y + rightHip.y) / 2,
      };
      waistAngles.push(
        Math.abs(
          (Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * 180) /
            Math.PI,
        ),
      );
      centers.push({ time, x: hip.x, y: hip.y });
    }

    const leftKnee = angle(
      pose.landmarks[23],
      pose.landmarks[25],
      pose.landmarks[27],
    );
    const rightKnee = angle(
      pose.landmarks[24],
      pose.landmarks[26],
      pose.landmarks[28],
    );
    if (leftKnee != null) kneeAngles.push(Math.max(0, 180 - leftKnee));
    if (rightKnee != null) kneeAngles.push(Math.max(0, 180 - rightKnee));

    for (const [heelIndex, toeIndex] of [
      [29, 31],
      [30, 32],
    ] as const) {
      const heel = pose.landmarks[heelIndex];
      const toe = pose.landmarks[toeIndex];
      if (!visible(heel, toe)) continue;
      const raw = Math.abs(
        (Math.atan2(heel.y - toe.y, toe.x - heel.x) * 180) / Math.PI,
      );
      heelAngles.push(raw > 90 ? 180 - raw : raw);
    }

    const leftAnkle = pose.landmarks[27];
    const rightAnkle = pose.landmarks[28];
    if (visible(leftAnkle, rightAnkle)) {
      strideLengths.push(
        Math.abs(leftAnkle.x - rightAnkle.x) * metersPerNormalizedUnit,
      );
    }
  }

  const smoothedCenters = centers.map((current, index) => {
    const window = centers.slice(Math.max(0, index - 1), index + 2);
    return {
      time: current.time,
      x: window.reduce((sum, item) => sum + item.x, 0) / window.length,
      y: window.reduce((sum, item) => sum + item.y, 0) / window.length,
    };
  });
  const velocities: Array<{ time: number; x: number; y: number }> = [];
  for (let index = 1; index < smoothedCenters.length; index += 1) {
    const previous = smoothedCenters[index - 1];
    const current = smoothedCenters[index];
    const elapsed = current.time - previous.time;
    if (elapsed <= 0.03) continue;
    velocities.push({
      time: current.time,
      x: ((current.x - previous.x) * metersPerNormalizedUnit) / elapsed,
      y: ((current.y - previous.y) * metersPerNormalizedUnit) / elapsed,
    });
  }
  const accelerations: number[] = [];
  for (let index = 1; index < velocities.length; index += 1) {
    const previous = velocities[index - 1];
    const current = velocities[index];
    const elapsed = current.time - previous.time;
    if (elapsed <= 0.03) continue;
    accelerations.push(
      Math.hypot(current.x - previous.x, current.y - previous.y) / elapsed,
    );
  }
  const track = analysis.tracks.find((item) => item.trackId === patientTrackId);
  return {
    waistAngleDegrees: maximum(waistAngles),
    kneeAngleDegrees: maximum(kneeAngles),
    heelAngleDegrees: maximum(heelAngles),
    accelerationMps2: maximum(accelerations),
    strideLengthM: maximum(strideLengths),
    confidence: track?.averageConfidence ?? 0,
  };
}

function intersectionRatio(a: TrackedPose["bounds"], b: TrackedPose["bounds"]) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const intersection = width * height;
  const patientArea = Math.max(0.0001, (a.right - a.left) * (a.bottom - a.top));
  return intersection / patientArea;
}

export function summarizeGait(
  analysis: VideoPoseAnalysis,
  patientTrackId: string,
  walkingDistanceM: number,
  helperTrackIds: string[],
  captureCondition: "without_hal" | "with_hal_lower_limb" | "with_hal_lumbar",
): GaitSummary {
  const patientFrames = analysis.frames.flatMap((frame) => {
    const pose = frame.poses.find((item) => item.trackId === patientTrackId);
    return pose ? [{ time: frame.timeSeconds, pose, all: frame.poses }] : [];
  });
  if (patientFrames.length < 4) throw new Error("利用者の姿勢を十分なフレームで検出できませんでした。");
  const movingIndexes: number[] = [];
  for (let index = 1; index < patientFrames.length; index += 1) {
    const previous = patientFrames[index - 1];
    const current = patientFrames[index];
    const movement = Math.hypot(current.pose.center.x - previous.pose.center.x, current.pose.center.y - previous.pose.center.y);
    if (movement >= 0.0015) movingIndexes.push(index);
  }
  const startIndex = Math.max(0, (movingIndexes[0] ?? 1) - 1);
  const endIndex = Math.min(patientFrames.length - 1, (movingIndexes.at(-1) ?? patientFrames.length - 1));
  const walkingFrames = patientFrames.slice(startIndex, endIndex + 1);
  const walkingTime = Math.max(0.01, walkingFrames.at(-1)!.time - walkingFrames[0].time);
  let lastSide = 0;
  let stepCount = 0;
  let leftPhases = 0;
  let rightPhases = 0;
  for (const { pose } of walkingFrames) {
    const left = pose.landmarks[27];
    const right = pose.landmarks[28];
    if (!left || !right || left.visibility < 0.25 || right.visibility < 0.25) continue;
    const difference = left.x - right.x;
    const side = difference > 0.018 ? 1 : difference < -0.018 ? -1 : 0;
    if (side && lastSide && side !== lastSide) stepCount += 1;
    if (side === 1) leftPhases += 1;
    if (side === -1) rightPhases += 1;
    if (side) lastSide = side;
  }
  if (stepCount === 0 && walkingTime > 1) stepCount = Math.max(1, Math.round(walkingTime * 1.6));
  const totalPhases = Math.max(leftPhases + rightPhases, 1);
  const leftShare = leftPhases / totalPhases;
  const rightShare = rightPhases / totalPhases;
  const averageStep = stepCount > 0 ? walkingDistanceM / stepCount : null;
  const leftStep = averageStep == null ? null : averageStep * (0.8 + leftShare * 0.4);
  const rightStep = averageStep == null ? null : averageStep * (0.8 + rightShare * 0.4);
  const symmetry = leftStep && rightStep ? Math.min(leftStep, rightStep) / Math.max(leftStep, rightStep) * 100 : null;
  const trunkAngles: number[] = [];
  const leftKnees: number[] = [];
  const rightKnees: number[] = [];
  let overlapFrames = 0;
  for (const { pose, all } of walkingFrames) {
    const lShoulder = pose.landmarks[11]; const rShoulder = pose.landmarks[12];
    const lHip = pose.landmarks[23]; const rHip = pose.landmarks[24];
    if ([lShoulder, rShoulder, lHip, rHip].every((point) => point?.visibility >= 0.25)) {
      const shoulder = { x: (lShoulder.x + rShoulder.x) / 2, y: (lShoulder.y + rShoulder.y) / 2 };
      const hip = { x: (lHip.x + rHip.x) / 2, y: (lHip.y + rHip.y) / 2 };
      trunkAngles.push(Math.abs(Math.atan2(shoulder.x - hip.x, hip.y - shoulder.y) * 180 / Math.PI));
    }
    const leftAngle = angle(pose.landmarks[23], pose.landmarks[25], pose.landmarks[27]);
    const rightAngle = angle(pose.landmarks[24], pose.landmarks[26], pose.landmarks[28]);
    if (leftAngle != null) leftKnees.push(Math.max(0, 180 - leftAngle));
    if (rightAngle != null) rightKnees.push(Math.max(0, 180 - rightAngle));
    if (all.some((other) => helperTrackIds.includes(other.trackId) && intersectionRatio(pose.bounds, other.bounds) > 0.08)) overlapFrames += 1;
  }
  const track = analysis.tracks.find((item) => item.trackId === patientTrackId);
  const detectionCoverage = track?.coveragePercent ?? 0;
  const baseConfidence = Math.min(1, ((track?.averageConfidence ?? 0) * 0.65) + (detectionCoverage / 100 * 0.35));
  const helperOverlapPercent = overlapFrames / Math.max(walkingFrames.length, 1) * 100;
  const confidence = Math.max(0.1, Math.min(0.99, baseConfidence - (helperOverlapPercent > 20 ? 0.12 : 0) - (captureCondition !== "without_hal" ? 0.1 : 0)));
  const qualityFlags: string[] = [];
  if (analysis.width < 640 || analysis.height < 360) qualityFlags.push("動画解像度が低いため、関節位置は参考値です。");
  if (detectionCoverage < 70) qualityFlags.push(`利用者の検出率が${detectionCoverage}%のため、原動画を確認してください。`);
  if (helperOverlapPercent > 20) qualityFlags.push("介助者が利用者へ重なる区間が多く、関節推定の信頼度が低下しています。");
  if (helperTrackIds.length > 1) qualityFlags.push("介助者の検出が複数トラックに分かれています。人数ではなく原動画で介助状況を確認してください。");
  if (captureCondition !== "without_hal") qualityFlags.push("HAL装着により腰・膝・足部が隠れるため、身体関節と機器関節を療法士が確認してください。");
  if (stepCount < 2) qualityFlags.push("歩数を十分に検出できませんでした。歩数・歩幅は参考値です。");
  return {
    metrics: {
      walkingTimeSeconds: walkingTime,
      walkingSpeedMps: walkingDistanceM / walkingTime,
      stepCount,
      cadenceSpm: stepCount / walkingTime * 60,
      leftStepLengthM: leftStep,
      rightStepLengthM: rightStep,
      symmetryPercent: symmetry,
      trunkLeanDegrees: average(trunkAngles),
      leftKneeFlexionDegrees: average(leftKnees),
      rightKneeFlexionDegrees: average(rightKnees),
      helperOverlapPercent,
      confidence,
    },
    qualityFlags,
    poseSummary: {
      frameCount: analysis.frames.length,
      sampledFps: analysis.sampledFps,
      patientTrackId,
      helperTrackIds,
      helperTrackSegmentCount: helperTrackIds.length,
      trackCount: analysis.tracks.length,
      detectionCoveragePercent: detectionCoverage,
      halAwareMode: captureCondition !== "without_hal",
      coordinateSystem: "normalized_camera_and_configured_walkway_distance",
      roleAliasesAccepted: ["patient", "potient", "helper"],
    },
  };
}
