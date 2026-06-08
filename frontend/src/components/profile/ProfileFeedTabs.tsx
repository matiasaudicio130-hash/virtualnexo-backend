import { useRef } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Grid3x3, Clapperboard, Bookmark, Tag } from "lucide-react";
import type { ProfileFeedTab } from "@/hooks/useInfiniteUserPosts";

interface TabDef {
  id: ProfileFeedTab;
  label: string;
  icon: typeof Grid3x3;
}

const TABS: TabDef[] = [
  { id: "posts",  label: "Publicaciones", icon: Grid3x3 },
  { id: "reels",  label: "Reels",         icon: Clapperboard },
  { id: "saved",  label: "Guardados",     icon: Bookmark },
  { id: "tagged", label: "Etiquetados",   icon: Tag },
];

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

interface Props {
  tab: ProfileFeedTab;
  onChange: (tab: ProfileFeedTab) => void;
  isOwn: boolean;
}

/** Barra de tabs del perfil con indicador inferior deslizante (GSAP). "Guardados" solo visible para el dueño. */
export function ProfileFeedTabs({ tab, onChange, isOwn }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Map<ProfileFeedTab, HTMLButtonElement>>(new Map());

  const visibleTabs = TABS.filter(t => t.id !== "saved" || isOwn);

  useGSAP(() => {
    const btn = btnRefs.current.get(tab);
    const indicator = indicatorRef.current;
    if (!btn || !indicator || !scope.current) return;
    const btnRect   = btn.getBoundingClientRect();
    const scopeRect = scope.current.getBoundingClientRect();
    const x = btnRect.left - scopeRect.left;
    const width = btnRect.width;
    if (reduceMotion()) {
      gsap.set(indicator, { x, width });
    } else {
      gsap.to(indicator, { x, width, duration: 0.3, ease: "power3.out" });
    }
  }, { scope, dependencies: [tab, visibleTabs.length] });

  return (
    <div ref={scope} style={{ position: "relative", display: "flex", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)" }}>
      {visibleTabs.map(({ id, label, icon: Icon }) => {
        const active = tab === id;
        return (
          <button
            key={id}
            ref={el => { if (el) btnRefs.current.set(id, el); else btnRefs.current.delete(id); }}
            onClick={() => onChange(id)}
            style={{ flex: 1, padding: "10px 0", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "none", border: "none", cursor: "pointer" }}
          >
            <Icon size={13} style={{ color: active ? "var(--gold)" : "var(--mist)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: active ? "var(--gold)" : "var(--mist)" }}>
              {label}
            </span>
          </button>
        );
      })}
      <div ref={indicatorRef} style={{ position: "absolute", bottom: -1, left: 0, height: 2, width: 0, background: "var(--gold)" }} />
    </div>
  );
}
