"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Bot, Camera, CheckCircle2, CircleStop,
  FileVideo, LoaderCircle, Play, RefreshCw, Save,
  ScanLine, UserCheck, X,
} from "lucide-react";
import {
  analyzeVideoFileWithFallback, calculatePoseMaximumMetrics, POSE_CONNECTIONS,
  ROBOREHA_POSE_ENGINE, summarizeGait,
  type GaitSummary, type PoseFrame, type PoseMaximumMetrics, type VideoPoseAnalysis,
} from "@/lib/pose-analysis";

type Appointment = {
  id: string;
  customer_id: string;
  customer_name: string;
  primary_condition: string;
  start_at: string;
  product_name: string;
  therapist_name: string;
  hal_asset_code: string;
  model_type: string;
};
type Protocol = {
  code: string;
  name: string;
  unit: string;
  lower_is_better: boolean;
  instructions: string;
  video_supported: boolean;
};
type Measurement = { code: string; side: "none" | "left" | "right"; value: number | string; unit: string; source: string };
type Session = {
  id: string;
  appointment_id: string;
  customer_id: string;
  customer_name: string;
  primary_condition: string;
  evaluator_name: string;
  status: string;
  capture_condition: "without_hal" | "with_hal_lower_limb" | "with_hal_lumbar";
  hal_size: "S" | "L" | null;
  hal_asset_code: string | null;
  assistance_level: string;
  assistive_device: string;
  walking_distance_m: number | string;
  camera_view: string;
  notes: string;
  clinician_summary: string;
  recorded_at: string;
  measurements: Measurement[];
  videos: Array<{ id: string; testCode: string; phase: string; url: string; durationSeconds: number | null }>;
  analysis: null | {
    status: string;
    engineVersion: string;
    patientTrackId: string;
    helperTrackIds: string[];
    qualityFlags: string[];
    walkingTimeSeconds: number | string | null;
    walkingSpeedMps: number | string | null;
    stepCount: number | null;
    cadenceSpm: number | string | null;
    leftStepLengthM: number | string | null;
    rightStepLengthM: number | string | null;
    symmetryPercent: number | string | null;
    trunkLeanDegrees: number | string | null;
    helperOverlapPercent: number | string | null;
    confidence: number | string;
  };
  report: null | { summary: string; improvementPoints: string[]; commentCandidates: string[]; disclaimer: string };
};

const metricInputs = [
  { key: "walk_time", label: "歩行時間", unit: "秒", side: "none" },
  { key: "gait_speed", label: "歩行速度", unit: "m/s", side: "none" },
  { key: "single_leg_stance_left", label: "片脚立位 左", unit: "秒", side: "left" },
  { key: "single_leg_stance_right", label: "片脚立位 右", unit: "秒", side: "right" },
  { key: "tug", label: "TUG", unit: "秒", side: "none" },
  { key: "chair_stand_5", label: "5回立ち上がり", unit: "秒", side: "none" },
  { key: "grip_strength_left", label: "握力 左", unit: "kg", side: "left" },
  { key: "grip_strength_right", label: "握力 右", unit: "kg", side: "right" },
  { key: "bbs", label: "BBS", unit: "点", side: "none" },
  { key: "chair_stand_30s", label: "30秒立ち上がり", unit: "回", side: "none" },
] as const;

const conditionLabel = {
  without_hal: "HALなし",
  with_hal_lower_limb: "下肢HAL装着",
  with_hal_lumbar: "腰HAL装着",
};
const assistanceLabel: Record<string, string> = { independent: "自立", supervision: "見守り", light: "軽介助", moderate: "中等度介助", maximum: "最大介助" };
const deviceLabel: Record<string, string> = { none: "なし", cane: "杖", walker: "歩行器", handrail: "手すり", other: "その他" };

