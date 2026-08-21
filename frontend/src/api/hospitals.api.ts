import { api } from "./client";
import { ApiEnvelope } from "../types/auth";

export interface Hospital {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  phone?: string | null;
  // Needed to dispatch ambulances (route origin/destination) and to place
  // the hospital on the live tracking map.
  latitude?: number | null;
  longitude?: number | null;
  isActive: boolean;
  createdAt: string;
  _count?: { departments: number; users: number };
}

export interface Department {
  id: string;
  hospitalId: string;
  name: string;
  createdAt: string;
  _count?: { users: number };
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const hospitalsApi = {
  list: (params: { search?: string; isActive?: string; page?: number; pageSize?: number }) =>
    api.get<ApiEnvelope<Paginated<Hospital>>>("/hospitals", { params }).then((r) => r.data),

  get: (hospitalId: string) =>
    api.get<ApiEnvelope<Hospital & { departments: Department[] }>>(`/hospitals/${hospitalId}`).then((r) => r.data),

  create: (payload: { name: string; code: string; address?: string; phone?: string; latitude?: number; longitude?: number }) =>
    api.post<ApiEnvelope<Hospital>>("/hospitals", payload).then((r) => r.data),

  update: (hospitalId: string, payload: { name?: string; address?: string; phone?: string; latitude?: number; longitude?: number }) =>
    api.patch<ApiEnvelope<Hospital>>(`/hospitals/${hospitalId}`, payload).then((r) => r.data),

  setStatus: (hospitalId: string, isActive: boolean) =>
    api.patch<ApiEnvelope<null>>(`/hospitals/${hospitalId}/status`, { isActive }).then((r) => r.data),

  createDepartment: (hospitalId: string, name: string) =>
    api.post<ApiEnvelope<Department>>(`/hospitals/${hospitalId}/departments`, { name }).then((r) => r.data),

  updateDepartment: (hospitalId: string, departmentId: string, name: string) =>
    api.patch<ApiEnvelope<Department>>(`/hospitals/${hospitalId}/departments/${departmentId}`, { name }).then((r) => r.data),

  deleteDepartment: (hospitalId: string, departmentId: string) =>
    api.delete<ApiEnvelope<null>>(`/hospitals/${hospitalId}/departments/${departmentId}`).then((r) => r.data),
};