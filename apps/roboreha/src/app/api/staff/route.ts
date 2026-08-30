import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_MANAGER_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const id = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const dateText = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeText = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const fields = {
  employeeCode: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(80),
  role: z.enum(["manager", "therapist", "trainer", "reception"]),
  qualification: z.string().trim().max(100).optional().default(""),
};

const activeBookingStatuses = "('reserved','confirmed','checked_in','in_session')";
async function futureAppointmentImpact(staffId: string) {
  const result = await query(`SELECT count(*)::int AS count,min(a.start_at) AS first_at,max(a.start_at) AS last_at,
    COALESCE(jsonb_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL),'[]'::jsonb) AS customer_names
    FROM appointments a JOIN customers c ON c.id=a.customer_id
    WHERE a.store_id=$1 AND a.therapist_id=$2 AND a.start_at>now() AND a.status IN ${activeBookingStatuses}`, [DEMO_STORE_ID, staffId]);
  return result.rows[0] as { count: number; first_at: string | null; last_at: string | null; customer_names: string[] };
}

function appointmentImpactResponse(staffName: string, impact: { count: number; first_at: string | null; last_at: string | null; customer_names: string[] }, action = "削除") {
  return NextResponse.json({
    error: `${staffName}さんには将来の予約が${impact.count}件あります。先に予約スケジュールで担当者を変更、または予約をキャンセルしてください。`,
    code: "STAFF_HAS_FUTURE_APPOINTMENTS", action, futureAppointmentCount: impact.count,
    firstAppointmentAt: impact.first_at, lastAppointmentAt: impact.last_at, customerNames: impact.customer_names.slice(0, 5),
    affectedScreens: ["予約スケジュール", "顧客予約", "本日の利用者"],
  }, { status: 409 });
}

function isoDate(value: Date) { return value.toISOString().slice(0, 10); }
function parseDate(value: string) { return new Date(`${value}T12:00:00Z`); }
function addDays(value: Date, days: number) { const next = new Date(value); next.setUTCDate(next.getUTCDate() + days); return next; }
function todayInJapan() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

function rangeFor(view: "day" | "week" | "month", requested: string) {
  const anchor = parseDate(requested);
  if (view === "day") return { start: requested, end: requested };
  if (view === "week") {
    const offset = (anchor.getUTCDay() + 6) % 7;
    const start = addDays(anchor, -offset);
    return { start: isoDate(start), end: isoDate(addDays(start, 6)) };
  }
  const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1, 12));
  const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 0, 12));
  return { start: isoDate(start), end: isoDate(end) };
}

