import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./trips.service";

function actorFrom(req: Request): service.Actor {
  return { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
}

export const dispatchTrip = asyncHandler(async (req, res) => {
  const trip = await service.dispatchTrip(actorFrom(req), req.body);
  res.status(201).json({ success: true, message: "Ambulance dispatched.", data: trip });
});

export const listTrips = asyncHandler(async (req, res) => {
  const q = req.query as { status?: string; transferId?: string };
  const data = await service.listTrips(actorFrom(req), q);
  res.json({ success: true, data });
});

export const getTrip = asyncHandler(async (req, res) => {
  const data = await service.getTrip(actorFrom(req), req.params.tripId);
  res.json({ success: true, data });
});

export const updateTripStatus = asyncHandler(async (req, res) => {
  const data = await service.updateTripStatus(actorFrom(req), req.params.tripId, req.body.status);
  res.json({ success: true, data });
});
