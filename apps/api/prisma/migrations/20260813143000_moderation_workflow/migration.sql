CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'WARNED', 'SUSPENDED', 'BANNED');
CREATE TYPE "ModerationActionType" AS ENUM ('NOTE', 'WARNING', 'SUSPEND', 'BAN', 'RESTORE');

ALTER TABLE "users" ADD COLUMN "account_status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "reports" ADD COLUMN "assigned_to" TEXT;
ALTER TABLE "reports" ADD COLUMN "resolution" TEXT;
ALTER TABLE "reports" ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE TABLE "moderation_actions" (
  "id" UUID NOT NULL,
  "report_id" UUID NOT NULL,
  "target_user_id" UUID NOT NULL,
  "action" "ModerationActionType" NOT NULL,
  "reason" TEXT NOT NULL,
  "admin_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "moderation_actions_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "moderation_actions_report_id_created_at_idx" ON "moderation_actions"("report_id", "created_at");
CREATE INDEX "moderation_actions_target_user_id_created_at_idx" ON "moderation_actions"("target_user_id", "created_at");
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "moderation_actions" ADD CONSTRAINT "moderation_actions_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
