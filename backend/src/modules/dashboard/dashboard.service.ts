import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

const ROLE_CODES = ["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE", "PATIENT"] as const;
const ACTIVE_APPOINTMENT_STATUSES = ["REQUESTED", "CONFIRMED"] as const;

// Shared select so every role's appointment cards come back in exactly the
// shape the frontend's AppointmentCard type expects.
const appointmentCardSelect = {
  id: true,
  scheduledStart: true,
  scheduledEnd: true,
  status: true,
  reason: true,
  doctor: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
  patient: { select: { id: true, userId: true, user: { select: { firstName: true, lastName: true } } } },
} as const;

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function endOfToday() {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return d;
}
function daysFromNow(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

/**
 * Every branch below derives its scope (hospitalId / doctorId / nurseId /
 * patientId) exclusively from `actor`, which comes from the verified JWT —
 * never from client-supplied input, since this endpoint takes none. This
 * mirrors the hospital/assignment-scoping pattern used everywhere else in
 * the app (see users/invitations/clinical services).
 */
export async function getOverview(actor: Actor) {
  switch (actor.roleCode) {
    case "SUPER_ADMIN":
      return getSuperAdminOverview();
    case "ADMIN":
      return getAdminOverview(actor);
    case "DOCTOR":
      return getDoctorOverview(actor);
    case "NURSE":
      return getNurseOverview(actor);
    case "PATIENT":
      return getPatientOverview(actor);
    default:
      throw ApiError.forbidden("No dashboard is defined for this role");
  }
}

async function getSuperAdminOverview() {
  const [hospitalsTotal, hospitalsActive, roles, pendingInvitations, appointmentsToday, auditEventsLast24h, recentActivity] =
    await Promise.all([
      prisma.hospital.count(),
      prisma.hospital.count({ where: { isActive: true } }),
      prisma.role.findMany({ select: { id: true, code: true } }),
      prisma.invitation.count({ where: { status: "PENDING" } }),
      prisma.appointment.count({ where: { scheduledStart: { gte: startOfToday(), lt: endOfToday() } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      prisma.auditLog.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        select: { id: true, action: true, entityType: true, createdAt: true, user: { select: { firstName: true, lastName: true } } },
      }),
    ]);

  const usersByRole = Object.fromEntries(ROLE_CODES.map((c) => [c, 0])) as Record<(typeof ROLE_CODES)[number], number>;
  await Promise.all(
    roles.map(async (role: { id: string; code: string }) => {
      if (!ROLE_CODES.includes(role.code as any)) return;
      const count = await prisma.user.count({ where: { roleId: role.id, deletedAt: null } });
      usersByRole[role.code as (typeof ROLE_CODES)[number]] = count;
    })
  );

  return {
    roleCode: "SUPER_ADMIN" as const,
    hospitals: { total: hospitalsTotal, active: hospitalsActive },
    usersByRole,
    pendingInvitations,
    appointmentsToday,
    auditEventsLast24h,
    recentActivity,
  };
}

async function getAdminOverview(actor: Actor) {
  const hospitalId = actor.hospitalId;

  if (!hospitalId) {
    // Matches the existing invitations-module precedent: an Admin without a
    // linked hospital yet gets a well-formed empty response, not a crash.
    return {
      roleCode: "ADMIN" as const,
      hospitalId: null,
      staff: { doctors: 0, nurses: 0 },
      patientsSeen: 0,
      pendingInvitations: 0,
      appointmentsToday: { total: 0, requested: 0, confirmed: 0, completed: 0, cancelled: 0, noShow: 0 },
      upcomingAppointments: [],
    };
  }

  const [doctors, nurses, distinctPatients, pendingInvitations, statusCounts, upcomingAppointments] = await Promise.all([
    prisma.user.count({ where: { hospitalId, deletedAt: null, role: { code: "DOCTOR" } } }),
    prisma.user.count({ where: { hospitalId, deletedAt: null, role: { code: "NURSE" } } }),
    prisma.appointment.findMany({ where: { hospitalId }, distinct: ["patientId"], select: { patientId: true } }),
    prisma.invitation.count({ where: { hospitalId, status: "PENDING" } }),
    Promise.all(
      (["REQUESTED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const).map((status) =>
        prisma.appointment.count({ where: { hospitalId, status, scheduledStart: { gte: startOfToday(), lt: endOfToday() } } })
      )
    ),
    prisma.appointment.findMany({
      where: { hospitalId, status: { in: [...ACTIVE_APPOINTMENT_STATUSES] }, scheduledStart: { gte: new Date() } },
      orderBy: { scheduledStart: "asc" },
      take: 5,
      select: appointmentCardSelect,
    }),
  ]);

  const [requested, confirmed, completed, cancelled, noShow] = statusCounts;

  return {
    roleCode: "ADMIN" as const,
    hospitalId,
    staff: { doctors, nurses },
    patientsSeen: distinctPatients.length,
    pendingInvitations,
    appointmentsToday: { total: requested + confirmed + completed + cancelled + noShow, requested, confirmed, completed, cancelled, noShow },
    upcomingAppointments,
  };
}

async function getDoctorOverview(actor: Actor) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: actor.id } });
  if (!profile) throw ApiError.internal("Doctor profile is missing for this account");

  const [assignedPatients, todaysAppointments, upcomingAppointmentsNext7Days, diagnosesThisWeek] = await Promise.all([
    prisma.doctorPatientMap.count({ where: { doctorId: profile.id, isActive: true } }),
    prisma.appointment.findMany({
      where: { doctorId: profile.id, scheduledStart: { gte: startOfToday(), lt: endOfToday() } },
      orderBy: { scheduledStart: "asc" },
      select: appointmentCardSelect,
    }),
    prisma.appointment.count({
      where: {
        doctorId: profile.id,
        status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
        scheduledStart: { gte: new Date(), lt: daysFromNow(7) },
      },
    }),
    // Rolling 7-day window rather than a calendar week, to keep the query simple and unambiguous.
    prisma.diagnosis.count({ where: { doctorId: profile.id, diagnosedAt: { gte: daysFromNow(-7) } } }),
  ]);

  return {
    roleCode: "DOCTOR" as const,
    assignedPatients,
    todaysAppointments,
    upcomingAppointmentsNext7Days,
    diagnosesThisWeek,
  };
}

