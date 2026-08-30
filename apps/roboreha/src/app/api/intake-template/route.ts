import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_MANAGER_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().uuid();
const fieldType = z.enum([
  "short_text",
  "long_text",
  "number",
  "single_choice",
  "multiple_choice",
  "boolean",
  "video",
]);
const itemSchema = z.object({
  id: databaseId.optional(),
  label: z.string().trim().min(1, "項目名を入力してください。").max(120),
  helpText: z.string().trim().max(500).default(""),
  fieldType,
  required: z.boolean().default(false),
  unit: z.string().trim().max(20).default(""),
  minValue: z.number().nullable().default(null),
  maxValue: z.number().nullable().default(null),
  options: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
});

async function getTemplate() {
  const template = await query(
    `SELECT id,store_id,title,introduction_text,consent_text,updated_at
       FROM questionnaire_templates WHERE store_id=$1`,
    [DEMO_STORE_ID],
  );
  if (!template.rows[0]) return null;
  const items = await query(
    `SELECT id,item_key,label,help_text,field_type,required,unit,min_value,max_value,
            options,sort_order,system_field
       FROM questionnaire_template_items
      WHERE template_id=$1 AND active=true
      ORDER BY sort_order,created_at`,
    [template.rows[0].id],
  );
  return { ...template.rows[0], items: items.rows };
}

export async function GET() {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  try {
    const template = await getTemplate();
    if (!template)
      return NextResponse.json(
        { error: "問診表テンプレートがありません。" },
        { status: 404 },
      );
    return NextResponse.json({ template });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "問診表を取得できませんでした。",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  try {
    const body = z
      .object({
        title: z.string().trim().min(1).max(120),
        introductionText: z.string().trim().min(1).max(1000),
        consentText: z.string().trim().min(1).max(1000),
      })
      .parse(await request.json());
    const result = await query(
      `UPDATE questionnaire_templates
          SET title=$1,introduction_text=$2,consent_text=$3,updated_by=$4,updated_at=now()
        WHERE store_id=$5 RETURNING *`,
      [
        body.title,
        body.introductionText,
        body.consentText,
        DEMO_MANAGER_ID,
        DEMO_STORE_ID,
      ],
    );
    if (!result.rows[0])
      return NextResponse.json(
        { error: "問診表テンプレートがありません。" },
        { status: 404 },
      );
    return NextResponse.json({ template: await getTemplate() });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? error.message
              : "保存できませんでした。",
      },
      { status: 400 },
    );
  }
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  try {
    const body = itemSchema.parse(await request.json());
    if (
      body.minValue !== null &&
      body.maxValue !== null &&
      body.maxValue < body.minValue
    )
      return NextResponse.json(
        { error: "最大値は最小値以上にしてください。" },
        { status: 400 },
      );
    const template = await query(
      `SELECT id FROM questionnaire_templates WHERE store_id=$1`,
      [DEMO_STORE_ID],
    );
    if (!template.rows[0])
      return NextResponse.json(
        { error: "問診表テンプレートがありません。" },
        { status: 404 },
      );
    const order = await query(
      `SELECT COALESCE(max(sort_order),0)+10 AS next_order FROM questionnaire_template_items WHERE template_id=$1`,
      [template.rows[0].id],
    );
    const itemKey = `custom_${randomUUID().replaceAll("-", "")}`;
    const result = await query(
      `INSERT INTO questionnaire_template_items
       (template_id,item_key,label,help_text,field_type,required,unit,min_value,max_value,options,sort_order)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        template.rows[0].id,
        itemKey,
        body.label,
        body.helpText || null,
        body.fieldType,
        body.required,
        body.unit || null,
        body.minValue,
        body.maxValue,
        JSON.stringify(body.options),
        Number(order.rows[0].next_order),
      ],
    );
    return NextResponse.json({ item: result.rows[0] }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? error.message
              : "項目を追加できませんでした。",
      },
      { status: 400 },
    );
  }
}

export async function PUT(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  try {
    const body = itemSchema
      .extend({ id: databaseId })
      .parse(await request.json());
    if (
      body.minValue !== null &&
      body.maxValue !== null &&
      body.maxValue < body.minValue
    )
      return NextResponse.json(
        { error: "最大値は最小値以上にしてください。" },
        { status: 400 },
      );
    const result = await query(
      `UPDATE questionnaire_template_items i
          SET label=$1,help_text=$2,field_type=$3,required=$4,unit=$5,min_value=$6,max_value=$7,
              options=$8,updated_at=now()
         FROM questionnaire_templates t
        WHERE i.id=$9 AND i.template_id=t.id AND t.store_id=$10 AND i.active=true
        RETURNING i.*`,
      [
        body.label,
        body.helpText || null,
        body.fieldType,
        body.required,
        body.unit || null,
        body.minValue,
        body.maxValue,
        JSON.stringify(body.options),
        body.id,
        DEMO_STORE_ID,
      ],
    );
    if (!result.rows[0])
      return NextResponse.json(
        { error: "問診項目がありません。" },
        { status: 404 },
      );
    return NextResponse.json({ item: result.rows[0] });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? error.issues[0]?.message
            : error instanceof Error
              ? error.message
              : "項目を保存できませんでした。",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "intake"); if (disabled) return disabled;
  try {
    const id = databaseId.parse(new URL(request.url).searchParams.get("id"));
    const result = await query(
      `UPDATE questionnaire_template_items i SET active=false,updated_at=now()
        FROM questionnaire_templates t
       WHERE i.id=$1 AND i.template_id=t.id AND t.store_id=$2
       RETURNING i.id`,
      [id, DEMO_STORE_ID],
    );
    if (!result.rows[0])
      return NextResponse.json(
        { error: "問診項目がありません。" },
        { status: 404 },
      );
    return NextResponse.json({ deletedId: result.rows[0].id });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "問診項目IDが正しくありません。"
            : error instanceof Error
              ? error.message
              : "削除できませんでした。",
      },
      { status: 400 },
    );
  }
}
