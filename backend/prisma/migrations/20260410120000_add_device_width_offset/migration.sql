-- AlterTable
ALTER TABLE "rack_device" ADD COLUMN "device_width_inches" DOUBLE PRECISION NOT NULL DEFAULT 19;
ALTER TABLE "rack_device" ADD COLUMN "horizontal_offset_inches" DOUBLE PRECISION NOT NULL DEFAULT 0;
