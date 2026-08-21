import { Request } from "express";
import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { hashPassword, verifyPassword } from "../../utils/hash";
import { generateOpaqueToken, hashOpaqueToken } from "../../utils/token";
import { mailer } from "../../utils/mailer";
import { writeAudit } from "../../utils/audit";
import { logger } from "../../config/logger";
import { normalizeEmail } from "../../utils/normalizeEmail";
import { issueTokenPair, revokeRefreshToken, rotateRefreshToken } from "./token.service";

export async function login(rawEmail: string, password: string, req: Request) {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });

  // Constant-shape response to avoid user enumeration via timing/content.
  if (!user) {
    throw ApiError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw ApiError.forbidden("Account temporarily locked due to failed login attempts", "ACCOUNT_LOCKED");
  }

  if (user.status === "SUSPENDED" || user.status === "DEACTIVATED") {
    throw ApiError.forbidden("This account is not active. Contact your administrator.", "ACCOUNT_INACTIVE");
  }

  const valid = await verifyPassword(user.passwordHash, password);

  if (!valid) {
    await handleFailedLogin(user.id, user.failedLoginCount, user.email, req);
    throw ApiError.unauthorized("Invalid email or password", "INVALID_CREDENTIALS");
  }

  if (user.status !== "ACTIVE") {
    throw ApiError.forbidden("Account is not active", "ACCOUNT_INACTIVE");
  }

  // Admin-issued temporary passwords (patient onboarding) expire after a
  // fixed window even if never used. Once mustChangePassword flips to false
  // (the user has set their own password), this check no longer applies —
  // tempPasswordExpiresAt only gates the ORIGINAL temp credential.
  if (user.mustChangePassword && user.tempPasswordExpiresAt && user.tempPasswordExpiresAt < new Date()) {
    throw ApiError.forbidden(
      "Your temporary password has expired. Use 'Forgot password' or ask your administrator to resend your invite.",
      "TEMP_PASSWORD_EXPIRED"
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date(), lastLoginIp: req.ip },
  });

  const tokens = await issueTokenPair(user, req);
  await writeAudit({ userId: user.id, action: "AUTH.LOGIN_SUCCESS", req });

  return {
    ...tokens,
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role.code,
      hospitalId: user.hospitalId,
      mustChangePassword: user.mustChangePassword,
    },
  };
}

async function handleFailedLogin(userId: string, currentCount: number, email: string, req: Request) {
  const newCount = currentCount + 1;
  const shouldLock = newCount >= env.MAX_FAILED_LOGIN_ATTEMPTS;

  await prisma.user.update({
    where: { id: userId },
    data: {
      failedLoginCount: newCount,
      lockedUntil: shouldLock ? new Date(Date.now() + env.ACCOUNT_LOCK_MINUTES * 60 * 1000) : undefined,
    },
  });

  await writeAudit({ userId, action: "AUTH.LOGIN_FAILED", req, metadata: { attempt: newCount } });

  if (shouldLock) {
    await mailer.sendAccountLockedEmail(email);
    await writeAudit({ userId, action: "AUTH.ACCOUNT_LOCKED", req });
  }
}

export async function refreshSession(rawRefreshToken: string, req: Request) {
  const result = await rotateRefreshToken(rawRefreshToken, req);
  if (!result) throw ApiError.unauthorized("Session expired, please log in again", "SESSION_EXPIRED");
  return result;
}

export async function logout(rawRefreshToken: string, userId?: string) {
  await revokeRefreshToken(rawRefreshToken);
  if (userId) await writeAudit({ userId, action: "AUTH.LOGOUT" });
}

export async function requestPasswordReset(rawEmail: string) {
  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });
  // Always respond success-shaped to the caller regardless — enumeration protection
  // is enforced at the controller layer by always returning a generic message.
  if (!user) {
    // Server-side only — never exposed to the client — but this is the #1
    // reason "the email never arrives": the address isn't a registered user
    // (typo, different casing, or testing with an email that never signed up).
    logger.warn({ email }, "Password reset requested for an email with no matching user");
    return;
  }

  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.PASSWORD_RESET_TTL_MIN * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId: user.id, tokenHash: hashOpaqueToken(rawToken), expiresAt },
  });

  const link = `${env.CLIENT_URL}/reset-password?token=${rawToken}`;
  await mailer.sendPasswordResetEmail(email, link);
  await writeAudit({ userId: user.id, action: "AUTH.PASSWORD_RESET_REQUESTED" });
}

export async function resetPassword(rawToken: string, newPassword: string) {
  const tokenHash = hashOpaqueToken(rawToken);
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw ApiError.badRequest("Invalid or expired reset link", "INVALID_TOKEN");
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false, failedLoginCount: 0, lockedUntil: null },
    }),
    prisma.refreshToken.updateMany({
      where: { userId: record.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await writeAudit({ userId: record.userId, action: "AUTH.PASSWORD_RESET_COMPLETED" });
}

export async function changeOwnPassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const valid = await verifyPassword(user.passwordHash, currentPassword);
  if (!valid) throw ApiError.badRequest("Current password is incorrect", "INVALID_CURRENT_PASSWORD");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash, passwordChangedAt: new Date(), mustChangePassword: false },
  });

  await writeAudit({ userId, action: "AUTH.PASSWORD_CHANGED" });
}