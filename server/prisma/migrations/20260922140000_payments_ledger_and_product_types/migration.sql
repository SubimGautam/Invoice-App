-- Payments ledger + product types.
-- 1) Payment: workspace scoping (unallocated receipts have no invoice), an
--    optional invoice link, kind (payment|refund) + status, and a self link so
--    refunds point at the original payment.
-- 2) Product: a Service | Product | Retainer type.

-- Add workspaceId as nullable first, backfill from each payment's invoice,
-- then enforce NOT NULL.
ALTER TABLE "Payment" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'payment';
ALTER TABLE "Payment" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'settled';
ALTER TABLE "Payment" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "refundOfId" TEXT;
ALTER TABLE "Payment" ALTER COLUMN "invoiceId" DROP NOT NULL;

UPDATE "Payment" SET "workspaceId" = "i"."workspaceId"
FROM (SELECT "id", "workspaceId" FROM "Invoice") AS "i"
WHERE "Payment"."invoiceId" = "i"."id";

ALTER TABLE "Payment" ALTER COLUMN "workspaceId" SET NOT NULL;

-- Product type, defaulting everything existing to Service.
ALTER TABLE "Product" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'Service';

CREATE INDEX "Payment_workspaceId_paymentDate_idx" ON "Payment"("workspaceId", "paymentDate");
CREATE INDEX "Payment_refundOfId_idx" ON "Payment"("refundOfId");

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_refundOfId_fkey" FOREIGN KEY ("refundOfId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;