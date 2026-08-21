import { prisma } from "../../config/prisma";
import { ApiError } from "../../utils/ApiError";
import { writeAudit } from "../../utils/audit";
import { deleteReportFile } from "../../config/storage";

export interface Actor {
  id: string;
  roleCode: string;
  hospitalId: string | null;
}

/**
 * ACCESS MODEL for clinical records:
 * - DOCTOR / NURSE: may only read or write records for a patient they
 *   currently hold an ACTIVE assignment for (DoctorPatientMap /
 *   NursePatientMap) — mirrors the assignments module exactly. Once
 *   assigned, they see that patient's FULL clinical history (continuity of
 *   care), not just records from their own hospital, since a patient may
 *   legitimately have been treated elsewhere before (see PatientProfile
 *   comment in schema.prisma — patients are not hospital-scoped).
 * - ADMIN: has no assignment concept; their authority is hospital-bounded
 *   everywhere else in this app, so list queries are filtered to
 *   hospitalId = actor.hospitalId. Admins cannot create clinical records.
 * - SUPER_ADMIN: unrestricted, consistent with the rest of the system.
 * This is a deliberate design choice, not an oversight — flagged clearly
 * here because it's the kind of boundary worth revisiting against real
 * clinical/compliance requirements later.
 */

async function resolveDoctorProfile(actorId: string) {
  const profile = await prisma.doctorProfile.findUnique({ where: { userId: actorId } });
  if (!profile) throw ApiError.internal("Doctor profile is missing for this account");
  return profile;
}

async function resolveNurseProfile(actorId: string) {
  const profile = await prisma.nurseProfile.findUnique({ where: { userId: actorId } });
  if (!profile) throw ApiError.internal("Nurse profile is missing for this account");
  return profile;
}

async function resolvePatientProfile(patientUserId: string) {
  const patient = await prisma.user.findFirst({
    where: { id: patientUserId, deletedAt: null },
    include: { role: true, patientProfile: true },
  });
  if (!patient || patient.role.code !== "PATIENT" || !patient.patientProfile) {
    throw ApiError.notFound("Patient not found");
  }
  return patient.patientProfile;
}

/** Throws unless the actor is currently allowed to touch this patient's records. */
async function assertAccess(actor: Actor, patientProfileId: string) {
  if (actor.roleCode === "SUPER_ADMIN" || actor.roleCode === "ADMIN") return;

  if (actor.roleCode === "DOCTOR") {
    const profile = await resolveDoctorProfile(actor.id);
    const link = await prisma.doctorPatientMap.findUnique({
      where: { doctorId_patientId: { doctorId: profile.id, patientId: patientProfileId } },
    });
    if (!link?.isActive) throw ApiError.forbidden("This patient is not currently assigned to you");
    return;
  }

  if (actor.roleCode === "NURSE") {
    const profile = await resolveNurseProfile(actor.id);
    const link = await prisma.nursePatientMap.findUnique({
      where: { nurseId_patientId: { nurseId: profile.id, patientId: patientProfileId } },
    });
    if (!link?.isActive) throw ApiError.forbidden("This patient is not currently assigned to you");
    return;
  }

  throw ApiError.forbidden();
}

/**
 * Admin is normally hospital-bounded (see assertAccess above); everyone else
 * who passed assertAccess sees the patient's full history regardless of
 * hospital. The one exception: an interhospital transfer that has been
 * ACCEPTED and touches the Admin's own hospital (as either the sending or
 * the receiving side — see transfers.service.ts) lifts that bound for this
 * one patient, exactly the way an assignment does for a doctor/nurse. This
 * is what makes "admin1 grants admin2 access" real: once accepted, both
 * hospitals involved in the handoff see the patient's complete record set,
 * not just whatever each of them personally created.
 */
async function hospitalFilterFor(actor: Actor, patientProfileId: string) {
  if (actor.roleCode !== "ADMIN" || !actor.hospitalId) return {};

  const transferGrant = await prisma.patientTransfer.findFirst({
    where: {
      patientId: patientProfileId,
      status: "ACCEPTED",
      OR: [{ fromHospitalId: actor.hospitalId }, { toHospitalId: actor.hospitalId }],
    },
    select: { id: true },
  });
  if (transferGrant) return {};

  return { hospitalId: actor.hospitalId };
}

// ---------------------------------------------------------------------------
// MY PATIENTS (doctor/nurse own assigned-patient list) + PATIENT SUMMARY
// ---------------------------------------------------------------------------

// Mirrors assignments.service.ts's assignedPatientSelect exactly, so the
// frontend can reuse the same AssignedPatient shape for both "Manage
// patients" (admin) and "My Patients" (doctor/nurse self-service) lists.
const assignedPatientSelect = {
  id: true,
  assignedAt: true,
  patient: {
    select: {
      id: true,
      medicalRecordNo: true,
      bloodGroup: true,
      user: { select: { id: true, firstName: true, lastName: true, email: true, status: true } },
    },
  },
} as const;

