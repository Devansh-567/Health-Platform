import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

const PATIENT_ROLE_CODE = "PATIENT";

/**
 * ACCESS MODEL — mirrors the rest of this codebase's hospital-scoping rules:
 * - ADMIN: may only INITIATE a transfer for a patient currently registered
 *   at their own hospital (the "from" side), and may only ACCEPT/REJECT a
 *   request directed AT their own hospital (the "to" side). Either side may
 *   CANCEL while still pending, but only the side that created it.
 * - SUPER_ADMIN: unrestricted, consistent with everywhere else in the app.
 */

async function resolveTransferablePatient(actor: Actor, patientUserId: string) {
  const patient = await prisma.user.findFirst({
    where: { id: patientUserId, deletedAt: null },
    include: { role: true, patientProfile: true },
  });
  if (!patient || patient.role.code !== PATIENT_ROLE_CODE || !patient.patientProfile) {
    throw ApiError.notFound("Patient not found");
  }

  if (actor.roleCode !== "SUPER_ADMIN") {
    if (!actor.hospitalId) {
      throw ApiError.badRequest(
        "Your account isn't linked to a hospital yet — contact a super admin before requesting a transfer.",
        "NO_HOSPITAL_ASSIGNED"
      );
    }
    if (patient.hospitalId !== actor.hospitalId) {
      throw ApiError.forbidden("You can only request a transfer for a patient currently registered at your own hospital");
    }
  }

  return patient;
}

const transferSelect = {
  id: true,
  status: true,
  reason: true,
  responseNote: true,
  requestedAt: true,
  respondedAt: true,
  createdAt: true,
  patient: {
    select: {
      id: true,
      medicalRecordNo: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  },
  fromHospital: { select: { id: true, name: true, code: true } },
  toHospital: { select: { id: true, name: true, code: true } },
  initiatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  respondedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
} as const;

export async function initiateTransfer(
  actor: Actor,
  input: { patientUserId: string; toHospitalId: string; reason?: string }
) {
  const patient = await resolveTransferablePatient(actor, input.patientUserId);
  const fromHospitalId = patient.hospitalId;

  if (!fromHospitalId) {
    throw ApiError.badRequest(
      "This patient isn't currently linked to a hospital, so there's no hospital to transfer them from.",
      "NO_HOSPITAL_ASSIGNED"
    );
  }
  if (input.toHospitalId === fromHospitalId) {
    throw ApiError.badRequest("Destination hospital must be different from the patient's current hospital");
  }

  const [toHospital, existingPending] = await Promise.all([
    prisma.hospital.findUnique({ where: { id: input.toHospitalId } }),
    prisma.patientTransfer.findFirst({
      where: { patientId: patient.patientProfile!.id, status: "PENDING" },
    }),
  ]);
  if (!toHospital || !toHospital.isActive) throw ApiError.badRequest("Destination hospital not found or inactive");
  if (existingPending) throw ApiError.conflict("This patient already has a pending transfer request");

  const transfer = await prisma.patientTransfer.create({
    data: {
      patientId: patient.patientProfile!.id,
      fromHospitalId,
      toHospitalId: input.toHospitalId,
      initiatedById: actor.id,
      reason: input.reason,
    },
    select: transferSelect,
  });

  await writeAudit({
    userId: actor.id,
    action: "PATIENT_TRANSFER.REQUESTED",
    entityType: "PatientTransfer",
    entityId: transfer.id,
    metadata: { patientUserId: input.patientUserId, fromHospitalId, toHospitalId: input.toHospitalId },
  });

  return transfer;
}

/** Admin's own hospital drives which side ("from"/"to") they can list — Super
 * Admin may additionally filter to an arbitrary hospital via the query param,
 * or omit it to see every hospital's requests. */
function directionFilter(actor: Actor, direction: "incoming" | "outgoing", requestedHospitalId?: string) {
  const field = direction === "incoming" ? "toHospitalId" : "fromHospitalId";

  if (actor.roleCode === "SUPER_ADMIN") {
    return requestedHospitalId ? { [field]: requestedHospitalId } : {};
  }
  if (!actor.hospitalId) {
    throw ApiError.badRequest(
      "Your account isn't linked to a hospital yet — contact a super admin.",
      "NO_HOSPITAL_ASSIGNED"
    );
  }
  return { [field]: actor.hospitalId };
}

export async function listIncomingTransfers(actor: Actor, filters: { status?: string; hospitalId?: string }) {
  const where: any = { ...directionFilter(actor, "incoming", filters.hospitalId) };
  if (filters.status) where.status = filters.status;
  return prisma.patientTransfer.findMany({ where, select: transferSelect, orderBy: { requestedAt: "desc" } });
}

export async function listOutgoingTransfers(actor: Actor, filters: { status?: string; hospitalId?: string }) {
  const where: any = { ...directionFilter(actor, "outgoing", filters.hospitalId) };
  if (filters.status) where.status = filters.status;
  return prisma.patientTransfer.findMany({ where, select: transferSelect, orderBy: { requestedAt: "desc" } });
}

async function resolveScopedTransfer(actor: Actor, transferId: string) {
  const transfer = await prisma.patientTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) throw ApiError.notFound("Transfer request not found");

  if (
    actor.roleCode !== "SUPER_ADMIN" &&
    transfer.fromHospitalId !== actor.hospitalId &&
    transfer.toHospitalId !== actor.hospitalId
  ) {
    throw ApiError.forbidden("You don't have access to this transfer request");
  }

  return transfer;
}

