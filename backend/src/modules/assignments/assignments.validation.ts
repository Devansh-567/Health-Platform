import { z } from "zod";

export const listAssignedPatientsSchema = z.object({
  params: z.object({ staffUserId: z.string().uuid() }),
});

export const searchAssignablePatientsSchema = z.object({
  query: z.object({
    search: z.string().max(200).optional(),
    // Optional: when provided, results are annotated with whether the patient
    // is already assigned to this staff member (used by the "add patient"
    // picker so already-assigned rows can be disabled instead of erroring).
    staffUserId: z.string().uuid().optional(),
  }),
});

export const assignPatientSchema = z.object({
  params: z.object({ staffUserId: z.string().uuid() }),
  body: z.object({ patientUserId: z.string().uuid() }),
});

export const unassignPatientSchema = z.object({
  params: z.object({ staffUserId: z.string().uuid(), patientUserId: z.string().uuid() }),
});
