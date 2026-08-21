import { z } from "zod";

export const initiateTransferSchema = z.object({
  body: z.object({
    patientUserId: z.string().uuid(),
    toHospitalId: z.string().uuid(),
    reason: z.string().max(1000).optional(),
  }),
});

export const listTransfersSchema = z.object({
  query: z.object({
    status: z.enum(["PENDING", "ACCEPTED", "REJECTED", "CANCELLED"]).optional(),
    hospitalId: z.string().uuid().optional(),
  }),
});

export const transferIdParamSchema = z.object({
  params: z.object({ transferId: z.string().uuid() }),
});

export const respondTransferSchema = z.object({
  params: z.object({ transferId: z.string().uuid() }),
  body: z.object({ responseNote: z.string().max(1000).optional() }),
});
