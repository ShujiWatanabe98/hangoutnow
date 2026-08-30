"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, CircleStop, Clock3, FileText, Play, Stethoscope, X } from "lucide-react";
import { BlockingProgressOverlay } from "./loading";

type Exercise = { exercise?: string; minutes?: number; steps?: number; completed?: boolean };
type Item = {
  id: string;
  status: string;
  start_at: string;
  end_at: string;
  note: string | null;
  customer_name: string;
  primary_condition: string | null;
  product_name: string;
  hal_asset_code: string | null;
  therapist_name: string;
  rehab_space_name: string | null;
  safety_decision: string | null;
  session_id: string | null;
  started_at: string | null;
  ended_at: string | null;
  exercise_log: Exercise[] | null;
  soap: Record<string, string> | null;
  assessment_summary: string | null;
  assessment_notes: string | null;
  amount_yen: number | null;
  billing_status: string | null;
  payment_method: string | null;
};

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const statusLabel: Record<string, string> = { confirmed: "予約確定", checked_in: "受付済み", in_session: "施術中", completed: "終了" };
const paymentLabel: Record<string, string> = { cash: "現金", credit_card: "クレジットカード", qr: "QR決済", ticket: "回数券" };
const HISTORY_PAGE_SIZE = 8;
function dateKey(value: string) { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)); }
function dateText(value: string) { return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", weekday: "short" }).format(new Date(value)); }
function timeText(value?: string | null) { return value ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "—"; }

export function ClinicalManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [detail, setDetail] = useState<Item | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/clinical-sessions", { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "施術記録を読み込めませんでした。");
      setItems(body.sessions);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "施術記録を読み込めませんでした。"); }
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/clinical-sessions", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "施術記録を読み込めませんでした。");
      if (active) setItems(body.sessions);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "施術記録を読み込めませんでした。"); });
    return () => { active = false; };
  }, []);

  async function act(id: string, action: "start" | "finish") {
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/clinical-sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ appointmentId: id, action, exercise: "HAL歩行・機能訓練" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "施術記録を更新できませんでした。");
      setDetail(null); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "施術記録を更新できませんでした。"); }
    finally { setSaving(false); }
  }

  const todayItems = useMemo(() => items.filter((item) => dateKey(item.start_at) === today).sort((a, b) => a.start_at.localeCompare(b.start_at)), [items]);
  const historyItems = useMemo(() => items.filter((item) => dateKey(item.start_at) !== today && item.session_id).sort((a, b) => b.start_at.localeCompare(a.start_at)), [items]);
  const historyPages = Math.max(1, Math.ceil(historyItems.length / HISTORY_PAGE_SIZE));
  const effectiveHistoryPage = Math.min(historyPage, historyPages);
  const visibleHistoryItems = useMemo(
    () => historyItems.slice((effectiveHistoryPage - 1) * HISTORY_PAGE_SIZE, effectiveHistoryPage * HISTORY_PAGE_SIZE),
    [effectiveHistoryPage, historyItems],
  );

  return <div className="mx-auto max-w-[1400px]">
    <div className="mb-3"><p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">CLINICAL LOG</p><h2 className="text-2xl font-black">施術記録</h2><p className="mt-1 text-xs text-[#71858a]">本日の操作と、過去の施術記録を分けて表示します。</p></div>
    {error && <p role="alert" className="mb-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">{error}</p>}
    <ClinicalSection title="本日" dateLabel={dateText(`${today}T12:00:00+09:00`)} subtitle={`${todayItems.length}件`} icon="today" items={todayItems} empty="本日の施術予定はありません" onDetail={setDetail} onAction={act} saving={saving} />
    <div className="mt-5"><ClinicalSection title="履歴" subtitle={`過去90日・${historyItems.length}件`} icon="history" items={visibleHistoryItems} empty="施術履歴はありません" onDetail={setDetail} onAction={act} saving={saving} history />
      {historyItems.length > HISTORY_PAGE_SIZE && <nav aria-label="施術履歴ページ" className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-[#dce8e5] bg-white p-3"><button aria-label="前の履歴ページ" disabled={effectiveHistoryPage === 1} onClick={() => setHistoryPage((current) => Math.max(1, current - 1))} className="grid size-11 place-items-center rounded-xl bg-[#edf4f2] text-[#087f71] disabled:opacity-35"><ChevronLeft size={18} /></button><span className="min-w-24 text-center text-sm font-black">{effectiveHistoryPage} / {historyPages}ページ</span><button aria-label="次の履歴ページ" disabled={effectiveHistoryPage === historyPages} onClick={() => setHistoryPage((current) => Math.min(historyPages, current + 1))} className="grid size-11 place-items-center rounded-xl bg-[#edf4f2] text-[#087f71] disabled:opacity-35"><ChevronRight size={18} /></button><span className="w-full text-center text-[10px] font-bold text-[#71858a]">1ページ {HISTORY_PAGE_SIZE}件表示・全{historyItems.length}件</span></nav>}
    </div>
    {detail && <ClinicalDetail item={detail} saving={saving} onClose={() => setDetail(null)} onAction={act} />}
    <BlockingProgressOverlay open={saving} label="施術記録を更新しています…" detail="開始・終了時刻と会計連携を更新しています。完了するまでお待ちください。" />
  </div>;
}

function ClinicalSection({ title, dateLabel, subtitle, icon, items, empty, onDetail, onAction, saving, history = false }: { title: string; dateLabel?: string; subtitle: string; icon: "today" | "history"; items: Item[]; empty: string; onDetail: (item: Item) => void; onAction: (id: string, action: "start" | "finish") => void; saving: boolean; history?: boolean }) {
  return <section className="rounded-[24px] border border-[#dce8e5] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap items-center gap-2">{icon === "today" ? <CalendarDays size={20} className="text-[#087f71]" /> : <FileText size={20} className="text-[#5769a7]" />}<h3 className="text-lg font-black">{title}</h3>{dateLabel && <span className="rounded-lg bg-[#e7f5f1] px-3 py-1 text-xs font-black text-[#087f71]">{dateLabel}</span>}</div><span className="rounded-full bg-[#edf4f2] px-3 py-1 text-xs font-black text-[#60777c]">{subtitle}</span></div><div className="mt-3 grid gap-2 lg:grid-cols-2">{items.map((item) => <article key={item.id} className="rounded-2xl border border-[#dce8e5] p-3"><div className="flex items-center gap-3"><div className={`grid size-11 shrink-0 place-items-center rounded-xl ${history ? "bg-[#eef1fb] text-[#5769a7]" : "bg-[#e7f5f1] text-[#087f71]"}`}><Stethoscope size={20} /></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-black">{item.customer_name}</p><span className="rounded-full bg-[#f0f4f3] px-2 py-0.5 text-[9px] font-black text-[#60777c]">{statusLabel[item.status] ?? item.status}</span></div><p className="truncate text-xs text-[#71858a]">{history ? `${dateText(item.start_at)}・` : `${timeText(item.start_at)}・`}{item.product_name}</p><p className="mt-0.5 truncate text-[10px] text-[#8a9b9f]">{item.therapist_name}・{item.hal_asset_code || "HAL未割当"}</p></div></div><div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-[#e7eeec] pt-3"><button onClick={() => onDetail(item)} className="flex min-h-11 items-center gap-1 rounded-xl bg-[#edf5f3] px-3 text-xs font-black text-[#087f71]">詳細<ChevronRight size={15} /></button>{!history && !item.started_at && <button disabled={item.safety_decision !== "allow" || saving} onClick={() => onAction(item.id, "start")} className="flex min-h-11 items-center gap-1 rounded-xl bg-[#087f71] px-3 text-xs font-black text-white disabled:bg-[#b5c5c2]"><Play size={14} />開始</button>}{!history && item.started_at && !item.ended_at && <button disabled={saving} onClick={() => onAction(item.id, "finish")} className="flex min-h-11 items-center gap-1 rounded-xl bg-[#c35645] px-3 text-xs font-black text-white"><CircleStop size={14} />終了</button>}{item.ended_at && <span className="flex min-h-11 items-center rounded-xl bg-[#e7f5f1] px-3 text-xs font-black text-[#087f71]">終了済み</span>}</div></article>)}{items.length === 0 && <div className="col-span-full rounded-2xl border border-dashed border-[#cfdeda] p-8 text-center text-sm text-[#829397]">{empty}</div>}</div></section>;
}

function ClinicalDetail({ item, saving, onClose, onAction }: { item: Item; saving: boolean; onClose: () => void; onAction: (id: string, action: "start" | "finish") => void }) {
  const exercises = Array.isArray(item.exercise_log) ? item.exercise_log : [];
  const soap = item.soap && typeof item.soap === "object" ? item.soap : {};
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#09262c]/55 p-3"><section role="dialog" aria-modal="true" aria-labelledby="clinical-detail-title" className="my-3 w-full max-w-3xl rounded-[26px] bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">CLINICAL DETAIL</p><h3 id="clinical-detail-title" className="text-xl font-black">{item.customer_name}さんの施術詳細</h3><p className="mt-1 text-xs text-[#71858a]">{dateText(item.start_at)} {timeText(item.start_at)}〜{timeText(item.end_at)}</p></div><button aria-label="詳細を閉じる" onClick={onClose} className="grid size-11 place-items-center rounded-xl bg-[#edf4f2]"><X /></button></div><div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4"><Detail label="状態" value={statusLabel[item.status] ?? item.status} /><Detail label="担当" value={item.therapist_name} /><Detail label="HAL機器" value={item.hal_asset_code || "未割当"} /><Detail label="リハスペース" value={item.rehab_space_name || "記録なし"} /></div><div className="mt-3 grid grid-cols-2 gap-2"><Detail label="実際の開始" value={timeText(item.started_at)} icon={<Clock3 size={15} />} /><Detail label="実際の終了" value={timeText(item.ended_at)} icon={<Clock3 size={15} />} /></div><section className="mt-4 rounded-2xl bg-[#f3f7f6] p-4"><h4 className="font-black">実施内容</h4>{exercises.length ? <div className="mt-2 space-y-2">{exercises.map((exercise, index) => <div key={index} className="rounded-xl bg-white p-3 text-sm"><b>{exercise.exercise || "HALトレーニング"}</b><p className="mt-1 text-xs text-[#71858a]">{[exercise.minutes ? `${exercise.minutes}分` : "", exercise.steps ? `${exercise.steps}歩` : "", exercise.completed ? "完了" : ""].filter(Boolean).join("・") || "実施記録あり"}</p></div>)}</div> : <p className="mt-2 text-sm text-[#71858a]">施術内容はまだ記録されていません。</p>}</section><section className="mt-3 rounded-2xl border border-[#dce8e5] p-4"><h4 className="font-black">SOAP・申し送り</h4><div className="mt-2 grid gap-2 sm:grid-cols-2">{["S", "O", "A", "P"].map((key) => <div key={key} className="rounded-xl bg-[#f7f9f8] p-3"><b className="text-xs text-[#087f71]">{key}</b><p className="mt-1 text-sm">{soap[key] || "記録なし"}</p></div>)}</div><p className="mt-3 text-sm text-[#60777c]">{item.note || "予約時メモなし"}</p></section><section className="mt-3 rounded-2xl bg-[#faf9ff] p-4"><h4 className="font-black text-[#5d49b6]">評価サマリー</h4><p className="mt-2 text-sm leading-6 text-[#60777c]">{item.assessment_summary || "評価サマリーはまだ作成されていません。"}</p>{item.assessment_notes && <p className="mt-2 text-xs text-[#71858a]">申し送り：{item.assessment_notes}</p>}</section><div className="mt-3 rounded-2xl bg-[#fff8e8] p-4"><p className="text-xs font-bold text-[#8b651d]">会計</p><p className="mt-1 font-black">{item.amount_yen == null ? "施術終了後に会計へ連携" : `${Number(item.amount_yen).toLocaleString("ja-JP")}円・${item.billing_status === "paid" ? "支払い済み" : "支払い確認待ち"}${item.payment_method ? `（${paymentLabel[item.payment_method] ?? item.payment_method}）` : ""}`}</p></div>{!item.started_at && <button disabled={item.safety_decision !== "allow" || saving} onClick={() => onAction(item.id, "start")} className="mt-4 min-h-12 w-full rounded-xl bg-[#087f71] font-black text-white disabled:bg-[#b5c5c2]">施術を開始</button>}{item.started_at && !item.ended_at && <button disabled={saving} onClick={() => onAction(item.id, "finish")} className="mt-4 min-h-12 w-full rounded-xl bg-[#c35645] font-black text-white">施術を終了</button>}<button onClick={onClose} className="mt-3 min-h-12 w-full rounded-xl border border-[#d7e4e1] font-black">閉じる</button></section></div>;
}
function Detail({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) { return <div className="rounded-xl bg-[#f3f7f6] p-3"><p className="flex items-center gap-1 text-[10px] font-bold text-[#71858a]">{icon}{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>; }