const dateText = (value: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const numberText = (value: number | string | null | undefined, digits = 2) => value == null ? "—" : Number(value).toFixed(digits).replace(/\.00$/, "");
type CapturePhase = "before" | "after";
type PairedFiles = Record<CapturePhase, File | null>;
type PairedAnalyses = Record<CapturePhase, VideoPoseAnalysis | null>;
type PairedTrackIds = Record<CapturePhase, string>;

const poseMaximumDefinitions: Array<{
  key: keyof Omit<PoseMaximumMetrics, "confidence">;
  shortLabel: string;
  label: string;
  unit: string;
  digits: number;
}> = [
  { key: "waistAngleDegrees", shortLabel: "腰角度 最大", label: "腰（体幹傾斜）", unit: "°", digits: 1 },
  { key: "kneeAngleDegrees", shortLabel: "膝角度 最大", label: "膝屈曲角度", unit: "°", digits: 1 },
  { key: "heelAngleDegrees", shortLabel: "かかと角度 最大", label: "かかと―足先角度", unit: "°", digits: 1 },
  { key: "accelerationMps2", shortLabel: "加速度 最大", label: "腰中心加速度", unit: "m/s²", digits: 2 },
  { key: "strideLengthM", shortLabel: "歩幅 最大", label: "推定歩幅", unit: "m", digits: 2 },
];

const metricText = (value: number | null, digits: number) => value == null || !Number.isFinite(value) ? "―" : value.toFixed(digits);

export function PhysicalFunctionManager({ appointments }: { appointments: Appointment[] }) {
  const [protocols, setProtocols] = useState<Protocol[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(appointments[0]?.id ?? "");
  const initialModelType = appointments[0]?.model_type;
  const [captureCondition, setCaptureCondition] = useState<Session["capture_condition"]>(
    initialModelType === "lower_limb" ? "with_hal_lower_limb" : initialModelType === "lumbar" ? "with_hal_lumbar" : "without_hal",
  );
  const [halSize, setHalSize] = useState<"S" | "L">("L");
  const [assistanceLevel, setAssistanceLevel] = useState("supervision");
  const [assistiveDevice, setAssistiveDevice] = useState("none");
  const [walkingDistanceM, setWalkingDistanceM] = useState("4");
  const [cameraView, setCameraView] = useState("side");
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [captureFiles, setCaptureFiles] = useState<PairedFiles>({ before: null, after: null });
  const [poseAnalyses, setPoseAnalyses] = useState<PairedAnalyses>({ before: null, after: null });
  const [patientTrackIds, setPatientTrackIds] = useState<PairedTrackIds>({ before: "", after: "" });
  const [analyzingPhase, setAnalyzingPhase] = useState<CapturePhase | null>(null);
  const [comparisonFile, setComparisonFile] = useState<File | null>(null);
  const [comparisonUrl, setComparisonUrl] = useState("");
  const [captureOpen, setCaptureOpen] = useState(true);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Session | null>(null);
  const selectedAppointment = appointments.find((item) => item.id === selectedAppointmentId) ?? null;
  const beforeMaximums = useMemo(() => poseAnalyses.before ? calculatePoseMaximumMetrics(poseAnalyses.before, patientTrackIds.before) : null, [patientTrackIds.before, poseAnalyses.before]);
  const afterMaximums = useMemo(() => poseAnalyses.after ? calculatePoseMaximumMetrics(poseAnalyses.after, patientTrackIds.after) : null, [patientTrackIds.after, poseAnalyses.after]);
  const comparison = useMemo(() => beforeMaximums && afterMaximums
    ? buildPhysicalComparison(beforeMaximums, afterMaximums, poseAnalyses, patientTrackIds, Number(walkingDistanceM), captureCondition)
    : null, [afterMaximums, beforeMaximums, captureCondition, patientTrackIds, poseAnalyses, walkingDistanceM]);

  useEffect(() => () => { if (comparisonUrl) URL.revokeObjectURL(comparisonUrl); }, [comparisonUrl]);

  const load = useCallback(async () => {
    const response = await fetch("/api/physical-function", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "身体機能記録を読み込めませんでした。");
    setProtocols(body.protocols ?? []);
    setSessions(body.sessions ?? []);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load().catch((reason) => setError(reason instanceof Error ? reason.message : "読み込みに失敗しました。"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function selectAppointment(appointmentId: string) {
    setSelectedAppointmentId(appointmentId);
    const appointment = appointments.find((item) => item.id === appointmentId);
    setCaptureCondition(appointment?.model_type === "lower_limb" ? "with_hal_lower_limb" : appointment?.model_type === "lumbar" ? "with_hal_lumbar" : "without_hal");
  }

  const formMeasurements = useMemo(() => metricInputs.flatMap((metric) => {
    const value = Number(values[metric.key]);
    if (!Number.isFinite(value) || values[metric.key] === "") return [];
    return [{ code: metric.key.replace(/_(left|right)$/, ""), side: metric.side, trialNumber: 1, value, unit: metric.unit, source: "manual", valid: true }];
  }), [values]);

  async function saveSession() {
    if (!selectedAppointment) throw new Error("本日の利用者を選択してください。");
    const response = await fetch("/api/physical-function", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        appointmentId: selectedAppointment.id, captureCondition,
        halSize: captureCondition === "without_hal" ? null : halSize,
        assistanceLevel, assistiveDevice, walkingDistanceM: Number(walkingDistanceM),
        cameraView, notes, measurements: formMeasurements,
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "測定記録を保存できませんでした。");
    await load();
    return body.session.id as string;
  }

  async function handleSave() {
    setBusy(true); setError(""); setMessage("");
    try { await saveSession(); setMessage("身体機能の測定値と条件を保存しました。"); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "保存できませんでした。"); }
    finally { setBusy(false); }
  }

  function selectCaptureFile(phase: CapturePhase, file: File | null) {
    setCaptureFiles((current) => ({ ...current, [phase]: file }));
    setPoseAnalyses((current) => ({ ...current, [phase]: null }));
    setPatientTrackIds((current) => ({ ...current, [phase]: "" }));
    setComparisonFile(null);
    setComparisonUrl("");
    setProgress(0);
  }

  async function analyzePhase(phase: CapturePhase) {
    const file = captureFiles[phase];
    if (!file) { setError(`${phase === "before" ? "HAL使用前" : "HAL使用後"}の動画を撮影または選択してください。`); return null; }
    setBusy(true); setAnalyzingPhase(phase); setError(""); setMessage(""); setProgress(0);
    try {
      const prepared = await analyzeVideoFileWithFallback(
        file,
        setProgress,
        () => setMessage("この動画をiPadで再生できるMP4（H.264）へ変換しています…"),
      );
      const analysis = prepared.analysis;
      if (!analysis.tracks.length) throw new Error("人物を検出できませんでした。全身が映る動画で撮り直してください。");
      const trackId = analysis.tracks[0].trackId;
      if (prepared.normalized) {
        setCaptureFiles((current) => ({ ...current, [phase]: prepared.file }));
      }
      setPoseAnalyses((current) => ({ ...current, [phase]: analysis }));
      setPatientTrackIds((current) => ({ ...current, [phase]: trackId }));
      setComparisonFile(null); setComparisonUrl("");
      setMessage(`${phase === "before" ? "HAL使用前" : "HAL使用後"}動画の姿勢推定が完了しました。patient/helperを確認してください。`);
      return { analysis, trackId };
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "姿勢推定を実行できませんでした。");
      return null;
    } finally { setBusy(false); setAnalyzingPhase(null); }
  }

  async function prepareComparison() {
    if (!captureFiles.before || !captureFiles.after) { setError("HAL使用前動画とHAL使用後動画の両方を選択してください。"); return; }
    setBusy(true); setError(""); setMessage(""); setProgress(0);
    try {
      const files = { ...captureFiles };
      const analyses = { ...poseAnalyses };
      const trackIds = { ...patientTrackIds };
      for (const phase of ["before", "after"] as const) {
        if (!analyses[phase]) {
          setAnalyzingPhase(phase);
          const prepared = await analyzeVideoFileWithFallback(
            files[phase]!,
            setProgress,
            () => setMessage(`${phase === "before" ? "HAL使用前" : "HAL使用後"}動画をiPadで再生できるMP4（H.264）へ変換しています…`),
          );
          const analysis = prepared.analysis;
          files[phase] = prepared.file;
          if (!analysis.tracks.length) throw new Error(`${phase === "before" ? "HAL使用前" : "HAL使用後"}動画から人物を検出できませんでした。`);
          analyses[phase] = analysis;
          trackIds[phase] = analysis.tracks[0].trackId;
        }
      }
      setCaptureFiles(files); setPoseAnalyses(analyses); setPatientTrackIds(trackIds);
      const file = await createPhysicalComparisonVideo(files.before!, files.after!, analyses, trackIds);
      const url = URL.createObjectURL(file);
      setComparisonFile(file); setComparisonUrl(url);
      const beforeMetrics = calculatePoseMaximumMetrics(analyses.before!, trackIds.before);
      const afterMetrics = calculatePoseMaximumMetrics(analyses.after!, trackIds.after);
      const generated = buildPhysicalComparison(beforeMetrics, afterMetrics, analyses, trackIds, Number(walkingDistanceM), captureCondition);
      setNotes((current) => current.includes("【AI比較所見】") ? current : `${current.trim()}${current.trim() ? "\n" : ""}${comparisonRecordText(generated)}`);
      setMessage("HAL使用前後のオーバーレイ比較動画を作成しました。画面内で確認してから保存できます。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "HAL前後動画を作成できませんでした。"); }
    finally { setBusy(false); setAnalyzingPhase(null); }
  }

  async function uploadPhysicalVideo(sessionId: string, phase: "baseline" | "hal_assisted" | "analysis", file: File, analysis?: VideoPoseAnalysis) {
    const form = new FormData();
    form.append("sessionId", sessionId); form.append("testCode", phase === "analysis" ? "gait_comparison" : "gait");
    form.append("phase", phase); form.append("consentConfirmed", "true"); form.append("file", file);
    if (analysis) {
      form.append("durationSeconds", String(analysis.durationSeconds));
      form.append("width", String(analysis.width)); form.append("height", String(analysis.height));
      form.append("fps", String(analysis.sampledFps || 30));
    }
    const response = await fetch("/api/physical-function/videos", { method: "POST", body: form });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "動画を保存できませんでした。");
    return body.video as { id: string };
  }

  async function savePoseResult(sessionId: string, videoId: string, phase: CapturePhase, analysis: VideoPoseAnalysis, trackId: string) {
    const helperTrackIds = analysis.tracks.map((track) => track.trackId).filter((id) => id !== trackId);
    const condition = phase === "before" ? "without_hal" : captureCondition === "without_hal" ? "with_hal_lower_limb" : captureCondition;
    const summary = summarizeGait(analysis, trackId, Number(walkingDistanceM), helperTrackIds, condition);
    const response = await fetch("/api/physical-function/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, videoId, engineVersion: ROBOREHA_POSE_ENGINE, patientTrackId: trackId,
        helperTrackIds, poseSummary: { ...summary.poseSummary, phase }, qualityFlags: summary.qualityFlags, metrics: summary.metrics }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "解析結果を保存できませんでした。");
  }

  async function saveAllAndClose() {
    if ((captureFiles.before || captureFiles.after || comparisonFile) && !consentConfirmed) {
      setError("動画保存の同意確認を行ってください。"); return;
    }
    setBusy(true); setError(""); setMessage("");
    try {
      const sessionId = await saveSession();
      for (const phase of ["before", "after"] as const) {
        const file = captureFiles[phase];
        if (!file) continue;
        const analysis = poseAnalyses[phase];
        const uploaded = await uploadPhysicalVideo(sessionId, phase === "before" ? "baseline" : "hal_assisted", file, analysis ?? undefined);
        if (analysis && patientTrackIds[phase]) await savePoseResult(sessionId, uploaded.id, phase, analysis, patientTrackIds[phase]);
      }
      if (comparisonFile) await uploadPhysicalVideo(sessionId, "analysis", comparisonFile);
      if (comparison) {
        const response = await fetch("/api/physical-function", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, status: "reviewed", clinicianSummary: comparison.summary, notes }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "比較所見を保存できませんでした。");
      }
      await load();
      setMessage("測定値、使用前・使用後動画、AI解析、比較動画、所見を保存しました。");
      setCaptureOpen(false);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "身体機能記録を保存できませんでした。"); }
    finally { setBusy(false); }
  }

  const customerSessions = useMemo(
    () => sessions.filter((session) => session.customer_id === selectedAppointment?.customer_id),
    [sessions, selectedAppointment?.customer_id],
  );
  const trend = useMemo(() => customerSessions.filter((session) => session.analysis?.walkingSpeedMps != null).slice(0, 8).reverse(), [customerSessions]);

  return <div className="mx-auto max-w-[1500px] space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[10px] font-black tracking-[.16em] text-[#087f71]">ROBOREHA PHYSICAL FUNCTION LITE</p><h2 className="text-2xl font-black">身体機能レコード</h2><p className="mt-1 text-xs text-[#71858a]">1台のiPadで測定・撮影・patient/helper確認・歩行解析を完結</p></div>
      <div className="flex gap-2"><StatusChip label="記録" value={`${sessions.length}件`} /><StatusChip label="要確認" value={`${sessions.filter((item) => item.status !== "finalized" && item.analysis?.status === "needs_review").length}件`} warn /></div>
    </header>
    {error && <p role="alert" className="rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">{error}</p>}
    {message && <p role="status" className="rounded-xl bg-[#e7f5f1] p-3 text-sm font-bold text-[#087f71]">{message}</p>}

    <section className="grid gap-3 lg:grid-cols-2">
      <div className="rounded-[22px] border border-[#dce8e5] bg-white p-4">
        <h3 className="flex items-center gap-2 font-black"><UserCheck size={19} className="text-[#087f71]" />1. 利用者・条件</h3>
        <label className="mt-3 block text-[10px] font-black text-[#71858a]">本日の利用者<select value={selectedAppointmentId} onChange={(event) => selectAppointment(event.target.value)} className="mt-1 w-full rounded-xl border border-[#d7e4e1] px-3 py-3 text-sm font-black">
          <option value="">選択してください</option>{appointments.map((item) => <option key={item.id} value={item.id}>{dateText(item.start_at)} {item.customer_name}・{item.product_name}</option>)}
        </select></label>
        {selectedAppointment && <div className="mt-2 rounded-xl bg-[#f1f7f5] p-3 text-xs"><b>{selectedAppointment.customer_name}</b><p className="mt-1 text-[#71858a]">{selectedAppointment.primary_condition}・{selectedAppointment.therapist_name}・{selectedAppointment.hal_asset_code || "HALなし"}</p></div>}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <SelectField label="撮影条件" value={captureCondition} onChange={(value) => setCaptureCondition(value as Session["capture_condition"])} options={Object.entries(conditionLabel)} />
          <SelectField label="HALサイズ" value={halSize} onChange={(value) => setHalSize(value as "S" | "L")} disabled={captureCondition === "without_hal"} options={[["S", "小（S）"], ["L", "大（L）"]]} />
          <SelectField label="介助量" value={assistanceLevel} onChange={setAssistanceLevel} options={Object.entries(assistanceLabel)} />
          <SelectField label="補助具" value={assistiveDevice} onChange={setAssistiveDevice} options={Object.entries(deviceLabel)} />
          <label className="rounded-xl border border-[#d7e4e1] px-3 py-2 text-[10px] font-bold text-[#71858a]">歩行距離<input type="number" min="1" max="100" step="0.5" value={walkingDistanceM} onChange={(event) => setWalkingDistanceM(event.target.value)} className="mt-1 w-full text-base font-black text-[#173b42] outline-none" /></label>
          <SelectField label="カメラ方向" value={cameraView} onChange={setCameraView} options={[["side", "側方"], ["rear", "後方"], ["front", "前方"], ["diagonal", "斜め"]]} />
        </div>
        <textarea aria-label="測定メモ" placeholder="疲労、疼痛、介助位置、撮影条件など" value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-3 min-h-20 w-full rounded-xl border border-[#d7e4e1] p-3 text-sm" />
      </div>

      <div className="rounded-[22px] border border-[#dce8e5] bg-white p-4">
        <h3 className="flex items-center gap-2 font-black"><Activity size={19} className="text-[#087f71]" />2. 運動機能</h3>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">{metricInputs.map((metric) => <label key={metric.key} className="rounded-xl bg-[#f4f7f6] p-2 text-[10px] font-bold text-[#71858a]">{metric.label}<span className="float-right">{metric.unit}</span><input aria-label={metric.label} type="number" min="0" step="0.1" value={values[metric.key] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [metric.key]: event.target.value }))} className="mt-1 w-full bg-transparent text-lg font-black text-[#173b42] outline-none" /></label>)}</div>
        <details className="mt-3 rounded-xl border border-[#dce8e5] p-3"><summary className="cursor-pointer text-xs font-black text-[#087f71]">測定方法を確認</summary><div className="mt-2 max-h-40 space-y-2 overflow-y-auto">{protocols.map((protocol) => <div key={protocol.code} className="text-xs"><b>{protocol.name}</b><p className="text-[#71858a]">{protocol.instructions}</p></div>)}</div></details>
        <button onClick={handleSave} disabled={busy || !selectedAppointment} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#173b42] font-black text-white disabled:opacity-40"><Save size={17} />測定値と条件を保存</button>
      </div>

      <div className="rounded-[22px] border border-[#d8d1f1] bg-[#fbfaff] p-4 lg:col-span-2">
        <div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="flex items-center gap-2 font-black text-[#5d49b6]"><Camera size={19} />3. 1台iPad撮影・解析</h3><p className="mt-1 text-xs text-[#71858a]">利用者管理の記録と同じ、HAL使用前・使用後の撮影、AI解析、比較、保存</p></div>{!captureOpen && <button type="button" onClick={() => setCaptureOpen(true)} className="min-h-10 rounded-xl bg-[#5d49b6] px-4 text-xs font-black text-white">撮影解析を開く</button>}</div>
        {captureOpen && <>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {(["before", "after"] as const).map((phase) => <PhysicalVideoRecorder key={phase} phase={phase} label={phase === "before" ? "HAL使用前" : "HAL使用後"} file={captureFiles[phase]} analysis={poseAnalyses[phase]} patientTrackId={patientTrackIds[phase]} maximumMetrics={phase === "before" ? beforeMaximums : afterMaximums} disabled={busy} onFile={(file) => selectCaptureFile(phase, file)} onPatient={(trackId) => { setPatientTrackIds((current) => ({ ...current, [phase]: trackId })); setComparisonFile(null); setComparisonUrl(""); }} onAnalyze={() => void analyzePhase(phase)} analyzing={analyzingPhase === phase} progress={progress} />)}
          </div>
          <label className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-xs font-bold leading-5"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} className="mt-1 size-4" />利用者の動画保存・身体機能解析の同意を確認しました</label>
          <button type="button" onClick={() => void prepareComparison()} disabled={busy || !captureFiles.before || !captureFiles.after} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087f71] font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <FileVideo size={18} />}{comparisonFile ? "HAL前後動画を再作成" : "HAL前後動画作成"}</button>
          {comparisonUrl && <section data-testid="physical-hal-comparison-video" className="mt-3 rounded-2xl border border-[#b9ddd5] bg-[#f4fbf9] p-4"><div className="flex items-center gap-2 text-[#087f71]"><CheckCircle2 size={20} /><h4 className="font-black">作成したHAL前後比較動画</h4></div><video src={comparisonUrl} controls playsInline className="mt-3 aspect-[8/3] w-full rounded-xl bg-black object-contain" /><p className="mt-2 text-[9px] text-[#71858a]">画面は遷移しません。「保存して閉じる」でMP4として記録します。</p></section>}
          {comparison && beforeMaximums && afterMaximums && <PhysicalAiComparison comparison={comparison} before={beforeMaximums} after={afterMaximums} onAppend={(candidate) => setNotes((current) => current.trim() ? `${current.trim()}\n${candidate}` : candidate)} />}
          <label className="mt-3 block text-xs font-black text-[#71858a]">所見・申し送り<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="歩容、介助量、疼痛、疲労、HAL設定など" className="mt-1 min-h-24 w-full rounded-xl border border-[#d7e4e1] p-3 text-sm font-normal text-[#173b42]" /></label>
          <div className="sticky bottom-0 z-20 -mx-4 mt-4 border-t border-[#dce8e5] bg-white/95 px-4 py-3 backdrop-blur"><button type="button" onClick={() => void saveAllAndClose()} disabled={busy || !selectedAppointment} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#087f71] font-black text-white disabled:opacity-40"><Save size={18} />{busy ? "すべて保存しています…" : "保存して閉じる"}</button></div>
        </>}
      </div>
    </section>

    {trend.length > 0 && <TrendPanel sessions={trend} />}
    <HalComparisonPanel sessions={customerSessions} customerName={selectedAppointment?.customer_name ?? ""} />
    <section className="rounded-[24px] border border-[#dce8e5] bg-white p-4"><div className="flex items-center justify-between"><div><h3 className="font-black">身体機能履歴</h3><p className="mt-1 text-xs text-[#71858a]">測定値、動画、patient/helper、HAL条件、所見を一体表示</p></div><button onClick={() => void load()} className="grid size-10 place-items-center rounded-xl bg-[#edf4f2] text-[#087f71]"><RefreshCw size={17} /></button></div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">{sessions.map((session) => <SessionCard key={session.id} session={session} onDetail={setDetail} />)}{!sessions.length && <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-[#829397]">身体機能記録はまだありません</p>}</div>
    </section>
    {detail && <SessionDetail session={detail} onClose={() => setDetail(null)} onSaved={async () => { setDetail(null); await load(); }} />}
  </div>;
}

function SelectField({ label, value, options, onChange, disabled = false }: { label: string; value: string; options: string[][]; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="rounded-xl border border-[#d7e4e1] px-2 py-2 text-[10px] font-bold text-[#71858a]">{label}<select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full bg-transparent text-sm font-black text-[#173b42] outline-none disabled:opacity-40">{options.map(([optionValue, optionLabel]) => <option key={optionValue} value={optionValue}>{optionLabel}</option>)}</select></label>;
}
function StatusChip({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) { return <div className={`rounded-xl px-3 py-2 text-xs ${warn ? "bg-[#fff6df] text-[#98690e]" : "bg-[#e7f5f1] text-[#087f71]"}`}><b>{value}</b><span className="ml-1">{label}</span></div>; }

function PhysicalVideoRecorder({ phase, label, file, analysis, patientTrackId, maximumMetrics, disabled, onFile, onPatient, onAnalyze, analyzing, progress }: {
  phase: CapturePhase; label: string; file: File | null; analysis: VideoPoseAnalysis | null; patientTrackId: string;
  maximumMetrics: PoseMaximumMetrics | null; disabled: boolean; onFile: (file: File | null) => void;
  onPatient: (trackId: string) => void; onAnalyze: () => void; analyzing: boolean; progress: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null); const recorderRef = useRef<MediaRecorder | null>(null); const chunksRef = useRef<BlobPart[]>([]);
  const [cameraReady, setCameraReady] = useState(false); const [recording, setRecording] = useState(false); const [error, setError] = useState("");
  const preview = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); }, []);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => { if (cameraReady && videoRef.current && streamRef.current) { videoRef.current.srcObject = streamRef.current; void videoRef.current.play(); } }, [cameraReady]);
  async function openCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } }, audio: false });
      streamRef.current = stream; onFile(null); setCameraReady(true);
    } catch { setError("カメラを開始できません。iPadのカメラ権限を確認してください。"); }
  }
  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType }); recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => { const type = recorder.mimeType || "video/webm"; onFile(new File([new Blob(chunksRef.current, { type })], `${phase}-${Date.now()}.webm`, { type })); setRecording(false); };
    recorder.start(500); setRecording(true);
  }
  function stopRecording() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null; setCameraReady(false); }
  return <article className="rounded-2xl border border-[#dcd6f2] bg-white p-3">
    <div className="flex items-center justify-between"><h4 className="flex items-center gap-2 font-black"><FileVideo size={17} className="text-[#5d49b6]" />{label}動画</h4>{file && <span className="rounded-full bg-[#e7f5f1] px-2 py-1 text-[9px] font-black text-[#087f71]">保存待ち</span>}</div>
    <div className="relative mt-2 aspect-video overflow-hidden rounded-xl bg-[#122b31]">{preview ? <video src={preview} controls playsInline className="size-full object-contain" /> : <video ref={videoRef} muted playsInline className={`size-full object-cover ${cameraReady ? "block" : "hidden"}`} />}{!preview && !cameraReady && <div className="grid size-full place-items-center text-center text-xs text-white/55"><div><Camera className="mx-auto mb-2" /><p>カメラ撮影または動画を選択</p></div></div>}{recording && <div className="absolute right-2 top-2 rounded-full bg-[#c9463b] px-3 py-1 text-xs font-black text-white">● REC</div>}</div>
    {error && <p className="mt-2 text-xs font-bold text-[#b94637]">{error}</p>}
    <div className="mt-2 grid grid-cols-2 gap-2">{!cameraReady ? <button type="button" onClick={() => void openCamera()} disabled={disabled} className="min-h-11 rounded-xl bg-[#173b42] text-xs font-black text-white"><Camera className="mr-1 inline" size={15} />カメラを開始</button> : !recording ? <button type="button" onClick={startRecording} disabled={disabled} className="min-h-11 rounded-xl bg-[#c9463b] text-xs font-black text-white"><Play className="mr-1 inline" size={15} />撮影</button> : <button type="button" onClick={stopRecording} className="min-h-11 rounded-xl bg-[#c9463b] text-xs font-black text-white"><CircleStop className="mr-1 inline" size={15} />停止</button>}<label className="grid min-h-11 cursor-pointer place-items-center rounded-xl border border-[#d8d1f1] px-3 text-xs font-black text-[#5d49b6]">動画を選択<input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" capture="environment" className="hidden" onChange={(event) => onFile(event.target.files?.[0] ?? null)} /></label></div>
    <button type="button" onClick={onAnalyze} disabled={disabled || !file} className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#5d49b6] text-xs font-black text-white disabled:bg-[#c7c2dc]">{analyzing ? <LoaderCircle className="animate-spin" size={16} /> : <ScanLine size={16} />}{analyzing ? `AI解析中… ${progress}%` : analysis ? "AI解析を再実行" : file ? "AI解析（歩行姿勢を推定）" : "動画を読み込むとAI解析できます"}</button>
    {analysis && <RoleSelector analysis={analysis} patientTrackId={patientTrackId} onPatient={onPatient} />}
    {file && analysis && maximumMetrics && <section className="mt-3 rounded-2xl border border-[#dcd6f2] bg-[#faf9ff] p-2.5"><div className="flex items-center justify-between px-1 pb-1"><p className="text-xs font-black text-[#5d49b6]">AI解析結果</p><span className="rounded-full bg-white px-2 py-1 text-[9px] font-black text-[#776f91]">端末内解析</span></div><PoseOverlayVideo file={file} analysis={analysis} patientTrackId={patientTrackId} label={`${label}オーバーレイ`} /><div className="mt-2 grid grid-cols-5 gap-1">{poseMaximumDefinitions.map((definition) => <div key={definition.key} className="rounded-lg bg-white px-1 py-2 text-center"><p className="min-h-7 text-[8px] font-bold leading-3 text-[#71858a]">{definition.shortLabel}</p><p className="mt-1 whitespace-nowrap text-xs font-black">{metricText(maximumMetrics[definition.key], definition.digits)}<span className="ml-0.5 text-[7px] text-[#71858a]">{definition.unit}</span></p></div>)}</div><p className="mt-2 text-[8px] leading-3.5 text-[#776f91]">緑はpatient、橙はhelperです。最大値は単眼動画からの推定値で、療法士が原動画と実測値を確認してください。</p></section>}
  </article>;
}

