CREATE TABLE "chat_rooms" ("id" UUID NOT NULL,"hangout_id" UUID NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id"));
CREATE TABLE "messages" ("id" UUID NOT NULL,"room_id" UUID NOT NULL,"sender_user_id" UUID NOT NULL,"body" TEXT NOT NULL,"created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "messages_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "chat_rooms_hangout_id_key" ON "chat_rooms"("hangout_id");
CREATE INDEX "messages_room_id_created_at_idx" ON "messages"("room_id","created_at");
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_hangout_id_fkey" FOREIGN KEY ("hangout_id") REFERENCES "hangouts"("id") ON DELETE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE CASCADE;
