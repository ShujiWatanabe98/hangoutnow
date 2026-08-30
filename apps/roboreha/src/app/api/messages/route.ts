import { NextResponse } from "next/server";
import { z } from "zod";
import { DEMO_CUSTOMER_ID, DEMO_RECEPTION_ID, DEMO_STORE_ID } from "@/lib/constants";
import { query, transaction } from "@/lib/db";
import { disabledStoreFeatureResponse } from "@/lib/store-feature-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const databaseId = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
const roleSchema = z.enum(["customer", "facility"]);
const sendSchema = z.object({
  role: roleSchema,
  customerId: databaseId.optional(),
  conversationId: databaseId.optional(),
  body: z.string().trim().min(1, "メッセージを入力してください。").max(1000, "メッセージは1000文字以内で入力してください。"),
});

const messageSelect = `
  SELECT m.id,m.conversation_id,m.sender_type,m.body,m.sent_at,m.read_at,
         CASE WHEN m.sender_type='facility' THEN st.name WHEN m.sender_type='ai' THEN 'AI自動応答' ELSE c.name END AS sender_name
    FROM messages m
    LEFT JOIN staff_members st ON st.id=m.sender_staff_id
    LEFT JOIN customers c ON c.id=m.sender_customer_id
   WHERE m.conversation_id=$1
   ORDER BY m.sent_at,m.id`;

export async function GET(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "messages"); if (disabled) return disabled;
  const params = new URL(request.url).searchParams;
  const parsedRole = roleSchema.safeParse(params.get("role") ?? "customer");
  if (!parsedRole.success) return NextResponse.json({ error: "表示するメッセージ画面が正しくありません。" }, { status: 400 });
  try {
    if (parsedRole.data === "customer") {
      const conversation = await query<{ id: string; store_name: string; store_phone: string }>(`
        SELECT mc.id,s.name AS store_name,s.phone AS store_phone
          FROM customers c JOIN stores s ON s.id=c.store_id
          LEFT JOIN message_conversations mc ON mc.customer_id=c.id AND mc.store_id=c.store_id
         WHERE c.id=$1 AND c.store_id=$2`, [DEMO_CUSTOMER_ID, DEMO_STORE_ID]);
      const row = conversation.rows[0];
      if (!row) return NextResponse.json({ error: "利用者情報が見つかりません。" }, { status: 404 });
      if (!row.id) return NextResponse.json({ conversation: null, store: { name: row.store_name, phone: row.store_phone }, messages: [], unreadCount: 0 });
      const unread = await query<{ count: number }>(`SELECT count(*)::int AS count FROM messages WHERE conversation_id=$1 AND sender_type='facility' AND read_at IS NULL`, [row.id]);
      if (params.get("markRead") !== "false") {
        await query(`UPDATE messages SET read_at=now() WHERE conversation_id=$1 AND sender_type='facility' AND read_at IS NULL`, [row.id]);
      }
      const messages = await query(messageSelect, [row.id]);
      return NextResponse.json({ conversation: { id: row.id }, store: { name: row.store_name, phone: row.store_phone }, messages: messages.rows, unreadCount: params.get("markRead") === "false" ? unread.rows[0].count : 0 });
    }

    const conversations = await query(`
      SELECT c.id AS customer_id,c.name,c.name_kana,mc.id AS conversation_id,
             last_message.body AS last_message,last_message.sent_at,
             last_message.sender_type AS last_sender_type,last_message.read_at AS last_read_at,
             count(unread.id)::int AS unread_count
        FROM customers c
        LEFT JOIN message_conversations mc ON mc.customer_id=c.id AND mc.store_id=c.store_id
        LEFT JOIN LATERAL (
          SELECT m.body,m.sent_at,m.sender_type,m.read_at FROM messages m WHERE m.conversation_id=mc.id ORDER BY m.sent_at DESC,m.id DESC LIMIT 1
        ) last_message ON true
        LEFT JOIN messages unread ON unread.conversation_id=mc.id AND unread.sender_type='customer' AND unread.read_at IS NULL
       WHERE c.store_id=$1 AND c.active=true
       GROUP BY c.id,mc.id,last_message.body,last_message.sent_at,last_message.sender_type,last_message.read_at
       ORDER BY coalesce(last_message.sent_at,c.created_at) DESC,c.name_kana`, [DEMO_STORE_ID]);

    const customerId = params.get("customerId");
    if (!customerId) return NextResponse.json({ conversations: conversations.rows });
    const parsedCustomer = databaseId.safeParse(customerId);
    if (!parsedCustomer.success) return NextResponse.json({ error: "利用者IDが正しくありません。" }, { status: 400 });
    const target = conversations.rows.find((item) => item.customer_id === parsedCustomer.data);
    if (!target) return NextResponse.json({ error: "利用者が見つかりません。" }, { status: 404 });
    if (!target.conversation_id) return NextResponse.json({ conversations: conversations.rows, conversation: null, customer: { id: target.customer_id, name: target.name }, messages: [] });
    await query(`UPDATE messages SET read_at=now() WHERE conversation_id=$1 AND sender_type='customer' AND read_at IS NULL`, [target.conversation_id]);
    target.unread_count = 0;
    const messages = await query(messageSelect, [target.conversation_id]);
    return NextResponse.json({ conversations: conversations.rows, conversation: { id: target.conversation_id }, customer: { id: target.customer_id, name: target.name }, messages: messages.rows });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "メッセージを取得できませんでした。" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const disabled = await disabledStoreFeatureResponse(DEMO_STORE_ID, "messages"); if (disabled) return disabled;
  const parsed = sendSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "送信内容を確認してください。" }, { status: 400 });
  try {
    const message = await transaction(async (client) => {
      let customerId = parsed.data.role === "customer" ? DEMO_CUSTOMER_ID : parsed.data.customerId;
      if (!customerId && parsed.data.conversationId) {
        const owner = await client.query(`SELECT customer_id FROM message_conversations WHERE id=$1 AND store_id=$2`, [parsed.data.conversationId, DEMO_STORE_ID]);
        customerId = owner.rows[0]?.customer_id;
      }
      if (!customerId) throw new Error("送信先の利用者を選択してください。");
      const customer = await client.query(`SELECT id FROM customers WHERE id=$1 AND store_id=$2 AND active=true`, [customerId, DEMO_STORE_ID]);
      if (!customer.rows[0]) throw new Error("送信先の利用者が見つかりません。");
      const conversation = await client.query(`
        INSERT INTO message_conversations(store_id,customer_id,updated_at) VALUES($1,$2,now())
        ON CONFLICT(store_id,customer_id) DO UPDATE SET updated_at=now()
        RETURNING id`, [DEMO_STORE_ID, customerId]);
      const values = parsed.data.role === "customer"
        ? [conversation.rows[0].id, "customer", customerId, null, parsed.data.body]
        : [conversation.rows[0].id, "facility", null, DEMO_RECEPTION_ID, parsed.data.body];
      const inserted = await client.query(`
        INSERT INTO messages(conversation_id,sender_type,sender_customer_id,sender_staff_id,body)
        VALUES($1,$2,$3,$4,$5) RETURNING id,conversation_id,sender_type,body,sent_at,read_at`, values);
      return inserted.rows[0];
    });
    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "メッセージを送信できませんでした。";
    const status = message.includes("見つかりません") || message.includes("選択") ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
