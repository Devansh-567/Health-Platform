export type RoleCode = "SUPER_ADMIN" | "ADMIN" | "DOCTOR" | "NURSE" | "PATIENT" | "DRIVER";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: RoleCode;
  hospitalId: string | null;
  // True right after an admin-issued temporary password (e.g. a newly
  // created patient) until the person sets their own password.
  mustChangePassword: boolean;
}

export interface SessionState {
  accessToken: string | null;
  user: AuthUser | null;
  permissions: string[];
}

export interface ApiEnvelope<T> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
}
