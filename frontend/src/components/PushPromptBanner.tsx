import { useState, useEffect } from "react";
import { Bell, X } from "@phosphor-icons/react";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const DISMISSED_KEY = "aura_push_dismissed";
const DISMISS_DAYS  = 7;   // volver a preguntar después de 7 días

function wasDismissedRecently(): boolean {
  const ts = localStorage.getItem(DISMISSED_KEY);
  if (!ts) return false;
  const age = Date.now() - parseInt(ts, 10);
  return age < DISMISS_DAYS * 86_400_000;
}

export function PushPromptBanner() {
  const { state, requestPermission } = usePushNotifications();
  const [visible,  setVisible]  = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [justDone, setJustDone] = useState(false);

  useEffect(() => {
    // Mostrar sólo si: el permiso no fue decidido aún, y no lo descartó recientemente
    if (state === "default" && !wasDismissedRecently()) {
      // Esperar 4 s después del login para no interrumpir el onboarding
      const t = setTimeout(() => setVisible(true), 4000);
      return () => clearTimeout(t);
    }
  }, [state]);

  if (!visible || state !== "default") return null;

  async function handleAllow() {
    setLoading(true);
    const ok = await requestPermission();
    setLoading(false);
    if (ok) {
      setJustDone(true);
      setTimeout(() => setVisible(false), 2500);
    } else {
      setVisible(false);
    }
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  }

  return (
    <div
      className="fixed bottom-[76px] left-3 right-3 z-40 animate-slide-up"
      style={{ maxWidth: 480, margin: "0 auto" }}
    >
      <div
        className="rounded-2xl border border-border shadow-2xl overflow-hidden"
        style={{ background: "rgba(14,12,9,0.97)", backdropFilter: "blur(16px)" }}
      >
        {justDone ? (
          <div className="flex items-center gap-3 px-4 py-4">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(201,162,39,0.15)" }}
            >
              <Bell size={18} style={{ color: "var(--gold,#C9A227)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold">¡Notificaciones activadas!</p>
              <p className="text-xs text-text-muted">Te avisaremos cuando recibas mensajes o likes.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 pt-4 pb-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: "rgba(201,162,39,0.12)", border: "1px solid rgba(201,162,39,0.25)" }}
            >
              <Bell size={17} style={{ color: "var(--gold,#C9A227)" }} />
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold leading-tight">
                Activar notificaciones
              </p>
              <p className="text-xs text-text-muted mt-0.5 leading-relaxed">
                Enterate al instante de mensajes, me gustas y seguidores nuevos.
              </p>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={handleAllow}
                  disabled={loading}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-60"
                  style={{ background: "var(--gold,#C9A227)", color: "#0a0a0f" }}
                >
                  {loading ? "Activando…" : "Activar"}
                </button>
                <button
                  onClick={handleDismiss}
                  className="px-4 py-2 rounded-xl text-xs text-text-muted border border-border hover:border-border/80 transition-colors"
                >
                  Ahora no
                </button>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0 -mt-0.5 p-1"
            >
              <X size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
