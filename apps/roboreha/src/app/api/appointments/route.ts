import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_CUSTOMER_ID, DEMO_RECEPTION_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { BookingCapacityError, equipmentCategory, validateConfiguredCapacity } from "@/lib/booking-capacity";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const bookingSchema = z.object({ startAt: z.iso.datetime(), therapistId: databaseId, halUnitId: databaseId, rehabSpaceId: databaseId, productId: databaseId });
const updateSchema = bookingSchema.extend({ appointmentId: databaseId });
type Product = { id: string; name: string; duration_minutes: number; required_model_type: string };
type Shift = { staff_id: string; staff_name: string; work_date: string; shift_start: string; shift_end: string; status: string };
type Hal = { id: string; asset_code: string; model_number: string; model_type: string; status: string };
type Existing = { id: string; customer_id: string; therapist_id: string; hal_unit_id: string; rehab_space_id: string | null; start_at: string; end_at: string; required_model_type: string; hal_model_number: string | null };
type RehabSpace = { id: string; name: string; space_type: "treadmill" | "bench"; capacity_hal_units: number };

class BookingError extends Error { constructor(message: string, public status = 400, public code?: string) { super(message); } }
const overlaps = (start: number, end: number, item: Existing) => new Date(item.start_at).getTime() < end && new Date(item.end_at).getTime() > start;
const tokyoDate = (date: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
};
const timeLabel = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
const tokyoIsoWeekday = (value: Date) => { const day = new Date(`${tokyoDate(value)}T12:00:00+09:00`).getDay(); return day === 0 ? 7 : day; };

