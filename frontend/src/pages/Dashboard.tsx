import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  dashboardApi,
  DashboardOverview,
  SuperAdminOverview,
  AdminOverview,
  DoctorOverview,
  NurseOverview,
  PatientOverview,
  AppointmentCard,
} from "../api/dashboard.api";
import { PageHeader, StatCard, StatusBadge } from "../components/UiPrimitives";
import { Alert } from "../components/FormControls";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  PATIENT: "Patient",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(iso).toLocaleDateString();
}

function AppointmentList({ items, emptyLabel }: { items: AppointmentCard[]; emptyLabel: string }) {
  if (items.length === 0) return <p className="text-sm text-slate-400 dark:text-slate-500">{emptyLabel}</p>;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700">
      {items.map((a) => (
        <li key={a.id} className="flex items-center justify-between py-3 text-sm">
          <div>
            <p className="font-medium text-slate-800 dark:text-slate-100">
              {a.patient.user.firstName} {a.patient.user.lastName}
              <span className="font-normal text-slate-400 dark:text-slate-500"> with </span>
              Dr. {a.doctor.user.firstName} {a.doctor.user.lastName}
            </p>
            <p className="text-slate-500 dark:text-slate-400">{formatDateTime(a.scheduledStart)}</p>
          </div>
          <StatusBadge value={a.status} />
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await dashboardApi.getOverview();
        if (!cancelled) setOverview(res.data ?? null);
      } catch (err: any) {
        if (!cancelled) setError(err?.message ?? "Failed to load your dashboard.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-8">
      <PageHeader
        title={`Welcome, ${user?.firstName ?? ""}`}
        subtitle={`Signed in as ${ROLE_LABEL[user?.role ?? ""] ?? user?.role}`}
      />

      {isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">Loading your overview...</p>}
      {error && <Alert>{error}</Alert>}

      {!isLoading && !error && overview?.roleCode === "SUPER_ADMIN" && <SuperAdminDashboard data={overview} />}
      {!isLoading && !error && overview?.roleCode === "ADMIN" && <AdminDashboard data={overview} />}
      {!isLoading && !error && overview?.roleCode === "DOCTOR" && <DoctorDashboard data={overview} />}
      {!isLoading && !error && overview?.roleCode === "NURSE" && <NurseDashboard data={overview} />}
      {!isLoading && !error && overview?.roleCode === "PATIENT" && <PatientDashboard data={overview} />}
    </div>
  );
}

function SuperAdminDashboard({ data }: { data: SuperAdminOverview }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Hospitals" value={data.hospitals.total} hint={`${data.hospitals.active} active`} />
        <StatCard label="Pending invitations" value={data.pendingInvitations} />
        <StatCard label="Appointments today" value={data.appointmentsToday} />
        <StatCard label="Audit events (24h)" value={data.auditEventsLast24h} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Users by role</h2>
          <ul className="space-y-2 text-sm">
            {(Object.entries(data.usersByRole) as [string, number][]).map(([role, count]) => (
              <li key={role} className="flex items-center justify-between">
                <span className="text-slate-600 dark:text-slate-300">{ROLE_LABEL[role] ?? role}</span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{count}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent activity</h2>
          {data.recentActivity.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No recent activity.</p>}
          <ul className="divide-y divide-slate-100 dark:divide-slate-700">
            {data.recentActivity.map((item) => (
              <li key={item.id} className="py-2 text-sm">
                <p className="text-slate-800 dark:text-slate-100">{item.action.replaceAll("_", " ").replaceAll(".", " · ")}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.user ? `${item.user.firstName} ${item.user.lastName}` : "System"} · {formatRelativeTime(item.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function AdminDashboard({ data }: { data: AdminOverview }) {
  if (!data.hospitalId) {
    return <Alert>Your account isn't linked to a hospital yet — contact a super admin.</Alert>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Doctors" value={data.staff.doctors} />
        <StatCard label="Nurses" value={data.staff.nurses} />
        <StatCard label="Patients seen" value={data.patientsSeen} />
        <StatCard label="Pending invitations" value={data.pendingInvitations} />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Today's appointments
          </h2>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Total</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{data.appointmentsToday.total}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Requested</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{data.appointmentsToday.requested}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Confirmed</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{data.appointmentsToday.confirmed}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Completed</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{data.appointmentsToday.completed}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">Cancelled</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{data.appointmentsToday.cancelled}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-slate-500 dark:text-slate-400">No-show</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{data.appointmentsToday.noShow}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Upcoming appointments
          </h2>
          <AppointmentList items={data.upcomingAppointments} emptyLabel="No upcoming appointments in your hospital." />
        </div>
      </div>
    </div>
  );
}

function DoctorDashboard({ data }: { data: DoctorOverview }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Assigned patients" value={data.assignedPatients} />
        <StatCard label="Today's appointments" value={data.todaysAppointments.length} />
        <StatCard label="Upcoming (7 days)" value={data.upcomingAppointmentsNext7Days} />
        <StatCard label="Diagnoses this week" value={data.diagnosesThisWeek} />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Today's schedule</h2>
        <AppointmentList items={data.todaysAppointments} emptyLabel="No appointments scheduled for today." />
      </div>
    </div>
  );
}

function NurseDashboard({ data }: { data: NurseOverview }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Assigned patients" value={data.assignedPatients} />
        <StatCard label="Vitals recorded today" value={data.vitalsRecordedToday} />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recently assigned patients</h2>
        {data.recentPatients.length === 0 && <p className="text-sm text-slate-400 dark:text-slate-500">No patients assigned yet.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-700">
          {data.recentPatients.map((link) => (
            <li key={link.id} className="flex items-center justify-between py-3 text-sm">
              <Link
                to={`/clinical/patients/${link.patient.user.id}`}
                className="font-medium text-brand-700 dark:text-brand-400 hover:underline"
              >
                {link.patient.user.firstName} {link.patient.user.lastName}
              </Link>
              <span className="text-slate-500 dark:text-slate-400">{link.patient.bloodGroup ?? "Blood group unknown"}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PatientDashboard({ data }: { data: PatientOverview }) {
  return (
    <div className="space-y-6">
      {data.profileCompleteness.percent < 100 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Your profile is {data.profileCompleteness.percent}% complete.
          </p>
          <p className="mt-1 text-amber-700 dark:text-amber-400">
            Adding your date of birth, blood group, and emergency contact helps your care team act quickly if needed.{" "}
            <Link to="/account-settings" className="font-medium underline">
              Finish your profile
            </Link>
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <StatCard label="Upcoming appointments" value={data.upcomingAppointmentsCount} />
        <StatCard label="Active prescriptions" value={data.activePrescriptions} />
        <StatCard label="Reports on file" value={data.recentReports.length} />
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Upcoming appointments</h2>
        <AppointmentList items={data.upcomingAppointments} emptyLabel="No upcoming appointments." />
      </div>
    </div>
  );
}
