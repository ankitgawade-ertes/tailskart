-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PrescriptionStatus" AS ENUM ('RECEIVED', 'IN_REVIEW', 'NEEDS_INFO', 'READY_FOR_PICKUP', 'COLLECTED', 'REJECTED');

-- CreateTable
CREATE TABLE "AppointmentRequest" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "petName" TEXT NOT NULL,
    "species" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "preferredDate" TIMESTAMP(3) NOT NULL,
    "preferredSlot" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'REQUESTED',
    "staffNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppointmentRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PrescriptionRequest" (
    "id" TEXT NOT NULL,
    "seq" SERIAL NOT NULL,
    "customerId" TEXT NOT NULL,
    "petName" TEXT NOT NULL,
    "branch" TEXT NOT NULL,
    "note" TEXT,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileMime" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "status" "PrescriptionStatus" NOT NULL DEFAULT 'RECEIVED',
    "staffNote" TEXT,
    "readyAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PrescriptionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppointmentRequest_seq_key" ON "AppointmentRequest"("seq");

-- CreateIndex
CREATE INDEX "AppointmentRequest_status_createdAt_idx" ON "AppointmentRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "AppointmentRequest_customerId_idx" ON "AppointmentRequest"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PrescriptionRequest_seq_key" ON "PrescriptionRequest"("seq");

-- CreateIndex
CREATE INDEX "PrescriptionRequest_status_createdAt_idx" ON "PrescriptionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PrescriptionRequest_customerId_idx" ON "PrescriptionRequest"("customerId");

-- AddForeignKey
ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrescriptionRequest" ADD CONSTRAINT "PrescriptionRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
