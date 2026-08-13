ALTER TYPE "JoinRequestStatus" ADD VALUE IF NOT EXISTS 'WAITLISTED';
CREATE TYPE "AttendanceStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED');
ALTER TABLE "join_requests" ADD COLUMN "attendance_status" "AttendanceStatus", ADD COLUMN "attendance_updated_at" TIMESTAMP(3);
CREATE INDEX "join_requests_hangout_id_status_created_at_idx" ON "join_requests"("hangout_id", "status", "created_at");
