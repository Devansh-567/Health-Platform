import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const location = useLocation();

  if (isLoading) return <FullscreenLoader />;
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />;

  // Admin-issued temporary passwords (e.g. a newly invited patient) force a
  // password change before anything else in the app is usable. Account
  // Settings is the one page allowed through, since that's where the
  // change-password form lives.
  if (user?.mustChangePassword && location.pathname !== "/account-settings") {
    return <Navigate to="/account-settings" state={{ forcedPasswordChange: true }} replace />;
  }

  return <Outlet />;
}

export function FullscreenLoader() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
    </div>
  );
}
