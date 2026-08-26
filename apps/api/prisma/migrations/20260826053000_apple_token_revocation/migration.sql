ALTER TABLE "oauth_identities"
ADD COLUMN "refresh_token_encrypted" TEXT;

ALTER TABLE "oauth_login_tickets"
ADD COLUMN "provider_refresh_token_encrypted" TEXT;
