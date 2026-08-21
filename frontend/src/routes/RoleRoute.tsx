import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RoleCode } from "../types/auth";

export function RoleRoute({ allow }: { allow: RoleCode[] }) {
  const { hasRole } = useAuth();
  if (!hasRole(...allow)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
