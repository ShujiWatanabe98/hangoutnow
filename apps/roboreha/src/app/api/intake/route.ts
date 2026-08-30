import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_MANAGER_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
const databaseId = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const customResponse = z.union([
  z.string().max(500),
  z.number(),
  z.boolean(),
  z.array(z.string().max(100)).max(20),
]);
const form = z.object({
  customerId: databaseId,
  chiefComplaint: z.string().trim().min(1).max(1000),
  medicalHistory: z.string().max(2000).optional().default(""),
  medications: z.string().max(1000).optional().default(""),
  pacemaker: z.boolean(),
  fractureRisk: z.boolean(),
  skinIssue: z.boolean(),
  fallHistory: z.boolean(),
  walkingAid: z.string().max(100).optional().default(""),
  painScale: z.coerce.number().int().min(0).max(10),
  consentTerms: z.literal(true),
  consentMedia: z.boolean(),
  customResponses: z
    .record(z.string().max(100), customResponse)
    .optional()
    .default({}),
});

export async function GET(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  const customerId = new URL(request.url).searchParams.get("customerId");
  const result = await query(
    `SELECT c.id AS customer_id,c.customer_code,c.name,c.diagnosis_name,c.birth_date::text,c.primary_condition,c.goal,
      NOT EXISTS(SELECT 1 FROM appointments a WHERE a.customer_id=c.id AND a.status='completed') AS first_visit,
      iq.id,iq.chief_complaint,iq.medical_history,iq.medications,iq.pacemaker,iq.fracture_risk,iq.skin_issue,iq.fall_history,iq.walking_aid,iq.pain_scale,iq.consent_terms,iq.consent_media,iq.status,iq.submitted_at
    FROM customers c LEFT JOIN LATERAL(SELECT * FROM intake_questionnaires q WHERE q.customer_id=c.id ORDER BY q.created_at DESC LIMIT 1) iq ON true
    WHERE c.store_id=$1 AND c.active=true AND ($2::uuid IS NULL OR c.id=$2::uuid)
    ORDER BY first_visit DESC,c.name_kana`,
    [DEMO_STORE_ID, customerId],
  );
  return NextResponse.json({ customers: result.rows });
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  const parsed = form.safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "問診内容を確認してください。",
      },
      { status: 400 },
    );
  const d = parsed.data;
  const result = await query(
    `INSERT INTO intake_questionnaires (customer_id,store_id,chief_complaint,medical_history,medications,pacemaker,fracture_risk,skin_issue,fall_history,walking_aid,pain_scale,consent_terms,consent_media,custom_responses,status,submitted_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'submitted',now()) RETURNING *`,
    [
      d.customerId,
      DEMO_STORE_ID,
      d.chiefComplaint,
      d.medicalHistory,
      d.medications,
      d.pacemaker,
      d.fractureRisk,
      d.skinIssue,
      d.fallHistory,
      d.walkingAid,
      d.painScale,
      d.consentTerms,
      d.consentMedia,
      JSON.stringify(d.customResponses),
    ],
  );
  return NextResponse.json({ questionnaire: result.rows[0] }, { status: 201 });
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  const parsed = z
    .object({ id: databaseId, action: z.literal("review") })
    .safeParse(await request.json());
  if (!parsed.success)
    return NextResponse.json(
      { error: "問診IDが正しくありません。" },
      { status: 400 },
    );
  const result = await query(
    `UPDATE intake_questionnaires SET status='reviewed',reviewed_by=$1,reviewed_at=now(),updated_at=now() WHERE id=$2 AND store_id=$3 RETURNING *`,
    [DEMO_MANAGER_ID, parsed.data.id, DEMO_STORE_ID],
  );
  return NextResponse.json({ questionnaire: result.rows[0] });
}
