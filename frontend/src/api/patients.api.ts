import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export interface CreatePatientPayload {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hospitalId?: string;
  departmentId?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
}

export const patientsApi = {
  create: (payload: CreatePatientPayload) =>
    api.post<ApiEnvelope<{ id: string; email: string; tempPasswordExpiresAt: string }>>("/patients", payload).then((r) => r.data),

  resendCredentials: (userId: string) =>
    api
      .post<ApiEnvelope<{ id: string; email: string; tempPasswordExpiresAt: string }>>(`/patients/${userId}/resend-credentials`)
      .then((r) => r.data),
};
