ALTER TABLE "users"
ADD COLUMN "social_styles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "participation_goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "first_time_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "alcohol_preference" TEXT,
ADD COLUMN "smoking_preference" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_alcohol_preference_check"
CHECK ("alcohol_preference" IS NULL OR "alcohol_preference" IN ('NONE', 'SOMETIMES', 'YES'));

ALTER TABLE "users" ADD CONSTRAINT "users_smoking_preference_check"
CHECK ("smoking_preference" IS NULL OR "smoking_preference" IN ('NON_SMOKING', 'SEPARATED', 'NO_PREFERENCE'));
