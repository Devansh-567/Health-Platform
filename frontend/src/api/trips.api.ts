import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export type TripStatus =
  | "ASSIGNED"
  | "EN_ROUTE_TO_PICKUP"
  | "ARRIVED_AT_PICKUP"
  | "EN_ROUTE_TO_HOSPITAL"
  | "COMPLETED"
  | "CANCELLED";

export interface TripPing {
  lat: number;
  lng: number;
  speedKph: number | null;
  headingDeg: number | null;
  recordedAt: string;
}

export interface AmbulanceTrip {
  id: string;
  status: TripStatus;
  pickupLat: number;
  pickupLng: number;
  pickupAddress: string | null;
  destinationLat: number;
  destinationLng: number;
  destinationLabel: string | null;
  distanceMeters: number | null;
  etaSeconds: number | null;
  routeGeometry: [number, number][] | null; // [lng, lat] pairs
  assignedAt: string;
  enRouteToPickupAt: string | null;
  arrivedAtPickupAt: string | null;
  enRouteToHospitalAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  transferId: string;
  transfer: {
    id: string;
    status: string;
    fromHospital: { id: string; name: string };
    toHospital: { id: string; name: string };
    patient: { id: string; medicalRecordNo: string | null; user: { id: string; firstName: string; lastName: string } };
  };
  ambulance: {
    id: string;
    vehicleNumber: string;
    currentLat: number | null;
    currentLng: number | null;
    lastLocationAt: string | null;
    status: string;
  };
  driver: { id: string; firstName: string; lastName: string; phone: string | null };
  pings?: TripPing[];
}

export const tripsApi = {
  dispatch: (payload: {
    transferId: string;
    ambulanceId: string;
    driverId: string;
    pickupLat?: number;
    pickupLng?: number;
    pickupAddress?: string;
  }) => api.post<ApiEnvelope<AmbulanceTrip>>("/trips", payload).then((r) => r.data),

  list: (params?: { status?: TripStatus; transferId?: string }) =>
    api.get<ApiEnvelope<AmbulanceTrip[]>>("/trips", { params }).then((r) => r.data),

  get: (tripId: string) => api.get<ApiEnvelope<AmbulanceTrip>>(`/trips/${tripId}`).then((r) => r.data),

  updateStatus: (tripId: string, status: Exclude<TripStatus, "ASSIGNED">) =>
    api.patch<ApiEnvelope<AmbulanceTrip>>(`/trips/${tripId}/status`, { status }).then((r) => r.data),
};
