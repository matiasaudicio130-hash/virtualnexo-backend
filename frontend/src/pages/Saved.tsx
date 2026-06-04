import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, Bookmark, Play, LayoutGrid } from "lucide-react";
import { feedApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { PostCard } from "@/components/PostCard";
import { BottomNav } from "@/components/BottomNav";

interface SavedPost {
  id: string;
  type: string;
  caption?: string;
  media_url?: string;
  media_urls?: { url: string; type?: string }[];
  created_at: string;
  views_count: number;
  save_count?: number;
  extra_data?: any;
  reactions: Record<string, number>;
  viewer_reaction?: string;
  is_story: boolean;
  user_id: string;
  author: { id: string; name: string; avatar?: string; province?: string; profile_type?: string; username?: string };
}

const LIMIT = 30;

export default function Saved() {
  const navigate        = useNavigate();
  const { user }        = useAuthStore();
  const [posts, setPosts]         = useState<SavedPost[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]     = useState(true);
  const [offset, setOffset]       = useState(0);
  const [selected, setSelected]   = useState<SavedPost | null>(null);

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

  useEffect(() => { load(0); }, [load]);

  function loadMore() {
    if (loadingMore || !hasMore) return;
    const next = offset + LIMIT;
    setOffset(next);
    load(next, true);
  }

  // Remove post from list when unsaved
  function handleUnsave(postId: string) {
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (selected?.id === postId) setSelected(null);
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl hover:bg-bg-muted transition-colors text-text-muted hover:text-text-primary"
        >
          <ChevronLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Guardados</h1>
          {!loading && (
            <p className="text-[10px] text-text-muted">
              {posts.length} publicación{posts.length !== 1 ? "es" : ""}
            </p>
          )}
        </div>
        <Bookmark size={18} style={{ color: "var(--gold,#C9A227)" }} />
      </header>

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-3 gap-0.5 p-0.5">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="aspect-square"
              style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite" }}
            />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-4 py-24 px-8 text-center">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.25)" }}
          >
            <Bookmark size={28} style={{ color: "var(--gold,#C9A227)" }} />
          </div>
          <div>
            <p className="font-semibold mb-1">Sin publicaciones guardadas</p>
            <p className="text-sm text-text-muted leading-relaxed">
              Tocá el ícono 🔖 en cualquier publicación del feed para guardarla acá.
            </p>
          </div>
          <button
            onClick={() => navigate("/feed")}
            className="px-6 py-2.5 rounded-full text-sm font-medium"
            style={{ background: "var(--gold,#C9A227)", color: "#0a0a0f" }}
          >
            Ir al feed
          </button>
        </div>
      )}

      {/* Grid */}
      {!loading && posts.length > 0 && (
        <div className="max-w-lg mx-auto pb-[80px]">
          <div className="grid grid-cols-3 gap-0.5">
            {posts.map(post => {
              const thumb = post.media_url
                || (Array.isArray(post.media_urls) && post.media_urls[0]?.url)
                || null;
              const isVideo = Array.isArray(post.media_urls)
                ? post.media_urls[0]?.type === "video"
                : /\.(mp4|mov|webm)/i.test(post.media_url || "");
              const isMulti = Array.isArray(post.media_urls) && post.media_urls.length > 1;
              const isText  = !thumb;

              return (
                <button
                  key={post.id}
                  className="aspect-square relative overflow-hidden bg-bg-muted group"
                  onClick={() => setSelected(post)}
                >
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-3 bg-bg-card">
                      <p className="text-[10px] text-text-muted text-center line-clamp-5 leading-tight">
                        {post.caption || "Post de texto"}
                      </p>
                    </div>
                  )}

                  {/* Type badges */}
                  {isVideo && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                      <Play size={9} className="text-white" fill="white" />
                    </div>
                  )}
                  {isMulti && (
                    <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center">
                      <LayoutGrid size={9} className="text-white" />
                    </div>
                  )}

                  {/* Hover overlay */}
                  {!isText && (
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Load more */}
          <div className="py-6 flex justify-center">
            {loadingMore && (
              <div className="w-5 h-5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin" />
            )}
            {!loadingMore && hasMore && (
              <button
                onClick={loadMore}
                className="text-sm text-text-muted hover:text-text-primary transition-colors px-6 py-2 border border-border rounded-full"
              >
                Cargar más
              </button>
            )}
            {!loadingMore && !hasMore && posts.length > 0 && (
              <p className="text-[10px] text-text-muted tracking-widest uppercase">
                {posts.length} publicación{posts.length !== 1 ? "es" : ""} guardada{posts.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Post modal */}
      {selected && user && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-bg-card overscroll-contain"
            onClick={e => e.stopPropagation()}
          >
            {/* Close bar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-bg-card z-10">
              <span className="text-sm font-medium">Publicación guardada</span>
              <button
                onClick={() => setSelected(null)}
                className="p-1.5 rounded-lg hover:bg-bg-muted text-text-muted transition-colors"
              >
                <ChevronLeft size={18} className="rotate-90" />
              </button>
            </div>
            <PostCard
              post={selected as any}
              currentUserId={user.id}
              initialSaved={true}
              onDelete={id => handleUnsave(id)}
            />
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
