CREATE TYPE "CoachGoReportStatus" AS ENUM ('ACTIVE', 'HIDDEN', 'DELETED', 'EXPIRED');

CREATE TABLE "coachgo_hazard_reports" (
    "id" UUID NOT NULL,
    "owner_token_hash" CHAR(64) NOT NULL,
    "category" VARCHAR(32) NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "status" "CoachGoReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "moderated_at" TIMESTAMP(3),
    "moderated_by" VARCHAR(100),
    "moderation_note" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coachgo_hazard_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "coachgo_hazard_reports_status_expires_at_idx" ON "coachgo_hazard_reports"("status", "expires_at");
CREATE INDEX "coachgo_hazard_reports_category_status_idx" ON "coachgo_hazard_reports"("category", "status");
CREATE INDEX "coachgo_hazard_reports_created_at_idx" ON "coachgo_hazard_reports"("created_at");
