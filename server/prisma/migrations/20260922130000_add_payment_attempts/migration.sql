-- CreateTable
-- Ledger for gateway checkouts (eSewa / simulated / future Khalti). A booking
-- is recorded before payment is confirmed so nothing double-records.
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "gateway" TEXT NOT NULL DEFAULT 'esewa',
    "transactionUuid" TEXT NOT NULL,
    "bookingId" TEXT,
    "correlationId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'created',
    "referenceCode" TEXT,
    "gatewayTxnId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_bookingId_key" ON "PaymentAttempt"("bookingId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_invoiceId_idx" ON "PaymentAttempt"("invoiceId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_workspaceId_createdAt_idx" ON "PaymentAttempt"("workspaceId", "createdAt");

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentAttempt" ADD CONSTRAINT "PaymentAttempt_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;