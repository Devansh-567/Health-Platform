import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function PermissionRoute({ anyOf }: { anyOf: string[] }) {
  const { hasPermission } = useAuth();
  if (!hasPermission(...anyOf)) return <Navigate to="/unauthorized" replace />;
  return <Outlet />;
}