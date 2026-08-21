import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";

export async function createHospital(
  actorId: string,
  input: { name: string; code: string; address?: string; phone?: string; latitude?: number; longitude?: number }
) {
  const existing = await prisma.hospital.findUnique({ where: { code: input.code } });
  if (existing) throw ApiError.conflict("A hospital with this code already exists");

  const hospital = await prisma.hospital.create({ data: input });
  await writeAudit({ userId: actorId, action: "HOSPITAL.CREATED", entityType: "Hospital", entityId: hospital.id });
  return hospital;
}

export async function listHospitals(filters: { search?: string; isActive?: string; page: number; pageSize: number }) {
  const where: any = {};
  if (filters.isActive !== undefined) where.isActive = filters.isActive === "true";
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { code: { contains: filters.search, mode: "insensitive" } },
    ];
  }

  const [items, total] = await Promise.all([
    prisma.hospital.findMany({
      where,
      include: { _count: { select: { departments: true, users: true } } },
      orderBy: { name: "asc" },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.hospital.count({ where }),
  ]);

  return { items, total, page: filters.page, pageSize: filters.pageSize };
}

export async function getHospitalById(hospitalId: string) {
  const hospital = await prisma.hospital.findUnique({
    where: { id: hospitalId },
    include: { departments: { orderBy: { name: "asc" }, include: { _count: { select: { users: true } } } } },
  });
  if (!hospital) throw ApiError.notFound("Hospital not found");
  return hospital;
}

export async function updateHospital(
  actorId: string,
  hospitalId: string,
  input: { name?: string; address?: string; phone?: string; latitude?: number; longitude?: number }
) {
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) throw ApiError.notFound("Hospital not found");

  const updated = await prisma.hospital.update({ where: { id: hospitalId }, data: input });
  await writeAudit({ userId: actorId, action: "HOSPITAL.UPDATED", entityType: "Hospital", entityId: hospitalId });
  return updated;
}

export async function setHospitalStatus(actorId: string, hospitalId: string, isActive: boolean) {
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) throw ApiError.notFound("Hospital not found");

  await prisma.hospital.update({ where: { id: hospitalId }, data: { isActive } });
  await writeAudit({
    userId: actorId,
    action: isActive ? "HOSPITAL.ACTIVATED" : "HOSPITAL.DEACTIVATED",
    entityType: "Hospital",
    entityId: hospitalId,
  });
}

export async function createDepartment(actorId: string, hospitalId: string, name: string) {
  const hospital = await prisma.hospital.findUnique({ where: { id: hospitalId } });
  if (!hospital) throw ApiError.notFound("Hospital not found");

  const existing = await prisma.department.findFirst({ where: { hospitalId, name: { equals: name, mode: "insensitive" } } });
  if (existing) throw ApiError.conflict("A department with this name already exists in this hospital");

  const department = await prisma.department.create({ data: { hospitalId, name } });
  await writeAudit({ userId: actorId, action: "DEPARTMENT.CREATED", entityType: "Department", entityId: department.id });
  return department;
}

export async function updateDepartment(actorId: string, hospitalId: string, departmentId: string, name: string) {
  const department = await prisma.department.findFirst({ where: { id: departmentId, hospitalId } });
  if (!department) throw ApiError.notFound("Department not found");

  const duplicate = await prisma.department.findFirst({
    where: { hospitalId, name: { equals: name, mode: "insensitive" }, NOT: { id: departmentId } },
  });
  if (duplicate) throw ApiError.conflict("A department with this name already exists in this hospital");

  const updated = await prisma.department.update({ where: { id: departmentId }, data: { name } });
  await writeAudit({ userId: actorId, action: "DEPARTMENT.UPDATED", entityType: "Department", entityId: departmentId });
  return updated;
}

export async function deleteDepartment(actorId: string, hospitalId: string, departmentId: string) {
  const department = await prisma.department.findFirst({
    where: { id: departmentId, hospitalId },
    include: { _count: { select: { users: true } } },
  });
  if (!department) throw ApiError.notFound("Department not found");
  if (department._count.users > 0) {
    throw ApiError.conflict("Cannot delete a department with users assigned to it");
  }

  await prisma.department.delete({ where: { id: departmentId } });
  await writeAudit({ userId: actorId, action: "DEPARTMENT.DELETED", entityType: "Department", entityId: departmentId });
}