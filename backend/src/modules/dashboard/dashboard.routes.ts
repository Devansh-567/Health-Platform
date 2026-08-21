import { Router } from "express";
import * as controller from "./dashboard.controller";
import { authenticate } from "../../middlewares/authenticate";

const router = Router();
router.use(authenticate);

// No requirePermission() here on purpose: every one of the five roles has
// exactly one "own" dashboard, and the response shape/query scope is
// entirely determined by the authenticated actor (see dashboard.service),
// not by anything the client can influence. There is no elevated action to
// gate — it's the same trust boundary as "view your own profile".
router.get("/overview", controller.getOverview);

export default router;
