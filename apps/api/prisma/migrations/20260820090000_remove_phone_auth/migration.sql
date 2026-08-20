DROP TABLE IF EXISTS "phone_verifications";

ALTER TABLE "users" DROP COLUMN IF EXISTS "phone_number";

ALTER TYPE "VerificationStatus" RENAME TO "VerificationStatus_old";
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'VERIFIED');

ALTER TABLE "users" ALTER COLUMN "verification" DROP DEFAULT;
ALTER TABLE "users"
  ALTER COLUMN "verification" TYPE "VerificationStatus"
  USING (
    CASE
      WHEN "verification"::text = 'PHONE_VERIFIED' THEN 'VERIFIED'
      ELSE 'UNVERIFIED'
    END
  )::"VerificationStatus";
ALTER TABLE "users" ALTER COLUMN "verification" SET DEFAULT 'UNVERIFIED';

DROP TYPE "VerificationStatus_old";
