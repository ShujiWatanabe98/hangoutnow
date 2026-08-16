ALTER TABLE "hangouts" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

UPDATE "hangouts" AS h
SET "is_demo" = true
FROM "users" AS u
WHERE h."host_user_id" = u."id"
  AND u."email" LIKE '%@hangoutnow.example';

CREATE INDEX "hangouts_is_demo_status_start_at_idx" ON "hangouts"("is_demo", "status", "start_at");
