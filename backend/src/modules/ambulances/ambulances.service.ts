import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

const MANUAL_STATUSES = ["AVAILABLE", "MAINTENANCE", "OFFLINE"] as const;

function resolveHospitalScope(actor: Actor, requestedHospitalId?: string): string {
  if (actor.roleCode === "SUPER_ADMIN") {
    if (!requestedHospitalId) throw ApiError.badRequest("hospitalId is required");
    return requestedHospitalId;
  }
  if (!actor.hospitalId) {
    throw ApiError.badRequest(
      "Your account isn't linked to a hospital yet — contact a super admin.",
      "NO_HOSPITAL_ASSIGNED"
    );
  }
  return actor.hospitalId;
}

const ambulanceSelect = {
  id: true,
  vehicleNumber: true,
  status: true,
  currentLat: true,
  currentLng: true,
  lastLocationAt: true,
  createdAt: true,
  hospital: { select: { id: true, name: true, code: true } },
  assignedDriver: { select: { id: true, firstName: true, lastName: true } },
} as const;

export async function createAmbulance(actor: Actor, input: { hospitalId?: string; vehicleNumber: string }) {
  const hospitalId = resolveHospitalScope(actor, input.hospitalId);

  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital || !hospital.isActive) throw ApiError.badRequest("Hospital not found or inactive");

  const existing = await prisma.ambulance.findUnique({ where: { vehicleNumber: input.vehicleNumber } });
  if (existing) throw ApiError.conflict("An ambulance with this vehicle number already exists");

  const ambulance = await prisma.ambulance.create({
    data: {
      hospitalId,
      vehicleNumber: input.vehicleNumber,
      currentLat: hospital.latitude,
      currentLng: hospital.longitude,
      lastLocationAt: hospital.latitude != null ? new Date() : null,
    },
    select: ambulanceSelect,
  });

  await writeAudit({ userId: actor.id, action: "AMBULANCE.CREATED", entityType: "Ambulance", entityId: ambulance.id });
  return ambulance;
}

export async function listAmbulances(actor: Actor, filters: { status?: string; hospitalId?: string }) {
  const where: any = {};
  if (actor.roleCode === "SUPER_ADMIN") {
    if (filters.hospitalId) where.hospitalId = filters.hospitalId;
  } else {
    if (!actor.hospitalId) {
      throw ApiError.badRequest("Your account isn't linked to a hospital yet.", "NO_HOSPITAL_ASSIGNED");
    }
    where.hospitalId = actor.hospitalId;
  }
  if (filters.status) where.status = filters.status;

  return prisma.ambulance.findMany({ where, select: ambulanceSelect, orderBy: { vehicleNumber: "asc" } });
}

async function resolveScopedAmbulance(actor: Actor, ambulanceId: string) {
  const ambulance = await prisma.ambulance.findUnique({ where: { id: ambulanceId } });
  if (!ambulance) throw ApiError.notFound("Ambulance not found");
  if (actor.roleCode !== "SUPER_ADMIN" && ambulance.hospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("You don't have access to this ambulance");
  }
  return ambulance;
}

export async function getAmbulance(actor: Actor, ambulanceId: string) {
  await resolveScopedAmbulance(actor, ambulanceId);
  return prisma.ambulance.findUnique({ where: { id: ambulanceId }, select: ambulanceSelect });
}

/**
 * "My ambulance" for a driver — resolved from the persistent assignment an
 * admin sets (see assignDriver below), not chosen by the driver each time.
 * A driver who hasn't been assigned a vehicle yet gets a clear null so the
 * UI can prompt them to contact an admin, rather than a confusing empty list.
 */
export async function getMyAmbulance(actor: Actor) {
  if (actor.roleCode !== "DRIVER") throw ApiError.forbidden("Only a driver has an assigned ambulance");
  return prisma.ambulance.findUnique({ where: { assignedDriverId: actor.id }, select: ambulanceSelect });
}

