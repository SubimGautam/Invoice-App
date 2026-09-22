-- AlterTable
-- Adds the public "Pay now" link token to invoices.
ALTER TABLE "Invoice" ADD COLUMN     "paymentToken" TEXT;

-- Backfill every existing invoice with an unguessable token so old invoices
-- get working payment links immediately (no downtime, no manual step).
UPDATE "Invoice"
SET "paymentToken" = substr(md5(random()::text || clock_timestamp()::text || random()::text), 1, 32)
WHERE "paymentToken" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_paymentToken_key" ON "Invoice"("paymentToken");