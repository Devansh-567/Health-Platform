import { z } from "zod";

const uuid = z.string().uuid();

export const createDiagnosisSchema = z.object({
  params: z.object({ patientUserId: uuid }),
  body: z.object({
    condition: z.string().min(2).max(300),
    description: z.string().max(2000).optional(),
    appointmentId: uuid.optional(),
  }),
});

export const createPrescriptionSchema = z.object({
  params: z.object({ patientUserId: uuid }),
  body: z.object({
    diagnosisId: uuid.optional(),
    appointmentId: uuid.optional(),
    notes: z.string().max(1000).optional(),
    items: z
      .array(
        z.object({
          medicineName: z.string().min(1).max(200),
          dosage: z.string().min(1).max(100),
          frequency: z.string().min(1).max(100),
          durationDays: z.coerce.number().int().positive().optional(),
          instructions: z.string().max(500).optional(),
        })
      )
      .min(1, "At least one medicine is required"),
  }),
});

export const updatePrescriptionStatusSchema = z.object({
  params: z.object({ prescriptionId: uuid }),
  body: z.object({ status: z.enum(["ACTIVE", "COMPLETED", "CANCELLED"]) }),
});

export const recordVitalsSchema = z.object({
  params: z.object({ patientUserId: uuid }),
  body: z.object({
    bloodPressureSystolic: z.coerce.number().int().min(40).max(300).optional(),
    bloodPressureDiastolic: z.coerce.number().int().min(20).max(200).optional(),
    heartRate: z.coerce.number().int().min(20).max(300).optional(),
    temperatureCelsius: z.coerce.number().min(25).max(45).optional(),
    respiratoryRate: z.coerce.number().int().min(5).max(80).optional(),
    oxygenSaturation: z.coerce.number().int().min(30).max(100).optional(),
    weightKg: z.coerce.number().min(0.5).max(500).optional(),
    heightCm: z.coerce.number().min(20).max(280).optional(),
    notes: z.string().max(1000).optional(),
  }),
});

export const createNoteSchema = z.object({
  params: z.object({ patientUserId: uuid }),
  body: z.object({ content: z.string().min(1).max(4000) }),
});

export const patientParamSchema = z.object({
  params: z.object({ patientUserId: uuid }),
});

export const reportParamSchema = z.object({
  params: z.object({ patientUserId: uuid, reportId: uuid }),
});

export const myReportParamSchema = z.object({
  params: z.object({ reportId: uuid }),
});

// Multer parses multipart fields into req.body BEFORE this runs, so `title`
// is validated the same way as any normal JSON body field.
export const uploadReportSchema = z.object({
  params: z.object({ patientUserId: uuid }),
  body: z.object({ title: z.string().max(200).optional() }),
});