import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

type StaffRoleCode = "DOCTOR" | "NURSE";

/**
 * Resolve a staffUserId to its role + profile, and enforce hospital scoping:
 * a non-Super-Admin actor may only manage assignments for staff belonging to
 * their OWN hospital. This is derived from the staff member's own record —
 * never from a hospitalId supplied by the client — matching the same class
 * of check already applied to invitations and user listing.
 */
async function resolveScopedStaff(actor: Actor, staffUserId: string) {
  const staff = await prisma.user.findFirst({
    where: { id: staffUserId, deletedAt: null },
    include: { role: true, doctorProfile: true, nurseProfile: true },
  });
  if (!staff) throw ApiError.notFound("Staff member not found");

  const rawRoleCode = staff.role.code;
  if (rawRoleCode !== "DOCTOR" && rawRoleCode !== "NURSE") {
    throw ApiError.badRequest("Only doctors and nurses can be assigned patients");
  }
  const roleCode: StaffRoleCode = rawRoleCode;

  if (actor.roleCode !== "SUPER_ADMIN" && staff.hospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("You can only manage patient assignments for staff in your own hospital");
  }

  const profile = roleCode === "DOCTOR" ? staff.doctorProfile : staff.nurseProfile;
  // Should always exist — created transactionally when the invitation was
  // accepted (see invitations.service.acceptInvitation). Treat absence as a
  // data-integrity fault rather than a normal not-found.
  if (!profile) throw ApiError.internal(`${roleCode} profile is missing for this staff member`);

  return { staff, roleCode, profile };
}

/**
 * Resolve a patientUserId to its PatientProfile. Note: unlike staff, patients
 * are NOT hospital-scoped in this schema — PatientProfile carries no
 * hospitalId, and a patient may legitimately be treated across multiple
 * hospitals over time. The hospital boundary for an assignment is enforced
 * entirely on the doctor/nurse side (see resolveScopedStaff above).
 */
async function resolvePatient(patientUserId: string) {
  const patient = await prisma.user.findFirst({
    where: { id: patientUserId, deletedAt: null },
    include: { role: true, patientProfile: true },
  });
  if (!patient || patient.role.code !== "PATIENT" || !patient.patientProfile) {
    throw ApiError.notFound("Patient not found");
  }
  return patient;
}

const assignedPatientSelect = {
  id: true,
  assignedAt: true,
  patient: {
    select: {
      id: true,
      medicalRecordNo: true,
      bloodGroup: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
    },
  },
} as const;

export async function listAssignedPatients(actor: Actor, staffUserId: string) {
  const { roleCode, profile } = await resolveScopedStaff(actor, staffUserId);

  if (roleCode === "DOCTOR") {
    return prisma.doctorPatientMap.findMany({
      where: { doctorId: profile.id, isActive: true },
      select: assignedPatientSelect,
      orderBy: { assignedAt: "desc" },
    });
  }
  return prisma.nursePatientMap.findMany({
    where: { nurseId: profile.id, isActive: true },
    select: assignedPatientSelect,
    orderBy: { assignedAt: "desc" },
  });
}

export async function searchAssignablePatients(actor: Actor, search: string, staffUserId?: string) {
  const where: any = {
    deletedAt: null,
    status: "ACTIVE",
    role: { code: "PATIENT" },
    patientProfile: { isNot: null },
  };
  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { patientProfile: { medicalRecordNo: { contains: search, mode: "insensitive" } } },
    ];
  }

  const patients = await prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      patientProfile: { select: { id: true, medicalRecordNo: true } },
    },
    orderBy: { firstName: "asc" },
    take: 20,
  });

  if (!staffUserId) return patients.map((p) => ({ ...p, alreadyAssigned: false }));

  // Annotate with current assignment state against this specific staff member
  // (also re-validates the hospital scope for that staff member).
  const { roleCode, profile } = await resolveScopedStaff(actor, staffUserId);
  const patientProfileIds = patients.map((p) => p.patientProfile!.id);

  const existing =
    roleCode === "DOCTOR"
      ? await prisma.doctorPatientMap.findMany({
          where: { doctorId: profile.id, patientId: { in: patientProfileIds }, isActive: true },
          select: { patientId: true },
        })
      : await prisma.nursePatientMap.findMany({
          where: { nurseId: profile.id, patientId: { in: patientProfileIds }, isActive: true },
          select: { patientId: true },
        });
  const assignedSet = new Set(existing.map((e) => e.patientId));

  return patients.map((p) => ({ ...p, alreadyAssigned: assignedSet.has(p.patientProfile!.id) }));
}

