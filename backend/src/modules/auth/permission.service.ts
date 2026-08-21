import { prisma } from "../../config/prisma";
import { PermissionEffect } from "@prisma/client";

/**
 * Resolves a user's effective permission codes = (role's permissions)
 * plus per-user GRANT overrides, minus per-user REVOKE overrides.
 * This is the single source of truth used at login/refresh to embed
 * permissions into the access token, and can be recomputed on demand.
 */
export async function resolveEffectivePermissions(userId: string, roleId: string): Promise<string[]> {
  const [rolePerms, userPerms] = await Promise.all([
    prisma.rolePermission.findMany({
      where: { roleId },
      select: { permission: { select: { code: true } } },
    }),
    prisma.userPermission.findMany({
      where: { userId },
      select: { effect: true, permission: { select: { code: true } } },
    }),
  ]);

  const effective = new Set(rolePerms.map((rp) => rp.permission.code));

  for (const up of userPerms) {
    if (up.effect === PermissionEffect.GRANT) effective.add(up.permission.code);
    else effective.delete(up.permission.code);
  }

  return Array.from(effective);
}
