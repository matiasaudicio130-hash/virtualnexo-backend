import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { APP_CONFIG } from "@/config/app";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Mail, CheckCircle, XCircle, Loader2 } from "lucide-react";

type State = "idle" | "verifying" | "success" | "error" | "sent";

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get("token");
  const sent = params.get("sent");
  const [state, setState] = useState<State>(sent ? "sent" : token ? "verifying" : "idle");
  const [nextStatus, setNextStatus] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!token) return;
    setState("verifying");
    authApi.verifyEmail(token)
      .then(({ data }) => {
        setNextStatus(data.detail ?? "");
        setState("success");
        setTimeout(() => {
          if (data.detail === "pending_kyc") navigate("/kyc");
          else if (data.detail === "pending_manual") navigate("/aprobacion-pendiente");
        }, 2500);
      })
      .catch((e) => {
        setErrorMsg(e.response?.data?.detail ?? "Token inválido o expirado");
        setState("error");
      });
  }, [token]);

  return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center px-4 py-12 animate-fade-in">
      <Link to="/" className="mb-8 brand-eyebrow">
        {APP_CONFIG.name}
      </Link>

      <Card glow className="w-full max-w-sm p-8 text-center">
        {state === "sent" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center mx-auto mb-6">
              <Mail size={32} className="text-accent-purple" />
            </div>
            <h1 className="brand-title" style={{ fontSize: "var(--fs-display-m)" }}>Revisá tu email</h1>
            <p className="text-text-secondary text-sm leading-relaxed mb-6">
              Te enviamos un link de verificación. Revisá tu bandeja de entrada y también la carpeta de spam.
            </p>
            <p className="text-text-muted text-xs">El link expira en 24 horas.</p>
          </>
        )}

        {state === "verifying" && (
          <>
            <Loader2 size={40} className="text-accent-purple mx-auto mb-6 animate-spin" />
            <h1 className="brand-title" style={{ fontSize: "var(--fs-display-m)" }}>Verificando...</h1>
          </>
        )}

        {state === "success" && (
          <>
            <CheckCircle size={48} className="text-status-success mx-auto mb-6" />
            <h1 className="brand-title" style={{ fontSize: "var(--fs-display-m)" }}>¡Email verificado!</h1>
            <p className="text-text-secondary text-sm">
              {nextStatus === "pending_kyc"
                ? "Ahora necesitás verificar tu identidad. Te redirigimos..."
                : "Tu cuenta está en revisión manual. Te redirigimos..."}
            </p>
          </>
        )}

        {state === "error" && (
          <>
            <XCircle size={48} className="text-status-error mx-auto mb-6" />
            <h1 className="brand-title" style={{ fontSize: "var(--fs-display-m)" }}>Link inválido</h1>
            <p className="text-text-secondary text-sm mb-6">{errorMsg}</p>
            <Link to="/login">
              <Button fullWidth>Ir al login</Button>
            </Link>
          </>
        )}
      </Card>
    </div>
  );
}
