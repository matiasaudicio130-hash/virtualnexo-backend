import { useState } from "react";
import { X, Flag, Check } from "lucide-react";
import { moderationApi } from "@/lib/api";

const REASONS = [
  { id: "spam",                  label: "Spam o publicidad" },
  { id: "contenido_inapropiado", label: "Contenido inapropiado" },
  { id: "acoso",                 label: "Acoso o bullying" },
  { id: "perfil_falso",          label: "Perfil falso / suplantación" },
  { id: "menor_de_edad",         label: "Posible menor de edad" },
  { id: "violencia",             label: "Violencia o amenazas" },
  { id: "otro",                  label: "Otro" },
];

interface Props {
  targetType: "post" | "user";
  targetId:   string;
  targetName?: string;   // caption preview o nombre de usuario
  onClose:    () => void;
}

export function ReportModal({ targetType, targetId, targetName, onClose }: Props) {
  const [reason,  setReason]  = useState("");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);
  const [error,   setError]   = useState("");

  async function handleSubmit() {
    if (!reason) return;
    setLoading(true);
    setError("");
    try {
      await moderationApi.report({
        target_type: targetType,
        target_id:   targetId,
        reason,
        details:     details.trim(),
      });
      setDone(true);
    } catch (e: any) {
      const msg = e?.response?.data?.detail;
      setError(typeof msg === "string" ? msg : "No se pudo enviar el reporte. Intentá de nuevo.");
    }
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl animate-slide-up overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Flag size={16} className="text-status-error" />
            <span className="font-semibold text-sm">
              Reportar {targetType === "post" ? "publicación" : "usuario"}
            </span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {done ? (
          /* ── Confirmación ─────────────────────────────────────── */
          <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-status-success/15 flex items-center justify-center">
              <Check size={26} className="text-status-success" />
            </div>
            <div>
              <p className="font-semibold text-sm mb-1">Reporte enviado</p>
              <p className="text-xs text-text-muted leading-relaxed">
                Nuestro equipo de moderación lo revisará pronto.
                Gracias por ayudar a mantener la comunidad segura.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full text-sm font-medium border border-border hover:bg-bg-muted transition-colors"
            >
              Cerrar
            </button>
          </div>
        ) : (
          /* ── Formulario ───────────────────────────────────────── */
          <div className="px-5 py-4 space-y-4">
            {targetName && (
              <p className="text-xs text-text-muted bg-bg-muted rounded-xl px-3 py-2 line-clamp-2">
                {targetName}
              </p>
            )}

            {/* Razón */}
            <div className="space-y-1.5">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">¿Por qué reportás esto?</p>
              {REASONS.map(r => (
                <button
                  key={r.id}
                  onClick={() => setReason(r.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-left transition-all ${
                    reason === r.id
                      ? "border-status-error/60 bg-status-error/8 text-text-primary"
                      : "border-border text-text-muted hover:border-border/80 hover:bg-bg-muted"
                  }`}
                >
                  <span>{r.label}</span>
                  {reason === r.id && <div className="w-4 h-4 rounded-full bg-status-error flex items-center justify-center flex-shrink-0">
                    <Check size={9} className="text-white" />
                  </div>}
                </button>
              ))}
            </div>

            {/* Detalles opcionales */}
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">Detalles adicionales (opcional)</p>
              <textarea
                value={details}
                onChange={e => setDetails(e.target.value)}
                maxLength={500}
                rows={3}
                placeholder="Contános más sobre el problema…"
                className="w-full bg-bg-muted border border-border rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-status-error/30 placeholder-text-muted"
              />
            </div>

            {error && (
              <p className="text-xs text-status-error bg-status-error/10 rounded-xl px-3 py-2">{error}</p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!reason || loading}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: reason ? "var(--color-status-error, #ef4444)" : undefined,
                color: reason ? "#fff" : undefined,
                border: reason ? "none" : "1px solid var(--color-border)",
              }}
            >
              {loading ? "Enviando…" : "Enviar reporte"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
