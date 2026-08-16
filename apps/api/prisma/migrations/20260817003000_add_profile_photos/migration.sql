ALTER TABLE "users" ADD COLUMN "profile_photos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "users"
SET "profile_photos" = ARRAY["profile_photo"]
WHERE "profile_photo" IS NOT NULL;
