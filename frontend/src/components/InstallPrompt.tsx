/**
 * InstallPrompt — banner de instalación PWA para Android/Chrome.
 *
 * Usa el evento `beforeinstallprompt` del browser.
 * Se muestra una vez y se guarda en localStorage si el usuario lo cierra.
 * En iOS muestra instrucciones manuales (Safari no tiene beforeinstallprompt).
 */
import { useState, useEffect } from "react";
import { X, DownloadSimple, ShareNetwork } from "@phosphor-icons/react";
import { APP_CONFIG } from "@/config/app";

const DISMISSED_KEY = "pwa_install_dismissed";

export function InstallPrompt() {
  const [prompt, setPrompt]       = useState<any>(null);
  const [showIOS, setShowIOS]     = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const isInPWA = window.matchMedia("(display-mode: standalone)").matches
    || (navigator as any).standalone;

  useEffect(() => {
    if (isInPWA || localStorage.getItem(DISMISSED_KEY)) return;

    if (isIOS) {
      // iOS no tiene beforeinstallprompt, mostrar instrucción manual
      setTimeout(() => setShowIOS(true), 3000);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, "1");
    setPrompt(null);
    setShowIOS(false);
    setDismissed(true);
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") dismiss();
  }

  if (dismissed || isInPWA) return null;

  // Android / Chrome
  if (prompt) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40 animate-slide-up">
        <div className="bg-bg-card border border-accent-purple/30 rounded-2xl p-4 shadow-xl flex items-center gap-3">
          <img
            src="/icons/icon-192.png"
            alt={APP_CONFIG.name}
            className="w-12 h-12 rounded-xl flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Instalá {APP_CONFIG.name}</p>
            <p className="text-xs text-text-muted">Acceso rápido desde tu pantalla de inicio</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={install}
              className="flex items-center gap-1.5 px-3 py-2 bg-accent-purple text-white text-xs font-semibold rounded-xl hover:bg-accent-purple/90 transition-colors"
            >
              <DownloadSimple size={13} /> Instalar
            </button>
            <button onClick={dismiss} className="p-1.5 text-text-muted hover:text-text-primary">
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // iOS Safari — instrucciones manuales
  if (showIOS) {
    return (
      <div className="fixed bottom-20 left-4 right-4 z-40">
        <div className="bg-bg-card border border-accent-purple/30 rounded-2xl p-4 shadow-xl">
          <div className="flex items-start justify-between mb-2">
            <p className="font-semibold text-sm">Instalá {APP_CONFIG.name} en tu iPhone</p>
            <button onClick={dismiss} className="p-1 text-text-muted">
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span>1. Tocá</span>
            <ShareNetwork size={14} className="text-accent-purple" />
            <span>en Safari</span>
          </div>
          <p className="text-sm text-text-secondary mt-1">
            2. Elegí <strong>"Agregar a inicio"</strong>
          </p>
        </div>
      </div>
    );
  }

  return null;
}
