import { api } from "./client";
import { ApiEnvelope } from "../types/auth";
import { Paginated } from "./hospitals.api";

export interface AuditLogItem {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: string;
  user: { email: string; firstName: string; lastName: string } | null;
}

export const auditApi = {
  list: (params: { action?: string; page?: number; pageSize?: number }) =>
    api.get<ApiEnvelope<Paginated<AuditLogItem>>>("/audit-logs", { params }).then((r) => r.data),
};
