ALTER TABLE "hangouts"
  ADD COLUMN "meeting_place_name" TEXT,
  ADD COLUMN "meeting_address" TEXT,
  ADD COLUMN "navigation_url" TEXT,
  ADD COLUMN "host_male_count" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "host_female_count" INTEGER NOT NULL DEFAULT 0;

UPDATE "hangouts"
SET "meeting_place_name" = split_part("location_name", ' ', 1),
    "meeting_address" = CASE
      WHEN strpos("location_name", ' ') > 0 THEN substring("location_name" FROM strpos("location_name", ' ') + 1)
      ELSE "location_name"
    END;
