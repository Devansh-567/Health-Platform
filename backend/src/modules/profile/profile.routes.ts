import { Router } from "express";
import * as controller from "./profile.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import { updateMyProfileSchema } from "./profile.validation";

const router = Router();
router.use(authenticate);

router.get("/me", requirePermission(PERMISSIONS.PROFILE_MANAGE_OWN), controller.getMyProfile);
router.patch("/me", requirePermission(PERMISSIONS.PROFILE_MANAGE_OWN), validate(updateMyProfileSchema), controller.updateMyProfile);

export default router;
