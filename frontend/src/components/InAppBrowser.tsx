/**
 * InAppBrowser — abre un sitio web de un socio dentro de la PWA.
 * El usuario no sale de la aplicación.
 *
 * Protecciones:
 * - Solo permite URLs que correspondan a socios registrados (target_url viene del backend)
 * - Header con botón de cierre siempre visible
 * - Registra evento overlay_open/overlay_close al backend
 */
import { useEffect, useRef, useState } from "react";
import { X, ExternalLink, Loader2, Shield } from "lucide-react";
import { adsApi } from "@/lib/api";

interface Props {
  adId: string;
  url: string;
  title: string;
  onClose: () => void;
}

export function InAppBrowser({ adId, url, title, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const sessionId = useRef(crypto.randomUUID());

  useEffect(() => {
    // Registrar apertura
    adsApi.recordEvent(adId, "overlay_open", { session_id: sessionId.current }).catch(() => {});

    return () => {
      // Registrar cierre al desmontar
      adsApi.recordEvent(adId, "overlay_close", { session_id: sessionId.current }).catch(() => {});
    };
  }, [adId]);

  function handleLoad() {
    setLoading(false);
  }

  function handleError() {
    setLoading(false);
    setError(true);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Barra superior */}
      <div className="flex items-center gap-3 px-4 py-3 bg-bg-base border-b border-border flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-bg-muted text-text-muted transition-colors flex-shrink-0"
          aria-label="Cerrar"
        >
          <X size={18} />
        </button>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-text-primary">{title}</p>
          <div className="flex items-center gap-1">
            <Shield size={10} className="text-status-success" />
            <p className="text-[10px] text-text-muted truncate">{url}</p>
          </div>
        </div>

        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-2 rounded-xl hover:bg-bg-muted text-text-muted flex-shrink-0"
          aria-label="Abrir en navegador"
        >
          <ExternalLink size={16} />
        </a>
      </div>

      {/* Iframe del sitio socio */}
      <div className="flex-1 relative overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white z-10">
            <Loader2 size={32} className="animate-spin text-accent-purple" />
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-bg-muted flex items-center justify-center mx-auto mb-3"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg></div>
            <p className="font-semibold text-text-primary">No se pudo cargar el sitio</p>
            <p className="text-sm text-text-muted mt-1 mb-4">
              El sitio no permite ser mostrado dentro de la app.
            </p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 bg-accent-purple text-white rounded-2xl text-sm font-semibold"
            >
              <ExternalLink size={16} /> Abrir en el navegador
            </a>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={url}
          title={title}
          onLoad={handleLoad}
          onError={handleError}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="no-referrer"
        />
      </div>
    </div>
  );
}