/**
 * A doctor/nurse's own actively-assigned patients — the entry point into the
 * clinical chart for staff who don't hold patient.assign (i.e. everyone
 * except Admin/Super Admin, who instead reach patients via "Manage
 * patients"). Gated by patient.view.assigned, which only DOCTOR and NURSE
 * hold, so no client-supplied staffUserId is ever needed here.
 */
export async function listMyPatients(actor: Actor) {
  if (actor.roleCode === "DOCTOR") {
    const profile = await resolveDoctorProfile(actor.id);
    return prisma.doctorPatientMap.findMany({
      where: { doctorId: profile.id, isActive: true },
      select: assignedPatientSelect,
      orderBy: { assignedAt: "desc" },
    });
  }

  if (actor.roleCode === "NURSE") {
    const profile = await resolveNurseProfile(actor.id);
    return prisma.nursePatientMap.findMany({
      where: { nurseId: profile.id, isActive: true },
      select: assignedPatientSelect,
      orderBy: { assignedAt: "desc" },
    });
  }

  throw ApiError.forbidden();
}

/**
 * Lightweight patient identity lookup for the chart page header. Deliberately
 * separate from the list endpoints above so the chart page works on a direct
 * link or a hard refresh, not only when navigated to from a list that already
 * had the patient's name in memory. Uses the exact same assertAccess() gate
 * as every other record in this file, so it never leaks more than the
 * assignment/hospital rules already allow.
 */
export async function getPatientSummary(actor: Actor, patientUserId: string) {
  const patient = await prisma.user.findFirst({
    where: { id: patientUserId, deletedAt: null },
    include: { role: true, patientProfile: true },
  });
  if (!patient || patient.role.code !== "PATIENT" || !patient.patientProfile) {
    throw ApiError.notFound("Patient not found");
  }

  await assertAccess(actor, patient.patientProfile.id);

  return {
    id: patient.id,
    firstName: patient.firstName,
    lastName: patient.lastName,
    email: patient.email,
    status: patient.status,
    patientProfile: {
      id: patient.patientProfile.id,
      medicalRecordNo: patient.patientProfile.medicalRecordNo,
      bloodGroup: patient.patientProfile.bloodGroup,
      dateOfBirth: patient.patientProfile.dateOfBirth,
      gender: patient.patientProfile.gender,
    },
  };
}

// ---------------------------------------------------------------------------
// DIAGNOSES
// ---------------------------------------------------------------------------

export async function createDiagnosis(
  actor: Actor,
  patientUserId: string,
  input: { condition: string; description?: string; appointmentId?: string }
) {
  const doctorProfile = await resolveDoctorProfile(actor.id);
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital — contact a super admin.", "NO_HOSPITAL_ASSIGNED");
  }

  if (input.appointmentId) {
    const appointment = await prisma.appointment.findUnique({ where: { id: input.appointmentId } });
    if (!appointment || appointment.doctorId !== doctorProfile.id || appointment.patientId !== patientProfile.id) {
      throw ApiError.badRequest("Appointment does not belong to you and this patient");
    }
  }

  const diagnosis = await prisma.diagnosis.create({
    data: {
      hospitalId: actor.hospitalId,
      patientId: patientProfile.id,
      doctorId: doctorProfile.id,
      appointmentId: input.appointmentId,
      condition: input.condition,
      description: input.description,
    },
  });

  await writeAudit({
    userId: actor.id,
    action: "DIAGNOSIS.CREATED",
    entityType: "Diagnosis",
    entityId: diagnosis.id,
    metadata: { patientUserId },
  });

  return diagnosis;
}

