-- CreateEnum
CREATE TYPE "TransferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "patient_transfers" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fromHospitalId" TEXT NOT NULL,
    "toHospitalId" TEXT NOT NULL,
    "initiatedById" TEXT NOT NULL,
    "respondedById" TEXT,
    "status" "TransferStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "responseNote" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patient_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "patient_transfers_patientId_status_idx" ON "patient_transfers"("patientId", "status");

-- CreateIndex
CREATE INDEX "patient_transfers_toHospitalId_status_idx" ON "patient_transfers"("toHospitalId", "status");

-- CreateIndex
CREATE INDEX "patient_transfers_fromHospitalId_status_idx" ON "patient_transfers"("fromHospitalId", "status");

-- AddForeignKey
ALTER TABLE "patient_transfers" ADD CONSTRAINT "patient_transfers_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_transfers" ADD CONSTRAINT "patient_transfers_fromHospitalId_fkey" FOREIGN KEY ("fromHospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_transfers" ADD CONSTRAINT "patient_transfers_toHospitalId_fkey" FOREIGN KEY ("toHospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_transfers" ADD CONSTRAINT "patient_transfers_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "patient_transfers" ADD CONSTRAINT "patient_transfers_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
