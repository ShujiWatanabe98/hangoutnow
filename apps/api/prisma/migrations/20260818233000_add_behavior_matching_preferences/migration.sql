ALTER TABLE "users"
ADD COLUMN "avoid_preferences" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "schedule_flexibility" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "behavior_learning_enabled" BOOLEAN NOT NULL DEFAULT false;
