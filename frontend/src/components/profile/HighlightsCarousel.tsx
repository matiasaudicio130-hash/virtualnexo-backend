import { useRef, useState, type CSSProperties } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { highlightsApi } from "@/lib/api";
import type { Highlight } from "@/types";
import { HighlightCreator } from "./HighlightCreator";
import { StoryViewer } from "./StoryViewer";

interface Props {
  userId: string;
  isOwn?: boolean;
}

const SIZE = 68;

const circleBase: CSSProperties = {
  width: SIZE, height: SIZE, borderRadius: "50%", overflow: "hidden", padding: 2,
  display: "block", cursor: "pointer", transition: "border-color 0.15s",
};

function getCover(h: Highlight): string | undefined {
  return h.cover_url || h.items?.[0]?.posts?.media_url;
}

/** Carrusel de Highlights — refactor de StoryHighlights migrado a tokens gold + Story Viewer integrado. */
export function HighlightsCarousel({ userId, isOwn = false }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const circleRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const qc = useQueryClient();

  const [showCreator, setShowCreator] = useState(false);
  const [editTarget, setEditTarget]   = useState<Highlight | null>(null);
  const [viewerAt, setViewerAt]       = useState<number | null>(null);
  const [flipFrom, setFlipFrom]       = useState<HTMLElement | null>(null);

  const { data: highlights = [] } = useQuery({
    queryKey: ["highlights", userId],
    queryFn: () => highlightsApi.forUser(userId).then(r => r.data as Highlight[]),
  });

  useGSAP(() => {
    gsap.from(".hl-circle", { opacity: 0, y: 8, stagger: 0.05, duration: 0.35, ease: "power2.out" });
  }, { scope, dependencies: [highlights.length] });

  const playable = highlights.filter(h => (h.items?.length ?? 0) > 0);

  function openViewer(h: Highlight) {
    const idx = playable.findIndex(p => p.id === h.id);
    if (idx < 0) return;
    setFlipFrom(circleRefs.current.get(h.id) ?? null);
    setViewerAt(idx);
  }

  function handleSaved() {
    qc.invalidateQueries({ queryKey: ["highlights", userId] });
    setShowCreator(false);
    setEditTarget(null);
  }

  if (highlights.length === 0 && !isOwn) return null;

  return (
    <div ref={scope} style={{ padding: "2px 20px 16px" }}>
      <div className="scrollbar-none" style={{ display: "flex", gap: 18, overflowX: "auto", paddingBottom: 2 }}>
        {isOwn && (
          <button
            onClick={() => setShowCreator(true)}
            className="hl-circle"
            style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <span style={{ width: SIZE, height: SIZE, borderRadius: "50%", border: "1.5px dashed var(--ash)", display: "flex", alignItems: "center", justifyContent: "center", transition: "border-color 0.15s" }}>
              <Plus size={18} style={{ color: "var(--mist)" }} />
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mist)", letterSpacing: "0.06em" }}>Nuevo</span>
          </button>
        )}

        {highlights.map(h => {
          const cover = getCover(h);
          const hasStories = (h.items?.length ?? 0) > 0;
          return (
            <div key={h.id} className="hl-circle" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0, position: "relative" }}>
              <button
                ref={el => { if (el) circleRefs.current.set(h.id, el); else circleRefs.current.delete(h.id); }}
                onClick={() => openViewer(h)}
                disabled={!hasStories}
                style={{
                  ...circleBase,
                  border: `1.5px solid ${hasStories ? "var(--gold-deep)" : "var(--border)"}`,
                  background: cover ? "var(--smoke)" : "linear-gradient(135deg,var(--gold),var(--gold-light))",
                  cursor: hasStories ? "pointer" : "default",
                }}
                onMouseEnter={e => { if (hasStories) e.currentTarget.style.borderColor = "var(--gold)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = hasStories ? "var(--gold-deep)" : "var(--border)"; }}
              >
                <span style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%", overflow: "hidden" }}>
                  {cover ? (
                    <img src={cover} alt="" draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <span style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--obsidian)", fontFamily: "var(--font-display)", fontSize: 18 }}>
                      {h.title.charAt(0).toUpperCase()}
                    </span>
                  )}
                </span>
              </button>

              {isOwn && (
                <button
                  onClick={e => { e.stopPropagation(); setEditTarget(h); }}
                  title="Editar highlight"
                  style={{ position: "absolute", top: -2, right: -2, width: 19, height: 19, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: 0 }}
                >
                  <Pencil size={9} style={{ color: "var(--mist)" }} />
                </button>
              )}

              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mist)", letterSpacing: "0.04em", maxWidth: SIZE, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {h.title}
              </span>
            </div>
          );
        })}
      </div>

      {(showCreator || editTarget) && (
        <HighlightCreator
          existing={editTarget}
          onClose={() => { setShowCreator(false); setEditTarget(null); }}
          onSaved={handleSaved}
        />
      )}

      {viewerAt !== null && (
        <StoryViewer
          highlights={playable}
          startHighlight={viewerAt}
          flipFrom={flipFrom}
          onClose={() => { setViewerAt(null); setFlipFrom(null); }}
        />
      )}
    </div>
  );
}
