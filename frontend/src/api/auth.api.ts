import { api } from "./client";
import { ApiEnvelope, AuthUser } from "../types/auth";

export interface LoginResponse {
  accessToken: string;
  user: AuthUser;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<ApiEnvelope<LoginResponse>>("/auth/login", { email, password }).then((r) => r.data),

  forgotPassword: (email: string) => api.post<ApiEnvelope<null>>("/auth/forgot-password", { email }).then((r) => r.data),

  resetPassword: (token: string, password: string) =>
    api.post<ApiEnvelope<null>>("/auth/reset-password", { token, password }).then((r) => r.data),

  logout: () => api.post<ApiEnvelope<null>>("/auth/logout").then((r) => r.data),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<ApiEnvelope<null>>("/auth/change-password", { currentPassword, newPassword }).then((r) => r.data),

  me: () => api.get<ApiEnvelope<{ user: AuthUser; permissions: string[] }>>("/auth/me").then((r) => r.data),

  acceptInvitation: (payload: { token: string; password: string; firstName: string; lastName: string; phone?: string }) =>
    api.post<ApiEnvelope<{ id: string; email: string }>>("/invitations/accept", payload).then((r) => r.data),

  getInvitation: (token: string) =>
    api.get<ApiEnvelope<{ email: string; role: string; expiresAt: string }>>(`/invitations/${token}`).then((r) => r.data),
};