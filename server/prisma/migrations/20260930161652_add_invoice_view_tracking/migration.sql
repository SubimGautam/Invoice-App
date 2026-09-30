-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "firstViewedAt" TIMESTAMP(3),
ADD COLUMN     "lastViewedAt" TIMESTAMP(3),
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;
