-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "rack" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "total_height_u" INTEGER NOT NULL,
    "slack_allowance" DOUBLE PRECISION NOT NULL,
    "connections" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rack_device" (
    "id" TEXT NOT NULL,
    "rack_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "height_in_u" INTEGER NOT NULL,
    "rack_position" INTEGER,
    "physical_height_inches" DECIMAL(10,2),
    "catalog_device_id" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rack_device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_port" (
    "id" TEXT NOT NULL,
    "rack_device_id" TEXT NOT NULL,
    "connector_type" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "label" TEXT,
    "port_count" INTEGER NOT NULL DEFAULT 1,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "device_port_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "rack_device_rack_id_idx" ON "rack_device"("rack_id");

-- CreateIndex
CREATE INDEX "device_port_rack_device_id_idx" ON "device_port"("rack_device_id");

-- AddForeignKey
ALTER TABLE "rack_device" ADD CONSTRAINT "rack_device_rack_id_fkey" FOREIGN KEY ("rack_id") REFERENCES "rack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_port" ADD CONSTRAINT "device_port_rack_device_id_fkey" FOREIGN KEY ("rack_device_id") REFERENCES "rack_device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
