import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bookmark, Play, LayoutGrid, Plus, X, FolderOpen, Check, Pencil, Trash2 } from "lucide-react";
import { feedApi, collectionsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PostCard } from "@/components/PostCard";
import { BottomNav } from "@/components/BottomNav";

interface SavedPost {
  id: string; type: string; caption?: string;
  media_url?: string; media_urls?: { url: string; type?: string }[];
  created_at: string; views_count: number; save_count?: number;
  extra_data?: any; reactions: Record<string, number>;
  viewer_reaction?: string; is_story: boolean; user_id: string;
  author: { id: string; name: string; avatar?: string; province?: string; profile_type?: string; username?: string };
}

interface Collection {
  id: string; name: string; post_ids: string[]; created_at: string;
}

const LIMIT = 30;

// ── Mini grid post thumbnail ───────────────────────────────────────────────
function PostThumb({
  post, onClick, onAddToCollection, inAnyCollection,
}: {
  post: SavedPost;
  onClick: () => void;
  onAddToCollection?: (post: SavedPost) => void;
  inAnyCollection?: boolean;
}) {
  const thumb   = post.media_url || (Array.isArray(post.media_urls) && post.media_urls[0]?.url) || null;
  const isVideo = Array.isArray(post.media_urls) ? post.media_urls[0]?.type === "video" : /\.(mp4|mov|webm)/i.test(post.media_url || "");
  const isMulti = Array.isArray(post.media_urls) && post.media_urls.length > 1;
  const inCol   = inAnyCollection ?? false;

  return (
    <button
      className="aspect-square relative overflow-hidden bg-bg-muted group"
      onClick={onClick}
    >
      {thumb ? (
        <img src={thumb} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
      ) : (
        <div className="w-full h-full flex items-center justify-center p-3 bg-bg-card">
          <p className="text-[10px] text-text-muted text-center line-clamp-5 leading-tight">{post.caption || "Post"}</p>
        </div>
      )}

      {isVideo  && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"><Play size={9} className="text-white" fill="white"/></div>}
      {isMulti  && <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center"><LayoutGrid size={9} className="text-white"/></div>}
      {!isVideo && !isMulti && thumb && <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"/>}

      {/* Add to collection button */}
      {onAddToCollection && (
        <button
          onClick={e => { e.stopPropagation(); onAddToCollection(post); }}
          className={`absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
            inCol ? "bg-amber-400 opacity-100" : "bg-black/60 opacity-0 group-hover:opacity-100"
          }`}
        >
          {inCol ? <Check size={11} className="text-black" /> : <Plus size={11} className="text-white" />}
        </button>
      )}
    </button>
  );
}

// ── Collection picker modal ───────────────────────────────────────────────
function CollectionPicker({
  post, collections, onAdd, onRemove, onCreate, onClose,
}: {
  post: SavedPost; collections: Collection[];
  onAdd: (col: Collection) => void; onRemove: (col: Collection) => void;
  onCreate: (name: string) => void; onClose: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm bg-bg-card border border-border rounded-t-3xl p-5 animate-slide-up space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">Guardar en colección</h3>
          <button onClick={onClose}><X size={18} className="text-text-muted"/></button>
        </div>

        {/* Existing collections */}
        {collections.length > 0 && (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {collections.map(col => {
              const inCol = col.post_ids.includes(post.id);
              return (
                <button key={col.id} onClick={() => inCol ? onRemove(col) : onAdd(col)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-muted transition-colors text-left">
                  <div className="w-9 h-9 rounded-lg overflow-hidden bg-bg-muted flex-shrink-0 flex items-center justify-center">
                    <FolderOpen size={18} className={inCol ? "text-amber-400" : "text-text-muted"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{col.name}</p>
                    <p className="text-[10px] text-text-muted">{col.post_ids.length} guardados</p>
                  </div>
                  {inCol && <Check size={16} className="text-amber-400 flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Create new */}
        {creating ? (
          <div className="flex gap-2">
            <input
              value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && newName.trim()) { onCreate(newName.trim()); setCreating(false); setNewName(""); } }}
              placeholder="Nombre de la colección…"
              autoFocus maxLength={60}
              className="flex-1 bg-bg-muted border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-amber-400/50"
              style={{ fontSize: "16px" }}
            />
            <button
              onClick={() => { if (newName.trim()) { onCreate(newName.trim()); setCreating(false); setNewName(""); } }}
              disabled={!newName.trim()}
              className="px-3 py-2 bg-amber-400 text-black rounded-xl text-sm font-bold disabled:opacity-40"
            >
              +
            </button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border text-sm text-text-muted hover:border-amber-400/50 hover:text-amber-400 transition-all">
            <Plus size={15}/> Nueva colección
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function Saved() {
  const navigate        = useNavigate();
  const { user }        = useAuthStore();
  const [posts, setPosts]             = useState<SavedPost[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [offset, setOffset]           = useState(0);
  const [selected, setSelected]       = useState<SavedPost | null>(null);
  const [activeColId, setActiveColId] = useState<string | null>(null);
  const [pickerPost, setPickerPost]   = useState<SavedPost | null>(null);

  // Collection editing
  const [editColId,   setEditColId]   = useState<string | null>(null);
  const [editColName, setEditColName] = useState("");

  const load = useCallback(async (off: number, append = false) => {
    if (off === 0) setLoading(true); else setLoadingMore(true);
    try {
      const { data } = await feedApi.getSaved({ limit: LIMIT, offset: off });
      const newPosts = data.posts || [];
      setPosts(prev => append ? [...prev, ...newPosts] : newPosts);
      setHasMore(newPosts.length === LIMIT);
    } catch { /* ignore */ }
    if (off === 0) setLoading(false); else setLoadingMore(false);
  }, []);

  const loadCollections = useCallback(async () => {
    try {
      const { data } = await collectionsApi.list();
      setCollections(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    load(0);
    loadCollections();
  }, [load, loadCollections]);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    const next = offset + LIMIT;
    setOffset(next);
    load(next, true);
  }

  function handleUnsave(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (selected?.id === postId) setSelected(null);
    // Remove from all collections
    setCollections(prev => prev.map(c => ({ ...c, post_ids: c.post_ids.filter(id => id !== postId) })));
  }

  async function handleCreateCollection(name: string) {
    try {
      const { data } = await collectionsApi.create(name);
      setCollections(prev => [...prev, data]);
      // If a picker is open, add the post to the new collection
      if (pickerPost) {
        await collectionsApi.addPost(data.id, pickerPost.id);
        setCollections(prev => prev.map(c => c.id === data.id ? { ...c, post_ids: [pickerPost.id, ...c.post_ids] } : c));
      }
    } catch { /* ignore */ }
  }

  async function handleAddToCollection(col: Collection) {
    if (!pickerPost) return;
    try {
      await collectionsApi.addPost(col.id, pickerPost.id);
      setCollections(prev => prev.map(c => c.id === col.id ? { ...c, post_ids: [pickerPost.id, ...c.post_ids.filter(id => id !== pickerPost.id)] } : c));
    } catch { /* ignore */ }
  }

  async function handleRemoveFromCollection(col: Collection) {
    if (!pickerPost) return;
    try {
      await collectionsApi.removePost(col.id, pickerPost.id);
      setCollections(prev => prev.map(c => c.id === col.id ? { ...c, post_ids: c.post_ids.filter(id => id !== pickerPost.id) } : c));
    } catch { /* ignore */ }
  }

  async function handleDeleteCollection(colId: string) {
    try {
      await collectionsApi.remove(colId);
      setCollections(prev => prev.filter(c => c.id !== colId));
      if (activeColId === colId) setActiveColId(null);
    } catch { /* ignore */ }
  }

  async function handleRenameCollection() {
    if (!editColId || !editColName.trim()) return;
    try {
      await collectionsApi.rename(editColId, editColName.trim());
      setCollections(prev => prev.map(c => c.id === editColId ? { ...c, name: editColName.trim() } : c));
    } catch { /* ignore */ }
    setEditColId(null);
    setEditColName("");
  }

  const activeCollection = activeColId ? collections.find(c => c.id === activeColId) : null;
  const displayPosts = activeCollection
    ? posts.filter(p => activeCollection.post_ids.includes(p.id))
    : posts;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl hover:bg-bg-muted transition-colors text-text-muted hover:text-text-primary">
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Guardados</h1>
          <p className="text-[10px] text-text-muted">{posts.length} publicaciones</p>
        </div>
        <Bookmark size={18} style={{ color: "var(--gold,#C9A227)" }} />
      </header>

      {/* Collections strip */}
      <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto scrollbar-none border-b border-border/40">
        {/* All button */}
        <button
          onClick={() => setActiveColId(null)}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
            !activeColId ? "border-transparent text-[#0a0a0f]" : "border-border text-text-muted hover:border-border/80"
          }`}
          style={!activeColId ? { background: "var(--gold,#C9A227)" } : {}}
        >
          <Bookmark size={11} /> Todos ({posts.length})
        </button>

        {/* Collection chips */}
        {collections.map(col => (
          <div key={col.id} className="flex-shrink-0 flex items-center gap-0.5">
            {editColId === col.id ? (
              <div className="flex items-center gap-1">
                <input
                  value={editColName}
                  onChange={e => setEditColName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleRenameCollection(); if (e.key === "Escape") { setEditColId(null); setEditColName(""); } }}
                  className="w-28 text-xs bg-bg-muted border border-amber-400/50 rounded-lg px-2 py-1 outline-none"
                  autoFocus
                  style={{ fontSize: "14px" }}
                />
                <button onClick={handleRenameCollection} className="text-amber-400"><Check size={13}/></button>
                <button onClick={() => { setEditColId(null); setEditColName(""); }} className="text-text-muted"><X size={13}/></button>
              </div>
            ) : (
              <button
                onClick={() => setActiveColId(col.id === activeColId ? null : col.id)}
                onDoubleClick={() => { setEditColId(col.id); setEditColName(col.name); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  activeColId === col.id ? "border-transparent text-[#0a0a0f]" : "border-border text-text-muted hover:border-border/80"
                }`}
                style={activeColId === col.id ? { background: "var(--gold,#C9A227)" } : {}}
                title="Doble tap para renombrar"
              >
                <FolderOpen size={11}/> {col.name} ({col.post_ids.length})
              </button>
            )}
            {activeColId === col.id && editColId !== col.id && (
              <div className="flex gap-0.5">
                <button onClick={() => { setEditColId(col.id); setEditColName(col.name); }} className="p-1 text-text-muted hover:text-amber-400">
                  <Pencil size={11}/>
                </button>
                <button onClick={() => handleDeleteCollection(col.id)} className="p-1 text-text-muted hover:text-status-error">
                  <Trash2 size={11}/>
                </button>
              </div>
            )}
          </div>
        ))}

        {/* New collection */}
        <button
          onClick={() => { const name = prompt("Nombre de la colección:"); if (name?.trim()) handleCreateCollection(name.trim()); }}
          className="flex-shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full border border-dashed border-border text-xs text-text-muted hover:border-amber-400/50 hover:text-amber-400 transition-all"
        >
          <Plus size={11}/> Nueva
        </button>
      </div>

      {/* Empty collection state */}
      {activeCollection && displayPosts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-20 px-8 text-center">
          <FolderOpen size={36} className="text-text-muted opacity-40" />
          <div>
            <p className="font-semibold mb-1">Colección vacía</p>
            <p className="text-sm text-text-muted">Tocá el ícono <Plus size={12} className="inline"/> en cualquier post para agregarlo a "{activeCollection.name}".</p>
          </div>
          <button onClick={() => setActiveColId(null)} className="text-sm text-amber-400 hover:underline">Ver todos los guardados</button>
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {[...Array(9)].map((_, i) => (
            <div key={i} className="aspect-square" style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite" }}/>
          ))}
        </div>
      )}

      {/* Empty all saved */}
      {!loading && !activeColId && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.25)" }}>
            <Bookmark size={28} style={{ color: "var(--gold,#C9A227)" }} />
          </div>
          <div>
            <p className="font-semibold mb-1">Sin publicaciones guardadas</p>
            <p className="text-sm text-text-muted leading-relaxed">Tocá el ícono 🔖 en cualquier publicación para guardarla acá.</p>
          </div>
          <button onClick={() => navigate("/feed")} className="px-6 py-2.5 rounded-full text-sm font-medium" style={{ background: "var(--gold,#C9A227)", color: "#0a0a0f" }}>Ir al feed</button>
        </div>
      )}

      {/* Grid */}
      {!loading && displayPosts.length > 0 && (
        <div className="max-w-lg mx-auto pb-[80px]">
          <div className="grid grid-cols-3 gap-0.5">
            {displayPosts.map(post => (
              <PostThumb
                key={post.id}
                post={post}
                onClick={() => setSelected(post)}
                onAddToCollection={setPickerPost}
                inAnyCollection={collections.some(c => c.post_ids.includes(post.id))}
              />
            ))}
          </div>

          <div className="py-6 flex justify-center">
            {loadingMore && <div className="w-5 h-5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"/>}
            {!loadingMore && hasMore && !activeColId && (
              <button onClick={loadMore} className="text-sm text-text-muted hover:text-text-primary transition-colors px-6 py-2 border border-border rounded-full">
                Cargar más
              </button>
            )}
            {!loadingMore && !hasMore && displayPosts.length > 0 && (
              <p className="text-[10px] text-text-muted tracking-widest uppercase">
                {displayPosts.length} guardado{displayPosts.length !== 1 ? "s" : ""}
                {activeCollection ? ` en "${activeCollection.name}"` : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Post modal */}
      {selected && user && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setSelected(null)}>
          <div className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-bg-card overscroll-contain" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-bg-card z-10">
              <span className="text-sm font-medium">Publicación guardada</span>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-bg-muted text-text-muted"><ChevronLeft size={18} className="rotate-90"/></button>
            </div>
            <PostCard post={selected as any} currentUserId={user.id} initialSaved={true} onDelete={id => handleUnsave(id)} />
          </div>
        </div>
      )}

      {/* Collection picker */}
      {pickerPost && (
        <CollectionPicker
          post={pickerPost}
          collections={collections}
          onAdd={handleAddToCollection}
          onRemove={handleRemoveFromCollection}
          onCreate={handleCreateCollection}
          onClose={() => setPickerPost(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