type PhysicalComparison = {
  summary: string;
  findings: string;
  handoff: string;
  candidates: string[];
  beforeGait: GaitSummary | null;
  afterGait: GaitSummary | null;
};

function safeGaitSummary(analysis: VideoPoseAnalysis | null, trackId: string, distance: number, condition: Session["capture_condition"]) {
  if (!analysis || !trackId) return null;
  try {
    return summarizeGait(analysis, trackId, distance, analysis.tracks.map((track) => track.trackId).filter((id) => id !== trackId), condition);
  } catch { return null; }
}

function buildPhysicalComparison(before: PoseMaximumMetrics, after: PoseMaximumMetrics, analyses: PairedAnalyses, trackIds: PairedTrackIds, distance: number, condition: Session["capture_condition"]): PhysicalComparison {
  const validDistance = Number.isFinite(distance) && distance > 0 ? distance : 4;
  const beforeGait = safeGaitSummary(analyses.before, trackIds.before, validDistance, "without_hal");
  const afterGait = safeGaitSummary(analyses.after, trackIds.after, validDistance, condition === "without_hal" ? "with_hal_lower_limb" : condition);
  const changes = poseMaximumDefinitions.map((definition) => {
    const beforeValue = before[definition.key]; const afterValue = after[definition.key];
    if (beforeValue == null || afterValue == null) return `${definition.label}は検出値不足`;
    const difference = afterValue - beforeValue;
    return `${definition.label}は${Math.abs(difference).toFixed(definition.digits)}${definition.unit}${difference > 0 ? "増加" : difference < 0 ? "減少" : "で変化なし"}`;
  });
  const beforeSpeed = beforeGait?.metrics.walkingSpeedMps; const afterSpeed = afterGait?.metrics.walkingSpeedMps;
  const speedText = beforeSpeed != null && afterSpeed != null ? `推定歩行速度は${beforeSpeed.toFixed(2)}m/sから${afterSpeed.toFixed(2)}m/sへ変化` : "推定歩行速度は原動画と実測値で確認が必要";
  const waistChange = before.waistAngleDegrees != null && after.waistAngleDegrees != null ? after.waistAngleDegrees - before.waistAngleDegrees : null;
  const strideChange = before.strideLengthM != null && after.strideLengthM != null ? after.strideLengthM - before.strideLengthM : null;
  const positive = [
    waistChange != null && waistChange < -0.5 ? `最大体幹傾斜が${Math.abs(waistChange).toFixed(1)}°小さくなりました` : "",
    strideChange != null && strideChange > 0.01 ? `推定最大歩幅が${strideChange.toFixed(2)}m広がりました` : "",
    beforeSpeed != null && afterSpeed != null && afterSpeed > beforeSpeed ? `推定歩行速度が${(afterSpeed - beforeSpeed).toFixed(2)}m/s向上しました` : "",
  ].filter(Boolean);
  const findings = positive.length ? `${positive.join("。")}。疼痛、疲労、介助量と合わせて確認してください。` : "明確な改善方向を断定できる差は検出されませんでした。最大値だけで判断せず、原動画、介助量、疼痛、疲労を合わせて評価してください。";
  return {
    summary: `HAL使用前後の動画解析では、${changes.join("、")}。${speedText}。`, findings,
    handoff: "次回も同じ撮影方向・距離・iPad位置・介助条件で撮影し、体幹傾斜、膝の振り出し、かかと接地、歩幅を継続確認してください。",
    candidates: [
      "歩行中の疼痛と疲労の訴えを確認し、動画解析結果と合わせて評価した。",
      "patientとhelperの重なりを原動画で確認し、介助量と介助位置を記録した。",
      "次回も同一条件で撮影し、HAL設定と歩容の変化を継続して確認する。",
    ], beforeGait, afterGait,
  };
}

