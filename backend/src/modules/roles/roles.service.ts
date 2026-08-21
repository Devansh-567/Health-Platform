import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";

export async function listRoles() {
  return prisma.role.findMany({
    include: { _count: { select: { users: true, rolePermissions: true } } },
    orderBy: { name: "asc" },
  });
}

export async function listPermissions() {
  return prisma.permission.findMany({ orderBy: [{ module: "asc" }, { code: "asc" }] });
}

export async function getRolePermissions(roleId: string) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    include: { rolePermissions: { include: { permission: true } } },
  });
  if (!role) throw ApiError.notFound("Role not found");
  return role;
}

export async function updateRolePermissions(actorId: string, roleId: string, permissionCodes: string[]) {
  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) throw ApiError.notFound("Role not found");
  if (role.code === "SUPER_ADMIN") throw ApiError.forbidden("Super admin permissions are fixed and cannot be modified");

  const permissions = await prisma.permission.findMany({ where: { code: { in: permissionCodes } } });
  if (permissions.length !== permissionCodes.length) {
    throw ApiError.badRequest("One or more permission codes are invalid");
  }

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId } }),
    prisma.rolePermission.createMany({
      data: permissions.map((p) => ({ roleId, permissionId: p.id })),
    }),
  ]);

  await writeAudit({
    userId: actorId,
    action: "ROLE.PERMISSIONS_UPDATED",
    entityType: "Role",
    entityId: roleId,
    metadata: { permissionCodes },
  });
}

export async function createCustomRole(actorId: string, code: string, name: string, description?: string) {
  const existing = await prisma.role.findUnique({ where: { code } });
  if (existing) throw ApiError.conflict("A role with this code already exists");

  const role = await prisma.role.create({ data: { code, name, description, isSystem: false } });
  await writeAudit({ userId: actorId, action: "ROLE.CREATED", entityType: "Role", entityId: role.id });
  return role;
}
