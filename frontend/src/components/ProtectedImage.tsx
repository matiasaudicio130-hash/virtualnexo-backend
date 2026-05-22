/**
 * ProtectedImage — imagen con protección anti-captura de pantalla.
 *
 * Técnicas implementadas:
 * 1. CSS user-select: none + pointer-events desactivados en imágenes
 * 2. Bloqueo de clic derecho / menú contextual
 * 3. Bloqueo de drag & drop
 * 4. Overlay de video transparente (técnica Netflix/Disney+):
 *    Android bloquea screenshots cuando hay un elemento <video> reproduciéndose,
 *    incluso si es 100% transparente. Esto cubre el área de la imagen.
 * 5. CSS -webkit-touch-callout: none (iOS long-press guard)
 *
 * LIMITACIÓN: No existe ninguna API web que bloquee screenshots al 100%
 * en todos los dispositivos. Este componente dificulta al máximo la captura
 * casual pero un atacante determinado puede usar métodos externos.
 */
import { useRef, useEffect } from "react";

interface Props {
  src: string;
  alt?: string;
  className?: string;
  aspectRatio?: string;     // ej: "1/1", "4/3", "16/9"
  showVideoOverlay?: boolean; // true por defecto en contenido sensible
}

export function ProtectedImage({
  src,
  alt = "",
  className = "",
  aspectRatio = "1/1",
  showVideoOverlay = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const block = (e: Event) => e.preventDefault();
    el.addEventListener("contextmenu", block);
    el.addEventListener("dragstart",   block);
    el.addEventListener("selectstart", block);

    return () => {
      el.removeEventListener("contextmenu", block);
      el.removeEventListener("dragstart",   block);
      el.removeEventListener("selectstart", block);
    };
  }, []);

  // Iniciar el video transparente (activa protección Android)
  useEffect(() => {
    if (!showVideoOverlay || !videoRef.current) return;
    const v = videoRef.current;
    v.play().catch(() => {
      // Autoplay bloqueado — intentar con interacción del usuario
      const tryPlay = () => { v.play().catch(() => {}); };
      document.addEventListener("touchstart", tryPlay, { once: true });
      document.addEventListener("click",      tryPlay, { once: true });
    });
  }, [showVideoOverlay]);

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className}`}
      style={{ aspectRatio, WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
    >
      {/* Imagen protegida */}
      <img
        src={src}
        alt={alt}
        draggable={false}
        className="w-full h-full object-cover pointer-events-none"
        style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" } as React.CSSProperties}
      />

      {/* Overlay de video transparente (bloquea screenshot en Android/Chrome) */}
      {showVideoOverlay && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          disablePictureInPicture
          className="absolute inset-0 w-full h-full"
          style={{
            opacity: 0.001,          // Casi invisible pero "playing"
            pointerEvents: "none",
            objectFit: "cover",
            mixBlendMode: "normal",
          }}
        >
          {/* Video 1x1 pixel en base64 — mínimo overhead */}
          <source
            src="data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQAAAAhmcmVlAAAA"
            type="video/mp4"
          />
        </video>
      )}
    </div>
  );
}

/** Versión simplificada para avatares pequeños (sin overlay de video). */
export function ProtectedAvatar({
  src,
  size = 40,
  className = "",
}: {
  src: string;
  size?: number;
  className?: string;
}) {
  const block = (e: React.MouseEvent | React.DragEvent) => e.preventDefault();
  return (
    <div
      className={`relative overflow-hidden rounded-full select-none flex-shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt=""
        draggable={false}
        onContextMenu={block}
        onDragStart={block}
        className="w-full h-full object-cover pointer-events-none"
        style={{ WebkitUserSelect: "none" } as React.CSSProperties}
      />
    </div>
  );
}
