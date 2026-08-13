CREATE TABLE "direct_chats" (
  "id" UUID NOT NULL,
  "user_one_id" UUID NOT NULL,
  "user_two_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "direct_chats_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_chats_distinct_users" CHECK ("user_one_id" <> "user_two_id")
);

CREATE TABLE "direct_messages" (
  "id" UUID NOT NULL,
  "direct_chat_id" UUID NOT NULL,
  "sender_user_id" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "direct_messages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "direct_chats_user_one_id_user_two_id_key" ON "direct_chats"("user_one_id", "user_two_id");
CREATE INDEX "direct_chats_user_one_id_updated_at_idx" ON "direct_chats"("user_one_id", "updated_at");
CREATE INDEX "direct_chats_user_two_id_updated_at_idx" ON "direct_chats"("user_two_id", "updated_at");
CREATE INDEX "direct_messages_direct_chat_id_created_at_idx" ON "direct_messages"("direct_chat_id", "created_at");

ALTER TABLE "direct_chats" ADD CONSTRAINT "direct_chats_user_one_id_fkey" FOREIGN KEY ("user_one_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_chats" ADD CONSTRAINT "direct_chats_user_two_id_fkey" FOREIGN KEY ("user_two_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_direct_chat_id_fkey" FOREIGN KEY ("direct_chat_id") REFERENCES "direct_chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "direct_messages" ADD CONSTRAINT "direct_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
