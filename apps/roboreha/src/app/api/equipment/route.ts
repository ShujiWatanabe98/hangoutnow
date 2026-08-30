import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const equipmentFields = {
  equipmentName: z.string().trim().min(1, "機材名を入力してください。").max(100),
  modelNumber: z.string().trim().min(1, "機種・型番を入力してください。").max(80),
  quantity: z.coerce.number().int().min(0).max(999),
  halCapacityPerUnit: z.coerce.number().int().min(1).max(20).optional().default(1),
  note: z.string().trim().max(300).optional().default(""),
};

const createSchema = z.object({
  category: z.enum(["hal", "treadmill", "bench"]),
  ...equipmentFields,
});

const updateSchema = z.object({
  id: databaseId,
  ...equipmentFields,
});

type DbClient = { query: (text: string, values: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }> };
class ReservationImpactError extends Error {}

async function activeDemand(client: DbClient, category: "hal" | "treadmill" | "bench", modelNumber?: string) {
  const condition = category === "hal"
    ? "h.model_number=$2"
    : "CASE WHEN p.required_model_type='lower_limb' THEN 'treadmill' ELSE 'bench' END=$2";
  const joins = category === "hal" ? "JOIN hal_units h ON h.id=a.hal_unit_id" : "JOIN service_products p ON p.id=a.product_id";
  const result = await client.query(
    `WITH active AS (
       SELECT a.id,a.start_at,a.end_at FROM appointments a ${joins}
        WHERE a.store_id=$1 AND a.status IN ('reserved','confirmed','checked_in','in_session') AND a.end_at>now() AND ${condition}
     )
     SELECT count(*)::int AS active_count,
            COALESCE(max((SELECT count(*) FROM active overlap_item WHERE overlap_item.start_at<active.end_at AND overlap_item.end_at>active.start_at)),0)::int AS max_concurrent
       FROM active`,
    [DEMO_STORE_ID, category === "hal" ? modelNumber ?? "" : category],
  );
  return { activeCount: Number(result.rows[0]?.active_count ?? 0), maxConcurrent: Number(result.rows[0]?.max_concurrent ?? 0) };
}

const bookingUpdate = { executed: true, affectedExistingReservations: 0, message: "機材変更を予約可能枠へ反映しました。既存予約への影響はありません。" };

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "equipment"); if (disabled) return disabled;
  const parsed = createSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" }, { status: 400 });
  }

  try {
    const result = await query(
      `INSERT INTO facility_equipment_models
        (store_id, category, equipment_name, model_number, quantity, hal_capacity_per_unit, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, category, equipment_name, model_number, quantity, hal_capacity_per_unit, note, updated_at`,
      [DEMO_STORE_ID, parsed.data.category, parsed.data.equipmentName, parsed.data.modelNumber, parsed.data.quantity, parsed.data.halCapacityPerUnit, parsed.data.note],
    );
    return NextResponse.json({ equipment: result.rows[0], bookingUpdate }, { status: 201 });
  } catch (error) {
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json({ error: "同じカテゴリーと型番の機材がすでに登録されています。" }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "機材を登録できませんでした。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "equipment"); if (disabled) return disabled;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" }, { status: 400 });
  }

  try {
    const equipment = await transaction(async (client) => {
      const before = await client.query(`SELECT * FROM facility_equipment_models WHERE id=$1 AND store_id=$2 FOR UPDATE`, [parsed.data.id, DEMO_STORE_ID]);
      const current = before.rows[0] as { category: "hal" | "treadmill" | "bench"; model_number: string } | undefined;
      if (!current) throw new Error("更新対象の機材が見つかりません。");
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`equipment-update:${DEMO_STORE_ID}:${current.category}`]);
      if (current.category === "hal") {
        const demand = await activeDemand(client as unknown as DbClient, "hal", current.model_number);
        const proposedOldModelQuantity = current.model_number === parsed.data.modelNumber ? parsed.data.quantity : 0;
        if (demand.maxConcurrent > proposedOldModelQuantity) {
          throw new ReservationImpactError(`この変更は既存予約${demand.activeCount}件で使用するHAL機器に影響します。予約が消える可能性があるため、予約を変更してから機材変更してください。`);
        }
      } else {
        const totals = await client.query(
          `SELECT COALESCE(sum(CASE WHEN id=$1 THEN $2*$3 ELSE quantity*hal_capacity_per_unit END),0)::int AS capacity
             FROM facility_equipment_models WHERE store_id=$4 AND category=$5`,
          [parsed.data.id, parsed.data.quantity, parsed.data.halCapacityPerUnit, DEMO_STORE_ID, current.category],
        );
        const proposedCapacity = Number(totals.rows[0]?.capacity ?? 0);
        const demand = await activeDemand(client as unknown as DbClient, current.category);
        if (demand.maxConcurrent > proposedCapacity) {
          throw new ReservationImpactError(`この変更は既存予約${demand.activeCount}件の${current.category === "treadmill" ? "トレッドミル" : "ベンチ"}枠に影響します。予約が消える可能性があるため、予約を変更してから機材変更してください。`);
        }
      }
      const result = await client.query(
        `UPDATE facility_equipment_models
            SET equipment_name = $1, model_number = $2, quantity = $3, hal_capacity_per_unit = $4, note = $5, updated_at = now()
          WHERE id = $6 AND store_id = $7
          RETURNING id, category, equipment_name, model_number, quantity, hal_capacity_per_unit, note, updated_at`,
        [parsed.data.equipmentName, parsed.data.modelNumber, parsed.data.quantity, parsed.data.halCapacityPerUnit, parsed.data.note, parsed.data.id, DEMO_STORE_ID],
      );
      return result.rows[0];
    });
    return NextResponse.json({ equipment, bookingUpdate });
  } catch (error) {
    if (error instanceof ReservationImpactError) return NextResponse.json({ error: error.message, code: "RESERVATION_IMPACT" }, { status: 409 });
    const pgError = error as { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json({ error: "同じカテゴリーと型番の機材がすでに登録されています。" }, { status: 409 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "機材を更新できませんでした。" }, { status: 500 });
  }
}
