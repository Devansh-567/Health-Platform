const BADGE_STYLES: Record<string, string> = {
  ACTIVE: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  PENDING_VERIFICATION: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  SUSPENDED: "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  DEACTIVATED: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  LOCKED: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  true: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
  false: "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
};

export function StatusBadge({ value }: { value: string | boolean }) {
  const key = String(value);
  const label = typeof value === "boolean" ? (value ? "Active" : "Inactive") : value.replaceAll("_", " ");
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE_STYLES[key] ?? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
      {label}
    </span>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function Pagination({ page, pageSize, total, onPageChange }: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
      <span>
        Page {page} of {totalPages} · {total} total
      </span>
      <div className="flex gap-2">
        <button
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 disabled:opacity-40"
        >
          Previous
        </button>
        <button
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-300 dark:border-slate-600 px-3 py-1 disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}