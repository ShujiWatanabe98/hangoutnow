import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { transaction } from "@/lib/db";

export const runtime = "nodejs";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const finiteNullable = z.number().finite().nullable();
const schema = z.object({
  sessionId: databaseId,
  videoId: databaseId,
  engineVersion: z.string().min(1).max(100),
  patientTrackId: z.string().min(1).max(80),
  helperTrackIds: z.array(z.string().max(80)).max(10),
  poseSummary: z.record(z.string(), z.unknown()),
  qualityFlags: z.array(z.string().max(300)).max(30),
  metrics: z.object({
    walkingTimeSeconds: finiteNullable,
    walkingSpeedMps: finiteNullable,
    stepCount: z.number().int().nonnegative().nullable(),
    cadenceSpm: finiteNullable,
    leftStepLengthM: finiteNullable,
    rightStepLengthM: finiteNullable,
    symmetryPercent: finiteNullable,
    trunkLeanDegrees: finiteNullable,
    leftKneeFlexionDegrees: finiteNullable,
    rightKneeFlexionDegrees: finiteNullable,
    helperOverlapPercent: finiteNullable,
    confidence: z.number().min(0).max(1),
  }),
});

const rounded = (value: number | null) => value == null ? null : Math.round(value * 100) / 100;

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "解析結果を確認してください。" }, { status: 400 });
  try {
    const response = await transaction(async (client) => {
      const session = await client.query<{ evaluator_id: string; capture_condition: string; assistance_level: string; walking_distance_m: number }>(
        `SELECT evaluator_id,capture_condition,assistance_level,walking_distance_m
           FROM physical_function_sessions WHERE id=$1 AND store_id=$2 FOR UPDATE`,
        [parsed.data.sessionId, DEMO_STORE_ID],
      );
      if (!session.rows[0]) throw new Error("身体機能記録が見つかりません。");
      const video = await client.query(`SELECT id FROM physical_function_videos WHERE id=$1 AND session_id=$2`, [parsed.data.videoId, parsed.data.sessionId]);
      if (!video.rows[0]) throw new Error("解析対象動画が見つかりません。");
      const status = parsed.data.qualityFlags.length > 0 || parsed.data.metrics.confidence < 0.7 ? "needs_review" : "completed";
      const job = await client.query(
        `INSERT INTO motion_analysis_jobs
          (session_id,video_id,engine_version,status,patient_track_id,helper_track_ids,pose_summary,quality_flags)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb)
         ON CONFLICT (video_id,engine_version) DO UPDATE SET status=EXCLUDED.status,
           patient_track_id=EXCLUDED.patient_track_id,helper_track_ids=EXCLUDED.helper_track_ids,
           pose_summary=EXCLUDED.pose_summary,quality_flags=EXCLUDED.quality_flags,error_message=NULL,updated_at=now()
         RETURNING *`,
        [parsed.data.sessionId, parsed.data.videoId, parsed.data.engineVersion, status,
          parsed.data.patientTrackId, JSON.stringify(parsed.data.helperTrackIds),
          JSON.stringify(parsed.data.poseSummary), JSON.stringify(parsed.data.qualityFlags)],
      );
      const m = parsed.data.metrics;
      const result = await client.query(
        `INSERT INTO gait_analysis_results
          (job_id,session_id,walking_time_seconds,walking_speed_mps,step_count,cadence_spm,
           left_step_length_m,right_step_length_m,symmetry_percent,trunk_lean_degrees,
           left_knee_flexion_degrees,right_knee_flexion_degrees,helper_overlap_percent,confidence,raw_metrics)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb)
         ON CONFLICT (job_id) DO UPDATE SET walking_time_seconds=EXCLUDED.walking_time_seconds,
           walking_speed_mps=EXCLUDED.walking_speed_mps,step_count=EXCLUDED.step_count,
           cadence_spm=EXCLUDED.cadence_spm,left_step_length_m=EXCLUDED.left_step_length_m,
           right_step_length_m=EXCLUDED.right_step_length_m,symmetry_percent=EXCLUDED.symmetry_percent,
           trunk_lean_degrees=EXCLUDED.trunk_lean_degrees,
           left_knee_flexion_degrees=EXCLUDED.left_knee_flexion_degrees,
           right_knee_flexion_degrees=EXCLUDED.right_knee_flexion_degrees,
           helper_overlap_percent=EXCLUDED.helper_overlap_percent,confidence=EXCLUDED.confidence,
           raw_metrics=EXCLUDED.raw_metrics,clinician_reviewed=false,reviewed_by=NULL,reviewed_at=NULL,updated_at=now()
         RETURNING *`,
        [job.rows[0].id, parsed.data.sessionId, rounded(m.walkingTimeSeconds), rounded(m.walkingSpeedMps),
          m.stepCount, rounded(m.cadenceSpm), rounded(m.leftStepLengthM), rounded(m.rightStepLengthM),
          rounded(m.symmetryPercent), rounded(m.trunkLeanDegrees), rounded(m.leftKneeFlexionDegrees),
          rounded(m.rightKneeFlexionDegrees), rounded(m.helperOverlapPercent), m.confidence,
          JSON.stringify(m)],
      );
      const aiMeasurements = [
        ["walk_time", m.walkingTimeSeconds, "秒"],
        ["gait_speed", m.walkingSpeedMps, "m/s"],
        ["step_count", m.stepCount, "歩"],
        ["cadence", m.cadenceSpm, "歩/分"],
        ["left_step_length", m.leftStepLengthM, "m"],
        ["right_step_length", m.rightStepLengthM, "m"],
      ] as const;
      for (const [code, value, unit] of aiMeasurements) {
        if (value == null) continue;
        const side = code.startsWith("left_") ? "left" : code.startsWith("right_") ? "right" : "none";
        await client.query(
          `INSERT INTO physical_function_measurements
            (session_id,measurement_code,side,trial_number,value,unit,source,confidence)
           VALUES ($1,$2,$3,1,$4,$5,'video_ai',$6)
           ON CONFLICT (session_id,measurement_code,side,trial_number,source) DO UPDATE SET
             value=EXCLUDED.value,unit=EXCLUDED.unit,confidence=EXCLUDED.confidence,updated_at=now()`,
          [parsed.data.sessionId, code, side, value, unit, m.confidence],
        );
      }
      const points: string[] = [];
      if (m.walkingSpeedMps != null) points.push(`歩行速度 ${rounded(m.walkingSpeedMps)}m/sを動画から算出`);
      if (m.stepCount != null) points.push(`${m.stepCount}歩を検出し、歩行リズムを確認`);
      if (m.symmetryPercent != null && m.symmetryPercent >= 85) points.push(`左右歩幅の対称性は${rounded(m.symmetryPercent)}%で良好`);
      if ((m.helperOverlapPercent ?? 0) > 10) points.push(`介助者との重なりが${rounded(m.helperOverlapPercent)}%あり、原動画確認が必要`);
      if (session.rows[0].capture_condition !== "without_hal") points.push("HAL装着中のため、身体関節と機器位置のずれを療法士が確認");
      if (!points.length) points.push("歩行動画を解析し、療法士による確認待ちです");
      const summary = `【RoboReha身体機能解析】${points.join("。")}。解析信頼度は${Math.round(m.confidence * 100)}%です。`;
      const candidates = [
        "歩行中の疲労・疼痛の訴えと、解析された歩行リズムをあわせて確認した。",
        "次回も同じ撮影距離・カメラ位置・介助条件で測定し、経時変化を確認する。",
        session.rows[0].capture_condition === "without_hal"
          ? "HAL装着時の測定と比較し、支持性と歩行速度の変化を確認する。"
          : "HAL装着位置とアシスト設定を記録し、身体関節とのずれを原動画で確認した。",
      ];
      const disclaimer = "RoboReha独自の端末内姿勢推定による参考値です。診断・転倒安全判定には使用せず、療法士が原動画、実測値、介助条件を確認して確定してください。";
      await client.query(
        `INSERT INTO physical_function_reports
          (session_id,report_status,summary,improvement_points,comment_candidates,disclaimer)
         VALUES ($1,'draft',$2,$3::jsonb,$4::jsonb,$5)
         ON CONFLICT (session_id) DO UPDATE SET report_status='draft',summary=EXCLUDED.summary,
           improvement_points=EXCLUDED.improvement_points,comment_candidates=EXCLUDED.comment_candidates,
           disclaimer=EXCLUDED.disclaimer,updated_at=now()`,
        [parsed.data.sessionId, summary, JSON.stringify(points), JSON.stringify(candidates), disclaimer],
      );
      await client.query(`DELETE FROM training_recommendations WHERE session_id=$1 AND clinician_approved=false`, [parsed.data.sessionId]);
      const tags = (m.symmetryPercent ?? 100) < 85 ? ["symmetry"] : (m.trunkLeanDegrees ?? 0) > 8 ? ["trunk"] : ["cadence"];
      await client.query(
        `INSERT INTO training_recommendations (session_id,training_program_id,reason)
         SELECT $1,tp.id,$2 FROM training_programs tp
          WHERE tp.store_id=$3 AND tp.active=true AND tp.target_tags ?| $4::text[]
         ON CONFLICT (session_id,training_program_id) DO NOTHING`,
        [parsed.data.sessionId, `解析結果の確認候補：${points[0]}`, DEMO_STORE_ID, tags],
      );
      await client.query(`UPDATE physical_function_sessions SET status=$1,clinician_summary=$2,updated_at=now() WHERE id=$3`, [status === "completed" ? "reviewed" : "analyzing", summary, parsed.data.sessionId]);
      return { job: job.rows[0], result: result.rows[0], report: { summary, improvementPoints: points, commentCandidates: candidates, disclaimer } };
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "歩行動画を解析できませんでした。" }, { status: 500 });
  }
}
