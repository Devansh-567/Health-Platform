import { Request } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { signAccessToken } from "../../utils/jwt";
import { generateOpaqueToken, hashOpaqueToken } from "../../utils/token";
import { resolveEffectivePermissions } from "./permission.service";

interface UserForToken {
  id: string;
  roleId: string;
  role: { code: string };
  hospitalId: string | null;
}

export async function issueTokenPair(user: UserForToken, req: Request) {
  const permissions = await resolveEffectivePermissions(user.id, user.roleId);

  const accessToken = signAccessToken({
    sub: user.id,
    roleCode: user.role.code,
    hospitalId: user.hospitalId,
    permissions,
  });

  const refreshTokenRaw = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash: hashOpaqueToken(refreshTokenRaw),
      expiresAt,
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    },
  });

  return { accessToken, refreshToken: refreshTokenRaw, refreshExpiresAt: expiresAt };
}

/** Rotates a refresh token: validates, revokes old, issues a new pair. Returns null if invalid. */
export async function rotateRefreshToken(rawToken: string, req: Request) {
  const tokenHash = hashOpaqueToken(rawToken);
  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  if (!stored || stored.revokedAt || stored.expiresAt < new Date()) return null;
  if (stored.user.status !== "ACTIVE") return null;

  const { accessToken, refreshToken, refreshExpiresAt } = await issueTokenPair(stored.user, req);

  await prisma.refreshToken.update({
    where: { id: stored.id },
    data: { revokedAt: new Date(), replacedByTokenHash: hashOpaqueToken(refreshToken) },
  });

  return { accessToken, refreshToken, refreshExpiresAt, userId: stored.userId };
}

export async function revokeRefreshToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllUserSessions(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
