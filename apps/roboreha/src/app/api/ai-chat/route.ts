import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_CUSTOMER_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONSENT_VERSION = "2026-08-30-v1";
const CONSENT_NOTICES = [
  "AIの回答は一般的な情報であり、診断・治療・緊急判断の代わりにはなりません。",
  "回答のため、登録情報、過去の利用履歴、評価記録、会話履歴を必要な範囲で参照します。",
  "AIモデル接続時は、回答に必要な情報が外部AI提供者へ送信される場合があります。",
  "音声そのものは保存せず、端末で文字に変換された文章を会話履歴として保存します。",
  "強い痛み、急な麻痺、胸痛、呼吸困難、転倒などはAIを使わず施設または救急へ連絡してください。",
];

const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("consent"), accepted: z.literal(true) }),
  z.object({ action: z.literal("ask"), question: z.string().trim().min(1).max(1000), inputMethod: z.enum(["text", "voice"]).default("text") }),
]);

type Context = {
  name: string;
  age: number;
  diagnosis_name: string | null;
  primary_condition: string | null;
  goal: string | null;
  last_visit: string | null;
  last_product: string | null;
  summary_text: string | null;
  notes: string | null;
  delta_summary: Record<string, number> | null;
  recent_customer_messages: string[];
};

function classifySafety(question: string): "routine" | "contact_facility" | "emergency" {
  if (/(胸(が|の)?痛|呼吸(が)?苦|息ができ|意識|ろれつ|急.*(麻痺|動け)|顔.*ゆが|転倒.*(頭|意識)|大量.*出血)/.test(question)) return "emergency";
  if (/(強い痛|痛み.*(増|ひど)|腫れ|発熱|転倒|しびれ.*(増|強)|皮膚.*(赤|傷)|HAL.*(エラー|異常)|体調.*悪)/.test(question)) return "contact_facility";
  return "routine";
}

function responseStyle(question: string, history: string[]) {
  const combined = `${history.slice(-4).join(" ")} ${question}`;
  if (/(不安|心配|怖|できるでしょうか)/.test(combined)) return "安心重視";
  if (/(詳しく|理由|どのくらい|数値|具体)/.test(combined)) return "具体的に説明";
  if (question.length <= 24) return "短く要点";
  return "やさしく前向き";
}

function metricSentence(delta: Record<string, number> | null) {
  if (!delta) return "";
  const parts: string[] = [];
  if (typeof delta.gaitSpeed === "number" && delta.gaitSpeed > 0) parts.push(`歩行速度が${delta.gaitSpeed.toFixed(2)}m/秒向上`);
  if (typeof delta.walk10mSeconds === "number" && delta.walk10mSeconds < 0) parts.push(`10m歩行が${Math.abs(delta.walk10mSeconds).toFixed(1)}秒短縮`);
  if (typeof delta.tugSeconds === "number" && delta.tugSeconds < 0) parts.push(`TUGが${Math.abs(delta.tugSeconds).toFixed(1)}秒短縮`);
  if (typeof delta.bbs === "number" && delta.bbs > 0) parts.push(`BBSが${delta.bbs}点向上`);
  return parts.slice(0, 2).join("、");
}

function safeDemoAnswer(question: string, context: Context, style: string, safety: ReturnType<typeof classifySafety>) {
  if (safety === "emergency") return "急な症状の可能性があるため、AIでは判断できません。今すぐ周囲の方に知らせ、119番など緊急窓口へ連絡してください。安全な場所で安静にし、無理に歩いたりHALを使用したりしないでください。";
  if (safety === "contact_facility") return `体調や装着部の変化はAIだけで判断できません。運動やHALの使用をいったん止め、${context.name}さんの状態をぐんまロボケアセンターへ電話でお伝えください。症状が急に強くなる場合は救急相談をご利用ください。`;
  const metric = metricSentence(context.delta_summary);
  const progress = metric ? `前回の評価では、${metric}という記録があります。積み重ねが数字にも表れていて、うれしい一歩ですね。` : context.summary_text ? `前回の記録には「${context.summary_text}」とあります。取り組みが前向きな変化につながっていますね。` : "これまで継続して通われていること自体が、大切な一歩です。";
  const goal = context.goal ? `「${context.goal}」という目標に向けて、` : "目標に向けて、";
  let answer: string;
  if (/(良く|改善|成果|変化|歩け)/.test(question)) answer = `${progress}\n\n${goal}できたことを一つずつ確認していきましょう。数値はその日の体調でも変わるため、次回も療法士と一緒に確認するのがおすすめです。`;
  else if (/(運動|練習|自宅|家で)/.test(question)) answer = `${progress}\n\n自宅では、療法士から案内された運動だけを、痛みや強い疲れが出ない範囲で行ってください。新しい運動や回数の変更は、次回の施術前に施設へ確認しましょう。`;
  else if (/(予約|時間|変更|キャンセル|持ち物)/.test(question)) answer = "予約や持ち物は施設スタッフが最新情報を確認します。画面上部の「施設に問い合わせ」へ切り替えてメッセージを送るか、電話でお問い合わせください。";
  else answer = `${context.name}さん、ご質問ありがとうございます。${progress}\n\n${goal}焦らず、ご自身のペースで続けていきましょう。体調や運動方法について個別の判断が必要な場合は、施設の療法士へ確認してください。`;
  return style === "短く要点" ? answer.split("\n\n").slice(0, 2).join("\n\n") : answer;
}

