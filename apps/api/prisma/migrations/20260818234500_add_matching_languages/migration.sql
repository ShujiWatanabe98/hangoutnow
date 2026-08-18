ALTER TABLE "users"
ADD COLUMN "preferred_languages" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
