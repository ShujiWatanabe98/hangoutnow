"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Pencil, Plus, Trash2, UserCog, X } from "lucide-react";

type Staff = { id: string; employee_code: string; name: string; role: string; qualification: string; active: boolean; future_appointment_count: number; next_appointment_at: string | null };
type Shift = { id: string; staff_id: string; work_date: string; shift_start: string; shift_end: string; status: "scheduled" | "confirmed" | "cancelled" };
type Attendance = { id: string; staff_id: string; work_date: string; clock_in: string | null; clock_out: string | null; status: "draft" | "submitted" | "approved" | "rejected"; break_minutes: number };
type View = "day" | "week" | "month";
type Data = { staff: Staff[]; shifts: Shift[]; attendance: Attendance[]; range: { start: string; end: string; anchor: string; view: View; today: string } };
type DeleteImpact = { error: string; code: string; futureAppointmentCount: number; firstAppointmentAt: string | null; lastAppointmentAt: string | null; customerNames: string[]; affectedScreens: string[] };

const roles: Record<string, string> = { manager: "リーダー", therapist: "療法士", trainer: "HALトレーナー", reception: "受付" };
const attendanceStatus: Record<string, string> = { draft: "勤務中", submitted: "承認待ち", approved: "承認済み", rejected: "差戻し" };
const viewLabels: Record<View, string> = { day: "日", week: "週", month: "月" };
const weekdays = ["月", "火", "水", "木", "金", "土", "日"];
const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

function dateOnly(value: string) { return value.slice(0, 10); }
function dateAtNoon(value: string) { return new Date(`${dateOnly(value)}T12:00:00`); }
function isoDate(value: Date) { const year = value.getFullYear(); const month = String(value.getMonth() + 1).padStart(2, "0"); const day = String(value.getDate()).padStart(2, "0"); return `${year}-${month}-${day}`; }
function addDays(value: string, days: number) { const next = dateAtNoon(value); next.setDate(next.getDate() + days); return isoDate(next); }
function displayDate(value: string, options: Intl.DateTimeFormatOptions = { month: "numeric", day: "numeric", weekday: "short" }) { return new Intl.DateTimeFormat("ja-JP", options).format(dateAtNoon(value)); }
function displayTime(value?: string | null) { return value ? new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : "—"; }
function minutesBetween(start?: string | null, end?: string | null) { return start && end ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)) : 0; }
function durationText(minutes: number) { return `${Math.floor(minutes / 60)}時間${minutes % 60 ? `${minutes % 60}分` : ""}`; }
function datesBetween(start: string, end: string) { const dates: string[] = []; for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date); return dates; }
function publishStaffUpdate() {
  const value = JSON.stringify({ area: "staff", at: Date.now() });
  window.localStorage.setItem("roboreha:data-updated", value);
  if (typeof BroadcastChannel !== "undefined") { const channel = new BroadcastChannel("roboreha-updates"); channel.postMessage({ area: "staff" }); channel.close(); }
}

