import { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

const MIN_DURATION_MINUTES = 10;
const MAX_DURATION_MINUTES = 180;

// An appointment still holds its slot until it's explicitly cancelled — only
// these statuses are checked for double-booking conflicts.
const ACTIVE_STATUSES: AppointmentStatus[] = ["REQUESTED", "CONFIRMED"];
const TERMINAL_STATUSES: AppointmentStatus[] = ["CANCELLED", "COMPLETED", "NO_SHOW"];

const appointmentDetailSelect = {
  id: true,
  hospitalId: true,
  scheduledStart: true,
  scheduledEnd: true,
  status: true,
  reason: true,
  cancelReason: true,
  cancelledAt: true,
  createdAt: true,
  updatedAt: true,
  doctor: {
    select: {
      id: true,
      userId: true,
      specialization: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  patient: {
    select: {
      id: true,
      userId: true,
      user: { select: { id: true, firstName: true, lastName: true } },
    },
  },
  department: { select: { id: true, name: true } },
  hospital: { select: { id: true, name: true } },
} as const;

async function resolveActorDoctorProfile(actorId: string) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: actorId } });
  if (!profile) throw ApiError.internal("Doctor profile is missing for this account");
  return profile;
}

async function resolveActorPatientProfile(actorId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId: actorId } });
  if (!profile) throw ApiError.internal("Patient profile is missing for this account");
  return profile;
}

/**
 * Resolve a bookable doctor and enforce hospital scoping: a non-Super-Admin,
 * non-Patient actor (Admin or Doctor booking on someone's behalf) may only
 * schedule against doctors in their OWN hospital — derived from the actor's
 * own record, never from client input. Patients have no hospital of their
 * own and may book across hospitals.
 */
async function resolveBookableDoctor(doctorUserId: string, actor: Actor) {
  const doctor = await prisma.user.findFirst({
    where: { id: doctorUserId, deletedAt: null, status: "ACTIVE" },
    include: { role: true, doctorProfile: true },
  });
  if (!doctor || doctor.role.code !== "DOCTOR" || !doctor.doctorProfile) {
    throw ApiError.notFound("Doctor not found");
  }
  if (!doctor.hospitalId) {
    throw ApiError.internal("Doctor is not assigned to a hospital");
  }
  if (actor.roleCode !== "SUPER_ADMIN" && actor.roleCode !== "PATIENT" && doctor.hospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("You can only schedule appointments for doctors in your own hospital");
  }
  return doctor;
}

async function resolvePatientByUserId(patientUserId: string) {
  const patient = await prisma.user.findFirst({
    where: { id: patientUserId, deletedAt: null },
    include: { role: true, patientProfile: true },
  });
  if (!patient || patient.role.code !== "PATIENT" || !patient.patientProfile) {
    throw ApiError.notFound("Patient not found");
  }
  return patient;
}

/**
 * Load an appointment and enforce that the actor is allowed to see/manage it:
 * Super Admin - unrestricted; Admin - own hospital only; Doctor/Patient - only
 * appointments where they are the doctor/patient on the record. The scoping
 * key is always resolved from the actor's own account, never trusted from
 * the request.
 */
async function resolveAppointmentForActor(actor: Actor, appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: appointmentDetailSelect,
  });
  if (!appointment) throw ApiError.notFound("Appointment not found");

  switch (actor.roleCode) {
    case "SUPER_ADMIN":
      return appointment;
    case "ADMIN":
      if (appointment.hospitalId !== actor.hospitalId) {
        throw ApiError.forbidden("You can only manage appointments within your own hospital");
      }
      return appointment;
    case "DOCTOR":
      if (appointment.doctor.userId !== actor.id) {
        throw ApiError.forbidden("You can only manage your own appointments");
      }
      return appointment;
    case "PATIENT":
      if (appointment.patient.userId !== actor.id) {
        throw ApiError.forbidden("You can only manage your own appointments");
      }
      return appointment;
    default:
      throw ApiError.forbidden();
  }
}

function assertValidSlot(start: Date, end: Date) {
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw ApiError.badRequest("Invalid appointment date/time");
  }
  if (start.getTime() <= Date.now()) {
    throw ApiError.badRequest("Appointment start time must be in the future");
  }
  const durationMinutes = (end.getTime() - start.getTime()) / 60000;
  if (durationMinutes < MIN_DURATION_MINUTES || durationMinutes > MAX_DURATION_MINUTES) {
    throw ApiError.badRequest(`Appointment duration must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES} minutes`);
  }
}

async function assertNoOverlap(
  tx: Prisma.TransactionClient,
  doctorId: string,
  patientId: string,
  start: Date,
  end: Date,
  excludeId?: string
) {
  const overlapWhere = {
    scheduledStart: { lt: end },
    scheduledEnd: { gt: start },
    status: { in: ACTIVE_STATUSES },
    ...(excludeId ? { id: { not: excludeId } } : {}),
  };

  const [doctorConflict, patientConflict] = await Promise.all([
    tx.appointment.findFirst({ where: { doctorId, ...overlapWhere } }),
    tx.appointment.findFirst({ where: { patientId, ...overlapWhere } }),
  ]);

  if (doctorConflict) throw ApiError.conflict("The doctor already has an appointment in this time slot");
  if (patientConflict) throw ApiError.conflict("You already have an appointment in this time slot");
}

