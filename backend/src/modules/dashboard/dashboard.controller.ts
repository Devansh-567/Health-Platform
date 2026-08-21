import { asyncHandler } from "../../utils/asyncHandler";
import * as dashboardService from "./dashboard.service";

export const getOverview = asyncHandler(async (req, res) => {
  const actor = { id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const overview = await dashboardService.getOverview(actor);
  res.json({ success: true, data: overview });
});
