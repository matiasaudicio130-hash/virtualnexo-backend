import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/Input";
import { ShieldCheck } from "lucide-react";
import type { UserStatus } from "@/types";

const schema = z.object({
  email: z.string().email("Email invalido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});
type FormData = z.infer<typeof schema>;

const REDIRECT: Record<UserStatus, string> = {
  pending_email: "/verificar-email",
  pending_kyc: "/kyc",
  pending_manual: "/aprobacion-pendiente",
  active: "/feed",
  suspended: "/acceso-denegado",
  rejected: "/acceso-denegado",
};

const gold = "linear-gradient(135deg,#C9A227 0%,#FFE566 100%)";

export default function Login() {
  const navigate = useNavigate();
  const { login, verifyTotpLogin } = useAuth();
  const [error, setError] = useState("");
  const [totpState, setTotpState] = useState<{ session: string } | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [totpLoading, setTotpLoading] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      const result = await login(data.email, data.password);
      if (result.requires2fa) {
        setTotpState({ session: result.totpSession });
        return;
      }
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
    <div className="min-h-dvh flex flex-col items-center justify-center px-4 py-12 animate-fade-in"
      style={{ background: "radial-gradient(ellipse 80% 70% at 50% 30%, #1a1205 0%, #04040a 100%)" }}>

      {/* Logo */}
      <Link to="/" className="mb-10 flex flex-col items-center gap-3">
        <img
          src="/brand/logo-full-dark.jpg"
          alt="AURA"
          draggable={false}
          style={{ width: 140, height: 140, objectFit: "contain",
                   mixBlendMode: "screen", filter: "drop-shadow(0 0 16px rgba(201,162,39,0.5))" }}
        />
      </Link>

      {/* Card */}
      <div className="w-full max-w-sm"
        style={{ background: "rgba(8,8,16,0.9)", border: "1px solid rgba(201,162,39,0.18)",
                 borderRadius: 4, padding: "40px 32px" }}>

        <h1 className="text-xl font-light tracking-[.1em] text-white/90 mb-1">Ingresar</h1>
        <p className="text-sm text-stone-500 font-light mb-8 tracking-wide">Bienvenido de vuelta</p>

        {error && (
          <div className="mb-6 p-3 bg-red-900/20 border border-red-800/40 rounded text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* ── Paso 2FA ── */}
        {totpState ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center gap-2 py-2">
              <ShieldCheck size={32} className="text-amber-500/80" />
              <p className="text-white/80 text-sm font-light tracking-wide text-center">
                Verificación en dos pasos
              </p>
              <p className="text-stone-500 text-xs text-center">
                Ingresá el código de 6 dígitos de tu app autenticadora
              </p>
            </div>
            <input
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && handleTotpVerify()}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="w-full text-center text-2xl tracking-[.5em] py-3 bg-transparent border border-stone-700/60 rounded text-white/90 focus:outline-none focus:border-amber-600/50 placeholder-stone-700"
              autoFocus
            />
            <button
              onClick={handleTotpVerify}
              disabled={totpLoading || totpCode.length < 6}
              className="w-full py-3.5 text-[11px] tracking-[.22em] font-light text-black rounded transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50 uppercase"
              style={{ background: gold }}
            >
              {totpLoading ? "Verificando..." : "Verificar"}
            </button>
            <button
              onClick={() => { setTotpState(null); setTotpCode(""); setError(""); }}
              className="w-full text-xs text-stone-600 hover:text-stone-400 transition-colors"
            >
              Volver al login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input label="Email" type="email" placeholder="tu@email.com"
              autoComplete="email" error={errors.email?.message} {...register("email")} />
            <Input label="Contraseña" type="password" placeholder="••••••••"
              autoComplete="current-password" error={errors.password?.message} {...register("password")} />

            <button type="submit" disabled={isSubmitting}
              className="w-full py-3.5 text-[11px] tracking-[.22em] font-light text-black rounded mt-2 transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-50 uppercase"
              style={{ background: gold }}>
              {isSubmitting ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        )}

        <p className="text-center text-stone-600 text-xs mt-7 tracking-wide">
          No tenes cuenta?{" "}
          <Link to="/registro" className="text-amber-600 hover:text-amber-400 transition-colors">
            Registrarse
          </Link>
        </p>
      </div>

      {/* Footer */}
      <p className="mt-8 text-[10px] tracking-[.3em] text-stone-800 uppercase">
        Solo mayores de 18 anos · Argentina
      </p>
    </div>
  );
}
