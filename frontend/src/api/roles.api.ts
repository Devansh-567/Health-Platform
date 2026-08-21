import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export interface PermissionItem {
  id: string;
  code: string;
  module: string;
  description: string | null;
}

export interface RoleListItem {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string;
  _count: { users: number; rolePermissions: number };
}

export interface RoleWithPermissions extends RoleListItem {
  rolePermissions: { permission: PermissionItem }[];
}

export const rolesApi = {
  list: () => api.get<ApiEnvelope<RoleListItem[]>>("/roles").then((r) => r.data),

  listPermissions: () => api.get<ApiEnvelope<PermissionItem[]>>("/roles/permissions").then((r) => r.data),

  get: (roleId: string) => api.get<ApiEnvelope<RoleWithPermissions>>(`/roles/${roleId}`).then((r) => r.data),

  updatePermissions: (roleId: string, permissionCodes: string[]) =>
    api.put<ApiEnvelope<null>>(`/roles/${roleId}/permissions`, { permissionCodes }).then((r) => r.data),

  create: (payload: { code: string; name: string; description?: string }) =>
    api.post<ApiEnvelope<RoleListItem>>("/roles", payload).then((r) => r.data),
};
