import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";
import { buildRehabSuggestions, calculateAge, DIAGNOSIS_OPTIONS } from "@/lib/rehab-text-suggestions";

export const runtime = "nodejs";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const requestSchema = z.object({
  context: z.enum(["registration_symptom", "registration_goal", "intake_chief_complaint", "intake_medical_history", "intake_medications"]),
  diagnosisName: z.enum(DIAGNOSIS_OPTIONS).optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  customerId: databaseId.optional(),
});

type CustomerContext = {
  diagnosis_name: string | null;
  birth_date: string | null;
  primary_condition: string | null;
  goal: string | null;
};

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "候補を作成するための情報が正しくありません。" }, { status: 400 });

  try {
    let own: CustomerContext | undefined;
    if (parsed.data.customerId) {
      const result = await query<CustomerContext>(
        `SELECT diagnosis_name,birth_date::text,primary_condition,goal
           FROM customers WHERE id=$1 AND store_id=$2 AND active=true`,
        [parsed.data.customerId, DEMO_STORE_ID],
      );
      own = result.rows[0];
      if (!own) return NextResponse.json({ error: "利用者が見つかりません。" }, { status: 404 });
    }

    const diagnosisName = own?.diagnosis_name ?? parsed.data.diagnosisName ?? "その他・診断名不明";
    const birthDate = own?.birth_date ?? parsed.data.birthDate;
    const age = calculateAge(birthDate);
    const cohort = await query<{ primary_condition: string | null; goal: string | null; chief_complaint: string | null }>(
      `SELECT c.primary_condition,c.goal,iq.chief_complaint
         FROM customers c
         LEFT JOIN LATERAL (
           SELECT chief_complaint FROM intake_questionnaires
            WHERE customer_id=c.id ORDER BY created_at DESC LIMIT 1
         ) iq ON true
        WHERE c.store_id=$1 AND c.active=true
          AND COALESCE(c.diagnosis_name,'その他・診断名不明')=$2
          AND ($3::date IS NULL OR abs(EXTRACT(YEAR FROM age(c.birth_date)) - EXTRACT(YEAR FROM age($3::date))) <= 15)
        LIMIT 100`,
      [DEMO_STORE_ID, diagnosisName, birthDate ?? null],
    );
    const cohortTexts = cohort.rows.flatMap((row) => [row.primary_condition, row.goal, row.chief_complaint]).filter((value): value is string => Boolean(value));
    const suggestions = buildRehabSuggestions({
      context: parsed.data.context,
      diagnosisName,
      age,
      cohortTexts,
      ownCondition: own?.primary_condition,
      ownGoal: own?.goal,
    });

    return NextResponse.json({
      suggestions,
      basis: {
        diagnosisName,
        ageBand: age === null ? "年齢未設定" : `${Math.floor(age / 10) * 10}代`,
        cohortRecords: cohort.rowCount,
        framework: "ICF（心身機能・活動・参加）",
      },
      disclaimer: "候補は入力支援用です。診断や医学的判断を行うものではありません。内容をご本人・療法士が確認してください。",
    });
  } catch (error) {
    console.error("text suggestion generation failed", error);
    return NextResponse.json({ error: "入力候補を作成できませんでした。" }, { status: 500 });
  }
}
