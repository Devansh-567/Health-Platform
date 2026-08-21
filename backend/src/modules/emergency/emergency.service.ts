import { randomUUID } from "crypto";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";
import { publishMqtt } from "../../utils/mqtt";
import { getRouteWithFallback } from "../../utils/osrm";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

const ACTIVE_STATUSES = ["MONITORING", "DISPATCHED", "ACKNOWLEDGED", "ASSIGNED"] as const;

// Simple, deliberately conservative auto-flag thresholds — a manual trigger
// from the paramedic (input.markAbnormal) always wins regardless of these.
const ABNORMAL = { hrLow: 40, hrHigh: 150, spo2Low: 90 };

const caseSelect = {
  id: true,
  status: true,
  pickupLat: true,
  pickupLng: true,
  pickupAddress: true,
  hospitalId: true,
  selectionMethod: true,
  mqttTopic: true,
  unknownPatientLabel: true,
  latestHeartRate: true,
  latestSpo2: true,
  latestSystolic: true,
  latestDiastolic: true,
  latestRespRate: true,
  latestTempC: true,
  latestReadingAt: true,
  isAbnormal: true,
  dispatchedAt: true,
  acknowledgedAt: true,
  assignedAt: true,
  arrivedAt: true,
  closedAt: true,
  cancelledAt: true,
  createdAt: true,
  ambulance: { select: { id: true, vehicleNumber: true, currentLat: true, currentLng: true, lastLocationAt: true } },
  paramedic: { select: { id: true, firstName: true, lastName: true, phone: true } },
  patient: {
    select: { id: true, medicalRecordNo: true, user: { select: { id: true, firstName: true, lastName: true } } },
  },
  hospital: { select: { id: true, name: true, latitude: true, longitude: true } },
  assignedDoctor: { select: { id: true, firstName: true, lastName: true, phone: true } },
  assignedBy: { select: { id: true, firstName: true, lastName: true } },
  acknowledgedBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

/**
 * Paramedic starts monitoring a patient picked up in the field — no
 * sending/receiving hospital agreement involved (unlike AmbulanceTrip),
 * just "we have a patient and a monitor is now on them". The destination is
 * chosen afterward via selectHospital.
 */
export async function startCase(
  actor: Actor,
  input: {
    patientUserId?: string;
    unknownPatientLabel?: string;
    pickupLat: number;
    pickupLng: number;
    pickupAddress?: string;
  }
) {
  if (actor.roleCode !== "DRIVER") throw ApiError.forbidden("Only a paramedic can start an emergency case");
  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital yet — contact a super admin.", "NO_HOSPITAL_ASSIGNED");
  }

  // The ambulance is resolved from the driver's own persistent assignment
  // (set by an admin on the Ambulances page) — never taken from client
  // input, so there's no way to start a case "as" a vehicle that isn't
  // actually assigned to you.
  const ambulance = await prisma.ambulance.findUnique({ where: { assignedDriverId: actor.id } });
  if (!ambulance) {
    throw ApiError.badRequest(
      "You don't have an ambulance assigned to you yet — ask an admin to assign one on the Ambulances page.",
      "NO_AMBULANCE_ASSIGNED"
    );
  }
  if (ambulance.status !== "AVAILABLE") throw ApiError.conflict("Your ambulance isn't available right now");

  const alreadyActive = await prisma.emergencyCase.findFirst({
    where: { paramedicId: actor.id, status: { in: ACTIVE_STATUSES as any } },
  });
  if (alreadyActive) throw ApiError.conflict("You already have an active emergency case");

  let patientId: string | undefined;
  if (input.patientUserId) {
    const patient = await prisma.user.findFirst({
      where: { id: input.patientUserId, deletedAt: null },
      include: { role: true, patientProfile: true },
    });
    if (!patient || patient.role.code !== "PATIENT" || !patient.patientProfile) {
      throw ApiError.badRequest("Selected patient not found");
    }
    patientId = patient.patientProfile.id;
  }

  const id = randomUUID();
  const created = await prisma.$transaction(async (tx) => {
    const emergencyCase = await tx.emergencyCase.create({
      data: {
        id,
        ambulanceId: ambulance.id,
        paramedicId: actor.id,
        patientId,
        unknownPatientLabel: patientId ? undefined : input.unknownPatientLabel,
        pickupLat: input.pickupLat,
        pickupLng: input.pickupLng,
        pickupAddress: input.pickupAddress,
        // Fixed, predictable topic naming so both the paramedic's publisher
        // and the eventual doctor's subscriber can derive it from the case
        // id alone, without an extra round-trip.
        mqttTopic: `hms/emergency/${id}/vitals`,
      },
      select: caseSelect,
    });
    await tx.ambulance.update({ where: { id: ambulance.id }, data: { status: "ON_TRIP" } });
    return emergencyCase;
  });

  await writeAudit({ userId: actor.id, action: "EMERGENCY_CASE.STARTED", entityType: "EmergencyCase", entityId: created.id });
  return created;
}

