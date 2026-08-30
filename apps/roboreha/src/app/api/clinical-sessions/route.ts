import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const schema = z.object({ appointmentId: databaseId, action: z.enum(["start", "finish"]), exercise: z.string().trim().max(100).optional() });

export async function GET() {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "clinical"); if (disabled) return disabled;
  const result = await query(
    `SELECT a.id,a.status,a.start_at,a.end_at,a.note,a.hal_unit_id,a.therapist_id,
            c.name AS customer_name,c.primary_condition,p.name AS product_name,h.asset_code AS hal_asset_code,
            st.name AS therapist_name,rs.name AS rehab_space_name,vc.decision AS safety_decision,
            cs.id AS session_id,cs.started_at,cs.ended_at,cs.exercise_log,cs.attachment_config,
            cs.electrode_positions,cs.control_parameters,cs.soap,
            ca.summary_text AS assessment_summary,ca.notes AS assessment_notes,
            br.amount_yen,br.status AS billing_status,br.payment_method
       FROM appointments a JOIN customers c ON c.id=a.customer_id JOIN service_products p ON p.id=a.product_id
       JOIN staff_members st ON st.id=a.therapist_id
       LEFT JOIN hal_units h ON h.id=a.hal_unit_id LEFT JOIN rehabilitation_spaces rs ON rs.id=a.rehab_space_id
       LEFT JOIN clinical_sessions cs ON cs.appointment_id=a.id LEFT JOIN clinical_assessments ca ON ca.appointment_id=a.id
       LEFT JOIN billing_records br ON br.appointment_id=a.id
       LEFT JOIN LATERAL (SELECT decision FROM vital_checks v WHERE v.appointment_id=a.id ORDER BY measured_at DESC LIMIT 1) vc ON true
      WHERE a.store_id=$1 AND a.start_at >= current_date - interval '90 days'
        AND a.status IN ('confirmed','checked_in','in_session','completed')
      ORDER BY CASE WHEN a.start_at>=current_date AND a.start_at<current_date+1 THEN 0 ELSE 1 END,a.start_at DESC`,
    [DEMO_STORE_ID],
  );
  return NextResponse.json({ sessions: result.rows });
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "clinical"); if (disabled) return disabled;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "施術操作を確認してください。" }, { status: 400 });
  try {
    const session = await transaction(async (client) => {
      const appointment = await client.query(
        `SELECT a.*, p.price_yen, vc.decision FROM appointments a JOIN service_products p ON p.id=a.product_id
         LEFT JOIN LATERAL (SELECT decision FROM vital_checks v WHERE v.appointment_id=a.id ORDER BY measured_at DESC LIMIT 1) vc ON true
         WHERE a.id=$1 AND a.store_id=$2 FOR UPDATE OF a`,
        [parsed.data.appointmentId, DEMO_STORE_ID],
      );
      const item = appointment.rows[0];
      if (!item) throw new Error("予約が見つかりません。");
      if (parsed.data.action === "start") {
        if (item.decision !== "allow") throw new Error("安全確認で実施可となった予約だけ開始できます。");
        const result = await client.query(
          `INSERT INTO clinical_sessions (appointment_id, hal_unit_id, operator_id, started_at)
           VALUES ($1,$2,$3,now()) ON CONFLICT (appointment_id) DO UPDATE SET started_at=COALESCE(clinical_sessions.started_at,now()) RETURNING *`,
          [item.id, item.hal_unit_id, item.therapist_id],
        );
        await client.query(`UPDATE appointments SET status='in_session' WHERE id=$1`, [item.id]);
        return result.rows[0];
      }
      const result = await client.query(
        `UPDATE clinical_sessions SET ended_at=now(), exercise_log=$1::jsonb
          WHERE appointment_id=$2 AND started_at IS NOT NULL AND ended_at IS NULL RETURNING *`,
        [JSON.stringify([{ exercise: parsed.data.exercise || "HALトレーニング", completed: true }]), item.id],
      );
      if (!result.rows[0]) throw new Error("開始済みの施術記録が見つかりません。");
      await client.query(`UPDATE appointments SET status='completed' WHERE id=$1`, [item.id]);
      await client.query(`UPDATE hal_units SET usage_count=usage_count+1 WHERE id=$1`, [item.hal_unit_id]);
      await client.query(
        `INSERT INTO billing_records (appointment_id, store_id, customer_id, amount_yen)
         VALUES ($1,$2,$3,$4) ON CONFLICT (appointment_id) DO NOTHING`,
        [item.id, DEMO_STORE_ID, item.customer_id, item.price_yen],
      );
      return result.rows[0];
    });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "施術記録を更新できませんでした。" }, { status: 409 });
  }
}
