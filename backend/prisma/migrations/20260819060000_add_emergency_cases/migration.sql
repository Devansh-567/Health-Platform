-- CreateEnum
CREATE TYPE "EmergencyCaseStatus" AS ENUM ('MONITORING', 'DISPATCHED', 'ACKNOWLEDGED', 'ASSIGNED', 'ARRIVED', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HospitalSelectionMethod" AS ENUM ('MANUAL', 'AUTO_NEAREST');

-- CreateTable
CREATE TABLE "emergency_cases" (
    "id" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "paramedicId" TEXT NOT NULL,
    "patientId" TEXT,
    "unknownPatientLabel" TEXT,
    "status" "EmergencyCaseStatus" NOT NULL DEFAULT 'MONITORING',
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "pickupAddress" TEXT,
    "hospitalId" TEXT,
    "selectionMethod" "HospitalSelectionMethod",
    "mqttTopic" TEXT NOT NULL,
    "latestHeartRate" INTEGER,
    "latestSpo2" INTEGER,
    "latestSystolic" INTEGER,
    "latestDiastolic" INTEGER,
    "latestRespRate" INTEGER,
    "latestTempC" DOUBLE PRECISION,
    "latestReadingAt" TIMESTAMP(3),
    "isAbnormal" BOOLEAN NOT NULL DEFAULT false,
    "assignedDoctorId" TEXT,
    "assignedById" TEXT,
    "acknowledgedById" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3),
    "arrivedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emergency_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "emergency_cases_hospitalId_status_idx" ON "emergency_cases"("hospitalId", "status");
CREATE INDEX "emergency_cases_paramedicId_status_idx" ON "emergency_cases"("paramedicId", "status");
CREATE INDEX "emergency_cases_assignedDoctorId_status_idx" ON "emergency_cases"("assignedDoctorId", "status");

ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_paramedicId_fkey" FOREIGN KEY ("paramedicId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "patient_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_assignedDoctorId_fkey" FOREIGN KEY ("assignedDoctorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "emergency_cases" ADD CONSTRAINT "emergency_cases_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