export async function assignPatient(actor: Actor, staffUserId: string, patientUserId: string) {
  const { staff, roleCode, profile } = await resolveScopedStaff(actor, staffUserId);
  const patient = await resolvePatient(patientUserId);
  const patientProfileId = patient.patientProfile!.id;

  if (roleCode === "DOCTOR") {
    const existing = await prisma.doctorPatientMap.findUnique({
      where: { doctorId_patientId: { doctorId: profile.id, patientId: patientProfileId } },
    });
    if (existing?.isActive) throw ApiError.conflict("This patient is already assigned to this doctor");

    if (existing) {
      await prisma.doctorPatientMap.update({ where: { id: existing.id }, data: { isActive: true, assignedAt: new Date() } });
    } else {
      await prisma.doctorPatientMap.create({ data: { doctorId: profile.id, patientId: patientProfileId } });
    }
  } else {
    const existing = await prisma.nursePatientMap.findUnique({
      where: { nurseId_patientId: { nurseId: profile.id, patientId: patientProfileId } },
    });
    if (existing?.isActive) throw ApiError.conflict("This patient is already assigned to this nurse");

    if (existing) {
      await prisma.nursePatientMap.update({ where: { id: existing.id }, data: { isActive: true, assignedAt: new Date() } });
    } else {
      await prisma.nursePatientMap.create({ data: { nurseId: profile.id, patientId: patientProfileId } });
    }
  }

  await writeAudit({
    userId: actor.id,
    action: roleCode === "DOCTOR" ? "PATIENT.ASSIGNED_TO_DOCTOR" : "PATIENT.ASSIGNED_TO_NURSE",
    entityType: "User",
    entityId: patient.id,
    metadata: { staffUserId: staff.id, staffRole: roleCode, hospitalId: staff.hospitalId },
  });
}

export async function unassignPatient(actor: Actor, staffUserId: string, patientUserId: string) {
  const { staff, roleCode, profile } = await resolveScopedStaff(actor, staffUserId);
  const patient = await resolvePatient(patientUserId);
  const patientProfileId = patient.patientProfile!.id;

  if (roleCode === "DOCTOR") {
    const existing = await prisma.doctorPatientMap.findUnique({
      where: { doctorId_patientId: { doctorId: profile.id, patientId: patientProfileId } },
    });
    if (!existing?.isActive) throw ApiError.notFound("Active assignment not found");
    await prisma.doctorPatientMap.update({ where: { id: existing.id }, data: { isActive: false } });
  } else {
    const existing = await prisma.nursePatientMap.findUnique({
      where: { nurseId_patientId: { nurseId: profile.id, patientId: patientProfileId } },
    });
    if (!existing?.isActive) throw ApiError.notFound("Active assignment not found");
    await prisma.nursePatientMap.update({ where: { id: existing.id }, data: { isActive: false } });
  }

  // Assignments are soft-deleted (isActive=false), never hard-deleted, so the
  // full assign/unassign history survives for audit purposes alongside the
  // audit_logs entry itself.
  await writeAudit({
    userId: actor.id,
    action: roleCode === "DOCTOR" ? "PATIENT.UNASSIGNED_FROM_DOCTOR" : "PATIENT.UNASSIGNED_FROM_NURSE",
    entityType: "User",
    entityId: patient.id,
    metadata: { staffUserId: staff.id, staffRole: roleCode, hospitalId: staff.hospitalId },
  });
}
