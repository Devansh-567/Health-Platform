import { z } from "zod";

export const dispatchTripSchema = z.object({
  body: z.object({
    transferId: z.string().uuid(),
    ambulanceId: z.string().uuid(),
    driverId: z.string().uuid(),
    pickupLat: z.number().min(-90).max(90).optional(),
    pickupLng: z.number().min(-180).max(180).optional(),
    pickupAddress: z.string().max(300).optional(),
  }),
});

const TRIP_STATUSES = [
  "ASSIGNED",
  "EN_ROUTE_TO_PICKUP",
  "ARRIVED_AT_PICKUP",
  "EN_ROUTE_TO_HOSPITAL",
  "COMPLETED",
  "CANCELLED",
] as const;

export const listTripsSchema = z.object({
  query: z.object({
    status: z.enum(TRIP_STATUSES).optional(),
    transferId: z.string().uuid().optional(),
  }),
});

export const tripIdParamSchema = z.object({
  params: z.object({ tripId: z.string().uuid() }),
});

export const updateTripStatusSchema = z.object({
  params: z.object({ tripId: z.string().uuid() }),
  body: z.object({
    status: z.enum(["EN_ROUTE_TO_PICKUP", "ARRIVED_AT_PICKUP", "EN_ROUTE_TO_HOSPITAL", "COMPLETED", "CANCELLED"]),
  }),
});
