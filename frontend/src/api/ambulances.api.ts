import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export type AmbulanceStatus = "AVAILABLE" | "ON_TRIP" | "MAINTENANCE" | "OFFLINE";

export interface Ambulance {
  id: string;
  vehicleNumber: string;
  status: AmbulanceStatus;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationAt: string | null;
  createdAt: string;
  hospital: { id: string; name: string; code: string };
  assignedDriver: { id: string; firstName: string; lastName: string } | null;
}

export const ambulancesApi = {
  list: (params?: { status?: AmbulanceStatus; hospitalId?: string }) =>
    api.get<ApiEnvelope<Ambulance[]>>("/ambulances", { params }).then((r) => r.data),

  get: (ambulanceId: string) => api.get<ApiEnvelope<Ambulance>>(`/ambulances/${ambulanceId}`).then((r) => r.data),

  /** The logged-in driver's own assigned vehicle (or null if none set yet). */
  getMine: () => api.get<ApiEnvelope<Ambulance | null>>("/ambulances/mine").then((r) => r.data),

  assignDriver: (ambulanceId: string, driverId: string | null) =>
    api.patch<ApiEnvelope<Ambulance>>(`/ambulances/${ambulanceId}/driver`, { driverId }).then((r) => r.data),

  create: (payload: { vehicleNumber: string; hospitalId?: string }) =>
    api.post<ApiEnvelope<Ambulance>>("/ambulances", payload).then((r) => r.data),

  setStatus: (ambulanceId: string, status: "AVAILABLE" | "MAINTENANCE" | "OFFLINE") =>
    api.patch<ApiEnvelope<Ambulance>>(`/ambulances/${ambulanceId}/status`, { status }).then((r) => r.data),

  recordLocation: (ambulanceId: string, payload: { lat: number; lng: number; speedKph?: number; headingDeg?: number }) =>
    api.post<ApiEnvelope<Ambulance>>(`/ambulances/${ambulanceId}/location`, payload).then((r) => r.data),
};
