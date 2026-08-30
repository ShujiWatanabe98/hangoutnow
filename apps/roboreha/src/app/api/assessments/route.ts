import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const metricsSchema = z.object({
  walk10mSeconds: z.coerce.number().min(0).max(300),
  gaitSpeed: z.coerce.number().min(0).max(10),
  tugSeconds: z.coerce.number().min(0).max(600),
  bbs: z.coerce.number().int().min(0).max(56),
  chairStand30s: z.coerce.number().int().min(0).max(100),
});
const assessmentSchema = z.object({
  appointmentId: databaseId,
  pre: metricsSchema,
  post: metricsSchema,
  notes: z.string().max(2000).optional().default(""),
});
const notesSchema = z.object({ assessmentId: databaseId, notes: z.string().max(4000) });

const rounded = (value: number) => Math.round(value * 100) / 100;

export async function GET(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "clinical"); if (disabled) return disabled;
  const parsed = databaseId.safeParse(new URL(request.url).searchParams.get("customerId"));
  if (!parsed.success) return NextResponse.json({ error: "利用者IDが正しくありません。" }, { status: 400 });
  try {
    let result = await query<{ pre_metrics: MetricsRecord; post_metrics: MetricsRecord }>(
      `SELECT pre_metrics, post_metrics FROM clinical_assessments
        WHERE customer_id = $1 ORDER BY assessed_at DESC LIMIT 5`, [parsed.data],
    );
    let source = "本人の過去データ";
    if (result.rows.length === 0) {
      result = await query<{ pre_metrics: MetricsRecord; post_metrics: MetricsRecord }>(
        `SELECT ca.pre_metrics, ca.post_metrics FROM clinical_assessments ca
          JOIN customers c ON c.id = ca.customer_id WHERE c.store_id = $1
          ORDER BY ca.assessed_at DESC LIMIT 20`, [DEMO_STORE_ID],
      );
      source = "施設の過去デモデータ（本人履歴なし）";
    }
    const fallback: MetricsRecord = { walk10mSeconds: 18, gaitSpeed: 0.56, tugSeconds: 24, bbs: 38, chairStand30s: 6 };
    const latest = result.rows[0]?.post_metrics ?? fallback;
    const keys = Object.keys(fallback) as Array<keyof MetricsRecord>;
    const predictedPost = { ...latest };
    for (const key of keys) {
      const averageDelta = result.rows.length ? result.rows.reduce((sum, row) => sum + Number(row.post_metrics[key] ?? 0) - Number(row.pre_metrics[key] ?? 0), 0) / result.rows.length : 0;
      const predicted = Math.max(0, Number(latest[key]) + averageDelta);
      predictedPost[key] = key === "bbs" || key === "chairStand30s" ? Math.round(predicted) : rounded(predicted);
    }
    return NextResponse.json({ pre: latest, post: predictedPost, source, sampleCount: result.rows.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "予測値を取得できませんでした。" }, { status: 500 });
  }
}

type MetricsRecord = { walk10mSeconds: number; gaitSpeed: number; tugSeconds: number; bbs: number; chairStand30s: number };

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "clinical"); if (disabled) return disabled;
  const parsed = assessmentSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "評価値を確認してください。" }, { status: 400 });
  const { pre, post } = parsed.data;
  const delta = {
    walk10mSeconds: rounded(post.walk10mSeconds - pre.walk10mSeconds),
    gaitSpeed: rounded(post.gaitSpeed - pre.gaitSpeed),
    tugSeconds: rounded(post.tugSeconds - pre.tugSeconds),
    bbs: rounded(post.bbs - pre.bbs),
    chairStand30s: rounded(post.chairStand30s - pre.chairStand30s),
  };
  const improvements: string[] = [];
  if (delta.walk10mSeconds < 0) improvements.push(`10m歩行時間が${Math.abs(delta.walk10mSeconds)}秒短縮`);
  if (delta.gaitSpeed > 0) improvements.push(`歩行速度が${delta.gaitSpeed}m/s向上`);
  if (delta.tugSeconds < 0) improvements.push(`TUGが${Math.abs(delta.tugSeconds)}秒短縮`);
  if (delta.bbs > 0) improvements.push(`BBSが${delta.bbs}点向上`);
  if (delta.chairStand30s > 0) improvements.push(`30秒立ち上がりが${delta.chairStand30s}回増加`);
  const summary = improvements.length > 0 ? `${improvements.join("、")}しました。` : "使用前後で大きな数値変化はありませんでした。継続して経過を確認します。";

  try {
    const assessment = await transaction(async (client) => {
      const appointment = await client.query<{ customer_id: string; therapist_id: string }>(
        `SELECT customer_id, therapist_id FROM appointments WHERE id = $1 AND store_id = $2 FOR UPDATE`,
        [parsed.data.appointmentId, DEMO_STORE_ID],
      );
      if (!appointment.rows[0]) throw new Error("対象の予約が見つかりません。");
      const result = await client.query(
        `INSERT INTO clinical_assessments
          (appointment_id, customer_id, evaluator_id, pre_metrics, post_metrics, delta_summary, summary_text, notes)
         VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8)
         ON CONFLICT (appointment_id) DO UPDATE SET
           pre_metrics = EXCLUDED.pre_metrics, post_metrics = EXCLUDED.post_metrics,
           delta_summary = EXCLUDED.delta_summary, summary_text = EXCLUDED.summary_text,
           notes = EXCLUDED.notes, evaluator_id = EXCLUDED.evaluator_id,
           assessed_at = now(), updated_at = now()
         RETURNING id, appointment_id, customer_id, pre_metrics, post_metrics,
                   delta_summary, summary_text, notes, assessed_at`,
        [parsed.data.appointmentId, appointment.rows[0].customer_id, appointment.rows[0].therapist_id, JSON.stringify(pre), JSON.stringify(post), JSON.stringify(delta), summary, parsed.data.notes],
      );
      return result.rows[0];
    });
    return NextResponse.json({ assessment });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "評価を保存できませんでした。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "clinical"); if (disabled) return disabled;
  const parsed = notesSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "所見を確認してください。" }, { status: 400 });
  try {
    const result = await query(
      `UPDATE clinical_assessments ca SET notes = $1, updated_at = now()
        FROM customers c WHERE ca.customer_id = c.id AND ca.id = $2 AND c.store_id = $3
        RETURNING ca.id, ca.notes`,
      [parsed.data.notes, parsed.data.assessmentId, DEMO_STORE_ID],
    );
    if (!result.rows[0]) return NextResponse.json({ error: "評価記録が見つかりません。" }, { status: 404 });
    return NextResponse.json({ assessment: result.rows[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "所見を保存できませんでした。" }, { status: 500 });
  }
}
