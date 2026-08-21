import { z } from "zod";

export const startCaseSchema = z.object({
  body: z
    .object({
      patientUserId: z.string().uuid().optional(),
      unknownPatientLabel: z.string().min(2).max(200).optional(),
      pickupLat: z.number().min(-90).max(90),
      pickupLng: z.number().min(-180).max(180),
      pickupAddress: z.string().max(300).optional(),
    })
    .refine((v) => !!v.patientUserId || !!v.unknownPatientLabel, {
      message: "Either patientUserId or unknownPatientLabel is required",
      path: ["patientUserId"],
    }),
});

export const caseIdParamSchema = z.object({
  params: z.object({ caseId: z.string().uuid() }),
});

export const selectHospitalSchema = z.object({
  params: z.object({ caseId: z.string().uuid() }),
  body: z.object({ hospitalId: z.string().uuid().optional() }),
});

export const assignDoctorSchema = z.object({
  params: z.object({ caseId: z.string().uuid() }),
  body: z.object({ doctorId: z.string().uuid() }),
});

export const recordVitalsSchema = z.object({
  params: z.object({ caseId: z.string().uuid() }),
  body: z.object({
    heartRate: z.number().min(0).max(300).optional(),
    spo2: z.number().min(0).max(100).optional(),
    systolic: z.number().min(0).max(300).optional(),
    diastolic: z.number().min(0).max(200).optional(),
    respRate: z.number().min(0).max(100).optional(),
    tempC: z.number().min(25).max(45).optional(),
    markAbnormal: z.boolean().optional(),
  }),
});

export const listCasesSchema = z.object({
  query: z.object({
    status: z
      .enum(["MONITORING", "DISPATCHED", "ACKNOWLEDGED", "ASSIGNED", "ARRIVED", "CLOSED", "CANCELLED"])
      .optional(),
  }),
});
