import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export type EmergencyCaseStatus =
  | "MONITORING"
  | "DISPATCHED"
  | "ACKNOWLEDGED"
  | "ASSIGNED"
  | "ARRIVED"
  | "CLOSED"
  | "CANCELLED";

export interface EmergencyCase {
  id: string;
  status: EmergencyCaseStatus;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string | null;
  hospitalId: string | null;
  selectionMethod: "MANUAL" | "AUTO_NEAREST" | null;
  mqttTopic: string;
  unknownPatientLabel: string | null;
  latestHeartRate: number | null;
  latestSpo2: number | null;
  latestSystolic: number | null;
  latestDiastolic: number | null;
  latestRespRate: number | null;
  latestTempC: number | null;
  latestReadingAt: string | null;
  isAbnormal: boolean;
  dispatchedAt: string | null;
  acknowledgedAt: string | null;
  assignedAt: string | null;
  arrivedAt: string | null;
  closedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  ambulance: { id: string; vehicleNumber: string; currentLat: number | null; currentLng: number | null; lastLocationAt: string | null };
  paramedic: { id: string; firstName: string; lastName: string; phone: string | null };
  patient: { id: string; medicalRecordNo: string | null; user: { id: string; firstName: string; lastName: string } } | null;
  hospital: { id: string; name: string; latitude: number | null; longitude: number | null } | null;
  assignedDoctor: { id: string; firstName: string; lastName: string; phone: string | null } | null;
  assignedBy: { id: string; firstName: string; lastName: string } | null;
  acknowledgedBy: { id: string; firstName: string; lastName: string } | null;
}

export interface VitalsReading {
  heartRate?: number;
  spo2?: number;
  systolic?: number;
  diastolic?: number;
  respRate?: number;
  tempC?: number;
  markAbnormal?: boolean;
}

export const emergencyApi = {
  start: (payload: {
    patientUserId?: string;
    unknownPatientLabel?: string;
    pickupLat: number;
    pickupLng: number;
    pickupAddress?: string;
  }) => api.post<ApiEnvelope<EmergencyCase>>("/emergency-cases", payload).then((r) => r.data),

  selectHospital: (caseId: string, hospitalId?: string) =>
    api.patch<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}/hospital`, { hospitalId }).then((r) => r.data),

  recordVitals: (caseId: string, payload: VitalsReading) =>
    api.patch<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}/vitals`, payload).then((r) => r.data),

  acknowledge: (caseId: string) =>
    api.patch<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}/acknowledge`).then((r) => r.data),

  assignDoctor: (caseId: string, doctorId: string) =>
    api.patch<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}/assign-doctor`, { doctorId }).then((r) => r.data),

  markArrived: (caseId: string) =>
    api.patch<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}/arrived`).then((r) => r.data),

  close: (caseId: string) => api.patch<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}/close`).then((r) => r.data),

  cancel: (caseId: string) => api.patch<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}/cancel`).then((r) => r.data),

  list: (params?: { status?: EmergencyCaseStatus }) =>
    api.get<ApiEnvelope<EmergencyCase[]>>("/emergency-cases", { params }).then((r) => r.data),

  get: (caseId: string) => api.get<ApiEnvelope<EmergencyCase>>(`/emergency-cases/${caseId}`).then((r) => r.data),
};
