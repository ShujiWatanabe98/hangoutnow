"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, BarChart3, Camera, CheckCircle2, CircleStop,
  FileVideo, LoaderCircle, Play, RefreshCw, Save,
  ScanLine, Sparkles, UserCheck, X,
} from "lucide-react";
import {
  analyzeVideoFile, ROBOREHA_POSE_ENGINE, summarizeGait,
  type VideoPoseAnalysis,
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
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [poseAnalysis, setPoseAnalysis] = useState<VideoPoseAnalysis | null>(null);
  const [patientTrackId, setPatientTrackId] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [detail, setDetail] = useState<Session | null>(null);
  const selectedAppointment = appointments.find((item) => item.id === selectedAppointmentId) ?? null;

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

  async function handlePoseAnalysis() {
    if (!videoFile) { setError("撮影または動画選択を行ってください。"); return; }
    setBusy(true); setError(""); setMessage(""); setProgress(0); setPoseAnalysis(null);
    try {
      const analysis = await analyzeVideoFile(videoFile, setProgress);
      if (!analysis.tracks.length) throw new Error("人物を検出できませんでした。全身が映る動画で撮り直してください。");
      setPoseAnalysis(analysis);
      setPatientTrackId(analysis.tracks[0].trackId);
      setMessage("姿勢推定が完了しました。利用者を選択して結果を保存してください。");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "姿勢推定を実行できませんでした。"); }
    finally { setBusy(false); }
  }

  async function saveAnalysis() {
    if (!videoFile || !poseAnalysis || !patientTrackId) return;
    if (!consentConfirmed) { setError("動画保存の同意確認を行ってください。"); return; }
    setBusy(true); setError(""); setMessage("");
    try {
      const sessionId = await saveSession();
      const helperTrackIds = poseAnalysis.tracks.map((track) => track.trackId).filter((id) => id !== patientTrackId);
      const summary = summarizeGait(poseAnalysis, patientTrackId, Number(walkingDistanceM), helperTrackIds, captureCondition);
      const form = new FormData();
      form.append("sessionId", sessionId); form.append("testCode", "gait");
      form.append("phase", captureCondition === "without_hal" ? "baseline" : "hal_assisted");
      form.append("consentConfirmed", "true"); form.append("file", videoFile);
      form.append("durationSeconds", String(poseAnalysis.durationSeconds));
      form.append("width", String(poseAnalysis.width)); form.append("height", String(poseAnalysis.height));
      form.append("fps", "30");
      const upload = await fetch("/api/physical-function/videos", { method: "POST", body: form });
      const uploaded = await upload.json();
      if (!upload.ok) throw new Error(uploaded.error ?? "動画を保存できませんでした。");
      const analysisResponse = await fetch("/api/physical-function/analyze", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, videoId: uploaded.video.id, engineVersion: ROBOREHA_POSE_ENGINE,
          patientTrackId, helperTrackIds, poseSummary: summary.poseSummary,
          qualityFlags: summary.qualityFlags, metrics: summary.metrics }),
      });
      const saved = await analysisResponse.json();
      if (!analysisResponse.ok) throw new Error(saved.error ?? "解析結果を保存できませんでした。");
      setMessage("動画、patient/helper、歩行解析結果を保存しました。療法士が内容を確認してください。");
      setPoseAnalysis(null); setVideoFile(null); setPatientTrackId(""); setProgress(0);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "解析結果を保存できませんでした。"); }
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

    <section className="grid gap-3 lg:grid-cols-[.9fr_1.15fr_1.2fr]">
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

      <div className="rounded-[22px] border border-[#d8d1f1] bg-[#fbfaff] p-4">
        <h3 className="flex items-center gap-2 font-black text-[#5d49b6]"><Camera size={19} />3. 1台iPad撮影・解析</h3>
        <SingleIpadRecorder onFile={setVideoFile} disabled={busy} />
        {videoFile && <div className="mt-2 flex items-center justify-between rounded-xl bg-white p-2 text-xs"><span className="truncate"><FileVideo className="mr-1 inline" size={14} />{videoFile.name}</span><button aria-label="動画を外す" onClick={() => { setVideoFile(null); setPoseAnalysis(null); }} className="grid size-8 place-items-center rounded-lg bg-[#f1f3f8]"><X size={15} /></button></div>}
        <label className="mt-3 flex items-start gap-2 rounded-xl bg-white p-3 text-xs font-bold leading-5"><input type="checkbox" checked={consentConfirmed} onChange={(event) => setConsentConfirmed(event.target.checked)} className="mt-1 size-4" />利用者の動画保存・身体機能解析の同意を確認しました</label>
        <button onClick={handlePoseAnalysis} disabled={busy || !videoFile} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5d49b6] font-black text-white disabled:opacity-40">{busy ? <LoaderCircle className="animate-spin" size={18} /> : <ScanLine size={18} />}姿勢推定を開始</button>
        {busy && progress > 0 && <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#e2def2]"><div className="h-full bg-[#6d5bc1] transition-all" style={{ width: `${progress}%` }} /></div>}
        {poseAnalysis && <RoleSelector analysis={poseAnalysis} patientTrackId={patientTrackId} onPatient={setPatientTrackId} />}
        {poseAnalysis && <button onClick={saveAnalysis} disabled={busy || !patientTrackId || !consentConfirmed} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#087f71] font-black text-white disabled:opacity-40"><Sparkles size={18} />役割を確定して解析結果を保存</button>}
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

function CaptureGuide() { return <div className="pointer-events-none absolute inset-0"><div className="absolute left-1/2 top-[8%] h-[82%] w-[34%] -translate-x-1/2 rounded-[45%] border-2 border-dashed border-white/85" /><div className="absolute left-[18%] right-[18%] top-1/2 border-t border-dashed border-[#6ff0c2]" /><div className="absolute bottom-[8%] left-[12%] right-[12%] flex justify-between text-[9px] font-black text-white"><span>開始線</span><span>終了線</span></div><div className="absolute inset-x-0 top-2 text-center text-[10px] font-black text-white drop-shadow">頭から足まで枠内へ・iPadは横向き固定</div></div>; }

function SingleIpadRecorder({ onFile, disabled }: { onFile: (file: File) => void; disabled: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null); const streamRef = useRef<MediaStream | null>(null); const recorderRef = useRef<MediaRecorder | null>(null); const chunksRef = useRef<Blob[]>([]); const timerRef = useRef<number | null>(null);
  const [cameraReady, setCameraReady] = useState(false); const [recording, setRecording] = useState(false); const [countdown, setCountdown] = useState<5 | 10 | 15>(10); const [remaining, setRemaining] = useState<number | null>(null); const [elapsed, setElapsed] = useState(0); const [error, setError] = useState(""); const [loadingTest, setLoadingTest] = useState(false);
  useEffect(() => () => { streamRef.current?.getTracks().forEach((track) => track.stop()); if (timerRef.current) window.clearInterval(timerRef.current); }, []);
  async function openCamera() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } }, audio: false });
      streamRef.current = stream; if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); } setCameraReady(true);
    } catch { setError("カメラを開始できません。iPadのカメラ権限を確認してください。"); }
  }
  async function startCountdown() {
    if (!streamRef.current) return;
    let value = countdown; setRemaining(value);
    window.speechSynthesis?.speak(new SpeechSynthesisUtterance(`${countdown}秒後に撮影を開始します`));
    while (value > 0) { await new Promise((resolve) => window.setTimeout(resolve, 1000)); value -= 1; setRemaining(value); }
    beginRecording();
  }
  function beginRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp8") ? "video/webm;codecs=vp8" : "video/webm";
    const recorder = new MediaRecorder(streamRef.current, { mimeType }); recorderRef.current = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => { const type = recorder.mimeType || "video/webm"; const file = new File([new Blob(chunksRef.current, { type })], `physical-function-${Date.now()}.webm`, { type }); onFile(file); setRecording(false); setRemaining(null); if (timerRef.current) window.clearInterval(timerRef.current); window.speechSynthesis?.speak(new SpeechSynthesisUtterance("撮影を終了しました")); };
    recorder.start(500); setRecording(true); setElapsed(0); window.speechSynthesis?.speak(new SpeechSynthesisUtterance("撮影を開始します"));
    const started = Date.now(); timerRef.current = window.setInterval(() => { const seconds = Math.floor((Date.now() - started) / 1000); setElapsed(seconds); if (seconds >= 90 && recorder.state === "recording") recorder.stop(); }, 500);
  }
  function stop() { if (recorderRef.current?.state === "recording") recorderRef.current.stop(); }
  async function loadTestVideo() {
    setLoadingTest(true); setError("");
    try {
      const response = await fetch("/api/physical-function/test-video", { cache: "no-store" });
      if (!response.ok) { const body = await response.json(); throw new Error(body.error ?? "テスト動画を読み込めませんでした。"); }
      const blob = await response.blob();
      onFile(new File([blob], "fg001-patient-helper-walking.mp4", { type: "video/mp4" }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "テスト動画を読み込めませんでした。"); }
    finally { setLoadingTest(false); }
  }
  return <div className="mt-3"><div className="relative aspect-video overflow-hidden rounded-xl bg-[#122b31]"><video ref={videoRef} muted playsInline className="size-full object-cover" /><CaptureGuide />{remaining != null && !recording && <div className="absolute inset-0 grid place-items-center bg-[#0b242b]/55 text-7xl font-black text-white">{remaining || "開始"}</div>}{recording && <div className="absolute right-2 top-2 flex items-center gap-2 rounded-full bg-[#c9463b] px-3 py-1 text-xs font-black text-white"><span className="size-2 animate-pulse rounded-full bg-white" />REC {elapsed}秒</div>}</div>
    {error && <p className="mt-2 text-xs font-bold text-[#b94637]">{error}</p>}
    <div className="mt-2 flex gap-2">{!cameraReady ? <button onClick={openCamera} disabled={disabled} className="min-h-11 flex-1 rounded-xl bg-[#173b42] text-xs font-black text-white"><Camera className="mr-1 inline" size={16} />カメラを準備</button> : !recording && remaining == null ? <><select aria-label="撮影開始まで" value={countdown} onChange={(event) => setCountdown(Number(event.target.value) as 5 | 10 | 15)} className="rounded-xl border px-2 text-xs font-black"><option value={5}>5秒後</option><option value={10}>10秒後</option><option value={15}>15秒後</option></select><button onClick={startCountdown} disabled={disabled} className="min-h-11 flex-1 rounded-xl bg-[#c9463b] text-xs font-black text-white"><Play className="mr-1 inline" size={15} />撮影開始</button></> : <button onClick={stop} className="min-h-11 flex-1 rounded-xl bg-[#c9463b] text-xs font-black text-white"><CircleStop className="mr-1 inline" size={15} />撮影停止</button>}<label className="grid min-h-11 cursor-pointer place-items-center rounded-xl border border-[#d8d1f1] bg-white px-3 text-xs font-black text-[#5d49b6]">動画選択<input type="file" accept="video/mp4,video/quicktime,video/webm,video/x-m4v" className="hidden" onChange={(event) => event.target.files?.[0] && onFile(event.target.files[0])} /></label></div>
    {process.env.NODE_ENV !== "production" && <button type="button" onClick={loadTestVideo} disabled={disabled || loadingTest} className="mt-2 min-h-10 w-full rounded-xl border border-dashed border-[#b9afd9] bg-[#f7f5ff] text-xs font-black text-[#5d49b6] disabled:opacity-40">{loadingTest ? "テスト動画を読込中…" : "開発用 patient/helper 歩行動画を使う"}</button>}
  </div>;
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
  const video = session.videos.find((item) => item.phase !== "analysis");
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#09262c]/60 p-3"><section role="dialog" aria-modal="true" className="my-3 max-h-[96vh] w-full max-w-4xl overflow-y-auto rounded-[26px] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">PHYSICAL FUNCTION DETAIL</p><h3 className="text-xl font-black">{session.customer_name}さん・身体機能解析</h3><p className="mt-1 text-xs text-[#71858a]">{conditionLabel[session.capture_condition]}・{assistanceLabel[session.assistance_level]}</p></div><div className="flex gap-2"><button onClick={() => window.print()} className="min-h-10 rounded-xl bg-[#f7f5ff] px-3 text-xs font-black text-[#5d49b6]">印刷・PDF保存</button><button onClick={onClose} className="grid size-10 place-items-center rounded-xl bg-[#edf4f2]"><X /></button></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{video ? <video src={video.url} controls playsInline className="aspect-video w-full rounded-xl bg-black object-contain" /> : <div className="grid aspect-video place-items-center rounded-xl bg-[#edf3f2] text-sm text-[#71858a]">動画なし</div>}<div className="grid grid-cols-2 gap-2"><MiniMetric label="歩行時間" value={`${numberText(session.analysis?.walkingTimeSeconds)}秒`} /><MiniMetric label="歩行速度" value={`${numberText(session.analysis?.walkingSpeedMps)}m/s`} /><MiniMetric label="左右対称性" value={`${numberText(session.analysis?.symmetryPercent, 1)}%`} /><MiniMetric label="体幹傾斜" value={`${numberText(session.analysis?.trunkLeanDegrees, 1)}°`} /><MiniMetric label="patient" value={session.analysis?.patientTrackId || "未設定"} /><MiniMetric label="helperトラック" value={`${session.analysis?.helperTrackIds?.length ?? 0}本`} /></div></div>{session.analysis?.qualityFlags?.length ? <div className="mt-3 rounded-xl border border-[#efcf85] bg-[#fff9e9] p-3"><p className="flex items-center gap-2 text-xs font-black text-[#8b5b08]"><AlertTriangle size={15} />解析上の注意</p>{session.analysis.qualityFlags.map((flag) => <p key={flag} className="mt-1 text-xs text-[#765f31]">・{flag}</p>)}</div> : <p className="mt-3 flex items-center gap-2 rounded-xl bg-[#e7f5f1] p-3 text-xs font-bold text-[#087f71]"><CheckCircle2 size={16} />大きな撮影品質警告はありません</p>}{session.report && <section className="mt-3 rounded-xl bg-[#faf9ff] p-4"><h4 className="font-black text-[#5d49b6]">RoboReha解析サマリー</h4><p className="mt-2 text-sm leading-6">{session.report.summary}</p><div className="mt-3 flex flex-wrap gap-2">{session.report.commentCandidates.map((candidate) => <button key={candidate} onClick={() => setSummary((current) => `${current}${current ? "\n" : ""}${candidate}`)} className="rounded-xl border border-[#d8d1f1] bg-white px-3 py-2 text-left text-xs font-bold text-[#5d49b6]">＋ {candidate}</button>)}</div><p className="mt-3 text-[9px] leading-4 text-[#776f91]">{session.report.disclaimer}</p></section>}<label className="mt-3 block text-xs font-black text-[#71858a]">療法士所見<textarea value={summary} onChange={(event) => setSummary(event.target.value)} className="mt-1 min-h-28 w-full rounded-xl border border-[#d7e4e1] p-3 text-sm font-normal text-[#173b42]" /></label><label className="mt-3 block text-xs font-black text-[#71858a]">申し送り<textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-20 w-full rounded-xl border border-[#d7e4e1] p-3 text-sm font-normal text-[#173b42]" /></label>{error && <p className="mt-2 text-sm font-bold text-[#b94637]">{error}</p>}<button onClick={finalize} disabled={saving || !session.analysis} className="mt-4 min-h-12 w-full rounded-xl bg-[#087f71] font-black text-white disabled:opacity-40">療法士確認済みとして確定</button></section></div>;
}
