import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_RECEPTION_ID, DEMO_STORE_ID } from "@/lib/constants";
import { transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";

const vitalSchema = z.object({
  appointmentId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i),
  systolic: z.coerce.number().min(40).max(260),
  diastolic: z.coerce.number().min(20).max(180),
  pulse: z.coerce.number().min(20).max(240),
  temperature: z.coerce.number().min(30).max(45),
  note: z.string().max(500).optional().default(""),
});

type SafetyRule = {
  systolic_stop_low: number | null;
  systolic_stop_high: number | null;
  diastolic_stop_low: number | null;
  diastolic_stop_high: number | null;
  pulse_stop_low: number | null;
  pulse_stop_high: number | null;
  temperature_stop_low: number | null;
  temperature_stop_high: number | null;
};

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "clinical"); if (disabled) return disabled;
  const parsed = vitalSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "バイタル値を確認してください。" }, { status: 400 });
  }

  try {
    const result = await transaction(async (client) => {
      const ruleResult = await client.query<SafetyRule>(
        `SELECT systolic_stop_low, systolic_stop_high, diastolic_stop_low, diastolic_stop_high,
                pulse_stop_low, pulse_stop_high, temperature_stop_low, temperature_stop_high
           FROM safety_rule_sets WHERE store_id = $1 AND active = true
            AND effective_from <= current_date AND (effective_to IS NULL OR effective_to >= current_date)
          ORDER BY effective_from DESC LIMIT 1`,
        [DEMO_STORE_ID],
      );
      const rule = ruleResult.rows[0];
      if (!rule) throw new Error("有効な安全判定基準が設定されていません。");

      const values = parsed.data;
      const triggered: string[] = [];
      if (rule.systolic_stop_low !== null && values.systolic <= Number(rule.systolic_stop_low)) triggered.push("収縮期血圧が下限以下");
      if (rule.systolic_stop_high !== null && values.systolic >= Number(rule.systolic_stop_high)) triggered.push("収縮期血圧が上限以上");
      if (rule.diastolic_stop_low !== null && values.diastolic <= Number(rule.diastolic_stop_low)) triggered.push("拡張期血圧が下限以下");
      if (rule.diastolic_stop_high !== null && values.diastolic >= Number(rule.diastolic_stop_high)) triggered.push("拡張期血圧が上限以上");
      if (rule.pulse_stop_low !== null && values.pulse <= Number(rule.pulse_stop_low)) triggered.push("脈拍が下限以下");
      if (rule.pulse_stop_high !== null && values.pulse >= Number(rule.pulse_stop_high)) triggered.push("脈拍が上限以上");
      if (rule.temperature_stop_low !== null && values.temperature <= Number(rule.temperature_stop_low)) triggered.push("体温が下限以下");
      if (rule.temperature_stop_high !== null && values.temperature >= Number(rule.temperature_stop_high)) triggered.push("体温が上限以上");
      const decision = triggered.length > 0 ? "stop" : "allow";

      const appointment = await client.query(
        `UPDATE appointments SET status = 'checked_in'
          WHERE id = $1 AND store_id = $2 AND status IN ('reserved','confirmed','checked_in') RETURNING id`,
        [values.appointmentId, DEMO_STORE_ID],
      );
      if (!appointment.rows[0]) throw new Error("受付可能な予約が見つかりません。");

      const vital = await client.query(
        `INSERT INTO vital_checks
          (appointment_id, measured_by, systolic, diastolic, pulse, temperature, decision, triggered_rules, staff_note)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         RETURNING id, decision, triggered_rules, measured_at`,
        [values.appointmentId, DEMO_RECEPTION_ID, values.systolic, values.diastolic, values.pulse, values.temperature, decision, JSON.stringify(triggered), values.note],
      );
      return vital.rows[0];
    });

    return NextResponse.json({ vitalCheck: result });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "受付処理に失敗しました。" },
      { status: 500 },
    );
  }
}
