import { z } from "zod";

const isoDateTime = z.string().datetime({ offset: true });
const appointmentStatus = z.enum(["REQUESTED", "CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]);

export const listDoctorsSchema = z.object({
  query: z.object({
    hospitalId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    search: z.string().max(200).optional(),
  }),
});

export const bookAppointmentSchema = z.object({
  body: z
    .object({
      doctorUserId: z.string().uuid(),
      patientUserId: z.string().uuid().optional(), // only used when an admin/doctor books on behalf of a patient
      scheduledStart: isoDateTime,
      scheduledEnd: isoDateTime,
      reason: z.string().trim().max(500).optional(),
    })
    .refine((data) => new Date(data.scheduledEnd) > new Date(data.scheduledStart), {
      message: "scheduledEnd must be after scheduledStart",
      path: ["scheduledEnd"],
    }),
});

export const listAppointmentsSchema = z.object({
  query: z.object({
    status: appointmentStatus.optional(),
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
    doctorUserId: z.string().uuid().optional(),
    patientUserId: z.string().uuid().optional(),
    // Only honored for SUPER_ADMIN (see appointments.service.listAppointments) —
    // every other role is already hospital/assignment-scoped server-side and
    // this param is silently ignored for them, same as listInvitations/listUsers.
    hospitalId: z.string().uuid().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  }),
});

export const appointmentIdParamSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
});

export const cancelAppointmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z.object({ reason: z.string().trim().max(500).optional() }),
});

export const rescheduleAppointmentSchema = z.object({
  params: z.object({ id: z.string().uuid() }),
  body: z
    .object({
      scheduledStart: isoDateTime,
      scheduledEnd: isoDateTime,
    })
    .refine((data) => new Date(data.scheduledEnd) > new Date(data.scheduledStart), {
      message: "scheduledEnd must be after scheduledStart",
      path: ["scheduledEnd"],
    }),
});
