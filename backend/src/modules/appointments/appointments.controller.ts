import { asyncHandler } from "../../utils/asyncHandler";
import * as appointmentsService from "./appointments.service";

export const listDoctors = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const q = req.query as { hospitalId?: string; departmentId?: string; search?: string };
  const result = await appointmentsService.listBookableDoctors(actor, {
    hospitalId: q.hospitalId,
    departmentId: q.departmentId,
    search: q.search,
  });
  res.json({ success: true, data: result });
});

export const createAppointment = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const result = await appointmentsService.createAppointment(actor, req.body);
  res.status(201).json({ success: true, data: result });
});

export const listAppointments = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const q = req.query as any;
  const result = await appointmentsService.listAppointments(actor, {
    status: q.status,
    from: q.from,
    to: q.to,
    doctorUserId: q.doctorUserId,
    patientUserId: q.patientUserId,
    page: Number(q.page) || 1,
    pageSize: Number(q.pageSize) || 20,
  });
  res.json({ success: true, data: result });
});

export const getAppointment = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const result = await appointmentsService.getAppointmentById(actor, req.params.id);
  res.json({ success: true, data: result });
});

export const confirmAppointment = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  await appointmentsService.confirmAppointment(actor, req.params.id);
  res.json({ success: true, message: "Appointment confirmed" });
});

export const cancelAppointment = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  await appointmentsService.cancelAppointment(actor, req.params.id, req.body.reason);
  res.json({ success: true, message: "Appointment cancelled" });
});

export const completeAppointment = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  await appointmentsService.completeAppointment(actor, req.params.id);
  res.json({ success: true, message: "Appointment marked as completed" });
});

export const markNoShow = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  await appointmentsService.markNoShow(actor, req.params.id);
  res.json({ success: true, message: "Appointment marked as no-show" });
});

export const rescheduleAppointment = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const result = await appointmentsService.rescheduleAppointment(actor, req.params.id, req.body);
  res.json({ success: true, data: result });
});
