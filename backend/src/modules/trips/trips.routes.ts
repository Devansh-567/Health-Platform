import { Router } from "express";
import * as controller from "./trips.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import { dispatchTripSchema, listTripsSchema, tripIdParamSchema, updateTripStatusSchema } from "./trips.validation";

const router = Router();
router.use(authenticate);

const canDispatch = requirePermission(PERMISSIONS.AMBULANCE_TRIP_MANAGE);
// Broad read access: Admin, Doctor, Nurse, Patient (own transfers) and
// Driver (own trips) all hold ambulance_trip.view — the service layer scopes
// exactly what each of them can see (see trips.service.ts#scopeWhere).
const canView = requirePermission(PERMISSIONS.AMBULANCE_TRIP_VIEW);
// Advancing/cancelling a trip is either the assigned driver or a scoped
// admin — service layer enforces exactly who, per-trip.
const canUpdateStatus = requirePermission(PERMISSIONS.AMBULANCE_TRIP_DRIVE, PERMISSIONS.AMBULANCE_TRIP_MANAGE);

router.post("/", canDispatch, validate(dispatchTripSchema), controller.dispatchTrip);
router.get("/", canView, validate(listTripsSchema), controller.listTrips);
router.get("/:tripId", canView, validate(tripIdParamSchema), controller.getTrip);
router.patch("/:tripId/status", canUpdateStatus, validate(updateTripStatusSchema), controller.updateTripStatus);

export default router;
