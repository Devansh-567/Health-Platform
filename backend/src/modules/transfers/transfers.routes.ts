import { Router } from "express";
import * as controller from "./transfers.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import {
  initiateTransferSchema,
  listTransfersSchema,
  transferIdParamSchema,
  respondTransferSchema,
} from "./transfers.validation";

const router = Router();
router.use(authenticate);

// Every route here is gated by the single patient.transfer.manage permission —
// admin1 (requester) and admin2 (approver) are the same role holding the same
// permission, just acting from opposite ends of a request; the service layer
// (not the route) enforces who may do what to a given request (see
// transfers.service.ts for the from/to hospital scoping rules).
const canManage = requirePermission(PERMISSIONS.PATIENT_TRANSFER_MANAGE);

router.post("/", canManage, validate(initiateTransferSchema), controller.initiateTransfer);

// Requests directed AT the caller's hospital (admin2's inbox).
router.get("/incoming", canManage, validate(listTransfersSchema), controller.listIncoming);
// Requests the caller's hospital has sent out (admin1's sent list).
router.get("/outgoing", canManage, validate(listTransfersSchema), controller.listOutgoing);

router.get("/:transferId", canManage, validate(transferIdParamSchema), controller.getTransfer);
router.post("/:transferId/accept", canManage, validate(respondTransferSchema), controller.acceptTransfer);
router.post("/:transferId/reject", canManage, validate(respondTransferSchema), controller.rejectTransfer);
router.post("/:transferId/cancel", canManage, validate(transferIdParamSchema), controller.cancelTransfer);

export default router;
