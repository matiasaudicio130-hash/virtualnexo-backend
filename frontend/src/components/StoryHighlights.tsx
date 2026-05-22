import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { highlightsApi } from "@/lib/api";

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

export function StoryHighlights({ userId, isOwn = false, onSelect }: Props) {
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle]     = useState("");
  const [creating, setCreating]     = useState(false);

  useEffect(() => {
    highlightsApi.forUser(userId)
      .then(r => setHighlights(r.data))
      .catch(() => {});
  }, [userId]);

  async function handleCreate() {
    if (!newTitle.trim() || creating) return;
    setCreating(true);
    try {
      const { data } = await highlightsApi.create({ title: newTitle.trim(), story_ids: [] });
      setHighlights(prev => [...prev, data]);
      setNewTitle("");
      setShowCreate(false);
    } catch { /* ignore */ }
    setCreating(false);
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("¿Eliminar este highlight?")) return;
    await highlightsApi.delete(id);
    setHighlights(prev => prev.filter(h => h.id !== id));
  }

  function getCover(h: Highlight): string | undefined {
    return h.cover_url || h.items?.[0]?.posts?.media_url;
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
              <Plus size={20} className="text-text-muted"/>
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
                  <img src={cover} alt={h.title} className="w-full h-full object-cover"/>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-black text-lg font-bold">
                    {h.title.charAt(0).toUpperCase()}
                  </div>
                )}
              </button>

              {isOwn && (
                <button
                  onClick={e => handleDelete(h.id, e)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-status-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X size={10} className="text-white"/>
                </button>
              )}

              <span className="text-[10px] text-text-muted text-center truncate max-w-[64px]">{h.title}</span>
            </div>
          );
        })}
      </div>

      {/* Modal crear highlight */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}>
          <div className="bg-bg-card border border-border rounded-2xl p-6 w-72 animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-sm mb-4">Nuevo Highlight</h3>
            <input
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              placeholder="Nombre del highlight..."
              maxLength={40}
              autoFocus
              className="w-full bg-bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple/60 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowCreate(false)}
                className="flex-1 py-2.5 border border-border text-text-muted text-sm rounded-xl hover:bg-bg-muted transition-all">
                Cancelar
              </button>
              <button onClick={handleCreate} disabled={!newTitle.trim() || creating}
                className="flex-1 py-2.5 bg-accent-purple text-white text-sm rounded-xl disabled:opacity-40 hover:opacity-90 transition-all">
                {creating ? "Creando..." : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
