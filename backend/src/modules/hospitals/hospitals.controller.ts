import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./hospitals.service";

export const createHospital = asyncHandler(async (req, res) => {
  const hospital = await service.createHospital(req.user!.sub, req.body);
  res.status(201).json({ success: true, data: hospital });
});

export const listHospitals = asyncHandler(async (req, res) => {
  const q = req.query as any;
  const result = await service.listHospitals({
    search: q.search,
    isActive: q.isActive,
    page: Number(q.page) || 1,
    pageSize: Number(q.pageSize) || 20,
  });
  res.json({ success: true, data: result });
});

export const getHospital = asyncHandler(async (req, res) => {
  const hospital = await service.getHospitalById(req.params.hospitalId);
  res.json({ success: true, data: hospital });
});

export const updateHospital = asyncHandler(async (req, res) => {
  const hospital = await service.updateHospital(req.user!.sub, req.params.hospitalId, req.body);
  res.json({ success: true, data: hospital });
});

export const setHospitalStatus = asyncHandler(async (req, res) => {
  await service.setHospitalStatus(req.user!.sub, req.params.hospitalId, req.body.isActive);
  res.json({ success: true, message: "Hospital status updated" });
});

export const createDepartment = asyncHandler(async (req, res) => {
  const department = await service.createDepartment(req.user!.sub, req.params.hospitalId, req.body.name);
  res.status(201).json({ success: true, data: department });
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const department = await service.updateDepartment(req.user!.sub, req.params.hospitalId, req.params.departmentId, req.body.name);
  res.json({ success: true, data: department });
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  await service.deleteDepartment(req.user!.sub, req.params.hospitalId, req.params.departmentId);
  res.json({ success: true, message: "Department deleted" });
});