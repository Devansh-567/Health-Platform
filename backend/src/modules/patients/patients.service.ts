import { prisma } from "../../config/prisma";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { hashPassword } from "../../utils/hash";
import { generateTempPassword } from "../../utils/token";
import { normalizeEmail } from "../../utils/normalizeEmail";
import { mailer } from "../../utils/mailer";
import { writeAudit } from "../../utils/audit";
import { revokeAllUserSessions } from "../auth/token.service";

const PATIENT_ROLE_CODE = "PATIENT";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

export interface CreatePatientInput {
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  hospitalId?: string;
  departmentId?: string;
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
}

/**
 * Same hospital-scoping rule used by invitations.service#createInvitation:
 * an Admin can only ever act within their own hospital — whatever
 * hospitalId the client sends is ignored/overridden. Only Super Admin may
 * target an arbitrary hospital (or leave it unassigned).
 */
function resolveScopedHospitalId(actor: Actor, requestedHospitalId?: string): string | undefined {
  if (actor.roleCode === "SUPER_ADMIN") return requestedHospitalId;

  if (!actor.hospitalId) {
    throw ApiError.badRequest(
      "Your account isn't linked to a hospital yet — contact a super admin before adding patients.",
      "NO_HOSPITAL_ASSIGNED"
    );
  }
  return actor.hospitalId;
}

function tempPasswordExpiry(): Date {
  return new Date(Date.now() + env.PATIENT_TEMP_PASSWORD_TTL_HOURS * 60 * 60 * 1000);
}

/**
 * Admin/Super Admin creates a patient account directly (no public signup,
 * no self-service "accept invite" step). A temporary password is generated
 * server-side, emailed once, and never returned in the API response. The
 * account is ACTIVE immediately but mustChangePassword forces a password
 * change on first login, and tempPasswordExpiresAt bounds how long that
 * temporary credential can be used at all.
 */
export async function createPatient(actor: Actor, input: CreatePatientInput) {
  const hospitalId = resolveScopedHospitalId(actor, input.hospitalId);
  const email = normalizeEmail(input.email);

  const [role, existingUser] = await Promise.all([
    prisma.role.findUnique({ where: { code: PATIENT_ROLE_CODE } }),
    prisma.user.findUnique({ where: { email } }),
  ]);

  if (!role) throw ApiError.internal("Patient role is not configured");
  if (existingUser) throw ApiError.conflict("A user with this email already exists");

  // A department must belong to the hospital the account is scoped to —
  // otherwise an Admin could smuggle in a department from another hospital.
  if (input.departmentId) {
    const department = await prisma.department.findUnique({ where: { id: input.departmentId } });
    if (!department || department.hospitalId !== hospitalId) {
      throw ApiError.badRequest("Department does not belong to the target hospital");
    }
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = tempPasswordExpiry();

  const user = await prisma.user.create({
    data: {
      email,
      firstName: input.firstName,
      lastName: input.lastName,
      phone: input.phone,
      passwordHash,
      roleId: role.id,
      hospitalId,
      departmentId: input.departmentId,
      status: "ACTIVE",
      isEmailVerified: true,
      mustChangePassword: true,
      tempPasswordExpiresAt: expiresAt,
      createdById: actor.id,
      patientProfile: {
        create: {
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
          gender: input.gender,
          bloodGroup: input.bloodGroup,
        },
      },
    },
  });

  const loginUrl = `${env.CLIENT_URL}/login`;
  await mailer.sendPatientTempPasswordEmail(email, temporaryPassword, loginUrl, expiresAt);
  await writeAudit({
    userId: actor.id,
    action: "PATIENT.CREATED",
    entityType: "User",
    entityId: user.id,
    metadata: { hospitalId },
  });

  return { id: user.id, email: user.email, tempPasswordExpiresAt: expiresAt };
}

async function loadScopedPatient(actor: Actor, userId: string) {
  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
    include: { role: true },
  });

  if (!user || user.role.code !== PATIENT_ROLE_CODE) throw ApiError.notFound("Patient not found");

  if (actor.roleCode !== "SUPER_ADMIN" && user.hospitalId !== actor.hospitalId) {
    throw ApiError.forbidden("You can only manage patients in your own hospital");
  }

  return user;
}

/**
 * Regenerates and re-sends a patient's temporary password — for a lost
 * email, a typo'd inbox, or a temp password that expired before the
 * patient signed in. Any active session is revoked so the old password
 * (even if never expired) stops working immediately.
 */
export async function resendPatientCredentials(actor: Actor, userId: string) {
  const user = await loadScopedPatient(actor, userId);

  if (user.status === "DEACTIVATED") {
    throw ApiError.badRequest("Cannot resend credentials to a deactivated account");
  }

  const temporaryPassword = generateTempPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const expiresAt = tempPasswordExpiry();

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      mustChangePassword: true,
      tempPasswordExpiresAt: expiresAt,
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await revokeAllUserSessions(user.id);

  const loginUrl = `${env.CLIENT_URL}/login`;
  await mailer.sendPatientTempPasswordEmail(user.email, temporaryPassword, loginUrl, expiresAt);
  await writeAudit({ userId: actor.id, action: "PATIENT.CREDENTIALS_RESENT", entityType: "User", entityId: user.id });

  return { id: user.id, email: user.email, tempPasswordExpiresAt: expiresAt };
}
