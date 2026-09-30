-- AlterTable
ALTER TABLE "RecurringInvoice" ADD COLUMN     "autoSend" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "maxOccurrences" INTEGER,
ADD COLUMN     "occurrences" INTEGER NOT NULL DEFAULT 0;