export async function GET(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "staff"); if (disabled) return disabled;
  const params = new URL(request.url).searchParams;
  const view = z.enum(["day", "week", "month"]).catch("week").parse(params.get("view"));
  const requested = dateText.catch(todayInJapan()).parse(params.get("date"));
  const range = rangeFor(view, requested);
  const [staff, shifts, attendance] = await Promise.all([
    query(`SELECT s.id,s.employee_code,s.name,s.role,s.qualification,s.active,
      (SELECT count(*)::int FROM appointments a WHERE a.therapist_id=s.id AND a.start_at>now() AND a.status IN ${activeBookingStatuses}) AS future_appointment_count,
      (SELECT min(a.start_at) FROM appointments a WHERE a.therapist_id=s.id AND a.start_at>now() AND a.status IN ${activeBookingStatuses}) AS next_appointment_at
      FROM staff_members s WHERE s.store_id=$1 ORDER BY s.active DESC,CASE s.role WHEN 'manager' THEN 0 ELSE 1 END,s.employee_code`, [DEMO_STORE_ID]),
    query(`SELECT ss.*,ss.work_date::text AS work_date,s.name AS staff_name,s.role FROM staff_shifts ss JOIN staff_members s ON s.id=ss.staff_id WHERE ss.store_id=$1 AND ss.work_date BETWEEN $2::date AND $3::date ORDER BY ss.work_date,ss.shift_start`, [DEMO_STORE_ID, range.start, range.end]),
    query(`SELECT ar.*,ar.work_date::text AS work_date,s.name AS staff_name,s.role FROM attendance_records ar JOIN staff_members s ON s.id=ar.staff_id WHERE ar.store_id=$1 AND ar.work_date BETWEEN $2::date AND $3::date ORDER BY ar.work_date,ar.clock_in NULLS LAST`, [DEMO_STORE_ID, range.start, range.end]),
  ]);
  return NextResponse.json({ staff: staff.rows, shifts: shifts.rows, attendance: attendance.rows, range: { ...range, anchor: requested, view, today: todayInJapan() } });
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "staff"); if (disabled) return disabled;
  const parsed = z.object(fields).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" }, { status: 400 });
  try {
    const result = await query(`INSERT INTO staff_members (store_id,employee_code,name,role,qualification) VALUES ($1,$2,$3,$4,$5) RETURNING *`, [DEMO_STORE_ID, parsed.data.employeeCode, parsed.data.name, parsed.data.role, parsed.data.qualification]);
    return NextResponse.json({ staff: result.rows[0], affectedScreens: ["予約スケジュール", "顧客予約", "本日の利用者"] }, { status: 201 });
  } catch (error) {
    if ((error as { code?: string }).code === "23505") return NextResponse.json({ error: "同じスタッフ番号が登録されています。" }, { status: 409 });
    return NextResponse.json({ error: "スタッフを登録できませんでした。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "staff"); if (disabled) return disabled;
  const body = await request.json();
  if (body.action === "saveShift") {
    const parsed = z.object({ staffId: id, action: z.literal("saveShift"), workDate: dateText, plannedStart: timeText, plannedEnd: timeText, status: z.enum(["scheduled", "confirmed", "cancelled"]).default("confirmed") }).safeParse(body);
    if (!parsed.success || parsed.data.plannedEnd <= parsed.data.plannedStart) return NextResponse.json({ error: "予定出勤時間と予定退勤時間を確認してください。" }, { status: 400 });
    const data = parsed.data;
    const impact = await query(`SELECT count(*)::int AS count,min(a.start_at) AS first_at,max(a.start_at) AS last_at,
      COALESCE(jsonb_agg(DISTINCT c.name),'[]'::jsonb) AS customer_names,s.name AS staff_name
      FROM staff_members s LEFT JOIN appointments a ON a.therapist_id=s.id AND a.store_id=s.store_id
        AND a.start_at>now() AND a.status IN ${activeBookingStatuses} AND (a.start_at AT TIME ZONE 'Asia/Tokyo')::date=$3::date
        AND ($6='cancelled' OR a.start_at<(($3::date+$4::time) AT TIME ZONE 'Asia/Tokyo') OR a.end_at>(($3::date+$5::time) AT TIME ZONE 'Asia/Tokyo'))
      LEFT JOIN customers c ON c.id=a.customer_id WHERE s.id=$1 AND s.store_id=$2 GROUP BY s.name`,
      [data.staffId, DEMO_STORE_ID, data.workDate, data.plannedStart, data.plannedEnd, data.status]);
    const affected = impact.rows[0] as { count: number; first_at: string | null; last_at: string | null; customer_names: string[]; staff_name: string } | undefined;
    if (affected?.count) return appointmentImpactResponse(affected.staff_name, affected, "勤務予定変更");
    const result = await query(
      `INSERT INTO staff_shifts (staff_id,store_id,work_date,shift_start,shift_end,status)
       VALUES ($1,$2,$3,($3::date+$4::time) AT TIME ZONE 'Asia/Tokyo',($3::date+$5::time) AT TIME ZONE 'Asia/Tokyo',$6)
       ON CONFLICT (staff_id,work_date) DO UPDATE SET shift_start=EXCLUDED.shift_start,shift_end=EXCLUDED.shift_end,status=EXCLUDED.status,updated_at=now()
       RETURNING *`,
      [data.staffId, DEMO_STORE_ID, data.workDate, data.plannedStart, data.plannedEnd, data.status],
    );
    return NextResponse.json({ shift: result.rows[0], affectedScreens: ["予約スケジュール", "顧客予約"] });
  }

  if (body.action) {
    const parsed = z.object({ staffId: id, action: z.enum(["clockIn", "clockOut", "submit", "approve"]), workDate: dateText.optional() }).safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "勤怠操作を確認してください。" }, { status: 400 });
    const { staffId, action } = parsed.data;
    const workDate = parsed.data.workDate ?? todayInJapan();
    if (["clockIn", "clockOut"].includes(action) && workDate !== todayInJapan()) return NextResponse.json({ error: "実際の出勤・退勤は本日のみ記録できます。" }, { status: 409 });
    if (action === "clockIn") await query(`INSERT INTO attendance_records (staff_id,store_id,work_date,clock_in) VALUES ($1,$2,$3,now()) ON CONFLICT (staff_id,work_date) DO UPDATE SET clock_in=COALESCE(attendance_records.clock_in,now()),updated_at=now()`, [staffId, DEMO_STORE_ID, workDate]);
    if (action === "clockOut") await query(`UPDATE attendance_records SET clock_out=now(),status='submitted',updated_at=now() WHERE staff_id=$1 AND store_id=$2 AND work_date=$3 AND clock_in IS NOT NULL`, [staffId, DEMO_STORE_ID, workDate]);
    if (action === "submit") await query(`UPDATE attendance_records SET status='submitted',updated_at=now() WHERE staff_id=$1 AND store_id=$2 AND work_date=$3`, [staffId, DEMO_STORE_ID, workDate]);
    if (action === "approve") await query(`UPDATE attendance_records SET status='approved',approved_by=$1,approved_at=now(),updated_at=now() WHERE staff_id=$2 AND store_id=$3 AND work_date=$4 AND status='submitted'`, [DEMO_MANAGER_ID, staffId, DEMO_STORE_ID, workDate]);
    return NextResponse.json({ ok: true });
  }

  const parsed = z.object({ id, ...fields, active: z.boolean().optional() }).safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  const current = await query<{ name: string; role: string }>(`SELECT name,role FROM staff_members WHERE id=$1 AND store_id=$2`, [parsed.data.id, DEMO_STORE_ID]);
  if (!current.rows[0]) return NextResponse.json({ error: "スタッフが見つかりません。" }, { status: 404 });
  const wasAssignable = ["therapist", "trainer"].includes(current.rows[0].role);
  const remainsAssignable = ["therapist", "trainer"].includes(parsed.data.role);
  if (wasAssignable && !remainsAssignable) {
    const impact = await futureAppointmentImpact(parsed.data.id);
    if (impact.count) return appointmentImpactResponse(current.rows[0].name, impact, "役割変更");
  }
  const result = await query(`UPDATE staff_members SET employee_code=$1,name=$2,role=$3,qualification=$4,active=COALESCE($5,active) WHERE id=$6 AND store_id=$7 RETURNING *`, [parsed.data.employeeCode, parsed.data.name, parsed.data.role, parsed.data.qualification, parsed.data.active, parsed.data.id, DEMO_STORE_ID]);
  return NextResponse.json({ staff: result.rows[0], affectedScreens: ["予約スケジュール", "顧客予約", "本日の利用者"] });
}

