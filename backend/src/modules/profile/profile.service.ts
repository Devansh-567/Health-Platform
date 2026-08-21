import { Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

export interface UpdateMyProfileInput {
  dateOfBirth?: string;
  gender?: string;
  bloodGroup?: string;
  medicalRecordNo?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
}

// Only PATIENT accounts have self-service demographic fields today — see
// the comment on the PatientProfileCard in frontend/src/pages/AccountSettings.tsx.
// Doctor/Nurse/Admin/SuperAdmin identity fields (name, email, license number,
// etc.) are managed elsewhere (staff onboarding, account settings' password
// section) and are intentionally not exposed here.
const PATIENT_EDITABLE_FIELDS = [
  "dateOfBirth",
  "gender",
  "bloodGroup",
  "medicalRecordNo",
  "address",
  "emergencyContact",
  "emergencyPhone",
] as const;

export async function getMyProfile(actor: Actor) {
  if (actor.roleCode !== "PATIENT") {
    return { roleCode: actor.roleCode, editableFields: [] as string[], profile: null };
  }

  const profile = await prisma.patientProfile.findUnique({ where: { userId: actor.id } });
  return { roleCode: actor.roleCode, editableFields: [...PATIENT_EDITABLE_FIELDS], profile };
}

export async function updateMyProfile(actor: Actor, input: UpdateMyProfileInput) {
  // Defensive check even though the route already gates on PROFILE_MANAGE_OWN
  // and only PATIENT has a demographic profile to update — mirrors the
  // "never trust a single layer" posture used elsewhere in this app.
  if (actor.roleCode !== "PATIENT") {
    throw ApiError.forbidden("Only patient accounts manage a demographic profile here");
  }

  const data: Prisma.PatientProfileUpdateInput = {};
  if (input.dateOfBirth !== undefined) data.dateOfBirth = new Date(input.dateOfBirth);
  if (input.gender !== undefined) data.gender = input.gender;
  if (input.bloodGroup !== undefined) data.bloodGroup = input.bloodGroup;
  if (input.medicalRecordNo !== undefined) data.medicalRecordNo = input.medicalRecordNo;
  if (input.address !== undefined) data.address = input.address;
  if (input.emergencyContact !== undefined) data.emergencyContact = input.emergencyContact;
  if (input.emergencyPhone !== undefined) data.emergencyPhone = input.emergencyPhone;

  try {
    const updated = await prisma.patientProfile.update({ where: { userId: actor.id }, data });

    await writeAudit({
      userId: actor.id,
      action: "PROFILE.UPDATE_OWN",
      entityType: "PatientProfile",
      entityId: updated.id,
      metadata: { fields: Object.keys(data) },
    });

    return updated;
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") throw ApiError.notFound("Patient profile not found for this account");
      if (err.code === "P2002") throw ApiError.conflict("That medical record number is already in use");
    }
    throw err;
  }
}