/**
 * Manual (paramedic picks) or AUTO_NEAREST (system picks by actual driving
 * time via OSRM across every hospital with coordinates set). Either way,
 * this is the moment the destination hospital's admins get alarmed — via a
 * server-published MQTT message, not a request they can decline.
 */
export async function selectHospital(actor: Actor, caseId: string, input: { hospitalId?: string }) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  if (emergencyCase.paramedicId !== actor.id) {
    throw ApiError.forbidden("Only the paramedic on this case can select a hospital");
  }
  if (emergencyCase.status !== "MONITORING") {
    throw ApiError.conflict("A hospital has already been selected for this case");
  }

  let hospitalId = input.hospitalId;
  let selectionMethod: "MANUAL" | "AUTO_NEAREST" = "MANUAL";

  if (hospitalId) {
    const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
    if (!hospital || !hospital.isActive) throw ApiError.badRequest("Hospital not found or inactive");
    if (hospital.latitude == null || hospital.longitude == null) {
      throw ApiError.badRequest(
        `${hospital.name} has no coordinates set — ask a super admin to add them first.`,
        "DESTINATION_COORDINATES_REQUIRED"
      );
    }
  } else {
    selectionMethod = "AUTO_NEAREST";
    const candidates = await prisma.hospital.findMany({
      where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
    });
    if (candidates.length === 0) {
      throw ApiError.badRequest("No hospitals with coordinates set are available to auto-select.", "NO_HOSPITALS_AVAILABLE");
    }

    const routed = await Promise.all(
      candidates.map(async (h) => ({
        hospitalId: h.id,
        route: await getRouteWithFallback(emergencyCase.pickupLat, emergencyCase.pickupLng, h.latitude!, h.longitude!),
      }))
    );
    routed.sort((a, b) => a.route.etaSeconds - b.route.etaSeconds);
    hospitalId = routed[0].hospitalId;
  }

  const updated = await prisma.emergencyCase.update({
    where: { id: caseId },
    data: { hospitalId, selectionMethod, status: "DISPATCHED", dispatchedAt: new Date() },
    select: caseSelect,
  });

  await writeAudit({
    userId: actor.id,
    action: "EMERGENCY_CASE.DISPATCHED",
    entityType: "EmergencyCase",
    entityId: caseId,
    metadata: { hospitalId, selectionMethod },
  });

  await publishMqtt(`hms/hospital/${hospitalId}/alerts`, {
    type: "EMERGENCY_CASE",
    caseId,
    patientLabel: updated.patient
      ? `${updated.patient.user.firstName} ${updated.patient.user.lastName}`
      : updated.unknownPatientLabel ?? "Unidentified patient",
    ambulance: updated.ambulance.vehicleNumber,
    paramedic: `${updated.paramedic.firstName} ${updated.paramedic.lastName}`,
    pickupAddress: updated.pickupAddress,
    isAbnormal: updated.isAbnormal,
    dispatchedAt: updated.dispatchedAt,
  });

  return updated;
}

function assertHospitalAdmin(actor: Actor, hospitalId: string | null) {
  if (actor.roleCode === "SUPER_ADMIN") return;
  if (actor.roleCode !== "ADMIN" || !hospitalId || actor.hospitalId !== hospitalId) {
    throw ApiError.forbidden("Only an admin at the receiving hospital can do this");
  }
}

