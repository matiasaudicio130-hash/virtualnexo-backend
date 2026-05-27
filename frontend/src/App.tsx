import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useThemeStore } from "@/store/themeStore";

// Páginas públicas
import Landing     from "@/pages/Landing";
import Register    from "@/pages/Register";
import Login       from "@/pages/Login";
import VerifyEmail from "@/pages/VerifyEmail";
import AccessDenied from "@/pages/AccessDenied";
import Privacidad  from "@/pages/Privacidad";
import Terminos    from "@/pages/Terminos";

// Páginas de onboarding (autenticado, pero no activo aún)
import KYCVerification  from "@/pages/KYCVerification";
import PendingApproval  from "@/pages/PendingApproval";
import OnboardingWizard from "@/pages/OnboardingWizard";

// App principal
import Dashboard from "@/pages/Dashboard";

// Social
import Feed from "@/pages/Feed";
import Reviews from "@/pages/Reviews";
import TravelMode from "@/pages/TravelMode";
import Messages from "@/pages/Messages";
import ProfileView from "@/pages/ProfileView";
import Events      from "@/pages/Events";
import Explore     from "@/pages/Explore";

// Checkout
import Checkout from "@/pages/Checkout";
import CheckoutPay from "@/pages/CheckoutPay";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import CheckoutCancel from "@/pages/CheckoutCancel";

// Admin
import AdminPanel from "@/pages/admin/AdminPanel";

export default function App() {
  const theme = useThemeStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return (
    <Routes>
      {/* Públicas */}
      <Route path="/" element={<Landing />} />
      <Route path="/registro" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/verificar-email" element={<VerifyEmail />} />
      <Route path="/acceso-denegado" element={<AccessDenied />} />
      <Route path="/privacidad"     element={<Privacidad />} />
      <Route path="/terminos"       element={<Terminos />} />

      {/* KYC: autenticado con status pending_kyc */}
      <Route element={<ProtectedRoute allowedStatuses={["pending_kyc"]} redirectTo="/login" />}>
        <Route path="/kyc" element={<KYCVerification />} />
      </Route>

      {/* Aprobación pendiente: autenticado con status pending_manual */}
      <Route element={<ProtectedRoute allowedStatuses={["pending_manual"]} redirectTo="/login" />}>
        <Route path="/aprobacion-pendiente" element={<PendingApproval />} />
      </Route>

      {/* Dashboard: solo usuarios activos */}
      <Route element={<ProtectedRoute allowedStatuses={["active"]} />}>
        <Route path="/onboarding" element={<OnboardingWizard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/feed" element={<Feed />} />
        <Route path="/profile/:userId" element={<ProfileView />} />
        <Route path="/reviews/:userId" element={<Reviews />} />
        <Route path="/travel" element={<TravelMode />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/events"   element={<Events />} />
        <Route path="/explore"  element={<Explore />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/checkout/pay" element={<CheckoutPay />} />
        <Route path="/checkout/success" element={<CheckoutSuccess />} />
        <Route path="/checkout/cancel" element={<CheckoutCancel />} />
      </Route>

      {/* Admin: solo activos con rol admin */}
      <Route element={<ProtectedRoute allowedStatuses={["active"]} requiredRole="admin" redirectTo="/dashboard" />}>
        <Route path="/admin" element={<AdminPanel />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
