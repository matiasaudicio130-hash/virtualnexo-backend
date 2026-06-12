import { useRef, useState, type CSSProperties } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, ImagePlus, Check, Trash2 } from "lucide-react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { highlightsApi, mediaApi } from "@/lib/api";
import { toast } from "@/store/toastStore";
import type { Highlight, MyStory } from "@/types";

interface Props {
  existing?: Highlight | null;
  onClose: () => void;
  onSaved: () => void;
}

const overlay: CSSProperties = {
  position: "fixed", inset: 0, zIndex: 75, display: "flex", alignItems: "center", justifyContent: "center",
  background: "rgba(2,2,7,0.74)", backdropFilter: "blur(4px)", padding: 16,
};
const sheet: CSSProperties = {
  background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
  width: "100%", maxWidth: 380, maxHeight: "86vh", display: "flex", flexDirection: "column", overflow: "hidden",
};
const sectionLabel: CSSProperties = { fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mist)", marginBottom: 8 };
const textInput: CSSProperties = {
  width: "100%", background: "var(--smoke)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
  padding: "10px 14px", fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--paper)", outline: "none",
};

/** Modal unificado: crea un highlight eligiendo stories reales, o edita uno existente (título/portada/agregar stories/eliminar). */
export function HighlightCreator({ existing, onClose, onSaved }: Props) {
  const scope = useRef<HTMLDivElement>(null);
  const isEdit = !!existing;
  const [alreadyIn] = useState(() => new Set(existing?.items?.map(i => i.story_id) ?? []));

  const [title, setTitle]               = useState(existing?.title ?? "");
  const [coverFile, setCoverFile]       = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(existing?.cover_url ?? null);
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [saving, setSaving]             = useState(false);
  const [busy, setBusy]                 = useState(false);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["my-stories"],
    queryFn: () => highlightsApi.myStories().then(r => r.data as MyStory[]),
  });

  useGSAP(() => {
    gsap.from(".hlc-sheet", { scale: 0.92, opacity: 0, duration: 0.3, ease: "back.out(1.6)" });
  }, { scope });

  function toggle(id: string) {
    if (alreadyIn.has(id)) return;
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    // Comprimir a máx 600x600 antes de mostrar y subir (reduce el tiempo de upload ~80%)
    const img = new Image();
    img.onload = () => {
      const MAX = 600;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement("canvas");
      canvas.width  = width;
      canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob(blob => {
        if (!blob) return;
        const compressed = new File([blob], "cover.jpg", { type: "image/jpeg" });
        setCoverFile(compressed);
        setCoverPreview(URL.createObjectURL(compressed));
      }, "image/jpeg", 0.85);
      URL.revokeObjectURL(img.src);
    };
    img.src = URL.createObjectURL(file);
  }

  async function handleSave() {
    if (saving || busy) return;
    const t = title.trim();
    if (!t || (!isEdit && selected.size === 0)) return;
    setSaving(true);
    try {
      let cover_url: string | null | undefined = existing?.cover_url;
      if (coverFile) {
        const { data: uploaded } = await mediaApi.uploadPost(coverFile);
        cover_url = uploaded?.signed_url ?? uploaded?.url ?? undefined;
      }

      if (isEdit && existing) {
        const patch: { title?: string; cover_url?: string } = {};
        if (t !== existing.title) patch.title = t;
        if (coverFile && cover_url) patch.cover_url = cover_url;
        if (Object.keys(patch).length) await highlightsApi.update(existing.id, patch);
        if (selected.size) await highlightsApi.addItems(existing.id, [...selected]);
      } else {
        await highlightsApi.create({ title: t, story_ids: [...selected], cover_url });
      }
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail ?? "No se pudo guardar. Intentá de nuevo.");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!existing || busy) return;
    if (!confirm("¿Eliminar este highlight? Esta acción no se puede deshacer.")) return;
    setBusy(true);
    try {
      await highlightsApi.delete(existing.id);
      onSaved();
    } catch {
      toast.error("No se pudo eliminar. Intentá de nuevo.");
      setBusy(false);
    }
  }

  const canSave = !!title.trim() && (isEdit || selected.size > 0);

  return (
    <div ref={scope} style={overlay} onClick={onClose}>
      <div className="hlc-sheet" style={sheet} onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px", borderBottom: "1px solid var(--border-soft)" }}>
          <h3 style={{ fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 400, color: "var(--paper)" }}>
            {isEdit ? "Editar highlight" : "Nuevo highlight"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mist)", padding: 4, display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: "16px 18px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Portada + título */}
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ cursor: "pointer", flexShrink: 0 }}>
              <span style={{
                display: "flex", alignItems: "center", justifyContent: "center", width: 60, height: 60, borderRadius: "50%",
                overflow: "hidden", border: "1.5px dashed var(--ash)", background: "var(--smoke)",
              }}>
                {coverPreview
                  ? <img src={coverPreview} alt="" draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : <ImagePlus size={17} style={{ color: "var(--mist)" }} />}
              </span>
              <input type="file" accept="image/*" onChange={handleCover} style={{ display: "none" }} />
            </label>
            <div style={{ flex: 1 }}>
              <p style={sectionLabel}>Título</p>
              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={40} placeholder="Ej. Viajes" style={textInput} autoFocus />
            </div>
          </div>

          {/* Picker de stories */}
          <div>
            <p style={sectionLabel}>
              {isEdit ? "Agregar historias" : "Elegí historias"}
              {selected.size > 0 && ` · ${selected.size} seleccionada${selected.size > 1 ? "s" : ""}`}
            </p>
            {isLoading ? (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mist)" }}>Cargando…</p>
            ) : stories.length === 0 ? (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mist)" }}>Todavía no subiste historias.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
                {stories.map(s => {
                  const inHighlight = alreadyIn.has(s.id);
                  const isSel = selected.has(s.id);
                  return (
                    <button
                      key={s.id}
                      onClick={() => toggle(s.id)}
                      disabled={inHighlight}
                      title={inHighlight ? "Ya está en este highlight" : undefined}
                      style={{
                        position: "relative", aspectRatio: "3/4", borderRadius: "var(--radius-sm)", overflow: "hidden",
                        border: isSel ? "2px solid var(--gold)" : "1px solid var(--border)",
                        opacity: inHighlight ? 0.4 : 1, cursor: inHighlight ? "default" : "pointer", padding: 0, background: "var(--smoke)",
                      }}
                    >
                      {s.media_url && (
                        <img src={s.media_url} alt="" draggable={false} onContextMenu={e => e.preventDefault()} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      )}
                      {(isSel || inHighlight) && (
                        <span style={{
                          position: "absolute", top: 4, right: 4, width: 18, height: 18, borderRadius: "50%",
                          background: inHighlight ? "var(--ash)" : "var(--gold)", display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <Check size={11} style={{ color: "var(--obsidian)" }} strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--border-soft)", display: "flex", gap: 10 }}>
          {isEdit && (
            <button
              onClick={handleDelete}
              disabled={busy}
              title="Eliminar highlight"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 42, borderRadius: "var(--radius-md)", border: "1px solid rgba(194,90,90,0.35)", background: "rgba(194,90,90,0.08)", color: "var(--danger)", cursor: busy ? "default" : "pointer" }}
            >
              <Trash2 size={15} />
            </button>
          )}
          <button onClick={onClose} style={{ flex: 1, padding: "11px 0", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", background: "none", color: "var(--mist)", fontFamily: "var(--font-sans)", fontSize: 13, cursor: "pointer" }}>
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || saving}
            style={{
              flex: 1, padding: "11px 0", borderRadius: "var(--radius-md)", border: "none",
              background: canSave && !saving ? "var(--gold)" : "var(--ash)", color: "var(--obsidian)",
              fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 600, cursor: canSave && !saving ? "pointer" : "default",
            }}
          >
            {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}
