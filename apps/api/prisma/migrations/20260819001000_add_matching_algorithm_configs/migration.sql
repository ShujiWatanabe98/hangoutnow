CREATE TYPE "MatchingAlgorithmStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');

CREATE TABLE "matching_algorithm_configs" (
  "id" UUID NOT NULL,
  "version" TEXT NOT NULL,
  "status" "MatchingAlgorithmStatus" NOT NULL DEFAULT 'DRAFT',
  "weights" JSONB NOT NULL,
  "note" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "activated_by" TEXT,
  "activated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "matching_algorithm_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "matching_algorithm_configs_version_key" ON "matching_algorithm_configs"("version");
CREATE INDEX "matching_algorithm_configs_status_activated_at_idx" ON "matching_algorithm_configs"("status", "activated_at");
CREATE UNIQUE INDEX "matching_algorithm_configs_one_active_idx" ON "matching_algorithm_configs"("status") WHERE "status" = 'ACTIVE';
