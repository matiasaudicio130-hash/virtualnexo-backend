import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { APP_CONFIG } from "@/config/app";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { refreshUser } = useAuthStore();

  useEffect(() => {
    // El webhook de Stripe puede tardar unos segundos en procesar.
    // Refrescamos inmediatamente y de nuevo a los 3s para capturar el estado final.
    refreshUser?.();
    const t = setTimeout(() => refreshUser?.(), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="w-20 h-20 bg-status-success/15 rounded-full flex items-center justify-center mx-auto border border-status-success/25">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>

        <div>
          <h1 className="text-2xl font-bold mb-2">Pago recibido</h1>
          <p className="text-text-secondary">
            Tu membresía en <span className="text-accent-purple font-semibold">{APP_CONFIG.name}</span> está activa.
          </p>
          {params.get("session_id") && (
            <p className="text-text-muted text-xs mt-2">
              Ref: {params.get("session_id")?.slice(0, 20)}…
            </p>
          )}
        </div>

        <div className="bg-bg-card border border-status-success/20 rounded-2xl p-4 text-sm text-text-secondary">
          Vas a recibir un email de confirmación. Podés acceder a todas las funciones desde ahora.
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="w-full py-4 rounded-2xl font-bold text-white bg-accent-purple hover:bg-accent-purple/90 transition-all"
        >
          Ir a mi perfil →
        </button>
      </div>
    </div>
  );
}
