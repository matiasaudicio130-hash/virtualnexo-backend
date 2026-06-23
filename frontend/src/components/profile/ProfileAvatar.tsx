import { useRef } from "react";
import { User } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { imgUrl } from "@/utils/image";

interface Props {
  photoUrl?: string | null;
  hasActiveStory?: boolean;
  storySeen?: boolean;
  size?: number;
  onClick?: () => void;
}

/**
 * Avatar con anillo de story estilo IG.
 * - Story activa sin ver  → anillo dorado con gradiente que rota lento.
 * - Story activa ya vista  → anillo gris (--ash) estático.
 * - Sin story              → borde dorado estático (look original).
 */
export function ProfileAvatar({ photoUrl, hasActiveStory, storySeen, size = 110, onClick }: Props) {
  const scope = useRef<HTMLButtonElement>(null);
  const showRing = !!hasActiveStory;
  const live = showRing && !storySeen;
  const outer = size + (showRing ? 10 : 4);

  useGSAP(() => {
    if (!live) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.to(".pa-ring", { rotate: 360, duration: 8, ease: "none", repeat: -1 });
  }, { scope, dependencies: [live] });

  return (
    <button
      ref={scope}
      onClick={onClick}
      style={{
        position: "relative", width: outer, height: outer, borderRadius: "50%",
        border: "none", background: "none", padding: 0, margin: "0 auto 16px",
        display: "block", cursor: photoUrl ? "zoom-in" : "default",
      }}
    >
      {showRing && (
        <div
          className="pa-ring"
          style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            background: live
              ? "conic-gradient(from 0deg, var(--gold-deep), var(--gold), var(--gold-light), var(--gold-bright), var(--gold), var(--gold-deep))"
              : "var(--ash)",
          }}
        />
      )}
      <div
        style={{
          position: "absolute", inset: showRing ? 4 : 0, borderRadius: "50%", overflow: "hidden",
          border: showRing ? "3px solid var(--obsidian)" : "2px solid var(--gold-deep)",
          boxShadow: showRing ? "none" : "0 0 24px rgba(201,162,39,0.25)",
          background: "var(--pewter)",
        }}
      >
        {photoUrl ? (
          <img
            src={imgUrl(photoUrl, "avatar-lg")}
            alt=""
            draggable={false}
            decoding="async"
            onContextMenu={e => e.preventDefault()}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <User size={Math.round(size * 0.4)} style={{ color: "var(--mist)" }} />
          </div>
        )}
      </div>
    </button>
  );
}
