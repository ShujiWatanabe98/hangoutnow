CREATE TYPE "ServiceArea" AS ENUM ('SHINJUKU', 'SHIBUYA');
CREATE TYPE "FunnelEventType" AS ENUM ('DISCOVERY_VIEWED', 'HANGOUT_VIEWED', 'JOIN_REQUESTED', 'JOIN_ACCEPTED', 'HANGOUT_CREATED', 'HANGOUT_COMPLETED');

ALTER TABLE "hangouts" ADD COLUMN "service_area" "ServiceArea";
UPDATE "hangouts"
SET "service_area" = CASE WHEN "location_name" ILIKE '%渋谷%' OR "location_name" ILIKE '%shibuya%' THEN 'SHIBUYA'::"ServiceArea" ELSE 'SHINJUKU'::"ServiceArea" END;
ALTER TABLE "hangouts" ALTER COLUMN "service_area" SET NOT NULL;
CREATE INDEX "hangouts_service_area_status_start_at_idx" ON "hangouts"("service_area", "status", "start_at");

CREATE TABLE "funnel_events" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "hangout_id" UUID,
  "event_type" "FunnelEventType" NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funnel_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "funnel_events_hangout_id_fkey" FOREIGN KEY ("hangout_id") REFERENCES "hangouts"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "funnel_events_event_type_created_at_idx" ON "funnel_events"("event_type", "created_at");
CREATE INDEX "funnel_events_hangout_id_event_type_created_at_idx" ON "funnel_events"("hangout_id", "event_type", "created_at");
CREATE INDEX "funnel_events_user_id_created_at_idx" ON "funnel_events"("user_id", "created_at");

-- Serialize acceptances per Hangout in the database itself. This protects capacity
-- even if another API instance or a maintenance script bypasses application checks.
CREATE OR REPLACE FUNCTION enforce_hangout_capacity() RETURNS trigger AS $$
DECLARE accepted_count integer;
DECLARE capacity integer;
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status IS DISTINCT FROM 'ACCEPTED' THEN
    PERFORM pg_advisory_xact_lock(hashtext(NEW.hangout_id::text));
    SELECT max_participants INTO capacity FROM hangouts WHERE id = NEW.hangout_id FOR UPDATE;
    SELECT count(*) INTO accepted_count FROM join_requests WHERE hangout_id = NEW.hangout_id AND status = 'ACCEPTED';
    IF accepted_count + 1 >= capacity THEN
      RAISE EXCEPTION 'HANGOUT_CAPACITY_EXCEEDED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER join_requests_capacity_guard
BEFORE UPDATE OF status ON join_requests
FOR EACH ROW EXECUTE FUNCTION enforce_hangout_capacity();
