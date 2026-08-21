import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export interface AssignedPatient {
  id: string; // assignment record id
  assignedAt: string;
  patient: {
    id: string; // PatientProfile id
    medicalRecordNo: string | null;
    bloodGroup: string | null;
    user: { id: string; firstName: string; lastName: string; email: string; status: string };
  };
}

export interface AssignablePatientResult {
  id: string; // User id
  firstName: string;
  lastName: string;
  email: string;
  patientProfile: { id: string; medicalRecordNo: string | null };
  alreadyAssigned: boolean;
}

export const assignmentsApi = {
  listAssigned: (staffUserId: string) =>
    api.get<ApiEnvelope<AssignedPatient[]>>(`/assignments/staff/${staffUserId}/patients`).then((r) => r.data),

  searchAssignable: (search: string, staffUserId?: string) =>
    api
      .get<ApiEnvelope<AssignablePatientResult[]>>("/assignments/patients/search", { params: { search, staffUserId } })
      .then((r) => r.data),

  assign: (staffUserId: string, patientUserId: string) =>
    api.post<ApiEnvelope<null>>(`/assignments/staff/${staffUserId}/patients`, { patientUserId }).then((r) => r.data),

  unassign: (staffUserId: string, patientUserId: string) =>
    api.delete<ApiEnvelope<null>>(`/assignments/staff/${staffUserId}/patients/${patientUserId}`).then((r) => r.data),
};