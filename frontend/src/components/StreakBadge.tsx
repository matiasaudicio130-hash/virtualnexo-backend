import { useState, useEffect, useRef } from "react";
import { Flame, X } from "@phosphor-icons/react";
import { authApi } from "@/lib/api";

const SESSION_KEY = "streak_heartbeat_done";

interface StreakData {
  streak: number;
  longest: number;
  is_new_day?: boolean;
}

interface Props {
  initialStreak?: number;
  showToast?: boolean;
}

export function StreakBadge({ initialStreak = 0, showToast = true }: Props) {
  const [streak, setStreak]     = useState(initialStreak);
  const [toast, setToast]       = useState(false);
  const [isNewDay, setIsNewDay] = useState(false);
  const [explain, setExplain]   = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    // Solo disparar una vez por sesión de navegador
    if (fired.current) return;
    if (sessionStorage.getItem(SESSION_KEY)) {
      return;
    }
    fired.current = true;

    authApi.heartbeat()
      .then(r => {
        const data: StreakData = r.data;
        setStreak(data.streak);
        if (data.is_new_day && data.streak > 1 && showToast) {
          setIsNewDay(true);
          setToast(true);
          setTimeout(() => setToast(false), 3500);
        }
        sessionStorage.setItem(SESSION_KEY, "1");
      })
      .catch(() => {});
  }, [showToast]);

  if (streak < 1) return null;

  return (
    <>
      {/* Badge inline — tappable para ver explicación */}
      <div className="relative">
        <button
          onClick={() => setExplain(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-bg-muted border transition-colors hover:border-[rgba(201,162,39,0.6)]"
          style={{ borderColor: "rgba(201,162,39,0.3)" }}
          aria-label={`Racha de ${streak} día${streak !== 1 ? "s" : ""} seguidos`}
        >
          <Flame size={13} weight="fill" style={{ color: "#C9A227" }} />
          <span className="text-xs font-semibold tabular-nums" style={{ color: "#C9A227", fontFamily: "var(--font-mono, monospace)" }}>{streak}</span>
          <span className="text-[10px] text-text-muted">racha</span>
        </button>

        {/* Popover de explicación */}
        {explain && (
          <div
            className="absolute right-0 top-full mt-2 z-50 w-52 bg-bg-card border border-border rounded-xl shadow-lg p-3 animate-slide-up"
            onClick={() => setExplain(false)}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <Flame size={14} weight="fill" style={{ color: "#C9A227" }} />
                <p className="text-xs font-semibold">{streak} día{streak !== 1 ? "s" : ""} seguidos</p>
              </div>
              <X size={12} className="text-text-muted mt-0.5 flex-shrink-0" />
            </div>
            <p className="text-[11px] text-text-muted leading-relaxed">
              Tu racha aumenta cada día que abrís Aura. Si no entrás un día la perdés.
            </p>
          </div>
        )}
      </div>

      {/* Toast de racha nueva */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-3 bg-bg-card border border-accent-purple/30 rounded-2xl shadow-lg">
            <Flame size={24} weight="fill" style={{ color: "#C9A227" }} />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                ¡{streak} días seguidos!
              </p>
              <p className="text-xs text-text-muted">Seguí así para no perder tu racha</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
