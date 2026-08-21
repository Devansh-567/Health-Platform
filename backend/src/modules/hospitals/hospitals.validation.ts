import { z } from "zod";

export const createHospitalSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200),
    code: z.string().min(2).max(30).regex(/^[A-Z0-9_-]+$/, "Uppercase letters, numbers, - or _ only"),
    address: z.string().max(300).optional(),
    phone: z.string().max(20).optional(),
    // Required for ambulance dispatch to/from this hospital (route origin
    // or destination) and for placing it on the live tracking map.
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
});

export const updateHospitalSchema = z.object({
  body: z.object({
    name: z.string().min(2).max(200).optional(),
    address: z.string().max(300).optional(),
    phone: z.string().max(20).optional(),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  }),
  params: z.object({ hospitalId: z.string().uuid() }),
});

export const updateHospitalStatusSchema = z.object({
  body: z.object({ isActive: z.boolean() }),
  params: z.object({ hospitalId: z.string().uuid() }),
});

export const listHospitalsSchema = z.object({
  query: z.object({
    search: z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
  }),
});

export const createDepartmentSchema = z.object({
  body: z.object({ name: z.string().min(2).max(150) }),
  params: z.object({ hospitalId: z.string().uuid() }),
});

export const updateDepartmentSchema = z.object({
  body: z.object({ name: z.string().min(2).max(150) }),
  params: z.object({ hospitalId: z.string().uuid(), departmentId: z.string().uuid() }),
});