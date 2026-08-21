import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RoleCode } from "../types/auth";

export function RoleRoute({ allow, deny }: { allow?: RoleCode[]; deny?: RoleCode[] }) {
  const { hasRole } = useAuth();
  if (allow && !hasRole(...allow)) return <Navigate to="/unauthorized" replace />;
  if (deny && hasRole(...deny)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}
