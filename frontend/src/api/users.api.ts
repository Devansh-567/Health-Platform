import { api } from "./client";
import { ApiEnvelope } from "../types/auth";
import { Paginated } from "./hospitals.api";

export interface UserListItem {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  status: "PENDING_VERIFICATION" | "ACTIVE" | "SUSPENDED" | "DEACTIVATED" | "LOCKED";
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  mustChangePassword: boolean;
  role: { code: string; name: string };
  hospital: { id: string; name: string } | null;
}

export interface UserDetail extends UserListItem {
  role: { code: string; name: string };
  hospital: { id: string; name: string } | null;
}

export const usersApi = {
  list: (params: { roleCode?: string; status?: string; hospitalId?: string; search?: string; page?: number; pageSize?: number }) =>
    api.get<ApiEnvelope<Paginated<UserListItem>>>("/users", { params }).then((r) => r.data),

  get: (userId: string) => api.get<ApiEnvelope<UserDetail>>(`/users/${userId}`).then((r) => r.data),

  createAdmin: (payload: {
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    hospitalId?: string;
    temporaryPassword: string;
  }) => api.post<ApiEnvelope<{ id: string; email: string }>>("/users/admins", payload).then((r) => r.data),

  updateStatus: (userId: string, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED", reason?: string) =>
    api.patch<ApiEnvelope<null>>(`/users/${userId}/status`, { status, reason }).then((r) => r.data),

  remove: (userId: string) => api.delete<ApiEnvelope<null>>(`/users/${userId}`).then((r) => r.data),
};