-- CreateEnum
CREATE TYPE "StockReason" AS ENUM ('RESTOCK', 'ADJUST', 'ORDER', 'CANCEL', 'IMPORT', 'EDIT');

-- CreateEnum
CREATE TYPE "PointReason" AS ENUM ('ORDER', 'REVIEW', 'REFERRAL', 'REDEEM', 'ADMIN', 'REVERSAL');

-- AlterTable
ALTER TABLE "AdminUser" ADD COLUMN     "notificationsSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "badgeText" TEXT,
ADD COLUMN     "buyQty" INTEGER,
ADD COLUMN     "getQty" INTEGER,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "minQty" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN     "scopeIds" TEXT[];

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "notes" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "points" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "referralCode" TEXT,
ADD COLUMN     "referredById" TEXT,
ADD COLUMN     "tags" TEXT[];

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "billingCompany" TEXT,
ADD COLUMN     "billingGstin" TEXT,
ADD COLUMN     "pointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pointsRedeemed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "gstRate" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "hsn" TEXT;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "gstRate" INTEGER NOT NULL DEFAULT 18,
ADD COLUMN     "hsn" TEXT,
ADD COLUMN     "options" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "Variant" ADD COLUMN     "barcode" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "lowStockAt" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "options" JSONB NOT NULL DEFAULT '{}';

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "reason" "StockReason" NOT NULL,
    "note" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "reason" "PointReason" NOT NULL,
    "note" TEXT,
    "orderId" TEXT,
    "reviewId" TEXT,
    "actor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentPage" (
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentPage_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "StockMovement_variantId_createdAt_idx" ON "StockMovement"("variantId", "createdAt");

-- CreateIndex
CREATE INDEX "PointTransaction_customerId_createdAt_idx" ON "PointTransaction"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PointTransaction_reason_orderId_key" ON "PointTransaction"("reason", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "PointTransaction_reason_reviewId_key" ON "PointTransaction"("reason", "reviewId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_referralCode_key" ON "Customer"("referralCode");

-- CreateIndex
CREATE INDEX "Variant_barcode_idx" ON "Variant"("barcode");

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PointTransaction" ADD CONSTRAINT "PointTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