/** Admin sets (or clears, with driverId: null) which driver regularly operates a vehicle. */
export async function assignDriver(actor: Actor, ambulanceId: string, driverId: string | null) {
  const ambulance = await resolveScopedAmbulance(actor, ambulanceId);

  if (driverId) {
    const driver = await prisma.user.findFirst({ where: { id: driverId, deletedAt: null }, include: { role: true } });
    if (!driver || driver.role.code !== "DRIVER") throw ApiError.badRequest("Selected driver not found");
    if (driver.hospitalId !== ambulance.hospitalId) {
      throw ApiError.badRequest("The driver must belong to the same hospital as the ambulance");
    }
    const alreadyAssignedElsewhere = await prisma.ambulance.findFirst({
      where: { assignedDriverId: driverId, id: { not: ambulanceId } },
    });
    if (alreadyAssignedElsewhere) {
      throw ApiError.conflict(`This driver is already assigned to ${alreadyAssignedElsewhere.vehicleNumber}`);
    }
  }

  const updated = await prisma.ambulance.update({
    where: { id: ambulanceId },
    data: { assignedDriverId: driverId },
    select: ambulanceSelect,
  });

  await writeAudit({
    userId: actor.id,
    action: "AMBULANCE.DRIVER_ASSIGNED",
    entityType: "Ambulance",
    entityId: ambulanceId,
    metadata: { driverId },
  });
  return updated;
}

export async function setAmbulanceStatus(actor: Actor, ambulanceId: string, status: string) {
  if (!(MANUAL_STATUSES as readonly string[]).includes(status)) {
    throw ApiError.badRequest(
      "Status can only be manually set to AVAILABLE, MAINTENANCE or OFFLINE — ON_TRIP is managed automatically by trip dispatch."
    );
  }
  const ambulance = await resolveScopedAmbulance(actor, ambulanceId);
  if (ambulance.status === "ON_TRIP") {
    throw ApiError.conflict("This ambulance is currently on a trip and can't have its status changed manually");
  }

  const updated = await prisma.ambulance.update({ where: { id: ambulanceId }, data: { status }, select: ambulanceSelect });
  await writeAudit({
    userId: actor.id,
    action: "AMBULANCE.STATUS_UPDATED",
    entityType: "Ambulance",
    entityId: ambulanceId,
    metadata: { status },
  });
  return updated;
}

/**
 * Live GPS ingestion from the driver's phone (scheduled-trip driver console
 * or the emergency console). Scoped tightly: only the driver currently
 * holding an ACTIVE scheduled trip OR an ACTIVE emergency case on this exact
 * ambulance may push a position for it — this is what stops a driver from
 * overwriting a vehicle's location when they're not actually on duty with
 * it, and stops anyone who isn't a DRIVER at all.
 */
export async function recordLocation(
  actor: Actor,
  ambulanceId: string,
  input: { lat: number; lng: number; speedKph?: number; headingDeg?: number }
) {
  if (actor.roleCode !== "DRIVER") throw ApiError.forbidden("Only a driver can report ambulance location");

  const [activeTrip, activeEmergencyCase] = await Promise.all([
    prisma.ambulanceTrip.findFirst({
      where: {
        ambulanceId,
        driverId: actor.id,
        status: { in: ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "ARRIVED_AT_PICKUP", "EN_ROUTE_TO_HOSPITAL"] },
      },
      select: { id: true },
    }),
    prisma.emergencyCase.findFirst({
      where: {
        ambulanceId,
        paramedicId: actor.id,
        status: { in: ["MONITORING", "DISPATCHED", "ACKNOWLEDGED", "ASSIGNED"] },
      },
      select: { id: true },
    }),
  ]);
  if (!activeTrip && !activeEmergencyCase) {
    throw ApiError.forbidden("You don't have an active trip or emergency case on this ambulance right now");
  }

  const [ambulance] = await prisma.$transaction([
    prisma.ambulance.update({
      where: { id: ambulanceId },
      data: { currentLat: input.lat, currentLng: input.lng, lastLocationAt: new Date() },
      select: ambulanceSelect,
    }),
    prisma.ambulanceLocationPing.create({
      data: {
        ambulanceId,
        tripId: activeTrip?.id,
        lat: input.lat,
        lng: input.lng,
        speedKph: input.speedKph,
        headingDeg: input.headingDeg,
      },
    }),
  ]);

  return ambulance;
}