export async function listBookableDoctors(
  actor: Actor,
  filters: { hospitalId?: string; departmentId?: string; search?: string }
) {
  // Admins only ever browse doctors within their own hospital — the
  // hospitalId query param is ignored for them, mirroring listUsers().
  const effectiveHospitalId =
    actor.roleCode === "SUPER_ADMIN" || actor.roleCode === "PATIENT" ? filters.hospitalId : actor.hospitalId ?? undefined;

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
    status: "ACTIVE",
    role: { code: "DOCTOR" },
    doctorProfile: { isNot: null },
  };
  if (effectiveHospitalId) where.hospitalId = effectiveHospitalId;
  if (filters.departmentId) where.departmentId = filters.departmentId;
  if (filters.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
      { doctorProfile: { specialization: { contains: filters.search, mode: "insensitive" } } },
    ];
  }

  return prisma.user.findMany({
    where,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      hospital: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      doctorProfile: {
        select: { specialization: true, qualification: true, yearsOfExperience: true, consultationFee: true },
      },
    },
    orderBy: { firstName: "asc" },
    take: 50,
  });
}

export async function createAppointment(
  actor: Actor,
  input: { doctorUserId: string; patientUserId?: string; scheduledStart: string; scheduledEnd: string; reason?: string }
) {
  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);
  assertValidSlot(start, end);

  const doctor = await resolveBookableDoctor(input.doctorUserId, actor);
  const doctorProfileId = doctor.doctorProfile!.id;

  let patientUser: Awaited<ReturnType<typeof resolvePatientByUserId>>;
  let initialStatus: AppointmentStatus;

  if (actor.roleCode === "PATIENT") {
    // Patients always book for themselves — a patientUserId in the body is
    // only accepted if it matches their own account, never trusted otherwise.
    if (input.patientUserId && input.patientUserId !== actor.id) {
      throw ApiError.forbidden("Patients can only book appointments for themselves");
    }
    patientUser = await resolvePatientByUserId(actor.id);
    initialStatus = "REQUESTED";
  } else {
    // Admin/Super Admin walk-in booking, or a doctor scheduling a follow-up
    // for one of their own patients.
    if (!input.patientUserId) throw ApiError.badRequest("patientUserId is required");
    patientUser = await resolvePatientByUserId(input.patientUserId);

    if (actor.roleCode === "DOCTOR") {
      const actorDoctorProfile = await resolveActorDoctorProfile(actor.id);
      if (actorDoctorProfile.id !== doctorProfileId) {
        throw ApiError.forbidden("Doctors can only schedule appointments for themselves");
      }
    }
    initialStatus = "CONFIRMED";
  }

  const patientProfileId = patientUser.patientProfile!.id;

  const appointment = await prisma.$transaction(async (tx) => {
    // Lock the doctor's profile row for the duration of the transaction so
    // two concurrent booking attempts for the same doctor are serialized
    // instead of racing past the overlap check below.
    await tx.$queryRaw`SELECT id FROM doctor_profiles WHERE id = ${doctorProfileId} FOR UPDATE`;
    await assertNoOverlap(tx, doctorProfileId, patientProfileId, start, end);

    return tx.appointment.create({
      data: {
        hospitalId: doctor.hospitalId!,
        doctorId: doctorProfileId,
        patientId: patientProfileId,
        departmentId: doctor.departmentId ?? undefined,
        scheduledStart: start,
        scheduledEnd: end,
        status: initialStatus,
        reason: input.reason,
        createdById: actor.id,
      },
      select: appointmentDetailSelect,
    });
  });

  await writeAudit({
    userId: actor.id,
    action: "APPOINTMENT.CREATED",
    entityType: "Appointment",
    entityId: appointment.id,
    metadata: { doctorUserId: doctor.id, patientUserId: patientUser.id, status: initialStatus },
  });

  return appointment;
}

