CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED');
CREATE TYPE "GenderRestriction" AS ENUM ('ANY', 'MALE_ONLY', 'FEMALE_ONLY');
ALTER TABLE "users" ADD COLUMN "gender" "Gender";
ALTER TABLE "hangouts" ADD COLUMN "gender_restriction" "GenderRestriction" NOT NULL DEFAULT 'ANY';
ALTER TABLE "hangouts" ADD COLUMN "max_age" INTEGER;
ALTER TABLE "hangouts" ADD CONSTRAINT "hangouts_max_age_allowed" CHECK ("max_age" IS NULL OR "max_age" IN (29, 39, 59));
