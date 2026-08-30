"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, GripVertical, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";

type Appointment = {
  id: string; customer_id: string; therapist_id: string; hal_unit_id: string; rehab_space_id: string; product_id: string;
  start_at: string; end_at: string; status: string; note: string | null; customer_name: string;
  primary_condition: string; therapist_name: string; hal_asset_code: string; hal_model_number: string; product_name: string; rehab_space_name: string | null; rehab_space_type: string | null;
};
type Resource = { id: string; name?: string; asset_code?: string; model_type?: string; model_number?: string; qualification?: string; status?: string; space_code?: string; space_type?: string; capacity_hal_units?: number };
type ScheduleData = {
  date: string; appointments: Appointment[]; therapists: Resource[]; halUnits: Resource[]; rehabSpaces: Resource[];
  customers: Array<{ id: string; customer_code: string; name: string; primary_condition: string }>;
  products: Array<{ id: string; name: string; duration_minutes: number; required_model_type: string }>;
};
type CalendarView = "therapist" | "hal" | "rehab";

const ROW_HEIGHT = 54;
const START_MINUTES = 10 * 60;
const SLOT_COUNT = 16;
const slots = Array.from({ length: SLOT_COUNT }, (_, index) => START_MINUTES + index * 30);
const dateInputValue = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
};
const timeFromMinutes = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const timeText = (value: string) => new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
const minuteOfDay = (value: string) => {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(map.hour) * 60 + Number(map.minute);
};

