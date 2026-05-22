import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { APP_CONFIG } from "@/config/app";
import { stripeApi, pricingApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatARS, formatUSD } from "@/hooks/useExchangeRate";
import type { PlanId, PaymentCurrency } from "@/types";

const PLAN_LABELS: Record<string, string> = {
  monthly: "Mensual",
  annual: "Anual",
  lifetime: "Vitalicio",
};

export default function Checkout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();

  const planParam  = (params.get("plan")  as PlanId)       || "monthly";
  const currParam  = (params.get("currency") as PaymentCurrency) || "ARS";

  const [plan,     setPlan]     = useState<PlanId>(planParam);
  const [currency, setCurrency] = useState<PaymentCurrency>(currParam);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const { data: pricing }  = useQuery({ queryKey: ["pricing-plans"], queryFn: () => pricingApi.plans().then(r => r.data) });
  const { data: stripeConf } = useQuery({ queryKey: ["stripe-config"], queryFn: () => stripeApi.config().then(r => r.data) });

  const selectedPlan = pricing?.plans?.find((p: any) => p.id === plan);
  const price = selectedPlan ? (currency === "ARS" ? selectedPlan.price_ars : selectedPlan.price_usd) : null;
  const isSimulation = stripeConf?.simulation_mode ?? true;

  if (!user) { navigate("/login"); return null; }

  async function handleCheckout() {
    setLoading(true);
    setError("");
    try {
      const { data } = await stripeApi.createCheckout(plan, currency);
      if (isSimulation) {
        // En simulación no hay URL de Stripe — vamos directo a la pantalla de pago simulado
        navigate(`/checkout/pay?session_id=${data.session_id}&plan=${plan}&currency=${currency}`);
      } else {
        window.location.href = data.url;
      }
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al iniciar el pago. Intentá de nuevo.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center p-4">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">{APP_CONFIG.name}</h1>
          <p className="text-text-muted text-sm mt-1">Elegí tu membresía</p>
        </div>

        {/* Selector de plan */}
        <div className="space-y-3 mb-6">
          {(pricing?.plans ?? []).map((p: any) => (
            <button
              key={p.id}
              onClick={() => setPlan(p.id)}
              className={`w-full p-4 rounded-2xl border text-left transition-all ${
                plan === p.id
                  ? "border-accent-purple bg-accent-purple/10 ring-1 ring-accent-purple"
                  : "border-border bg-bg-card hover:border-accent-purple/50"
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold">{p.label}</p>
                  {p.savings && (
                    <p className="text-status-success text-xs mt-0.5">
                      Ahorrás {p.savings.pct}% vs mensual
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">
                    {currency === "ARS" ? formatARS(p.price_ars) : formatUSD(p.price_usd)}
                  </p>
                  <p className="text-text-muted text-xs">
                    {currency === "ARS" ? `${formatUSD(p.price_usd)} USD` : `${formatARS(p.price_ars)} ARS`}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Selector de moneda */}
        <div className="flex gap-2 mb-6">
          {(["ARS", "USD"] as PaymentCurrency[]).map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                currency === c
                  ? "bg-accent-purple text-white border-accent-purple"
                  : "bg-bg-card border-border text-text-secondary hover:border-accent-purple/50"
              }`}
            >
              {c === "ARS" ? "Pagar en ARS" : "Pagar en USD"}
            </button>
          ))}
        </div>

        {/* Resumen */}
        {selectedPlan && price !== null && (
          <div className="bg-bg-card border border-border rounded-2xl p-4 mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">Plan seleccionado</span>
              <span className="font-medium">{PLAN_LABELS[plan]}</span>
            </div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-text-secondary">Moneda</span>
              <span className="font-medium">{currency}</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t border-border pt-3 mt-1">
              <span>Total</span>
              <span className="text-accent-purple">
                {currency === "ARS" ? formatARS(selectedPlan.price_ars) : formatUSD(selectedPlan.price_usd)}
              </span>
            </div>
            {pricing?.dolar_blue && (
              <p className="text-text-muted text-xs mt-2 text-right">
                Dólar blue: {formatARS(pricing.dolar_blue.sell)}
              </p>
            )}
          </div>
        )}

        {/* Badge simulación */}
        {isSimulation && (
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-4 text-yellow-400 text-xs">
            <span className="font-bold text-yellow-400">!</span>
            <span>Modo simulación — no se cobran pagos reales</span>
          </div>
        )}

        {error && <p className="text-status-error text-sm mb-4 text-center">{error}</p>}

        <button
          onClick={handleCheckout}
          disabled={loading || !selectedPlan}
          className="w-full py-4 rounded-2xl font-bold text-white bg-accent-purple hover:bg-accent-purple/90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
        >
          {loading ? (
            <span className="animate-spin">⟳</span>
          ) : isSimulation ? (
            "Simular pago →"
          ) : (
            "Pagar con Stripe →"
          )}
        </button>

        <button
          onClick={() => navigate(-1)}
          className="w-full mt-3 py-3 text-text-muted text-sm hover:text-text-primary transition-colors"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
