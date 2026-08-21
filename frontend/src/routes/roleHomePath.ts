import { RoleCode } from "../types/auth";

// All roles currently land on the same /dashboard route. When role-specific
// dashboards are built, add BOTH the distinct path here AND a matching
// <Route> in App.tsx at the same time — a mismatch between the two is what
// caused the post-login 404 (e.g. redirecting to "/dashboard/admin" while
// only "/dashboard" was ever registered as a route).
const ROLE_HOME: Record<RoleCode, string> = {
  SUPER_ADMIN: "/dashboard",
  ADMIN: "/dashboard",
  DOCTOR: "/dashboard",
  NURSE: "/dashboard",
  PATIENT: "/dashboard",
  // Drivers get a dedicated full-screen mobile console, not the sidebar
  // dashboard — see DriverConsolePage + its standalone route in App.tsx.
  DRIVER: "/driver",
};

export const roleHomePath = (role: RoleCode) => ROLE_HOME[role] ?? "/dashboard";