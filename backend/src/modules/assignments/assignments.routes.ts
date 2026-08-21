import { Router } from "express";
import * as controller from "./assignments.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import {
  listAssignedPatientsSchema,
  searchAssignablePatientsSchema,
  assignPatientSchema,
  unassignPatientSchema,
} from "./assignments.validation";

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.PATIENT_ASSIGN));

router.get("/patients/search", validate(searchAssignablePatientsSchema), controller.searchAssignablePatients);

router.get("/staff/:staffUserId/patients", validate(listAssignedPatientsSchema), controller.listAssignedPatients);
router.post("/staff/:staffUserId/patients", validate(assignPatientSchema), controller.assignPatient);
router.delete("/staff/:staffUserId/patients/:patientUserId", validate(unassignPatientSchema), controller.unassignPatient);

export default router;
