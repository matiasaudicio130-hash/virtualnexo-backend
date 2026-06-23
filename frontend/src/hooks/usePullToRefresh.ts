import { useEffect, useRef, useState, useCallback } from "react";

const THRESHOLD  = 72;  // px de arrastre para disparar refresh
const MAX_PULL   = 96;  // máximo visual antes de soltar

/**
 * Pull-to-refresh para el feed.
 * Solo activo cuando el usuario está en el top del scroll (scrollY === 0).
 * Devuelve la distancia de arrastre (0 cuando no hay pull) y si está refreshing.
 */
export function usePullToRefresh(onRefresh: () => Promise<void> | void) {
  const startY      = useRef(0);
  const [dist, setDist]       = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const active = useRef(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await onRefresh(); } finally { setRefreshing(false); }
  }, [onRefresh]);

  useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      if (window.scrollY > 4) return;         // solo desde el top
      if (refreshing) return;
      startY.current = e.touches[0].clientY;
      active.current = true;
    }

    function onTouchMove(e: TouchEvent) {
      if (!active.current) return;
      const d = e.touches[0].clientY - startY.current;
      if (d <= 0) { active.current = false; setDist(0); return; }
      setDist(Math.min(d * 0.55, MAX_PULL));   // amortiguación 0.55
    }

    function onTouchEnd() {
      if (!active.current) return;
      active.current = false;
      if (dist >= THRESHOLD) {
        setDist(THRESHOLD * 0.6);   // queda arriba mientras recarga
        handleRefresh().finally(() => setDist(0));
      } else {
        setDist(0);
      }
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove",  onTouchMove,  { passive: true });
    window.addEventListener("touchend",   onTouchEnd);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove",  onTouchMove);
      window.removeEventListener("touchend",   onTouchEnd);
    };
  }, [dist, refreshing, handleRefresh]);

  return { dist, refreshing };
}