function facilityCapacity(modelType: string, equipment: Array<{ category: string; quantity: number; hal_capacity_per_unit: number }>) {
  const category = equipmentCategory(modelType);
  return equipment.filter((item) => item.category === category).reduce((sum, item) => sum + Number(item.quantity) * Number(item.hal_capacity_per_unit), 0);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const requestedProduct = params.get("productId");
  const excludeAppointmentId = params.get("excludeAppointmentId");
  if (requestedProduct && !databaseId.safeParse(requestedProduct).success) return NextResponse.json({ error: "コースIDが正しくありません。" }, { status: 400 });
  if (excludeAppointmentId && !databaseId.safeParse(excludeAppointmentId).success) return NextResponse.json({ error: "予約IDが正しくありません。" }, { status: 400 });
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
  const startDate = z.iso.date().safeParse(params.get("startDate")).data ?? tokyoDate(tomorrow);
  try {
    const [productsResult, shiftsResult, halResult, rehabSpacesResult, existingResult, equipmentResult, upcomingResult, historyResult, storeResult] = await Promise.all([
      query<Product>(`SELECT id,name,duration_minutes,required_model_type FROM service_products WHERE store_id=$1 AND active=true ORDER BY CASE required_model_type WHEN 'lower_limb' THEN 1 WHEN 'single_joint' THEN 2 ELSE 3 END,code`, [DEMO_STORE_ID]),
      query<Shift>(`SELECT ss.staff_id,st.name AS staff_name,ss.work_date,ss.shift_start,ss.shift_end,ss.status FROM staff_shifts ss JOIN staff_members st ON st.id=ss.staff_id WHERE ss.store_id=$1 AND ss.work_date >= $2::date AND ss.work_date < $2::date+7 AND ss.status IN ('scheduled','confirmed') AND st.active=true AND st.role IN ('therapist','trainer')`, [DEMO_STORE_ID, startDate]),
      query<Hal>(`SELECT id,asset_code,model_number,model_type,status FROM hal_units WHERE store_id=$1 AND status='available' ORDER BY asset_code`, [DEMO_STORE_ID]),
      query<RehabSpace>(`SELECT id,name,space_type,capacity_hal_units FROM rehabilitation_spaces WHERE store_id=$1 AND active=true ORDER BY space_code`, [DEMO_STORE_ID]),
      query<Existing>(`SELECT a.id,a.customer_id,a.therapist_id,a.hal_unit_id,a.rehab_space_id,a.start_at,a.end_at,p.required_model_type,h.model_number AS hal_model_number FROM appointments a JOIN service_products p ON p.id=a.product_id LEFT JOIN hal_units h ON h.id=a.hal_unit_id WHERE a.store_id=$1 AND a.status IN ('reserved','confirmed','checked_in','in_session') AND a.start_at < (($2::date+7)+time '18:00') AT TIME ZONE 'Asia/Tokyo' AND a.end_at > ($2::date+time '10:00') AT TIME ZONE 'Asia/Tokyo'`, [DEMO_STORE_ID, startDate]),
      query<{ category: string; model_number: string; quantity: number; hal_capacity_per_unit: number }>(`SELECT category,model_number,quantity,hal_capacity_per_unit FROM facility_equipment_models WHERE store_id=$1`, [DEMO_STORE_ID]),
      query(`SELECT a.id,a.start_at,a.end_at,a.status,a.product_id,a.therapist_id,a.hal_unit_id,a.rehab_space_id,p.name AS product_name,p.duration_minutes,st.name AS therapist_name,h.asset_code AS hal_asset_code,rs.name AS rehab_space_name,(a.start_at >= now()+interval '30 minutes') AS can_cancel,(a.start_at > now()) AS can_edit FROM appointments a JOIN service_products p ON p.id=a.product_id JOIN staff_members st ON st.id=a.therapist_id LEFT JOIN hal_units h ON h.id=a.hal_unit_id LEFT JOIN rehabilitation_spaces rs ON rs.id=a.rehab_space_id WHERE a.customer_id=$1 AND a.start_at>=now() AND a.status IN ('reserved','confirmed') ORDER BY a.start_at`, [DEMO_CUSTOMER_ID]),
      query(`SELECT a.id,a.start_at,a.end_at,a.status,p.name AS product_name,st.name AS therapist_name,h.asset_code AS hal_asset_code,rs.name AS rehab_space_name,ca.id AS assessment_id,ca.pre_metrics,ca.post_metrics,ca.delta_summary,ca.summary_text,ca.notes,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',av.id,'phase',av.phase,'url','/api/videos/'||av.id,'mimeType',av.mime_type) ORDER BY av.created_at) FROM assessment_videos av WHERE av.assessment_id=ca.id),'[]'::jsonb) AS videos FROM appointments a JOIN service_products p ON p.id=a.product_id JOIN staff_members st ON st.id=a.therapist_id LEFT JOIN hal_units h ON h.id=a.hal_unit_id LEFT JOIN rehabilitation_spaces rs ON rs.id=a.rehab_space_id LEFT JOIN clinical_assessments ca ON ca.appointment_id=a.id WHERE a.customer_id=$1 AND (a.start_at<now() OR a.status IN ('completed','cancelled','no_show')) ORDER BY a.start_at DESC LIMIT 30`, [DEMO_CUSTOMER_ID]),
      query<{ name: string; phone: string; open_minutes: number; close_minutes: number; closed_weekdays: number[] }>(`SELECT name,phone,(extract(hour from open_time)*60+extract(minute from open_time))::int AS open_minutes,(extract(hour from close_time)*60+extract(minute from close_time))::int AS close_minutes,closed_weekdays FROM stores WHERE id=$1`, [DEMO_STORE_ID]),
    ]);
    const product = productsResult.rows.find((item) => item.id === requestedProduct) ?? productsResult.rows[0];
    if (!product) return NextResponse.json({ error: "予約可能なコースがありません。" }, { status: 404 });
    const store = storeResult.rows[0];
    const dates = Array.from({ length: 7 }, (_, index) => { const date = new Date(`${startDate}T12:00:00+09:00`); date.setDate(date.getDate() + index); return tokyoDate(date); });
    const existing = existingResult.rows.filter((item) => item.id !== (excludeAppointmentId ?? ""));
    const slots = dates.flatMap((date) => Array.from({ length: 16 }, (_, index) => {
      const minutes = 600 + index * 30; const startAt = new Date(`${date}T${timeLabel(minutes)}:00+09:00`); const start = startAt.getTime(); const end = start + product.duration_minutes * 60000;
      const intervalAppointments = existing.filter((item) => overlaps(start, end, item));
      const customerFree = !intervalAppointments.some((item) => item.customer_id === DEMO_CUSTOMER_ID);
      const shift = shiftsResult.rows.find((item) => new Date(item.shift_start).getTime() <= start && new Date(item.shift_end).getTime() >= end && !intervalAppointments.some((appointment) => appointment.therapist_id === item.staff_id));
      const hal = halResult.rows.find((item) => {
        const configuredQuantity = equipmentResult.rows.filter((equipment) => equipment.category === "hal" && equipment.model_number === item.model_number).reduce((sum, equipment) => sum + Number(equipment.quantity), 0);
        const modelInUse = intervalAppointments.filter((appointment) => appointment.hal_model_number === item.model_number).length;
        return item.model_type === product.required_model_type && configuredQuantity > modelInUse && !intervalAppointments.some((appointment) => appointment.hal_unit_id === item.id);
      });
      const requiredSpaceType = product.required_model_type === "lower_limb" ? "treadmill" : "bench";
      const rehabSpace = rehabSpacesResult.rows.find((item) => item.space_type === requiredSpaceType && intervalAppointments.filter((appointment) => appointment.rehab_space_id === item.id).length < Number(item.capacity_hal_units));
      const capacity = facilityCapacity(product.required_model_type, equipmentResult.rows);
      const category = equipmentCategory(product.required_model_type);
      const usedCapacity = intervalAppointments.filter((item) => equipmentCategory(item.required_model_type) === category).length;
      const closed = store?.closed_weekdays?.includes(tokyoIsoWeekday(startAt)) ?? false;
      const available = !closed && start > Date.now() && end <= new Date(`${date}T18:00:00+09:00`).getTime() && customerFree && Boolean(shift && hal && rehabSpace) && usedCapacity < capacity;
      return { date, time: timeLabel(minutes), startAt: startAt.toISOString(), available, therapistId: available ? shift?.staff_id : null, therapistName: available ? shift?.staff_name : null, halUnitId: available ? hal?.id : null, halAssetCode: available ? hal?.asset_code : null, rehabSpaceId: available ? rehabSpace?.id : null, rehabSpaceName: available ? rehabSpace?.name : null };
    }));
    return NextResponse.json({ products: productsResult.rows, selectedProduct: product, dates, slots, upcomingAppointments: upcomingResult.rows, visitHistory: historyResult.rows, store, cancellationMinutes: 30 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "予約情報を取得できませんでした。" }, { status: 500 }); }
}

