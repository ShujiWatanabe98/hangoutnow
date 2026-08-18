CREATE TYPE "ParticipationUrgency" AS ENUM ('NOW', 'TODAY', 'THIS_WEEK', 'WEEKEND', 'FLEXIBLE');
CREATE TYPE "MatchOutcome" AS ENUM ('MATCHED', 'NOT_MATCHED');
CREATE TYPE "MatchDeclineReason" AS ENUM ('TIME', 'DISTANCE', 'FULL', 'BUDGET', 'CONDITIONS', 'OTHER');

ALTER TABLE "users"
ADD COLUMN "participation_urgency" "ParticipationUrgency",
ADD COLUMN "max_travel_minutes" INTEGER,
ADD COLUMN "preferred_group_sizes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "budget_min" INTEGER,
ADD COLUMN "budget_max" INTEGER;

ALTER TABLE "users" ADD CONSTRAINT "users_matching_limits_check" CHECK (
  ("max_travel_minutes" IS NULL OR "max_travel_minutes" BETWEEN 5 AND 180)
  AND ("budget_min" IS NULL OR "budget_min" BETWEEN 0 AND 100000)
  AND ("budget_max" IS NULL OR "budget_max" BETWEEN 0 AND 100000)
  AND ("budget_min" IS NULL OR "budget_max" IS NULL OR "budget_min" <= "budget_max")
);

CREATE TABLE "match_feedback" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "hangout_id" UUID NOT NULL,
  "outcome" "MatchOutcome" NOT NULL,
  "reason" "MatchDeclineReason",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "match_feedback_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "match_feedback_user_id_hangout_id_key" ON "match_feedback"("user_id", "hangout_id");
CREATE INDEX "match_feedback_outcome_reason_created_at_idx" ON "match_feedback"("outcome", "reason", "created_at");
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "match_feedback" ADD CONSTRAINT "match_feedback_hangout_id_fkey" FOREIGN KEY ("hangout_id") REFERENCES "hangouts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
