ALTER TABLE "users" ADD COLUMN "profile_photo" TEXT;
ALTER TABLE "users" ADD COLUMN "phone_number" TEXT;
CREATE UNIQUE INDEX "users_phone_number_key" ON "users"("phone_number");

CREATE TABLE "phone_verifications" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "phone" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "phone_verifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "phone_verifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "phone_verifications_user_id_created_at_idx" ON "phone_verifications"("user_id", "created_at");
