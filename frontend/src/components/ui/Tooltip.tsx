import { useState, useRef, useEffect, type ReactNode } from "react";

interface Props {
  label: string;
  children: ReactNode;
  position?: "top" | "bottom";
}

/**
 * Muestra un tooltip al hacer hover (desktop) o al mantener presionado 600ms (mobile).
 * En mobile cancela el click si el tooltip se mostró, para evitar disparar la acción.
 */
export function Tooltip({ label, children, position = "bottom" }: Props) {
  const [visible, setVisible]   = useState(false);
  const timerRef                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef            = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownByTouchRef         = useRef(false);

  useEffect(() => () => {
    if (timerRef.current)     clearTimeout(timerRef.current);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
  }, []);

  /* ── Desktop: hover ───────────────────────── */
  function onMouseEnter() { setVisible(true); }
  function onMouseLeave() { setVisible(false); }

  /* ── Mobile: long press ────────────────────── */
  function onTouchStart(e: React.TouchEvent) {
    shownByTouchRef.current = false;
    timerRef.current = setTimeout(() => {
      shownByTouchRef.current = true;
      setVisible(true);
      // Ocultar automáticamente tras 1.8 s
      hideTimerRef.current = setTimeout(() => setVisible(false), 1800);
    }, 600);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (timerRef.current) clearTimeout(timerRef.current);
    // Si el tooltip ya se mostró, cancelamos el click para no disparar la acción
    if (shownByTouchRef.current) {
      e.preventDefault();
      shownByTouchRef.current = false;
    }
  }

  function onTouchMove() {
    if (timerRef.current) clearTimeout(timerRef.current);
  }

  const posClass = position === "top"
    ? "bottom-full mb-2"
    : "top-full mt-2";

  return (
    <div
      className="relative inline-flex items-center justify-center"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
    >
      {children}

      {visible && (
        <div
          className={`absolute ${posClass} left-1/2 -translate-x-1/2 z-[200] pointer-events-none`}
          aria-hidden="true"
        >
          <div className="bg-bg-card border border-border/80 text-text-primary text-[11px] font-medium px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
            {label}
          </div>
          {/* Triángulo apuntando hacia el botón */}
          <div
            className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 bg-bg-card border-border/80 rotate-45 ${
              position === "top"
                ? "top-full -mt-1 border-b border-r"
                : "bottom-full -mb-1 border-t border-l"
            }`}
          />
        </div>
      )}
    </div>
  );
}
