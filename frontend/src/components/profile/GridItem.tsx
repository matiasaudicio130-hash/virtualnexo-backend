import { useRef } from "react";
import gsap from "gsap";
import { Heart, MessageCircle } from "lucide-react";
import type { Post } from "@/types";

interface Props {
  post: Post & { media_urls?: { url: string; type?: string }[]; poll_question?: string };
  isPinned?: boolean;
  pinBadgeEnabled?: boolean;
  pinButtonEnabled?: boolean;
  pinLoading?: boolean;
  onTogglePin?: () => void;
  onClick: () => void;
  className?: string;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v|mkv|avi|3gpp)(\?|$)/i.test(url);
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Celda de la grilla del perfil — cover (foto/video/poll/carrusel) + overlay de likes/comentarios al hover/long-press. */
export function GridItem({ post, isPinned, pinBadgeEnabled, pinButtonEnabled, pinLoading, onTogglePin, onClick, className }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();

  function showOverlay() {
    if (!overlayRef.current) return;
    gsap.to(overlayRef.current, { opacity: 1, duration: reduceMotion() ? 0 : 0.2, ease: "power1.out" });
  }
  function hideOverlay() {
    if (!overlayRef.current) return;
    gsap.to(overlayRef.current, { opacity: 0, duration: reduceMotion() ? 0 : 0.2, ease: "power1.out" });
  }
  function handleTouchStart() {
    longPressTimer.current = setTimeout(showOverlay, 250);
  }
  function handleTouchEnd() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    hideOverlay();
  }

  const isPoll      = post.type === "poll";
  const items       = Array.isArray(post.media_urls) ? post.media_urls : [];
  const isCarousel  = items.length > 1;
  const firstItem   = items[0];
  const cover       = firstItem?.url || post.media_url;
  const coverIsVideo = firstItem
    ? firstItem.type === "video"
    : (post.type as string) === "video" || (!!cover && isVideoUrl(cover));

  return (
    <button
      className={className}
      onClick={onClick}
      onMouseEnter={showOverlay}
      onMouseLeave={hideOverlay}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: "var(--smoke)", cursor: "pointer", border: "none", padding: 0 }}
    >
      {cover && coverIsVideo ? (
        <>
          <video
            src={cover}
            muted
            playsInline
            preload="metadata"
            onContextMenu={e => e.preventDefault()}
            style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
          />
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", pointerEvents: "none" }}>
            <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
            </div>
          </div>
        </>
      ) : cover ? (
        <img
          src={cover}
          alt=""
          draggable={false}
          onContextMenu={e => e.preventDefault()}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10, background: isPoll ? "rgba(201,162,39,0.06)" : "var(--smoke)" }}>
          {isPoll && (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" style={{ marginBottom: 6, opacity: 0.7 }}>
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
              <line x1="8" y1="8" x2="13" y2="8"/>
              <line x1="8" y1="16" x2="11" y2="16"/>
            </svg>
          )}
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--mist)", lineHeight: 1.4, textAlign: "center", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
            {(post.caption || post.poll_question)?.slice(0, 80)}
          </p>
        </div>
      )}

      {/* Overlay: likes + comentarios (hover desktop / long-press móvil) */}
      <div
        ref={overlayRef}
        style={{ position: "absolute", inset: 0, display: "flex", gap: 16, alignItems: "center", justifyContent: "center", background: "rgba(2,2,7,0.55)", opacity: 0, pointerEvents: "none" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          <Heart size={15} fill="var(--paper)" /> {post.reactions_count ?? 0}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
          <MessageCircle size={15} fill="var(--paper)" /> {post.comments_count ?? 0}
        </span>
      </div>

      {/* Badge: carrusel */}
      {isCarousel && (
        <div style={{ position: "absolute", top: 5, right: 5, display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", background: "rgba(2,2,7,0.7)", borderRadius: 6 }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="7" y="7" width="14" height="14" rx="2"/>
            <path d="M3 17V5a2 2 0 0 1 2-2h12"/>
          </svg>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "white", letterSpacing: "0.04em" }}>
            {items.length}
          </span>
        </div>
      )}
      {/* Badge: poll */}
      {isPoll && cover && (
        <div style={{ position: "absolute", top: 5, right: 5 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
            <line x1="8" y1="8" x2="13" y2="8"/>
            <line x1="8" y1="16" x2="11" y2="16"/>
          </svg>
        </div>
      )}
      {/* Badge: post fijado */}
      {pinBadgeEnabled && isPinned && (
        <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(201,162,39,0.85)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 10 }}>📌</span>
        </div>
      )}
      {/* Botón fijar/desfijar — solo dueño, solo tab Publicaciones */}
      {pinButtonEnabled && (
        <button
          onClick={e => { e.stopPropagation(); onTogglePin?.(); }}
          style={{ position: "absolute", bottom: 4, right: 4, background: isPinned ? "rgba(201,162,39,0.85)" : "rgba(2,2,7,0.65)", borderRadius: 4, border: "none", padding: "3px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, opacity: pinLoading ? 0.5 : 1 }}
          title={isPinned ? "Desfijar" : "Fijar en perfil"}
        >
          <span style={{ fontSize: 10 }}>📌</span>
        </button>
      )}
    </button>
  );
}
