-- CreateTable
CREATE TABLE "catalog_device" (
    "id" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "manufacturer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "sheet_category" TEXT NOT NULL,
    "app_category" TEXT NOT NULL,
    "power" TEXT,
    "width_inches" DOUBLE PRECISION,
    "height_inches" DOUBLE PRECISION,
    "depth_inches" DOUBLE PRECISION,
    "notes" TEXT,
    "height_in_u" INTEGER NOT NULL,
    "last_synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "catalog_device_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "catalog_device_normalized_key_key" ON "catalog_device"("normalized_key");

-- CreateIndex
CREATE INDEX "catalog_device_manufacturer_idx" ON "catalog_device"("manufacturer");
