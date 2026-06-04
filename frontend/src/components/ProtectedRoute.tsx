import { Navigate, Outlet, useLocation } from "react-router-dom";
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
  const location = useLocation();

  if (!isAuthenticated || !user) return <Navigate to={redirectTo} replace />;

  if (!allowedStatuses.includes(user.status)) {
    const statusRedirects: Partial<Record<UserStatus, string>> = {
      pending_email: "/verificar-email",
      pending_kyc:   "/kyc",
      pending_manual: "/aprobacion-pendiente",
      suspended: "/acceso-denegado",
      rejected:  "/acceso-denegado",
    };
    return <Navigate to={statusRedirects[user.status] ?? "/login"} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    return <Navigate to="/dashboard" replace />;
  }

  // ── Onboarding automático para perfiles incompletos ──────────────────────
  // Redirige a /onboarding si:
  //  • El usuario es activo (no admin)
  //  • No completó el onboarding en este dispositivo
  //  • El perfil le falta foto, bio o ciudad
  //  • No estamos ya en /onboarding (evita loop)
  const onOnboarding = location.pathname.startsWith("/onboarding");
  const onboardingDone = !!localStorage.getItem("onboarding_done");
  const isAdmin = (user as any).role === "admin";

  if (
    !onOnboarding &&
    !onboardingDone &&
    !isAdmin &&
    user.status === "active" &&
    allowedStatuses.includes("active") &&
    (!user.profile_photo_url || !(user as any).province)
  ) {
    return <Navigate to="/onboarding" replace />;
  }

  return <Outlet />;
}
