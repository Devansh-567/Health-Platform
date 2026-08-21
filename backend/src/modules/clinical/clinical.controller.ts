import { asyncHandler } from "../../utils/asyncHandler";
import * as service from "./clinical.service";
import { ApiError } from "../../utils/ApiError";
import { reportFileAbsolutePath } from "../../config/storage";

function actorFrom(req: any) {
  return { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
}

export const listMyPatients = asyncHandler(async (req, res) => {
  const data = await service.listMyPatients(actorFrom(req));
  res.json({ success: true, data });
});

export const getPatientSummary = asyncHandler(async (req, res) => {
  const data = await service.getPatientSummary(actorFrom(req), req.params.patientUserId);
  res.json({ success: true, data });
});

export const createDiagnosis = asyncHandler(async (req, res) => {
  const diagnosis = await service.createDiagnosis(actorFrom(req), req.params.patientUserId, req.body);
  res.status(201).json({ success: true, data: diagnosis });
});

export const listDiagnoses = asyncHandler(async (req, res) => {
  const data = await service.listDiagnoses(actorFrom(req), req.params.patientUserId);
  res.json({ success: true, data });
});

export const createPrescription = asyncHandler(async (req, res) => {
  const prescription = await service.createPrescription(actorFrom(req), req.params.patientUserId, req.body);
  res.status(201).json({ success: true, data: prescription });
});

export const updatePrescriptionStatus = asyncHandler(async (req, res) => {
  const updated = await service.updatePrescriptionStatus(actorFrom(req), req.params.prescriptionId, req.body.status);
  res.json({ success: true, data: updated });
});

export const listPrescriptions = asyncHandler(async (req, res) => {
  const data = await service.listPrescriptions(actorFrom(req), req.params.patientUserId);
  res.json({ success: true, data });
});

export const recordVitals = asyncHandler(async (req, res) => {
  const vitals = await service.recordVitals(actorFrom(req), req.params.patientUserId, req.body);
  res.status(201).json({ success: true, data: vitals });
});

export const listVitals = asyncHandler(async (req, res) => {
  const data = await service.listVitals(actorFrom(req), req.params.patientUserId);
  res.json({ success: true, data });
});

export const createNote = asyncHandler(async (req, res) => {
  const note = await service.createNote(actorFrom(req), req.params.patientUserId, req.body.content);
  res.status(201).json({ success: true, data: note });
});

export const listNotes = asyncHandler(async (req, res) => {
  const data = await service.listNotes(actorFrom(req), req.params.patientUserId);
  res.json({ success: true, data });
});

export const listMyDiagnoses = asyncHandler(async (req, res) => {
  const data = await service.listMyDiagnoses(req.user!.sub);
  res.json({ success: true, data });
});

export const listMyPrescriptions = asyncHandler(async (req, res) => {
  const data = await service.listMyPrescriptions(req.user!.sub);
  res.json({ success: true, data });
});

export const listMyReports = asyncHandler(async (req, res) => {
  const data = await service.listMyReports(req.user!.sub);
  res.json({ success: true, data });
});

export const downloadMyReport = asyncHandler(async (req, res) => {
  const report = await service.resolveMyReportForDownload(req.user!.sub, req.params.reportId);
  res.download(reportFileAbsolutePath(report.storagePath), report.originalName);
});

export const uploadReport = asyncHandler(async (req, res) => {
  if (!req.file) throw ApiError.badRequest("No file was uploaded");
  const title = (req.body?.title as string) || req.file.originalname;
  const report = await service.uploadReport(actorFrom(req), req.params.patientUserId, req.file, title);
  res.status(201).json({ success: true, data: report });
});

export const listReports = asyncHandler(async (req, res) => {
  const data = await service.listReports(actorFrom(req), req.params.patientUserId);
  res.json({ success: true, data });
});

export const downloadReport = asyncHandler(async (req, res) => {
  const report = await service.resolveReportForDownload(actorFrom(req), req.params.patientUserId, req.params.reportId);
  res.download(reportFileAbsolutePath(report.storagePath), report.originalName);
});

export const deleteReport = asyncHandler(async (req, res) => {
  await service.deleteReport(actorFrom(req), req.params.patientUserId, req.params.reportId);
  res.json({ success: true, message: "Report deleted" });
});