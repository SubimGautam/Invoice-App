-- AlterTable: invoice numbers are generated per-user, so uniqueness must be
-- scoped to (userId, invoiceNumber) instead of being global. This lets each
-- business start numbering at INV-0001 without colliding with other users.
DROP INDEX "Invoice_invoiceNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_userId_invoiceNumber_key" ON "Invoice"("userId", "invoiceNumber");