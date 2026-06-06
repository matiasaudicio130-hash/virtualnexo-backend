import { useState, useEffect } from "react";
import { Plus, X, ImagePlus, Pencil, Check } from "lucide-react";
import { highlightsApi, mediaApi } from "@/lib/api";

interface Highlight {
  id: string;
  title: string;
  cover_url?: string;
  items?: { story_id: string; posts?: { media_url?: string } }[];
}

interface Props {
  userId:    string;
  isOwn?:    boolean;
  onSelect?: (highlight: Highlight) => void;
}

function getCover(h: Highlight): string | undefined {
  return h.cover_url || h.items?.[0]?.posts?.media_url;
}

/* Modal unificado: crea o edita un highlight */
function HighlightModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Highlight;
  onClose: () => void;
  onSave: (h: Highlight) => void;
}) {
  const isEdit = !!initial;
  const [title, setTitle]           = useState(initial?.title ?? "");
  const [coverFile, setCoverFile]   = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(initial?.cover_url ?? null);
  const [saving, setSaving]         = useState(false);

  function handleCoverSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    e.target.value = "";
  }

  async function handleSave() {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      let cover_url: string | undefined = initial?.cover_url;
      if (coverFile) {
        const { data: uploaded } = await mediaApi.uploadPost(coverFile);
        cover_url = uploaded?.signed_url ?? uploaded?.url ?? undefined;
      }

      if (isEdit && initial) {
        const { data } = await highlightsApi.update(initial.id, {
          title: title.trim(),
          ...(coverFile ? { cover_url } : {}),
        });
        onSave({ ...initial, ...data });
      } else {
        const { data } = await highlightsApi.create({ title: title.trim(), story_ids: [], cover_url });
        onSave(data);
      }
    } catch (e: any) {
      alert(e?.response?.data?.detail ?? "Error. Intentá de nuevo.");
    }
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-bg-card border border-border rounded-2xl p-6 w-72 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="font-semibold text-sm mb-4">
          {isEdit ? "Editar Highlight" : "Nuevo Highlight"}
        </h3>

        {/* Portada */}
        <label className="block mb-4 cursor-pointer">
          <div className="w-full h-28 rounded-xl border border-dashed border-border overflow-hidden flex items-center justify-center bg-bg-muted hover:border-accent-purple/40 transition-colors relative">
            {coverPreview ? (
              <>
                <img src={coverPreview} className="w-full h-full object-cover" alt="cover" />
                <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <ImagePlus size={20} className="text-white" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-text-muted">
                <ImagePlus size={20} strokeWidth={1.5} />
                <span className="text-xs">Foto de portada (opcional)</span>
              </div>
            )}
          </div>
          <input type="file" accept="image/*" className="hidden" onChange={handleCoverSelect} />
        </label>

        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleSave()}
          placeholder="Nombre del highlight..."
          maxLength={40}
          autoFocus
          className="w-full bg-bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple/60 mb-4"
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border text-text-muted text-sm rounded-xl hover:bg-bg-muted transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex-1 py-2.5 bg-accent-purple text-white text-sm rounded-xl disabled:opacity-40 hover:opacity-90 transition-all"
          >
            {saving ? "Guardando..." : isEdit ? "Guardar" : "Crear"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function StoryHighlights({ userId, isOwn = false, onSelect }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<Highlight | null>(null);

  useEffect(() => {
    highlightsApi.forUser(userId)
      .then(r => setHighlights(r.data))
      .catch(() => {});
  }, [userId]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("¿Eliminar este highlight?")) return;
    await highlightsApi.delete(id);
    setHighlights(prev => prev.filter(h => h.id !== id));
  }

  function handleEdit(h: Highlight, e: React.MouseEvent) {
    e.stopPropagation();
    setEditTarget(h);
  }

  function handleSaved(h: Highlight) {
    setHighlights(prev => {
      const idx = prev.findIndex(x => x.id === h.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = h;
        return next;
      }
      return [...prev, h];
    });
    setShowCreate(false);
    setEditTarget(null);
  }

  if (highlights.length === 0 && !isOwn) return null;

  return (
    <div className="px-4 py-3">
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-none">

        {/* Crear highlight — solo para el dueño */}
        {isOwn && (
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <button
              onClick={() => setShowCreate(true)}
              className="w-16 h-16 rounded-full border-2 border-dashed border-border flex items-center justify-center hover:border-accent-purple/50 transition-colors bg-bg-muted/30"
            >
              <Plus size={20} className="text-text-muted" />
            </button>
            <span className="text-[10px] text-text-muted">Nuevo</span>
          </div>
        )}

        {/* Highlights existentes */}
        {highlights.map(h => {
          const cover = getCover(h);
          return (
            <div key={h.id} className="flex flex-col items-center gap-1.5 flex-shrink-0 relative group">
              <button
                onClick={() => onSelect?.(h)}
                className="w-16 h-16 rounded-full overflow-hidden border-2 border-amber-600/50 hover:border-amber-400 transition-colors"
                style={{
                  background: cover
                    ? undefined
                    : "linear-gradient(135deg,#C9A227,#FFE566)",
                }}
              >
                {cover ? (
                  <img src={cover} alt={h.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black text-lg font-bold">
                    {h.title.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {/* Controles de edición — solo para el dueño */}
              {isOwn && (
                <div className="absolute -top-1 -right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={e => handleEdit(h, e)}
                    className="w-5 h-5 bg-bg-card border border-border rounded-full flex items-center justify-center shadow-sm hover:bg-bg-muted"
                    title="Editar"
                  >
                    <Pencil size={9} className="text-text-muted" />
                  </button>
                  <button
                    onClick={e => handleDelete(h.id, e)}
                    className="w-5 h-5 bg-status-error rounded-full flex items-center justify-center"
                    title="Eliminar"
                  >
                    <X size={9} className="text-white" />
                  </button>
                </div>
              )}

              <span className="text-[10px] text-text-muted text-center truncate max-w-[64px]">
                {h.title}
              </span>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <HighlightModal onClose={() => setShowCreate(false)} onSave={handleSaved} />
      )}
      {editTarget && (
        <HighlightModal initial={editTarget} onClose={() => setEditTarget(null)} onSave={handleSaved} />
      )}
    </div>
  );
}
