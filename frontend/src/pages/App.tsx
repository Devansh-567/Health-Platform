import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PermissionRoute } from "./routes/PermissionRoute";
import { RoleRoute } from "./routes/RoleRoute";
import { AppLayout } from "./components/AppLayout";
import { PERMISSIONS } from "./constants/permissions";

import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import VerifyEmailPage from "./pages/VerifyEmail";
import AcceptInvitationPage from "./pages/AcceptInvitation";
import DashboardPage from "./pages/Dashboard";
import AccountSettingsPage from "./pages/AccountSettings";
import HospitalsPage from "./pages/hospitals/HospitalsPage";
import HospitalDetailPage from "./pages/hospitals/HospitalDetailPage";
import AdminsPage from "./pages/admins/AdminsPage";
import StaffPage from "./pages/staff/StaffPage";
import PatientAssignmentsPage from "./pages/staff/PatientAssignmentsPage";
import RolesPage from "./pages/roles/RolesPage";
import RoleDetailPage from "./pages/roles/RoleDetailPage";
import AuditLogsPage from "./pages/audit/AuditLogsPage";
import AppointmentsPage from "./pages/appointments/AppointmentsPage";
import MyPatientsPage from "./pages/clinical/MyPatientsPage";
import PatientChartPage from "./pages/clinical/PatientChartPage";
import MyRecordsPage from "./pages/clinical/MyRecordsPage";
import { UnauthorizedPage, NotFoundPage } from "./pages/StatusPages";

function EntryRedirect() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return <Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<EntryRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/account-settings" element={<AccountSettingsPage />} />

            {/* Hospitals are Super Admin-only: an Admin is always scoped to their
                own hospital and never needs (or should see) the full hospitals list. */}
            <Route element={<RoleRoute allow={["SUPER_ADMIN"]} />}>
              <Route path="/hospitals" element={<HospitalsPage />} />
              <Route path="/hospitals/:hospitalId" element={<HospitalDetailPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.USER_CREATE_ADMIN]} />}>
              <Route path="/admins" element={<AdminsPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.USER_VIEW, PERMISSIONS.USER_CREATE_STAFF]} />}>
              <Route path="/staff" element={<StaffPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.PATIENT_ASSIGN]} />}>
              <Route path="/staff/:staffUserId/patients" element={<PatientAssignmentsPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.ROLE_MANAGE]} />}>
              <Route path="/roles" element={<RolesPage />} />
              <Route path="/roles/:roleId" element={<RoleDetailPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.AUDIT_LOG_VIEW]} />}>
              <Route path="/audit-logs" element={<AuditLogsPage />} />
            </Route>

            <Route
              element={
                <PermissionRoute anyOf={[PERMISSIONS.APPOINTMENT_BOOK, PERMISSIONS.APPOINTMENT_MANAGE_OWN, PERMISSIONS.APPOINTMENT_MANAGE_ANY]} />
              }
            >
              <Route path="/appointments" element={<AppointmentsPage />} />
            </Route>

            {/* Doctor/Nurse entry point: their own assigned patients. Gated by
                patient.view.assigned, which only those two roles hold, so this
                never overlaps with Admin's separate "Manage patients" flow.
                Super Admin holds every permission by default but has no
                assignment concept of its own, so it's explicitly denied here
                rather than hitting a "my assignments" query with nothing to
                return. */}
            <Route element={<RoleRoute deny={["SUPER_ADMIN"]} />}>
              <Route element={<PermissionRoute anyOf={[PERMISSIONS.PATIENT_VIEW_ASSIGNED]} />}>
                <Route path="/clinical/patients" element={<MyPatientsPage />} />
              </Route>
            </Route>

            {/* The shared chart page is reachable by staff/admin roles only —
                RoleRoute excludes PATIENT here even though a patient holds
                prescription.view too (for their own "/my-records" view via a
                different, patient-only endpoint), so a patient hitting this
                URL is redirected before ever calling the staff-facing API. */}
            <Route element={<RoleRoute allow={["SUPER_ADMIN", "ADMIN", "DOCTOR", "NURSE"]} />}>
              <Route
                element={
                  <PermissionRoute
                    anyOf={[PERMISSIONS.DIAGNOSIS_VIEW, PERMISSIONS.PRESCRIPTION_VIEW, PERMISSIONS.VITALS_VIEW, PERMISSIONS.CLINICAL_NOTE_VIEW]}
                  />
                }
              >
                <Route path="/clinical/patients/:patientUserId" element={<PatientChartPage />} />
              </Route>
            </Route>

            {/* Patient's own medical history. Super Admin holds this permission
                by default too but has no patient record of its own — denied
                here for the same reason as "/clinical/patients" above. */}
            <Route element={<RoleRoute deny={["SUPER_ADMIN"]} />}>
              <Route element={<PermissionRoute anyOf={[PERMISSIONS.MEDICAL_HISTORY_VIEW_OWN]} />}>
                <Route path="/my-records" element={<MyRecordsPage />} />
              </Route>
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}