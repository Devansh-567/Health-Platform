import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { clinicalApi, PatientSummary } from "../../api/clinical.api";
import { useAuth } from "../../context/AuthContext";
import { PERMISSIONS } from "../../constants/permissions";
import { StatusBadge } from "../../components/UiPrimitives";
import { Alert } from "../../components/FormControls";
import DiagnosesTab from "./tabs/DiagnosesTab";
import PrescriptionsTab from "./tabs/PrescriptionsTab";
import VitalsTab from "./tabs/VitalsTab";
import NotesTab from "./tabs/NotesTab";
import ReportsTab from "./tabs/ReportsTab";

type TabKey = "diagnoses" | "prescriptions" | "vitals" | "notes" | "reports";

// Single chart component shared by Doctor, Nurse, Admin, and Super Admin —
// per architecture decision #1 (never hardcode role-name checks), which
// tabs are visible is resolved entirely from the actor's permission list,
// the same list the backend already enforces against. Per the current seed:
// Doctor and Nurse both hold every *.view permission below (so both see all
// five tabs — the difference is which *_CREATE permissions gate the "+"
// buttons inside each tab, e.g. only Doctor can create a diagnosis, only
// Nurse can record vitals); Admin holds only prescription.view + report.view
// (their clinical authority is intentionally narrow — see clinical.service.ts's
// assertAccess for the full reasoning); Patients never reach this route at
// all (see App.tsx: RoleRoute excludes PATIENT here, they use /my-records
// instead).
export default function PatientChartPage() {
  const { patientUserId = "" } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [patient, setPatient] = useState<PatientSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    clinicalApi
      .getPatientSummary(patientUserId)
      .then((res) => setPatient(res.data ?? null))
      .catch((err) => setError(err?.message ?? "Failed to load patient"))
      .finally(() => setIsLoading(false));
  }, [patientUserId]);

  const tabs = useMemo(() => {
    const list: { key: TabKey; label: string }[] = [];
    if (hasPermission(PERMISSIONS.DIAGNOSIS_VIEW)) list.push({ key: "diagnoses", label: "Diagnoses" });
    if (hasPermission(PERMISSIONS.PRESCRIPTION_VIEW)) list.push({ key: "prescriptions", label: "Prescriptions" });
    if (hasPermission(PERMISSIONS.VITALS_VIEW)) list.push({ key: "vitals", label: "Vitals" });
    if (hasPermission(PERMISSIONS.CLINICAL_NOTE_VIEW)) list.push({ key: "notes", label: "Notes" });
    if (hasPermission(PERMISSIONS.REPORT_VIEW)) list.push({ key: "reports", label: "Reports" });
    return list;
  }, [hasPermission]);

  const [activeTab, setActiveTab] = useState<TabKey | null>(null);
  useEffect(() => {
    if (!activeTab && tabs.length > 0) setActiveTab(tabs[0].key);
  }, [tabs, activeTab]);

  if (isLoading) return <div className="p-8 text-slate-400 dark:text-slate-500">Loading...</div>;
  if (error || !patient)
    return (
      <div className="p-8">
        <Alert>{error ?? "Patient not found"}</Alert>
      </div>
    );

  const age = patient.patientProfile.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.patientProfile.dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="p-8">
      <button onClick={() => navigate(-1)} className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← Back
      </button>

      <div className="mb-6 flex items-start justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              {patient.firstName} {patient.lastName}
            </h1>
            <StatusBadge value={patient.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {patient.email}
            {patient.patientProfile.medicalRecordNo ? ` · MRN ${patient.patientProfile.medicalRecordNo}` : ""}
            {patient.patientProfile.bloodGroup ? ` · ${patient.patientProfile.bloodGroup}` : ""}
            {age !== null ? ` · ${age}y` : ""}
            {patient.patientProfile.gender ? ` · ${patient.patientProfile.gender}` : ""}
          </p>
        </div>
      </div>

      {tabs.length === 0 ? (
        <Alert>You don't have permission to view any clinical records for this patient.</Alert>
      ) : (
        <>
          <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                  activeTab === tab.key
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "diagnoses" && <DiagnosesTab patientUserId={patientUserId} />}
          {activeTab === "prescriptions" && <PrescriptionsTab patientUserId={patientUserId} />}
          {activeTab === "vitals" && <VitalsTab patientUserId={patientUserId} />}
          {activeTab === "notes" && <NotesTab patientUserId={patientUserId} />}
          {activeTab === "reports" && <ReportsTab patientUserId={patientUserId} />}
        </>
      )}
    </div>
  );
}