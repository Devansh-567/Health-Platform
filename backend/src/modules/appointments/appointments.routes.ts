import { Router } from "express";
import * as controller from "./appointments.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import {
  listDoctorsSchema,
  bookAppointmentSchema,
  listAppointmentsSchema,
  appointmentIdParamSchema,
  cancelAppointmentSchema,
  rescheduleAppointmentSchema,
} from "./appointments.validation";

const router = Router();
router.use(authenticate);

router.get(
  "/doctors",
  requirePermission(PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(listDoctorsSchema),
  controller.listDoctors
);

router.post(
  "/",
  requirePermission(PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(bookAppointmentSchema),
  controller.createAppointment
);

router.get(
  "/",
  requirePermission(PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(listAppointmentsSchema),
  controller.listAppointments
);

router.get(
  "/:id",
  requirePermission(PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(appointmentIdParamSchema),
  controller.getAppointment
);

router.patch(
  "/:id/confirm",
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(appointmentIdParamSchema),
  controller.confirmAppointment
);

router.patch(
  "/:id/cancel",
  requirePermission(PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(cancelAppointmentSchema),
  controller.cancelAppointment
);

router.patch(
  "/:id/complete",
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(appointmentIdParamSchema),
  controller.completeAppointment
);

router.patch(
  "/:id/no-show",
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(appointmentIdParamSchema),
  controller.markNoShow
);

router.patch(
  "/:id/reschedule",
  requirePermission(PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY),
  validate(rescheduleAppointmentSchema),
  controller.rescheduleAppointment
);

export default router;
