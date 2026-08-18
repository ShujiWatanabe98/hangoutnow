ALTER TABLE "users"
ADD COLUMN "disabled_notification_types" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TYPE "PushDeliveryStatus" AS ENUM ('QUEUED', 'ACCEPTED', 'DELIVERED', 'ERROR');

CREATE TABLE "push_deliveries" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "notification_id" UUID,
  "push_token_id" UUID,
  "token" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "status" "PushDeliveryStatus" NOT NULL DEFAULT 'QUEUED',
  "ticket_id" TEXT,
  "error_code" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "next_attempt_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "receipt_checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "push_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_controls" (
  "id" TEXT NOT NULL,
  "paused" BOOLEAN NOT NULL DEFAULT false,
  "updated_by" TEXT,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_controls_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "push_deliveries_status_next_attempt_at_idx" ON "push_deliveries"("status", "next_attempt_at");
CREATE INDEX "push_deliveries_ticket_id_receipt_checked_at_idx" ON "push_deliveries"("ticket_id", "receipt_checked_at");
CREATE INDEX "push_deliveries_user_id_created_at_idx" ON "push_deliveries"("user_id", "created_at");
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "push_deliveries" ADD CONSTRAINT "push_deliveries_push_token_id_fkey" FOREIGN KEY ("push_token_id") REFERENCES "push_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;
