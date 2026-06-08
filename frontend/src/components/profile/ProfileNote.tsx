import { useRef, useState, useEffect, type CSSProperties } from "react";
import { X } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import type { ProfileNote as TNote } from "@/types";

interface Props {
  note: TNote | null;
  isOwn: boolean;
  onSave: (text: string) => void;
  onDelete: () => void;
}

const wrap: CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 4 };
const bubble: CSSProperties = {
  position: "relative", background: "var(--surface)", border: "1px solid var(--border)",
  borderRadius: "var(--radius-pill)", padding: "7px 14px", maxWidth: 220,
};

function Tail() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, marginTop: 2 }}>
      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)" }} />
      <div style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--surface)" }} />
    </div>
  );
}

/** Nota temporal (estilo IG "Notes") que flota sobre el avatar. */
export function ProfileNote({ note, isOwn, onSave, onDelete }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.text ?? "");

  useEffect(() => { setDraft(note?.text ?? ""); }, [note]);

  useGSAP(() => {
    gsap.from(".note-bubble", { scale: 0.8, opacity: 0, duration: 0.4, ease: "back.out(1.7)" });
  }, { scope, dependencies: [!!note, editing] });

  if (!note && !isOwn) return null;

  function save() {
    const t = draft.trim();
    setEditing(false);
    if (t && t !== note?.text) onSave(t);
  }

  // Composer (solo al tocar para editar)
  if (isOwn && editing) {
    return (
      <div ref={scope} style={wrap}>
        <div className="note-bubble" style={{ ...bubble, padding: "5px 12px", display: "flex", alignItems: "center" }}>
          <input
            autoFocus
            value={draft}
            maxLength={60}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
            onBlur={save}
            placeholder="Compartí una nota…"
            style={{ background: "none", border: "none", outline: "none", color: "var(--paper)", fontFamily: "var(--font-sans)", fontSize: 12, width: 140, textAlign: "center" }}
          />
        </div>
        <Tail />
      </div>
    );
  }

  // Dueño sin nota → prompt para crear
  if (isOwn && !note) {
    return (
      <div ref={scope} style={wrap}>
        <button className="note-bubble" onClick={() => setEditing(true)} style={{ ...bubble, cursor: "pointer" }}>
          <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--mist)" }}>Compartí una nota…</span>
        </button>
        <Tail />
      </div>
    );
  }

  return (
    <div ref={scope} style={wrap}>
      <button
        className="note-bubble"
        onClick={() => isOwn && setEditing(true)}
        style={{ ...bubble, cursor: isOwn ? "pointer" : "default" }}
      >
        <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--silver)", lineHeight: 1.3, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {note!.text}
        </span>
        {isOwn && (
          <span
            onClick={e => { e.stopPropagation(); onDelete(); }}
            style={{ position: "absolute", top: -6, right: -6, width: 16, height: 16, borderRadius: "50%", background: "var(--smoke)", border: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <X size={9} style={{ color: "var(--mist)" }} />
          </span>
        )}
      </button>
      <Tail />
    </div>
  );
}
