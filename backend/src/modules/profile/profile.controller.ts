import { asyncHandler } from "../../utils/asyncHandler";
import * as profileService from "./profile.service";

const actorFrom = (req: any) => ({ id: req.user!.sub, roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId });

export const getMyProfile = asyncHandler(async (req, res) => {
  const result = await profileService.getMyProfile(actorFrom(req));
  res.json({ success: true, data: result });
});

export const updateMyProfile = asyncHandler(async (req, res) => {
  const updated = await profileService.updateMyProfile(actorFrom(req), req.body);
  res.json({ success: true, data: updated });
});
