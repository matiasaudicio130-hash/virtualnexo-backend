/**
 * StreakBadge — muestra la racha diaria del usuario.
 * Se llama desde Feed y Dashboard. Dispara el heartbeat automáticamente una vez por sesión.
 */
import { useState, useEffect, useRef } from "react";
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
  const [streak, setStreak]   = useState(initialStreak);
  const [toast, setToast]     = useState(false);
  const [isNewDay, setIsNewDay] = useState(false);
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
      {/* Badge inline */}
      <div className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-bg-muted border border-border/60"
        title={`Racha actual: ${streak} día${streak !== 1 ? "s" : ""}`}>
        <span className="text-sm leading-none">🔥</span>
        <span className="text-xs font-semibold text-text-primary tabular-nums">{streak}</span>
      </div>

      {/* Toast de racha nueva */}
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-slide-up pointer-events-none">
          <div className="flex items-center gap-3 px-5 py-3 bg-bg-card border border-accent-purple/30 rounded-2xl shadow-lg">
            <span className="text-2xl">🔥</span>
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
