import { Router } from "express";
import * as controller from "./hospitals.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import {
  createHospitalSchema,
  updateHospitalSchema,
  updateHospitalStatusSchema,
  listHospitalsSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
} from "./hospitals.validation";

const router = Router();
router.use(authenticate);

// Read access: Super Admin (hospital.manage) AND Admin (hospital.view).
const canView = requirePermission(PERMISSIONS.HOSPITAL_VIEW, PERMISSIONS.HOSPITAL_MANAGE);
// Write/lifecycle access: Super Admin only. Creating, editing, and
// activating/deactivating a hospital is tenant-level control — Admins
// operate within a hospital (departments, staff) but don't own it.
const canManage = requirePermission(PERMISSIONS.HOSPITAL_MANAGE);

router.get("/", canView, validate(listHospitalsSchema), controller.listHospitals);
router.get("/:hospitalId", canView, controller.getHospital);

router.post("/", canManage, validate(createHospitalSchema), controller.createHospital);
router.patch("/:hospitalId", canManage, validate(updateHospitalSchema), controller.updateHospital);
router.patch("/:hospitalId/status", canManage, validate(updateHospitalStatusSchema), controller.setHospitalStatus);

// Departments are day-to-day hospital operations — Admins manage these.
router.post(
  "/:hospitalId/departments",
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(createDepartmentSchema),
  controller.createDepartment
);
router.patch(
  "/:hospitalId/departments/:departmentId",
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  validate(updateDepartmentSchema),
  controller.updateDepartment
);
router.delete(
  "/:hospitalId/departments/:departmentId",
  requirePermission(PERMISSIONS.DEPARTMENT_MANAGE),
  controller.deleteDepartment
);

export default router;