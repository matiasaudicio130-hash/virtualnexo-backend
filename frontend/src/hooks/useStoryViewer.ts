import { useCallback, useEffect, useRef, useState } from "react";
import type { Highlight } from "@/types";

const ITEM_DURATION_MS = 5000;

interface Options {
  highlights: Highlight[];
  startHighlight: number;
  startItem?: number;
  onClose: () => void;
}

/**
 * Maneja la reproducción de un visor de historias estilo IG: progreso por ítem,
 * auto-avance, pausa (hold) y navegación entre ítems/highlights.
 * Al desbordar los extremos salta al highlight contiguo o cierra el visor.
 */
export function useStoryViewer({ highlights, startHighlight, startItem = 0, onClose }: Options) {
  const [highlightIndex, setHighlightIndex] = useState(startHighlight);
  const [itemIndex, setItemIndex] = useState(startItem);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);

  const highlightsRef = useRef(highlights);
  const onCloseRef    = useRef(onClose);
  const pausedRef     = useRef(false);
  highlightsRef.current = highlights;
  onCloseRef.current    = onClose;
  useEffect(() => { pausedRef.current = paused; }, [paused]);

  const current     = highlights[highlightIndex];
  const items       = current?.items ?? [];
  const currentItem = items[itemIndex];

  const goTo = useCallback((h: number, i: number) => {
    const list = highlightsRef.current;
    if (h < 0 || h >= list.length) { onCloseRef.current(); return; }

    const len = list[h]?.items?.length ?? 0;
    if (i < 0)    { goTo(h - 1, (list[h - 1]?.items?.length ?? 1) - 1); return; }
    if (i >= len) { goTo(h + 1, 0); return; }

    setHighlightIndex(h);
    setItemIndex(i);
  }, []);

  const next          = useCallback(() => goTo(highlightIndex, itemIndex + 1), [goTo, highlightIndex, itemIndex]);
  const prev          = useCallback(() => goTo(highlightIndex, itemIndex - 1), [goTo, highlightIndex, itemIndex]);
  const goToHighlight = useCallback((h: number) => goTo(h, 0), [goTo]);
  const pause         = useCallback(() => setPaused(true),  []);
  const resume        = useCallback(() => setPaused(false), []);

  // Loop de progreso — se reinicia solo cuando cambia el ítem actual (no con paused).
  useEffect(() => {
    if (!currentItem) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    setProgress(0);

    function tick(now: number) {
      const dt = now - last;
      last = now;
      if (!pausedRef.current) {
        elapsed = elapsed + dt;
        const pct = Math.min(1, elapsed / ITEM_DURATION_MS);
        setProgress(pct);
        if (pct >= 1) { next(); return; }
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // El loop debe reiniciarse solo al cambiar de ítem, no en cada redefinición de `next`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightIndex, itemIndex, currentItem]);

  return {
    highlightIndex, itemIndex, progress, paused,
    current, currentItem, items,
    pause, resume, next, prev, goToHighlight,
  };
}
