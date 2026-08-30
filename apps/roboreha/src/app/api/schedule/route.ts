import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_RECEPTION_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { BookingCapacityError, validateConfiguredCapacity } from "@/lib/booking-capacity";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const createSchema = z.object({
  customerId: databaseId,
  therapistId: databaseId,
  halUnitId: databaseId,
  rehabSpaceId: databaseId,
  productId: databaseId,
  startAt: z.iso.datetime(),
  note: z.string().max(500).optional().default(""),
});
const updateSchema = z.object({
  id: databaseId,
  therapistId: databaseId,
  halUnitId: databaseId,
  rehabSpaceId: databaseId,
  startAt: z.iso.datetime(),
  customerId: databaseId.optional(),
  productId: databaseId.optional(),
  note: z.string().max(500).optional(),
});

class ScheduleInputError extends Error {}

function tokyoMinutes(value: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(value));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return Number(values.hour) * 60 + Number(values.minute);
}

async function validateHal(
  client: { query: (text: string, values: unknown[]) => Promise<{ rows: Array<{ model_type: string; status: string }> }> },
  halUnitId: string,
  requiredModelType: string,
) {
  const hal = await client.query(
    `SELECT model_type, status FROM hal_units WHERE id = $1 AND store_id = $2`,
    [halUnitId, DEMO_STORE_ID],
  );
  if (!hal.rows[0] || hal.rows[0].status !== "available") throw new ScheduleInputError("選択したHAL機器は現在利用できません。");
  if (hal.rows[0].model_type !== requiredModelType) throw new ScheduleInputError("コースに対応するHAL機種を選択してください。");
}

async function validateRehabSpace(
  client: { query: (text: string, values: unknown[]) => Promise<{ rows: Array<{ space_type: string }> }> },
  rehabSpaceId: string,
  requiredModelType: string,
) {
  const space = await client.query(
    `SELECT space_type FROM rehabilitation_spaces WHERE id=$1 AND store_id=$2 AND active=true`,
    [rehabSpaceId, DEMO_STORE_ID],
  );
  if (!space.rows[0]) throw new ScheduleInputError("選択したリハスペースは利用できません。");
  const requiredSpaceType = requiredModelType === "lower_limb" ? "treadmill" : "bench";
  if (space.rows[0].space_type !== requiredSpaceType) throw new ScheduleInputError(`このコースには${requiredSpaceType === "treadmill" ? "トレッドミル" : "ベンチ"}を選択してください。`);
}

async function validateTimeRange(client: { query: (text: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> }, startAt: string, durationMinutes: number, therapistId: string) {
  const start = tokyoMinutes(startAt);
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(startAt));
  const day = new Date(`${date}T12:00:00+09:00`).getDay(); const isoDay = day === 0 ? 7 : day;
  const store = await client.query(`SELECT (extract(hour from open_time)*60+extract(minute from open_time))::int AS open_minutes,(extract(hour from close_time)*60+extract(minute from close_time))::int AS close_minutes,closed_weekdays FROM stores WHERE id=$1`, [DEMO_STORE_ID]);
  const settings = store.rows[0] as { open_minutes: number; close_minutes: number; closed_weekdays: number[] };
  if (settings.closed_weekdays.includes(isoDay)) throw new ScheduleInputError("水曜日・木曜日は休館日のため予約できません。");
  if (start < settings.open_minutes || start % 30 !== 0 || start + durationMinutes > settings.close_minutes) {
    throw new ScheduleInputError("予約は10:00〜18:00の30分単位で登録してください。");
  }
  const endAt = new Date(new Date(startAt).getTime()+durationMinutes*60000).toISOString();
  const shift = await client.query(`SELECT 1 FROM staff_shifts WHERE staff_id=$1 AND store_id=$2 AND status IN ('scheduled','confirmed') AND shift_start<=$3 AND shift_end>=$4`, [therapistId,DEMO_STORE_ID,startAt,endAt]);
  if (!shift.rows[0]) throw new ScheduleInputError("担当スタッフが出勤していない時間です。");
}

function conflictResponse(message?: string) {
  return NextResponse.json({ error: message ?? "顧客・療法士・HAL機器のいずれかが同じ時間に使用中です。" }, { status: 409 });
}

