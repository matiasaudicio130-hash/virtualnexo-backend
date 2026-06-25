import { useState, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { APP_CONFIG } from "@/config/app";
import { Eye, EyeSlash, CaretDown, Key } from "@phosphor-icons/react";
import { authApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/brand/Logo";


const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .regex(/[A-Z]/, "Al menos una mayúscula")
    .regex(/\d/, "Al menos un número"),
  first_name: z.string().min(2, "Mínimo 2 caracteres"),
  last_name: z.string().min(2, "Mínimo 2 caracteres"),
  birth_date: z.string().refine((v) => {
    const d = new Date(v);
    const age = new Date().getFullYear() - d.getFullYear();
    return age >= 18;
  }, "Debés ser mayor de 18 años"),
  master_key: z.string().optional(),
  terms: z.literal(true, { errorMap: () => ({ message: "Debés aceptar los términos" }) }),
});

type FormData = z.infer<typeof schema>;

export default function Register() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [showMasterKey, setShowMasterKey] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const togglePwd = useCallback(() => setShowPwd(v => !v), []);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    try {
      await authApi.register({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        birth_date: data.birth_date,
        master_key: data.master_key || undefined,
      });
      navigate("/verificar-email?sent=true");
    } catch (e: any) {
      const detail: string = e.response?.data?.detail ?? "";
      const status: number = e.response?.status ?? 0;
      if (status === 409 || /email|ya.registrad|already/i.test(detail)) {
        setError("Este email ya tiene una cuenta. ¿Querés iniciar sesión?");
      } else if (status === 400 && /master.key|clave/i.test(detail)) {
        setError("La clave maestra es inválida o ya fue usada.");
      } else {
        setError(detail || "Error al registrarse. Intentá de nuevo.");
      }
    }
  };

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center pt-safe px-4 py-12 animate-fade-in"
      style={{ background: "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(28,20,8,0.95) 0%, var(--obsidian) 100%)" }}>
      <Link to="/" className="mb-8 flex items-center">
        <Logo variant="primary" size={80}
          style={{ filter: "drop-shadow(0 0 18px rgba(201,162,39,0.5))" }}/>
      </Link>

      <Card glow className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-text-primary mb-2">Crear cuenta</h1>
        <p className="text-text-secondary text-sm mb-8">
          Solo para mayores de 18 años · Se requiere verificación de identidad
        </p>

        {error && (
          <div className="mb-6 p-4 bg-status-error/10 border border-status-error/30 rounded-xl text-status-error text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nombre" placeholder="Juan" error={errors.first_name?.message} {...register("first_name")} />
            <Input label="Apellido" placeholder="García" error={errors.last_name?.message} {...register("last_name")} />
          </div>

          <Input
            label="Email"
            type="email"
            placeholder="tu@email.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register("email")}
          />

          <Input
            label="Contraseña"
            type={showPwd ? "text" : "password"}
            placeholder="Mín. 8 caracteres, 1 mayúscula, 1 número"
            autoComplete="new-password"
            error={errors.password?.message}
            icon={
              <button type="button" onClick={togglePwd} tabIndex={-1} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--mist)" }}>
                {showPwd ? <EyeSlash size={16} /> : <Eye size={16} />}
              </button>
            }
            {...register("password")}
          />

          <Input
            label="Fecha de nacimiento"
            type="date"
            error={errors.birth_date?.message}
            hint="Debés ser mayor de 18 años"
            {...register("birth_date")}
          />

          {/* Master Key (opcional, colapsable) */}
          <div>
            <button
              type="button"
              onClick={() => setShowMasterKey((v) => !v)}
              className="flex items-center gap-2 text-sm text-text-muted hover:text-accent-purple transition-colors"
            >
              <Key size={14} />
              ¿Tenés un código de acceso especial?
              <CaretDown size={14} className={`transition-transform ${showMasterKey ? "rotate-180" : ""}`} />
            </button>
            {showMasterKey && (
              <div className="mt-3">
                <Input
                  placeholder="XXXX-XXXX-XXXX"
                  hint="Código proporcionado por un influencer o socio"
                  error={errors.master_key?.message}
                  {...register("master_key")}
                />
              </div>
            )}
          </div>

          {/* Términos */}
          <div className="flex items-start gap-3 pt-2">
            <input
              type="checkbox"
              id="terms"
              className="mt-0.5 w-4 h-4 rounded border-border bg-bg-muted accent-accent-purple"
              {...register("terms")}
            />
            <label htmlFor="terms" className="text-sm text-text-secondary leading-snug">
              Soy mayor de 18 años y acepto los{" "}
              <Link to="/terminos" className="text-accent-purple hover:underline">términos y condiciones</Link>
              {" "}y la{" "}
              <Link to="/privacidad" className="text-accent-purple hover:underline">política de privacidad</Link>.
            </label>
          </div>
          {errors.terms && <p className="text-xs text-status-error -mt-2">{errors.terms.message}</p>}

          <Button type="submit" fullWidth size="lg" loading={isSubmitting} className="mt-2">
            Crear cuenta
          </Button>
        </form>

        <p className="text-center text-text-muted text-sm mt-6">
          ¿Ya tenés cuenta?{" "}
          <Link to="/login" className="text-accent-purple hover:underline font-medium">
            Ingresar
          </Link>
        </p>
      </Card>
    </div>
  );
}

