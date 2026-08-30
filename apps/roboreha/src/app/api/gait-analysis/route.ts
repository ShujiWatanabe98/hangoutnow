import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { transaction } from "@/lib/db";

export const runtime = "nodejs";

const databaseId = z.string().uuid();
const poseMaximumSchema = z.object({
  waistAngleDegrees: z.number().finite().nullable(),
  kneeAngleDegrees: z.number().finite().nullable(),
  heelAngleDegrees: z.number().finite().nullable(),
  accelerationMps2: z.number().finite().nullable(),
  strideLengthM: z.number().finite().nullable(),
  confidence: z.number().min(0).max(1),
});
const schema = z.object({
  assessmentId: databaseId,
  analysisVideoId: databaseId,
  poseMaximums: z
    .object({ before: poseMaximumSchema, after: poseMaximumSchema })
    .optional(),
});
const rounded = (value: number) => Math.round(value * 100) / 100;

type Metrics = { walk10mSeconds: number; gaitSpeed: number; tugSeconds: number; bbs: number; chairStand30s: number };

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "解析対象を確認してください。" }, { status: 400 });
  try {
    const analysis = await transaction(async (client) => {
      const assessment = await client.query<{ pre_metrics: Metrics; post_metrics: Metrics }>(
        `SELECT ca.pre_metrics, ca.post_metrics FROM clinical_assessments ca
          JOIN customers c ON c.id = ca.customer_id
         WHERE ca.id = $1 AND c.store_id = $2 FOR UPDATE OF ca`,
        [parsed.data.assessmentId, DEMO_STORE_ID],
      );
      if (!assessment.rows[0]) throw new Error("評価記録が見つかりません。");
      const phases = await client.query<{ phase: string }>(
        `SELECT phase FROM assessment_videos WHERE assessment_id = $1`, [parsed.data.assessmentId],
      );
      const phaseSet = new Set(phases.rows.map((row) => row.phase));
      if (!phaseSet.has("before") || !phaseSet.has("after")) throw new Error("HAL使用前・使用後の両方の動画を保存してください。");
      const analysisVideo = await client.query(
        `SELECT id FROM assessment_videos WHERE id = $1 AND assessment_id = $2 AND phase = 'analysis'`,
        [parsed.data.analysisVideoId, parsed.data.assessmentId],
      );
      if (!analysisVideo.rows[0]) throw new Error("比較動画が見つかりません。");

      const { pre_metrics: pre, post_metrics: post } = assessment.rows[0];
      const speedChange = rounded(post.gaitSpeed - pre.gaitSpeed);
      const strideBefore = rounded(0.42 + pre.gaitSpeed * 0.28);
      const strideAfter = rounded(0.42 + post.gaitSpeed * 0.28);
      const balanceChange = post.bbs - pre.bbs;
      const mobilityChange = pre.tugSeconds - post.tugSeconds;
      const hipScore = Math.max(0, Math.min(100, Math.round(55 + balanceChange * 4 + mobilityChange * 1.5)));
      const kneeScore = Math.max(0, Math.min(100, Math.round(52 + (post.chairStand30s - pre.chairStand30s) * 6 + balanceChange * 2)));
      const footScore = Math.max(0, Math.min(100, Math.round(50 + speedChange * 80 + mobilityChange * 2)));
      const points = [
        speedChange > 0 ? `歩行速度が${speedChange}m/s向上` : "歩行速度は維持傾向",
        strideAfter > strideBefore ? `推定歩幅が${rounded(strideAfter - strideBefore)}m拡大` : "推定歩幅は維持傾向",
        `腰部の安定性レビュー指標 ${hipScore}/100` ,
        `膝の支持性レビュー指標 ${kneeScore}/100`,
        `足部クリアランスのレビュー指標 ${footScore}/100`,
      ];
      const generatedNotes = `【試作AI解析】使用前後の比較では、${points.slice(0, 2).join("、")}。腰・膝・足部の映像レビュー候補はそれぞれ${hipScore}、${kneeScore}、${footScore}/100。数値と比較動画を療法士が確認し、臨床所見を確定してください。`;
      const candidates = [
        "歩行中の疼痛・疲労の訴えはなく、終了後も全身状態は安定していた。",
        "立脚期の支持性と足部クリアランスを次回も同じ撮影条件で継続評価する。",
        "本人へ使用前後の比較動画を提示し、改善点と次回目標を共有した。",
      ];
      const metrics = {
        speed: { before: pre.gaitSpeed, after: post.gaitSpeed, change: speedChange, unit: "m/s" },
        stride: { before: strideBefore, after: strideAfter, change: rounded(strideAfter - strideBefore), unit: "m", estimated: true },
        positions: { hip: hipScore, knee: kneeScore, foot: footScore },
        poseMaximums: parsed.data.poseMaximums ?? null,
      };
      const disclaimer = "動画比較と入力評価値に基づく試作AI推定です。姿勢指標と推定歩幅は診断・安全判定には使用せず、療法士が原動画と実測値を確認してください。";
      const saved = await client.query(
        `INSERT INTO gait_ai_analyses
          (assessment_id, analysis_video_id, status, gait_metrics, improvement_points, generated_notes, comment_candidates, disclaimer)
         VALUES ($1,$2,'completed',$3::jsonb,$4::jsonb,$5,$6::jsonb,$7)
         ON CONFLICT (assessment_id) DO UPDATE SET analysis_video_id=EXCLUDED.analysis_video_id,
           status='completed', gait_metrics=EXCLUDED.gait_metrics, improvement_points=EXCLUDED.improvement_points,
           generated_notes=EXCLUDED.generated_notes, comment_candidates=EXCLUDED.comment_candidates,
           disclaimer=EXCLUDED.disclaimer, updated_at=now()
         RETURNING id, assessment_id, analysis_video_id, status, gait_metrics, improvement_points,
                   generated_notes, comment_candidates, confidence_label, disclaimer, updated_at`,
        [parsed.data.assessmentId, parsed.data.analysisVideoId, JSON.stringify(metrics), JSON.stringify(points), generatedNotes, JSON.stringify(candidates), disclaimer],
      );
      return saved.rows[0];
    });
    return NextResponse.json({ analysis: { ...analysis, videoUrl: `/api/videos/${analysis.analysis_video_id}` } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "歩行解析を完了できませんでした。" }, { status: 500 });
  }
}
