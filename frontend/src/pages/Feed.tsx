import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, RefreshCw, SlidersHorizontal, User, Plane, MessageSquare, Calendar } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { NavLogo }            from "@/components/AuraLogo";
import { NearbyUsers }        from "@/components/NearbyUsers";
import { ProfileSuggestions } from "@/components/ProfileSuggestions";
import { useGeolocation }     from "@/hooks/useGeolocation";
import { feedApi, adsApi, followsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { PostCard } from "@/components/PostCard";
import { StoryBar } from "@/components/StoryBar";
import { StreakBadge } from "@/components/StreakBadge";
import { CreatePost } from "@/components/CreatePost";
import { AdBanner } from "@/components/AdBanner";
import { APP_CONFIG } from "@/config/app";
import type { Post, Story } from "@/types";
import type { Ad } from "@/components/AdBanner";

const ADS_EVERY_N_POSTS = 3;

const RADIUS_OPTIONS = [50, 100, 200, 500];

export default function Feed() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [posts, setPosts]           = useState<Post[]>([]);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]       = useState(true);
  const [offset, setOffset]         = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [feedTab, setFeedTab]       = useState<"all" | "following">("all");
  const [radius, setRadius]         = useState(100);
  const [province, setProvince]     = useState<string>("");
  const [userLat, setUserLat]       = useState<number | null>(null);
  const [userLng, setUserLng]       = useState<number | null>(null);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const [feedAds, setFeedAds]       = useState<Ad[]>([]);
  const sentinelRef                 = useRef<HTMLDivElement>(null);
  const LIMIT = 12;

  useScreenCapture({ warn: true });
  const { coords } = useGeolocation();

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
        () => {}
      );
    }
  }, []);

  function buildParams(off: number) {
    const p: Record<string, any> = { radius_km: radius, limit: LIMIT, offset: off };
    if (userLat && userLng) { p.lat = userLat; p.lng = userLng; }
    else if (province) p.province = province;
    return p;
  }

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setOffset(0);
    setHasMore(true);
    try {
      let newPosts: Post[] = [];
      if (feedTab === "following") {
        const { data } = await followsApi.followingFeed({ limit: LIMIT, offset: 0 });
        newPosts = data.posts || [];
        setHasMore(false); // following feed no tiene paginación por ahora
      } else {
        const { data } = await feedApi.getFeed(buildParams(0));
        newPosts = data.posts || [];
        setHasMore(newPosts.length === LIMIT);
        adsApi.feedAds("banner", 5).then(r => setFeedAds(r.data)).catch(() => {});
      }
      setPosts(newPosts);
    } catch { /* ignore */ }
    setLoading(false);
  }, [radius, province, userLat, userLng, feedTab]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Infinite scroll con IntersectionObserver
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loadingMore || !hasMore || loading) return;
      setLoadingMore(true);
      try {
        const newOffset = offset + LIMIT;
        const { data } = await feedApi.getFeed(buildParams(newOffset));
        const newPosts = data.posts || [];
        setPosts(prev => [...prev, ...newPosts]);
        setOffset(newOffset);
        setHasMore(newPosts.length === LIMIT);
      } catch { /* ignore */ }
      setLoadingMore(false);
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [offset, loadingMore, hasMore, loading, radius, province, userLat, userLng]);

  function removePost(id: string) {
    setPosts(ps => ps.filter(p => p.id !== id));
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center justify-between">
        <NavLogo />
        <div className="flex items-center gap-2">
          <StreakBadge initialStreak={(user as any).current_streak ?? 0} />
          <button onClick={() => setShowFilters(v => !v)} className="p-2 rounded-xl hover:bg-bg-muted text-text-muted">
            <SlidersHorizontal size={18} />
          </button>
          <button onClick={loadFeed} className="p-2 rounded-xl hover:bg-bg-muted text-text-muted">
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <button onClick={() => navigate("/events")} className="p-2 rounded-xl hover:bg-bg-muted text-text-muted" title="Eventos">
            <Calendar size={18} />
          </button>
          <button onClick={() => navigate("/travel")} className="p-2 rounded-xl hover:bg-bg-muted text-text-muted" title="Modo Viaje">
            <Plane size={18} />
          </button>
          <button onClick={() => navigate("/messages")} className="p-2 rounded-xl hover:bg-bg-muted text-text-muted" title="Mensajes">
            <MessageSquare size={18} />
          </button>
          <NotificationBell />
          <button onClick={() => navigate("/dashboard")} className="p-2 rounded-xl hover:bg-bg-muted text-text-muted" title="Mi cuenta">
            <User size={18} />
          </button>
        </div>
      </header>

      {/* Tabs: Para vos / Siguiendo */}
      <div className="flex border-b border-border/60">
        {(["all", "following"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFeedTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium border-b-2 transition-colors ${
              feedTab === tab
                ? "border-accent-purple text-accent-purple"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {tab === "all" ? "Para vos" : "Siguiendo"}
          </button>
        ))}
      </div>

      {/* Panel de filtros */}
      {showFilters && (
        <div className="border-b border-border bg-bg-card px-4 py-3 space-y-3">
          <div>
            <p className="text-xs text-text-muted mb-2">Radio de búsqueda</p>
            <div className="flex gap-2">
              {RADIUS_OPTIONS.map(r => (
                <button
                  key={r}
                  onClick={() => setRadius(r)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    radius === r
                      ? "bg-accent-purple text-white border-accent-purple"
                      : "bg-bg-muted border-border text-text-secondary"
                  }`}
                >
                  {r}km
                </button>
              ))}
            </div>
          </div>
          {!userLat && (
            <div>
              <p className="text-xs text-text-muted mb-1">Filtrar por provincia</p>
              <input
                value={province}
                onChange={e => setProvince(e.target.value)}
                placeholder="Ej: Buenos Aires"
                className="w-full px-3 py-2 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
              />
            </div>
          )}
          {userLat && (
            <p className="text-xs text-status-success">Ubicación activa · radio {radius}km</p>
          )}
        </div>
      )}

      <main className="max-w-lg mx-auto pb-24">
        {/* Stories */}
        <div className="px-4 pt-4 pb-2">
          <StoryBar
            province={province || user.province || undefined}
            onSelectStory={s => setSelectedStory(s)}
          />
        </div>

        {/* Cerca tuyo */}
        {coords && <NearbyUsers lat={coords.lat} lng={coords.lng} />}

        {/* Sugerencias de perfiles */}
        <ProfileSuggestions />

        {/* Posts */}
        <div className="space-y-4 px-4 pt-2">
          {loading && (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="bg-bg-card border border-border rounded-2xl h-80 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && posts.length === 0 && (
            <div className="text-center py-16 text-text-muted">
              <div className="w-14 h-14 rounded-full bg-bg-muted border border-border flex items-center justify-center mx-auto mb-4">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
              </div>
              <p className="font-medium">No hay publicaciones cerca</p>
              <p className="text-sm mt-1">Probá aumentar el radio o cambiá de provincia.</p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-6 px-6 py-3 bg-accent-purple rounded-2xl text-white text-sm font-semibold hover:bg-accent-purple/90 transition-colors"
              >
                Sé el primero en publicar
              </button>
            </div>
          )}

          {/* Ad fijo al tope si hay anuncios */}
          {feedAds.length > 0 && (
            <AdBanner key={feedAds[0].id} ad={feedAds[0]} />
          )}

          {(posts as any[]).map((post, idx) => (
            <div key={post.id}>
              <PostCard post={post} currentUserId={user.id} onDelete={removePost} />
              {/* Ad adicional cada N posts (rotando) */}
              {feedAds.length > 0 && (idx + 1) % ADS_EVERY_N_POSTS === 0 && (
                <AdBanner
                  ad={feedAds[(Math.floor(idx / ADS_EVERY_N_POSTS) + 1) % feedAds.length]}
                />
              )}
            </div>
          ))}
        </div>

        {/* Sentinel para infinite scroll */}
        <div ref={sentinelRef} className="py-4 flex justify-center">
          {loadingMore && (
            <div className="w-6 h-6 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"/>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-xs text-text-muted tracking-widest uppercase">Ya viste todo</p>
          )}
        </div>
      </main>

      {/* FAB — crear publicación */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-accent-purple rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform z-30"
        aria-label="Nueva publicación"
      >
        <Plus size={24} />
      </button>

      {/* Modal crear post */}
      {showCreate && (
        <CreatePost
          onCreated={() => { setShowCreate(false); loadFeed(); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {/* Story viewer */}
      {selectedStory && (
        <StoryViewer story={selectedStory} onClose={() => setSelectedStory(null)} />
      )}
    </div>
  );
}

// ── Story Viewer mejorado ──────────────────────────────────────
const STORY_EMOJIS = ["❤️","🔥","😮","😂","👏","💫"];

function StoryViewer({ story, onClose }: { story: Story; onClose: () => void }) {
  const [idx, setIdx]           = useState(0);
  const [reacted, setReacted]   = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const [paused, setPaused]     = useState(false);
  const current                 = story.stories[idx];

  useEffect(() => {
    if (current) feedApi.viewStory(current.id).catch(() => {});
  }, [idx]);

  function next() { idx < story.stories.length - 1 ? setIdx(i => i + 1) : onClose(); }
  function prev() { idx > 0 && setIdx(i => i - 1); }

  async function handleReact(emoji: string) {
    if (!current) return;
    setReacted(emoji);
    setShowEmojis(false);
    try {
      const { highlightsApi } = await import("@/lib/api");
      await highlightsApi.reactStory(current.id, emoji);
    } catch { /* ignore */ }
  }

  if (!current) { onClose(); return null; }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onMouseDown={() => setPaused(true)}
      onMouseUp={() => setPaused(false)}
    >
      {/* Top: progress + header */}
      <div className="flex-shrink-0 pt-safe"
        style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.75) 0%,transparent 100%)" }}>

        {/* Progress bars */}
        <div className="flex gap-1 px-3 pt-3 pb-1">
          {story.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/25">
              <div className={`h-full bg-white transition-all ${i < idx ? "w-full" : i === idx ? "w-full animate-[story-progress_5s_linear]" : "w-0"}`}/>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={onClose} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/25 flex-shrink-0">
              {story.avatar
                ? <img src={story.avatar} alt="" className="w-full h-full object-cover"/>
                : <div className="w-full h-full bg-white/10"/>
              }
            </div>
            <span className="text-white text-sm font-semibold drop-shadow">{story.name}</span>
          </button>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white/80">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Image area */}
      <div className="flex-1 relative overflow-hidden">
        {current.media_url ? (
          <img src={current.media_url} alt="" draggable={false}
            onContextMenu={e => e.preventDefault()}
            className="w-full h-full object-contain select-none pointer-events-none"/>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">Sin imagen</div>
        )}

        {/* Tap zones */}
        <div className="absolute inset-0 flex" style={{ bottom: 80 }}>
          <div className="w-1/3 h-full" onClick={prev}/>
          <div className="w-2/3 h-full" onClick={next}/>
        </div>
      </div>

      {/* Bottom: emoji reaction bar */}
      <div className="flex-shrink-0 pb-safe"
        style={{ background: "linear-gradient(to top,rgba(0,0,0,.75) 0%,transparent 100%)" }}>

        {/* Emoji picker expandible */}
        {showEmojis && (
          <div className="flex justify-center gap-3 px-4 py-3 animate-fade-in">
            {STORY_EMOJIS.map(e => (
              <button key={e} onClick={() => handleReact(e)}
                className="text-3xl hover:scale-125 transition-transform drop-shadow-lg">
                {e}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 px-4 py-3">
          {/* Reacted confirmation */}
          {reacted ? (
            <div className="flex items-center gap-2 flex-1">
              <span className="text-2xl">{reacted}</span>
              <span className="text-white/70 text-sm">Reaccionaste</span>
            </div>
          ) : (
            <button
              onClick={() => setShowEmojis(v => !v)}
              className="flex items-center gap-2 flex-1 px-4 py-2.5 rounded-full bg-white/10 border border-white/20 text-white/70 text-sm hover:bg-white/15 transition-colors"
            >
              <span className="text-lg">😊</span>
              <span>Reaccionar</span>
            </button>
          )}

          {/* Nav dots */}
          {story.stories.length > 1 && (
            <div className="flex gap-1.5">
              {story.stories.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-3" : "bg-white/40"}`}/>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes story-progress { from { width: 0% } to { width: 100% } }
      `}</style>
    </div>
  );
}
