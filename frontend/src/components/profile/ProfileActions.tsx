import { useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useNavigate } from "react-router-dom";
import { MessageSquare, Heart, MoreHorizontal, Share2, ShieldOff, Flag, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FollowButton } from "./FollowButton";
import type { FollowStatus } from "@/hooks/useFollow";

interface Props {
  userId: string;
  isPrivateAccount?: boolean;
  liked: boolean;
  onLike: () => void;
  onFollowChange?: (next: FollowStatus, prev: FollowStatus) => void;
  onShare: () => void;
  onBlock: () => void;
  onReport: () => void;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Fila de acciones del perfil ajeno: Seguir + Mensaje + Me gusta + menú overflow (compartir/bloquear/reportar). */
export function ProfileActions({ userId, isPrivateAccount, liked, onLike, onFollowChange, onShare, onBlock, onReport }: Props) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!menuOpen || !menuRef.current) return;
    gsap.fromTo(menuRef.current,
      { opacity: 0, y: -6, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: reduceMotion() ? 0 : 0.18, ease: "power2.out" }
    );
  }, { dependencies: [menuOpen] });

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
      <FollowButton userId={userId} isPrivateAccount={isPrivateAccount} onChange={onFollowChange} />

      <Button variant="ghost" size="sm" onClick={() => navigate(`/messages?with=${userId}`)}>
        <MessageSquare size={13} strokeWidth={1.5}/>
        Mensaje
      </Button>

      <button
        onClick={onLike}
        style={{
          padding: "8px 16px", borderRadius: "var(--radius-pill)", fontSize: 11,
          fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase",
          border: `1px solid ${liked ? "rgba(194,90,90,0.5)" : "var(--ash)"}`,
          background: liked ? "rgba(194,90,90,0.08)" : "transparent",
          color: liked ? "var(--danger)" : "var(--mist)", cursor: "pointer",
          display: "flex", alignItems: "center", gap: 6,
        }}
      >
        <Heart size={13} fill={liked ? "currentColor" : "none"} strokeWidth={1.5}/>
        {liked ? "Te gusta" : "Me gusta"}
      </button>

      <div style={{ position: "relative" }}>
        <button
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Más opciones"
          style={{
            padding: "8px 10px", borderRadius: "var(--radius-pill)", border: "1px solid var(--ash)",
            background: "transparent", color: "var(--mist)", cursor: "pointer",
            display: "flex", alignItems: "center", height: "100%",
          }}
        >
          <MoreHorizontal size={15} strokeWidth={1.5}/>
        </button>
        {menuOpen && (
          <>
            <div onClick={() => setMenuOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 29 }} />
            <div
              ref={menuRef}
              style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 30, minWidth: 168,
                background: "var(--surface)", border: "1px solid var(--border-soft)", borderRadius: 14,
                overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.45)",
              }}
            >
              <MenuItem icon={Share2}    label="Compartir" onClick={() => { setMenuOpen(false); onShare(); }} />
              <MenuItem icon={ShieldOff} label="Bloquear"  onClick={() => { setMenuOpen(false); onBlock(); }} />
              <MenuItem icon={Flag}      label="Reportar"  onClick={() => { setMenuOpen(false); onReport(); }} danger />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }: { icon: LucideIcon; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
        background: "none", border: "none", cursor: "pointer", textAlign: "left",
        fontFamily: "var(--font-sans)", fontSize: 13,
        color: danger ? "var(--danger)" : "var(--paper)",
      }}
    >
      <Icon size={15} strokeWidth={1.5}/>
      {label}
    </button>
  );
}
