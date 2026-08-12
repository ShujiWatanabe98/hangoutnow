ALTER TABLE "users" ADD COLUMN "notifications_enabled" BOOLEAN NOT NULL DEFAULT true;
CREATE TABLE "notifications" (
  "id" UUID NOT NULL, "user_id" UUID NOT NULL, "type" TEXT NOT NULL,
  "title" TEXT NOT NULL, "body" TEXT NOT NULL, "link" TEXT,
  "event_key" TEXT, "read_at" TIMESTAMP(3), "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "notifications_event_key_key" ON "notifications"("event_key");
CREATE INDEX "notifications_user_id_read_at_created_at_idx" ON "notifications"("user_id", "read_at", "created_at");
