import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_RECEPTION_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const paymentSchema = z.object({
  billingId: databaseId,
  paymentMethod: z.enum(["cash", "credit_card", "qr", "ticket"]),
  confirmed: z.literal(true),
});

export async function GET() {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "billing"); if (disabled) return disabled;
  try {
    await query(
      `INSERT INTO billing_records (appointment_id, store_id, customer_id, amount_yen)
       SELECT a.id, a.store_id, a.customer_id, p.price_yen
         FROM appointments a
         JOIN clinical_sessions cs ON cs.appointment_id = a.id AND cs.started_at IS NOT NULL AND cs.ended_at IS NOT NULL
         JOIN service_products p ON p.id = a.product_id
        WHERE a.store_id = $1 AND a.status = 'completed'
       ON CONFLICT (appointment_id) DO NOTHING`,
      [DEMO_STORE_ID],
    );
    const [records, summary, trend, periodBounds, dayPaymentMethods] = await Promise.all([
      query(
        `SELECT br.id, br.appointment_id, br.amount_yen, br.status, br.payment_method, br.paid_at,
                a.start_at, a.end_at, c.name AS customer_name, p.name AS product_name,
                st.name AS therapist_name, h.asset_code AS hal_asset_code,
                cs.started_at, cs.ended_at, cs.exercise_log, cs.soap
           FROM billing_records br
           JOIN appointments a ON a.id = br.appointment_id
           JOIN customers c ON c.id = br.customer_id
           JOIN service_products p ON p.id = a.product_id
           JOIN staff_members st ON st.id = a.therapist_id
           LEFT JOIN hal_units h ON h.id = a.hal_unit_id
           JOIN clinical_sessions cs ON cs.appointment_id = a.id AND cs.ended_at IS NOT NULL
          WHERE br.store_id = $1 AND br.status <> 'void'
          ORDER BY CASE WHEN br.status = 'pending' THEN 0 ELSE 1 END, cs.ended_at DESC
          LIMIT 80`,
        [DEMO_STORE_ID],
      ),
      query(
        `WITH bounds AS (SELECT now() AT TIME ZONE 'Asia/Tokyo' AS local_now)
         SELECT
           COALESCE(sum(amount_yen) FILTER (WHERE status='paid' AND paid_at >= date_trunc('day', local_now) AT TIME ZONE 'Asia/Tokyo' AND paid_at < (date_trunc('day', local_now)+interval '1 day') AT TIME ZONE 'Asia/Tokyo'),0)::int AS day,
           COALESCE(sum(amount_yen) FILTER (WHERE status='paid' AND paid_at >= date_trunc('week', local_now) AT TIME ZONE 'Asia/Tokyo' AND paid_at < (date_trunc('week', local_now)+interval '1 week') AT TIME ZONE 'Asia/Tokyo'),0)::int AS week,
           COALESCE(sum(amount_yen) FILTER (WHERE status='paid' AND paid_at >= date_trunc('month', local_now) AT TIME ZONE 'Asia/Tokyo' AND paid_at < (date_trunc('month', local_now)+interval '1 month') AT TIME ZONE 'Asia/Tokyo'),0)::int AS month,
           COALESCE(sum(amount_yen) FILTER (WHERE status='paid' AND paid_at >= date_trunc('year', local_now) AT TIME ZONE 'Asia/Tokyo' AND paid_at < (date_trunc('year', local_now)+interval '1 year') AT TIME ZONE 'Asia/Tokyo'),0)::int AS year,
           count(*) FILTER (WHERE status='pending')::int AS pending_count,
           COALESCE(sum(amount_yen) FILTER (WHERE status='pending'),0)::int AS pending_amount
         FROM billing_records CROSS JOIN bounds WHERE store_id=$1`,
        [DEMO_STORE_ID],
      ),
      query(
        `SELECT to_char(date_trunc('month', paid_at AT TIME ZONE 'Asia/Tokyo'), 'YYYY-MM') AS label,
                sum(amount_yen)::int AS amount, count(*)::int AS count
           FROM billing_records
          WHERE store_id=$1 AND status='paid' AND paid_at >= now() - interval '12 months'
          GROUP BY 1 ORDER BY 1`,
        [DEMO_STORE_ID],
      ),
      query<{ day_start: string; day_end: string; week_start: string; week_end: string; month_start: string; month_end: string; year_start: string; year_end: string }>(
        `WITH bounds AS (SELECT (now() AT TIME ZONE 'Asia/Tokyo')::date AS today)
         SELECT today::text AS day_start,today::text AS day_end,
                date_trunc('week',today)::date::text AS week_start,(date_trunc('week',today)::date+6)::text AS week_end,
                date_trunc('month',today)::date::text AS month_start,(date_trunc('month',today)+interval '1 month'-interval '1 day')::date::text AS month_end,
                date_trunc('year',today)::date::text AS year_start,(date_trunc('year',today)+interval '1 year'-interval '1 day')::date::text AS year_end
           FROM bounds`,
      ),
      query<{ payment_method: string; amount: number; count: number }>(
        `WITH bounds AS (SELECT date_trunc('day',now() AT TIME ZONE 'Asia/Tokyo') AS day_start)
         SELECT payment_method,COALESCE(sum(amount_yen),0)::int AS amount,count(*)::int AS count
           FROM billing_records CROSS JOIN bounds
          WHERE store_id=$1 AND status='paid'
            AND paid_at >= day_start AT TIME ZONE 'Asia/Tokyo'
            AND paid_at < (day_start+interval '1 day') AT TIME ZONE 'Asia/Tokyo'
          GROUP BY payment_method ORDER BY payment_method`,
        [DEMO_STORE_ID],
      ),
    ]);
    const bounds = periodBounds.rows[0];
    return NextResponse.json({
      records: records.rows,
      summary: summary.rows[0],
      trend: trend.rows,
      periods: {
        day: { start: bounds.day_start, end: bounds.day_end },
        week: { start: bounds.week_start, end: bounds.week_end },
        month: { start: bounds.month_start, end: bounds.month_end },
        year: { start: bounds.year_start, end: bounds.year_end },
      },
      dayPaymentMethods: dayPaymentMethods.rows,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "会計データを取得できませんでした。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "billing"); if (disabled) return disabled;
  const parsed = paymentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "支払い方法と確認状態を指定してください。" }, { status: 400 });
  try {
    const record = await transaction(async (client) => {
      const result = await client.query(
        `UPDATE billing_records SET status='paid', payment_method=$1, confirmed_by=$2, paid_at=now(), updated_at=now()
          WHERE id=$3 AND store_id=$4 AND status='pending' RETURNING *`,
        [parsed.data.paymentMethod, DEMO_RECEPTION_ID, parsed.data.billingId, DEMO_STORE_ID],
      );
      if (!result.rows[0]) throw new Error("支払い確認待ちの会計が見つかりません。");
      return result.rows[0];
    });
    return NextResponse.json({ record });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "支払いを確定できませんでした。" }, { status: 409 });
  }
}
