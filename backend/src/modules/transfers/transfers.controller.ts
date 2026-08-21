import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./transfers.service";

function actorFrom(req: Request): service.Actor {
  return { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
}

export const initiateTransfer = asyncHandler(async (req, res) => {
  const transfer = await service.initiateTransfer(actorFrom(req), req.body);
  res.status(201).json({ success: true, message: "Transfer request sent to the receiving hospital.", data: transfer });
});

export const listIncoming = asyncHandler(async (req, res) => {
  const q = req.query as { status?: string; hospitalId?: string };
  const data = await service.listIncomingTransfers(actorFrom(req), q);
  res.json({ success: true, data });
});

export const listOutgoing = asyncHandler(async (req, res) => {
  const q = req.query as { status?: string; hospitalId?: string };
  const data = await service.listOutgoingTransfers(actorFrom(req), q);
  res.json({ success: true, data });
});

export const getTransfer = asyncHandler(async (req, res) => {
  const data = await service.getTransfer(actorFrom(req), req.params.transferId);
  res.json({ success: true, data });
});

export const acceptTransfer = asyncHandler(async (req, res) => {
  const data = await service.acceptTransfer(actorFrom(req), req.params.transferId, req.body.responseNote);
  res.json({ success: true, message: "Transfer accepted — the patient's full clinical history is now available to your hospital.", data });
});

export const rejectTransfer = asyncHandler(async (req, res) => {
  const data = await service.rejectTransfer(actorFrom(req), req.params.transferId, req.body.responseNote);
  res.json({ success: true, message: "Transfer request rejected.", data });
});

export const cancelTransfer = asyncHandler(async (req, res) => {
  const data = await service.cancelTransfer(actorFrom(req), req.params.transferId);
  res.json({ success: true, message: "Transfer request cancelled.", data });
});
