/**
 * AdBanner — muestra un anuncio del AdServer localizado.
 *
 * Tipos:
 *  - banner:  card rectangular en el feed (entre posts)
 *  - overlay: abre InAppBrowser al hacer click (sin salir de la PWA)
 *  - inline:  pequeño banner horizontal
 *
 * Registra impresión al montar y click al interactuar.
 */
import { useEffect, useState } from "react";
import { ExternalLink, X } from "lucide-react";
import { adsApi } from "@/lib/api";
import { InAppBrowser } from "@/components/InAppBrowser";

export interface Ad {
  id: string;
  type: "banner" | "overlay" | "inline";
  title: string;
  description?: string;
  image_url?: string;
  target_url: string;
  cta_text: string;
  advertiser: { name: string; category: string; logo_url?: string };
}

interface Props {
  ad: Ad;
  onDismiss?: () => void;
}

export function AdBanner({ ad, onDismiss }: Props) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  // Registrar impresión al montar
  useEffect(() => {
    adsApi.recordEvent(ad.id, "impression").catch(() => {});
  }, [ad.id]);

  function handleClick() {
    adsApi.recordEvent(ad.id, "click").catch(() => {});
    if (ad.type === "overlay") {
      setShowOverlay(true);
    } else {
      window.open(ad.target_url, "_blank", "noopener,noreferrer");
    }
  }

  function handleDismiss(e: React.MouseEvent) {
    e.stopPropagation();
    setDismissed(true);
    onDismiss?.();
  }

  if (dismissed) return null;

  if (ad.type === "inline") {
    return (
      <div
        onClick={handleClick}
        className="flex items-center gap-3 px-4 py-3 bg-bg-card border border-border rounded-2xl cursor-pointer hover:border-accent-purple/40 transition-all group"
      >
        {ad.advertiser.logo_url && (
          <img src={ad.advertiser.logo_url} alt={ad.advertiser.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-xs text-text-muted uppercase tracking-wider">Publicidad</p>
          <p className="text-sm font-semibold truncate">{ad.title}</p>
        </div>
        <span className="text-xs text-accent-purple whitespace-nowrap group-hover:underline">{ad.cta_text}</span>
        <button onClick={handleDismiss} className="p-1 text-text-muted hover:text-text-primary ml-1">
          <X size={12} />
        </button>
      </div>
    );
  }

  return (
    <>
      <div
        onClick={handleClick}
        className="relative bg-bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-accent-purple/40 transition-all group"
      >
        {/* Imagen */}
        {ad.image_url && (
          <div className="relative">
            <img
              src={ad.image_url}
              alt={ad.title}
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              className="w-full h-40 object-cover select-none pointer-events-none"
            />
            {/* Badge "Publicidad" */}
            <span className="absolute top-2 left-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded-full">
              Publicidad
            </span>
          </div>
        )}

        <div className="p-4">
          {!ad.image_url && (
            <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Publicidad</p>
          )}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Categoría del anunciante */}
              <p className="text-xs text-text-muted capitalize mb-0.5">
                {ad.advertiser.category.replace("_", " ")} · {ad.advertiser.name}
              </p>
              <p className="font-semibold text-sm">{ad.title}</p>
              {ad.description && (
                <p className="text-xs text-text-secondary mt-1 line-clamp-2">{ad.description}</p>
              )}
            </div>
            {ad.advertiser.logo_url && (
              <img src={ad.advertiser.logo_url} alt={ad.advertiser.name} className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
            )}
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 bg-accent-purple text-white text-sm font-semibold rounded-xl group-hover:bg-accent-purple/90 transition-colors">
              {ad.type === "overlay" ? <ExternalLink size={14} /> : null}
              {ad.cta_text}
            </span>
            <button
              onClick={handleDismiss}
              className="p-1.5 text-text-muted hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Overlay in-app */}
      {showOverlay && (
        <InAppBrowser
          adId={ad.id}
          url={ad.target_url}
          title={ad.advertiser.name}
          onClose={() => setShowOverlay(false)}
        />
      )}
    </>
  );
}
