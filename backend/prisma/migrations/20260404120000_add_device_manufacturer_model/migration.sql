-- AlterTable
ALTER TABLE "rack_device" ADD COLUMN "manufacturer" TEXT NOT NULL DEFAULT '';
ALTER TABLE "rack_device" ADD COLUMN "device_model" TEXT NOT NULL DEFAULT '';

-- Legacy rows: full label lived in `name`; treat as model until edited with a real manufacturer split.
UPDATE "rack_device"
SET "device_model" = "name"
WHERE "device_model" = '' AND "manufacturer" = '';
