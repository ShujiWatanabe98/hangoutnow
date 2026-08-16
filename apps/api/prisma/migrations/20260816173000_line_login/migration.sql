CREATE TABLE "oauth_identities" (
  "id" UUID NOT NULL,
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "oauth_login_tickets" (
  "id" UUID NOT NULL,
  "token_hash" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "display_name" TEXT,
  "profile_photo" TEXT,
  "user_id" UUID,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_login_tickets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_identities_provider_subject_key" ON "oauth_identities"("provider", "subject");
CREATE INDEX "oauth_identities_user_id_idx" ON "oauth_identities"("user_id");
CREATE UNIQUE INDEX "oauth_login_tickets_token_hash_key" ON "oauth_login_tickets"("token_hash");
CREATE INDEX "oauth_login_tickets_provider_subject_idx" ON "oauth_login_tickets"("provider", "subject");
CREATE INDEX "oauth_login_tickets_expires_at_idx" ON "oauth_login_tickets"("expires_at");
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "oauth_login_tickets" ADD CONSTRAINT "oauth_login_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
