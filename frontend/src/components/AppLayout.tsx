import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { PERMISSIONS } from "../constants/permissions";
import { ThemeToggle } from "./ThemeToggle";
import EmergencyAlertListener from "./EmergencyAlertListener";

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  DOCTOR: "Doctor",
  NURSE: "Nurse",
  PATIENT: "Patient",
  DRIVER: "Driver",
};

interface NavItem {
  label: string;
  to: string;
  requires?: string[];
  // Restricts the item to specific roles regardless of permissions — used for
  // things like Hospitals, which stays Super Admin-only even though an Admin
  // may hold hospital.view for their own hospital's API calls.
  rolesOnly?: string[];
  // Hides the item for specific roles even though they hold the permission —
  // used for "My Patients" / "My Records", which are personal, single-actor
  // views that don't apply to Super Admin (no assignment, no own patient
  // record) even though Super Admin holds every permission by default.
  hiddenForRoles?: string[];
}

// Add entries here as new modules ship (Staff, Audit Logs, Appointments, etc.)
// so the sidebar never links to a route that doesn't exist yet.
const NAV_ITEMS: NavItem[] = [
  { label: "Overview", to: "/dashboard" },
  { label: "Hospitals", to: "/hospitals", rolesOnly: ["SUPER_ADMIN"] },
  { label: "Admins", to: "/admins", requires: [PERMISSIONS.USER_CREATE_ADMIN] },
  { label: "Staff", to: "/staff", requires: [PERMISSIONS.USER_VIEW, PERMISSIONS.USER_CREATE_STAFF] },
  { label: "Patients", to: "/patients", requires: [PERMISSIONS.PATIENT_MANAGE] },
  { label: "Transfers", to: "/transfers", requires: [PERMISSIONS.PATIENT_TRANSFER_MANAGE] },
  { label: "Ambulances", to: "/ambulances", requires: [PERMISSIONS.AMBULANCE_MANAGE] },
  { label: "Ambulance Tracking", to: "/trips", requires: [PERMISSIONS.AMBULANCE_TRIP_VIEW] },
  { label: "Emergency Cases", to: "/emergency-cases", requires: [PERMISSIONS.EMERGENCY_CASE_VIEW] },
  {
    label: "Appointments",
    to: "/appointments",
    requires: [PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY],
  },
  {
    label: "My Patients",
    to: "/clinical/patients",
    requires: [PERMISSIONS.PATIENT_VIEW_ASSIGNED],
    hiddenForRoles: ["SUPER_ADMIN"],
  },
  {
    label: "My Records",
    to: "/my-records",
    requires: [PERMISSIONS.MEDICAL_HISTORY_VIEW_OWN],
    hiddenForRoles: ["SUPER_ADMIN"],
  },
  { label: "Roles & Permissions", to: "/roles", requires: [PERMISSIONS.ROLE_MANAGE] },
  { label: "Audit Logs", to: "/audit-logs", requires: [PERMISSIONS.AUDIT_LOG_VIEW] },
  { label: "Account Settings", to: "/account-settings" },
];

export function AppLayout() {
  const { user, hasPermission, hasRole, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.rolesOnly && !hasRole(...item.rolesOnly)) return false;
    if (item.hiddenForRoles && hasRole(...item.hiddenForRoles)) return false;
    if (item.requires && !hasPermission(...item.requires)) return false;
    return true;
  });

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900">
      <aside className="flex w-60 flex-col border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="flex items-center justify-between gap-2 px-5 py-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">H</div>
            <span className="font-semibold text-slate-800 dark:text-slate-100">HMS</span>
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/dashboard"}
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition ${
                  isActive ? "bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-200 dark:border-slate-700 p-4">
          <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{ROLE_LABEL[user?.role ?? ""] ?? user?.role}</p>
          <button
            onClick={handleLogout}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            Log out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <EmergencyAlertListener />
        <Outlet />
      </main>
    </div>
  );
}