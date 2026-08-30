import { NextResponse } from "next/server";
import { z } from "zod";
import { GET as getAppointments } from "../appointments/route";
import { DEMO_CUSTOMER_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.enum(["booking", "preview", "analysis"]);
const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

type ProductHistory = {
  product_id: string;
  product_name: string;
  duration_minutes: number;
  completed_count: number;
  last_used_at: string;
  average_start_hour: number | null;
};
type Assessment = {
  assessed_at: string;
  pre_metrics: Record<string, number> | null;
  post_metrics: Record<string, number> | null;
  delta_summary: Record<string, number> | null;
  summary_text: string | null;
  notes: string | null;
};
type Session = { exercise_log: unknown; soap: unknown; ended_at: string | null };
type Intake = { pain_scale: number | null; fall_history: boolean; fracture_risk: boolean; chief_complaint: string | null };
type Customer = { name: string; diagnosis_name: string | null; primary_condition: string | null; goal: string | null };
type Upcoming = { id: string; start_at: string; end_at: string; product_name: string; therapist_name: string; hal_asset_code: string | null; rehab_space_name: string | null };
type AppointmentSlot = { startAt: string; available: boolean; therapistId: string | null; therapistName: string | null; halUnitId: string | null; halAssetCode: string | null; rehabSpaceId: string | null; rehabSpaceName: string | null };
type AppointmentProduct = { id: string; name: string; duration_minutes: number; required_model_type: string };
type AppointmentPayload = { products: AppointmentProduct[]; slots: AppointmentSlot[] };

const metricDefinitions: Array<{ key: string; label: string; unit: string; better: "up" | "down" }> = [
  { key: "walk10mSeconds", label: "10m歩行時間", unit: "秒", better: "down" },
  { key: "gaitSpeed", label: "歩行速度", unit: "m/s", better: "up" },
  { key: "tugSeconds", label: "TUG", unit: "秒", better: "down" },
  { key: "bbs", label: "BBS", unit: "点", better: "up" },
  { key: "chairStand30s", label: "30秒立ち上がり", unit: "回", better: "up" },
];

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function exerciseItems(value: unknown) {
  return Array.isArray(value) ? value.map(objectValue) : [];
}

async function loadContext() {
  const [customer, history, assessments, sessions, intake, upcoming] = await Promise.all([
    query<Customer>(`SELECT name,diagnosis_name,primary_condition,goal FROM customers WHERE id=$1 AND store_id=$2`, [DEMO_CUSTOMER_ID, DEMO_STORE_ID]),
    query<ProductHistory>(`SELECT p.id AS product_id,p.name AS product_name,p.duration_minutes,count(*)::int AS completed_count,max(a.start_at)::text AS last_used_at,avg(EXTRACT(HOUR FROM a.start_at AT TIME ZONE 'Asia/Tokyo')+EXTRACT(MINUTE FROM a.start_at AT TIME ZONE 'Asia/Tokyo')/60)::float AS average_start_hour FROM appointments a JOIN service_products p ON p.id=a.product_id WHERE a.customer_id=$1 AND a.status='completed' GROUP BY p.id,p.name,p.duration_minutes ORDER BY completed_count DESC,last_used_at DESC`, [DEMO_CUSTOMER_ID]),
    query<Assessment>(`SELECT assessed_at::text,pre_metrics,post_metrics,delta_summary,summary_text,notes FROM clinical_assessments WHERE customer_id=$1 ORDER BY assessed_at DESC LIMIT 12`, [DEMO_CUSTOMER_ID]),
    query<Session>(`SELECT cs.exercise_log,cs.soap,cs.ended_at::text FROM clinical_sessions cs JOIN appointments a ON a.id=cs.appointment_id WHERE a.customer_id=$1 AND cs.ended_at IS NOT NULL ORDER BY cs.ended_at DESC LIMIT 12`, [DEMO_CUSTOMER_ID]),
    query<Intake>(`SELECT pain_scale,fall_history,fracture_risk,chief_complaint FROM intake_questionnaires WHERE customer_id=$1 ORDER BY submitted_at DESC NULLS LAST,created_at DESC LIMIT 1`, [DEMO_CUSTOMER_ID]),
    query<Upcoming>(`SELECT a.id,a.start_at::text,a.end_at::text,p.name AS product_name,st.name AS therapist_name,h.asset_code AS hal_asset_code,rs.name AS rehab_space_name FROM appointments a JOIN service_products p ON p.id=a.product_id JOIN staff_members st ON st.id=a.therapist_id LEFT JOIN hal_units h ON h.id=a.hal_unit_id LEFT JOIN rehabilitation_spaces rs ON rs.id=a.rehab_space_id WHERE a.customer_id=$1 AND a.start_at>now() AND a.status IN ('reserved','confirmed') ORDER BY a.start_at LIMIT 1`, [DEMO_CUSTOMER_ID]),
  ]);
  if (!customer.rows[0]) throw new Error("利用者情報が見つかりません。");
  return { customer: customer.rows[0], history: history.rows, assessments: assessments.rows, sessions: sessions.rows, intake: intake.rows[0] ?? null, upcoming: upcoming.rows[0] ?? null };
}

function staminaSummary(sessions: Session[], intake: Intake | null) {
  const minutes = sessions.flatMap((session) => exerciseItems(session.exercise_log)).map((item) => Number(item.minutes)).filter(Number.isFinite);
  const averageMinutes = minutes.length ? Math.round(minutes.reduce((sum, value) => sum + value, 0) / minutes.length) : null;
  if (averageMinutes !== null) return { averageMinutes, text: `過去の運動記録は平均${averageMinutes}分です。体調は当日も療法士が確認します。` };
  if (intake?.pain_scale !== null && intake?.pain_scale !== undefined) return { averageMinutes: null, text: `体力の運動時間記録はありません。問診の痛みは10段階中${intake.pain_scale}として確認しています。` };
  return { averageMinutes: null, text: "体力を判断できる運動時間の記録がないため、適性は未確認です。" };
}

async function bookingProposal(request: Request, excludeAppointmentId: string | null) {
  const context = await loadContext();
  const initialResponse = await getAppointments(new Request(new URL("/api/appointments", request.url)));
  if (!initialResponse.ok) throw new Error("予約可能枠を確認できませんでした。");
  const initial = await initialResponse.json() as AppointmentPayload;
  const productHistory = new Map(context.history.map((item) => [item.product_id, item]));
  const availability = await Promise.all(initial.products.map(async (product) => {
    const url = new URL("/api/appointments", request.url);
    url.searchParams.set("productId", product.id);
    if (excludeAppointmentId) url.searchParams.set("excludeAppointmentId", excludeAppointmentId);
    const response = await getAppointments(new Request(url));
    if (!response.ok) return { product, slots: [] as AppointmentSlot[] };
    const payload = await response.json() as AppointmentPayload;
    return { product, slots: payload.slots.filter((slot) => slot.available) };
  }));
  const latestAssessment = context.assessments[0];
  const stamina = staminaSummary(context.sessions, context.intake);
  const ranked = availability.flatMap(({ product, slots }) => {
    const past = productHistory.get(product.id);
    const preferredHour = past?.average_start_hour ?? null;
    return slots.map((slot) => {
      const start = new Date(slot.startAt);
      const timeParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(start);
      const timeValues = Object.fromEntries(timeParts.map((part) => [part.type, part.value]));
      const hour = Number(timeValues.hour) + Number(timeValues.minute) / 60;
      const continuityScore = (past?.completed_count ?? 0) * 1000;
      const timeScore = preferredHour === null ? 0 : Math.max(0, 100 - Math.abs(hour - preferredHour) * 20);
      const soonScore = Math.max(0, 30 - Math.floor((start.getTime() - Date.now()) / 86400000));
      return { product, slot, past, score: continuityScore + timeScore + soonScore };
    });
  }).sort((a, b) => b.score - a.score || new Date(a.slot.startAt).getTime() - new Date(b.slot.startAt).getTime());
  const best = ranked[0];
  if (!best || !best.slot.therapistId || !best.slot.halUnitId || !best.slot.rehabSpaceId) {
    return NextResponse.json({ action: "booking", proposal: null, reasons: ["療法士・HAL・リハスペースを同時に確保できる枠が、表示対象の期間にありませんでした。"], evidenceLevel: "insufficient", provider: "safe_demo", disclaimer: "施設へ問い合わせるか、別の週を確認してください。AIは予約を作成・変更していません。" });
  }
  const reasons = [
    best.past ? `過去に「${best.product.name}」を${best.past.completed_count}回利用しており、記録の継続比較がしやすいコースです。` : `このコースの利用履歴はないため、目標「${context.customer.goal ?? "未登録"}」との一致は療法士による確認が必要です。`,
    best.past?.average_start_hour !== null && best.past?.average_start_hour !== undefined ? `これまで利用した時間帯（平均${Math.floor(best.past.average_start_hour)}時ごろ）に近い空き枠を優先しました。` : "過去の利用時間帯が不足しているため、早い空き枠を優先しました。",
    stamina.text,
    latestAssessment?.summary_text ? `直近の評価では「${latestAssessment.summary_text}」と記録されています。` : "改善動向を判断できる評価結果が不足しています。",
    `療法士・${best.slot.halAssetCode}・${best.slot.rehabSpaceName}の空きを、現在の予約ルールで確認済みです。`,
  ];
  return NextResponse.json({
    action: "booking",
    proposal: { productId: best.product.id, productName: best.product.name, durationMinutes: best.product.duration_minutes, startAt: best.slot.startAt, therapistId: best.slot.therapistId, therapistName: best.slot.therapistName, halUnitId: best.slot.halUnitId, halAssetCode: best.slot.halAssetCode, rehabSpaceId: best.slot.rehabSpaceId, rehabSpaceName: best.slot.rehabSpaceName },
    alternatives: ranked.slice(1, 3).map((item) => ({ productId: item.product.id, productName: item.product.name, startAt: item.slot.startAt })),
    reasons,
    evidenceLevel: best.past && latestAssessment ? "record_based" : "limited",
    provider: "safe_demo",
    disclaimer: "これは過去記録と現在の空き状況から作った候補で、効果や医学的適性を保証するものではありません。選択後も予約確定ボタンを押すまで予約は作成・変更されません。",
  });
}

async function previewProposal() {
  const context = await loadContext();
  if (!context.upcoming) return NextResponse.json({ action: "preview", appointment: null, items: [], evidenceLevel: "insufficient", provider: "safe_demo", disclaimer: "今後の予約がないため、AI予習を作成できませんでした。" });
  const latestSession = context.sessions[0];
  const soap = objectValue(latestSession?.soap);
  const exercises = exerciseItems(latestSession?.exercise_log);
  const latestAssessment = context.assessments[0];
  const items: Array<{ title: string; text: string; source: string }> = [];
  if (typeof soap.P === "string" && soap.P.trim()) items.push({ title: "前回の計画を確認", text: `前回の記録は「${soap.P}」です。次回の最初に、できたことや気になったことを療法士へ伝えましょう。`, source: "前回の施術記録" });
  if (exercises.length) {
    const names = exercises.map((item) => String(item.exercise ?? "運動")).filter(Boolean).slice(0, 2).join("・");
    items.push({ title: "前回からの変化をメモ", text: `前回は「${names}」を実施しました。自主練習を新しく増やさず、痛み・疲れ・歩きやすさの変化をメモしておきましょう。`, source: "前回の運動記録" });
  }
  if (latestAssessment?.notes) items.push({ title: "気になる動きを共有", text: `前回の申し送りは「${latestAssessment.notes}」です。同じ動きで変化があれば、次回の評価時に共有しましょう。`, source: "直近の申し送り" });
  items.push({ title: "当日の準備", text: "動きやすい服装と室内用シューズを準備し、当日の体調・睡眠・痛みを療法士へ伝えられるようにしましょう。", source: "施設の来所案内" });
  if (context.intake?.fall_history || context.intake?.fracture_risk || (context.intake?.pain_scale ?? 0) >= 5) items.unshift({ title: "先に施設へ確認", text: "問診に注意が必要な記録があります。運動内容を自己判断で増やさず、痛みや転倒などの変化があれば次回を待たず施設へ連絡してください。", source: "初診問診" });
  return NextResponse.json({ action: "preview", appointment: context.upcoming, items: items.slice(0, 4), evidenceLevel: context.sessions.length ? "record_based" : "limited", provider: "safe_demo", disclaimer: "AI予習は診断や運動処方ではありません。新しい運動や負荷変更は療法士に確認してください。" });
}

async function analysisProposal() {
  const context = await loadContext();
  const completedCount = context.history.reduce((sum, item) => sum + Number(item.completed_count), 0);
  const praises: string[] = [];
  if (completedCount > 0) praises.push(`${completedCount}回の利用記録を積み重ねています。続けて取り組めていること自体が、本当にすばらしいです！`);
  const latest = context.assessments[0];
  const pre = latest?.pre_metrics ?? {};
  const post = latest?.post_metrics ?? {};
  const notImproved: string[] = [];
  for (const metric of metricDefinitions) {
    const before = Number(pre[metric.key]); const after = Number(post[metric.key]);
    if (!Number.isFinite(before) || !Number.isFinite(after)) continue;
    const improved = metric.better === "up" ? after > before : after < before;
    if (improved) praises.push(`${metric.label}が ${before}${metric.unit} から ${after}${metric.unit} へ改善しています。努力が数値にも表れていて、とても素敵です！`);
    else notImproved.push(metric.label);
  }
  if (context.customer.goal) praises.push(`「${context.customer.goal}」という大切な目標を持ち、記録を振り返りながら進めていることが大きな強みです。`);
  if (!praises.length) praises.push("受診記録を残して振り返ろうとしていることが、次の一歩につながる大切な行動です。");
  const gentleSuggestions = notImproved.length
    ? [`${notImproved.slice(0, 2).join("・")}は、まだ大きな変化が見えにくい項目です。焦らず、次回も療法士と一緒に同じ条件で確認してみましょう。`]
    : ["良い変化が続いています。次回も無理に負荷を増やさず、体調を伝えながら療法士と同じ項目を確認していきましょう。"];
  const coverage = latest
    ? `完了した利用${completedCount}回と、直近のHAL使用前後評価（${new Date(latest.assessed_at).toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo" })}）を分析しました。`
    : `完了した利用${completedCount}回を確認しましたが、比較できるHAL使用前後評価はありません。`;
  return NextResponse.json({ action: "analysis", praises, gentleSuggestions, dataCoverage: coverage, evidenceLevel: latest ? "record_based" : "limited", provider: "safe_demo", disclaimer: "同じ日の使用前後記録を中心にした振り返りで、HALによる効果や将来の改善を保証するものではありません。医学的な判断は療法士へ確認してください。" });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = actionSchema.safeParse(url.searchParams.get("action"));
  if (!action.success) return NextResponse.json({ error: "AI機能を選択してください。" }, { status: 400 });
  const excludeRaw = url.searchParams.get("excludeAppointmentId");
  if (excludeRaw && !databaseId.safeParse(excludeRaw).success) return NextResponse.json({ error: "予約IDが正しくありません。" }, { status: 400 });
  try {
    if (action.data === "booking") return bookingProposal(request, excludeRaw);
    if (action.data === "preview") return previewProposal();
    return analysisProposal();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI提案を作成できませんでした。" }, { status: 500 });
  }
}
