import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const paymentMethod = z.enum(["cash", "credit_card", "qr", "ticket"]);
const updateSchema = z.object({
  customerId: databaseId,
  preferredPaymentMethod: paymentMethod,
});
const purchaseSchema = z.object({
  customerId: databaseId,
  productId: databaseId,
  ticketType: z.union([z.literal(5), z.literal(10)]),
  amountYen: z.number().int().nonnegative(),
  paymentMethod: z.enum(["cash", "credit_card", "qr"]),
});

export async function GET(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "customers"); if (disabled) return disabled;
  const id = new URL(request.url).searchParams.get("id");
  try {
    if (!id) {
      const result = await query(
        `SELECT c.id,c.customer_code,c.name,c.name_kana,c.birth_date,c.phone,c.primary_condition,c.goal,c.preferred_payment_method,
                (SELECT count(*)::int FROM appointments a WHERE a.customer_id=c.id AND a.status='completed') AS completed_visits,
                (SELECT max(a.start_at) FROM appointments a WHERE a.customer_id=c.id AND a.status='completed') AS last_visit,
                (SELECT min(a.start_at) FROM appointments a WHERE a.customer_id=c.id AND a.start_at>=now() AND a.status IN ('reserved','confirmed','checked_in','in_session')) AS next_visit,
                COALESCE((SELECT sum(b.amount_yen)::int FROM billing_records b WHERE b.customer_id=c.id AND b.status='paid'),0) AS total_paid_yen,
                COALESCE((SELECT sum(tw.remaining_uses)::int FROM ticket_wallets tw WHERE tw.customer_id=c.id AND tw.expires_on>=current_date),0) AS ticket_remaining
           FROM customers c WHERE c.store_id=$1 AND c.active=true ORDER BY c.name_kana`,
        [DEMO_STORE_ID],
      );
      return NextResponse.json({ customers: result.rows });
    }
    const parsed = databaseId.safeParse(id);
    if (!parsed.success)
      return NextResponse.json(
        { error: "利用者IDが正しくありません。" },
        { status: 400 },
      );
    const [
      customer,
      history,
      assessments,
      physicalFunctionSessions,
      payments,
      ticketPurchases,
      wallets,
      products,
      cautions,
    ] = await Promise.all([
      query(
        `SELECT id,customer_code,name,name_kana,birth_date,phone,email,primary_condition,goal,emergency_contact,preferred_payment_method,created_at FROM customers WHERE id=$1 AND store_id=$2`,
        [parsed.data, DEMO_STORE_ID],
      ),
      query(
        `SELECT a.id,a.start_at,a.end_at,a.status,a.note,p.name AS product_name,st.name AS therapist_name,h.asset_code AS hal_asset_code,rs.name AS rehab_space_name FROM appointments a JOIN service_products p ON p.id=a.product_id JOIN staff_members st ON st.id=a.therapist_id LEFT JOIN hal_units h ON h.id=a.hal_unit_id LEFT JOIN rehabilitation_spaces rs ON rs.id=a.rehab_space_id WHERE a.customer_id=$1 ORDER BY a.start_at DESC LIMIT 50`,
        [parsed.data],
      ),
      query(
        `SELECT ca.id,ca.appointment_id,ca.pre_metrics,ca.post_metrics,ca.delta_summary,ca.summary_text,ca.notes,ca.assessed_at,st.name AS evaluator_name,CASE WHEN ga.id IS NULL THEN NULL ELSE jsonb_build_object('gaitMetrics',ga.gait_metrics,'improvementPoints',ga.improvement_points,'generatedNotes',ga.generated_notes,'commentCandidates',ga.comment_candidates,'confidenceLabel',ga.confidence_label,'disclaimer',ga.disclaimer,'videoUrl','/api/videos/'||ga.analysis_video_id) END AS ai_analysis,COALESCE(jsonb_agg(jsonb_build_object('id',av.id,'phase',av.phase,'mimeType',av.mime_type,'url','/api/videos/'||av.id)) FILTER (WHERE av.id IS NOT NULL),'[]'::jsonb) AS videos FROM clinical_assessments ca JOIN staff_members st ON st.id=ca.evaluator_id LEFT JOIN assessment_videos av ON av.assessment_id=ca.id LEFT JOIN gait_ai_analyses ga ON ga.assessment_id=ca.id WHERE ca.customer_id=$1 GROUP BY ca.id,st.name,ga.id ORDER BY ca.assessed_at DESC`,
        [parsed.data],
      ),
      query(
        `SELECT pfs.id,pfs.appointment_id,pfs.status,pfs.capture_condition,pfs.hal_size,
                pfs.assistance_level,pfs.assistive_device,pfs.walking_distance_m,pfs.camera_view,
                pfs.notes,pfs.clinician_summary,pfs.recorded_at,st.name AS evaluator_name,
                h.asset_code AS hal_asset_code,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('code',m.measurement_code,
                  'side',m.side,'value',m.value,'unit',m.unit,'source',m.source,'confidence',m.confidence)
                  ORDER BY m.measurement_code,m.side) FROM physical_function_measurements m
                  WHERE m.session_id=pfs.id),'[]'::jsonb) AS measurements,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('id',v.id,'phase',v.phase,
                  'testCode',v.test_code,'url','/api/physical-function/videos/'||v.id)
                  ORDER BY v.created_at) FROM physical_function_videos v
                  WHERE v.session_id=pfs.id),'[]'::jsonb) AS videos,
                (SELECT jsonb_build_object('status',j.status,'patientTrackId',j.patient_track_id,
                  'helperTrackIds',j.helper_track_ids,'qualityFlags',j.quality_flags,
                  'walkingTimeSeconds',g.walking_time_seconds,'walkingSpeedMps',g.walking_speed_mps,
                  'stepCount',g.step_count,'cadenceSpm',g.cadence_spm,
                  'leftStepLengthM',g.left_step_length_m,'rightStepLengthM',g.right_step_length_m,
                  'symmetryPercent',g.symmetry_percent,'trunkLeanDegrees',g.trunk_lean_degrees,
                  'helperOverlapPercent',g.helper_overlap_percent,'confidence',g.confidence)
                 FROM motion_analysis_jobs j JOIN gait_analysis_results g ON g.job_id=j.id
                 WHERE j.session_id=pfs.id ORDER BY j.created_at DESC LIMIT 1) AS analysis,
                (SELECT jsonb_build_object('summary',r.summary,'improvementPoints',r.improvement_points,
                  'commentCandidates',r.comment_candidates,'disclaimer',r.disclaimer)
                 FROM physical_function_reports r WHERE r.session_id=pfs.id) AS report
           FROM physical_function_sessions pfs
           JOIN staff_members st ON st.id=pfs.evaluator_id
           LEFT JOIN hal_units h ON h.id=pfs.hal_unit_id
          WHERE pfs.customer_id=$1 ORDER BY pfs.recorded_at DESC`,
        [parsed.data],
      ),
      query(
        `SELECT b.id,b.amount_yen,b.payment_method,b.status,b.paid_at,p.name AS product_name,a.start_at FROM billing_records b JOIN appointments a ON a.id=b.appointment_id JOIN service_products p ON p.id=a.product_id WHERE b.customer_id=$1 ORDER BY COALESCE(b.paid_at,b.created_at) DESC LIMIT 100`,
        [parsed.data],
      ),
      query(
        `SELECT tph.id,tph.ticket_type,tph.purchased_uses,tph.amount_yen,tph.payment_method,tph.purchased_at,tph.expires_on,tph.status,p.name AS product_name FROM ticket_purchase_history tph JOIN service_products p ON p.id=tph.product_id WHERE tph.customer_id=$1 ORDER BY tph.purchased_at DESC`,
        [parsed.data],
      ),
      query(
        `SELECT tw.id,tw.product_id,tw.remaining_uses,tw.expires_on,p.name AS product_name FROM ticket_wallets tw JOIN service_products p ON p.id=tw.product_id WHERE tw.customer_id=$1 ORDER BY tw.expires_on`,
        [parsed.data],
      ),
      query(
        `SELECT id,name,price_yen FROM service_products WHERE store_id=$1 AND active=true ORDER BY name`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT id,severity,category,title,detail,response_note AS "responseNote",created_at
           FROM customer_cautions
          WHERE customer_id=$1 AND store_id=$2 AND active=true
          ORDER BY CASE severity WHEN 'high' THEN 0 ELSE 1 END,created_at`,
        [parsed.data, DEMO_STORE_ID],
      ),
    ]);
    if (!customer.rows[0])
      return NextResponse.json(
        { error: "利用者が見つかりません。" },
        { status: 404 },
      );
    const paid = payments.rows.filter((item) => item.status === "paid");
    return NextResponse.json({
      customer: customer.rows[0],
      history: history.rows,
      assessments: assessments.rows,
      physicalFunctionSessions: physicalFunctionSessions.rows,
      payments: payments.rows,
      ticketPurchases: ticketPurchases.rows,
      wallets: wallets.rows,
      products: products.rows,
      cautions: cautions.rows,
      paymentSummary: {
        totalPaidYen: paid.reduce(
          (sum, item) => sum + Number(item.amount_yen),
          0,
        ),
        paidCount: paid.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "利用者情報を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "customers"); if (disabled) return disabled;
  try {
    const body = updateSchema.parse(await request.json());
    const result = await query(
      `UPDATE customers SET preferred_payment_method=$1 WHERE id=$2 AND store_id=$3 RETURNING id,preferred_payment_method`,
      [body.preferredPaymentMethod, body.customerId, DEMO_STORE_ID],
    );
    if (!result.rows[0])
      return NextResponse.json(
        { error: "利用者が見つかりません。" },
        { status: 404 },
      );
    return NextResponse.json({ customer: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "支払い方法を確認してください。"
            : error instanceof Error
              ? error.message
              : "保存できませんでした。",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "customers"); if (disabled) return disabled;
  try {
    const body = purchaseSchema.parse(await request.json());
    const purchase = await transaction(async (client) => {
      const valid = await client.query(
        `SELECT c.id FROM customers c JOIN service_products p ON p.store_id=c.store_id WHERE c.id=$1 AND c.store_id=$2 AND c.active=true AND p.id=$3 AND p.active=true`,
        [body.customerId, DEMO_STORE_ID, body.productId],
      );
      if (!valid.rows[0])
        throw new Error("利用者またはコースが見つかりません。");
      const expiresOn = new Date();
      expiresOn.setMonth(expiresOn.getMonth() + 6);
      const expires = expiresOn.toISOString().slice(0, 10);
      const inserted = await client.query(
        `INSERT INTO ticket_purchase_history (customer_id,store_id,product_id,ticket_type,purchased_uses,amount_yen,payment_method,expires_on) VALUES ($1,$2,$3,$4,$4,$5,$6,$7) RETURNING *`,
        [
          body.customerId,
          DEMO_STORE_ID,
          body.productId,
          body.ticketType,
          body.amountYen,
          body.paymentMethod,
          expires,
        ],
      );
      await client.query(
        `INSERT INTO ticket_wallets (customer_id,product_id,remaining_uses,expires_on) VALUES ($1,$2,$3,$4) ON CONFLICT (customer_id,product_id) DO UPDATE SET remaining_uses=ticket_wallets.remaining_uses+EXCLUDED.remaining_uses,expires_on=greatest(ticket_wallets.expires_on,EXCLUDED.expires_on)`,
        [body.customerId, body.productId, body.ticketType, expires],
      );
      await client.query(
        `UPDATE customers SET preferred_payment_method='ticket' WHERE id=$1`,
        [body.customerId],
      );
      return inserted.rows[0];
    });
    return NextResponse.json({ purchase }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "回数券の購入内容を確認してください。"
            : error instanceof Error
              ? error.message
              : "回数券を登録できませんでした。",
      },
      { status: 400 },
    );
  }
}