export async function acknowledgeCase(actor: Actor, caseId: string) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  assertHospitalAdmin(actor, emergencyCase.hospitalId);
  if (emergencyCase.status !== "DISPATCHED") throw ApiError.conflict("This case isn't awaiting acknowledgement");

  const updated = await prisma.emergencyCase.update({
    where: { id: caseId },
    data: { status: "ACKNOWLEDGED", acknowledgedById: actor.id, acknowledgedAt: new Date() },
    select: caseSelect,
  });
  await writeAudit({ userId: actor.id, action: "EMERGENCY_CASE.ACKNOWLEDGED", entityType: "EmergencyCase", entityId: caseId });
  return updated;
}

export async function assignDoctor(actor: Actor, caseId: string, doctorId: string) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  assertHospitalAdmin(actor, emergencyCase.hospitalId);
  if (!["DISPATCHED", "ACKNOWLEDGED"].includes(emergencyCase.status)) {
    throw ApiError.conflict("A doctor can only be assigned while this case is awaiting triage");
  }

  const doctor = await prisma.user.findFirst({ where: { id: doctorId, deletedAt: null }, include: { role: true } });
  if (!doctor || doctor.role.code !== "DOCTOR") throw ApiError.badRequest("Selected doctor not found");
  if (doctor.hospitalId !== emergencyCase.hospitalId) {
    throw ApiError.badRequest("The doctor must belong to the receiving hospital");
  }

  const now = new Date();
  const updated = await prisma.emergencyCase.update({
    where: { id: caseId },
    data: {
      status: "ASSIGNED",
      assignedDoctorId: doctorId,
      assignedById: actor.id,
      assignedAt: now,
      // Assigning implies acknowledging, if that step was skipped.
      acknowledgedById: emergencyCase.acknowledgedById ?? actor.id,
      acknowledgedAt: emergencyCase.acknowledgedAt ?? now,
    },
    select: caseSelect,
  });

  await writeAudit({
    userId: actor.id,
    action: "EMERGENCY_CASE.ASSIGNED",
    entityType: "EmergencyCase",
    entityId: caseId,
    metadata: { doctorId },
  });
  return updated;
}

/**
 * Throttled snapshot write from the paramedic's client, called alongside
 * its direct-to-broker MQTT publish — this is what lets anyone loading the
 * case via plain REST (not currently subscribed live) see a recent reading
 * instead of nothing. Not the primary delivery path for the live graph.
 */
export async function recordVitals(
  actor: Actor,
  caseId: string,
  input: {
    heartRate?: number;
    spo2?: number;
    systolic?: number;
    diastolic?: number;
    respRate?: number;
    tempC?: number;
    markAbnormal?: boolean;
  }
) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  if (emergencyCase.paramedicId !== actor.id) throw ApiError.forbidden("Only the paramedic on this case can push vitals");
  if (["CLOSED", "CANCELLED"].includes(emergencyCase.status)) throw ApiError.conflict("This case has ended");

  const autoAbnormal =
    (input.heartRate != null && (input.heartRate < ABNORMAL.hrLow || input.heartRate > ABNORMAL.hrHigh)) ||
    (input.spo2 != null && input.spo2 < ABNORMAL.spo2Low);

  const updated = await prisma.emergencyCase.update({
    where: { id: caseId },
    data: {
      latestHeartRate: input.heartRate,
      latestSpo2: input.spo2,
      latestSystolic: input.systolic,
      latestDiastolic: input.diastolic,
      latestRespRate: input.respRate,
      latestTempC: input.tempC,
      latestReadingAt: new Date(),
      isAbnormal: Boolean(input.markAbnormal) || autoAbnormal,
    },
    select: caseSelect,
  });
  return updated;
}

