import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const measurementSchema = z.object({
  code: z.string().min(1).max(80),
  side: z.enum(["none", "left", "right"]).default("none"),
  trialNumber: z.number().int().min(1).max(10).default(1),
  value: z.number().finite(),
  unit: z.string().min(1).max(20),
  source: z.enum(["manual", "video_ai", "legacy"]).default("manual"),
  valid: z.boolean().default(true),
  invalidReason: z.string().max(500).nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});
const sessionSchema = z.object({
  appointmentId: databaseId,
  captureCondition: z.enum(["without_hal", "with_hal_lower_limb", "with_hal_lumbar"]),
  halSize: z.enum(["S", "L"]).nullable().optional(),
  assistanceLevel: z.enum(["independent", "supervision", "light", "moderate", "maximum"]),
  assistiveDevice: z.enum(["none", "cane", "walker", "handrail", "other"]),
  walkingDistanceM: z.number().positive().max(100),
  cameraView: z.enum(["side", "rear", "front", "diagonal"]),
  notes: z.string().max(4000).default(""),
  measurements: z.array(measurementSchema).max(100),
});
const patchSchema = z.object({
  sessionId: databaseId,
  status: z.enum(["draft", "reviewed", "finalized"]),
  clinicianSummary: z.string().max(6000).default(""),
  notes: z.string().max(4000).default(""),
});

const sessionsSql = `
  SELECT pfs.id,pfs.appointment_id,pfs.customer_id,pfs.status,pfs.capture_condition,pfs.hal_size,
         pfs.assistance_level,pfs.assistive_device,pfs.walking_distance_m,pfs.camera_view,
         pfs.protocol_version,pfs.notes,pfs.clinician_summary,pfs.recorded_at,pfs.finalized_at,
         c.name AS customer_name,c.primary_condition,st.name AS evaluator_name,
         h.asset_code AS hal_asset_code,h.model_type AS hal_model_type,
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'id',m.id,'code',m.measurement_code,'side',m.side,'trialNumber',m.trial_number,
           'value',m.value,'unit',m.unit,'source',m.source,'valid',m.valid,
           'invalidReason',m.invalid_reason,'confidence',m.confidence
         ) ORDER BY m.measurement_code,m.side,m.trial_number) FROM physical_function_measurements m
           WHERE m.session_id=pfs.id),'[]'::jsonb) AS measurements,
         COALESCE((SELECT jsonb_agg(jsonb_build_object(
           'id',v.id,'testCode',v.test_code,'phase',v.phase,'mimeType',v.mime_type,
           'durationSeconds',v.duration_seconds,'width',v.width,'height',v.height,'fps',v.fps,
           'url','/api/physical-function/videos/'||v.id
         ) ORDER BY v.created_at) FROM physical_function_videos v
           WHERE v.session_id=pfs.id),'[]'::jsonb) AS videos,
         (SELECT jsonb_build_object(
           'jobId',j.id,'status',j.status,'engineVersion',j.engine_version,
           'patientTrackId',j.patient_track_id,'helperTrackIds',j.helper_track_ids,
           'poseSummary',j.pose_summary,'qualityFlags',j.quality_flags,
           'walkingTimeSeconds',g.walking_time_seconds,'walkingSpeedMps',g.walking_speed_mps,
           'stepCount',g.step_count,'cadenceSpm',g.cadence_spm,
           'leftStepLengthM',g.left_step_length_m,'rightStepLengthM',g.right_step_length_m,
           'symmetryPercent',g.symmetry_percent,'trunkLeanDegrees',g.trunk_lean_degrees,
           'leftKneeFlexionDegrees',g.left_knee_flexion_degrees,
           'rightKneeFlexionDegrees',g.right_knee_flexion_degrees,
           'helperOverlapPercent',g.helper_overlap_percent,'confidence',g.confidence,
           'clinicianReviewed',g.clinician_reviewed
         ) FROM motion_analysis_jobs j JOIN gait_analysis_results g ON g.job_id=j.id
           WHERE j.session_id=pfs.id ORDER BY j.created_at DESC LIMIT 1) AS analysis,
         (SELECT jsonb_build_object('status',r.report_status,'summary',r.summary,
           'improvementPoints',r.improvement_points,'commentCandidates',r.comment_candidates,
           'disclaimer',r.disclaimer) FROM physical_function_reports r WHERE r.session_id=pfs.id) AS report
    FROM physical_function_sessions pfs
    JOIN customers c ON c.id=pfs.customer_id
    JOIN staff_members st ON st.id=pfs.evaluator_id
    LEFT JOIN hal_units h ON h.id=pfs.hal_unit_id`;

