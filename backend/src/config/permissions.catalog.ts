/**
 * Canonical list of permission codes. This file is the single reference used by:
 *  1. route guards (requirePermission(...)) to name the permission they need
 *  2. the seed script, to populate the `permissions` table and default role mappings
 * The actual authorization decision is always made from the DATABASE
 * (role_permissions / user_permissions), never from this list directly —
 * an admin can revoke or add permissions at runtime without a code deploy.
 */
export const PERMISSIONS = {
  // System / RBAC administration
  SYSTEM_SETTINGS_MANAGE: "system.settings.manage",
  ROLE_MANAGE: "role.manage",
  PERMISSION_MANAGE: "permission.manage",
  AUDIT_LOG_VIEW: "audit.view",

  // User management
  USER_CREATE_ADMIN: "user.create.admin",
  USER_CREATE_STAFF: "user.create.staff", // via invitation (doctor/nurse)
  USER_VIEW: "user.view",
  USER_STATUS_UPDATE: "user.status.update",
  USER_PERMISSION_OVERRIDE: "user.permission.override",
  USER_DELETE: "user.delete",

  // Hospital / department
  HOSPITAL_VIEW: "hospital.view", // read-only: list/inspect hospitals
  HOSPITAL_MANAGE: "hospital.manage", // create hospitals, edit details, activate/deactivate
  DEPARTMENT_MANAGE: "department.manage",

  // Patient care
  PATIENT_VIEW_ALL: "patient.view.all",
  PATIENT_VIEW_ASSIGNED: "patient.view.assigned",
  PATIENT_VIEW_OWN: "patient.view.own",
  PATIENT_MANAGE: "patient.manage",
  PATIENT_ASSIGN: "patient.assign", // assign/unassign patients to doctors & nurses
  PATIENT_TRANSFER_MANAGE: "patient.transfer.manage", // request/accept/reject/cancel interhospital transfers

  DIAGNOSIS_CREATE: "diagnosis.create",
  DIAGNOSIS_VIEW: "diagnosis.view",
  PRESCRIPTION_CREATE: "prescription.create",
  PRESCRIPTION_VIEW: "prescription.view",
  MEDICAL_NOTE_CREATE: "medical_note.create",
  NURSING_NOTE_CREATE: "nursing_note.create",
  CLINICAL_NOTE_VIEW: "clinical_note.view",
  VITALS_RECORD: "vitals.record",
  VITALS_VIEW: "vitals.view",
  REPORT_UPLOAD: "report.upload",
  REPORT_VIEW: "report.view",

  APPOINTMENT_MANAGE_ANY: "appointment.manage.any",
  APPOINTMENT_MANAGE_OWN: "appointment.manage.own",
  APPOINTMENT_BOOK: "appointment.book",

  MEDICAL_HISTORY_VIEW_OWN: "medical_history.view.own",
  PROFILE_MANAGE_OWN: "profile.manage.own",

  // Ambulance dispatch & live GPS tracking
  AMBULANCE_MANAGE: "ambulance.manage", // manage a hospital's ambulance fleet (add/edit vehicles)
  AMBULANCE_TRIP_MANAGE: "ambulance_trip.manage", // dispatch/cancel a trip for an accepted transfer
  AMBULANCE_TRIP_VIEW: "ambulance_trip.view", // view trip status, route & live position
  AMBULANCE_TRIP_DRIVE: "ambulance_trip.drive", // driver: update own trip status + push GPS location

  // Emergency response / live PPG monitoring (field pickup, not tied to a
  // scheduled interhospital transfer)
  EMERGENCY_CASE_MANAGE: "emergency_case.manage", // paramedic: start case, pick hospital, push vitals
  EMERGENCY_CASE_TRIAGE: "emergency_case.triage", // hospital admin: acknowledge alarm, assign doctor
  EMERGENCY_CASE_VIEW: "emergency_case.view", // read access incl. live vitals stream
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];