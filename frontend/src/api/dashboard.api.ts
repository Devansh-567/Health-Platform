import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

interface PersonName {
  firstName: string;
  lastName: string;
}

export interface AppointmentCard {
  id: string;
  scheduledStart: string;
  scheduledEnd: string;
  status: "REQUESTED" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  reason: string | null;
  doctor: { id: string; userId: string; user: PersonName };
  patient: { id: string; userId: string; user: PersonName };
}

export interface PatientCard {
  id: string;
  medicalRecordNo: string | null;
  bloodGroup: string | null;
  user: { id: string; firstName: string; lastName: string };
}

export interface AuditActivityItem {
  id: string;
  action: string;
  entityType: string | null;
  createdAt: string;
  user: PersonName | null;
}

export interface SuperAdminOverview {
  roleCode: "SUPER_ADMIN";
  hospitals: { total: number; active: number };
  usersByRole: { SUPER_ADMIN: number; ADMIN: number; DOCTOR: number; NURSE: number; PATIENT: number };
  pendingInvitations: number;
  appointmentsToday: number;
  auditEventsLast24h: number;
  recentActivity: AuditActivityItem[];
}

export interface AdminOverview {
  roleCode: "ADMIN";
  hospitalId: string | null;
  staff: { doctors: number; nurses: number };
  patientsSeen: number;
  pendingInvitations: number;
  appointmentsToday: { total: number; requested: number; confirmed: number; completed: number; cancelled: number; noShow: number };
  upcomingAppointments: AppointmentCard[];
}

export interface DoctorOverview {
  roleCode: "DOCTOR";
  assignedPatients: number;
  todaysAppointments: AppointmentCard[];
  upcomingAppointmentsNext7Days: number;
  diagnosesThisWeek: number;
}

export interface NurseOverview {
  roleCode: "NURSE";
  assignedPatients: number;
  vitalsRecordedToday: number;
  recentPatients: { id: string; assignedAt: string; patient: PatientCard }[];
}

export interface PatientOverview {
  roleCode: "PATIENT";
  upcomingAppointments: AppointmentCard[];
  upcomingAppointmentsCount: number;
  activePrescriptions: number;
  recentReports: { id: string; title: string; uploadedAt: string }[];
  profileCompleteness: { percent: number; missingFields: string[] };
}

export type DashboardOverview = SuperAdminOverview | AdminOverview | DoctorOverview | NurseOverview | PatientOverview;

export const dashboardApi = {
  getOverview: () => api.get<ApiEnvelope<DashboardOverview>>("/dashboard/overview").then((r) => r.data),
};
