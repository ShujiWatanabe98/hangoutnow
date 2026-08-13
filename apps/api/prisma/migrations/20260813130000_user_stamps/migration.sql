CREATE TABLE "user_stamps" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "image_url" TEXT NOT NULL,
  "text" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_stamps_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "user_stamps_user_id_created_at_idx" ON "user_stamps"("user_id", "created_at");
ALTER TABLE "user_stamps" ADD CONSTRAINT "user_stamps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
