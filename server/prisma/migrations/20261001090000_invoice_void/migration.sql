-- Void instead of delete: an invoice that has been sent, or that has payments
-- against it, is financial history. Deleting the row cascaded to Payment and
-- AuditLog, destroying the record. Voiding retains the invoice + its audit trail
-- and its payments, while removing it from every total.
--
-- The three status values before 'void' keep their meaning; 'void' is a new
-- terminal state.

-- AlterEnum
ALTER TYPE "InvoiceStatus" ADD VALUE 'void';

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "voidedAt" TIMESTAMP(3),
ADD COLUMN     "voidedByUserId" TEXT,
ADD COLUMN     "voidReason" TEXT;