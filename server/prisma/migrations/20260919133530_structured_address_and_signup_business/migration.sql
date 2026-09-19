/*
  Warnings:

  - You are about to drop the column `address` on the `BusinessProfile` table. All the data in the column will be lost.
  - You are about to drop the column `address` on the `Client` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "BusinessProfile" DROP COLUMN "address",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zipCode" TEXT;

-- AlterTable
ALTER TABLE "Client" DROP COLUMN "address",
ADD COLUMN     "city" TEXT,
ADD COLUMN     "country" TEXT,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "street" TEXT,
ADD COLUMN     "zipCode" TEXT;
