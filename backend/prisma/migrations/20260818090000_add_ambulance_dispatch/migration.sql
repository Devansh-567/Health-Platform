-- AlterTable: Hospital gets geocoded coordinates (needed as trip destination)
ALTER TABLE "hospitals" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "hospitals" ADD COLUMN "longitude" DOUBLE PRECISION;

-- CreateTable: driver_profiles
CREATE TABLE "driver_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "licenseNumber" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "driver_profiles_userId_key" ON "driver_profiles"("userId");
CREATE UNIQUE INDEX "driver_profiles_licenseNumber_key" ON "driver_profiles"("licenseNumber");

ALTER TABLE "driver_profiles" ADD CONSTRAINT "driver_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "AmbulanceStatus" AS ENUM ('AVAILABLE', 'ON_TRIP', 'MAINTENANCE', 'OFFLINE');

-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('ASSIGNED', 'EN_ROUTE_TO_PICKUP', 'ARRIVED_AT_PICKUP', 'EN_ROUTE_TO_HOSPITAL', 'COMPLETED', 'CANCELLED');

-- CreateTable: ambulances
CREATE TABLE "ambulances" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "status" "AmbulanceStatus" NOT NULL DEFAULT 'AVAILABLE',
    "currentLat" DOUBLE PRECISION,
    "currentLng" DOUBLE PRECISION,
    "lastLocationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulances_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ambulances_vehicleNumber_key" ON "ambulances"("vehicleNumber");
CREATE INDEX "ambulances_hospitalId_status_idx" ON "ambulances"("hospitalId", "status");

ALTER TABLE "ambulances" ADD CONSTRAINT "ambulances_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "hospitals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ambulance_trips
CREATE TABLE "ambulance_trips" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "status" "TripStatus" NOT NULL DEFAULT 'ASSIGNED',
    "pickupLat" DOUBLE PRECISION NOT NULL,
    "pickupLng" DOUBLE PRECISION NOT NULL,
    "pickupAddress" TEXT,
    "destinationLat" DOUBLE PRECISION NOT NULL,
    "destinationLng" DOUBLE PRECISION NOT NULL,
    "destinationLabel" TEXT,
    "distanceMeters" DOUBLE PRECISION,
    "etaSeconds" INTEGER,
    "routeGeometry" JSONB,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enRouteToPickupAt" TIMESTAMP(3),
    "arrivedAtPickupAt" TIMESTAMP(3),
    "enRouteToHospitalAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ambulance_trips_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ambulance_trips_transferId_idx" ON "ambulance_trips"("transferId");
CREATE INDEX "ambulance_trips_ambulanceId_status_idx" ON "ambulance_trips"("ambulanceId", "status");
CREATE INDEX "ambulance_trips_driverId_status_idx" ON "ambulance_trips"("driverId", "status");

ALTER TABLE "ambulance_trips" ADD CONSTRAINT "ambulance_trips_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "patient_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambulance_trips" ADD CONSTRAINT "ambulance_trips_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ambulance_trips" ADD CONSTRAINT "ambulance_trips_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: ambulance_location_pings
CREATE TABLE "ambulance_location_pings" (
    "id" TEXT NOT NULL,
    "ambulanceId" TEXT NOT NULL,
    "tripId" TEXT,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "speedKph" DOUBLE PRECISION,
    "headingDeg" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ambulance_location_pings_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ambulance_location_pings_ambulanceId_recordedAt_idx" ON "ambulance_location_pings"("ambulanceId", "recordedAt");
CREATE INDEX "ambulance_location_pings_tripId_recordedAt_idx" ON "ambulance_location_pings"("tripId", "recordedAt");

ALTER TABLE "ambulance_location_pings" ADD CONSTRAINT "ambulance_location_pings_ambulanceId_fkey" FOREIGN KEY ("ambulanceId") REFERENCES "ambulances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambulance_location_pings" ADD CONSTRAINT "ambulance_location_pings_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "ambulance_trips"("id") ON DELETE SET NULL ON UPDATE CASCADE;
