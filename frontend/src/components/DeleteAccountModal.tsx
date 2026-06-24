import { useState } from "react";
import { X, Warning } from "@phosphor-icons/react";

interface Props {
  onConfirm: () => Promise<void>;
  onCancel:  () => void;
}

export function DeleteAccountModal({ onConfirm, onCancel }: Props) {
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const CONFIRM_WORD = "ELIMINAR";

  async function handleConfirm() {
    if (input !== CONFIRM_WORD || loading) return;
    setLoading(true);
    await onConfirm();
    setLoading(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        className="w-full sm:max-w-sm bg-bg-card border border-status-error/30 rounded-t-3xl sm:rounded-2xl p-6 animate-slide-up space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-status-error/15 flex items-center justify-center flex-shrink-0">
              <Warning size={20} className="text-status-error" />
            </div>
            <div>
              <p className="font-semibold text-sm text-status-error">Eliminar cuenta permanentemente</p>
              <p className="text-[10px] text-text-muted mt-0.5">Esta acción no se puede deshacer</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-text-muted hover:text-text-primary flex-shrink-0 p-1">
            <X size={18} />
          </button>
        </div>

        {/* Warning list */}
        <div className="rounded-xl border border-status-error/25 bg-status-error/8 p-4 space-y-2">
          <p className="text-xs font-semibold text-status-error mb-2">Se eliminará permanentemente:</p>
          {[
            "Tu perfil y todos tus datos personales",
            "Todas tus publicaciones y stories",
            "Todos tus comentarios",
            "Tu historial de mensajes",
            "Tu membresía activa (sin reembolso)",
          ].map(item => (
            <div key={item} className="flex items-start gap-2">
              <span className="text-status-error text-sm flex-shrink-0 mt-0.5">·</span>
              <span className="text-xs text-text-secondary">{item}</span>
            </div>
          ))}
        </div>

        {/* Confirmation input */}
        <div className="space-y-2">
          <p className="text-xs text-text-muted">
            Escribí <strong className="text-text-primary font-mono">{CONFIRM_WORD}</strong> para confirmar:
          </p>
          <input
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            placeholder={CONFIRM_WORD}
            className="w-full bg-bg-muted border border-border rounded-xl px-4 py-3 text-sm font-mono tracking-widest focus:outline-none focus:border-status-error/50 transition-colors text-center uppercase"
            style={{ fontSize: "16px", letterSpacing: "0.2em" }}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-border text-sm text-text-muted hover:bg-bg-muted transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={input !== CONFIRM_WORD || loading}
            className="flex-1 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: input === CONFIRM_WORD ? "var(--color-status-error, #ef4444)" : undefined,
              color:      input === CONFIRM_WORD ? "#fff" : undefined,
              border:     input !== CONFIRM_WORD ? "1px solid var(--color-border)" : "none",
            }}
          >
            {loading ? "Eliminando…" : "Eliminar mi cuenta"}
          </button>
        </div>
      </div>
    </div>
  );
}
