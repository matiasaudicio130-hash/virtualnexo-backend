/**
 * SecuritySettings — panel de seguridad en el Dashboard del usuario.
 * Includes: activar/desactivar 2FA + ver/revocar sesiones activas.
 */
import { useState, useEffect } from "react";
import { Shield, ShieldCheck, ShieldSlash, DeviceMobile, Trash, SignOut, Eye, EyeSlash, Copy, Check } from "@phosphor-icons/react";
import { twoFactorApi, sessionsApi } from "@/lib/api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

function timeAgo(d: string): string {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

// ── 2FA Section ─────────────────────────────────────────────────
function TwoFactorSection() {
  const [status, setStatus]           = useState<{ enabled: boolean; backup_codes_left: number } | null>(null);
  const [step, setStep]               = useState<"idle" | "setup" | "verify" | "disable">("idle");
  const [qrUrl, setQrUrl]             = useState("");
  const [secret, setSecret]           = useState("");
  const [code, setCode]               = useState("");
  const [password, setPassword]       = useState("");
  const [showSecret, setShowSecret]   = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [feedback, setFeedback]       = useState<{ msg: string; ok: boolean } | null>(null);

  const notify = (msg: string, ok = true) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 4000);
  };

  useEffect(() => {
    twoFactorApi.status().then(r => setStatus(r.data)).catch(() => {});
  }, []);

  async function startSetup() {
    setLoading(true);
    try {
      const { data } = await twoFactorApi.setup();
      setQrUrl(data.qr_url);
      setSecret(data.secret);
      setStep("setup");
    } catch (e: any) {
      notify(e.response?.data?.detail ?? "Error al iniciar configuración", false);
    }
    setLoading(false);
  }

  async function verifySetup() {
    if (code.length < 6) return;
    setLoading(true);
    try {
      const { data } = await twoFactorApi.verifySetup(code);
      setBackupCodes(data.backup_codes);
      setStep("idle");
      setStatus({ enabled: true, backup_codes_left: data.backup_codes.length });
      notify("2FA activado correctamente");
    } catch (e: any) {
      notify(e.response?.data?.detail ?? "Código incorrecto", false);
    }
    setLoading(false);
    setCode("");
  }

  async function disable2fa() {
    if (!code || !password) return;
    setLoading(true);
    try {
      await twoFactorApi.disable(code, password);
      setStatus({ enabled: false, backup_codes_left: 0 });
      setStep("idle");
      notify("2FA desactivado");
    } catch (e: any) {
      notify(e.response?.data?.detail ?? "Código o contraseña incorrectos", false);
    }
    setLoading(false);
    setCode(""); setPassword("");
  }

  function copyBackupCodes() {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          {status?.enabled
            ? <ShieldCheck size={16} className="text-status-success" />
            : <ShieldSlash size={16} className="text-text-muted" />}
          <h3 className="font-semibold text-sm">Verificación en dos pasos (2FA)</h3>
        </div>
        {status && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${status.enabled ? "bg-status-success/20 text-status-success" : "bg-bg-muted text-text-muted"}`}>
            {status.enabled ? "Activo" : "Inactivo"}
          </span>
        )}
      </div>

      <div className="p-4 space-y-4">
        {feedback && (
          <div className={`p-3 rounded-xl text-xs border ${feedback.ok ? "bg-status-success/10 border-status-success/30 text-status-success" : "bg-status-error/10 border-status-error/30 text-status-error"}`}>
            {feedback.msg}
          </div>
        )}

        {/* Backup codes (después de activar) */}
        {backupCodes.length > 0 && step === "idle" && (
          <div className="p-3 bg-status-warning/10 border border-status-warning/30 rounded-xl space-y-2">
            <p className="text-xs font-semibold text-status-warning">Guardá estos códigos de respaldo ahora</p>
            <p className="text-xs text-text-muted">Úsalos si perdés acceso a tu app autenticadora. Solo se muestran una vez.</p>
            <div className="grid grid-cols-2 gap-1 mt-2">
              {backupCodes.map((c, i) => (
                <code key={i} className="text-xs font-mono bg-bg-muted rounded px-2 py-1 text-text-primary">{c}</code>
              ))}
            </div>
            <button onClick={copyBackupCodes} className="flex items-center gap-1.5 text-xs text-accent-purple hover:opacity-80 mt-1">
              {copied ? <><Check size={11}/> Copiado</> : <><Copy size={11}/> Copiar todos</>}
            </button>
          </div>
        )}

        {/* Estado idle */}
        {step === "idle" && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">
              {status?.enabled
                ? `Tenés ${status.backup_codes_left} código${status.backup_codes_left !== 1 ? "s" : ""} de respaldo restante${status.backup_codes_left !== 1 ? "s" : ""}.`
                : "Protegé tu cuenta con Google Authenticator u otra app TOTP."}
            </p>
            {status?.enabled ? (
              <button
                onClick={() => setStep("disable")}
                className="text-xs text-status-error hover:underline"
              >
                Desactivar 2FA
              </button>
            ) : (
              <Button size="sm" loading={loading} onClick={startSetup}>
                <Shield size={13}/> Activar 2FA
              </Button>
            )}
          </div>
        )}

        {/* Setup: mostrar QR */}
        {step === "setup" && (
          <div className="space-y-4">
            <p className="text-xs text-text-muted">
              Escaneá el QR con Google Authenticator, Authy u otra app TOTP:
            </p>
            {qrUrl && (
              <img src={qrUrl} alt="QR 2FA" className="w-44 h-44 mx-auto rounded-xl border border-border bg-white p-2" />
            )}
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono bg-bg-muted rounded px-2 py-1.5 flex-1 break-all">
                {showSecret ? secret : "••••••••••••••••••••••••••••••"}
              </code>
              <button onClick={() => setShowSecret(v => !v)} className="p-1.5 text-text-muted">
                {showSecret ? <EyeSlash size={14}/> : <Eye size={14}/>}
              </button>
            </div>
            <p className="text-xs text-text-muted">Luego ingresá el código de 6 dígitos para confirmar:</p>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              onKeyDown={e => e.key === "Enter" && verifySetup()}
              placeholder="000000"
              inputMode="numeric"
              maxLength={6}
              className="w-full text-center text-xl tracking-[.4em] py-2.5 bg-bg-muted border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" loading={loading} disabled={code.length < 6} onClick={verifySetup} className="flex-1">
                Confirmar
              </Button>
              <button onClick={() => { setStep("idle"); setCode(""); }} className="text-xs text-text-muted hover:text-text-primary px-3">
                Cancelar
              </button>
            </div>
          </div>
        )}

        {/* Disable */}
        {step === "disable" && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted">Ingresá tu código TOTP actual y tu contraseña para desactivar:</p>
            <input
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="Código TOTP (6 dígitos)"
              inputMode="numeric"
              maxLength={6}
              className="w-full text-center text-xl tracking-[.4em] py-2.5 bg-bg-muted border border-border rounded-xl text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
            />
            <Input label="Contraseña" type="password" value={password} onChange={e => setPassword(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" loading={loading} disabled={code.length < 6 || !password}
                onClick={disable2fa}
                className="flex-1 bg-status-error hover:bg-status-error/90 border-status-error">
                Desactivar
              </Button>
              <button onClick={() => { setStep("idle"); setCode(""); setPassword(""); }}
                className="text-xs text-text-muted hover:text-text-primary px-3">
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

// ── Sessions Section ─────────────────────────────────────────────
function SessionsSection() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState("");

  const load = () => sessionsApi.list().then(r => setSessions(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  async function revoke(id: string) {
    await sessionsApi.revoke(id);
    setSessions(prev => prev.filter(s => s.id !== id));
  }

  async function revokeAll() {
    if (!confirm("¿Cerrar todas las sesiones excepto la actual?")) return;
    setLoading(true);
    try {
      await sessionsApi.revokeAll();
      setFeedback("Sesiones revocadas");
      load();
      setTimeout(() => setFeedback(""), 3000);
    } catch {}
    setLoading(false);
  }

  return (
    <Card className="overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DeviceMobile size={15} className="text-text-muted" />
          <h3 className="font-semibold text-sm">Sesiones activas</h3>
        </div>
        {sessions.length > 1 && (
          <button onClick={revokeAll} disabled={loading}
            className="text-xs text-status-error hover:underline flex items-center gap-1">
            <SignOut size={11}/> Cerrar otras
          </button>
        )}
      </div>

      {feedback && (
        <div className="mx-4 mt-3 p-2 rounded-lg bg-status-success/10 border border-status-success/30 text-status-success text-xs">
          {feedback}
        </div>
      )}

      <div className="divide-y divide-border">
        {sessions.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-6">Sin sesiones activas</p>
        ) : sessions.map((s, i) => (
          <div key={s.id} className="flex items-center gap-3 px-4 py-3">
            <DeviceMobile size={16} className={`flex-shrink-0 ${i === 0 ? "text-accent-purple" : "text-text-muted"}`} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {s.device_name}
                {i === 0 && <span className="ml-2 text-[10px] text-accent-purple bg-accent-purple/10 px-1.5 py-0.5 rounded-full">Esta sesión</span>}
              </p>
              <p className="text-xs text-text-muted">
                {s.ip_address || "IP desconocida"} · {s.last_used_at ? timeAgo(s.last_used_at) : "—"}
              </p>
            </div>
            {i > 0 && (
              <button onClick={() => revoke(s.id)} className="p-1.5 text-text-muted hover:text-status-error transition-colors flex-shrink-0">
                <Trash size={14}/>
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Export principal ─────────────────────────────────────────────
export function SecuritySettings() {
  return (
    <div className="space-y-4">
      <TwoFactorSection />
      <SessionsSection />
    </div>
  );
}