function comparisonRecordText(comparison: PhysicalComparison) { return `【AI比較所見】\n${comparison.findings}\n【申し送り】\n${comparison.handoff}\n【AIサマリー】\n${comparison.summary}`; }

function PhysicalAiComparison({ comparison, before, after, onAppend }: { comparison: PhysicalComparison; before: PoseMaximumMetrics; after: PoseMaximumMetrics; onAppend: (text: string) => void }) {
  return <section className="mt-3 rounded-2xl border border-[#dcd6f2] bg-[#faf9ff] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-[10px] font-black tracking-[.14em] text-[#776f91]">BEFORE / AFTER</p><h4 className="flex items-center gap-2 text-lg font-black text-[#5d49b6]"><Bot size={19} />AI比較</h4></div><span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[#5d49b6]">両動画の解析完了</span></div>
    <div className="mt-3 overflow-x-auto"><div className="min-w-[680px]"><div className="grid grid-cols-[1.35fr_1fr_1fr_1fr] gap-2 border-b border-[#ded8f1] px-2 py-2 text-[10px] font-black text-[#776f91]"><span>解析指標（最大値）</span><span>HAL使用前</span><span>HAL使用後</span><span>変化</span></div>{poseMaximumDefinitions.map((definition) => { const beforeValue = before[definition.key]; const afterValue = after[definition.key]; const difference = beforeValue != null && afterValue != null ? afterValue - beforeValue : null; const favorable = difference != null && ((definition.key === "waistAngleDegrees" && difference < 0) || (definition.key === "strideLengthM" && difference > 0)); return <div key={definition.key} className="grid grid-cols-[1.35fr_1fr_1fr_1fr] gap-2 border-b border-[#ebe8f7] px-2 py-2 text-xs"><b>{definition.label}</b><span>{metricText(beforeValue, definition.digits)}{definition.unit}</span><span>{metricText(afterValue, definition.digits)}{definition.unit}</span><span className={favorable ? "font-black text-[#087f71]" : "font-bold text-[#5f6170]"}>{difference == null ? "―" : `${difference > 0 ? "+" : ""}${difference.toFixed(definition.digits)}${definition.unit}`}</span></div>; })}</div></div>
    <div className="mt-3 grid gap-2 md:grid-cols-3"><ComparisonText title="サマリー" text={comparison.summary} /><ComparisonText title="所見" text={comparison.findings} /><ComparisonText title="申し送り" text={comparison.handoff} /></div>
    <div className="mt-3"><p className="text-[10px] font-black text-[#5d49b6]">療法士が追加しそうなコメント候補</p><div className="mt-2 grid gap-2 md:grid-cols-3">{comparison.candidates.map((candidate) => <button type="button" key={candidate} onClick={() => onAppend(candidate)} className="rounded-xl border border-[#d8d1f1] bg-white p-3 text-left text-xs font-bold text-[#5d49b6]">＋ {candidate}</button>)}</div></div>
    <p className="mt-3 text-[9px] leading-4 text-[#776f91]">単眼動画による推定最大値です。診断・転倒安全判定には使用せず、療法士が原動画、実測値、介助条件を確認してください。</p>
  </section>;
}
function ComparisonText({ title, text }: { title: string; text: string }) { return <div className="rounded-xl bg-white p-3"><p className="text-[10px] font-black text-[#5d49b6]">{title}</p><p className="mt-1 text-xs leading-5">{text}</p></div>; }

const overlayJointIndexes = [...new Set(POSE_CONNECTIONS.flatMap(([start, end]) => [start, end]))];
function nearestPoseFrame(analysis: VideoPoseAnalysis, timeSeconds: number): PoseFrame | null {
  if (!analysis.frames.length) return null;
  let low = 0; let high = analysis.frames.length - 1;
  while (low < high) { const middle = Math.floor((low + high) / 2); if (analysis.frames[middle].timeSeconds < timeSeconds) low = middle + 1; else high = middle; }
  const current = analysis.frames[low]; const previous = analysis.frames[Math.max(0, low - 1)];
  return Math.abs(previous.timeSeconds - timeSeconds) <= Math.abs(current.timeSeconds - timeSeconds) ? previous : current;
}
function drawPoseFrame(context: CanvasRenderingContext2D, frame: PoseFrame | null, patientTrackId: string, rect: { left: number; top: number; width: number; height: number }) {
  if (!frame) return;
  frame.poses.forEach((pose) => { const patient = pose.trackId === patientTrackId; const color = patient ? "#25e0a4" : "#ffad55"; context.save(); context.strokeStyle = color; context.fillStyle = color; context.lineWidth = Math.max(2.5, rect.width / 210); context.lineCap = "round"; context.lineJoin = "round"; context.shadowColor = "rgba(4,26,31,.75)"; context.shadowBlur = Math.max(2, rect.width / 280);
    POSE_CONNECTIONS.forEach(([start, end]) => { const a = pose.landmarks[start]; const b = pose.landmarks[end]; if (!a || !b || a.visibility < 0.25 || b.visibility < 0.25) return; context.beginPath(); context.moveTo(rect.left + a.x * rect.width, rect.top + a.y * rect.height); context.lineTo(rect.left + b.x * rect.width, rect.top + b.y * rect.height); context.stroke(); });
    overlayJointIndexes.forEach((index) => { const point = pose.landmarks[index]; if (!point || point.visibility < 0.25) return; context.beginPath(); context.arc(rect.left + point.x * rect.width, rect.top + point.y * rect.height, Math.max(3, rect.width / 165), 0, Math.PI * 2); context.fill(); });
    const label = patient ? "patient" : "helper"; const labelX = rect.left + pose.bounds.left * rect.width; const labelY = Math.max(rect.top + 22, rect.top + pose.bounds.top * rect.height - 8); context.shadowBlur = 0; context.font = `bold ${Math.max(11, rect.width / 38)}px sans-serif`; const labelWidth = context.measureText(label).width + 16; context.fillStyle = "rgba(8,35,43,.86)"; context.fillRect(labelX, labelY - 19, labelWidth, 23); context.fillStyle = color; context.fillText(label, labelX + 8, labelY - 2); context.restore();
  });
}
function PoseOverlayVideo({ label, file, analysis, patientTrackId }: { label: string; file: File; analysis: VideoPoseAnalysis; patientTrackId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null); const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { const video = videoRef.current; if (!video) return; const url = URL.createObjectURL(file); video.src = url; video.load(); return () => { video.removeAttribute("src"); video.load(); URL.revokeObjectURL(url); }; }, [file]);
  useEffect(() => { const video = videoRef.current; const canvas = canvasRef.current; if (!video || !canvas) return; let animationFrame = 0;
    const draw = () => { const bounds = canvas.getBoundingClientRect(); const cssWidth = Math.max(1, bounds.width); const cssHeight = Math.max(1, bounds.height); const pixelRatio = Math.min(2, window.devicePixelRatio || 1); const targetWidth = Math.round(cssWidth * pixelRatio); const targetHeight = Math.round(cssHeight * pixelRatio); if (canvas.width !== targetWidth || canvas.height !== targetHeight) { canvas.width = targetWidth; canvas.height = targetHeight; } const context = canvas.getContext("2d"); if (!context) return; context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0); context.clearRect(0, 0, cssWidth, cssHeight); const sourceWidth = video.videoWidth || analysis.width || 16; const sourceHeight = video.videoHeight || analysis.height || 9; const scale = Math.min(cssWidth / sourceWidth, cssHeight / sourceHeight); const width = sourceWidth * scale; const height = sourceHeight * scale; drawPoseFrame(context, nearestPoseFrame(analysis, video.currentTime), patientTrackId, { left: (cssWidth - width) / 2, top: (cssHeight - height) / 2, width, height }); };
    const tick = () => { draw(); if (!video.paused && !video.ended) animationFrame = window.requestAnimationFrame(tick); }; const start = () => { window.cancelAnimationFrame(animationFrame); animationFrame = window.requestAnimationFrame(tick); }; const stopAndDraw = () => { window.cancelAnimationFrame(animationFrame); draw(); };
    video.addEventListener("play", start); video.addEventListener("loadeddata", stopAndDraw); video.addEventListener("seeked", stopAndDraw); video.addEventListener("pause", stopAndDraw); window.addEventListener("resize", stopAndDraw);
    return () => { window.cancelAnimationFrame(animationFrame); video.removeEventListener("play", start); video.removeEventListener("loadeddata", stopAndDraw); video.removeEventListener("seeked", stopAndDraw); video.removeEventListener("pause", stopAndDraw); window.removeEventListener("resize", stopAndDraw); };
  }, [analysis, patientTrackId]);
  const patient = analysis.tracks.find((track) => track.trackId === patientTrackId);
  return <article className="rounded-xl bg-white p-2"><div className="flex items-center justify-between gap-2"><p className="text-xs font-black">{label}</p><p className="text-[9px] font-bold text-[#71858a]">検出 {analysis.tracks.length}人・信頼度 {Math.round((patient?.averageConfidence ?? 0) * 100)}%</p></div><div className="relative mt-2 aspect-video overflow-hidden rounded-xl bg-black"><video ref={videoRef} controls playsInline className="size-full object-contain" /><canvas ref={canvasRef} aria-label={`${label}の姿勢推定オーバーレイ`} className="pointer-events-none absolute inset-0 size-full" /><span className="pointer-events-none absolute left-2 top-2 rounded-lg bg-[#08232b]/80 px-2 py-1 text-[9px] font-black text-white">姿勢推定オーバーレイ</span></div></article>;
}