async function modelAnswer(question: string, context: Context, style: string) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { text: safeDemoAnswer(question, context, style, "routine"), provider: "safe_demo", model: "rehab-safe-demo-v1" };
  const model = process.env.OPENAI_MODEL || "gpt-5.6";
  const instructions = `あなたはロボケアセンターのリハビリ支援AIです。日本語で回答してください。
- 医療診断、治療指示、安全の保証をしない。急変や個別判断は必ず施設・救急へつなぐ。
- 提供された記録以外の成功事例、改善値、HALの効果を作らない。
- 利用者本人の確認できる小さな前進を具体的に喜び、押しつけず温かく励ます。
- 回答スタイルは「${style}」。隠れた性格診断や心理評価はしない。
- 回答は300文字程度。最後に必要なら療法士への確認を促す。`;
  const response = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }, body: JSON.stringify({ model, store: false, instructions, input: `利用者情報と記録:\n${JSON.stringify({ name: context.name, age: context.age, diagnosis: context.diagnosis_name, condition: context.primary_condition, goal: context.goal, lastVisit: context.last_visit, lastProgram: context.last_product, assessmentSummary: context.summary_text, delta: context.delta_summary })}\n\n質問:\n${question}` }) });
  if (!response.ok) throw new Error("AIモデルから回答を取得できませんでした。");
  const body = await response.json() as { output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  const text = body.output?.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n").trim();
  if (!text) throw new Error("AIモデルの回答が空でした。");
  return { text, provider: "openai", model };
}

async function getContext(): Promise<Context> {
  const profile = await query(`
    SELECT c.name,date_part('year',age(current_date,c.birth_date))::int AS age,c.diagnosis_name,c.primary_condition,c.goal,
           last_visit.start_at AS last_visit,last_visit.product_name AS last_product,
           assessment.summary_text,assessment.notes,assessment.delta_summary,
           COALESCE((SELECT jsonb_agg(body ORDER BY sent_at) FROM (SELECT m.body,m.sent_at FROM messages m JOIN message_conversations mc ON mc.id=m.conversation_id WHERE mc.customer_id=c.id AND m.sender_type='customer' ORDER BY m.sent_at DESC LIMIT 8) recent),'[]'::jsonb) AS recent_customer_messages
      FROM customers c
      LEFT JOIN LATERAL (SELECT a.start_at,p.name AS product_name FROM appointments a JOIN service_products p ON p.id=a.product_id WHERE a.customer_id=c.id AND a.status='completed' ORDER BY a.start_at DESC LIMIT 1) last_visit ON true
      LEFT JOIN LATERAL (SELECT ca.summary_text,ca.notes,ca.delta_summary FROM clinical_assessments ca WHERE ca.customer_id=c.id ORDER BY ca.assessed_at DESC LIMIT 1) assessment ON true
     WHERE c.id=$1 AND c.store_id=$2`, [DEMO_CUSTOMER_ID, DEMO_STORE_ID]);
  if (!profile.rows[0]) throw new Error("利用者情報が見つかりません。");
  return profile.rows[0] as Context;
}

