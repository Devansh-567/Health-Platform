import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../../utils/asyncHandler";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import * as invitationsService from "./invitations.service";

const router = Router();

const createInviteSchema = z.object({
  body: z.object({
    email: z.string().email(),
    roleCode: z.enum(["DOCTOR", "NURSE", "DRIVER"]),
    hospitalId: z.string().uuid().optional(),
    departmentId: z.string().uuid().optional(),
  }),
});

const acceptInviteSchema = z.object({
  body: z.object({
    token: z.string().min(1),
    password: z
      .string()
      .min(10)
      .regex(/[a-z]/)
      .regex(/[A-Z]/)
      .regex(/[0-9]/)
      .regex(/[^a-zA-Z0-9]/),
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    phone: z.string().min(7).max(20).optional(),
  }),
});

// Public: prospective doctor/nurse looks up an invite by token, then accepts it.
router.get("/:token", asyncHandler(async (req, res) => {
  const invitation = await invitationsService.getInvitationByToken(req.params.token);
  res.json({ success: true, data: { email: invitation.email, role: invitation.role.name, expiresAt: invitation.expiresAt } });
}));

router.post("/accept", validate(acceptInviteSchema), asyncHandler(async (req, res) => {
  const result = await invitationsService.acceptInvitation(req.body);
  res.status(201).json({ success: true, message: "Account created. You can now log in.", data: result });
}));

// Admin-only below
router.use(authenticate);

router.post("/", requirePermission(PERMISSIONS.USER_CREATE_STAFF), validate(createInviteSchema), asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const result = await invitationsService.createInvitation(actor, req.body);
  res.status(201).json({ success: true, data: result });
}));

router.get("/", requirePermission(PERMISSIONS.USER_CREATE_STAFF), asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const result = await invitationsService.listInvitations(actor, req.query.hospitalId as string | undefined);
  res.json({ success: true, data: result });
}));

router.delete("/:invitationId", requirePermission(PERMISSIONS.USER_CREATE_STAFF), asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  await invitationsService.revokeInvitation(actor, req.params.invitationId);
  res.json({ success: true, message: "Invitation revoked" });
}));

export default router;