import { Router } from "express";
import * as controller from "./emergency.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import {
  startCaseSchema,
  caseIdParamSchema,
  selectHospitalSchema,
  assignDoctorSchema,
  recordVitalsSchema,
  listCasesSchema,
} from "./emergency.validation";

const router = Router();
router.use(authenticate);

const canManage = requirePermission(PERMISSIONS.EMERGENCY_CASE_MANAGE); // paramedic
const canTriage = requirePermission(PERMISSIONS.EMERGENCY_CASE_TRIAGE); // hospital admin
const canView = requirePermission(PERMISSIONS.EMERGENCY_CASE_VIEW); // admin, doctor, paramedic
// Arrival/close/cancel can legitimately come from either the paramedic or a
// scoped admin — service layer enforces exactly who, per case.
const canProgress = requirePermission(PERMISSIONS.EMERGENCY_CASE_MANAGE, PERMISSIONS.EMERGENCY_CASE_TRIAGE);

router.post("/", canManage, validate(startCaseSchema), controller.startCase);
router.patch("/:caseId/hospital", canManage, validate(selectHospitalSchema), controller.selectHospital);
router.patch("/:caseId/vitals", canManage, validate(recordVitalsSchema), controller.recordVitals);

router.patch("/:caseId/acknowledge", canTriage, validate(caseIdParamSchema), controller.acknowledgeCase);
router.patch("/:caseId/assign-doctor", canTriage, validate(assignDoctorSchema), controller.assignDoctor);

router.patch("/:caseId/arrived", canProgress, validate(caseIdParamSchema), controller.markArrived);
router.patch("/:caseId/close", canProgress, validate(caseIdParamSchema), controller.closeCase);
router.patch("/:caseId/cancel", canProgress, validate(caseIdParamSchema), controller.cancelCase);

router.get("/", canView, validate(listCasesSchema), controller.listCases);
router.get("/:caseId", canView, validate(caseIdParamSchema), controller.getCase);

export default router;
