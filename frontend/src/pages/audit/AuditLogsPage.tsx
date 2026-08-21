import { Fragment, useEffect, useState } from "react";
import { auditApi, AuditLogItem } from "../../api/audit.api";
import { PageHeader, Pagination } from "../../components/UiPrimitives";
import { Alert } from "../../components/FormControls";

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [actionInput, setActionInput] = useState("");
  const [action, setAction] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const pageSize = 20;

  // Debounce the raw input so we don't hit the API on every keystroke.
  useEffect(() => {
    const handle = setTimeout(() => setAction(actionInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [actionInput]);

  // Any time the filter changes, jump back to page 1 so results aren't
  // scoped to a page that no longer makes sense for the new query.
  useEffect(() => {
    setPage(1);
  }, [action]);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await auditApi.list({ action: action || undefined, page, pageSize });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? 0);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load audit logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action]);

  const actorLabel = (log: AuditLogItem) => {
    if (!log.user) return "System";
    const name = `${log.user.firstName} ${log.user.lastName}`.trim();
    return name || log.user.email;
  };

  const entityLabel = (log: AuditLogItem) => {
    if (!log.entityType) return "—";
    if (!log.entityId) return log.entityType;
    return `${log.entityType} · ${log.entityId.slice(0, 8)}`;
  };

  return (
    <div className="p-8">
      <PageHeader title="Audit Logs" subtitle="A record of every sensitive action taken across the system" />

      {error && <Alert>{error}</Alert>}

      <div className="mb-4">
        <input
          type="text"
          value={actionInput}
          onChange={(e) => setActionInput(e.target.value)}
          placeholder="Filter by action (e.g. USER, ROLE, AUTH)"
          className="w-72 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
            <tr>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">IP</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400 dark:text-slate-500">No audit log entries yet.</td></tr>
            ) : (
              items.map((log) => (
                <Fragment key={log.id}>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-100">{actorLabel(log)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-700 dark:text-slate-300">{log.action}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{entityLabel(log)}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.ip || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {log.metadata != null && (
                        <button
                          onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          className="text-sm font-medium text-brand-600 hover:underline"
                        >
                          {expandedId === log.id ? "Hide" : "Details"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {expandedId === log.id && log.metadata != null && (
                    <tr>
                      <td colSpan={6} className="bg-slate-50 dark:bg-slate-900 px-4 py-3">
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs text-slate-600 dark:text-slate-300">
                          {JSON.stringify(log.metadata, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </div>
  );
}
