-- Phase 4: workspace tenancy + recurring invoices + notifications + email log
--
-- 1. Tenancy: every business data row becomes workspace-scoped. Existing
--    single-user accounts are migrated one-per-workspace (creator becomes the
--    owner), and UserSettings is copied into the new workspace-level
--    WorkspaceSettings (team-shared currency / tax / invoice numbering).
-- 2. New features: recurring invoice schedules, the in-app notification feed,
--    and the email delivery log.

-- CreateEnum
CREATE TYPE "MembershipRole" AS ENUM ('owner', 'admin', 'staff', 'viewer');

-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('weekly', 'monthly', 'quarterly', 'yearly');

-- DropForeignKey
ALTER TABLE "BusinessProfile" DROP CONSTRAINT "BusinessProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "UserSettings" DROP CONSTRAINT "UserSettings_userId_fkey";

-- DropIndex
DROP INDEX "BusinessProfile_userId_key";

-- DropIndex
DROP INDEX "Invoice_userId_invoiceNumber_key";

-- DropIndex
DROP INDEX "Invoice_userId_status_idx";

-- DropIndex
DROP INDEX "Product_userId_idx";

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "MembershipRole" NOT NULL DEFAULT 'staff',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceSettings" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NPR',
    "defaultPaymentTerms" INTEGER NOT NULL DEFAULT 30,
    "invoicePrefix" TEXT NOT NULL DEFAULT 'INV-',
    "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
    "defaultTaxRate" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "paymentNotifications" BOOLEAN NOT NULL DEFAULT true,
    "reminderNotifications" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkspaceSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringInvoice" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "RecurringFrequency" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "nextRunDate" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "discount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecurringInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringItem" (
    "id" TEXT NOT NULL,
    "recurringInvoiceId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(65,30) NOT NULL,
    "unitPrice" DECIMAL(65,30) NOT NULL,
    CONSTRAINT "RecurringItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "type" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "simulated" BOOLEAN NOT NULL,
    "error" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- Add a nullable workspaceId first so existing rows can be backfilled below.
-- AlterTable
ALTER TABLE "BusinessProfile" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Client" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Product" ADD COLUMN "workspaceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "recurringId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "sentAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- Data migration: one workspace per existing user, owner membership, and all
-- their business data pointed at it.
-- ---------------------------------------------------------------------------
INSERT INTO "Workspace" (id, name, "createdBy", "inviteCode", "createdAt", "updatedAt")
SELECT gen_random_uuid(),
       COALESCE(NULLIF(bp."businessName", ''), u."name" || '''s Workspace'),
       u."id",
       NULL,
       now(),
       now()
FROM "User" u
LEFT JOIN "BusinessProfile" bp ON bp."userId" = u."id";

CREATE TEMP TABLE "_ws_map" ON COMMIT DROP AS
SELECT u."id" AS user_id, w."id" AS workspace_id
FROM "User" u
JOIN "Workspace" w ON w."createdBy" = u."id" AND w."createdAt" = (
  SELECT MAX(w2."createdAt") FROM "Workspace" w2 WHERE w2."createdBy" = u."id"
);

INSERT INTO "Membership" (id, "workspaceId", "userId", role, "createdAt")
SELECT gen_random_uuid(), m."workspace_id", m."user_id", 'owner', now()
FROM "_ws_map" m;

INSERT INTO "WorkspaceSettings"
  (id, "workspaceId", currency, "defaultPaymentTerms", "invoicePrefix",
   "nextInvoiceNumber", "defaultTaxRate", "emailNotifications",
   "paymentNotifications", "reminderNotifications", "createdAt", "updatedAt")
SELECT gen_random_uuid(), m."workspace_id",
       COALESCE(us."currency", 'NPR'),
       COALESCE(us."defaultPaymentTerms", 30),
       COALESCE(us."invoicePrefix", 'INV-'),
       COALESCE(us."nextInvoiceNumber", 1),
       COALESCE(us."defaultTaxRate", 0),
       COALESCE(us."emailNotifications", true),
       COALESCE(us."paymentNotifications", true),
       COALESCE(us."reminderNotifications", true),
       now(), now()
FROM "_ws_map" m
LEFT JOIN "UserSettings" us ON us."userId" = m."user_id";

UPDATE "BusinessProfile" bp SET "workspaceId" = m."workspace_id"
FROM "_ws_map" m WHERE m."user_id" = bp."userId";

UPDATE "Client" c SET "workspaceId" = m."workspace_id"
FROM "_ws_map" m WHERE m."user_id" = c."userId";

UPDATE "Invoice" i SET "workspaceId" = m."workspace_id"
FROM "_ws_map" m WHERE m."user_id" = i."userId";

UPDATE "Product" p SET "workspaceId" = m."workspace_id"
FROM "_ws_map" m WHERE m."user_id" = p."userId";

DROP TABLE "_ws_map";

-- Every existing row now carries a workspace, so the columns can be locked down.
ALTER TABLE "BusinessProfile" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Client" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Invoice" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Product" ALTER COLUMN "workspaceId" SET NOT NULL;

-- DropTable
DROP TABLE "UserSettings";

-- CreateIndex
CREATE UNIQUE INDEX "Workspace_inviteCode_key" ON "Workspace"("inviteCode");
CREATE INDEX "Membership_userId_idx" ON "Membership"("userId");
CREATE UNIQUE INDEX "Membership_workspaceId_userId_key" ON "Membership"("workspaceId", "userId");
CREATE UNIQUE INDEX "WorkspaceSettings_workspaceId_key" ON "WorkspaceSettings"("workspaceId");
CREATE INDEX "RecurringInvoice_workspaceId_active_idx" ON "RecurringInvoice"("workspaceId", "active");
CREATE INDEX "RecurringItem_recurringInvoiceId_idx" ON "RecurringItem"("recurringInvoiceId");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX "EmailLog_workspaceId_invoiceId_idx" ON "EmailLog"("workspaceId", "invoiceId");
CREATE UNIQUE INDEX "BusinessProfile_workspaceId_key" ON "BusinessProfile"("workspaceId");
CREATE INDEX "Client_workspaceId_idx" ON "Client"("workspaceId");
CREATE INDEX "Invoice_workspaceId_status_idx" ON "Invoice"("workspaceId", "status");
CREATE UNIQUE INDEX "Invoice_workspaceId_invoiceNumber_key" ON "Invoice"("workspaceId", "invoiceNumber");
CREATE INDEX "Product_workspaceId_idx" ON "Product"("workspaceId");

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceSettings" ADD CONSTRAINT "WorkspaceSettings_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BusinessProfile" ADD CONSTRAINT "BusinessProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_recurringId_fkey" FOREIGN KEY ("recurringId") REFERENCES "RecurringInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Product" ADD CONSTRAINT "Product_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringInvoice" ADD CONSTRAINT "RecurringInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_recurringInvoiceId_fkey" FOREIGN KEY ("recurringInvoiceId") REFERENCES "RecurringInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RecurringItem" ADD CONSTRAINT "RecurringItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;