async function createPhysicalComparisonVideo(beforeFile: File, afterFile: File, analyses: PairedAnalyses, trackIds: PairedTrackIds) {
  const urls = [URL.createObjectURL(beforeFile), URL.createObjectURL(afterFile)];
  try {
    const videos = urls.map((src) => { const video = document.createElement("video"); video.src = src; video.muted = true; video.playsInline = true; return video; });
    await Promise.all(videos.map((video) => new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error("比較動画を読み込めませんでした。")); video.load(); })));
    const canvas = document.createElement("canvas"); canvas.width = 1280; canvas.height = 480; const context = canvas.getContext("2d");
    if (!context || !canvas.captureStream || typeof MediaRecorder === "undefined") throw new Error("この端末は比較動画の作成に対応していません。");
    const stream = canvas.captureStream(20); const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" : "video/webm"; const recorder = new MediaRecorder(stream, { mimeType }); const chunks: BlobPart[] = [];
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const duration = Math.max(1, Math.min(...videos.map((video) => Number.isFinite(video.duration) ? video.duration : 1)));
    videos.forEach((video) => { video.currentTime = 0; void video.play(); }); recorder.start(500); const started = performance.now();
    await new Promise<void>((resolve) => { const draw = (now: number) => { context.fillStyle = "#102a30"; context.fillRect(0, 0, 1280, 480); videos.forEach((video, index) => { context.drawImage(video, index * 640, 0, 640, 480); context.fillStyle = "rgba(8,38,44,.78)"; context.fillRect(index * 640 + 18, 16, 160, 36); context.fillStyle = "white"; context.font = "bold 20px sans-serif"; context.fillText(index === 0 ? "HAL 使用前" : "HAL 使用後", index * 640 + 32, 41); const phase = index === 0 ? "before" : "after"; const analysis = analyses[phase]; if (analysis) drawPoseFrame(context, nearestPoseFrame(analysis, video.currentTime), trackIds[phase], { left: index * 640, top: 0, width: 640, height: 480 }); }); if ((now - started) / 1000 >= duration) resolve(); else requestAnimationFrame(draw); }; requestAnimationFrame(draw); });
    videos.forEach((video) => video.pause()); await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); recorder.stop(); }); stream.getTracks().forEach((track) => track.stop()); const blob = new Blob(chunks, { type: recorder.mimeType }); return new File([blob], `physical-function-comparison-${Date.now()}.webm`, { type: recorder.mimeType });
  } finally { urls.forEach((url) => URL.revokeObjectURL(url)); }
}

