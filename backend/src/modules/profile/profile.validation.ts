import { z } from "zod";

// Mirrors the frontend's patientProfileSchema (frontend/src/pages/AccountSettings.tsx)
// field-for-field, since the client's validation is a UX convenience only —
// the server is the actual enforcement boundary.
export const updateMyProfileSchema = z.object({
  body: z.object({
    dateOfBirth: z.string().date().optional(),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]).optional(),
    bloodGroup: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "UNKNOWN"]).optional(),
    medicalRecordNo: z
      .string()
      .trim()
      .max(50)
      .regex(/^[A-Za-z0-9-]{3,}$/, "Letters, numbers, and hyphens only, at least 3 characters")
      .optional(),
    address: z.string().trim().max(300).optional(),
    emergencyContact: z.string().trim().max(150).optional(),
    emergencyPhone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[0-9+()\-\s]{7,}$/, "Invalid phone number")
      .optional(),
  }),
});