type DbClient = { query: (text: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };
async function validateSelection(client: DbClient, data: z.infer<typeof bookingSchema>, excludeId?: string) {
  const product = await client.query(`SELECT duration_minutes,required_model_type FROM service_products WHERE id=$1 AND store_id=$2 AND active=true`, [data.productId, DEMO_STORE_ID]);
  const item = product.rows[0] as { duration_minutes: number; required_model_type: string } | undefined;
  if (!item) throw new BookingError("コースが見つかりません。");
  const start = new Date(data.startAt); const end = new Date(start.getTime() + item.duration_minutes * 60000);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(start);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); const minuteOfDay = Number(values.hour) * 60 + Number(values.minute);
  const store = await client.query(`SELECT (extract(hour from open_time)*60+extract(minute from open_time))::int AS open_minutes,(extract(hour from close_time)*60+extract(minute from close_time))::int AS close_minutes,closed_weekdays FROM stores WHERE id=$1`, [DEMO_STORE_ID]);
  const settings = store.rows[0] as { open_minutes: number; close_minutes: number; closed_weekdays: number[] };
  if (settings.closed_weekdays.includes(tokyoIsoWeekday(start))) throw new BookingError("水曜日・木曜日は休館日のため予約できません。", 409);
  if (start <= new Date() || minuteOfDay < settings.open_minutes || minuteOfDay % 30 !== 0 || minuteOfDay + item.duration_minutes > settings.close_minutes) throw new BookingError("10:00〜18:00の予約可能な30分枠を選択してください。");
  const shift = await client.query(`SELECT 1 FROM staff_shifts WHERE staff_id=$1 AND store_id=$2 AND status IN ('scheduled','confirmed') AND shift_start<=$3 AND shift_end>=$4`, [data.therapistId, DEMO_STORE_ID, start.toISOString(), end.toISOString()]);
  if (!shift.rows[0]) throw new BookingError("担当療法士が出勤していない時間です。別の枠を選択してください。", 409);
  const hal = await client.query(`SELECT 1 FROM hal_units WHERE id=$1 AND store_id=$2 AND status='available' AND model_type=$3`, [data.halUnitId, DEMO_STORE_ID, item.required_model_type]);
  if (!hal.rows[0]) throw new BookingError("コースに対応するHAL機器を利用できません。", 409);
  const requiredSpaceType = item.required_model_type === "lower_limb" ? "treadmill" : "bench";
  const rehabSpace = await client.query(`SELECT 1 FROM rehabilitation_spaces WHERE id=$1 AND store_id=$2 AND active=true AND space_type=$3`, [data.rehabSpaceId, DEMO_STORE_ID, requiredSpaceType]);
  if (!rehabSpace.rows[0]) throw new BookingError(`コースに対応する${requiredSpaceType === "treadmill" ? "トレッドミル" : "ベンチ"}を利用できません。`, 409);
  const conflicts = await client.query(`SELECT 1 FROM appointments WHERE store_id=$1 AND id<>COALESCE($2::uuid,'00000000-0000-0000-0000-000000000000') AND status IN ('reserved','confirmed','checked_in','in_session') AND start_at<$4 AND end_at>$3 AND (customer_id=$5 OR therapist_id=$6 OR hal_unit_id=$7) LIMIT 1`, [DEMO_STORE_ID, excludeId ?? null, start.toISOString(), end.toISOString(), DEMO_CUSTOMER_ID, data.therapistId, data.halUnitId]);
  if (conflicts.rows[0]) throw new BookingError("この枠は先に予約されました。別の〇を選択してください。", 409);
  await validateConfiguredCapacity(client, { storeId: DEMO_STORE_ID, requiredModelType: item.required_model_type, halUnitId: data.halUnitId, startAt: start, endAt: end, excludeAppointmentId: excludeId });
  return { ...item, end };
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "appointments"); if (disabled) return disabled;
  const parsed = bookingSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "予約内容が正しくありません。" }, { status: 400 });
  try {
    const appointment = await transaction(async (client) => {
      const validated = await validateSelection(client as unknown as DbClient, parsed.data);
      const result = await client.query(`INSERT INTO appointments (store_id,customer_id,therapist_id,hal_unit_id,rehab_space_id,product_id,status,start_at,end_at,note) VALUES ($1,$2,$3,$4,$5,$6,'confirmed',$7,$8,'顧客スマホから予約') RETURNING *`, [DEMO_STORE_ID, DEMO_CUSTOMER_ID, parsed.data.therapistId, parsed.data.halUnitId, parsed.data.rehabSpaceId, parsed.data.productId, parsed.data.startAt, validated.end.toISOString()]);
      await client.query(`INSERT INTO appointment_change_logs (appointment_id,action,after_state,changed_by) VALUES ($1,'create',$2::jsonb,$3)`, [result.rows[0].id, JSON.stringify(result.rows[0]), DEMO_RECEPTION_ID]); return result.rows[0];
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) { return bookingErrorResponse(error); }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "appointments"); if (disabled) return disabled;
  const parsed = updateSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "変更内容が正しくありません。" }, { status: 400 });
  try {
    const appointment = await transaction(async (client) => {
      const before = await client.query(`SELECT * FROM appointments WHERE id=$1 AND customer_id=$2 AND status IN ('reserved','confirmed') FOR UPDATE`, [parsed.data.appointmentId, DEMO_CUSTOMER_ID]);
      if (!before.rows[0]) throw new BookingError("変更可能な予約が見つかりません。", 404);
      const validated = await validateSelection(client as unknown as DbClient, parsed.data, parsed.data.appointmentId);
      const result = await client.query(`UPDATE appointments SET therapist_id=$1,hal_unit_id=$2,rehab_space_id=$3,product_id=$4,start_at=$5,end_at=$6,note=concat_ws(E'\n',note,'顧客スマホから変更') WHERE id=$7 RETURNING *`, [parsed.data.therapistId, parsed.data.halUnitId, parsed.data.rehabSpaceId, parsed.data.productId, parsed.data.startAt, validated.end.toISOString(), parsed.data.appointmentId]);
      await client.query(`INSERT INTO appointment_change_logs (appointment_id,action,before_state,after_state,changed_by) VALUES ($1,'move',$2::jsonb,$3::jsonb,$4)`, [parsed.data.appointmentId, JSON.stringify(before.rows[0]), JSON.stringify(result.rows[0]), DEMO_RECEPTION_ID]); return result.rows[0];
    });
    return NextResponse.json({ appointment });
  } catch (error) { return bookingErrorResponse(error); }
}

