import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PermissionRoute } from "./routes/PermissionRoute";
import { RoleRoute } from "./routes/RoleRoute";
import { AppLayout } from "./components/AppLayout";
import { PERMISSIONS } from "./constants/permissions";

import LoginPage from "./pages/Login";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import AcceptInvitationPage from "./pages/AcceptInvitation";
import DashboardPage from "./pages/Dashboard";
import AccountSettingsPage from "./pages/AccountSettings";
import HospitalsPage from "./pages/hospitals/HospitalsPage";
import HospitalDetailPage from "./pages/hospitals/HospitalDetailPage";
import AdminsPage from "./pages/admins/AdminsPage";
import StaffPage from "./pages/staff/StaffPage";
import PatientsPage from "./pages/patients/PatientsPage";
import PatientAssignmentsPage from "./pages/staff/PatientAssignmentsPage";
import TransfersPage from "./pages/transfers/TransfersPage";
import AmbulancesPage from "./pages/ambulances/AmbulancesPage";
import TripTrackingPage from "./pages/trips/TripTrackingPage";
import MyTripsPage from "./pages/trips/MyTripsPage";
import DriverConsolePage from "./pages/driver/DriverConsolePage";
import EmergencyConsolePage from "./pages/emergency/EmergencyConsolePage";
import EmergencyCasesPage from "./pages/emergency/EmergencyCasesPage";
import EmergencyCaseDetailPage from "./pages/emergency/EmergencyCaseDetailPage";
import RolesPage from "./pages/roles/RolesPage";
import RoleDetailPage from "./pages/roles/RoleDetailPage";
import AuditLogsPage from "./pages/audit/AuditLogsPage";
import AppointmentsPage from "./pages/appointments/AppointmentsPage";
import MyPatientsPage from "./pages/clinical/MyPatientsPage";
import PatientChartPage from "./pages/clinical/PatientChartPage";
import MyRecordsPage from "./pages/clinical/MyRecordsPage";
import { UnauthorizedPage, NotFoundPage } from "./pages/StatusPages";
import { roleHomePath } from "./routes/roleHomePath";

function EntryRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  if (isLoading) return null;
  return <Navigate to={isAuthenticated && user ? roleHomePath(user.role) : "/login"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<EntryRedirect />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        {/* Doctors/nurses still self-set a password via an emailed invite link.
            Patients don't use this route at all — see /patients below. */}
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        <Route element={<ProtectedRoute />}>
          {/* Driver console is a dedicated full-screen mobile view — no
              sidebar/AppLayout chrome, since a driver mid-trip needs the
              screen for the map and status controls, not admin navigation. */}
          <Route element={<RoleRoute allow={["DRIVER"]} />}>
            <Route path="/driver" element={<DriverConsolePage />} />
            <Route path="/driver/emergency" element={<EmergencyConsolePage />} />
          </Route>

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

            {/* Admin/Super Admin only: create patient accounts (temp password
                emailed to the patient) and see the patient roster. */}
            <Route element={<PermissionRoute anyOf={[PERMISSIONS.PATIENT_MANAGE]} />}>
              <Route path="/patients" element={<PatientsPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.PATIENT_ASSIGN]} />}>
              <Route path="/staff/:staffUserId/patients" element={<PatientAssignmentsPage />} />
            </Route>

            {/* Interhospital transfer: admin1 requests, admin2 confirms. Same
                permission drives both ends — the service layer enforces which
                side of a given request an admin may act on. */}
            <Route element={<PermissionRoute anyOf={[PERMISSIONS.PATIENT_TRANSFER_MANAGE]} />}>
              <Route path="/transfers" element={<TransfersPage />} />
            </Route>

            {/* Ambulance fleet management (add/retire vehicles) is Admin-only.
                Trip tracking is much broader — Admin, Doctor, Nurse, and the
                patient/driver themselves — service-layer scoping in
                trips.service.ts decides exactly which trips each sees. */}
            <Route element={<PermissionRoute anyOf={[PERMISSIONS.AMBULANCE_MANAGE]} />}>
              <Route path="/ambulances" element={<AmbulancesPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.AMBULANCE_TRIP_VIEW]} />}>
              <Route path="/trips" element={<MyTripsPage />} />
              <Route path="/trips/:tripId" element={<TripTrackingPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.EMERGENCY_CASE_VIEW]} />}>
              <Route path="/emergency-cases" element={<EmergencyCasesPage />} />
              <Route path="/emergency-cases/:caseId" element={<EmergencyCaseDetailPage />} />
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
                never overlaps with Admin's separate "Manage patients" flow. */}
            <Route element={<PermissionRoute anyOf={[PERMISSIONS.PATIENT_VIEW_ASSIGNED]} />}>
              <Route path="/clinical/patients" element={<MyPatientsPage />} />
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

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.MEDICAL_HISTORY_VIEW_OWN]} />}>
              <Route path="/my-records" element={<MyRecordsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}