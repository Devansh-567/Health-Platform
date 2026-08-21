import { Router } from "express";
import * as controller from "./users.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import { createAdminSchema, listUsersSchema, updateUserStatusSchema, assignPermissionOverrideSchema } from "./users.validation";

const router = Router();
router.use(authenticate);

router.post("/admins", requirePermission(PERMISSIONS.USER_CREATE_ADMIN), validate(createAdminSchema), controller.createAdmin);
router.get("/", requirePermission(PERMISSIONS.USER_VIEW), validate(listUsersSchema), controller.listUsers);
router.get("/:userId", requirePermission(PERMISSIONS.USER_VIEW), controller.getUser);
router.patch("/:userId/status", requirePermission(PERMISSIONS.USER_STATUS_UPDATE), validate(updateUserStatusSchema), controller.updateUserStatus);
router.post("/:userId/permission-overrides", requirePermission(PERMISSIONS.USER_PERMISSION_OVERRIDE), validate(assignPermissionOverrideSchema), controller.setPermissionOverride);
router.delete("/:userId", requirePermission(PERMISSIONS.USER_DELETE), controller.deleteUser);

export default router;
