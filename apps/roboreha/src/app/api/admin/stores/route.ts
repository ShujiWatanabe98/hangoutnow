import { NextResponse } from "next/server";
import { z } from "zod";
import { query } from "@/lib/db";
import { DEFAULT_STORE_FEATURE_FLAGS } from "@/lib/store-features";

export const runtime = "nodejs";
const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const featureFlags = z.object({ appointments: z.boolean(), customers: z.boolean(), messages: z.boolean(), intake: z.boolean(), equipment: z.boolean(), physical: z.boolean(), clinical: z.boolean(), billing: z.boolean(), staff: z.boolean() });
const fields = { code: z.string().trim().min(2).max(30), name: z.string().trim().min(1).max(100), address: z.string().trim().min(1).max(200), phone: z.string().trim().min(1).max(30), managerName: z.string().trim().max(80).optional().default(""), contactEmail: z.string().email().or(z.literal("")), visitEnabled: z.boolean(), status: z.enum(["active", "preparing", "suspended"]), featureFlags: featureFlags.optional().default(DEFAULT_STORE_FEATURE_FLAGS) };

export async function GET(request: Request) {
  const storeId = new URL(request.url).searchParams.get("id");
  if (!storeId) {
    const result = await query(`SELECT s.*,count(DISTINCT st.id) FILTER(WHERE st.active)::int AS staff_count,count(DISTINCT c.id) FILTER(WHERE c.active)::int AS customer_count,count(DISTINCT h.id) FILTER(WHERE h.status<>'retired')::int AS hal_count FROM stores s LEFT JOIN staff_members st ON st.store_id=s.id LEFT JOIN customers c ON c.store_id=s.id LEFT JOIN hal_units h ON h.store_id=s.id GROUP BY s.id ORDER BY s.code`);
    return NextResponse.json({ stores: result.rows });
  }
  const parsed = databaseId.safeParse(storeId);
  if (!parsed.success) return NextResponse.json({ error: "センターIDが正しくありません。" }, { status: 400 });

  const [store, equipment, halUnits, operations, outcomes, products, customers, attendance] = await Promise.all([
    query(`SELECT * FROM stores WHERE id=$1`, [storeId]),
    query(`SELECT category,equipment_name,model_number,quantity,hal_capacity_per_unit,note FROM facility_equipment_models WHERE store_id=$1 ORDER BY CASE category WHEN 'hal' THEN 0 WHEN 'treadmill' THEN 1 ELSE 2 END,equipment_name`, [storeId]),
    query(`SELECT asset_code,model_type,model_number,size_label,status,usage_count,last_inspected_at FROM hal_units WHERE store_id=$1 ORDER BY asset_code`, [storeId]),
    query(`SELECT count(*) FILTER(WHERE a.status='completed')::int AS completed_sessions,
                  COALESCE(round(sum(EXTRACT(EPOCH FROM (cs.ended_at-cs.started_at))/60) FILTER(WHERE cs.ended_at IS NOT NULL))::int,0) AS total_minutes,
                  COALESCE(round(avg(EXTRACT(EPOCH FROM (cs.ended_at-cs.started_at))/60) FILTER(WHERE cs.ended_at IS NOT NULL))::int,0) AS average_minutes,
                  COALESCE(sum(br.amount_yen) FILTER(WHERE br.status='paid'),0)::int AS paid_sales
             FROM appointments a LEFT JOIN clinical_sessions cs ON cs.appointment_id=a.id LEFT JOIN billing_records br ON br.appointment_id=a.id WHERE a.store_id=$1`, [storeId]),
    query(`SELECT count(*)::int AS assessment_count,
                  count(*) FILTER(WHERE
                    COALESCE((ca.post_metrics->>'gaitSpeed')::numeric,0)>COALESCE((ca.pre_metrics->>'gaitSpeed')::numeric,0) OR
                    COALESCE((ca.post_metrics->>'walk10mSeconds')::numeric,999)<COALESCE((ca.pre_metrics->>'walk10mSeconds')::numeric,999) OR
                    COALESCE((ca.post_metrics->>'tugSeconds')::numeric,999)<COALESCE((ca.pre_metrics->>'tugSeconds')::numeric,999) OR
                    COALESCE((ca.post_metrics->>'bbs')::numeric,0)>COALESCE((ca.pre_metrics->>'bbs')::numeric,0)
                  )::int AS improved_assessments,
                  round(avg(((ca.post_metrics->>'gaitSpeed')::numeric-(ca.pre_metrics->>'gaitSpeed')::numeric)/NULLIF((ca.pre_metrics->>'gaitSpeed')::numeric,0)*100),1) AS gait_speed_change,
                  round(avg(((ca.pre_metrics->>'walk10mSeconds')::numeric-(ca.post_metrics->>'walk10mSeconds')::numeric)/NULLIF((ca.pre_metrics->>'walk10mSeconds')::numeric,0)*100),1) AS walk10m_change,
                  round(avg(((ca.pre_metrics->>'tugSeconds')::numeric-(ca.post_metrics->>'tugSeconds')::numeric)/NULLIF((ca.pre_metrics->>'tugSeconds')::numeric,0)*100),1) AS tug_change,
                  round(avg(((ca.post_metrics->>'bbs')::numeric-(ca.pre_metrics->>'bbs')::numeric)/NULLIF((ca.pre_metrics->>'bbs')::numeric,0)*100),1) AS bbs_change,
                  round(avg(((ca.post_metrics->>'chairStand30s')::numeric-(ca.pre_metrics->>'chairStand30s')::numeric)/NULLIF((ca.pre_metrics->>'chairStand30s')::numeric,0)*100),1) AS chair_stand_change
             FROM clinical_assessments ca JOIN appointments a ON a.id=ca.appointment_id WHERE a.store_id=$1`, [storeId]),
    query(`SELECT p.name,count(*) FILTER(WHERE a.status='completed')::int AS sessions,COALESCE(round(sum(EXTRACT(EPOCH FROM (cs.ended_at-cs.started_at))/60) FILTER(WHERE cs.ended_at IS NOT NULL))::int,0) AS minutes FROM service_products p LEFT JOIN appointments a ON a.product_id=p.id LEFT JOIN clinical_sessions cs ON cs.appointment_id=a.id WHERE p.store_id=$1 GROUP BY p.id,p.name ORDER BY sessions DESC,p.name`, [storeId]),
    query(`SELECT count(*) FILTER(WHERE active)::int AS active_customers FROM customers WHERE store_id=$1`, [storeId]),
    query(`SELECT count(*) FILTER(WHERE clock_out IS NOT NULL)::int AS attendance_days,COALESCE(round(sum(EXTRACT(EPOCH FROM (clock_out-clock_in))/3600-break_minutes/60.0) FILTER(WHERE clock_out IS NOT NULL),1),0) AS staff_hours FROM attendance_records WHERE store_id=$1 AND work_date>=current_date-30`, [storeId]),
  ]);
  if (!store.rows[0]) return NextResponse.json({ error: "センターが見つかりません。" }, { status: 404 });
  const outcome = outcomes.rows[0];
  const assessmentCount = Number(outcome.assessment_count ?? 0);
  const improved = Number(outcome.improved_assessments ?? 0);
  return NextResponse.json({
    detail: {
      store: store.rows[0],
      equipment: equipment.rows,
      halUnits: halUnits.rows,
      operations: { ...operations.rows[0], active_customers: customers.rows[0].active_customers, attendance_days: attendance.rows[0].attendance_days, staff_hours: attendance.rows[0].staff_hours },
      outcomes: {
        assessmentCount,
        improvedAssessments: improved,
        improvementRate: assessmentCount ? Math.round((improved / assessmentCount) * 1000) / 10 : 0,
        metrics: [
          { label: "歩行速度", value: Number(outcome.gait_speed_change ?? 0), unit: "%", direction: "増加を改善として集計" },
          { label: "10m歩行時間", value: Number(outcome.walk10m_change ?? 0), unit: "%", direction: "短縮を改善として集計" },
          { label: "TUG", value: Number(outcome.tug_change ?? 0), unit: "%", direction: "短縮を改善として集計" },
          { label: "BBS", value: Number(outcome.bbs_change ?? 0), unit: "%", direction: "増加を改善として集計" },
          { label: "30秒立ち上がり", value: Number(outcome.chair_stand_change ?? 0), unit: "%", direction: "増加を改善として集計" },
        ],
      },
      products: products.rows,
      definition: "改善割合は、保存済み評価で歩行速度・10m歩行時間・TUG・BBSのいずれかが使用前後で改善した記録の割合です。医学的有効性を示す指標ではありません。",
    },
  });
}

