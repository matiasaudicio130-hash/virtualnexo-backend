import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import type { UserStatus, UserRole } from "@/types";

interface Props {
  allowedStatuses?: UserStatus[];
  requiredRole?: UserRole;
  redirectTo?: string;
}

export function ProtectedRoute({
  allowedStatuses = ["active"],
  requiredRole,
  redirectTo = "/login",
}: Props) {
  const { isAuthenticated, user } = useAuthStore();

  if (!isAuthenticated || !user) return <Navigate to={redirectTo} replace />;

  if (!allowedStatuses.includes(user.status)) {
    const statusRedirects: Partial<Record<UserStatus, string>> = {
      pending_email: "/verificar-email",
      pending_kyc: "/kyc",
      pending_manual: "/aprobacion-pendiente",
      suspended: "/acceso-denegado",
      rejected: "/acceso-denegado",
    };
    return <Navigate to={statusRedirects[user.status] ?? "/login"} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
