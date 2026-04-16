-- Catalog: parsed I/O ports from Fox AVCAD sheet (JSON array of {type,direction,label,count}).
ALTER TABLE "catalog_device" ADD COLUMN IF NOT EXISTS "ports" JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Rack device: freeform notes (e.g. catalog description); editable in UI.
ALTER TABLE "rack_device" ADD COLUMN IF NOT EXISTS "device_notes" TEXT;
