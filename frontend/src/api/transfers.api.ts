import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export type TransferStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export interface TransferHospitalRef {
  id: string;
  name: string;
  code: string;
}

export interface TransferPersonRef {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface PatientTransfer {
  id: string;
  status: TransferStatus;
  reason: string | null;
  responseNote: string | null;
  requestedAt: string;
  respondedAt: string | null;
  createdAt: string;
  patient: {
    id: string;
    medicalRecordNo: string | null;
    user: TransferPersonRef;
  };
  fromHospital: TransferHospitalRef;
  toHospital: TransferHospitalRef;
  initiatedBy: TransferPersonRef;
  respondedBy: TransferPersonRef | null;
}

export const transfersApi = {
  initiate: (payload: { patientUserId: string; toHospitalId: string; reason?: string }) =>
    api.post<ApiEnvelope<PatientTransfer>>("/transfers", payload).then((r) => r.data),

  listIncoming: (params?: { status?: TransferStatus; hospitalId?: string }) =>
    api.get<ApiEnvelope<PatientTransfer[]>>("/transfers/incoming", { params }).then((r) => r.data),

  listOutgoing: (params?: { status?: TransferStatus; hospitalId?: string }) =>
    api.get<ApiEnvelope<PatientTransfer[]>>("/transfers/outgoing", { params }).then((r) => r.data),

  get: (transferId: string) => api.get<ApiEnvelope<PatientTransfer>>(`/transfers/${transferId}`).then((r) => r.data),

  accept: (transferId: string, responseNote?: string) =>
    api.post<ApiEnvelope<PatientTransfer>>(`/transfers/${transferId}/accept`, { responseNote }).then((r) => r.data),

  reject: (transferId: string, responseNote?: string) =>
    api.post<ApiEnvelope<PatientTransfer>>(`/transfers/${transferId}/reject`, { responseNote }).then((r) => r.data),

  cancel: (transferId: string) => api.post<ApiEnvelope<PatientTransfer>>(`/transfers/${transferId}/cancel`).then((r) => r.data),
};
