import { asyncHandler } from "../../utils/asyncHandler";
import * as usersService from "./users.service";

export const createAdmin = asyncHandler(async (req, res) => {
  const result = await usersService.createAdmin(req.user!.sub, req.body);
  res.status(201).json({ success: true, data: result });
});

export const listUsers = asyncHandler(async (req, res) => {
  const q = req.query as any;
  const actor = { roleCode: req.user!.roleCode, hospitalId: req.user!.hospitalId };
  const result = await usersService.listUsers(actor, {
    roleCode: q.roleCode,
    status: q.status,
    hospitalId: q.hospitalId,
    search: q.search,
    page: Number(q.page) || 1,
    pageSize: Number(q.pageSize) || 20,
  });
  res.json({ success: true, data: result });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await usersService.getUserById(req.params.userId);
  res.json({ success: true, data: user });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  await usersService.updateUserStatus(req.user!.sub, req.params.userId, req.body.status, req.body.reason);
  res.json({ success: true, message: "User status updated" });
});

export const setPermissionOverride = asyncHandler(async (req, res) => {
  await usersService.setPermissionOverride(req.user!.sub, req.params.userId, req.body.permissionCode, req.body.effect);
  res.json({ success: true, message: "Permission override applied" });
});

export const deleteUser = asyncHandler(async (req, res) => {
  await usersService.softDeleteUser(req.user!.sub, req.params.userId);
  res.json({ success: true, message: "User deactivated" });
});