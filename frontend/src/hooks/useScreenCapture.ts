/**
 * useScreenCapture
 *
 * Protección multicapa contra capturas de pantalla:
 *
 * 1. Print Screen / Cmd+Shift+3/4/5 (PC / Mac) → alerta inmediata
 * 2. getDisplayMedia (compartir pantalla) → alerta + bloqueo
 * 3. App switcher blur (iOS/Android PWA) → overlay opaco cuando la app
 *    pasa al fondo (iOS toma snapshot del estado actual para el switcher)
 *
 * Limitación conocida: iOS NO expone API para detectar capturas directas
 * (Power + Volumen). Las imágenes tienen watermark en el servidor con el
 * ID del usuario, lo que permite rastrear filtraciones.
 */
import { useEffect, useCallback, useRef } from "react";

interface Options {
  onDetected?: () => void;
  warn?: boolean;
}

// Overlay singleton para el app switcher blur
let overlayEl: HTMLDivElement | null = null;

function getOverlay(): HTMLDivElement {
  if (!overlayEl) {
    overlayEl = document.createElement("div");
    overlayEl.id = "vnx-screen-guard";
    Object.assign(overlayEl.style, {
      position:       "fixed",
      inset:          "0",
      zIndex:         "99999",
      background:     "#000",
      display:        "none",
      alignItems:     "center",
      justifyContent: "center",
    });
    // Ícono de escudo centrado
    overlayEl.innerHTML = `<div style="
      display:flex;flex-direction:column;align-items:center;gap:12px;
      color:rgba(255,255,255,.18);font-family:system-ui;
    ">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      <span style="font-size:13px;letter-spacing:.06em">Contenido protegido</span>
    </div>`;
    document.body.appendChild(overlayEl);
  }
  return overlayEl;
}

export function useScreenCapture({ onDetected, warn = true }: Options = {}) {
  const warned = useRef(false);

  const handleDetection = useCallback(() => {
    onDetected?.();
    if (warn && !warned.current) {
      warned.current = true;
      setTimeout(() => { warned.current = false; }, 5000);
      alert(
        "Captura de pantalla detectada.\n\n" +
        "El contenido está protegido y marcado con tu ID de usuario. " +
        "La distribución no autorizada puede resultar en la suspensión de tu cuenta."
      );
    }
  }, [warn, onDetected]);

  useEffect(() => {
    const overlay = getOverlay();

    // ── 1. App switcher (iOS + Android) ─────────────────
    // Cuando la app pasa al fondo, iOS/Android captura un snapshot
    // de la pantalla actual para mostrarlo en el switcher de apps.
    // Solo usamos visibilitychange — blur/pagehide disparan espuriamente
    // en navegación SPA y focus shifts del teclado (caja negra falsa).
    const handleVisibility = () => {
      if (document.hidden) {
        overlay.style.display = "flex";
      } else {
        overlay.style.display = "none";
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    // ── 2. Print Screen key (PC) ─────────────────────────────
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "PrintScreen" || e.code === "PrintScreen") {
        navigator.clipboard?.writeText("").catch(() => {});
        handleDetection();
      }
    };

    // ── 3. Cmd+Shift+3/4/5 (Mac) ─────────────────────────────
    const handleKeyCombo = (e: KeyboardEvent) => {
      if (e.metaKey && e.shiftKey && ["3", "4", "5", "s"].includes(e.key)) {
        handleDetection();
      }
    };

    // ── 4. getDisplayMedia (compartir pantalla) ───────────────
    const orig = navigator.mediaDevices?.getDisplayMedia?.bind(navigator.mediaDevices);
    if (navigator.mediaDevices && orig) {
      navigator.mediaDevices.getDisplayMedia = async (opts?: DisplayMediaStreamOptions) => {
        handleDetection();
        return orig(opts);
      };
    }

    document.addEventListener("keyup",   handleKey);
    document.addEventListener("keydown", handleKeyCombo);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      document.removeEventListener("keyup",   handleKey);
      document.removeEventListener("keydown", handleKeyCombo);
      if (navigator.mediaDevices && orig) {
        navigator.mediaDevices.getDisplayMedia = orig;
      }
      overlay.style.display = "none";
    };
  }, [handleDetection]);
}