export function StaffManager({ onDataChanged }: { onDataChanged?: () => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [mode, setMode] = useState<"staff" | "attendance">("staff");
  const [view, setView] = useState<View>("week");
  const [anchor, setAnchor] = useState(today);
  const [editing, setEditing] = useState<Staff | null | "new">(null);
  const [selected, setSelected] = useState<{ staff: Staff; date: string } | null>(null);
  const [form, setForm] = useState({ employeeCode: "", name: "", role: "therapist", qualification: "" });
  const [shiftForm, setShiftForm] = useState({ plannedStart: "09:00", plannedEnd: "18:00", status: "confirmed" as Shift["status"] });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [deleteImpact, setDeleteImpact] = useState<DeleteImpact | null>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/staff?view=${view}&date=${anchor}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "スタッフ情報を読み込めませんでした。");
      setData(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "スタッフ情報を読み込めませんでした。"); }
  }, [anchor, view]);

  useEffect(() => {
    let active = true;
    fetch(`/api/staff?view=${view}&date=${anchor}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "スタッフ情報を読み込めませんでした。");
      if (active) setData(body);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "スタッフ情報を読み込めませんでした。"); });
    return () => { active = false; };
  }, [anchor, view]);

  function openStaff(staff?: Staff) {
    setEditing(staff ?? "new");
    setForm(staff ? { employeeCode: staff.employee_code, name: staff.name, role: staff.role, qualification: staff.qualification ?? "" } : { employeeCode: "", name: "", role: "therapist", qualification: "" });
  }
  function findShift(staffId: string, date: string) { return data?.shifts.find((item) => item.staff_id === staffId && dateOnly(item.work_date) === date); }
  function findAttendance(staffId: string, date: string) { return data?.attendance.find((item) => item.staff_id === staffId && dateOnly(item.work_date) === date); }
  function openAttendance(staff: Staff, date: string) {
    const shift = findShift(staff.id, date);
    setShiftForm({ plannedStart: shift ? displayTime(shift.shift_start) : staff.role === "manager" ? "08:30" : "09:00", plannedEnd: shift ? displayTime(shift.shift_end) : staff.role === "manager" ? "17:30" : "18:00", status: shift?.status ?? "confirmed" });
    setSelected({ staff, date }); setError("");
  }
  async function saveStaff(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    const isNew = editing === "new";
    const response = await fetch("/api/staff", { method: isNew ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, ...(!isNew && editing ? { id: editing.id } : {}), active: true }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) { if (body.code === "STAFF_HAS_FUTURE_APPOINTMENTS") setDeleteImpact(body); else setError(body.error); return; }
    setEditing(null); publishStaffUpdate(); onDataChanged?.(); setNotice("スタッフ情報を保存し、予約関連画面を更新しました。"); await load();
  }
  async function saveShift(event: React.FormEvent) {
    event.preventDefault(); if (!selected) return; setSaving(true); setError("");
    const response = await fetch("/api/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: selected.staff.id, action: "saveShift", workDate: selected.date, ...shiftForm }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) { if (body.code === "STAFF_HAS_FUTURE_APPOINTMENTS") setDeleteImpact(body); else setError(body.error); return; }
    setSelected(null); publishStaffUpdate(); onDataChanged?.(); setNotice("勤務予定を保存し、予約可能枠を更新しました。"); await load();
  }
  async function attendanceAction(action: "clockIn" | "clockOut" | "approve") {
    if (!selected) return; setSaving(true); setError("");
    const response = await fetch("/api/staff", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ staffId: selected.staff.id, action, workDate: selected.date }) });
    const body = await response.json(); setSaving(false);
    if (!response.ok) { setError(body.error); return; }
    await load();
  }
  async function remove(staff: Staff) {
    setError(""); setDeleteImpact(null);
    if (!Number(staff.future_appointment_count) && !window.confirm(`${staff.name}さんをスタッフ一覧から削除しますか？\n履歴保持のため無効化します。`)) return;
    const response = await fetch(`/api/staff?id=${staff.id}`, { method: "DELETE" });
    const body = await response.json();
    if (!response.ok) { if (body.code === "STAFF_HAS_FUTURE_APPOINTMENTS") setDeleteImpact(body); else setError(body.error); return; }
    publishStaffUpdate(); onDataChanged?.(); setNotice("スタッフを無効化し、予約関連画面を更新しました。"); await load();
  }
  function move(direction: number) {
    if (view === "month") { const next = dateAtNoon(anchor); next.setMonth(next.getMonth() + direction); setAnchor(isoDate(next)); }
    else setAnchor(addDays(anchor, direction * (view === "week" ? 7 : 1)));
  }

  const activeStaff = data?.staff.filter((staff) => staff.active) ?? [];
  const periodDates = data ? datesBetween(data.range.start, data.range.end) : [];
  const summary = useMemo(() => {
    if (!data) return { planned: 0, actual: 0, days: 0, byStaff: [] as Array<{ id: string; name: string; minutes: number; days: number }> };
    const planned = data.shifts.filter((shift) => shift.status !== "cancelled").reduce((sum, shift) => { const raw = minutesBetween(shift.shift_start, shift.shift_end); return sum + Math.max(0, raw - (raw >= 360 ? 60 : 0)); }, 0);
    const completed = data.attendance.filter((item) => item.clock_in && item.clock_out);
    const actual = completed.reduce((sum, item) => sum + Math.max(0, minutesBetween(item.clock_in, item.clock_out) - item.break_minutes), 0);
    const byStaff = data.staff.filter((staff) => staff.active).map((staff) => { const rows = completed.filter((item) => item.staff_id === staff.id); return { id: staff.id, name: staff.name, minutes: rows.reduce((sum, item) => sum + Math.max(0, minutesBetween(item.clock_in, item.clock_out) - item.break_minutes), 0), days: rows.length }; });
    return { planned, actual, days: completed.length, byStaff };
  }, [data]);

  if (!data) return <p className="p-8 text-center">スタッフ情報を読み込み中です…</p>;

  return <div className="mx-auto max-w-[1500px]">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">STAFF & ATTENDANCE</p><h2 className="text-2xl font-black">スタッフ管理</h2></div><div className="flex gap-2"><div className="rounded-xl bg-white p-1">{[["staff", "スタッフ"], ["attendance", "出退勤"]].map((item) => <button key={item[0]} onClick={() => setMode(item[0] as typeof mode)} className={`min-h-10 rounded-lg px-4 text-xs font-black ${mode === item[0] ? "bg-[#173b42] text-white" : "text-[#71858a]"}`}>{item[1]}</button>)}</div>{mode === "staff" && <button onClick={() => openStaff()} className="flex min-h-11 items-center gap-2 rounded-xl bg-[#087f71] px-4 text-xs font-black text-white"><Plus size={16} />登録</button>}</div></div>
    {error && <p role="alert" className="mb-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">{error}</p>}

    {mode === "staff" ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{activeStaff.map((staff) => <article key={staff.id} className="rounded-2xl border border-[#dce8e5] bg-white p-4"><div className="flex items-start justify-between"><div className="grid size-10 place-items-center rounded-xl bg-[#e7f5f1] text-[#087f71]"><UserCog size={19} /></div><span className={`rounded-full px-2 py-1 text-[10px] font-black ${staff.role === "manager" ? "bg-[#173b42] text-white" : "bg-[#eef3f2] text-[#60777c]"}`}>{roles[staff.role]}</span></div><h3 className="mt-3 font-black">{staff.name}</h3><p className="text-xs text-[#71858a]">{staff.employee_code}・{staff.qualification || "資格登録なし"}</p>{Number(staff.future_appointment_count)>0 && <p className="mt-2 rounded-lg bg-[#fff8e8] px-2.5 py-2 text-[10px] font-black text-[#8b651d]">将来予約 {staff.future_appointment_count}件{staff.next_appointment_at ? `・次回 ${displayDate(staff.next_appointment_at)}` : ""}</p>}<div className="mt-3 flex gap-2 border-t pt-3"><button onClick={() => openStaff(staff)} className="flex min-h-10 flex-1 items-center justify-center gap-1 rounded-lg bg-[#edf5f3] text-xs font-black text-[#087f71]"><Pencil size={14} />編集</button><button aria-label={`${staff.name}を削除`} disabled={staff.role === "manager"} onClick={() => remove(staff)} className="grid w-11 place-items-center rounded-lg bg-[#fff0ed] text-[#bd4f3f] disabled:opacity-30"><Trash2 size={15} /></button></div></article>)}</div> : <div>
      <div className="rounded-2xl border border-[#dce8e5] bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1"><button aria-label="前の期間" onClick={() => move(-1)} className="grid size-11 place-items-center rounded-xl border border-[#d7e4e1]"><ChevronLeft /></button><input aria-label="表示基準日" type="date" value={anchor} onChange={(event) => setAnchor(event.target.value)} className="min-h-11 rounded-xl border border-[#d7e4e1] px-3 text-sm font-black" /><button aria-label="次の期間" onClick={() => move(1)} className="grid size-11 place-items-center rounded-xl border border-[#d7e4e1]"><ChevronRight /></button></div><div className="flex rounded-xl bg-[#edf4f2] p-1">{(["day", "week", "month"] as View[]).map((item) => <button key={item} onClick={() => setView(item)} className={`min-h-10 min-w-14 rounded-lg px-3 text-sm font-black ${view === item ? "bg-[#173b42] text-white" : "text-[#60777c]"}`}>{viewLabels[item]}</button>)}</div></div><p className="mt-2 text-center text-sm font-black">{view === "day" ? displayDate(data.range.start, { year: "numeric", month: "long", day: "numeric", weekday: "long" }) : `${displayDate(data.range.start, { month: "long", day: "numeric" })} 〜 ${displayDate(data.range.end, { month: "long", day: "numeric" })}`}</p></div>

      <div className="mt-3 grid grid-cols-3 gap-2"><SummaryCard label="予定勤務" value={durationText(summary.planned)} note={`${data.shifts.filter((shift) => shift.status !== "cancelled").length}人日`} /><SummaryCard label="勤務実績" value={durationText(summary.actual)} note={`${summary.days}人日`} /><SummaryCard label="承認待ち" value={`${data.attendance.filter((item) => item.status === "submitted").length}件`} note="タップして承認" /></div>

      {view === "day" && <div className="mt-3 grid gap-2 md:grid-cols-2">{activeStaff.map((staff) => <AttendanceCard key={staff.id} staff={staff} date={data.range.start} shift={findShift(staff.id, data.range.start)} attendance={findAttendance(staff.id, data.range.start)} onOpen={() => openAttendance(staff, data.range.start)} />)}</div>}

      {view === "week" && <div className="mt-3 overflow-x-auto rounded-2xl border border-[#dce8e5] bg-white"><div className="min-w-[920px]"><div className="grid grid-cols-[140px_repeat(7,1fr)] bg-[#f3f7f6]"><div className="p-3 text-xs font-black">スタッフ</div>{periodDates.map((date) => <div key={date} className={`border-l p-2 text-center text-xs font-black ${date === data.range.today ? "bg-[#dff4ed] text-[#087f71]" : ""}`}>{displayDate(date)}</div>)}</div>{activeStaff.map((staff) => <div key={staff.id} className="grid grid-cols-[140px_repeat(7,1fr)] border-t"><div className="p-3"><p className="text-sm font-black">{staff.name}</p><p className="text-[10px] text-[#71858a]">{roles[staff.role]}</p></div>{periodDates.map((date) => <AttendanceCell key={date} shift={findShift(staff.id, date)} attendance={findAttendance(staff.id, date)} onClick={() => openAttendance(staff, date)} />)}</div>)}</div></div>}

      {view === "month" && <div className="mt-3 overflow-x-auto rounded-2xl border border-[#dce8e5] bg-white"><div className="min-w-[820px]"><div className="grid grid-cols-7 bg-[#f3f7f6]">{weekdays.map((day) => <div key={day} className="p-2 text-center text-xs font-black">{day}</div>)}</div><div className="grid grid-cols-7">{Array.from({ length: (dateAtNoon(data.range.start).getDay() + 6) % 7 }).map((_, index) => <div key={`empty-${index}`} className="min-h-32 border-r border-t bg-[#fafcfc]" />)}{periodDates.map((date) => <div key={date} className={`min-h-32 border-r border-t p-1.5 ${date === data.range.today ? "bg-[#effaf7]" : ""}`}><p className={`mb-1 text-xs font-black ${date === data.range.today ? "text-[#087f71]" : "text-[#60777c]"}`}>{Number(date.slice(8))}日</p><div className="space-y-1">{activeStaff.map((staff) => { const shift = findShift(staff.id, date); const actual = findAttendance(staff.id, date); return <button key={staff.id} onClick={() => openAttendance(staff, date)} className={`flex min-h-6 w-full items-center justify-between rounded px-1.5 text-[9px] font-black ${actual ? "bg-[#dff4ed] text-[#087f71]" : shift ? "bg-[#eef1fb] text-[#5769a7]" : "bg-[#f2f5f4] text-[#94a2a5]"}`}><span className="truncate">{staff.name.split(" ")[0]}</span><span>{actual ? "実" : shift ? displayTime(shift.shift_start) : "＋"}</span></button>; })}</div></div>)}</div></div></div>}

      {(view === "week" || view === "month") && <section className="mt-3 rounded-2xl border border-[#dce8e5] bg-white p-4"><h3 className="font-black">スタッフ別 勤務実績</h3><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{summary.byStaff.map((item) => <div key={item.id} className="rounded-xl bg-[#f3f7f6] p-3"><p className="text-xs font-black">{item.name}</p><p className="mt-1 text-xl font-black text-[#087f71]">{durationText(item.minutes)}</p><p className="text-[10px] text-[#71858a]">{item.days}日勤務</p></div>)}</div></section>}
    </div>}

    {editing && <div className="fixed inset-0 z-50 grid place-items-center bg-[#09262c]/55 p-3"><form onSubmit={saveStaff} className="w-full max-w-lg rounded-3xl bg-white p-5"><div className="flex justify-between"><h3 className="text-xl font-black">{editing === "new" ? "スタッフ登録" : "スタッフ編集"}</h3><button type="button" aria-label="閉じる" onClick={() => setEditing(null)}><X /></button></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Field label="スタッフ番号" value={form.employeeCode} onChange={(value) => setForm({ ...form, employeeCode: value })} /><Field label="氏名" value={form.name} onChange={(value) => setForm({ ...form, name: value })} /><label className="text-xs font-bold">役割<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border p-3"><option value="manager">リーダー</option><option value="therapist">療法士</option><option value="trainer">HALトレーナー</option><option value="reception">受付</option></select></label><Field label="資格・講習" value={form.qualification} onChange={(value) => setForm({ ...form, qualification: value })} /></div><button disabled={saving} className="mt-4 min-h-12 w-full rounded-xl bg-[#087f71] font-black text-white">保存する</button></form></div>}

    {selected && <AttendanceModal staff={selected.staff} date={selected.date} shift={findShift(selected.staff.id, selected.date)} attendance={findAttendance(selected.staff.id, selected.date)} today={data.range.today} form={shiftForm} setForm={setShiftForm} saving={saving} error={error} onClose={() => setSelected(null)} onSave={saveShift} onAction={attendanceAction} />}
    {deleteImpact && <div className="fixed inset-0 z-[70] grid place-items-center bg-[#09262c]/60 p-3"><section role="dialog" aria-modal="true" aria-labelledby="staff-delete-impact-title" className="w-full max-w-lg rounded-3xl bg-white p-6"><div className="flex items-start justify-between"><div><p className="text-xs font-black text-[#bd4f3f]">削除できません</p><h3 id="staff-delete-impact-title" className="mt-1 text-xl font-black">将来の予約があります</h3></div><button aria-label="警告を閉じる" onClick={() => setDeleteImpact(null)} className="grid size-10 place-items-center rounded-xl bg-[#edf4f2]"><X /></button></div><p className="mt-4 rounded-2xl bg-[#fff0ed] p-4 text-sm font-bold leading-6 text-[#9f3f32]">{deleteImpact.error}</p><div className="mt-3 grid grid-cols-2 gap-2"><SummaryCard label="影響する予約" value={`${deleteImpact.futureAppointmentCount}件`} note="将来の有効予約" /><SummaryCard label="予約期間" value={deleteImpact.firstAppointmentAt ? displayDate(deleteImpact.firstAppointmentAt) : "—"} note={deleteImpact.lastAppointmentAt ? `〜 ${displayDate(deleteImpact.lastAppointmentAt)}` : ""} /></div>{deleteImpact.customerNames?.length>0 && <p className="mt-3 rounded-xl bg-[#f3f7f6] p-3 text-xs font-bold text-[#60777c]">対象利用者：{deleteImpact.customerNames.join("、")}{deleteImpact.futureAppointmentCount>deleteImpact.customerNames.length ? " ほか" : ""}</p>}<p className="mt-3 text-xs font-bold leading-5 text-[#60777c]">予約スケジュールで担当スタッフを変更するか、予約をキャンセルした後に、もう一度削除してください。</p><button onClick={() => setDeleteImpact(null)} className="mt-5 min-h-12 w-full rounded-xl bg-[#173b42] font-black text-white">確認しました</button></section></div>}
    {notice && <div role="status" className="fixed right-5 top-20 z-[80] rounded-full bg-[#173b42] px-5 py-3 text-sm font-black text-white shadow-xl">{notice}<button aria-label="通知を閉じる" onClick={() => setNotice("")} className="ml-3">×</button></div>}
  </div>;
}

function AttendanceCard({ staff, date, shift, attendance, onOpen }: { staff: Staff; date: string; shift?: Shift; attendance?: Attendance; onOpen: () => void }) {
  return <button onClick={onOpen} className="rounded-2xl border border-[#dce8e5] bg-white p-4 text-left transition hover:border-[#87cabe] hover:shadow-sm"><div className="flex items-center justify-between"><div><p className="font-black">{staff.name}</p><p className="text-xs text-[#71858a]">{roles[staff.role]}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${attendance ? "bg-[#dff4ed] text-[#087f71]" : "bg-[#eef3f2] text-[#60777c]"}`}>{attendance ? attendanceStatus[attendance.status] : shift ? "予定あり" : "未設定"}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><div className="rounded-xl bg-[#f3f6fb] p-3"><p className="text-[#71858a]">予定</p><b>{shift && shift.status !== "cancelled" ? `${displayTime(shift.shift_start)}〜${displayTime(shift.shift_end)}` : "休み・未設定"}</b></div><div className="rounded-xl bg-[#eff7f5] p-3"><p className="text-[#71858a]">実績</p><b>{attendance ? `${displayTime(attendance.clock_in)}〜${displayTime(attendance.clock_out)}` : "未出勤"}</b></div></div><p className="mt-2 text-right text-xs font-black text-[#087f71]">予定・実績を開く</p><span className="sr-only">{date}</span></button>;
}
function AttendanceCell({ shift, attendance, onClick }: { shift?: Shift; attendance?: Attendance; onClick: () => void }) {
  return <button onClick={onClick} className="min-h-24 border-l p-2 text-left hover:bg-[#f5faf8]"><p className="text-[10px] font-bold text-[#5769a7]">予定 {shift && shift.status !== "cancelled" ? `${displayTime(shift.shift_start)}〜${displayTime(shift.shift_end)}` : "未設定"}</p><p className={`mt-2 text-[10px] font-black ${attendance ? "text-[#087f71]" : "text-[#94a2a5]"}`}>実績 {attendance ? `${displayTime(attendance.clock_in)}〜${displayTime(attendance.clock_out)}` : "—"}</p>{attendance && <span className="mt-1 inline-block rounded-full bg-[#e7f5f1] px-1.5 py-0.5 text-[9px] font-black text-[#087f71]">{attendanceStatus[attendance.status]}</span>}</button>;
}
function AttendanceModal({ staff, date, shift, attendance, today, form, setForm, saving, error, onClose, onSave, onAction }: { staff: Staff; date: string; shift?: Shift; attendance?: Attendance; today: string; form: { plannedStart: string; plannedEnd: string; status: Shift["status"] }; setForm: (value: { plannedStart: string; plannedEnd: string; status: Shift["status"] }) => void; saving: boolean; error: string; onClose: () => void; onSave: (event: React.FormEvent) => void; onAction: (action: "clockIn" | "clockOut" | "approve") => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-[#09262c]/55 p-3"><section role="dialog" aria-modal="true" aria-labelledby="attendance-title" className="my-3 w-full max-w-xl rounded-3xl bg-white p-5"><div className="flex items-start justify-between"><div><p className="text-[10px] font-black tracking-[.15em] text-[#087f71]">SHIFT & ATTENDANCE</p><h3 id="attendance-title" className="text-xl font-black">{staff.name}・{displayDate(date)}</h3></div><button aria-label="閉じる" onClick={onClose} className="grid size-11 place-items-center rounded-xl bg-[#edf4f2]"><X /></button></div><form onSubmit={onSave}><div className="mt-4 rounded-2xl bg-[#f3f6fb] p-4"><div className="flex items-center gap-2"><CalendarDays size={18} className="text-[#5769a7]" /><h4 className="font-black">出勤予定</h4></div><div className="mt-3 grid grid-cols-2 gap-3"><label className="text-xs font-bold">予定出勤時間<input aria-label="予定出勤時間" type="time" value={form.plannedStart} onChange={(event) => setForm({ ...form, plannedStart: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3 text-base font-black" /></label><label className="text-xs font-bold">予定退勤時間<input aria-label="予定退勤時間" type="time" value={form.plannedEnd} onChange={(event) => setForm({ ...form, plannedEnd: event.target.value })} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3 text-base font-black" /></label></div><label className="mt-3 block text-xs font-bold">予定区分<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Shift["status"] })} className="mt-1 min-h-12 w-full rounded-xl border bg-white px-3"><option value="confirmed">確定</option><option value="scheduled">予定</option><option value="cancelled">休み</option></select></label><button disabled={saving} className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#5769a7] font-black text-white"><Check size={17} />予定を保存</button></div></form><div className="mt-3 rounded-2xl bg-[#eff7f5] p-4"><div className="flex items-center gap-2"><Clock3 size={18} className="text-[#087f71]" /><h4 className="font-black">実際の出退勤</h4></div><div className="mt-3 grid grid-cols-2 gap-2"><div className="rounded-xl bg-white p-3"><p className="text-xs text-[#71858a]">実際の出勤</p><p className="mt-1 text-xl font-black">{displayTime(attendance?.clock_in)}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-[#71858a]">実際の退勤</p><p className="mt-1 text-xl font-black">{displayTime(attendance?.clock_out)}</p></div></div>{date === today ? <div className="mt-3 grid grid-cols-2 gap-2">{!attendance?.clock_in && <button disabled={saving} onClick={() => onAction("clockIn")} className="min-h-12 rounded-xl bg-[#087f71] font-black text-white">出勤する</button>}{attendance?.clock_in && !attendance.clock_out && <button disabled={saving} onClick={() => onAction("clockOut")} className="min-h-12 rounded-xl bg-[#c35645] font-black text-white">退勤する</button>}{attendance?.status === "submitted" && <button disabled={saving} onClick={() => onAction("approve")} className="min-h-12 rounded-xl bg-[#173b42] font-black text-white">承認する</button>}</div> : <p className="mt-3 text-xs font-bold text-[#71858a]">実際の出勤・退勤操作は本日のみ行えます。</p>}</div>{shift && <p className="mt-3 text-xs text-[#71858a]">現在の予定：{shift.status === "cancelled" ? "休み" : `${displayTime(shift.shift_start)}〜${displayTime(shift.shift_end)}`}</p>}{error && <p className="mt-3 rounded-xl bg-[#fff0ed] p-3 text-sm font-bold text-[#b94637]">{error}</p>}<button onClick={onClose} className="mt-4 min-h-12 w-full rounded-xl border border-[#d7e4e1] font-black">閉じる</button></section></div>;
}
function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) { return <div className="rounded-2xl border border-[#dce8e5] bg-white p-3"><p className="text-[10px] font-bold text-[#71858a]">{label}</p><p className="mt-1 text-lg font-black md:text-2xl">{value}</p><p className="text-[10px] text-[#829397]">{note}</p></div>; }
function Field({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="text-xs font-bold">{label}<input required value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 min-h-12 w-full rounded-xl border p-3" /></label>; }
