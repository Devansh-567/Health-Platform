import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PermissionRoute } from "./routes/PermissionRoute";
import { AppLayout } from "./components/AppLayout";
import { PERMISSIONS } from "./constants/permissions";

import LoginPage from "./pages/Login";
import SignupPage from "./pages/Signup";
import ForgotPasswordPage from "./pages/ForgotPassword";
import ResetPasswordPage from "./pages/ResetPassword";
import VerifyEmailPage from "./pages/VerifyEmail";
import AcceptInvitationPage from "./pages/AcceptInvitation";
import DashboardPage from "./pages/Dashboard";
import HospitalsPage from "./pages/hospitals/HospitalsPage";
import HospitalDetailPage from "./pages/hospitals/HospitalDetailPage";
import AdminsPage from "./pages/admins/AdminsPage";
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

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.HOSPITAL_MANAGE]} />}>
              <Route path="/hospitals" element={<HospitalsPage />} />
              <Route path="/hospitals/:hospitalId" element={<HospitalDetailPage />} />
            </Route>

            <Route element={<PermissionRoute anyOf={[PERMISSIONS.USER_CREATE_ADMIN]} />}>
              <Route path="/admins" element={<AdminsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthProvider>
  );
}
