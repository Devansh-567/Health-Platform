import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { usersApi, UserDetail } from "../../api/users.api";
import { assignmentsApi, AssignedPatient, AssignablePatientResult } from "../../api/assignments.api";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Modal } from "../../components/Modal";
import { Alert } from "../../components/FormControls";
import { useAuth } from "../../context/AuthContext";
import { PERMISSIONS } from "../../constants/permissions";

const ROLE_LABEL: Record<string, string> = { DOCTOR: "Dr.", NURSE: "Nurse" };

export default function PatientAssignmentsPage() {
  const { staffUserId = "" } = useParams();
  // Admin holds prescription.view (their sole clinical view permission — see
  // clinical.service.ts's assertAccess), so a chart link is only worth
  // showing when that's actually true; a Super Admin sees it unconditionally.
  const { hasPermission } = useAuth();
  const canOpenChart = hasPermission(
    PERMISSIONS.DIAGNOSIS_VIEW,
    PERMISSIONS.PRESCRIPTION_VIEW,
    PERMISSIONS.VITALS_VIEW,
    PERMISSIONS.CLINICAL_NOTE_VIEW
  );
  const [staff, setStaff] = useState<UserDetail | null>(null);
  const [assigned, setAssigned] = useState<AssignedPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAssign, setShowAssign] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      const [staffRes, assignedRes] = await Promise.all([
        usersApi.get(staffUserId),
        assignmentsApi.listAssigned(staffUserId),
      ]);
      setStaff(staffRes.data ?? null);
      setAssigned(assignedRes.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load assignments");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staffUserId]);

  const handleUnassign = async (patient: AssignedPatient) => {
    if (!confirm(`Remove ${patient.patient.user.firstName} ${patient.patient.user.lastName} from this ${staff?.role.code === "DOCTOR" ? "doctor" : "nurse"}'s patient list?`)) return;
    try {
      await assignmentsApi.unassign(staffUserId, patient.patient.user.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to unassign patient");
    }
  };

  if (isLoading) return <div className="p-8 text-slate-400 dark:text-slate-500">Loading...</div>;
  if (error || !staff) return <div className="p-8"><Alert>{error ?? "Staff member not found"}</Alert></div>;

  const roleLabel = ROLE_LABEL[staff.role.code] ?? staff.role.name;

  return (
    <div className="p-8">
      <Link to="/staff" className="mb-4 inline-block text-sm text-brand-600 hover:underline">
        ← Back to staff
      </Link>

      <PageHeader
        title={`${roleLabel} ${staff.firstName} ${staff.lastName}`}
        subtitle={`${staff.email}${staff.hospital ? " · " + staff.hospital.name : ""} — assigned patients`}
        action={
          <button onClick={() => setShowAssign(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
            + Assign patient
          </button>
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">MRN</th>
              <th className="px-4 py-3">Blood group</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Assigned</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {assigned.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                  No patients assigned yet.
                </td>
              </tr>
            ) : (
              assigned.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {a.patient.user.firstName} {a.patient.user.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.patient.user.email}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.patient.medicalRecordNo ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.patient.bloodGroup ?? "—"}</td>
                  <td className="px-4 py-3"><StatusBadge value={a.patient.user.status} /></td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(a.assignedAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right">
                    {canOpenChart && (
                      <Link
                        to={`/clinical/patients/${a.patient.user.id}`}
                        className="mr-3 text-sm font-medium text-brand-600 hover:underline"
                      >
                        Open chart
                      </Link>
                    )}
                    <button onClick={() => handleUnassign(a)} className="text-sm font-medium text-red-600 hover:underline">
                      Unassign
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showAssign && (
        <AssignPatientModal
          staffUserId={staffUserId}
          onClose={() => setShowAssign(false)}
          onAssigned={load}
        />
      )}
    </div>
  );
}

function AssignPatientModal({
  staffUserId,
  onClose,
  onAssigned,
}: {
  staffUserId: string;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AssignablePatientResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);

  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    setIsLoading(true);
    assignmentsApi
      .searchAssignable(search, staffUserId)
      .then((res) => setResults(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Search failed"))
      .finally(() => setIsLoading(false));
  }, [search, staffUserId]);

  const handleAssign = async (patient: AssignablePatientResult) => {
    setAssigningId(patient.id);
    setError(null);
    try {
      await assignmentsApi.assign(staffUserId, patient.id);
      setResults((prev) => prev.map((p) => (p.id === patient.id ? { ...p, alreadyAssigned: true } : p)));
      onAssigned();
    } catch (err: any) {
      setError(err?.message ?? "Failed to assign patient");
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <Modal title="Assign patient" onClose={onClose}>
      {error && <Alert>{error}</Alert>}

      <input
        type="text"
        autoFocus
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        placeholder="Search patients by name, email, or MRN..."
        className="mb-4 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
      />

      <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">Searching...</div>
        ) : results.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            {search ? `No patients match "${search}".` : "No active patients found."}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {results.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{p.firstName} {p.lastName}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {p.email}{p.patientProfile.medicalRecordNo ? ` · MRN ${p.patientProfile.medicalRecordNo}` : ""}
                  </p>
                </div>
                {p.alreadyAssigned ? (
                  <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Already assigned</span>
                ) : (
                  <button
                    onClick={() => handleAssign(p)}
                    disabled={assigningId === p.id}
                    className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {assigningId === p.id ? "Assigning..." : "Assign"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}