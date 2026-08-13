ALTER TABLE "hangouts" ADD COLUMN "public_location_name" TEXT;

UPDATE "hangouts"
SET "public_location_name" = CASE
  WHEN "service_area" = 'SHINJUKU' THEN '新宿駅周辺'
  WHEN "service_area" = 'SHIBUYA' THEN '渋谷駅周辺'
  ELSE '集合エリア周辺'
END;

ALTER TABLE "hangouts" ALTER COLUMN "public_location_name" SET NOT NULL;
