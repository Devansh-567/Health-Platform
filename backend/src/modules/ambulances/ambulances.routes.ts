import { Router } from "express";
import * as controller from "./ambulances.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import {
  createAmbulanceSchema,
  listAmbulancesSchema,
  ambulanceIdParamSchema,
  setAmbulanceStatusSchema,
  assignDriverSchema,
  recordLocationSchema,
} from "./ambulances.validation";

const router = Router();
router.use(authenticate);

// Fleet management (add vehicles, list, toggle maintenance/offline, assign a
// regular driver) is AMBULANCE_MANAGE. Reading the list is also allowed for
// anyone who can dispatch a trip (AMBULANCE_TRIP_MANAGE) — the dispatch
// modal needs to see which of the hospital's ambulances are AVAILABLE.
const canManageFleet = requirePermission(PERMISSIONS.AMBULANCE_MANAGE);
const canView = requirePermission(PERMISSIONS.AMBULANCE_MANAGE, PERMISSIONS.AMBULANCE_TRIP_MANAGE);

router.post("/", canManageFleet, validate(createAmbulanceSchema), controller.createAmbulance);
router.get("/", canView, validate(listAmbulancesSchema), controller.listAmbulances);

// A driver's own assigned vehicle — used by the emergency console instead
// of asking them to pick one. Must be registered before the plain "/:id"
// route below, or Express would try to parse "mine" as an ambulance id.
router.get("/mine", requirePermission(PERMISSIONS.AMBULANCE_TRIP_DRIVE, PERMISSIONS.EMERGENCY_CASE_MANAGE), controller.getMyAmbulance);

router.get("/:ambulanceId", canView, validate(ambulanceIdParamSchema), controller.getAmbulance);
router.patch("/:ambulanceId/status", canManageFleet, validate(setAmbulanceStatusSchema), controller.setAmbulanceStatus);
router.patch("/:ambulanceId/driver", canManageFleet, validate(assignDriverSchema), controller.assignDriver);

// Driver-only: push a live GPS position from the mobile driver console.
router.post(
  "/:ambulanceId/location",
  requirePermission(PERMISSIONS.AMBULANCE_TRIP_DRIVE),
  validate(recordLocationSchema),
  controller.recordLocation
);

export default router;