export async function listDiagnoses(actor: Actor, patientUserId: string) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  return prisma.diagnosis.findMany({
    where: { patientId: patientProfile.id, ...(await hospitalFilterFor(actor, patientProfile.id)) },
    include: { doctor: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { diagnosedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// PRESCRIPTIONS
// ---------------------------------------------------------------------------

export async function createPrescription(
  actor: Actor,
  patientUserId: string,
  input: {
    diagnosisId?: string;
    appointmentId?: string;
    notes?: string;
    items: { medicineName: string; dosage: string; frequency: string; durationDays?: number; instructions?: string }[];
  }
) {
  const doctorProfile = await resolveDoctorProfile(actor.id);
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital — contact a super admin.", "NO_HOSPITAL_ASSIGNED");
  }

  if (input.diagnosisId) {
    const diagnosis = await prisma.diagnosis.findUnique({ where: { id: input.diagnosisId } });
    if (!diagnosis || diagnosis.patientId !== patientProfile.id || diagnosis.doctorId !== doctorProfile.id) {
      throw ApiError.badRequest("Diagnosis does not belong to you and this patient");
    }
  }
  if (input.appointmentId) {
    const appointment = await prisma.appointment.findUnique({ where: { id: input.appointmentId } });
    if (!appointment || appointment.doctorId !== doctorProfile.id || appointment.patientId !== patientProfile.id) {
      throw ApiError.badRequest("Appointment does not belong to you and this patient");
    }
  }

  const prescription = await prisma.prescription.create({
    data: {
      hospitalId: actor.hospitalId,
      patientId: patientProfile.id,
      doctorId: doctorProfile.id,
      diagnosisId: input.diagnosisId,
      appointmentId: input.appointmentId,
      notes: input.notes,
      items: { createMany: { data: input.items } },
    },
    include: { items: true },
  });

  await writeAudit({
    userId: actor.id,
    action: "PRESCRIPTION.CREATED",
    entityType: "Prescription",
    entityId: prescription.id,
    metadata: { patientUserId, itemCount: input.items.length },
  });

  return prescription;
}

export async function updatePrescriptionStatus(actor: Actor, prescriptionId: string, status: "ACTIVE" | "COMPLETED" | "CANCELLED") {
  const prescription = await prisma.prescription.findUnique({ where: { id: prescriptionId } });
  if (!prescription) throw ApiError.notFound("Prescription not found");

  if (actor.roleCode !== "SUPER_ADMIN") {
    const doctorProfile = await resolveDoctorProfile(actor.id);
    if (prescription.doctorId !== doctorProfile.id) {
      throw ApiError.forbidden("Only the prescribing doctor can update this prescription");
    }
  }

  const updated = await prisma.prescription.update({ where: { id: prescriptionId }, data: { status } });

  await writeAudit({
    userId: actor.id,
    action: "PRESCRIPTION.STATUS_UPDATED",
    entityType: "Prescription",
    entityId: prescriptionId,
    metadata: { status },
  });

  return updated;
}

export async function listPrescriptions(actor: Actor, patientUserId: string) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  return prisma.prescription.findMany({
    where: { patientId: patientProfile.id, ...(await hospitalFilterFor(actor, patientProfile.id)) },
    include: {
      items: true,
      doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// VITALS
// ---------------------------------------------------------------------------

export async function recordVitals(
  actor: Actor,
  patientUserId: string,
  input: {
    bloodPressureSystolic?: number;
    bloodPressureDiastolic?: number;
    heartRate?: number;
    temperatureCelsius?: number;
    respiratoryRate?: number;
    oxygenSaturation?: number;
    weightKg?: number;
    heightCm?: number;
    notes?: string;
  }
) {
  // Either a doctor or a nurse may record vitals — resolveDoctorProfile/
  // resolveNurseProfile both throw if the role doesn't match, so only call
  // the one matching the actor's actual role.
  if (actor.roleCode !== "DOCTOR" && actor.roleCode !== "NURSE") {
    throw ApiError.forbidden("Only doctors and nurses can record vitals");
  }

  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital — contact a super admin.", "NO_HOSPITAL_ASSIGNED");
  }

  const vitals = await prisma.vitalSign.create({
    data: { hospitalId: actor.hospitalId, patientId: patientProfile.id, recordedById: actor.id, ...input },
  });

  await writeAudit({
    userId: actor.id,
    action: "VITALS.RECORDED",
    entityType: "VitalSign",
    entityId: vitals.id,
    metadata: { patientUserId },
  });

  return vitals;
}

export async function listVitals(actor: Actor, patientUserId: string) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  return prisma.vitalSign.findMany({
    where: { patientId: patientProfile.id, ...(await hospitalFilterFor(actor, patientProfile.id)) },
    include: { recordedBy: { select: { firstName: true, lastName: true, roleId: true } } },
    orderBy: { recordedAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// CLINICAL NOTES (doctor + nursing notes, unified — never patient-visible;
// see clinical.routes.ts, there is deliberately no patient "me" endpoint
// for notes, matching typical EHR patient-portal behavior)
// ---------------------------------------------------------------------------

export async function createNote(actor: Actor, patientUserId: string, content: string) {
  const noteType = actor.roleCode === "DOCTOR" ? "DOCTOR_NOTE" : actor.roleCode === "NURSE" ? "NURSING_NOTE" : null;
  if (!noteType) throw ApiError.forbidden("Only doctors and nurses can add clinical notes");

  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital — contact a super admin.", "NO_HOSPITAL_ASSIGNED");
  }

  const note = await prisma.clinicalNote.create({
    data: { hospitalId: actor.hospitalId, patientId: patientProfile.id, authorId: actor.id, type: noteType, content },
  });

  await writeAudit({
    userId: actor.id,
    action: "CLINICAL_NOTE.CREATED",
    entityType: "ClinicalNote",
    entityId: note.id,
    metadata: { patientUserId, type: noteType },
  });

  return note;
}

export async function listNotes(actor: Actor, patientUserId: string) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  return prisma.clinicalNote.findMany({
    where: { patientId: patientProfile.id, ...(await hospitalFilterFor(actor, patientProfile.id)) },
    include: { author: { select: { firstName: true, lastName: true } } },
    orderBy: { createdAt: "desc" },
  });
}

// ---------------------------------------------------------------------------
// PATIENT SELF-SERVICE ("me" endpoints)
// ---------------------------------------------------------------------------

async function resolveOwnPatientProfile(actorId: string) {
  const profile = await prisma.patientProfile.findUnique({ where: { userId: actorId } });
  if (!profile) throw ApiError.badRequest("This account has no patient profile");
  return profile;
}

export async function listMyDiagnoses(actorId: string) {
  const profile = await resolveOwnPatientProfile(actorId);
  return prisma.diagnosis.findMany({
    where: { patientId: profile.id },
    include: { doctor: { include: { user: { select: { firstName: true, lastName: true } } } } },
    orderBy: { diagnosedAt: "desc" },
  });
}

export async function listMyPrescriptions(actorId: string) {
  const profile = await resolveOwnPatientProfile(actorId);
  return prisma.prescription.findMany({
    where: { patientId: profile.id },
    include: {
      items: true,
      doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listMyReports(actorId: string) {
  const profile = await resolveOwnPatientProfile(actorId);
  return prisma.report.findMany({
    where: { patientId: profile.id },
    include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { uploadedAt: "desc" },
  });
}

/** Patient downloading their OWN report — deliberately separate from
 * resolveReportForDownload below, which goes through assertAccess (and
 * assertAccess has no PATIENT branch: a patient has no doctor/nurse
 * assignment to check and isn't ADMIN/SUPER_ADMIN, so it would always
 * reject). This resolves the caller's own patient profile directly instead,
 * the same way listMyReports/listMyDiagnoses/listMyPrescriptions do. */
export async function resolveMyReportForDownload(actorId: string, reportId: string) {
  const profile = await resolveOwnPatientProfile(actorId);
  const report = await prisma.report.findFirst({ where: { id: reportId, patientId: profile.id } });
  if (!report) throw ApiError.notFound("Report not found");
  return report;
}

// ---------------------------------------------------------------------------
// REPORTS (uploaded files)
// ---------------------------------------------------------------------------

export async function uploadReport(
  actor: Actor,
  patientUserId: string,
  file: { filename: string; originalname: string; mimetype: string; size: number },
  title: string
) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  if (!actor.hospitalId) {
    throw ApiError.badRequest("Your account isn't linked to a hospital — contact a super admin.", "NO_HOSPITAL_ASSIGNED");
  }

  const report = await prisma.report.create({
    data: {
      hospitalId: actor.hospitalId,
      patientId: patientProfile.id,
      uploadedById: actor.id,
      title,
      originalName: file.originalname,
      storagePath: file.filename,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
    },
  });

  await writeAudit({
    userId: actor.id,
    action: "REPORT.UPLOADED",
    entityType: "Report",
    entityId: report.id,
    metadata: { patientUserId, originalName: file.originalname },
  });

  return report;
}

export async function listReports(actor: Actor, patientUserId: string) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  return prisma.report.findMany({
    where: { patientId: patientProfile.id, ...(await hospitalFilterFor(actor, patientProfile.id)) },
    include: { uploadedBy: { select: { firstName: true, lastName: true } } },
    orderBy: { uploadedAt: "desc" },
  });
}

/** Resolves a report for download, re-checking access from scratch — never
 * trust that a client holding a report id was the one it was listed for. */
export async function resolveReportForDownload(actor: Actor, patientUserId: string, reportId: string) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  await assertAccess(actor, patientProfile.id);

  const report = await prisma.report.findFirst({ where: { id: reportId, patientId: patientProfile.id } });
  if (!report) throw ApiError.notFound("Report not found");
  return report;
}

export async function deleteReport(actor: Actor, patientUserId: string, reportId: string) {
  const patientProfile = await resolvePatientProfile(patientUserId);
  const report = await prisma.report.findFirst({ where: { id: reportId, patientId: patientProfile.id } });
  if (!report) throw ApiError.notFound("Report not found");

  if (actor.roleCode !== "SUPER_ADMIN" && report.uploadedById !== actor.id) {
    throw ApiError.forbidden("Only the uploader or a super admin can delete this report");
  }

  await prisma.report.delete({ where: { id: reportId } });
  deleteReportFile(report.storagePath);

  await writeAudit({ userId: actor.id, action: "REPORT.DELETED", entityType: "Report", entityId: reportId, metadata: { patientUserId } });
}