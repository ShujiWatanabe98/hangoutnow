ALTER TABLE "phone_verifications" ADD COLUMN "request_ip" TEXT;
CREATE INDEX "phone_verifications_phone_created_at_idx" ON "phone_verifications"("phone", "created_at");
CREATE INDEX "phone_verifications_request_ip_created_at_idx" ON "phone_verifications"("request_ip", "created_at");
