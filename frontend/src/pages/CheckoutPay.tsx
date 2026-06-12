/**
 * Pantalla intermedia de pago simulado.
 * Solo se muestra cuando STRIPE_SECRET_KEY está vacío (modo simulación).
 * En producción esta ruta no existe — Stripe redirige directamente a /checkout/success.
 */
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { stripeApi } from "@/lib/api";
import { toast } from "@/store/toastStore";
import { APP_CONFIG } from "@/config/app";

const PLAN_LABELS: Record<string, string> = {
  monthly: "Mensual", annual: "Anual", lifetime: "Vitalicio",
};

export default function CheckoutPay() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id") ?? "";
  const plan      = params.get("plan") ?? "monthly";
  const currency  = params.get("currency") ?? "ARS";

  const [loading, setLoading] = useState(false);
  const [step, setStep]       = useState<"idle" | "processing" | "done">("idle");

  async function confirmPayment() {
    setLoading(true);
    setStep("processing");
    // Simulamos demora de procesamiento
    await new Promise((r) => setTimeout(r, 1800));
    try {
      await stripeApi.simulateSuccess(sessionId);
      setStep("done");
      setTimeout(() => navigate("/checkout/success"), 800);
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? "Error al procesar pago");
      setStep("idle");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">

        {step === "idle" && (
          <>
            {/* Encabezado estilo Stripe */}
            <div className="mb-8">
              <div className="w-16 h-16 bg-accent-purple/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-accent-purple"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <p className="text-text-muted text-xs uppercase tracking-widest mb-1">Modo simulación</p>
              <h2 className="text-xl font-bold">{APP_CONFIG.name}</h2>
              <p className="text-text-secondary text-sm mt-1">
                Plan {PLAN_LABELS[plan]} · {currency}
              </p>
            </div>

            <div className="bg-bg-card border border-border rounded-2xl p-5 mb-6 text-left space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Tarjeta (simulada)</span>
                <span className="font-mono">•••• •••• •••• 4242</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">Expiración</span>
                <span className="font-mono">12/30</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">CVV</span>
                <span className="font-mono">•••</span>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mb-6 text-yellow-400 text-xs text-left">
              Este pago es simulado. No se procesará ningún cargo real.
            </div>

            <button
              onClick={confirmPayment}
              className="w-full py-4 rounded-2xl font-bold text-white bg-accent-purple hover:bg-accent-purple/90 transition-all"
            >
              Confirmar pago (simulación)
            </button>
            <button
              onClick={() => navigate(-1)}
              className="w-full mt-3 py-3 text-text-muted text-sm hover:text-text-primary transition-colors"
            >
              Cancelar
            </button>
          </>
        )}

        {step === "processing" && (
          <div className="space-y-4">
            <div className="w-16 h-16 border-4 border-accent-purple border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-secondary">Procesando pago…</p>
          </div>
        )}

        {step === "done" && (
          <div className="space-y-4">
            <div className="w-16 h-16 bg-status-success/15 rounded-full flex items-center justify-center mx-auto border border-status-success/25">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <p className="font-bold text-status-success">Pago confirmado</p>
          </div>
        )}
      </div>
    </div>
  );
}