export async function GET(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "appointments"); if (disabled) return disabled;
  const date = new URL(request.url).searchParams.get("date");
  const parsedDate = z.iso.date().safeParse(date);
  if (!parsedDate.success) return NextResponse.json({ error: "日付が正しくありません。" }, { status: 400 });

  try {
    const [appointments, therapists, halUnits, rehabSpaces, customers, products] = await Promise.all([
      query(
        `SELECT a.id, a.customer_id, a.therapist_id, a.hal_unit_id, a.rehab_space_id, a.product_id,
                a.start_at, a.end_at, a.status, a.appointment_type, a.note,
                c.name AS customer_name, c.primary_condition,
                st.name AS therapist_name, h.asset_code AS hal_asset_code,
                h.model_number AS hal_model_number, p.name AS product_name,
                rs.name AS rehab_space_name, rs.space_type AS rehab_space_type
           FROM appointments a
           JOIN customers c ON c.id = a.customer_id
           JOIN staff_members st ON st.id = a.therapist_id
           LEFT JOIN hal_units h ON h.id = a.hal_unit_id
           LEFT JOIN rehabilitation_spaces rs ON rs.id = a.rehab_space_id
           JOIN service_products p ON p.id = a.product_id
          WHERE a.store_id = $1 AND a.status <> 'cancelled'
            AND a.start_at < (($2::date + time '18:00') AT TIME ZONE 'Asia/Tokyo')
            AND a.end_at > (($2::date + time '10:00') AT TIME ZONE 'Asia/Tokyo')
          ORDER BY a.start_at`,
        [DEMO_STORE_ID, parsedDate.data],
      ),
      query(
        `SELECT id, name, role, qualification FROM staff_members
          WHERE store_id = $1 AND active = true AND role IN ('therapist','trainer') ORDER BY employee_code`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT h.id,h.asset_code,h.model_type,h.model_number,h.size_label,
                CASE WHEN COALESCE((SELECT sum(fem.quantity) FROM facility_equipment_models fem WHERE fem.store_id=h.store_id AND fem.category='hal' AND fem.model_number=h.model_number),0)>0 THEN h.status ELSE 'unconfigured' END AS status
           FROM hal_units h WHERE h.store_id = $1 AND h.status <> 'retired' ORDER BY h.asset_code`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT rs.id,rs.space_code,rs.name,rs.space_type,rs.capacity_hal_units,'available'::text AS status
           FROM rehabilitation_spaces rs WHERE rs.store_id=$1 AND rs.active=true
             AND COALESCE((SELECT sum(fem.quantity) FROM facility_equipment_models fem WHERE fem.store_id=rs.store_id AND fem.category=rs.space_type),0)>0
          ORDER BY CASE space_type WHEN 'treadmill' THEN 1 ELSE 2 END,space_code`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT id, customer_code, name, primary_condition FROM customers
          WHERE store_id = $1 AND active = true ORDER BY name_kana`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT id, name, duration_minutes, required_model_type FROM service_products
          WHERE store_id = $1 AND active = true ORDER BY duration_minutes DESC`,
        [DEMO_STORE_ID],
      ),
    ]);
    return NextResponse.json({
      date: parsedDate.data,
      appointments: appointments.rows,
      therapists: therapists.rows,
      halUnits: halUnits.rows,
      rehabSpaces: rehabSpaces.rows,
      customers: customers.rows,
      products: products.rows,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "スケジュールを取得できませんでした。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "appointments"); if (disabled) return disabled;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "予約内容を確認してください。" }, { status: 400 });
  try {
    const appointment = await transaction(async (client) => {
      const product = await client.query<{ duration_minutes: number; required_model_type: string }>(
        `SELECT duration_minutes, required_model_type FROM service_products WHERE id = $1 AND store_id = $2 AND active = true`,
        [parsed.data.productId, DEMO_STORE_ID],
      );
      if (!product.rows[0]) throw new ScheduleInputError("コースが見つかりません。");
      await validateTimeRange(client, parsed.data.startAt, product.rows[0].duration_minutes, parsed.data.therapistId);
      await validateHal(client, parsed.data.halUnitId, product.rows[0].required_model_type);
      await validateRehabSpace(client, parsed.data.rehabSpaceId, product.rows[0].required_model_type);
      const start = new Date(parsed.data.startAt); const end = new Date(start.getTime() + product.rows[0].duration_minutes * 60000);
      await validateConfiguredCapacity(client, { storeId: DEMO_STORE_ID, requiredModelType: product.rows[0].required_model_type, halUnitId: parsed.data.halUnitId, startAt: start, endAt: end });
      const created = await client.query(
        `INSERT INTO appointments
          (store_id, customer_id, therapist_id, hal_unit_id, rehab_space_id, product_id, status, start_at, end_at, note)
         VALUES ($1,$2,$3,$4,$5,$6,'confirmed',$7::timestamptz,
                 $7::timestamptz + ($8 || ' minutes')::interval,$9)
         RETURNING *`,
        [DEMO_STORE_ID, parsed.data.customerId, parsed.data.therapistId, parsed.data.halUnitId, parsed.data.rehabSpaceId, parsed.data.productId, parsed.data.startAt, product.rows[0].duration_minutes, parsed.data.note],
      );
      await client.query(
        `INSERT INTO appointment_change_logs (appointment_id, action, after_state, changed_by)
         VALUES ($1, 'create', $2::jsonb, $3)`,
        [created.rows[0].id, JSON.stringify(created.rows[0]), DEMO_RECEPTION_ID],
      );
      return created.rows[0];
    });
    return NextResponse.json({ appointment }, { status: 201 });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23P01" || pgError.code === "40001" || pgError.code === "P0001") return conflictResponse(error instanceof Error ? error.message : undefined);
    if (error instanceof BookingCapacityError) return conflictResponse(error.message);
    if (error instanceof ScheduleInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "予約を登録できませんでした。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "appointments"); if (disabled) return disabled;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "変更内容を確認してください。" }, { status: 400 });
  try {
    const appointment = await transaction(async (client) => {
      const before = await client.query(
        `SELECT a.* FROM appointments a
         WHERE a.id = $1 AND a.store_id = $2 AND a.status IN ('reserved','confirmed') FOR UPDATE OF a`,
        [parsed.data.id, DEMO_STORE_ID],
      );
      if (!before.rows[0]) throw new ScheduleInputError("移動可能な予約が見つかりません。");
      const productId = parsed.data.productId ?? before.rows[0].product_id;
      const product = await client.query<{ duration_minutes: number; required_model_type: string }>(
        `SELECT duration_minutes, required_model_type FROM service_products WHERE id = $1 AND store_id = $2 AND active = true`,
        [productId, DEMO_STORE_ID],
      );
      if (!product.rows[0]) throw new ScheduleInputError("コースが見つかりません。");
      const durationMinutes = product.rows[0].duration_minutes;
      await validateTimeRange(client, parsed.data.startAt, durationMinutes, parsed.data.therapistId);
      await validateHal(client, parsed.data.halUnitId, product.rows[0].required_model_type);
      await validateRehabSpace(client, parsed.data.rehabSpaceId, product.rows[0].required_model_type);
      const start = new Date(parsed.data.startAt); const end = new Date(start.getTime() + durationMinutes * 60000);
      await validateConfiguredCapacity(client, { storeId: DEMO_STORE_ID, requiredModelType: product.rows[0].required_model_type, halUnitId: parsed.data.halUnitId, startAt: start, endAt: end, excludeAppointmentId: parsed.data.id });
      const moved = await client.query(
        `UPDATE appointments
            SET customer_id = $1, therapist_id = $2, hal_unit_id = $3, rehab_space_id=$4, product_id = $5,
                start_at = $6::timestamptz,
                end_at = $6::timestamptz + ($7 || ' minutes')::interval,
                note = $8
          WHERE id = $9
          RETURNING *`,
        [parsed.data.customerId ?? before.rows[0].customer_id, parsed.data.therapistId, parsed.data.halUnitId, parsed.data.rehabSpaceId, productId, parsed.data.startAt, durationMinutes, parsed.data.note ?? before.rows[0].note, parsed.data.id],
      );
      await client.query(
        `INSERT INTO appointment_change_logs (appointment_id, action, before_state, after_state, changed_by)
         VALUES ($1, 'move', $2::jsonb, $3::jsonb, $4)`,
        [parsed.data.id, JSON.stringify(before.rows[0]), JSON.stringify(moved.rows[0]), DEMO_RECEPTION_ID],
      );
      return moved.rows[0];
    });
    return NextResponse.json({ appointment });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23P01" || pgError.code === "40001" || pgError.code === "P0001") return conflictResponse(error instanceof Error ? error.message : undefined);
    if (error instanceof BookingCapacityError) return conflictResponse(error.message);
    if (error instanceof ScheduleInputError) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ error: error instanceof Error ? error.message : "予約を移動できませんでした。" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "appointments"); if (disabled) return disabled;
  const parsedId = databaseId.safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsedId.success) return NextResponse.json({ error: "予約IDが正しくありません。" }, { status: 400 });
  try {
    const appointment = await transaction(async (client) => {
      const before = await client.query(
        `SELECT * FROM appointments WHERE id = $1 AND store_id = $2 AND status IN ('reserved','confirmed') FOR UPDATE`,
        [parsedId.data, DEMO_STORE_ID],
      );
      if (!before.rows[0]) throw new Error("削除可能な予約が見つかりません。");
      const cancelled = await client.query(
        `UPDATE appointments SET status = 'cancelled', note = concat_ws(E'\n', note, '施設カレンダーから削除')
          WHERE id = $1 RETURNING *`,
        [parsedId.data],
      );
      await client.query(
        `INSERT INTO appointment_change_logs (appointment_id, action, before_state, after_state, changed_by)
         VALUES ($1, 'cancel', $2::jsonb, $3::jsonb, $4)`,
        [parsedId.data, JSON.stringify(before.rows[0]), JSON.stringify(cancelled.rows[0]), DEMO_RECEPTION_ID],
      );
      return cancelled.rows[0];
    });
    return NextResponse.json({ appointment, recoverable: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "予約を削除できませんでした。" }, { status: 500 });
  }
}