async function getNurseOverview(actor: Actor) {
  const profile = await prisma.nurseProfile.findUnique({ where: { userId: actor.id } });
  if (!profile) throw ApiError.internal("Nurse profile is missing for this account");

  const [assignedPatients, vitalsRecordedToday, recentPatients] = await Promise.all([
    prisma.nursePatientMap.count({ where: { nurseId: profile.id, isActive: true } }),
    prisma.vitalSign.count({ where: { recordedById: actor.id, recordedAt: { gte: startOfToday(), lt: endOfToday() } } }),
    prisma.nursePatientMap.findMany({
      where: { nurseId: profile.id, isActive: true },
      orderBy: { assignedAt: "desc" },
      take: 5,
      select: {
        id: true,
        assignedAt: true,
        patient: {
          select: {
            id: true,
            medicalRecordNo: true,
            bloodGroup: true,
            user: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    }),
  ]);

  return {
    roleCode: "NURSE" as const,
    assignedPatients,
    vitalsRecordedToday,
    recentPatients,
  };
}

async function getPatientOverview(actor: Actor) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId: actor.id } });
  if (!profile) throw ApiError.internal("Patient profile is missing for this account");

  const upcomingWhere: Prisma.AppointmentWhereInput = {
    patientId: profile.id,
    status: { in: [...ACTIVE_APPOINTMENT_STATUSES] },
    scheduledStart: { gte: new Date() },
  };

  const [upcomingAppointments, upcomingAppointmentsCount, activePrescriptions, recentReports] = await Promise.all([
    prisma.appointment.findMany({ where: upcomingWhere, orderBy: { scheduledStart: "asc" }, take: 5, select: appointmentCardSelect }),
    prisma.appointment.count({ where: upcomingWhere }),
    prisma.prescription.count({ where: { patientId: profile.id, status: "ACTIVE" } }),
    prisma.report.findMany({
      where: { patientId: profile.id },
      orderBy: { uploadedAt: "desc" },
      take: 5,
      select: { id: true, title: true, uploadedAt: true },
    }),
  ]);

  return {
    roleCode: "PATIENT" as const,
    upcomingAppointments,
    upcomingAppointmentsCount,
    activePrescriptions,
    recentReports,
    profileCompleteness: computeProfileCompleteness(profile),
  };
}

const COMPLETENESS_FIELDS = ["dateOfBirth", "gender", "bloodGroup", "address", "emergencyContact", "emergencyPhone"] as const;

function computeProfileCompleteness(profile: Record<string, unknown>) {
  const missingFields = COMPLETENESS_FIELDS.filter((f) => profile[f] === null || profile[f] === undefined || profile[f] === "");
  const percent = Math.round(((COMPLETENESS_FIELDS.length - missingFields.length) / COMPLETENESS_FIELDS.length) * 100);
  return { percent, missingFields };
}
