import { Router } from "express";
import * as controller from "./clinical.controller";
import { authenticate } from "../../middlewares/authenticate";
import { requirePermission } from "../../middlewares/rbac";
import { validate } from "../../middlewares/validate";
import { PERMISSIONS } from "../../config/permissions.catalog";
import { reportUpload } from "../../config/storage";
import {
  createDiagnosisSchema,
  createPrescriptionSchema,
  updatePrescriptionStatusSchema,
  recordVitalsSchema,
  createNoteSchema,
  patientParamSchema,
  reportParamSchema,
  myReportParamSchema,
  uploadReportSchema,
} from "./clinical.validation";

const router = Router();
router.use(authenticate);

// --- Patient self-service (own records only) ---
// No "me/notes" route: clinical notes are provider-facing working notes,
// not exposed to the patient portal — matches typical EHR behavior.
router.get("/me/diagnoses", requirePermission(PERMISSIONS.MEDICAL_HISTORY_VIEW_OWN), controller.listMyDiagnoses);
router.get("/me/prescriptions", requirePermission(PERMISSIONS.PRESCRIPTION_VIEW), controller.listMyPrescriptions);
router.get("/me/reports", requirePermission(PERMISSIONS.REPORT_VIEW), controller.listMyReports);
router.get(
  "/me/reports/:reportId/download",
  requirePermission(PERMISSIONS.REPORT_VIEW),
  validate(myReportParamSchema),
  controller.downloadMyReport
);

// --- Doctor/Nurse own patient list (entry point into the chart below) ---
router.get("/me/patients", requirePermission(PERMISSIONS.PATIENT_VIEW_ASSIGNED), controller.listMyPatients);

// --- Patient identity summary (chart header; same access rules as the
//     records below, so any tab's permission is enough to load it) ---
router.get(
  "/patients/:patientUserId",
  requirePermission(
    PERMISSIONS.DIAGNOSIS_VIEW,
    PERMISSIONS.PRESCRIPTION_VIEW,
    PERMISSIONS.VITALS_VIEW,
    PERMISSIONS.CLINICAL_NOTE_VIEW
  ),
  validate(patientParamSchema),
  controller.getPatientSummary
);

// --- Diagnoses ---
router.get(
  "/patients/:patientUserId/diagnoses",
  requirePermission(PERMISSIONS.DIAGNOSIS_VIEW),
  validate(patientParamSchema),
  controller.listDiagnoses
);
router.post(
  "/patients/:patientUserId/diagnoses",
  requirePermission(PERMISSIONS.DIAGNOSIS_CREATE),
  validate(createDiagnosisSchema),
  controller.createDiagnosis
);

// --- Prescriptions ---
router.get(
  "/patients/:patientUserId/prescriptions",
  requirePermission(PERMISSIONS.PRESCRIPTION_VIEW),
  validate(patientParamSchema),
  controller.listPrescriptions
);
router.post(
  "/patients/:patientUserId/prescriptions",
  requirePermission(PERMISSIONS.PRESCRIPTION_CREATE),
  validate(createPrescriptionSchema),
  controller.createPrescription
);
router.patch(
  "/prescriptions/:prescriptionId/status",
  requirePermission(PERMISSIONS.PRESCRIPTION_CREATE),
  validate(updatePrescriptionStatusSchema),
  controller.updatePrescriptionStatus
);

// --- Vitals ---
router.get(
  "/patients/:patientUserId/vitals",
  requirePermission(PERMISSIONS.VITALS_VIEW),
  validate(patientParamSchema),
  controller.listVitals
);
router.post(
  "/patients/:patientUserId/vitals",
  requirePermission(PERMISSIONS.VITALS_RECORD),
  validate(recordVitalsSchema),
  controller.recordVitals
);

// --- Clinical notes (doctor + nursing, unified) ---
router.get(
  "/patients/:patientUserId/notes",
  requirePermission(PERMISSIONS.CLINICAL_NOTE_VIEW),
  validate(patientParamSchema),
  controller.listNotes
);
router.post(
  "/patients/:patientUserId/notes",
  requirePermission(PERMISSIONS.MEDICAL_NOTE_CREATE, PERMISSIONS.NURSING_NOTE_CREATE),
  validate(createNoteSchema),
  controller.createNote
);

// --- Reports (uploaded files) ---
router.get(
  "/patients/:patientUserId/reports",
  requirePermission(PERMISSIONS.REPORT_VIEW),
  validate(patientParamSchema),
  controller.listReports
);
router.post(
  "/patients/:patientUserId/reports",
  requirePermission(PERMISSIONS.REPORT_UPLOAD),
  reportUpload.single("file"), // must run before validate() — multer populates req.body from the multipart form
  validate(uploadReportSchema),
  controller.uploadReport
);
router.get(
  "/patients/:patientUserId/reports/:reportId/download",
  requirePermission(PERMISSIONS.REPORT_VIEW),
  validate(reportParamSchema),
  controller.downloadReport
);
router.delete(
  "/patients/:patientUserId/reports/:reportId",
  requirePermission(PERMISSIONS.REPORT_UPLOAD),
  validate(reportParamSchema),
  controller.deleteReport
);

export default router;