import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { hashPassword } from "../../utils/hash";
import { generateOpaqueToken, hashOpaqueToken } from "../../utils/token";
import { normalizeEmail } from "../../utils/normalizeEmail";
import { mailer } from "../../utils/mailer";
import { writeAudit } from "../../utils/audit";

// Roles that must be onboarded via invitation rather than direct/public creation.
const INVITABLE_ROLE_CODES = ["DOCTOR", "NURSE", "DRIVER"];

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

export async function createInvitation(
  actor: Actor,
  input: { email: string; roleCode: string; hospitalId?: string; departmentId?: string }
) {
  if (!INVITABLE_ROLE_CODES.includes(input.roleCode)) {
    throw ApiError.badRequest(`Role ${input.roleCode} cannot be onboarded via invitation`);
  }

  // Hospital scoping: an Admin can only invite staff into their OWN hospital —
  // whatever hospitalId the client sends is ignored/overridden for non-Super-Admins.
  // Only Super Admin (who isn't tied to one facility) may target an arbitrary hospital.
  let hospitalId: string | undefined;
  if (actor.roleCode === "SUPER_ADMIN") {
    hospitalId = input.hospitalId;
  } else {
    if (!actor.hospitalId) {
      throw ApiError.badRequest(
        "Your account isn't linked to a hospital yet — contact a super admin before inviting staff.",
        "NO_HOSPITAL_ASSIGNED"
      );
    }
    hospitalId = actor.hospitalId;
  }

  const email = normalizeEmail(input.email);

  const [role, existingUser, pendingInvite] = await Promise.all([
    prisma.role.findUnique({ where: { code: input.roleCode } }),
    prisma.user.findUnique({ where: { email } }),
    prisma.invitation.findFirst({ where: { email, status: "PENDING" } }),
  ]);

  if (!role) throw ApiError.badRequest("Invalid role");
  if (existingUser) throw ApiError.conflict("A user with this email already exists");
  if (pendingInvite) throw ApiError.conflict("An active invitation for this email already exists");

  // A department must belong to the hospital the invitation is scoped to —
  // otherwise an Admin could smuggle in a department from a different hospital.
  if (input.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department || department.hospitalId !== hospitalId) {
      throw ApiError.badRequest("Department does not belong to the target hospital");
    }
  }

  const rawToken = generateOpaqueToken();
  const expiresAt = new Date(Date.now() + env.INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const invitation = await prisma.invitation.create({
    data: {
      email,
      roleId: role.id,
      hospitalId,
      departmentId: input.departmentId,
      invitedById: actor.id,
      tokenHash: hashOpaqueToken(rawToken),
      expiresAt,
    },
  });

  const link = `${env.CLIENT_URL}/accept-invitation?token=${rawToken}`;
  await mailer.sendInvitationEmail(email, link, role.name);
  await writeAudit({ userId: actor.id, action: "INVITATION.CREATED", entityType: "Invitation", entityId: invitation.id });

  return { id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt };
}

export async function getInvitationByToken(rawToken: string) {
  const tokenHash = hashOpaqueToken(rawToken);
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash }, include: { role: true } });

  if (!invitation || invitation.status !== "PENDING" || invitation.expiresAt < new Date()) {
    throw ApiError.badRequest("Invalid or expired invitation", "INVALID_INVITATION");
  }
  return invitation;
}

export async function acceptInvitation(input: {
  token: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
}) {
  const invitation = await getInvitationByToken(input.token);
  const passwordHash = await hashPassword(input.password);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email: invitation.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        passwordHash,
        roleId: invitation.roleId,
        hospitalId: invitation.hospitalId,
        departmentId: invitation.departmentId,
        status: "ACTIVE",
        isEmailVerified: true,
        createdById: invitation.invitedById,
        ...(invitation.role.code === "DOCTOR" ? { doctorProfile: { create: {} } } : {}),
        ...(invitation.role.code === "NURSE" ? { nurseProfile: { create: {} } } : {}),
        ...(invitation.role.code === "DRIVER" ? { driverProfile: { create: {} } } : {}),
      },
    });

    await tx.invitation.update({ where: { id: invitation.id }, data: { status: "ACCEPTED", acceptedAt: new Date() } });
    return created;
  });

  await writeAudit({ userId: user.id, action: "INVITATION.ACCEPTED", entityType: "User", entityId: user.id });
  return { id: user.id, email: user.email };
}

export async function revokeInvitation(actor: Actor, invitationId: string) {
  const invitation = await prisma.invitation.findUnique({ where: { id: invitationId } });
  if (!invitation || invitation.status !== "PENDING") throw ApiError.notFound("Active invitation not found");

  // An Admin can only revoke invitations that belong to their own hospital.
  if (actor.roleCode !== "SUPER_ADMIN" && invitation.hospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("You can only manage invitations for your own hospital");
  }

  await prisma.invitation.update({ where: { id: invitationId }, data: { status: "REVOKED" } });
  await writeAudit({ userId: actor.id, action: "INVITATION.REVOKED", entityType: "Invitation", entityId: invitationId });
}

export async function listInvitations(actor: Actor, requestedHospitalId?: string) {
  // Admins always see only their own hospital's invitations, regardless of
  // what's in the query string. Only Super Admin may filter across hospitals
  // (or see all of them by omitting the filter).
  const hospitalId = actor.roleCode === "SUPER_ADMIN" ? requestedHospitalId : actor.hospitalId ?? undefined;

  return prisma.invitation.findMany({
    where: hospitalId ? { hospitalId } : undefined,
    select: {
      id: true,
      email: true,
      status: true,
      expiresAt: true,
      acceptedAt: true,
      createdAt: true,
      hospitalId: true,
      departmentId: true,
      role: { select: { code: true, name: true } },
      invitedBy: { select: { firstName: true, lastName: true } },
      // tokenHash intentionally excluded — it must never leave the server,
      // even hashed, since it's the credential that grants account creation.
    },
    orderBy: { createdAt: "desc" },
  });
}