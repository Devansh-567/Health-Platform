import { useAuth } from "../context/AuthContext";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  PATIENT: "Patient",
};

export default function DashboardPage() {
  const { user, permissions } = useAuth();

  return (
    <div className="p-8">
      <h1 className="mb-1 text-2xl font-semibold text-slate-900">Welcome, {user?.firstName}</h1>
      <p className="mb-8 text-sm text-slate-500">Signed in as {ROLE_LABEL[user?.role ?? ""] ?? user?.role}</p>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Your permissions</h2>
        <div className="flex flex-wrap gap-2">
          {permissions.length === 0 && <span className="text-sm text-slate-400">No permissions resolved.</span>}
          {permissions.map((p) => (
            <span key={p} className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              {p}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