export async function getTransfer(actor: Actor, transferId: string) {
  await resolveScopedTransfer(actor, transferId);
  const transfer = await prisma.patientTransfer.findUnique({ where: { id: transferId }, select: transferSelect });
  if (!transfer) throw ApiError.notFound("Transfer request not found");
  return transfer;
}

/**
 * Admin2 accepts: the request moves to ACCEPTED and, in the same
 * transaction, the patient's account is handed over to the receiving
 * hospital — hospitalId flips to toHospitalId and the (now-foreign)
 * departmentId is cleared. This is the moment "admin1 gives access" takes
 * effect: from here on, clinical.service's hospital-scoping for Admins
 * treats every accepted transfer touching this patient as full access to
 * the patient's entire record set for BOTH hospitals involved, not just the
 * one that currently owns the account (see clinical.service.ts).
 */
export async function acceptTransfer(actor: Actor, transferId: string, responseNote?: string) {
  const transfer = await resolveScopedTransfer(actor, transferId);
  if (transfer.status !== "PENDING") throw ApiError.conflict("This transfer request is no longer pending");
  if (actor.roleCode !== "SUPER_ADMIN" && transfer.toHospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("Only an admin at the receiving hospital can accept this transfer");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const t = await tx.patientTransfer.update({
      where: { id: transferId },
      data: { status: "ACCEPTED", respondedById: actor.id, respondedAt: new Date(), responseNote },
      select: transferSelect,
    });

    await tx.user.update({
      where: { id: t.patient.user.id },
      data: { hospitalId: transfer.toHospitalId, departmentId: null },
    });

    return t;
  });

  await writeAudit({
    userId: actor.id,
    action: "PATIENT_TRANSFER.ACCEPTED",
    entityType: "PatientTransfer",
    entityId: transferId,
    metadata: {
      patientUserId: updated.patient.user.id,
      fromHospitalId: transfer.fromHospitalId,
      toHospitalId: transfer.toHospitalId,
    },
  });

  return updated;
}

export async function rejectTransfer(actor: Actor, transferId: string, responseNote?: string) {
  const transfer = await resolveScopedTransfer(actor, transferId);
  if (transfer.status !== "PENDING") throw ApiError.conflict("This transfer request is no longer pending");
  if (actor.roleCode !== "SUPER_ADMIN" && transfer.toHospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("Only an admin at the receiving hospital can respond to this transfer");
  }

  const updated = await prisma.patientTransfer.update({
    where: { id: transferId },
    data: { status: "REJECTED", respondedById: actor.id, respondedAt: new Date(), responseNote },
    select: transferSelect,
  });

  await writeAudit({
    userId: actor.id,
    action: "PATIENT_TRANSFER.REJECTED",
    entityType: "PatientTransfer",
    entityId: transferId,
    metadata: { reason: responseNote },
  });

  return updated;
}

export async function cancelTransfer(actor: Actor, transferId: string) {
  const transfer = await resolveScopedTransfer(actor, transferId);
  if (transfer.status !== "PENDING") throw ApiError.conflict("This transfer request is no longer pending");
  if (actor.roleCode !== "SUPER_ADMIN" && transfer.fromHospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("Only an admin at the requesting hospital can cancel this transfer");
  }

  const updated = await prisma.patientTransfer.update({
    where: { id: transferId },
    data: { status: "CANCELLED", respondedAt: new Date() },
    select: transferSelect,
  });

  await writeAudit({ userId: actor.id, action: "PATIENT_TRANSFER.CANCELLED", entityType: "PatientTransfer", entityId: transferId });
  return updated;
}