function RoleSelector({ analysis, patientTrackId, onPatient }: { analysis: VideoPoseAnalysis; patientTrackId: string; onPatient: (id: string) => void }) {
  // The preview is an in-memory canvas data URL, so Next image optimization does not apply.
  // eslint-disable-next-line @next/next/no-img-element
  return <div className="mt-3 rounded-xl bg-white p-3"><p className="text-xs font-black">patientを選択</p>{analysis.previewDataUrl && <img src={analysis.previewDataUrl} alt="人物追跡結果" className="mt-2 aspect-video w-full rounded-lg bg-black object-contain" />}<div className="mt-2 grid grid-cols-2 gap-2">{analysis.tracks.map((track) => <button key={track.trackId} onClick={() => onPatient(track.trackId)} className={`rounded-xl border p-2 text-left text-xs ${patientTrackId === track.trackId ? "border-[#087f71] bg-[#e7f5f1] text-[#087f71]" : "border-[#ead7c2] bg-[#fff8ef] text-[#986126]"}`}><b>{track.trackId}</b><span className="float-right">{patientTrackId === track.trackId ? "patient" : "helper"}</span><p className="mt-1 text-[9px]">検出率 {track.coveragePercent}%</p></button>)}</div><p className="mt-2 text-[9px] leading-4 text-[#71858a]">緑表示にした人物だけを利用者として解析します。その他はhelperとして介助・遮蔽を記録します。</p></div>;
}

