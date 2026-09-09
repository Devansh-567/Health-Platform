// Mirrors backend/src/config/permissions.catalog.ts. The UI only ever uses
// these to decide what to SHOW — the server is the enforcement boundary.
export const PERMISSIONS = {
  ROLE_MANAGE: "role.manage",
  AUDIT_LOG_VIEW: "audit.view",

  USER_CREATE_ADMIN: "user.create.admin",
  USER_CREATE_STAFF: "user.create.staff",
  USER_VIEW: "user.view",
  USER_STATUS_UPDATE: "user.status.update",

  HOSPITAL_VIEW: "hospital.view",
  HOSPITAL_MANAGE: "hospital.manage",
  DEPARTMENT_MANAGE: "department.manage",

  PATIENT_ASSIGN: "patient.assign",
  PATIENT_VIEW_ASSIGNED: "patient.view.assigned",
  PATIENT_MANAGE: "patient.manage",
  PATIENT_TRANSFER_MANAGE: "patient.transfer.manage",

  APPOINTMENT_BOOK: "appointment.book",
  APPOINTMENT_MANAGE_OWN: "appointment.manage.own",
  APPOINTMENT_MANAGE_ANY: "appointment.manage.any",

  DIAGNOSIS_CREATE: "diagnosis.create",
  DIAGNOSIS_VIEW: "diagnosis.view",
  PRESCRIPTION_CREATE: "prescription.create",
  PRESCRIPTION_VIEW: "prescription.view",
  MEDICAL_NOTE_CREATE: "medical_note.create",
  NURSING_NOTE_CREATE: "nursing_note.create",
  CLINICAL_NOTE_VIEW: "clinical_note.view",
  VITALS_RECORD: "vitals.record",
  VITALS_VIEW: "vitals.view",
  MEDICAL_HISTORY_VIEW_OWN: "medical_history.view.own",
  PROFILE_MANAGE_OWN: "profile.manage.own",
  REPORT_UPLOAD: "report.upload",
  REPORT_VIEW: "report.view",

  AMBULANCE_MANAGE: "ambulance.manage",
  AMBULANCE_TRIP_MANAGE: "ambulance_trip.manage",
  AMBULANCE_TRIP_VIEW: "ambulance_trip.view",
  AMBULANCE_TRIP_DRIVE: "ambulance_trip.drive",

  EMERGENCY_CASE_MANAGE: "emergency_case.manage",
  EMERGENCY_CASE_TRIAGE: "emergency_case.triage",
  EMERGENCY_CASE_VIEW: "emergency_case.view",
} as const;