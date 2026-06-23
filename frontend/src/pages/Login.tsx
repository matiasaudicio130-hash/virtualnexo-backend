/**
 * Login — brand book layout mobile.
 * Logo como decoración, no hay ilustración.
 * Inputs underline-only. Botón pill dorado.
 * Tipografía: Cormorant para el saludo, Manrope para el cuerpo.
 */
import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShieldCheck } from "lucide-react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/brand/Logo";
import type { UserStatus } from "@/types";

const schema = z.object({
  email:    z.string().email("Email inválido"),
  password: z.string().min(1, "Ingresá tu contraseña"),
});
type FormData = z.infer<typeof schema>;

const REDIRECT: Record<UserStatus, string> = {
  pending_email:  "/verificar-email",
  pending_kyc:    "/kyc",
  pending_manual: "/aprobacion-pendiente",
  active:         "/feed",
  suspended:      "/acceso-denegado",
  rejected:       "/acceso-denegado",
};

export default function Login() {
  const navigate = useNavigate();
  const { login, verifyTotpLogin } = useAuth();
  const [error, setError]         = useState("");
  const [totpState, setTotpState] = useState<{ session: string } | null>(null);
  const [showPwd, setShowPwd]     = useState(false);
  const togglePwd = useCallback(() => setShowPwd(v => !v), []);
  const [totpCode, setTotpCode]   = useState("");
  const [totpLoading, setTotpLoading] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      const result = await login(data.email, data.password);
      if (result.requires2fa) { setTotpState({ session: result.totpSession }); return; }
      navigate(REDIRECT[result.status] ?? "/feed");
    } catch (e: any) {
      const msg = e.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Credenciales incorrectas");
    }
  };

  async function handleTotpVerify() {
    if (!totpState || !totpCode.trim()) return;
    setTotpLoading(true); setError("");
    try {
      const status = await verifyTotpLogin(totpState.session, totpCode.trim());
      navigate(REDIRECT[status] ?? "/feed");
    } catch (e: any) {
      const msg = e.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "Código incorrecto");
    }
    setTotpLoading(false);
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 py-16 animate-fade-in"
      style={{ background: "var(--obsidian)" }}>

      {/* Logo — es la decoración, como dice el brand book */}
      <Link to="/" className="mb-8 flex items-center justify-center">
        <Logo variant="primary" size={96}
          style={{ filter: "drop-shadow(0 0 28px rgba(201,162,39,0.55)) drop-shadow(0 0 56px rgba(201,162,39,0.20))" }}/>
      </Link>

      {/* Eyebrow */}
      <p style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-eyebrow)", letterSpacing: "var(--tracking-eyebrow)", textTransform: "uppercase", color: "var(--gold)", fontWeight: 500, marginBottom: 12 }}>
        Acceso verificado
      </p>

      {/* Heading */}
      {!totpState && (
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-m)", fontWeight: 400, fontStyle: "italic", color: "var(--paper)", marginBottom: 40, textAlign: "center", lineHeight: 1.1 }}>
          Volviste.
        </h1>
      )}

      {/* Form container — sin card, directo sobre obsidian */}
      <div style={{ width: "100%", maxWidth: 360 }}>

        {error && (
          <div style={{ marginBottom: 20, padding: "10px 14px", border: "1px solid rgba(194,90,90,0.35)", borderRadius: "var(--radius-md)", background: "rgba(194,90,90,0.06)", color: "var(--danger)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.08em" }}>
            {error}
          </div>
        )}

        {/* ── 2FA step ── */}
        {totpState ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ textAlign: "center" }}>
              <ShieldCheck size={28} style={{ color: "var(--gold-bright)", margin: "0 auto 12px" }}/>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-m)", fontStyle: "italic", fontWeight: 400, color: "var(--paper)", marginBottom: 8 }}>
                Verificación<br/>en dos pasos.
              </h2>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--mist)" }}>
                Código de 6 dígitos de tu app autenticadora
              </p>
            </div>
            <input
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && handleTotpVerify()}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              autoFocus
              style={{
                textAlign: "center", fontSize: 28, letterSpacing: "0.5em", padding: "12px 0",
                background: "transparent", border: "none", borderBottom: "1px solid var(--ash)",
                color: "var(--paper)", fontFamily: "var(--font-mono)", outline: "none", width: "100%",
              }}
            />
            <Button onClick={handleTotpVerify} loading={totpLoading} disabled={totpCode.length < 6} fullWidth>
              Verificar
            </Button>
            <button onClick={() => { setTotpState(null); setTotpCode(""); setError(""); }}
              style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", color: "var(--mist)", background: "none", border: "none", cursor: "pointer", textTransform: "uppercase" }}>
              Volver al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} style={{ display: "flex", flexDirection: "column", gap: 28 }}>
            <Input
              id="email"
              label="Email"
              type="email"
              autoComplete="email"
              error={errors.email?.message}
              {...register("email")}
            />
            <Input
              id="password"
              label="Contraseña"
              type={showPwd ? "text" : "password"}
              autoComplete="current-password"
              error={errors.password?.message}
              icon={
                <button type="button" onClick={togglePwd} tabIndex={-1} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--mist)" }}>
                  {showPwd ? <EyeSlash size={16} /> : <Eye size={16} />}
                </button>
              }
              {...register("password")}
            />
            <div style={{ textAlign: "right", marginTop: -4 }}>
              <Link to="/forgot-password" style={{ fontSize: 12, color: "rgba(201,162,39,0.65)" }}>
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
            <Button type="submit" loading={isSubmitting} fullWidth style={{ marginTop: 8 }}>
              Entrar
            </Button>
          </form>
        )}

        {/* Footer link */}
        <p style={{ textAlign: "center", marginTop: 28, fontFamily: "var(--font-sans)", fontSize: "var(--fs-body)", color: "var(--mist)" }}>
          ¿Primera vez?{" "}
          <Link to="/registro" style={{ color: "var(--gold-bright)" }}>
            Pedí tu invitación
          </Link>
        </p>
      </div>

      {/* Legal */}
      <p style={{ marginTop: 40, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.3em", color: "var(--fg-dim)", textTransform: "uppercase" }}>
        Solo mayores de 18 años · Argentina
      </p>
    </div>
  );
}
