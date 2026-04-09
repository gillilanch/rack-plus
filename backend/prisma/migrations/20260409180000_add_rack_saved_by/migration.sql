-- AlterTable
ALTER TABLE "rack" ADD COLUMN "saved_by_display_name" TEXT,
ADD COLUMN "saved_by_verified" BOOLEAN NOT NULL DEFAULT false;
