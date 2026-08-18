ALTER TABLE "hangouts"
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "ended_at" TIMESTAMP(3);

UPDATE "hangouts"
SET "started_at" = "start_at"
WHERE "status" = 'STARTED' AND "started_at" IS NULL;

CREATE INDEX "hangouts_status_started_at_idx" ON "hangouts"("status", "started_at");
