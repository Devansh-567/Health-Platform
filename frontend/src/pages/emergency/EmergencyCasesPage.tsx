import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { emergencyApi, EmergencyCase } from "../../api/emergency.api";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Alert } from "../../components/FormControls";

function fullName(p: { firstName: string; lastName: string }) {
  return `${p.firstName} ${p.lastName}`;
}

export default function EmergencyCasesPage() {
  const [cases, setCases] = useState<EmergencyCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    emergencyApi
      .list({})
      .then((res) => setCases(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load emergency cases"))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-8">
      <PageHeader title="Emergency Cases" subtitle="Field pickups with live PPG monitoring, awaiting or in triage" />

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : cases.length === 0 ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-8 text-center text-sm text-slate-400 dark:text-slate-500">
          No emergency cases to show.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Patient</th>
                <th className="px-4 py-3">Ambulance</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">
                      {c.patient ? fullName(c.patient.user) : c.unknownPatientLabel ?? "Unidentified patient"}
                    </p>
                    {c.isAbnormal && <span className="text-xs font-medium text-red-600">⚠ Abnormal vitals</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {c.ambulance.vehicleNumber} · {c.paramedic.firstName} {c.paramedic.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {c.assignedDoctor ? fullName(c.assignedDoctor) : "Unassigned"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge value={c.status} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/emergency-cases/${c.id}`} className="text-sm font-medium text-brand-600 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