export async function POST(request: Request) {
  const parsed = z.object(fields).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "拠点情報を確認してください。" }, { status: 400 });
  const data = parsed.data;
  try {
    const result = await query(`INSERT INTO stores(code,name,address,phone,manager_name,contact_email,visit_enabled,status,feature_flags) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING *`, [data.code, data.name, data.address, data.phone, data.managerName, data.contactEmail, data.visitEnabled, data.status, JSON.stringify(data.featureFlags)]);
    return NextResponse.json({ store: result.rows[0] }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: (error as { code?: string }).code === "23505" ? "同じ拠点コードが登録されています。" : "拠点を登録できませんでした。" }, { status: 409 }); }
}

export async function PATCH(request: Request) {
  const parsed = z.object({ id: databaseId, ...fields }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "拠点情報を確認してください。" }, { status: 400 });
  const data = parsed.data;
  const result = await query(`UPDATE stores SET code=$1,name=$2,address=$3,phone=$4,manager_name=$5,contact_email=$6,visit_enabled=$7,status=$8,feature_flags=$9::jsonb WHERE id=$10 RETURNING *`, [data.code, data.name, data.address, data.phone, data.managerName, data.contactEmail, data.visitEnabled, data.status, JSON.stringify(data.featureFlags), data.id]);
  return NextResponse.json({ store: result.rows[0] });
}
