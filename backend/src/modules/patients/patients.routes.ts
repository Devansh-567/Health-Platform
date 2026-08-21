import { Router } from "express";
import * as controller from "./patients.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import { createPatientSchema, resendCredentialsSchema } from "./patients.validation";

const router = Router();

// Listing patients reuses GET /api/users?roleCode=PATIENT (same hospital
// scoping, search, and pagination already implemented there) — this module
// only owns the creation/onboarding actions that are specific to patients.
router.use(authenticate);

router.post(
  "/",
  requirePermission(PERMISSIONS.PATIENT_MANAGE),
  validate(createPatientSchema),
  controller.createPatient
);

router.post(
  "/:userId/resend-credentials",
  requirePermission(PERMISSIONS.PATIENT_MANAGE),
  validate(resendCredentialsSchema),
  controller.resendCredentials
);

export default router;
