import { api } from "./client";
import { ApiEnvelope } from "../types/auth";
import { AssignedPatient } from "./assignments.api";

// AssignedPatient (staffUserId/patient shape) is reused as-is: the backend's
// GET /clinical/me/patients selects the exact same fields as the assignments
// module's "assigned patients" list, so one type covers both the admin's
// "Manage patients" view and the doctor/nurse's own "My Patients" view.
export type MyPatient = AssignedPatient;

export interface PatientSummary {
  id: string; // User id
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  patientProfile: {
    id: string;
    medicalRecordNo: string | null;
    bloodGroup: string | null;
    dateOfBirth: string | null;
    gender: string | null;
  };
}

interface DoctorRef {
  user: { firstName: string; lastName: string };
}

export interface Diagnosis {
  id: string;
  condition: string;
  description: string | null;
  diagnosedAt: string;
  appointmentId: string | null;
  doctor: DoctorRef;
}

export type PrescriptionStatus = "ACTIVE" | "COMPLETED" | "CANCELLED";

export interface PrescriptionItem {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number | null;
  instructions: string | null;
}

export interface Prescription {
  id: string;
  status: PrescriptionStatus;
  notes: string | null;
  diagnosisId: string | null;
  appointmentId: string | null;
  createdAt: string;
  items: PrescriptionItem[];
  doctor: DoctorRef;
}

export interface VitalSign {
  id: string;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  heartRate: number | null;
  temperatureCelsius: string | null;
  respiratoryRate: number | null;
  oxygenSaturation: number | null;
  weightKg: string | null;
  heightCm: string | null;
  notes: string | null;
  recordedAt: string;
  recordedBy: { firstName: string; lastName: string };
}

export interface ClinicalNote {
  id: string;
  type: "DOCTOR_NOTE" | "NURSING_NOTE";
  content: string;
  createdAt: string;
  author: { firstName: string; lastName: string };
}

export interface Report {
  id: string;
  title: string;
  originalName: string;
  mimeType: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: { firstName: string; lastName: string };
}

export interface CreatePrescriptionPayload {
  diagnosisId?: string;
  appointmentId?: string;
  notes?: string;
  items: { medicineName: string; dosage: string; frequency: string; durationDays?: number; instructions?: string }[];
}

export interface RecordVitalsPayload {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  heartRate?: number;
  temperatureCelsius?: number;
  respiratoryRate?: number;
  oxygenSaturation?: number;
  weightKg?: number;
  heightCm?: number;
  notes?: string;
}

export const clinicalApi = {
  listMyPatients: () => api.get<ApiEnvelope<MyPatient[]>>("/clinical/me/patients").then((r) => r.data),

  getPatientSummary: (patientUserId: string) =>
    api.get<ApiEnvelope<PatientSummary>>(`/clinical/patients/${patientUserId}`).then((r) => r.data),

  listDiagnoses: (patientUserId: string) =>
    api.get<ApiEnvelope<Diagnosis[]>>(`/clinical/patients/${patientUserId}/diagnoses`).then((r) => r.data),

  createDiagnosis: (patientUserId: string, payload: { condition: string; description?: string; appointmentId?: string }) =>
    api.post<ApiEnvelope<Diagnosis>>(`/clinical/patients/${patientUserId}/diagnoses`, payload).then((r) => r.data),

  listPrescriptions: (patientUserId: string) =>
    api.get<ApiEnvelope<Prescription[]>>(`/clinical/patients/${patientUserId}/prescriptions`).then((r) => r.data),

  createPrescription: (patientUserId: string, payload: CreatePrescriptionPayload) =>
    api.post<ApiEnvelope<Prescription>>(`/clinical/patients/${patientUserId}/prescriptions`, payload).then((r) => r.data),

  updatePrescriptionStatus: (prescriptionId: string, status: PrescriptionStatus) =>
    api.patch<ApiEnvelope<Prescription>>(`/clinical/prescriptions/${prescriptionId}/status`, { status }).then((r) => r.data),

  listVitals: (patientUserId: string) =>
    api.get<ApiEnvelope<VitalSign[]>>(`/clinical/patients/${patientUserId}/vitals`).then((r) => r.data),

  recordVitals: (patientUserId: string, payload: RecordVitalsPayload) =>
    api.post<ApiEnvelope<VitalSign>>(`/clinical/patients/${patientUserId}/vitals`, payload).then((r) => r.data),

  listNotes: (patientUserId: string) =>
    api.get<ApiEnvelope<ClinicalNote[]>>(`/clinical/patients/${patientUserId}/notes`).then((r) => r.data),

  createNote: (patientUserId: string, content: string) =>
    api.post<ApiEnvelope<ClinicalNote>>(`/clinical/patients/${patientUserId}/notes`, { content }).then((r) => r.data),

  listMyDiagnoses: () => api.get<ApiEnvelope<Diagnosis[]>>("/clinical/me/diagnoses").then((r) => r.data),

  listMyPrescriptions: () => api.get<ApiEnvelope<Prescription[]>>("/clinical/me/prescriptions").then((r) => r.data),

  listMyReports: () => api.get<ApiEnvelope<Report[]>>("/clinical/me/reports").then((r) => r.data),

  listReports: (patientUserId: string) =>
    api.get<ApiEnvelope<Report[]>>(`/clinical/patients/${patientUserId}/reports`).then((r) => r.data),

  uploadReport: (patientUserId: string, file: File, title?: string) => {
    const form = new FormData();
    form.append("file", file);
    if (title) form.append("title", title);
    // No explicit Content-Type — axios/the browser sets the correct
    // multipart boundary automatically when given a FormData body.
    return api.post<ApiEnvelope<Report>>(`/clinical/patients/${patientUserId}/reports`, form).then((r) => r.data);
  },

  /** Authenticated file download: the access token only exists in memory and
   * is attached by the axios interceptor, so a plain <a href> can't carry
   * it — fetch as a blob instead and trigger the save via an object URL. */
  downloadReport: async (patientUserId: string, reportId: string, filename: string) => {
    const res = await api.get(`/clinical/patients/${patientUserId}/reports/${reportId}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  /** Patient downloading their OWN report — separate endpoint from
   * downloadReport above (see backend clinical.service.ts:
   * resolveMyReportForDownload — the staff-facing route's access check has
   * no path for the PATIENT role at all, so this can't reuse that URL). */
  downloadMyReport: async (reportId: string, filename: string) => {
    const res = await api.get(`/clinical/me/reports/${reportId}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([res.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },

  deleteReport: (patientUserId: string, reportId: string) =>
    api.delete<ApiEnvelope<null>>(`/clinical/patients/${patientUserId}/reports/${reportId}`).then((r) => r.data),
};