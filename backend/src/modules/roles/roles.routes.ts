import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import * as rolesService from "./roles.service";

const router = Router();
router.use(authenticate, requirePermission(PERMISSIONS.ROLE_MANAGE));

const updatePermsSchema = z.object({
  body: z.object({ permissionCodes: z.array(z.string()).default([]) }),
  params: z.object({ roleId: z.string().uuid() }),
});

const createRoleSchema = z.object({
  body: z.object({
    code: z.string().min(2).max(50).regex(/^[A-Z_]+$/, "Use UPPER_SNAKE_CASE"),
    name: z.string().min(2).max(100),
    description: z.string().max(500).optional(),
  }),
});

router.get("/", asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await rolesService.listRoles() });
}));

router.get("/permissions", asyncHandler(async (_req, res) => {
  res.json({ success: true, data: await rolesService.listPermissions() });
}));

router.get("/:roleId", asyncHandler(async (req, res) => {
  res.json({ success: true, data: await rolesService.getRolePermissions(req.params.roleId) });
}));

router.put("/:roleId/permissions", validate(updatePermsSchema), asyncHandler(async (req, res) => {
  await rolesService.updateRolePermissions(req.user!.sub, req.params.roleId, req.body.permissionCodes);
  res.json({ success: true, message: "Role permissions updated" });
}));

router.post("/", validate(createRoleSchema), asyncHandler(async (req, res) => {
  const role = await rolesService.createCustomRole(req.user!.sub, req.body.code, req.body.name, req.body.description);
  res.status(201).json({ success: true, data: role });
}));

export default router;
