import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { clinicalApi, Report } from "../../../api/clinical.api";
import { useAuth } from "../../../context/AuthContext";
import { PERMISSIONS } from "../../../constants/permissions";
import { Modal } from "../../../components/Modal";
import { Field, PrimaryButton, Alert } from "../../../components/FormControls";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ReportsTab({ patientUserId }: { patientUserId: string }) {
  const { hasPermission } = useAuth();
  const canUpload = hasPermission(PERMISSIONS.REPORT_UPLOAD);

  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const load = () => {
    setIsLoading(true);
    clinicalApi
      .listReports(patientUserId)
      .then((res) => setReports(res.data ?? []))
      .catch((err) => setError(err?.message ?? "Failed to load reports"))
      .finally(() => setIsLoading(false));
  };

  useEffect(load, [patientUserId]);

  const handleDownload = async (report: Report) => {
    setDownloadingId(report.id);
    try {
      await clinicalApi.downloadReport(patientUserId, report.id, report.originalName);
    } catch (err: any) {
      alert(err?.message ?? "Failed to download report");
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = async (report: Report) => {
    if (!confirm(`Delete "${report.title}"? This cannot be undone.`)) return;
    try {
      await clinicalApi.deleteReport(patientUserId, report.id);
      load();
    } catch (err: any) {
      alert(err?.message ?? "Failed to delete report");
    }
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Reports</h2>
        {canUpload && (
          <button
            onClick={() => setShowUpload(true)}
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
          >
            + Upload report
          </button>
        )}
      </div>

      {error && <Alert>{error}</Alert>}

      {isLoading ? (
        <div className="text-sm text-slate-400 dark:text-slate-500">Loading...</div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
          No reports uploaded yet.
        </div>
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
                  {r.originalName} · {formatBytes(r.fileSizeBytes)} · {new Date(r.uploadedAt).toLocaleString()} · {r.uploadedBy.firstName}{" "}
                  {r.uploadedBy.lastName}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleDownload(r)}
                  disabled={downloadingId === r.id}
                  className="text-sm font-medium text-brand-600 hover:underline disabled:opacity-60"
                >
                  {downloadingId === r.id ? "Downloading..." : "Download"}
                </button>
                {canUpload && (
                  <button onClick={() => handleDelete(r)} className="text-sm font-medium text-red-600 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {showUpload && (
        <UploadReportModal
          patientUserId={patientUserId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            load();
          }}
        />
      )}
    </div>
  );
}

interface UploadFormValues {
  title: string;
}

function UploadReportModal({
  patientUserId,
  onClose,
  onUploaded,
}: {
  patientUserId: string;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<UploadFormValues>({ defaultValues: { title: "" } });

  const onSubmit = async (values: UploadFormValues) => {
    setError(null);
    if (!file) {
      setError("Please choose a file");
      return;
    }
    try {
      await clinicalApi.uploadReport(patientUserId, file, values.title || undefined);
      onUploaded();
    } catch (err: any) {
      setError(err?.message ?? "Failed to upload report");
    }
  };

  return (
    <Modal title="Upload report" onClose={onClose}>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Field label="Title (optional)" placeholder="e.g. Blood test — CBC panel" {...register("title")} />

        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">File</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
          />
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">PDF, JPEG, PNG, or WEBP — max 15MB.</p>
        </div>

        <PrimaryButton type="submit" isLoading={isSubmitting}>
          Upload
        </PrimaryButton>
      </form>
    </Modal>
  );
}