export async function GET() {
  const consent = await query(`SELECT accepted_at,consent_version FROM ai_chat_consents WHERE customer_id=$1 AND store_id=$2 AND consent_version=$3 AND revoked_at IS NULL`, [DEMO_CUSTOMER_ID, DEMO_STORE_ID, CONSENT_VERSION]);
  return NextResponse.json({ consented: Boolean(consent.rows[0]), acceptedAt: consent.rows[0]?.accepted_at ?? null, notices: CONSENT_NOTICES, consentVersion: CONSENT_VERSION, provider: process.env.OPENAI_API_KEY ? "openai" : "safe_demo", model: process.env.OPENAI_MODEL || (process.env.OPENAI_API_KEY ? "gpt-5.6" : "rehab-safe-demo-v1") });
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "入力内容を確認してください。" }, { status: 400 });
  if (parsed.data.action === "consent") {
    const result = await query(`INSERT INTO ai_chat_consents(customer_id,store_id,consent_version,notices,accepted_at,revoked_at) VALUES($1,$2,$3,$4::jsonb,now(),NULL) ON CONFLICT(customer_id,consent_version) DO UPDATE SET notices=EXCLUDED.notices,accepted_at=now(),revoked_at=NULL RETURNING accepted_at`, [DEMO_CUSTOMER_ID, DEMO_STORE_ID, CONSENT_VERSION, JSON.stringify(CONSENT_NOTICES)]);
    return NextResponse.json({ consented: true, acceptedAt: result.rows[0].accepted_at });
  }
  const ask = parsed.data;
  const consent = await query(`SELECT id FROM ai_chat_consents WHERE customer_id=$1 AND store_id=$2 AND consent_version=$3 AND revoked_at IS NULL`, [DEMO_CUSTOMER_ID, DEMO_STORE_ID, CONSENT_VERSION]);
  if (!consent.rows[0]) return NextResponse.json({ error: "AI自動応答の注意事項への同意が必要です。", code: "AI_CONSENT_REQUIRED" }, { status: 403 });
  try {
    const context = await getContext();
    const safety = classifySafety(ask.question);
    const style = responseStyle(ask.question, context.recent_customer_messages ?? []);
    let generated;
    if (safety === "routine") {
      try { generated = await modelAnswer(ask.question, context, style); }
      catch { generated = { text: safeDemoAnswer(ask.question, context, style, safety), provider: "safe_demo_fallback", model: "rehab-safe-demo-v1" }; }
    } else generated = { text: safeDemoAnswer(ask.question, context, style, safety), provider: "safety_rule", model: "rehab-safety-rules-v1" };
    const saved = await transaction(async (client) => {
      const conversation = await client.query(`INSERT INTO message_conversations(store_id,customer_id,updated_at) VALUES($1,$2,now()) ON CONFLICT(store_id,customer_id) DO UPDATE SET updated_at=now() RETURNING id`, [DEMO_STORE_ID, DEMO_CUSTOMER_ID]);
      const question = await client.query(`INSERT INTO messages(conversation_id,sender_type,sender_customer_id,body,sent_at,read_at) VALUES($1,'customer',$2,$3,clock_timestamp(),now()) RETURNING id,conversation_id,sender_type,body,sent_at,read_at`, [conversation.rows[0].id, DEMO_CUSTOMER_ID, ask.question]);
      const answer = await client.query(`INSERT INTO messages(conversation_id,sender_type,body,sent_at,read_at) VALUES($1,'ai',$2,clock_timestamp(),now()) RETURNING id,conversation_id,sender_type,body,sent_at,read_at`, [conversation.rows[0].id, generated.text]);
      await client.query(`INSERT INTO ai_chat_interactions(conversation_id,customer_id,question_message_id,answer_message_id,input_method,response_style,safety_classification,context_summary,provider,model_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10)`, [conversation.rows[0].id, DEMO_CUSTOMER_ID, question.rows[0].id, answer.rows[0].id, ask.inputMethod, style, safety, JSON.stringify({ goal: context.goal, lastVisit: context.last_visit, assessmentUsed: Boolean(context.summary_text), metricKeys: Object.keys(context.delta_summary ?? {}) }), generated.provider, generated.model]);
      return { question: question.rows[0], answer: answer.rows[0] };
    });
    return NextResponse.json({ ...saved, responseStyle: style, safetyClassification: safety, provider: generated.provider, model: generated.model });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI自動応答を利用できませんでした。" }, { status: 500 });
  }
}
