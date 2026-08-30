import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_STORE_ID } from "@/lib/constants";
import { transaction } from "@/lib/db";
import { DIAGNOSIS_OPTIONS } from "@/lib/rehab-text-suggestions";

export const runtime = "nodejs";

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const registrationForm = z.object({
  familyName: z.string().trim().min(1).max(40),
  givenName: z.string().trim().min(1).max(40),
  familyNameKana: z.string().trim().min(1).max(60),
  givenNameKana: z.string().trim().min(1).max(60),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  phone: z.string().trim().regex(/^[0-9０-９+＋()（）\-ー\s]{8,24}$/),
  email: z.union([z.email().max(254), z.literal("")]).optional().default(""),
  postalCode: optionalText(12),
  address: optionalText(300),
  diagnosisName: z.enum(DIAGNOSIS_OPTIONS),
  primaryCondition: optionalText(500),
  goal: optionalText(1000),
  emergencyName: z.string().trim().min(1).max(80),
  emergencyRelation: z.string().trim().min(1).max(40),
  emergencyPhone: z.string().trim().regex(/^[0-9０-９+＋()（）\-ー\s]{8,24}$/),
  consentPrivacy: z.literal(true),
  consentContact: z.boolean(),
});

function normalizePhone(value: string) {
  return value.replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0)).replace(/[^0-9+]/g, "");
}

export async function POST(request: Request) {
  const parsed = registrationForm.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容を確認してください。必須項目が未入力、または形式が正しくない項目があります。" }, { status: 400 });
  }

  const data = parsed.data;
  const birthDate = new Date(`${data.birthDate}T00:00:00Z`);
  const today = new Date();
  if (Number.isNaN(birthDate.getTime()) || birthDate > today || birthDate.getUTCFullYear() < 1900) {
    return NextResponse.json({ error: "生年月日を正しく入力してください。" }, { status: 400 });
  }

  try {
    const registration = await transaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`${DEMO_STORE_ID}:customer-registration`]);
      const phone = normalizePhone(data.phone);
      const duplicate = await client.query(
        `SELECT id FROM customers WHERE store_id=$1 AND birth_date=$2 AND regexp_replace(phone, '[^0-9+]', '', 'g')=$3 AND active=true LIMIT 1`,
        [DEMO_STORE_ID, data.birthDate, phone],
      );
      if (duplicate.rowCount) {
        const error = new Error("duplicate-registration");
        error.name = "DuplicateRegistrationError";
        throw error;
      }

      const nextCode = await client.query<{ customer_code: string }>(
        `SELECT 'C-' || lpad((COALESCE(MAX(NULLIF(regexp_replace(customer_code, '[^0-9]', '', 'g'), '')::integer), 1041) + 1)::text, 4, '0') AS customer_code
           FROM customers WHERE store_id=$1`,
        [DEMO_STORE_ID],
      );
      const customerCode = nextCode.rows[0].customer_code;
      const customer = await client.query<{ id: string; name: string }>(
        `INSERT INTO customers
          (store_id,customer_code,name,name_kana,birth_date,phone,email,postal_code,address,diagnosis_name,primary_condition,goal,emergency_contact)
         VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),$10,NULLIF($11,''),NULLIF($12,''),$13::jsonb)
         RETURNING id,name`,
        [
          DEMO_STORE_ID,
          customerCode,
          `${data.familyName} ${data.givenName}`,
          `${data.familyNameKana} ${data.givenNameKana}`,
          data.birthDate,
          phone,
          data.email,
          data.postalCode,
          data.address,
          data.diagnosisName,
          data.primaryCondition,
          data.goal,
          JSON.stringify({ name: data.emergencyName, relation: data.emergencyRelation, phone: normalizePhone(data.emergencyPhone) }),
        ],
      );
      const result = await client.query<{ id: string; submitted_at: string; status: string }>(
        `INSERT INTO customer_registrations
          (customer_id,store_id,registration_channel,consent_privacy,consent_contact,status)
         VALUES ($1,$2,'smartphone',$3,$4,'registered') RETURNING id,submitted_at,status`,
        [customer.rows[0].id, DEMO_STORE_ID, data.consentPrivacy, data.consentContact],
      );
      return {
        id: result.rows[0].id,
        customerId: customer.rows[0].id,
        customerCode,
        name: customer.rows[0].name,
        status: result.rows[0].status,
        submittedAt: result.rows[0].submitted_at,
      };
    });

    return NextResponse.json({ registration }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === "DuplicateRegistrationError") {
      return NextResponse.json({ error: "同じ生年月日と電話番号の利用者がすでに登録されています。施設へお問い合わせください。" }, { status: 409 });
    }
    console.error("customer registration failed", error);
    return NextResponse.json({ error: "登録を完了できませんでした。時間をおいてもう一度お試しください。" }, { status: 500 });
  }
}
