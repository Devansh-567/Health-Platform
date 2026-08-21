import { z } from "zod";

const passwordSchema = z
  .string()
  .min(10)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .regex(/[^a-zA-Z0-9]/);

export const createAdminSchema = z.object({
  body: z.object({
    email: z.string().email(),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().min(7).max(20).optional(),
    hospitalId: z.string().uuid().optional(),
    temporaryPassword: passwordSchema,
  }),
});

export const listUsersSchema = z.object({
  query: z.object({
    roleCode: z.string().optional(),
    status: z.string().optional(),
    hospitalId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(20),
  }),
});

export const updateUserStatusSchema = z.object({
  body: z.object({
    status: z.enum(["ACTIVE", "SUSPENDED", "DEACTIVATED"]),
    reason: z.string().max(500).optional(),
  }),
  params: z.object({ userId: z.string().uuid() }),
});

export const assignPermissionOverrideSchema = z.object({
  body: z.object({
    permissionCode: z.string().min(1),
    effect: z.enum(["GRANT", "REVOKE"]),
  }),
  params: z.object({ userId: z.string().uuid() }),
});

