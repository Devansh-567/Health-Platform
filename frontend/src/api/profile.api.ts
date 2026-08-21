import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
export type BloodGroup = "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | "O+" | "O-" | "UNKNOWN";

export interface PatientProfile {
  id: string;
  userId: string;
  dateOfBirth: string | null;
  gender: string | null;
  bloodGroup: string | null;
  address: string | null;
  emergencyContact: string | null;
  emergencyPhone: string | null;
  medicalRecordNo: string | null;
  createdAt: string;
}

export interface MyProfileResponse {
  roleCode: string;
  editableFields: string[];
  profile: PatientProfile | null;
}

export interface UpdateMyProfilePayload {
  dateOfBirth?: string;
  gender?: Gender;
  bloodGroup?: BloodGroup;
  medicalRecordNo?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

export const profileApi = {
  getMine: () => api.get<ApiEnvelope<MyProfileResponse>>("/profile/me").then((r) => r.data),

  updateMine: (payload: UpdateMyProfilePayload) =>
    api.patch<ApiEnvelope<PatientProfile>>("/profile/me", payload).then((r) => r.data),
};
