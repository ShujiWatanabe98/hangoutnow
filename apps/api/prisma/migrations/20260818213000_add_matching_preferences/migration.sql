ALTER TABLE "users"
ADD COLUMN "preferred_areas" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferred_activities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "preferred_age_min" INTEGER,
ADD COLUMN "preferred_age_max" INTEGER,
ADD COLUMN "preferred_genders" "Gender"[] NOT NULL DEFAULT ARRAY[]::"Gender"[],
ADD COLUMN "activity_time_slots" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "matching_data_consent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "matching_data_consent_at" TIMESTAMP(3);

ALTER TABLE "users"
ADD CONSTRAINT "users_preferred_age_range_check"
CHECK (
  ("preferred_age_min" IS NULL OR "preferred_age_min" BETWEEN 18 AND 100)
  AND ("preferred_age_max" IS NULL OR "preferred_age_max" BETWEEN 18 AND 100)
  AND ("preferred_age_min" IS NULL OR "preferred_age_max" IS NULL OR "preferred_age_min" <= "preferred_age_max")
);
