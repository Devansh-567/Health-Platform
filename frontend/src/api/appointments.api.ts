import { api } from "./client";
import { ApiEnvelope } from "../types/auth";
import { Paginated } from "./hospitals.api";

export type AppointmentStatus = "REQUESTED" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";

export interface BookableDoctor {
  id: string;
  firstName: string;
  lastName: string;
  hospital: { id: string; name: string } | null;
  department: { id: string; name: string } | null;
  doctorProfile: {
    specialization: string | null;
    qualification: string | null;
    yearsOfExperience: number | null;
    consultationFee: string | null;
  } | null;
}

export interface AppointmentListItem {
  id: string;
  hospitalId: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: AppointmentStatus;
  reason: string | null;
  cancelReason: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  doctor: { id: string; userId: string; specialization: string | null; user: { id: string; firstName: string; lastName: string } };
  patient: { id: string; userId: string; user: { id: string; firstName: string; lastName: string } };
  department: { id: string; name: string } | null;
  hospital: { id: string; name: string };
}

// Booking a walk-in appointment on behalf of a patient reuses the existing,
// appropriately-permissioned patient lookup that already backs the doctor/
// nurse assignment flow, rather than standing up a second endpoint for the
// same "find an active patient by name/email" query.
export interface PatientSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  patientProfile: { id: string; medicalRecordNo: string | null } | null;
}

export const appointmentsApi = {
  listDoctors: (params: { hospitalId?: string; departmentId?: string; search?: string }) =>
    api.get<ApiEnvelope<BookableDoctor[]>>("/appointments/doctors", { params }).then((r) => r.data),

  searchPatients: (search: string) =>
    api.get<ApiEnvelope<PatientSearchResult[]>>("/assignments/patients/search", { params: { search } }).then((r) => r.data),

  book: (payload: { doctorUserId: string; patientUserId?: string; scheduledStart: string; scheduledEnd: string; reason?: string }) =>
    api.post<ApiEnvelope<AppointmentListItem>>("/appointments", payload).then((r) => r.data),

  list: (params: {
    status?: AppointmentStatus;
    from?: string;
    to?: string;
    doctorUserId?: string;
    patientUserId?: string;
    // Only honored by the backend for SUPER_ADMIN — see appointments.service.ts.
    hospitalId?: string;
    page?: number;
    pageSize?: number;
  }) => api.get<ApiEnvelope<Paginated<AppointmentListItem>>>("/appointments", { params }).then((r) => r.data),

  confirm: (id: string) => api.patch<ApiEnvelope<null>>(`/appointments/${id}/confirm`).then((r) => r.data),

  cancel: (id: string, reason?: string) =>
    api.patch<ApiEnvelope<null>>(`/appointments/${id}/cancel`, { reason }).then((r) => r.data),

  complete: (id: string) => api.patch<ApiEnvelope<null>>(`/appointments/${id}/complete`).then((r) => r.data),

  markNoShow: (id: string) => api.patch<ApiEnvelope<null>>(`/appointments/${id}/no-show`).then((r) => r.data),

  reschedule: (id: string, payload: { scheduledStart: string; scheduledEnd: string }) =>
    api.patch<ApiEnvelope<AppointmentListItem>>(`/appointments/${id}/reschedule`, payload).then((r) => r.data),
};
