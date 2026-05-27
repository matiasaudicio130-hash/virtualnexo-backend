import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { APP_CONFIG } from "@/config/app";
import { kycApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { Logo } from "@/components/brand/Logo";
import { Shield, Loader2, CheckCircle, RefreshCw } from "lucide-react";

type KYCState = "loading" | "ready" | "pending" | "verified" | "rejected" | "error";

export default function KYCVerification() {
  const navigate = useNavigate();
  const { user, updateStatus } = useAuthStore();
  const [state, setState] = useState<KYCState>("loading");
  const [widgetUrl, setWidgetUrl] = useState("");
  const [flowId, setFlowId] = useState("");
  const [isSimMode, setIsSimMode] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (user?.status !== "pending_kyc") {
      navigate("/dashboard");
      return;
    }
    startKYC();
    return () => clearInterval(pollingRef.current);
  }, []);

  async function startKYC() {
    setState("loading");
    try {
      const { data } = await kycApi.start();
      setFlowId(data.flow_id);
      setWidgetUrl(data.widget_url);
      // Detectar modo simulación por la URL
      setIsSimMode(data.widget_url.includes("simulate"));
      setState("ready");
      startPolling();
    } catch (e: any) {
      setState("error");
    }
  }

  function startPolling() {
    pollingRef.current = setInterval(async () => {
      try {
        const { data } = await kycApi.status();
        if (data.status === "verified") {
          clearInterval(pollingRef.current);
          setState("verified");
          updateStatus("active");
          setTimeout(() => navigate("/onboarding"), 2500);
        } else if (data.status === "rejected" || data.status === "expired") {
          clearInterval(pollingRef.current);
          setState("rejected");
          updateStatus("rejected");
        }
      } catch {}
    }, 3000);
  }

  async function simulateAction(action: "approve" | "reject") {
    try {
      await kycApi.simulate(action);
    } catch {}
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
      <div className="mb-6 flex flex-col items-center gap-3">
        <Logo variant="primary" size={72}
          style={{ filter: "drop-shadow(0 0 20px rgba(201,162,39,0.5))" }}/>
      </div>

      <Card glow className="w-full max-w-md p-8">
        {state === "loading" && (
          <div className="text-center">
            <Loader2 size={40} className="text-accent-purple mx-auto mb-4 animate-spin" />
            <h1 className="text-xl font-bold">Iniciando verificación...</h1>
          </div>
        )}

        {state === "ready" && (
          <>
            <div className="mb-6 text-center flex flex-col items-center gap-3">
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-eyebrow)", letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--gold)", fontWeight: 500 }}>
                Verificación de identidad
              </p>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-m)", fontWeight: 400, fontStyle: "italic", color: "var(--paper)", lineHeight: 1.1 }}>
                Antes de entrar, queremos<br/>saber quién sos.
              </h1>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--mist)" }}>
                Es la única vez que vas a tener que hacerlo.
              </p>
            </div>

            <div className="bg-bg-muted border border-border rounded-xl p-4 mb-6 space-y-2">
              {["Tené tu DNI a mano", "Asegurate de tener buena iluminación", "Seguí las instrucciones en pantalla"].map((tip) => (
                <div key={tip} className="flex items-center gap-2 text-sm text-text-secondary">
                  <div className="w-1.5 h-1.5 rounded-full bg-accent-purple flex-shrink-0" />
                  {tip}
                </div>
              ))}
            </div>

            {isSimMode ? (
              <div className="space-y-3">
                <div className="bg-status-warning/10 border border-status-warning/30 rounded-xl p-4 text-sm text-status-warning mb-4">
                  Modo simulación activo (desarrollo)
                </div>
                <Button fullWidth onClick={() => simulateAction("approve")} size="lg">
                  Simular APROBACIÓN
                </Button>
                <Button fullWidth variant="danger" onClick={() => simulateAction("reject")}>
                  Simular RECHAZO
                </Button>
                <p className="text-xs text-text-muted text-center">
                  Esperando respuesta del servidor... (polling activo)
                </p>
              </div>
            ) : (
              <a href={widgetUrl} target="_blank" rel="noopener noreferrer">
                <Button fullWidth size="lg">
                  Iniciar verificación con MetaMap
                </Button>
              </a>
            )}

            <p className="text-xs text-text-muted text-center mt-4">
              Esta página se actualiza automáticamente cuando MetaMap nos notifica el resultado.
            </p>
          </>
        )}

        {state === "verified" && (
          <div className="text-center flex flex-col items-center gap-4">
            <CheckCircle size={40} style={{ color: "var(--gold)" }} />
            <VerifiedBadge label="Identidad verificada" />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-m)", fontWeight: 400, fontStyle: "italic", color: "var(--paper)" }}>
              Listo.
            </h1>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--mist)" }}>
              Tu identidad está verificada. Verificá una vez. Confiá para siempre.
            </p>
          </div>
        )}

        {state === "rejected" && (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-status-error/10 flex items-center justify-center mx-auto mb-4">
              <Shield size={32} className="text-status-error" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Verificación no exitosa</h1>
            <p className="text-text-secondary text-sm mb-6">
              No pudimos verificar tu identidad. Contactá soporte si creés que es un error.
            </p>
            <Button variant="secondary" fullWidth onClick={startKYC}>
              <RefreshCw size={16} />
              Intentar de nuevo
            </Button>
          </div>
        )}

        {state === "error" && (
          <div className="text-center">
            <p className="text-status-error mb-4">Error al iniciar la verificación</p>
            <Button onClick={startKYC}>Reintentar</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
