CREATE TABLE "newsletter_subscriptions" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "unsubscribe_token_hash" TEXT NOT NULL,
  "source" TEXT,
  "consent_at" TIMESTAMP(3) NOT NULL,
  "subscribed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "unsubscribed_at" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "newsletter_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "newsletter_subscriptions_email_key" ON "newsletter_subscriptions"("email");
CREATE UNIQUE INDEX "newsletter_subscriptions_unsubscribe_token_hash_key" ON "newsletter_subscriptions"("unsubscribe_token_hash");
CREATE INDEX "newsletter_subscriptions_unsubscribed_at_subscribed_at_idx" ON "newsletter_subscriptions"("unsubscribed_at", "subscribed_at");
