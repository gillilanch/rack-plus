-- CreateTable
CREATE TABLE "fox_employee_extra" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "normalized_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fox_employee_extra_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "fox_employee_extra_normalized_key_key" ON "fox_employee_extra"("normalized_key");
