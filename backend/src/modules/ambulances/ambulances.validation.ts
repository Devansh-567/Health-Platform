import { z } from "zod";

export const createAmbulanceSchema = z.object({
  body: z.object({
    hospitalId: z.string().uuid().optional(),
    vehicleNumber: z.string().min(2).max(30),
  }),
});

export const listAmbulancesSchema = z.object({
  query: z.object({
    status: z.enum(["AVAILABLE", "ON_TRIP", "MAINTENANCE", "OFFLINE"]).optional(),
    hospitalId: z.string().uuid().optional(),
  }),
});

export const ambulanceIdParamSchema = z.object({
  params: z.object({ ambulanceId: z.string().uuid() }),
});

export const setAmbulanceStatusSchema = z.object({
  params: z.object({ ambulanceId: z.string().uuid() }),
  body: z.object({ status: z.enum(["AVAILABLE", "MAINTENANCE", "OFFLINE"]) }),
});

export const assignDriverSchema = z.object({
  params: z.object({ ambulanceId: z.string().uuid() }),
  body: z.object({ driverId: z.string().uuid().nullable().optional() }),
});

export const recordLocationSchema = z.object({
  params: z.object({ ambulanceId: z.string().uuid() }),
  body: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speedKph: z.number().min(0).max(300).optional(),
    headingDeg: z.number().min(0).max(360).optional(),
  }),
});