export async function DELETE(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "staff"); if (disabled) return disabled;
  const parsed = id.safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsed.success) return NextResponse.json({ error: "スタッフIDが正しくありません。" }, { status: 400 });
  if (parsed.data === DEMO_MANAGER_ID) return NextResponse.json({ error: "拠点リーダーは削除できません。" }, { status: 409 });
  const result = await transaction(async (client) => {
    const staff = await client.query<{ id: string; name: string }>(`SELECT id,name FROM staff_members WHERE id=$1 AND store_id=$2 AND active=true FOR UPDATE`, [parsed.data, DEMO_STORE_ID]);
    if (!staff.rows[0]) return { deleted: false as const };
    const impact = await client.query(`SELECT count(*)::int AS count,min(a.start_at) AS first_at,max(a.start_at) AS last_at,
      COALESCE(jsonb_agg(DISTINCT c.name) FILTER (WHERE c.id IS NOT NULL),'[]'::jsonb) AS customer_names
      FROM appointments a JOIN customers c ON c.id=a.customer_id
      WHERE a.store_id=$1 AND a.therapist_id=$2 AND a.start_at>now() AND a.status IN ${activeBookingStatuses}`, [DEMO_STORE_ID, parsed.data]);
    const affected = impact.rows[0] as { count: number; first_at: string | null; last_at: string | null; customer_names: string[] };
    if (affected.count) return { deleted: false as const, blocked: true as const, staffName: staff.rows[0].name, impact: affected };
    await client.query(`UPDATE staff_members SET active=false WHERE id=$1`, [parsed.data]);
    await client.query(`UPDATE staff_shifts SET status='cancelled',updated_at=now() WHERE staff_id=$1 AND shift_start>now()`, [parsed.data]);
    return { deleted: true as const };
  });
  if ("blocked" in result && result.blocked) return appointmentImpactResponse(result.staffName, result.impact);
  return NextResponse.json({ deleted: result.deleted, recoverable: true, affectedScreens: ["予約スケジュール", "顧客予約", "本日の利用者"] });
}
