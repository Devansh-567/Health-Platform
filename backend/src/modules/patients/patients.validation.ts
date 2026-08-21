import { z } from "zod";

export const createPatientSchema = z.object({
  body: z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().min(7).max(20).optional(),
    // Super Admin only — an Admin is always scoped to their own hospital
    // server-side regardless of what's sent here (see patients.service).
    hospitalId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
    // Optional intake fields an admin may already have on hand. Everything
    // else on the patient's profile stays self-service via /api/profile,
    // unchanged from today.
    dateOfBirth: z.string().date().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"]).optional(),
  }),
});

export const resendCredentialsSchema = z.object({
  params: z.object({ userId: z.string().uuid() }),
});
