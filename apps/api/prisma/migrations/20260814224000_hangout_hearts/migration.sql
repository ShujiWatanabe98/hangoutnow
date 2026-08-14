CREATE TABLE "hangout_hearts" (
    "hangout_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hangout_hearts_pkey" PRIMARY KEY ("hangout_id", "user_id")
);

CREATE INDEX "hangout_hearts_user_id_created_at_idx" ON "hangout_hearts"("user_id", "created_at");

ALTER TABLE "hangout_hearts" ADD CONSTRAINT "hangout_hearts_hangout_id_fkey" FOREIGN KEY ("hangout_id") REFERENCES "hangouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hangout_hearts" ADD CONSTRAINT "hangout_hearts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
