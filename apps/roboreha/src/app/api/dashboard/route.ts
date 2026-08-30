import { NextResponse } from "next/server";
import { DEMO_CUSTOMER_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";
import { resolveStoreFeatureAccess } from "@/lib/store-features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [
      customer,
      tickets,
      nextAppointment,
      history,
      store,
      appointments,
      devices,
      equipmentModels,
      staff,
      products,
      safetyRule,
    ] = await Promise.all([
      query(
        `SELECT c.id, c.customer_code, c.name, c.name_kana, c.primary_condition, c.goal,
                  s.name AS store_name, s.phone AS store_phone
             FROM customers c JOIN stores s ON s.id = c.store_id WHERE c.id = $1`,
        [DEMO_CUSTOMER_ID],
      ),
      query(
        `SELECT tw.remaining_uses, tw.expires_on, p.name AS product_name
             FROM ticket_wallets tw JOIN service_products p ON p.id = tw.product_id
            WHERE tw.customer_id = $1 ORDER BY tw.expires_on`,
        [DEMO_CUSTOMER_ID],
      ),
      query(
        `SELECT a.id, a.start_at, a.end_at, a.status, p.name AS product_name,
                  st.name AS therapist_name, h.asset_code AS hal_asset_code, h.model_number
             FROM appointments a
             JOIN service_products p ON p.id = a.product_id
             JOIN staff_members st ON st.id = a.therapist_id
             LEFT JOIN hal_units h ON h.id = a.hal_unit_id
            WHERE a.customer_id = $1 AND a.start_at >= now()
              AND a.status IN ('reserved','confirmed','checked_in','in_session')
            ORDER BY a.start_at LIMIT 1`,
        [DEMO_CUSTOMER_ID],
      ),
      query(
        `SELECT a.id, a.start_at, a.status, p.name AS product_name, st.name AS therapist_name
             FROM appointments a
             JOIN service_products p ON p.id = a.product_id
             JOIN staff_members st ON st.id = a.therapist_id
            WHERE a.customer_id = $1 AND a.start_at < now()
            ORDER BY a.start_at DESC LIMIT 3`,
        [DEMO_CUSTOMER_ID],
      ),
      query(`SELECT id, name, address, phone, feature_flags FROM stores WHERE id = $1`, [
        DEMO_STORE_ID,
      ]),
      query(
        `SELECT a.id, a.customer_id, a.start_at, a.end_at, a.status, a.note, c.name AS customer_name,
                  c.primary_condition, p.name AS product_name, st.name AS therapist_name,
                  h.asset_code AS hal_asset_code, h.model_type,
                  vc.systolic, vc.diastolic, vc.pulse, vc.temperature, vc.decision AS safety_decision,
                  COALESCE(cc.cautions,'[]'::jsonb) AS cautions
             FROM appointments a
             JOIN customers c ON c.id = a.customer_id
             JOIN service_products p ON p.id = a.product_id
             JOIN staff_members st ON st.id = a.therapist_id
             LEFT JOIN hal_units h ON h.id = a.hal_unit_id
             LEFT JOIN LATERAL (
               SELECT * FROM vital_checks v WHERE v.appointment_id = a.id ORDER BY measured_at DESC LIMIT 1
             ) vc ON true
             LEFT JOIN LATERAL (
               SELECT jsonb_agg(jsonb_build_object(
                 'id',x.id,'severity',x.severity,'category',x.category,'title',x.title,
                 'detail',x.detail,'responseNote',x.response_note
               ) ORDER BY CASE x.severity WHEN 'high' THEN 0 ELSE 1 END,x.created_at) AS cautions
                 FROM customer_cautions x
                WHERE x.customer_id=c.id AND x.store_id=$1 AND x.active=true
             ) cc ON true
            WHERE a.store_id = $1
              AND a.status <> 'cancelled'
              AND a.start_at >= current_date::timestamp
              AND a.start_at < (current_date + 1)::timestamp
            ORDER BY a.start_at`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT id, asset_code, serial_number, product_class, model_type, model_number,
                  size_label, body_part, image_url, image_source_url, laterality, status, usage_count, last_inspected_at
             FROM hal_units WHERE store_id = $1 ORDER BY asset_code`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT id, category, equipment_name, model_number, quantity, hal_capacity_per_unit, note, updated_at
             FROM facility_equipment_models WHERE store_id = $1
            ORDER BY CASE category WHEN 'hal' THEN 1 WHEN 'treadmill' THEN 2 ELSE 3 END,
                     equipment_name, model_number`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT id, name, role, qualification FROM staff_members
            WHERE store_id = $1 AND active = true ORDER BY employee_code`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT id, name, duration_minutes, price_yen, required_model_type
             FROM service_products WHERE store_id = $1 AND active = true ORDER BY duration_minutes DESC`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT name, source_note FROM safety_rule_sets
            WHERE store_id = $1 AND active = true ORDER BY effective_from DESC LIMIT 1`,
        [DEMO_STORE_ID],
      ),
    ]);

    const tomorrowSlots = [13, 15, 10].map((hour, index) => {
      const date = new Date();
      date.setDate(date.getDate() + (index === 2 ? 2 : 1));
      date.setHours(hour, index === 0 ? 30 : 0, 0, 0);
      return {
        startAt: date.toISOString(),
        therapistId:
          index === 1
            ? "20000000-0000-0000-0000-000000000002"
            : "20000000-0000-0000-0000-000000000001",
        therapistName: index === 1 ? "佐藤 美咲" : "山田 直樹",
        halUnitId: "40000000-0000-0000-0000-000000000001",
        halAssetCode: "HAL-L01",
        productId: "50000000-0000-0000-0000-000000000001",
        durationMinutes: 90,
      };
    });

    const todayRows = appointments.rows as Array<{
      status: string;
      safety_decision: string | null;
    }>;
    const stopCount = todayRows.filter(
      (item) => item.safety_decision === "stop",
    ).length;
    const featureAccess = resolveStoreFeatureAccess(store.rows[0]?.feature_flags);

    return NextResponse.json({
      features: featureAccess,
      customer: customer.rows[0],
      tickets: tickets.rows,
      nextAppointment: nextAppointment.rows[0] ?? null,
      history: history.rows,
      availableSlots: tomorrowSlots,
      facility: {
        store: store.rows[0],
        appointments: appointments.rows,
        devices: devices.rows,
        equipmentModels: equipmentModels.rows,
        staff: staff.rows,
        products: products.rows,
        safetyRule: safetyRule.rows[0],
        summary: {
          total: todayRows.length,
          waiting: todayRows.filter((item) => item.status === "confirmed")
            .length,
          checkedIn: todayRows.filter((item) => item.status === "checked_in")
            .length,
          stopAlerts: stopCount,
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "ダッシュボードを読み込めませんでした。",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
