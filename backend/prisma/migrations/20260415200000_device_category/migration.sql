-- CreateTable
CREATE TABLE "device_category" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_category_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "device_category_normalized_key_key" ON "device_category"("normalized_key");

INSERT INTO "device_category" ("id", "name", "normalized_key", "created_at")
SELECT gen_random_uuid()::text, 'Other', 'other', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "device_category" WHERE "normalized_key" = 'other');