export async function markArrived(actor: Actor, caseId: string) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  const isParamedic = emergencyCase.paramedicId === actor.id;
  if (!isParamedic) assertHospitalAdmin(actor, emergencyCase.hospitalId);
  if (!["DISPATCHED", "ACKNOWLEDGED", "ASSIGNED"].includes(emergencyCase.status)) {
    throw ApiError.conflict("This case isn't currently en route");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.emergencyCase.update({
      where: { id: caseId },
      data: { status: "ARRIVED", arrivedAt: new Date() },
      select: caseSelect,
    });
    await tx.ambulance.update({ where: { id: emergencyCase.ambulanceId }, data: { status: "AVAILABLE" } });
    return c;
  });

  await writeAudit({ userId: actor.id, action: "EMERGENCY_CASE.ARRIVED", entityType: "EmergencyCase", entityId: caseId });
  return updated;
}

export async function closeCase(actor: Actor, caseId: string) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  const isParamedic = emergencyCase.paramedicId === actor.id;
  if (!isParamedic) assertHospitalAdmin(actor, emergencyCase.hospitalId);
  if (emergencyCase.status !== "ARRIVED") throw ApiError.conflict("Only an arrived case can be closed");

  const updated = await prisma.emergencyCase.update({
    where: { id: caseId },
    data: { status: "CLOSED", closedAt: new Date() },
    select: caseSelect,
  });
  await writeAudit({ userId: actor.id, action: "EMERGENCY_CASE.CLOSED", entityType: "EmergencyCase", entityId: caseId });
  return updated;
}

export async function cancelCase(actor: Actor, caseId: string) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  const isParamedic = emergencyCase.paramedicId === actor.id;
  if (!isParamedic) assertHospitalAdmin(actor, emergencyCase.hospitalId);
  if (["CLOSED", "CANCELLED", "ARRIVED"].includes(emergencyCase.status)) {
    throw ApiError.conflict("This case can no longer be cancelled");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const c = await tx.emergencyCase.update({
      where: { id: caseId },
      data: { status: "CANCELLED", cancelledAt: new Date() },
      select: caseSelect,
    });
    await tx.ambulance.update({ where: { id: emergencyCase.ambulanceId }, data: { status: "AVAILABLE" } });
    return c;
  });
  await writeAudit({ userId: actor.id, action: "EMERGENCY_CASE.CANCELLED", entityType: "EmergencyCase", entityId: caseId });
  return updated;
}

function scopeWhere(actor: Actor): any {
  if (actor.roleCode === "SUPER_ADMIN") return {};
  if (actor.roleCode === "DRIVER") return { paramedicId: actor.id };

  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital yet.", "NO_HOSPITAL_ASSIGNED");
  }
  if (actor.roleCode === "DOCTOR") {
    // Situational awareness of everything incoming to their hospital, plus
    // anything specifically assigned to them even if that somehow diverges.
    return { OR: [{ hospitalId: actor.hospitalId }, { assignedDoctorId: actor.id }] };
  }
  // ADMIN
  return { hospitalId: actor.hospitalId };
}

export async function listCases(actor: Actor, filters: { status?: string }) {
  const where: any = { ...scopeWhere(actor) };
  if (filters.status) where.status = filters.status;
  return prisma.emergencyCase.findMany({ where, select: caseSelect, orderBy: { createdAt: "desc" } });
}

async function resolveScopedCase(actor: Actor, caseId: string) {
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId } });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");

  if (actor.roleCode === "SUPER_ADMIN") return emergencyCase;
  if (actor.roleCode === "DRIVER") {
    if (emergencyCase.paramedicId !== actor.id) throw ApiError.forbidden("You don't have access to this case");
    return emergencyCase;
  }
  if (actor.roleCode === "DOCTOR") {
    if (emergencyCase.hospitalId !== actor.hospitalId && emergencyCase.assignedDoctorId !== actor.id) {
      throw ApiError.forbidden("You don't have access to this case");
    }
    return emergencyCase;
  }
  if (emergencyCase.hospitalId !== actor.hospitalId) throw ApiError.forbidden("You don't have access to this case");
  return emergencyCase;
}

export async function getCase(actor: Actor, caseId: string) {
  await resolveScopedCase(actor, caseId);
  const emergencyCase = await prisma.emergencyCase.findUnique({ where: { id: caseId }, select: caseSelect });
  if (!emergencyCase) throw ApiError.notFound("Emergency case not found");
  return emergencyCase;
}
