import { useEffect, useRef, useState, type CSSProperties } from "react";
import { X, Heart } from "lucide-react";
import gsap from "gsap";
import { Flip } from "gsap/Flip";
import { useGSAP } from "@gsap/react";
import { highlightsApi } from "@/lib/api";
import { useStoryViewer } from "@/hooks/useStoryViewer";
import type { Highlight } from "@/types";

gsap.registerPlugin(Flip, useGSAP);

const REACTIONS = ["😍", "🔥", "😮", "👏", "❤️"];
const ITEM_SECONDS = 5;

function isVideoUrl(url?: string): boolean {
  return !!url && /\.(mp4|mov|webm|m4v|mkv|avi|3gpp)(\?|$)/i.test(url);
}
function timeAgo(iso?: string): string {
  if (!iso) return "";
  const mins = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1)  return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `hace ${hrs} h`;
  return `hace ${Math.floor(hrs / 24)} d`;
}

interface Burst { id: number; x: number; y: number; emoji: string | null }

interface Props {
  highlights: Highlight[];
  startHighlight: number;
  flipFrom?: HTMLElement | null;
  onClose: () => void;
}

const overlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 100, background: "var(--obsidian)",
  display: "flex", flexDirection: "column", touchAction: "none", userSelect: "none",
};
const track: CSSProperties = { flex: 1, height: 2, borderRadius: 2, overflow: "hidden", background: "rgba(245,241,232,0.22)" };
const mediaWrap: CSSProperties = { position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" };
const mediaStyle: CSSProperties = { width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none" };

/** Visor full-screen de historias destacadas: progreso, navegación por tap, hold-pause, swipe-down y reacciones. */
export function StoryViewer({ highlights, startHighlight, flipFrom, onClose }: Props) {
  const scope    = useRef<HTMLDivElement>(null);
  const mediaRef = useRef<HTMLDivElement>(null);
  const fillRef  = useRef<HTMLDivElement | null>(null);
  const tweenRef = useRef<gsap.core.Tween | null>(null);
  const reduceMotion = useRef(typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches).current;

  const { highlightIndex, itemIndex, paused, current, currentItem, items, pause, resume, next, prev } =
    useStoryViewer({ highlights, startHighlight, onClose });

  const [bursts, setBursts] = useState<Burst[]>([]);
  const burstSeq = useRef(0);
  const ptr = useRef({ down: false, x: 0, y: 0, dy: 0, dragging: false, downAt: 0 });
  const tap = useRef({ lastAt: 0, timer: 0 as number });

  // Cerrar con Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); if (e.key === "ArrowLeft") prev(); if (e.key === "ArrowRight") next(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, prev, next]);

  // ── Apertura cinematográfica: Flip desde el círculo, o scale+fade de respaldo ──
  useGSAP(() => {
    const el = scope.current;
    if (!el) return;
    if (flipFrom && !reduceMotion) {
      try {
        const state = Flip.getState(flipFrom, { props: "borderRadius" });
        gsap.set(el, { borderRadius: 0 });
        Flip.from(state, { targets: el, duration: 0.45, ease: "power2.inOut", absolute: true, scale: true });
        return;
      } catch { /* sigue al fallback */ }
    }
    gsap.fromTo(el, { scale: reduceMotion ? 1 : 0.94, opacity: 0 }, { scale: 1, opacity: 1, duration: reduceMotion ? 0.15 : 0.3, ease: "power2.out" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Barra de progreso del ítem activo ──
  useGSAP(() => {
    tweenRef.current?.kill();
    tweenRef.current = null;
    const fill = fillRef.current;
    if (!fill || !currentItem) return;

    if (reduceMotion) {
      gsap.set(fill, { scaleX: 1 });
      const t = window.setTimeout(() => next(), ITEM_SECONDS * 1000);
      return () => window.clearTimeout(t);
    }
    gsap.set(fill, { scaleX: 0 });
    tweenRef.current = gsap.to(fill, { scaleX: 1, duration: ITEM_SECONDS, ease: "none", onComplete: () => next() });
    if (paused) tweenRef.current.pause();
    return () => { tweenRef.current?.kill(); tweenRef.current = null; };
    // El loop se reinicia solo al cambiar de ítem — `paused` se maneja en el efecto de abajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { scope, dependencies: [highlightIndex, itemIndex, currentItem?.story_id] });

  useEffect(() => {
    if (paused) tweenRef.current?.pause();
    else        tweenRef.current?.resume();
  }, [paused]);

  // ── Animación de bursts (corazón / emoji flotando) ──
  useGSAP(() => {
    const els = gsap.utils.toArray<HTMLElement>(".sv-burst:not([data-played])");
    els.forEach(el => {
      el.setAttribute("data-played", "1");
      if (reduceMotion) { gsap.set(el, { opacity: 0 }); return; }
      gsap.timeline()
        .fromTo(el, { scale: 0.4, opacity: 0 }, { scale: 1.15, opacity: 1, duration: 0.2, ease: "back.out(2.2)" })
        .to(el, { scale: 1, duration: 0.1 })
        .to(el, { y: -55, opacity: 0, duration: 0.5, ease: "power1.in" }, "+=0.2");
    });
  }, { scope, dependencies: [bursts.length] });

  if (!current || !currentItem) return null;

  const cover = currentItem.posts?.media_url;
  const video = isVideoUrl(cover);

  function spawnBurst(clientX: number, clientY: number, emoji: string | null) {
    const rect = mediaRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;
    const id = ++burstSeq.current;
    setBursts(b => [...b, { id, x, y, emoji }]);
    window.setTimeout(() => setBursts(b => b.filter(item => item.id !== id)), 1100);
  }

  function react(emoji: string, clientX: number, clientY: number) {
    if (!currentItem) return;
    highlightsApi.reactStory(currentItem.story_id, emoji).catch(() => {});
    spawnBurst(clientX, clientY, emoji);
  }

  function onPointerDown(e: React.PointerEvent) {
    ptr.current = { down: true, x: e.clientX, y: e.clientY, dy: 0, dragging: false, downAt: Date.now() };
    pause();
  }
  function onPointerMove(e: React.PointerEvent) {
    const p = ptr.current;
    if (!p.down) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.dragging && dy > 12 && dy > Math.abs(dx) * 1.5) p.dragging = true;
    if (p.dragging) {
      p.dy = Math.max(0, dy);
      gsap.set(scope.current, { y: p.dy, opacity: 1 - Math.min(0.6, p.dy / 480) });
    }
  }
  function endDrag() {
    const p = ptr.current;
    p.down = false;
    p.dragging = false;
    if (p.dy > 110) {
      gsap.to(scope.current, { y: "100%", opacity: 0, duration: 0.22, ease: "power1.in", onComplete: onClose });
    } else if (p.dy > 0) {
      gsap.to(scope.current, { y: 0, opacity: 1, duration: 0.3, ease: "power2.out" });
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    resume();
    const p = ptr.current;
    const wasDragging = p.dragging;
    const heldMs = Date.now() - p.downAt;

    if (wasDragging) { endDrag(); return; }
    p.down = false;
    if (heldMs > 250) return; // mantenido → solo pausó/reanudó, no navega ni reacciona

    const now = Date.now();
    if (now - tap.current.lastAt < 300) {
      // doble tap → like rápido con ❤️
      if (tap.current.timer) { window.clearTimeout(tap.current.timer); tap.current.timer = 0; }
      tap.current.lastAt = 0;
      react("❤️", e.clientX, e.clientY);
      return;
    }
    tap.current.lastAt = now;
    const rect = mediaRef.current?.getBoundingClientRect();
    const goNext = rect ? (e.clientX - rect.left) > rect.width * 0.3 : true;
    tap.current.timer = window.setTimeout(() => { tap.current.timer = 0; goNext ? next() : prev(); }, 260);
  }
  function onPointerLeave() {
    if (ptr.current.down) {
      resume();
      if (ptr.current.dragging) endDrag();
      ptr.current.down = false;
      ptr.current.dragging = false;
    }
  }

  return (
    <div
      ref={scope}
      style={overlay}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onPointerCancel={onPointerLeave}
    >
      {/* Barras de progreso */}
      <div style={{ display: "flex", gap: 4, padding: "12px 12px 0" }}>
        {items.map((it, i) => (
          <div key={it.story_id} style={track}>
            <div
              ref={i === itemIndex ? fillRef : undefined}
              style={{
                height: "100%", background: "var(--paper)", transformOrigin: "left",
                transform: i < itemIndex ? "scaleX(1)" : i > itemIndex ? "scaleX(0)" : undefined,
              }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          {current.cover_url && (
            <span style={{ width: 30, height: 30, borderRadius: "50%", overflow: "hidden", border: "1px solid var(--border)", flexShrink: 0 }}>
              <img src={current.cover_url} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </span>
          )}
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, color: "var(--paper)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {current.title}
          </span>
          {currentItem.posts?.created_at && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mist)", flexShrink: 0 }}>{timeAgo(currentItem.posts.created_at)}</span>
          )}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--paper)", cursor: "pointer", padding: 6, display: "flex", flexShrink: 0 }}>
          <X size={20} />
        </button>
      </div>

      {/* Media + gestos */}
      <div ref={mediaRef} style={mediaWrap}>
        {cover ? (
          video ? (
            <video src={cover} autoPlay playsInline onContextMenu={e => e.preventDefault()} style={mediaStyle} />
          ) : (
            <img src={cover} alt="" draggable={false} onContextMenu={e => e.preventDefault()} style={mediaStyle} />
          )
        ) : (
          <p style={{ color: "var(--mist)", fontFamily: "var(--font-sans)", fontSize: 13 }}>Contenido no disponible</p>
        )}

        {bursts.map(b => (
          <span
            key={b.id}
            className="sv-burst"
            style={{ position: "absolute", left: `${b.x}%`, top: `${b.y}%`, transform: "translate(-50%,-50%)", pointerEvents: "none" }}
          >
            {b.emoji ? <span style={{ fontSize: 54 }}>{b.emoji}</span> : <Heart size={84} fill="#fff" style={{ color: "#fff" }} />}
          </span>
        ))}
      </div>

      {/* Reacciones */}
      <div style={{ display: "flex", gap: 16, justifyContent: "center", padding: "8px 20px 26px" }} onPointerDown={e => e.stopPropagation()}>
        {REACTIONS.map(emoji => (
          <button
            key={emoji}
            onClick={e => react(emoji, e.clientX, e.clientY)}
            style={{ fontSize: 24, lineHeight: 1, background: "none", border: "none", cursor: "pointer", padding: 6, transition: "transform 0.12s" }}
            onMouseDown={e => { e.currentTarget.style.transform = "scale(0.82)"; }}
            onMouseUp={e => { e.currentTarget.style.transform = "scale(1)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}