export async function listAppointments(
  actor: Actor,
  filters: {
    status?: AppointmentStatus;
    from?: string;
    to?: string;
    doctorUserId?: string;
    patientUserId?: string;
    hospitalId?: string;
    page: number;
    pageSize: number;
  }
) {
  const where: Prisma.AppointmentWhereInput = {};

  if (actor.roleCode === "PATIENT") {
    const patientProfile = await resolveActorPatientProfile(actor.id);
    where.patientId = patientProfile.id;
  } else if (actor.roleCode === "DOCTOR") {
    const doctorProfile = await resolveActorDoctorProfile(actor.id);
    where.doctorId = doctorProfile.id;
  } else if (actor.roleCode === "ADMIN") {
    // Admins never see appointments outside their own hospital, and an
    // admin with no hospital assigned sees nothing (fail closed).
    where.hospitalId = actor.hospitalId ?? "__none__";
  } else if (actor.roleCode === "SUPER_ADMIN" && filters.hospitalId) {
    // Super Admin sees every hospital's appointments by default (unlike an
    // Admin, who is always force-scoped above) — this filter is an optional
    // narrowing they can apply themselves, never a client-controlled bypass
    // for anyone else, since every other role already has its own hard scope
    // set above and this branch is unreachable for them.
    where.hospitalId = filters.hospitalId;
  }

  if ((actor.roleCode === "ADMIN" || actor.roleCode === "SUPER_ADMIN") && filters.doctorUserId) {
    const doctor = await prisma.doctorProfile.findUnique({ where: { userId: filters.doctorUserId } });
    where.doctorId = doctor?.id ?? "__none__";
  }
  if ((actor.roleCode === "ADMIN" || actor.roleCode === "SUPER_ADMIN") && filters.patientUserId) {
    const patient = await prisma.patientProfile.findUnique({ where: { userId: filters.patientUserId } });
    where.patientId = patient?.id ?? "__none__";
  }

  if (filters.status) where.status = filters.status;
  if (filters.from || filters.to) {
    where.scheduledStart = {};
    if (filters.from) where.scheduledStart.gte = new Date(filters.from);
    if (filters.to) where.scheduledStart.lte = new Date(filters.to);
  }

  const [items, total] = await Promise.all([
    prisma.appointment.findMany({
      where,
      select: appointmentDetailSelect,
      orderBy: { scheduledStart: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.appointment.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getAppointmentById(actor: Actor, appointmentId: string) {
  return resolveAppointmentForActor(actor, appointmentId);
}

export async function confirmAppointment(actor: Actor, appointmentId: string) {
  const appointment = await resolveAppointmentForActor(actor, appointmentId);
  if (appointment.status !== "REQUESTED") {
    throw ApiError.conflict(`Cannot confirm an appointment with status ${appointment.status}`);
  }
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "CONFIRMED" } });
  await writeAudit({ userId: actor.id, action: "APPOINTMENT.CONFIRMED", entityType: "Appointment", entityId: appointmentId });
}

export async function cancelAppointment(actor: Actor, appointmentId: string, reason?: string) {
  const appointment = await resolveAppointmentForActor(actor, appointmentId);
  if (TERMINAL_STATUSES.includes(appointment.status)) {
    throw ApiError.conflict(`Cannot cancel an appointment with status ${appointment.status}`);
  }
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { status: "CANCELLED", cancelReason: reason, cancelledById: actor.id, cancelledAt: new Date() },
  });
  await writeAudit({
    userId: actor.id,
    action: "APPOINTMENT.CANCELLED",
    entityType: "Appointment",
    entityId: appointmentId,
    metadata: { reason },
  });
}

export async function completeAppointment(actor: Actor, appointmentId: string) {
  const appointment = await resolveAppointmentForActor(actor, appointmentId);
  if (appointment.status !== "CONFIRMED") {
    throw ApiError.conflict(`Cannot complete an appointment with status ${appointment.status}`);
  }
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "COMPLETED" } });
  await writeAudit({ userId: actor.id, action: "APPOINTMENT.COMPLETED", entityType: "Appointment", entityId: appointmentId });
}

export async function markNoShow(actor: Actor, appointmentId: string) {
  const appointment = await resolveAppointmentForActor(actor, appointmentId);
  if (appointment.status !== "CONFIRMED") {
    throw ApiError.conflict(`Cannot mark no-show for an appointment with status ${appointment.status}`);
  }
  await prisma.appointment.update({ where: { id: appointmentId }, data: { status: "NO_SHOW" } });
  await writeAudit({ userId: actor.id, action: "APPOINTMENT.NO_SHOW", entityType: "Appointment", entityId: appointmentId });
}

export async function rescheduleAppointment(
  actor: Actor,
  appointmentId: string,
  input: { scheduledStart: string; scheduledEnd: string }
) {
  const appointment = await resolveAppointmentForActor(actor, appointmentId);
  if (TERMINAL_STATUSES.includes(appointment.status)) {
    throw ApiError.conflict(`Cannot reschedule an appointment with status ${appointment.status}`);
  }

  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);
  assertValidSlot(start, end);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM doctor_profiles WHERE id = ${appointment.doctor.id} FOR UPDATE`;
    await assertNoOverlap(tx, appointment.doctor.id, appointment.patient.id, start, end, appointmentId);

    return tx.appointment.update({
      where: { id: appointmentId },
      data: { scheduledStart: start, scheduledEnd: end },
      select: appointmentDetailSelect,
    });
  });

  await writeAudit({
    userId: actor.id,
    action: "APPOINTMENT.RESCHEDULED",
    entityType: "Appointment",
    entityId: appointmentId,
    metadata: { scheduledStart: start, scheduledEnd: end },
  });

  return updated;
}
