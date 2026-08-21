import { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { env, isProd } from "../../config/env";
import { prisma } from "../../config/prisma";
import * as authService from "./auth.service";

const REFRESH_COOKIE = "refreshToken";

function setRefreshCookie(res: Response, token: string, expiresAt: Date) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "strict",
    domain: env.COOKIE_DOMAIN,
    expires: expiresAt,
    path: "/api/auth",
  });
}

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const result = await authService.login(email, password, req);

  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.json({
    success: true,
    data: { accessToken: result.accessToken, user: result.user },
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (!token) return res.status(401).json({ success: false, code: "NO_SESSION", message: "No active session" });

  const result = await authService.refreshSession(token, req);
  setRefreshCookie(res, result.refreshToken, result.refreshExpiresAt);
  res.json({ success: true, data: { accessToken: result.accessToken } });
});

export const logout = asyncHandler(async (req, res) => {
  const token = req.cookies?.[REFRESH_COOKIE];
  if (token) await authService.logout(token, req.user?.sub);
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
  res.json({ success: true, message: "Logged out" });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  await authService.requestPasswordReset(req.body.email);
  res.json({ success: true, message: "If that email exists, a reset link has been sent." });
});

export const resetPassword = asyncHandler(async (req, res) => {
  await authService.resetPassword(req.body.token, req.body.password);
  res.json({ success: true, message: "Password reset successfully. Please log in." });
});

export const changePassword = asyncHandler(async (req, res) => {
  await authService.changeOwnPassword(req.user!.sub, req.body.currentPassword, req.body.newPassword);
  res.json({ success: true, message: "Password changed successfully." });
});

export const me = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.sub },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      hospitalId: true,
      mustChangePassword: true,
      role: { select: { code: true } },
    },
  });

  res.json({
    success: true,
    data: {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.code,
        hospitalId: user.hospitalId,
        mustChangePassword: user.mustChangePassword,
      },
      permissions: req.user!.permissions,
    },
  });
});
