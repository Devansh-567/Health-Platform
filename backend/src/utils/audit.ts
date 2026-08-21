import { Request } from "express";
import { prisma } from "../config/prisma";

interface AuditInput {
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

export async function writeAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      userId: input.userId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      metadata: input.metadata as any,
      ip: input.req?.ip,
      userAgent: input.req?.headers["user-agent"],
    },
  });
}
