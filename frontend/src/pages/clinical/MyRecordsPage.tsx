import { useEffect, useState } from "react";
import { clinicalApi, Diagnosis, Prescription, Report } from "../../api/clinical.api";
import { PageHeader, StatusBadge } from "../../components/UiPrimitives";
import { Alert } from "../../components/FormControls";

type TabKey = "diagnoses" | "prescriptions" | "reports";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Patient self-view. Read-only by design (matches the backend: there is no
// POST for any of these on the /me routes — reports especially, a patient
// can view but never upload/delete their own file, only a doctor can) and
// deliberately has no Notes tab — clinical notes stay provider-only, see
// clinical.routes.ts.
export default function MyRecordsPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("diagnoses");
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([clinicalApi.listMyDiagnoses(), clinicalApi.listMyPrescriptions(), clinicalApi.listMyReports()])
      .then(([diagRes, presRes, reportRes]) => {
        setDiagnoses(diagRes.data ?? []);
        setPrescriptions(presRes.data ?? []);
        setReports(reportRes.data ?? []);
      })
      .catch((err) => setError(err?.message ?? "Failed to load your records"))
      .finally(() => setIsLoading(false));
  }, []);

  const handleDownload = async (report: Report) => {
    setDownloadingId(report.id);
    try {
      await clinicalApi.downloadMyReport(report.id, report.originalName);
    } catch (err: any) {
      alert(err?.message ?? "Failed to download report");
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="p-8">
      <PageHeader title="My Medical Records" subtitle="Your diagnoses, prescriptions, and reports across all providers" />

      {error && <Alert>{error}</Alert>}

      <div className="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-700">
        {(["diagnoses", "prescriptions", "reports"] as TabKey[]).map((key) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition ${
              activeTab === key
                ? "border-brand-600 text-brand-600"
                : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            }`}
          >
            {key}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : (
        <>
          {activeTab === "diagnoses" &&
            (diagnoses.length === 0 ? (
              <EmptyState message="No diagnoses on file yet." />
            ) : (
              <ul className="space-y-3">
                {diagnoses.map((d) => (
                  <li key={d.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <p className="font-medium text-slate-800 dark:text-slate-100">{d.condition}</p>
                      <span className="text-xs text-slate-400 dark:text-slate-500">{new Date(d.diagnosedAt).toLocaleDateString()}</span>
                    </div>
                    {d.description && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{d.description}</p>}
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                      Dr. {d.doctor.user.firstName} {d.doctor.user.lastName}
                    </p>
                  </li>
                ))}
              </ul>
            ))}

          {activeTab === "prescriptions" &&
            (prescriptions.length === 0 ? (
              <EmptyState message="No prescriptions on file yet." />
            ) : (
              <ul className="space-y-3">
                {prescriptions.map((p) => (
                  <li key={p.id} className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(p.createdAt).toLocaleString()}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                          Dr. {p.doctor.user.firstName} {p.doctor.user.lastName}
                        </p>
                      </div>
                      <StatusBadge value={p.status} />
                    </div>
                    <table className="mt-3 w-full text-left text-sm">
                      <thead className="text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
                        <tr>
                          <th className="py-1 pr-4">Medicine</th>
                          <th className="py-1 pr-4">Dosage</th>
                          <th className="py-1 pr-4">Frequency</th>
                          <th className="py-1 pr-4">Duration</th>
                          <th className="py-1">Instructions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                        {p.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-1.5 pr-4 font-medium text-slate-800 dark:text-slate-100">{item.medicineName}</td>
                            <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">{item.dosage}</td>
                            <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">{item.frequency}</td>
                            <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-300">
                              {item.durationDays ? `${item.durationDays}d` : "—"}
                            </td>
                            <td className="py-1.5 text-slate-600 dark:text-slate-300">{item.instructions ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {p.notes && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{p.notes}</p>}
                  </li>
                ))}
              </ul>
            ))}

          {activeTab === "reports" &&
            (reports.length === 0 ? (
              <EmptyState message="No reports uploaded yet." />
            ) : (
              <ul className="space-y-2">
                {reports.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4"
                  >
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">{r.title}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">
                        {r.originalName} · {formatBytes(r.fileSizeBytes)} · {new Date(r.uploadedAt).toLocaleString()} · Dr.{" "}
                        {r.uploadedBy.firstName} {r.uploadedBy.lastName}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDownload(r)}
                      disabled={downloadingId === r.id}
                      className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-60"
                    >
                      {downloadingId === r.id ? "Downloading..." : "Download"}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
        </>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
      {message}
    </div>
  );
}