export function ScheduleCalendar() {
  const [date, setDate] = useState(() => dateInputValue(new Date()));
  const [view, setView] = useState<CalendarView>("therapist");
  const [data, setData] = useState<ScheduleData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pointerDrag, setPointerDrag] = useState<{ id: string; startX: number; startY: number } | null>(null);
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [detailForm, setDetailForm] = useState({ customerId: "", therapistId: "", halUnitId: "", rehabSpaceId: "", productId: "", date: "", time: "", note: "" });
  const [createSlot, setCreateSlot] = useState<{ resourceId: string; minutes: number } | null>(null);
  const [createForm, setCreateForm] = useState({ customerId: "", therapistId: "", halUnitId: "", rehabSpaceId: "", productId: "", note: "" });
  const [saving, setSaving] = useState(false);

  async function refresh() {
    const response = await fetch(`/api/schedule?date=${date}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "スケジュールを取得できませんでした。");
    setData(body);
  }

  useEffect(() => {
    let active = true;
    fetch(`/api/schedule?date=${date}`, { cache: "no-store" })
      .then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); if (active) { setData(body); setError(""); } })
      .catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [date]);

  useEffect(() => {
    const reloadForStaffChange = () => {
      fetch(`/api/schedule?date=${date}`, { cache: "no-store" }).then(async (response) => {
        const body = await response.json(); if (!response.ok) throw new Error(body.error); setData(body); setNotice("スタッフ変更を予約スケジュールへ反映しました");
        window.setTimeout(() => setNotice(""), 2600);
      }).catch((reason: Error) => setError(reason.message));
    };
    const onStorage = (event: StorageEvent) => { if (event.key === "roboreha:data-updated") reloadForStaffChange(); };
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("roboreha-updates") : null;
    if (channel) channel.onmessage = (event) => { if (event.data?.area === "staff") reloadForStaffChange(); };
    window.addEventListener("storage", onStorage);
    return () => { window.removeEventListener("storage", onStorage); channel?.close(); };
  }, [date]);

  const resources = useMemo(() => view === "therapist" ? data?.therapists ?? [] : view === "hal" ? data?.halUnits ?? [] : data?.rehabSpaces ?? [], [data, view]);
  function resourceName(resource: Resource) { return view === "therapist" ? resource.name ?? "担当者" : view === "hal" ? resource.asset_code ?? "HAL" : resource.name ?? "リハスペース"; }
  function appointmentResourceId(appointment: Appointment) { return view === "therapist" ? appointment.therapist_id : view === "hal" ? appointment.hal_unit_id : appointment.rehab_space_id; }
  function appointmentSubline(appointment: Appointment) { return view === "therapist" ? `${appointment.hal_asset_code}・${appointment.rehab_space_name ?? "スペース未割当"}` : view === "hal" ? `${appointment.therapist_name}・${appointment.rehab_space_name ?? "スペース未割当"}` : `${appointment.therapist_name}・${appointment.hal_asset_code}`; }
  function flash(message: string) { setNotice(message); window.setTimeout(() => setNotice(""), 2600); }
  function shiftDate(days: number) { const next = new Date(`${date}T12:00:00+09:00`); next.setDate(next.getDate() + days); setDate(dateInputValue(next)); }
  function openDetail(appointment: Appointment) {
    setDetail(appointment);
    setDetailForm({ customerId: appointment.customer_id, therapistId: appointment.therapist_id, halUnitId: appointment.hal_unit_id, rehabSpaceId: appointment.rehab_space_id ?? "", productId: appointment.product_id, date: dateInputValue(new Date(appointment.start_at)), time: timeText(appointment.start_at), note: appointment.note ?? "" });
    setError("");
  }

  function openCreate(resourceId: string, minutes: number) {
    if (!data) return;
    if (view === "hal" && data.halUnits.find((item) => item.id === resourceId)?.status !== "available") return;
    const clickedSpace = view === "rehab" ? data.rehabSpaces.find((item) => item.id === resourceId) : null;
    const product = clickedSpace ? data.products.find((item) => clickedSpace.space_type === "treadmill" ? item.required_model_type === "lower_limb" : item.required_model_type !== "lower_limb") ?? data.products[0] : data.products[0];
    const requiredSpaceType = product?.required_model_type === "lower_limb" ? "treadmill" : "bench";
    setCreateSlot({ resourceId, minutes });
    setCreateForm({
      customerId: data.customers[0]?.id ?? "",
      therapistId: view === "therapist" ? resourceId : data.therapists[0]?.id ?? "",
      halUnitId: view === "hal" ? resourceId : data.halUnits.find((item) => item.status === "available" && item.model_type === product?.required_model_type)?.id ?? data.halUnits[0]?.id ?? "",
      rehabSpaceId: view === "rehab" ? resourceId : data.rehabSpaces.find((item) => item.space_type === requiredSpaceType)?.id ?? "",
      productId: product?.id ?? "",
      note: "",
    });
    setError("");
  }

  function changeCreateProduct(productId: string) {
    if (!data) return;
    const product = data.products.find((item) => item.id === productId);
    const requiredSpaceType = product?.required_model_type === "lower_limb" ? "treadmill" : "bench";
    setCreateForm((current) => ({ ...current, productId, halUnitId: data.halUnits.find((item) => item.status === "available" && item.model_type === product?.required_model_type)?.id ?? "", rehabSpaceId: data.rehabSpaces.find((item) => item.space_type === requiredSpaceType)?.id ?? "" }));
  }

  async function createAppointment(event: React.FormEvent) {
    event.preventDefault(); if (!createSlot) return; setSaving(true); setError("");
    try {
      const startAt = new Date(`${date}T${timeFromMinutes(createSlot.minutes)}:00+09:00`).toISOString();
      const response = await fetch("/api/schedule", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...createForm, startAt }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "予約を登録できませんでした。");
      setCreateSlot(null); flash("予約を登録しました"); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "予約を登録できませんでした。"); }
    finally { setSaving(false); }
  }

  async function moveAppointment(appointment: Appointment, resourceId: string, minutes: number) {
    if (!data || !["reserved", "confirmed"].includes(appointment.status)) return;
    setError("");
    try {
      const startAt = new Date(`${date}T${timeFromMinutes(minutes)}:00+09:00`).toISOString();
      const response = await fetch("/api/schedule", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: appointment.id, startAt, therapistId: view === "therapist" ? resourceId : appointment.therapist_id, halUnitId: view === "hal" ? resourceId : appointment.hal_unit_id, rehabSpaceId: view === "rehab" ? resourceId : appointment.rehab_space_id }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "予約を移動できませんでした。");
      flash("予約を移動しました"); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "予約を移動できませんでした。"); }
    finally { setPointerDrag(null); }
  }

  async function cancelAppointment() {
    if (!detail || !window.confirm(`${detail.customer_name}さんの予約を削除しますか？\n履歴はキャンセルとして保存されます。`)) return;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/schedule?id=${detail.id}`, { method: "DELETE" });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "予約を削除できませんでした。");
      setDetail(null); flash("予約を削除しました（履歴は保持）"); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "予約を削除できませんでした。"); }
    finally { setSaving(false); }
  }

  async function saveDetail(event: React.FormEvent) {
    event.preventDefault(); if (!detail) return; setSaving(true); setError("");
    try {
      const startAt = new Date(`${detailForm.date}T${detailForm.time}:00+09:00`).toISOString();
      const response = await fetch("/api/schedule", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: detail.id, ...detailForm, startAt }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "予約を保存できませんでした。");
      setDetail(null); flash("予約詳細を保存しました"); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "予約を保存できませんでした。"); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-2 flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-black tracking-[0.15em] text-[#087f71]">SCHEDULER</p><h2 className="text-2xl font-black tracking-[-0.04em]">予約スケジュール</h2><p className="mt-1 text-xs text-[#71858a]">クリックで登録、ドラッグで移動、ダブルクリックで詳細表示</p></div><div className="flex items-center rounded-xl border border-[#d7e4e1] bg-white p-1"><button onClick={() => setView("therapist")} className={`rounded-lg px-4 py-2 text-xs font-black ${view === "therapist" ? "bg-[#173b42] text-white" : "text-[#71858a]"}`}>療法士</button><button onClick={() => setView("hal")} className={`rounded-lg px-4 py-2 text-xs font-black ${view === "hal" ? "bg-[#173b42] text-white" : "text-[#71858a]"}`}>HAL機器</button><button onClick={() => setView("rehab")} className={`rounded-lg px-4 py-2 text-xs font-black ${view === "rehab" ? "bg-[#173b42] text-white" : "text-[#71858a]"}`}>リハスペース</button></div></div>
    <section className="overflow-hidden rounded-[22px] border border-[#d7e4e1] bg-white shadow-[0_12px_35px_rgba(27,61,58,.06)]">
      <header className="flex items-center justify-center gap-2 border-b border-[#dce8e5] px-4 py-3"><button aria-label="前日" onClick={() => shiftDate(-1)} className="grid size-10 place-items-center rounded-lg bg-[#edf4f2] text-[#087f71] hover:bg-[#dff0ec]"><ChevronLeft size={21} /></button><label className="flex items-center gap-2 text-sm font-black"><CalendarDays size={18} className="text-[#087f71]" /><input aria-label="表示日" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="rounded-lg border border-[#d7e4e1] px-3 py-2" /></label><button aria-label="翌日" onClick={() => shiftDate(1)} className="grid size-10 place-items-center rounded-lg bg-[#edf4f2] text-[#087f71] hover:bg-[#dff0ec]"><ChevronRight size={21} /></button><button aria-label="更新" onClick={() => refresh().catch((reason: Error) => setError(reason.message))} className="ml-auto grid size-9 place-items-center rounded-lg bg-[#edf4f2] text-[#087f71]"><RefreshCw size={17} /></button></header>
      {error && <div role="alert" className="border-b border-[#f0d2cc] bg-[#fff0ed] px-4 py-3 text-sm font-bold text-[#b94637]">{error}</div>}
      {!data ? <div className="p-12 text-center text-sm text-[#71858a]">読み込み中です…</div> : <div className="max-h-[calc(100vh-190px)] overflow-auto">
        <div style={{ minWidth: `${74 + resources.length * 190}px` }}>
          <div className="sticky top-0 z-20 grid border-b border-[#dce8e5] bg-[#f8fbfa]" style={{ gridTemplateColumns: `74px repeat(${resources.length}, minmax(190px, 1fr))` }}><div className="sticky left-0 z-30 border-r border-[#dce8e5] bg-[#f8fbfa] p-3 text-center text-[10px] font-bold text-[#829397]">JST</div>{resources.map((resource) => <div key={resource.id} className="border-r border-[#dce8e5] px-3 py-3 text-center"><p className="text-sm font-black">{resourceName(resource)}</p><p className="mt-0.5 text-[10px] text-[#819397]">{view === "therapist" ? resource.qualification ?? "担当スタッフ" : view === "hal" ? `${resource.model_number}・${resource.status === "available" ? "利用可能" : "点検中"}` : `${resource.space_type === "treadmill" ? "トレッドミル" : "ベンチ"}・HAL ${resource.capacity_hal_units}台まで`}</p></div>)}</div>
          <div className="grid" style={{ gridTemplateColumns: `74px repeat(${resources.length}, minmax(190px, 1fr))` }}>
            <div className="sticky left-0 z-10 border-r border-[#dce8e5] bg-white">{slots.map((minutes) => <div key={minutes} className="border-b border-[#e4ecea] pr-2 pt-1 text-right text-[11px] font-bold text-[#71858a]" style={{ height: ROW_HEIGHT }}>{timeFromMinutes(minutes)}</div>)}<div className="pr-2 text-right text-[11px] font-bold text-[#71858a]">18:00</div></div>
            {resources.map((resource) => { const unavailable = view === "hal" && resource.status !== "available"; return <div key={resource.id} className={`relative border-r border-[#dce8e5] ${unavailable ? "bg-[#f3f5f5]" : ""}`} style={{ height: ROW_HEIGHT * SLOT_COUNT }} onPointerUp={(event) => { if (!pointerDrag || unavailable) return; const distance = Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY); if (distance < 8) { setPointerDrag(null); return; } const appointment = data.appointments.find((item) => item.id === pointerDrag.id); if (!appointment) return; const rect = event.currentTarget.getBoundingClientRect(); const index = Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor((event.clientY - rect.top) / ROW_HEIGHT))); void moveAppointment(appointment, resource.id, slots[index]); }}>
              {slots.map((minutes, index) => <button disabled={unavailable} key={minutes} aria-label={unavailable ? `${resourceName(resource)} 点検中のため予約不可` : `${resourceName(resource)} ${timeFromMinutes(minutes)} 空き枠`} onClick={() => openCreate(resource.id, minutes)} className="absolute inset-x-0 border-b border-[#e4ecea] text-transparent hover:bg-[#eaf7f3]/70 hover:text-[#087f71] disabled:cursor-not-allowed disabled:hover:bg-transparent" style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}><Plus size={14} className="mx-auto" /></button>)}
              {data.appointments.filter((appointment) => appointmentResourceId(appointment) === resource.id).map((appointment) => { const start = Math.max(START_MINUTES, minuteOfDay(appointment.start_at)); const end = Math.min(18 * 60, minuteOfDay(appointment.end_at)); const top = ((start - START_MINUTES) / 30) * ROW_HEIGHT; const height = Math.max(38, ((end - start) / 30) * ROW_HEIGHT - 4); const movable = ["reserved", "confirmed"].includes(appointment.status); return <div key={appointment.id} onPointerDown={(event) => { if (movable && event.button === 0) setPointerDrag({ id: appointment.id, startX: event.clientX, startY: event.clientY }); }} onPointerCancel={() => setPointerDrag(null)} onDoubleClick={() => openDetail(appointment)} title="ダブルクリックで詳細・変更" className={`absolute left-1 right-1 z-10 select-none overflow-hidden rounded-lg border-l-4 p-2 text-left shadow-sm ${movable ? "cursor-grab touch-none border-[#087f71] bg-[#dff4ed] hover:ring-2 hover:ring-[#087f71]/30 active:cursor-grabbing" : "cursor-default border-[#6377a9] bg-[#e9edf8]"}`} style={{ top, height }}><div className="flex items-start gap-1"><GripVertical size={13} className="mt-0.5 shrink-0 text-[#66847f]" /><div className="min-w-0"><p className="truncate text-xs font-black">{timeText(appointment.start_at)} {appointment.customer_name}</p><p className="mt-0.5 truncate text-[10px] text-[#58716f]">{appointmentSubline(appointment)}</p>{height > 66 && <p className="mt-1 truncate text-[10px] text-[#71858a]">{appointment.product_name}</p>}</div></div></div>; })}
            </div>; })}
          </div>
        </div>
      </div>}
    </section>
    <p className="mt-3 text-[11px] text-[#7e9195]">10:00〜18:00・30分単位　｜　ドラッグ移動できるのは来所前の予約です。</p>

    {createSlot && data && <div className="fixed inset-0 z-50 grid place-items-center bg-[#09262c]/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && setCreateSlot(null)}><form onSubmit={createAppointment} className="w-full max-w-2xl rounded-[26px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black tracking-wider text-[#087f71]">NEW APPOINTMENT</p><h3 className="mt-1 text-2xl font-black">予約を登録</h3><p className="mt-1 text-xs text-[#71858a]">{new Date(`${date}T12:00:00+09:00`).toLocaleDateString("ja-JP")}　{timeFromMinutes(createSlot.minutes)}</p></div><button type="button" aria-label="閉じる" onClick={() => setCreateSlot(null)} className="grid size-10 place-items-center rounded-full bg-[#edf4f2]"><X size={20} /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><SelectField label="利用者" value={createForm.customerId} onChange={(value) => setCreateForm({ ...createForm, customerId: value })} options={data.customers.map((item) => ({ value: item.id, label: `${item.name}（${item.primary_condition}）` }))} /><SelectField label="コース" value={createForm.productId} onChange={changeCreateProduct} options={data.products.map((item) => ({ value: item.id, label: `${item.name}・${item.duration_minutes}分` }))} /><SelectField label="療法士" value={createForm.therapistId} onChange={(value) => setCreateForm({ ...createForm, therapistId: value })} options={data.therapists.map((item) => ({ value: item.id, label: item.name ?? "担当者" }))} /><SelectField label="HAL機器" value={createForm.halUnitId} onChange={(value) => setCreateForm({ ...createForm, halUnitId: value })} options={data.halUnits.filter((item) => item.status === "available").map((item) => ({ value: item.id, label: `${item.asset_code}・${item.model_number}` }))} /><SelectField label="リハスペース" value={createForm.rehabSpaceId} onChange={(value) => setCreateForm({ ...createForm, rehabSpaceId: value })} options={data.rehabSpaces.map((item) => ({ value: item.id, label: `${item.name}（${item.space_type === "treadmill" ? "トレッドミル" : `ベンチ・HAL ${item.capacity_hal_units}台まで`}）` }))} /></div><label className="mt-4 block text-xs font-bold text-[#687d84]">メモ<textarea value={createForm.note} onChange={(event) => setCreateForm({ ...createForm, note: event.target.value })} className="mt-2 h-20 w-full resize-none rounded-xl border border-[#d7e4e1] p-3 text-sm" /></label>{error && <p className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">{error}</p>}<button disabled={saving} className="mt-5 w-full rounded-2xl bg-[#087f71] py-4 font-black text-white disabled:bg-[#aac6c1]">{saving ? "登録しています…" : "予約を登録する"}</button></form></div>}
    {detail && data && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#09262c]/55 p-4 backdrop-blur-[2px]" onMouseDown={(event) => event.target === event.currentTarget && setDetail(null)}><section role="dialog" aria-modal="true" aria-labelledby="appointment-detail-title" className="my-4 w-full max-w-2xl rounded-[26px] bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-black tracking-wider text-[#087f71]">APPOINTMENT DETAIL</p><h3 id="appointment-detail-title" className="mt-1 text-2xl font-black">予約詳細・変更</h3><p className="mt-1 text-xs text-[#71858a]">変更内容は保存後に監査ログへ記録されます。</p></div><button aria-label="閉じる" onClick={() => setDetail(null)} className="grid size-10 place-items-center rounded-full bg-[#edf4f2]"><X size={20} /></button></div>{["reserved", "confirmed"].includes(detail.status) ? <form onSubmit={saveDetail}><div className="mt-6 grid gap-4 sm:grid-cols-2"><SelectField label="利用者" value={detailForm.customerId} onChange={(value) => setDetailForm({ ...detailForm, customerId: value })} options={data.customers.map((item) => ({ value: item.id, label: item.name }))} /><SelectField label="コース" value={detailForm.productId} onChange={(value) => setDetailForm({ ...detailForm, productId: value })} options={data.products.map((item) => ({ value: item.id, label: `${item.name}・${item.duration_minutes}分` }))} /><SelectField label="療法士" value={detailForm.therapistId} onChange={(value) => setDetailForm({ ...detailForm, therapistId: value })} options={data.therapists.map((item) => ({ value: item.id, label: item.name ?? "担当者" }))} /><SelectField label="HAL機器" value={detailForm.halUnitId} onChange={(value) => setDetailForm({ ...detailForm, halUnitId: value })} options={data.halUnits.filter((item) => item.status === "available" || item.id === detail.hal_unit_id).map((item) => ({ value: item.id, label: `${item.asset_code}・${item.model_number}` }))} /><SelectField label="リハスペース" value={detailForm.rehabSpaceId} onChange={(value) => setDetailForm({ ...detailForm, rehabSpaceId: value })} options={data.rehabSpaces.map((item) => ({ value: item.id, label: `${item.name}（${item.space_type === "treadmill" ? "トレッドミル" : `ベンチ・HAL ${item.capacity_hal_units}台まで`}）` }))} /><label className="text-xs font-bold text-[#687d84]">日付<input required type="date" value={detailForm.date} onChange={(event) => setDetailForm({ ...detailForm, date: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d7e4e1] px-3 py-3 text-sm font-bold" /></label><label className="text-xs font-bold text-[#687d84]">開始時刻<select required value={detailForm.time} onChange={(event) => setDetailForm({ ...detailForm, time: event.target.value })} className="mt-2 w-full rounded-xl border border-[#d7e4e1] bg-white px-3 py-3 text-sm font-bold">{slots.map((minutes) => <option key={minutes} value={timeFromMinutes(minutes)}>{timeFromMinutes(minutes)}</option>)}</select></label></div><label className="mt-4 block text-xs font-bold text-[#687d84]">メモ<textarea value={detailForm.note} onChange={(event) => setDetailForm({ ...detailForm, note: event.target.value })} className="mt-2 h-20 w-full resize-none rounded-xl border border-[#d7e4e1] p-3 text-sm" /></label>{error && <p className="mt-4 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">{error}</p>}<div className="mt-5 grid grid-cols-[1fr_auto] gap-3"><button disabled={saving} className="flex items-center justify-center gap-2 rounded-2xl bg-[#087f71] py-3.5 font-black text-white disabled:bg-[#aac6c1]"><Save size={18} />{saving ? "保存中…" : "変更を保存"}</button><button type="button" disabled={saving} onClick={cancelAppointment} className="flex items-center justify-center gap-2 rounded-2xl border border-[#e4afa6] px-5 py-3.5 font-black text-[#bd4f3f]"><Trash2 size={18} />削除</button></div></form> : <div className="mt-6 grid grid-cols-2 gap-3 text-sm"><Detail label="日時" value={`${new Date(detail.start_at).toLocaleDateString("ja-JP")} ${timeText(detail.start_at)}〜${timeText(detail.end_at)}`} /><Detail label="状態" value={detail.status === "checked_in" ? "受付済み" : detail.status} /><Detail label="療法士" value={detail.therapist_name} /><Detail label="HAL機器" value={`${detail.hal_asset_code} / ${detail.hal_model_number}`} /><Detail label="リハスペース" value={detail.rehab_space_name || "未割当"} /><div className="col-span-2"><Detail label="コース" value={detail.product_name} /></div><div className="col-span-2"><Detail label="メモ" value={detail.note || "なし"} /></div></div>}</section></div>}
    {notice && <div role="status" className="fixed right-5 top-20 z-50 rounded-full bg-[#173b42] px-5 py-3 text-sm font-black text-white shadow-xl">{notice}</div>}
  </div>;
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) { return <label className="text-xs font-bold text-[#687d84]">{label}<select required value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d7e4e1] bg-white px-3 py-3 text-sm font-bold">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-[#f3f7f6] p-3"><p className="text-[10px] font-bold text-[#829397]">{label}</p><p className="mt-1 font-black text-[#18313a]">{value}</p></div>; }
