import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";
import { getRouteWithFallback } from "../../utils/osrm";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

const ACTIVE_STATUSES = ["ASSIGNED", "EN_ROUTE_TO_PICKUP", "ARRIVED_AT_PICKUP", "EN_ROUTE_TO_HOSPITAL"] as const;

const FORWARD_TRANSITIONS: Record<string, string> = {
  ASSIGNED: "EN_ROUTE_TO_PICKUP",
  EN_ROUTE_TO_PICKUP: "ARRIVED_AT_PICKUP",
  ARRIVED_AT_PICKUP: "EN_ROUTE_TO_HOSPITAL",
  EN_ROUTE_TO_HOSPITAL: "COMPLETED",
};

const TRANSITION_TIMESTAMP_FIELD: Record<string, string> = {
  EN_ROUTE_TO_PICKUP: "enRouteToPickupAt",
  ARRIVED_AT_PICKUP: "arrivedAtPickupAt",
  EN_ROUTE_TO_HOSPITAL: "enRouteToHospitalAt",
  COMPLETED: "completedAt",
  CANCELLED: "cancelledAt",
};

const tripSelect = {
  id: true,
  status: true,
  pickupLat: true,
  pickupLng: true,
  pickupAddress: true,
  destinationLat: true,
  destinationLng: true,
  destinationLabel: true,
  distanceMeters: true,
  etaSeconds: true,
  routeGeometry: true,
  assignedAt: true,
  enRouteToPickupAt: true,
  arrivedAtPickupAt: true,
  enRouteToHospitalAt: true,
  completedAt: true,
  cancelledAt: true,
  transferId: true,
  transfer: {
    select: {
      id: true,
      status: true,
      fromHospital: { select: { id: true, name: true } },
      toHospital: { select: { id: true, name: true } },
      patient: {
        select: { id: true, medicalRecordNo: true, user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  },
  ambulance: {
    select: { id: true, vehicleNumber: true, currentLat: true, currentLng: true, lastLocationAt: true, status: true },
  },
  driver: { select: { id: true, firstName: true, lastName: true, phone: true } },
} as const;

/**
 * Dispatch is the physical execution of an already-ACCEPTED transfer: pick
 * an ambulance + driver belonging to EITHER side of the transfer (whichever
 * hospital is providing transport) and — unless an explicit pickup point is
 * given (accident site, patient's home, etc.) — default the pickup to the
 * sending hospital's own coordinates.
 */
export async function dispatchTrip(
  actor: Actor,
  input: {
    transferId: string;
    ambulanceId: string;
    driverId: string;
    pickupLat?: number;
    pickupLng?: number;
    pickupAddress?: string;
  }
) {
  const transfer = await prisma.patientTransfer.findUnique({ where: { id: input.transferId } });
  if (!transfer) throw ApiError.notFound("Transfer not found");
  if (transfer.status !== "ACCEPTED") {
    throw ApiError.badRequest("An ambulance can only be dispatched once the receiving hospital has accepted the transfer");
  }

  const [ambulance, driver, existingActiveTrip] = await Promise.all([
    prisma.ambulance.findUnique({ where: { id: input.ambulanceId } }),
    prisma.user.findFirst({ where: { id: input.driverId, deletedAt: null }, include: { role: true } }),
    prisma.ambulanceTrip.findFirst({ where: { transferId: input.transferId, status: { in: ACTIVE_STATUSES as any } } }),
  ]);

  if (existingActiveTrip) throw ApiError.conflict("This transfer already has an active ambulance trip");
  if (!ambulance) throw ApiError.notFound("Ambulance not found");
  if (![transfer.fromHospitalId, transfer.toHospitalId].includes(ambulance.hospitalId)) {
    throw ApiError.badRequest("The ambulance must belong to either the sending or receiving hospital");
  }
  if (ambulance.status !== "AVAILABLE") throw ApiError.conflict("This ambulance isn't available right now");

  // An admin may only dispatch a vehicle their own hospital actually owns —
  // Super Admin is unrestricted, consistent with everywhere else.
  if (actor.roleCode !== "SUPER_ADMIN" && actor.hospitalId !== ambulance.hospitalId) {
    throw ApiError.forbidden("You can only dispatch an ambulance that belongs to your own hospital");
  }

  if (!driver || driver.role.code !== "DRIVER") throw ApiError.badRequest("Selected driver not found");
  if (driver.hospitalId !== ambulance.hospitalId) {
    throw ApiError.badRequest("The driver must belong to the same hospital as the ambulance");
  }
  const driverBusy = await prisma.ambulanceTrip.findFirst({
    where: { driverId: driver.id, status: { in: ACTIVE_STATUSES as any } },
  });
  if (driverBusy) throw ApiError.conflict("This driver is already on another active trip");

  const [fromHospital, toHospital] = await Promise.all([
    prisma.hospital.findUnique({ where: { id: transfer.fromHospitalId } }),
    prisma.hospital.findUnique({ where: { id: transfer.toHospitalId } }),
  ]);

  const pickupLat = input.pickupLat ?? fromHospital?.latitude ?? undefined;
  const pickupLng = input.pickupLng ?? fromHospital?.longitude ?? undefined;
  if (pickupLat == null || pickupLng == null) {
    throw ApiError.badRequest(
      "No pickup location given, and the sending hospital has no coordinates set. Provide a pickup location, or ask a super admin to set the hospital's coordinates first.",
      "PICKUP_COORDINATES_REQUIRED"
    );
  }
  if (toHospital?.latitude == null || toHospital?.longitude == null) {
    throw ApiError.badRequest(
      `${toHospital?.name ?? "The receiving hospital"} has no coordinates set — ask a super admin to add them before dispatching.`,
      "DESTINATION_COORDINATES_REQUIRED"
    );
  }

  const route = await getRouteWithFallback(pickupLat, pickupLng, toHospital.latitude, toHospital.longitude);

  const trip = await prisma.$transaction(async (tx) => {
    const created = await tx.ambulanceTrip.create({
      data: {
        transferId: input.transferId,
        ambulanceId: input.ambulanceId,
        driverId: input.driverId,
        pickupLat,
        pickupLng,
        pickupAddress: input.pickupAddress ?? fromHospital?.name ?? null,
        destinationLat: toHospital.latitude!,
        destinationLng: toHospital.longitude!,
        destinationLabel: toHospital.name,
        distanceMeters: route.distanceMeters,
        etaSeconds: Math.round(route.etaSeconds),
        routeGeometry: route.geometry,
      },
      select: tripSelect,
    });
    await tx.ambulance.update({ where: { id: input.ambulanceId }, data: { status: "ON_TRIP" } });
    return created;
  });

  await writeAudit({
    userId: actor.id,
    action: "AMBULANCE_TRIP.DISPATCHED",
    entityType: "AmbulanceTrip",
    entityId: trip.id,
    metadata: { transferId: input.transferId, ambulanceId: input.ambulanceId, driverId: input.driverId },
  });

  return trip;
}

function scopeWhere(actor: Actor): any {
  if (actor.roleCode === "SUPER_ADMIN") return {};
  if (actor.roleCode === "DRIVER") return { driverId: actor.id };
  if (actor.roleCode === "PATIENT") return { transfer: { patient: { userId: actor.id } } };

  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital yet.", "NO_HOSPITAL_ASSIGNED");
  }
  // ADMIN / DOCTOR / NURSE: any trip touching their hospital on either side.
  return { transfer: { OR: [{ fromHospitalId: actor.hospitalId }, { toHospitalId: actor.hospitalId }] } };
}

export async function listTrips(actor: Actor, filters: { status?: string; transferId?: string }) {
  const where: any = { ...scopeWhere(actor) };
  if (filters.status) where.status = filters.status;
  if (filters.transferId) where.transferId = filters.transferId;
  return prisma.ambulanceTrip.findMany({ where, select: tripSelect, orderBy: { assignedAt: "desc" } });
}

async function resolveScopedTrip(actor: Actor, tripId: string) {
  const trip = await prisma.ambulanceTrip.findUnique({
    where: { id: tripId },
    include: { transfer: { include: { patient: { select: { userId: true } } } } },
  });
  if (!trip) throw ApiError.notFound("Trip not found");

  if (actor.roleCode === "SUPER_ADMIN") return trip;
  if (actor.roleCode === "DRIVER") {
    if (trip.driverId !== actor.id) throw ApiError.forbidden("You don't have access to this trip");
    return trip;
  }
  if (actor.roleCode === "PATIENT") {
    if (trip.transfer.patient.userId !== actor.id) throw ApiError.forbidden("You don't have access to this trip");
    return trip;
  }
  if (!actor.hospitalId || ![trip.transfer.fromHospitalId, trip.transfer.toHospitalId].includes(actor.hospitalId)) {
    throw ApiError.forbidden("You don't have access to this trip");
  }
  return trip;
}

export async function getTrip(actor: Actor, tripId: string) {
  await resolveScopedTrip(actor, tripId);
  const trip = await prisma.ambulanceTrip.findUnique({ where: { id: tripId }, select: tripSelect });
  if (!trip) throw ApiError.notFound("Trip not found");

  // Recent breadcrumb trail for drawing "path traveled so far" on the map —
  // capped well above what a normal trip would ever produce even pinging
  // every few seconds.
  const pings = await prisma.ambulanceLocationPing.findMany({
    where: { tripId },
    orderBy: { recordedAt: "asc" },
    take: 1000,
    select: { lat: true, lng: true, speedKph: true, headingDeg: true, recordedAt: true },
  });

  return { ...trip, pings };
}

/**
 * The assigned driver advances a trip one stage at a time; an admin at
 * either hospital (or Super Admin) may cancel it at any non-terminal stage,
 * but doesn't otherwise skip the driver's own progress reporting.
 */
export async function updateTripStatus(actor: Actor, tripId: string, nextStatus: string) {
  const trip = await prisma.ambulanceTrip.findUnique({ where: { id: tripId }, include: { transfer: true, ambulance: true } });
  if (!trip) throw ApiError.notFound("Trip not found");

  const isDriver = actor.roleCode === "DRIVER" && trip.driverId === actor.id;
  const isScopedAdmin =
    actor.roleCode === "SUPER_ADMIN" ||
    (actor.roleCode !== "DRIVER" &&
      !!actor.hospitalId &&
      [trip.transfer.fromHospitalId, trip.transfer.toHospitalId].includes(actor.hospitalId));

  if (!isDriver && !isScopedAdmin) throw ApiError.forbidden("You don't have access to this trip");
  if (trip.status === "COMPLETED" || trip.status === "CANCELLED") {
    throw ApiError.conflict("This trip has already ended");
  }

  if (nextStatus === "CANCELLED") {
    if (!isDriver && !isScopedAdmin) throw ApiError.forbidden("You don't have access to this trip");
  } else {
    if (!isDriver) throw ApiError.forbidden("Only the assigned driver can advance a trip's status");
    if (FORWARD_TRANSITIONS[trip.status] !== nextStatus) {
      throw ApiError.badRequest(`A trip must move through stages in order — expected "${FORWARD_TRANSITIONS[trip.status]}"`);
    }
  }

  const data: any = { status: nextStatus };
  const tsField = TRANSITION_TIMESTAMP_FIELD[nextStatus];
  if (tsField) data[tsField] = new Date();

  // Refresh the route/ETA from the ambulance's actual current position at
  // the two points where that matters most: setting off toward pickup, and
  // setting off toward the hospital with the patient aboard.
  if (nextStatus === "EN_ROUTE_TO_PICKUP" || nextStatus === "EN_ROUTE_TO_HOSPITAL") {
    const fromLat = trip.ambulance.currentLat ?? trip.pickupLat;
    const fromLng = trip.ambulance.currentLng ?? trip.pickupLng;
    const [toLat, toLng] =
      nextStatus === "EN_ROUTE_TO_PICKUP" ? [trip.pickupLat, trip.pickupLng] : [trip.destinationLat, trip.destinationLng];
    const route = await getRouteWithFallback(fromLat, fromLng, toLat, toLng);
    data.distanceMeters = route.distanceMeters;
    data.etaSeconds = Math.round(route.etaSeconds);
    data.routeGeometry = route.geometry;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.ambulanceTrip.update({ where: { id: tripId }, data, select: tripSelect });
    if (nextStatus === "COMPLETED" || nextStatus === "CANCELLED") {
      await tx.ambulance.update({ where: { id: trip.ambulanceId }, data: { status: "AVAILABLE" } });
    }
    return t;
  });

  await writeAudit({ userId: actor.id, action: `AMBULANCE_TRIP.${nextStatus}`, entityType: "AmbulanceTrip", entityId: tripId });
  return updated;
}
