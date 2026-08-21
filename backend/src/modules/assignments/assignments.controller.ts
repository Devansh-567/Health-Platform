import { asyncHandler } from "../../utils/asyncHandler";
import * as assignmentsService from "./assignments.service";

export const listAssignedPatients = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const result = await assignmentsService.listAssignedPatients(actor, req.params.staffUserId);
  res.json({ success: true, data: result });
});

export const searchAssignablePatients = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const q = req.query as { search?: string; staffUserId?: string };
  const result = await assignmentsService.searchAssignablePatients(actor, q.search ?? "", q.staffUserId);
  res.json({ success: true, data: result });
});

export const assignPatient = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  await assignmentsService.assignPatient(actor, req.params.staffUserId, req.body.patientUserId);
  res.status(201).json({ success: true, message: "Patient assigned" });
});

export const unassignPatient = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  await assignmentsService.unassignPatient(actor, req.params.staffUserId, req.params.patientUserId);
  res.json({ success: true, message: "Patient unassigned" });
});
