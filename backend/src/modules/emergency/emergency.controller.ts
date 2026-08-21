import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./emergency.service";

function actorFrom(req: Request): service.Actor {
  return { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
}

export const startCase = asyncHandler(async (req, res) => {
  const data = await service.startCase(actorFrom(req), req.body);
  res.status(201).json({ success: true, message: "Emergency case started.", data });
});

export const selectHospital = asyncHandler(async (req, res) => {
  const data = await service.selectHospital(actorFrom(req), req.params.caseId, req.body);
  res.json({ success: true, message: "Hospital alerted.", data });
});

export const acknowledgeCase = asyncHandler(async (req, res) => {
  const data = await service.acknowledgeCase(actorFrom(req), req.params.caseId);
  res.json({ success: true, data });
});

export const assignDoctor = asyncHandler(async (req, res) => {
  const data = await service.assignDoctor(actorFrom(req), req.params.caseId, req.body.doctorId);
  res.json({ success: true, message: "Doctor assigned.", data });
});

export const recordVitals = asyncHandler(async (req, res) => {
  const data = await service.recordVitals(actorFrom(req), req.params.caseId, req.body);
  res.json({ success: true, data });
});

export const markArrived = asyncHandler(async (req, res) => {
  const data = await service.markArrived(actorFrom(req), req.params.caseId);
  res.json({ success: true, data });
});

export const closeCase = asyncHandler(async (req, res) => {
  const data = await service.closeCase(actorFrom(req), req.params.caseId);
  res.json({ success: true, data });
});

export const cancelCase = asyncHandler(async (req, res) => {
  const data = await service.cancelCase(actorFrom(req), req.params.caseId);
  res.json({ success: true, data });
});

export const listCases = asyncHandler(async (req, res) => {
  const q = req.query as { status?: string };
  const data = await service.listCases(actorFrom(req), q);
  res.json({ success: true, data });
});

export const getCase = asyncHandler(async (req, res) => {
  const data = await service.getCase(actorFrom(req), req.params.caseId);
  res.json({ success: true, data });
});
