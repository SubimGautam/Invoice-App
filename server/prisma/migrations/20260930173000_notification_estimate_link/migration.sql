-- Lets a quote notification link to its estimate instead of being a dead-end
-- row in the feed. Plain column (no FK) to match the existing invoiceId shape.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "estimateId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_estimateId_idx" ON "Notification"("estimateId");