export async function DELETE(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "appointments"); if (disabled) return disabled;
  const appointmentId = databaseId.safeParse(new URL(request.url).searchParams.get("id")); if (!appointmentId.success) return NextResponse.json({ error: "予約IDが正しくありません。" }, { status: 400 });
  try {
    const appointment = await transaction(async (client) => {
      const result = await client.query(`SELECT a.* FROM appointments a WHERE a.id=$1 AND a.customer_id=$2 AND a.status IN ('reserved','confirmed') FOR UPDATE`, [appointmentId.data, DEMO_CUSTOMER_ID]);
      const before = result.rows[0] as { start_at: string } | undefined; if (!before) throw new BookingError("キャンセル可能な予約が見つかりません。", 404);
      if (new Date(before.start_at).getTime() < Date.now() + 30 * 60000) throw new BookingError("開始30分前を過ぎているため、この画面ではキャンセルできません。センターへ直接電話してください。", 409, "CANCELLATION_DEADLINE");
      const cancelled = await client.query(`UPDATE appointments SET status='cancelled',note=concat_ws(E'\n',note,'顧客スマホからキャンセル') WHERE id=$1 RETURNING *`, [appointmentId.data]);
      await client.query(`INSERT INTO appointment_change_logs (appointment_id,action,before_state,after_state,changed_by) VALUES ($1,'cancel',$2::jsonb,$3::jsonb,$4)`, [appointmentId.data, JSON.stringify(before), JSON.stringify(cancelled.rows[0]), DEMO_RECEPTION_ID]); return cancelled.rows[0];
    });
    return NextResponse.json({ appointment });
  } catch (error) {
    if (error instanceof BookingError && error.code === "CANCELLATION_DEADLINE") { const store = await query<{ phone: string }>(`SELECT phone FROM stores WHERE id=$1`, [DEMO_STORE_ID]); return NextResponse.json({ error: error.message, code: error.code, phone: store.rows[0]?.phone }, { status: error.status }); }
    return bookingErrorResponse(error);
  }
}

function bookingErrorResponse(error: unknown) {
  if (error instanceof BookingError) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  if (error instanceof BookingCapacityError) return NextResponse.json({ error: error.message, code: "EQUIPMENT_CAPACITY" }, { status: 409 });
  const pgError = error as { code?: string }; if (["23P01", "40001", "P0001"].includes(pgError.code ?? "")) return NextResponse.json({ error: error instanceof Error ? error.message : "この時間枠は予約できません。" }, { status: 409 });
  return NextResponse.json({ error: error instanceof Error ? error.message : "予約を処理できませんでした。" }, { status: 500 });
}