export async function GET(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "physical"); if (disabled) return disabled;
  const customerId = new URL(request.url).searchParams.get("customerId");
  if (customerId && !databaseId.safeParse(customerId).success) {
    return NextResponse.json({ error: "利用者IDが正しくありません。" }, { status: 400 });
  }
  try {
    const [protocols, sessions] = await Promise.all([
      query(`SELECT id,code,name,version,unit,lower_is_better,instructions,video_supported
               FROM measurement_protocols WHERE store_id=$1 AND active=true ORDER BY code`, [DEMO_STORE_ID]),
      query(`${sessionsSql} WHERE pfs.store_id=$1${customerId ? " AND pfs.customer_id=$2" : ""}
               ORDER BY pfs.recorded_at DESC LIMIT 100`, customerId ? [DEMO_STORE_ID, customerId] : [DEMO_STORE_ID]),
    ]);
    return NextResponse.json({ protocols: protocols.rows, sessions: sessions.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "身体機能記録を取得できませんでした。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "physical"); if (disabled) return disabled;
  const parsed = sessionSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "測定内容を確認してください。" }, { status: 400 });
  try {
    const session = await transaction(async (client) => {
      const appointment = await client.query<{ customer_id: string; therapist_id: string; hal_unit_id: string | null }>(
        `SELECT customer_id,therapist_id,hal_unit_id FROM appointments
          WHERE id=$1 AND store_id=$2 FOR UPDATE`, [parsed.data.appointmentId, DEMO_STORE_ID],
      );
      if (!appointment.rows[0]) throw new Error("対象の予約が見つかりません。");
      const row = appointment.rows[0];
      const saved = await client.query(
        `INSERT INTO physical_function_sessions
          (store_id,appointment_id,customer_id,evaluator_id,hal_unit_id,capture_condition,hal_size,
           assistance_level,assistive_device,walking_distance_m,camera_view,notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         ON CONFLICT (appointment_id) DO UPDATE SET capture_condition=EXCLUDED.capture_condition,
           hal_size=EXCLUDED.hal_size,assistance_level=EXCLUDED.assistance_level,
           assistive_device=EXCLUDED.assistive_device,walking_distance_m=EXCLUDED.walking_distance_m,
           camera_view=EXCLUDED.camera_view,notes=EXCLUDED.notes,hal_unit_id=EXCLUDED.hal_unit_id,
           evaluator_id=EXCLUDED.evaluator_id,updated_at=now()
         RETURNING *`,
        [DEMO_STORE_ID, parsed.data.appointmentId, row.customer_id, row.therapist_id, row.hal_unit_id,
          parsed.data.captureCondition, parsed.data.halSize ?? null, parsed.data.assistanceLevel,
          parsed.data.assistiveDevice, parsed.data.walkingDistanceM, parsed.data.cameraView, parsed.data.notes],
      );
      const sessionId = saved.rows[0].id;
      for (const measurement of parsed.data.measurements) {
        await client.query(
          `INSERT INTO physical_function_measurements
            (session_id,measurement_code,side,trial_number,value,unit,source,valid,invalid_reason,confidence)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           ON CONFLICT (session_id,measurement_code,side,trial_number,source) DO UPDATE SET
             value=EXCLUDED.value,unit=EXCLUDED.unit,valid=EXCLUDED.valid,
             invalid_reason=EXCLUDED.invalid_reason,confidence=EXCLUDED.confidence,updated_at=now()`,
          [sessionId, measurement.code, measurement.side, measurement.trialNumber, measurement.value,
            measurement.unit, measurement.source, measurement.valid, measurement.invalidReason ?? null,
            measurement.confidence ?? null],
        );
      }
      return saved.rows[0];
    });
    return NextResponse.json({ session }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "身体機能記録を保存できませんでした。" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "physical"); if (disabled) return disabled;
  const parsed = patchSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "確定内容を確認してください。" }, { status: 400 });
  try {
    const session = await transaction(async (client) => {
      const result = await client.query(
        `UPDATE physical_function_sessions SET status=$1,clinician_summary=$2,notes=$3,
           finalized_at=CASE WHEN $1='finalized' THEN now() ELSE finalized_at END,updated_at=now()
         WHERE id=$4 AND store_id=$5 RETURNING *`,
        [parsed.data.status, parsed.data.clinicianSummary, parsed.data.notes, parsed.data.sessionId, DEMO_STORE_ID],
      );
      if (!result.rows[0]) return null;
      if (parsed.data.status === "finalized") {
        await client.query(
          `UPDATE gait_analysis_results SET clinician_reviewed=true,reviewed_by=$1,reviewed_at=now(),updated_at=now()
             WHERE job_id=(SELECT id FROM motion_analysis_jobs WHERE session_id=$2 ORDER BY created_at DESC LIMIT 1)`,
          [result.rows[0].evaluator_id, parsed.data.sessionId],
        );
        await client.query(
          `UPDATE physical_function_reports SET report_status='finalized',finalized_by=$1,finalized_at=now(),updated_at=now()
             WHERE session_id=$2`,
          [result.rows[0].evaluator_id, parsed.data.sessionId],
        );
      }
      return result.rows[0];
    });
    if (!session) return NextResponse.json({ error: "身体機能記録が見つかりません。" }, { status: 404 });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "身体機能記録を更新できませんでした。" }, { status: 500 });
  }
}
