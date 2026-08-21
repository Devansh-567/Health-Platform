import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { clinicalApi, MyPatient } from "../../api/clinical.api";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Alert } from "../../components/FormControls";

// Doctor/Nurse entry point into a patient's clinical chart. Deliberately
// separate from the Admin "Manage patients" page (/staff/:id/patients):
// that page requires patient.assign (Admin/Super Admin only) and is about
// assigning/unassigning, not clinical work. This page requires
// patient.view.assigned instead, which only DOCTOR and NURSE hold, and
// always lists the signed-in staff member's own active assignments — no
// staffUserId is ever taken from the client.
export default function MyPatientsPage() {
  const [patients, setPatients] = useState<MyPatient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clinicalApi
      .listMyPatients()
      .then((res) => setPatients(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load patients"))
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <div className="p-8">
      <PageHeader title="My Patients" subtitle="Patients currently assigned to you" />

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="text-slate-400 dark:text-slate-500">Loading...</div>
      ) : (
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
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">
                    No patients are currently assigned to you.
                  </td>
                </tr>
              ) : (
                patients.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                      {a.patient.user.firstName} {a.patient.user.lastName}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.patient.user.email}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.patient.medicalRecordNo ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{a.patient.bloodGroup ?? "—"}</td>
                    <td className="px-4 py-3">
                      <StatusBadge value={a.patient.user.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{new Date(a.assignedAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/clinical/patients/${a.patient.user.id}`}
                        className="text-sm font-medium text-brand-600 hover:underline"
                      >
                        Open chart
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
