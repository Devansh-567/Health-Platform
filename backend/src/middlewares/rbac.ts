import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";

/**
 * Permission-based guard. The access token carries the user's *effective*
 * permission set (role permissions + per-user grants/revokes), resolved from
 * the DB at login/refresh time — so this middleware never hardcodes role logic,
 * it only checks membership in that resolved list.
 */
export function requirePermission(...anyOf: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    const has = anyOf.some((p) => req.user!.permissions.includes(p));
    if (!has) return next(ApiError.forbidden("You do not have permission to perform this action"));
    next();
  };
}

/** Use sparingly — for endpoints truly scoped to a role code rather than a permission. */
export function requireRole(...roleCodes: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roleCodes.includes(req.user.roleCode)) return next(ApiError.forbidden());
    next();
  };
}
