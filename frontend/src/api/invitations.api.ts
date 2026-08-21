import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export interface Invitation {
  id: string;
  email: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
  hospitalId: string | null;
  departmentId: string | null;
  role: { code: string; name: string };
  invitedBy: { firstName: string; lastName: string };
}

export const invitationsApi = {
  create: (payload: { email: string; roleCode: "DOCTOR" | "NURSE" | "DRIVER"; hospitalId?: string; departmentId?: string }) =>
    api.post<ApiEnvelope<{ id: string; email: string; expiresAt: string }>>("/invitations", payload).then((r) => r.data),

  list: (hospitalId?: string) =>
    api.get<ApiEnvelope<Invitation[]>>("/invitations", { params: { hospitalId } }).then((r) => r.data),

  revoke: (invitationId: string) =>
    api.delete<ApiEnvelope<null>>(`/invitations/${invitationId}`).then((r) => r.data),
};