import { Request } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import * as patientsService from "./patients.service";

function actorFrom(req: Request): patientsService.Actor {
  return { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
}

export const createPatient = asyncHandler(async (req, res) => {
  const result = await patientsService.createPatient(actorFrom(req), req.body);
  res.status(201).json({
    success: true,
    message: "Patient account created. Temporary login credentials were emailed to them.",
    data: result,
  });
});

export const resendCredentials = asyncHandler(async (req, res) => {
  const result = await patientsService.resendPatientCredentials(actorFrom(req), req.params.userId);
  res.json({
    success: true,
    message: "New temporary credentials were emailed to the patient.",
    data: result,
  });
});