function TrendPanel({ sessions }: { sessions: Session[] }) {
  const speeds = sessions.map((session) => Number(session.analysis?.walkingSpeedMps ?? 0)); const max = Math.max(...speeds, 1);
  return <section className="rounded-[22px] border border-[#dce8e5] bg-white p-4"><h3 className="flex items-center gap-2 font-black"><BarChart3 size={18} className="text-[#087f71]" />歩行速度の推移</h3><div className="mt-3 flex h-32 items-end gap-2">{sessions.map((session, index) => <div key={session.id} className="flex min-w-0 flex-1 flex-col items-center justify-end"><b className="text-[10px] text-[#087f71]">{numberText(speeds[index])}</b><div className="mt-1 w-full rounded-t-lg bg-[#38ad95]" style={{ height: `${Math.max(8, speeds[index] / max * 90)}px` }} /><span className="mt-1 truncate text-[8px] text-[#71858a]">{new Date(session.recorded_at).toLocaleDateString("ja-JP", { month: "numeric", day: "numeric" })}</span></div>)}</div><p className="mt-2 text-[9px] text-[#71858a]">m/s・撮影距離と介助条件が同じ記録を比較してください。</p></section>;
}

function HalComparisonPanel({ sessions, customerName }: { sessions: Session[]; customerName: string }) {
  const baseline = sessions.find((session) => session.capture_condition === "without_hal" && session.analysis);
  const withHal = sessions.find((session) => session.capture_condition !== "without_hal" && session.analysis);
  if (!customerName) return null;
  if (!baseline || !withHal) return <section className="rounded-[22px] border border-dashed border-[#cfdedb] bg-[#f8fbfa] p-4"><h3 className="font-black">HAL使用前・使用中の比較</h3><p className="mt-1 text-xs leading-5 text-[#71858a]">{customerName}さんの同条件に近い「HALなし」と「HAL装着」の解析が揃うと、歩行速度・左右対称性・体幹傾斜の差を表示します。</p></section>;
  const delta = (halValue: number | string | null, baseValue: number | string | null, digits = 2) => {
    if (halValue == null || baseValue == null) return "—";
    const difference = Number(halValue) - Number(baseValue);
    return `${difference >= 0 ? "+" : ""}${difference.toFixed(digits)}`;
  };
  return <section className="rounded-[22px] border border-[#c9e4dd] bg-white p-4"><div className="flex flex-wrap items-end justify-between gap-2"><div><h3 className="font-black">HAL使用前・使用中の比較</h3><p className="mt-1 text-xs text-[#71858a]">{customerName}さん・撮影距離と介助条件を確認して解釈</p></div><span className="rounded-full bg-[#fff4dc] px-3 py-1 text-[9px] font-black text-[#8c620f]">療法士確認が必要</span></div><div className="mt-3 grid grid-cols-3 gap-2"><ComparisonMetric label="歩行速度 m/s" before={baseline.analysis?.walkingSpeedMps} after={withHal.analysis?.walkingSpeedMps} difference={delta(withHal.analysis?.walkingSpeedMps ?? null, baseline.analysis?.walkingSpeedMps ?? null)} /><ComparisonMetric label="左右対称性 %" before={baseline.analysis?.symmetryPercent} after={withHal.analysis?.symmetryPercent} difference={delta(withHal.analysis?.symmetryPercent ?? null, baseline.analysis?.symmetryPercent ?? null, 1)} /><ComparisonMetric label="体幹傾斜 °" before={baseline.analysis?.trunkLeanDegrees} after={withHal.analysis?.trunkLeanDegrees} difference={delta(withHal.analysis?.trunkLeanDegrees ?? null, baseline.analysis?.trunkLeanDegrees ?? null, 1)} /></div><p className="mt-3 text-[9px] leading-4 text-[#71858a]">HALなし：{dateText(baseline.recorded_at)}・{baseline.walking_distance_m}m・{assistanceLabel[baseline.assistance_level]} ／ HAL装着：{dateText(withHal.recorded_at)}・{withHal.walking_distance_m}m・{assistanceLabel[withHal.assistance_level]}</p></section>;
}
function ComparisonMetric({ label, before, after, difference }: { label: string; before: number | string | null | undefined; after: number | string | null | undefined; difference: string }) { return <div className="rounded-xl bg-[#f3f8f7] p-3"><p className="text-[9px] font-bold text-[#71858a]">{label}</p><div className="mt-2 flex items-end justify-between gap-1"><span className="text-xs">前 <b>{numberText(before)}</b></span><span className="text-xs">HAL <b>{numberText(after)}</b></span></div><p className="mt-2 text-center text-sm font-black text-[#087f71]">差 {difference}</p></div>; }

