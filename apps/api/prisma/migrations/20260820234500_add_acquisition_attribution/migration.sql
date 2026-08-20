CREATE TABLE "acquisition_attributions" (
    "user_id" UUID NOT NULL,
    "source" VARCHAR(64) NOT NULL,
    "medium" VARCHAR(32) NOT NULL,
    "campaign" VARCHAR(64) NOT NULL,
    "content" VARCHAR(80) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "acquisition_attributions_pkey" PRIMARY KEY ("user_id")
);

CREATE INDEX "acquisition_attributions_campaign_source_created_at_idx"
ON "acquisition_attributions"("campaign", "source", "created_at");

ALTER TABLE "acquisition_attributions"
ADD CONSTRAINT "acquisition_attributions_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
