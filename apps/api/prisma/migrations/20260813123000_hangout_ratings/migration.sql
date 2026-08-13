CREATE TABLE "hangout_ratings" (
  "id" UUID NOT NULL,
  "hangout_id" UUID NOT NULL,
  "rater_user_id" UUID NOT NULL,
  "rated_user_id" UUID NOT NULL,
  "score" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "hangout_ratings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "hangout_ratings_distinct_users" CHECK ("rater_user_id" <> "rated_user_id"),
  CONSTRAINT "hangout_ratings_score_range" CHECK ("score" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "hangout_ratings_hangout_id_rater_user_id_rated_user_id_key"
  ON "hangout_ratings"("hangout_id", "rater_user_id", "rated_user_id");
CREATE INDEX "hangout_ratings_rater_user_id_rated_user_id_score_idx"
  ON "hangout_ratings"("rater_user_id", "rated_user_id", "score");
ALTER TABLE "hangout_ratings" ADD CONSTRAINT "hangout_ratings_hangout_id_fkey" FOREIGN KEY ("hangout_id") REFERENCES "hangouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hangout_ratings" ADD CONSTRAINT "hangout_ratings_rater_user_id_fkey" FOREIGN KEY ("rater_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "hangout_ratings" ADD CONSTRAINT "hangout_ratings_rated_user_id_fkey" FOREIGN KEY ("rated_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
