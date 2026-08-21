import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { hashPassword } from "../../utils/hash";
import { mailer } from "../../utils/mailer";
import { writeAudit } from "../../utils/audit";
import { normalizeEmail } from "../../utils/normalizeEmail";
import { revokeAllUserSessions } from "../auth/token.service";

const ADMIN_ROLE_CODE = "ADMIN";

/** Super admin creates an admin directly (no invitation step needed for this role). */
export async function createAdmin(
  actorId: string,
  input: { email: string; firstName: string; lastName: string; phone?: string; hospitalId?: string; temporaryPassword: string }
) {
  const email = normalizeEmail(input.email);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw ApiError.conflict("A user with this email already exists");

  const role = await prisma.role.findUnique({ where: { code: ADMIN_ROLE_CODE } });
  if (!role) throw ApiError.internal("Admin role is not configured");

  const passwordHash = await hashPassword(input.temporaryPassword);

  const user = await prisma.user.create({
    data: {
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      passwordHash,
      roleId: role.id,
      hospitalId: input.hospitalId,
      status: "ACTIVE",
      isEmailVerified: true,
      mustChangePassword: true,
      createdById: actorId,
      adminProfile: { create: {} },
    },
  });

  await mailer.sendVerificationEmail(user.email, `Your admin account was created. Temporary password sent separately.`);
  await writeAudit({ userId: actorId, action: "USER.ADMIN_CREATED", entityType: "User", entityId: user.id });

  return { id: user.id, email: user.email };
}

export async function listUsers(
  actor: { roleCode: string; hospitalId: string | null },
  filters: {
    roleCode?: string;
    status?: string;
    hospitalId?: string;
    search?: string;
    page: number;
    pageSize: number;
  }
) {
  // Admins only ever see users within their own hospital — the hospitalId
  // query param is ignored for them. Only Super Admin can see across
  // hospitals (or filter to a specific one via the query param).
  const effectiveHospitalId = actor.roleCode === "SUPER_ADMIN" ? filters.hospitalId : actor.hospitalId ?? undefined;

  const where: any = { deletedAt: null };
  if (filters.roleCode) where.role = { code: filters.roleCode };
  if (filters.status) where.status = filters.status;
  if (effectiveHospitalId) where.hospitalId = effectiveHospitalId;
  if (filters.search) {
    where.OR = [
      { email: { contains: filters.search, mode: "insensitive" } },
      { firstName: { contains: filters.search, mode: "insensitive" } },
      { lastName: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true, email: true, firstName: true, lastName: true, status: true,
        isEmailVerified: true, lastLoginAt: true, createdAt: true,
        mustChangePassword: true,
        role: { select: { code: true, name: true } },
        hospital: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.user.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getUserById(userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: {
      role: true,
      hospital: true,
      department: true,
      doctorProfile: true,
      nurseProfile: true,
      patientProfile: true,
      adminProfile: true,
    },
  });
  if (!user) throw ApiError.notFound("User not found");
  return user;
}

export async function updateUserStatus(actorId: string, userId: string, status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED", reason?: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: { role: true } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role.code === "SUPER_ADMIN") throw ApiError.forbidden("Super admin status cannot be modified here");

  await prisma.user.update({ where: { id: userId }, data: { status } });

  if (status !== "ACTIVE") await revokeAllUserSessions(userId);

  await writeAudit({
    userId: actorId,
    action: "USER.STATUS_CHANGED",
    entityType: "User",
    entityId: userId,
    metadata: { newStatus: status, reason },
  });
}

export async function setPermissionOverride(actorId: string, userId: string, permissionCode: string, effect: "GRANT" | "REVOKE") {
  const [user, permission] = await Promise.all([
    prisma.user.findFirst({ where: { id: userId, deletedAt: null } }),
    prisma.permission.findUnique({ where: { code: permissionCode } }),
  ]);
  if (!user) throw ApiError.notFound("User not found");
  if (!permission) throw ApiError.notFound("Permission not found");

  await prisma.userPermission.upsert({
    where: { userId_permissionId: { userId, permissionId: permission.id } },
    update: { effect },
    create: { userId, permissionId: permission.id, effect },
  });

  await writeAudit({
    userId: actorId,
    action: "USER.PERMISSION_OVERRIDE_SET",
    entityType: "User",
    entityId: userId,
    metadata: { permissionCode, effect },
  });
}

export async function softDeleteUser(actorId: string, userId: string) {
  const user = await prisma.user.findFirst({ where: { id: userId, deletedAt: null }, include: { role: true } });
  if (!user) throw ApiError.notFound("User not found");
  if (user.role.code === "SUPER_ADMIN") throw ApiError.forbidden("Super admin cannot be deleted");

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date(), status: "DEACTIVATED" } });
  await revokeAllUserSessions(userId);
  await writeAudit({ userId: actorId, action: "USER.DELETED", entityType: "User", entityId: userId });
}