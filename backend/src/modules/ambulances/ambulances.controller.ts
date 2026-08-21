import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./ambulances.service";

function actorFrom(req: Request): service.Actor {
  return { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
}

export const createAmbulance = asyncHandler(async (req, res) => {
  const ambulance = await service.createAmbulance(actorFrom(req), req.body);
  res.status(201).json({ success: true, data: ambulance });
});

export const listAmbulances = asyncHandler(async (req, res) => {
  const q = req.query as { status?: string; hospitalId?: string };
  const data = await service.listAmbulances(actorFrom(req), q);
  res.json({ success: true, data });
});

export const getAmbulance = asyncHandler(async (req, res) => {
  const data = await service.getAmbulance(actorFrom(req), req.params.ambulanceId);
  res.json({ success: true, data });
});

export const getMyAmbulance = asyncHandler(async (req, res) => {
  const data = await service.getMyAmbulance(actorFrom(req));
  res.json({ success: true, data });
});

export const assignDriver = asyncHandler(async (req, res) => {
  const data = await service.assignDriver(actorFrom(req), req.params.ambulanceId, req.body.driverId ?? null);
  res.json({ success: true, message: req.body.driverId ? "Driver assigned." : "Driver unassigned.", data });
});

export const setAmbulanceStatus = asyncHandler(async (req, res) => {
  const data = await service.setAmbulanceStatus(actorFrom(req), req.params.ambulanceId, req.body.status);
  res.json({ success: true, data });
});

export const recordLocation = asyncHandler(async (req, res) => {
  const data = await service.recordLocation(actorFrom(req), req.params.ambulanceId, req.body);
  res.json({ success: true, data });
});