function SessionCard({ session, onDetail }: { session: Session; onDetail: (session: Session) => void }) {
  const analysis = session.analysis;
  return <article className="rounded-2xl border border-[#dce8e5] p-4"><div className="flex items-start justify-between"><div><p className="font-black">{session.customer_name}</p><p className="mt-1 text-xs text-[#71858a]">{dateText(session.recorded_at)}・{session.evaluator_name}</p></div><span className={`rounded-full px-2.5 py-1 text-[9px] font-black ${session.status === "finalized" ? "bg-[#e7f5f1] text-[#087f71]" : "bg-[#fff3d5] text-[#94630d]"}`}>{session.status === "finalized" ? "確定" : "療法士確認待ち"}</span></div><div className="mt-3 flex flex-wrap gap-1"><span className="rounded-lg bg-[#eef3f2] px-2 py-1 text-[9px] font-bold">{conditionLabel[session.capture_condition]}</span><span className="rounded-lg bg-[#eef3f2] px-2 py-1 text-[9px] font-bold">{assistanceLabel[session.assistance_level] ?? session.assistance_level}</span><span className="rounded-lg bg-[#eef3f2] px-2 py-1 text-[9px] font-bold">{deviceLabel[session.assistive_device] ?? session.assistive_device}</span></div>{analysis ? <div className="mt-3 grid grid-cols-4 gap-2"><MiniMetric label="速度" value={`${numberText(analysis.walkingSpeedMps)}m/s`} /><MiniMetric label="歩数" value={`${analysis.stepCount ?? "—"}歩`} /><MiniMetric label="歩調" value={`${numberText(analysis.cadenceSpm, 1)}`} /><MiniMetric label="信頼度" value={`${Math.round(Number(analysis.confidence) * 100)}%`} /></div> : <p className="mt-3 rounded-xl bg-[#f4f7f6] p-3 text-xs text-[#71858a]">動画解析はまだありません</p>}<button onClick={() => onDetail(session)} className="mt-3 min-h-11 w-full rounded-xl bg-[#edf5f3] text-xs font-black text-[#087f71]">動画・解析・所見を確認</button></article>;
}
function MiniMetric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f4f7f6] p-2 text-center"><p className="text-[8px] text-[#71858a]">{label}</p><p className="mt-1 text-xs font-black">{value}</p></div>; }

function SessionDetail({ session, onClose, onSaved }: { session: Session; onClose: () => void; onSaved: () => Promise<void> }) {
  const [notes, setNotes] = useState(session.notes ?? ""); const [summary, setSummary] = useState(session.clinician_summary || session.report?.summary || ""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function finalize() { setSaving(true); setError(""); try { const response = await fetch("/api/physical-function", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id, status: "finalized", clinicianSummary: summary, notes }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); await onSaved(); } catch (reason) { setError(reason instanceof Error ? reason.message : "確定できませんでした。"); } finally { setSaving(false); } }
  const videos = ([
    ["baseline", "HAL使用前動画"],
    ["hal_assisted", "HAL使用後動画"],
    ["analysis", "HAL前後比較動画"],
  ] as const).flatMap(([phase, label]) => {
    const video = [...session.videos].reverse().find((item) => item.phase === phase);
    return video ? [{ ...video, label }] : [];
  });
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#09262c]/60 p-3"><section role="dialog" aria-modal="true" className="my-3 max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-[26px] bg-white p-5">
    <div className="flex items-start justify-between"><div><p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">PHYSICAL FUNCTION DETAIL</p><h3 className="text-xl font-black">{session.customer_name}さん・身体機能解析</h3><p className="mt-1 text-xs text-[#71858a]">{conditionLabel[session.capture_condition]}・{assistanceLabel[session.assistance_level]}</p></div><div className="flex gap-2"><button onClick={() => window.print()} className="min-h-10 rounded-xl bg-[#f7f5ff] px-3 text-xs font-black text-[#5d49b6]">印刷・PDF保存</button><button onClick={onClose} className="grid size-10 place-items-center rounded-xl bg-[#edf4f2]"><X /></button></div></div>
    <div className="mt-4 grid gap-3 md:grid-cols-3">{videos.map((video) => <div key={video.id}><p className="mb-1 text-xs font-black text-[#5d49b6]">{video.label}</p><video src={video.url} controls playsInline className="aspect-video w-full rounded-xl bg-black object-contain" /></div>)}{!videos.length && <div className="col-span-full grid aspect-video max-h-72 place-items-center rounded-xl bg-[#edf3f2] text-sm text-[#71858a]">動画なし</div>}</div>
    <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-6"><MiniMetric label="歩行時間" value={`${numberText(session.analysis?.walkingTimeSeconds)}秒`} /><MiniMetric label="歩行速度" value={`${numberText(session.analysis?.walkingSpeedMps)}m/s`} /><MiniMetric label="左右対称性" value={`${numberText(session.analysis?.symmetryPercent, 1)}%`} /><MiniMetric label="体幹傾斜" value={`${numberText(session.analysis?.trunkLeanDegrees, 1)}°`} /><MiniMetric label="patient" value={session.analysis?.patientTrackId || "未設定"} /><MiniMetric label="helperトラック" value={`${session.analysis?.helperTrackIds?.length ?? 0}本`} /></div>
    {session.analysis?.qualityFlags?.length ? <div className="mt-3 rounded-xl border border-[#efcf85] bg-[#fff9e9] p-3"><p className="flex items-center gap-2 text-xs font-black text-[#8b5b08]"><AlertTriangle size={15} />解析上の注意</p>{session.analysis.qualityFlags.map((flag) => <p key={flag} className="mt-1 text-xs text-[#765f31]">・{flag}</p>)}</div> : <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#e7f5f1] p-3 text-xs font-bold text-[#087f71]"><CheckCircle2 size={16} />大きな撮影品質警告はありません</p>}
    {session.report && <section className="mt-3 rounded-xl bg-[#faf9ff] p-4"><h4 className="font-black text-[#5d49b6]">RoboReha解析サマリー</h4><p className="mt-2 text-sm leading-6">{session.report.summary}</p><div className="mt-3 flex flex-wrap gap-2">{session.report.commentCandidates.map((candidate) => <button key={candidate} onClick={() => setSummary((current) => `${current}${current ? "\n" : ""}${candidate}`)} className="rounded-xl border border-[#d8d1f1] bg-white px-3 py-2 text-left text-xs font-bold text-[#5d49b6]">＋ {candidate}</button>)}</div><p className="mt-3 text-[9px] leading-4 text-[#776f91]">{session.report.disclaimer}</p></section>}
    <label className="mt-3 block text-xs font-black text-[#71858a]">療法士所見<textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 min-h-28 w-full rounded-xl border border-[#d7e4e1] p-3 text-sm font-normal text-[#173b42]" /></label><label className="mt-3 block text-xs font-black text-[#71858a]">申し送り<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-[#d7e4e1] p-3 text-sm font-normal text-[#173b42]" /></label>{error && <p className="mt-2 text-sm font-bold text-[#b94637]">{error}</p>}<button onClick={finalize} disabled={saving || !session.analysis} className="mt-4 min-h-12 w-full rounded-xl bg-[#087f71] font-black text-white disabled:opacity-40">療法士確認済みとして確定</button>
  </section></div>;
}
