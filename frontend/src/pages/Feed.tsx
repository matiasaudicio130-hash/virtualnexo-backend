import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, X } from "lucide-react";
import { SlidersHorizontal, MagnifyingGlass, MapPin } from "@phosphor-icons/react";
import { NavLogo }    from "@/components/AuraLogo";
import { feedApi, adsApi, followsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { PostCard }   from "@/components/PostCard";
import { StoryBar }   from "@/components/StoryBar";
import { CreatePost } from "@/components/CreatePost";
import { AdBanner }   from "@/components/AdBanner";
import { BottomNav }  from "@/components/BottomNav";
import type { Post, Story } from "@/types";
import type { Ad } from "@/components/AdBanner";

// Anuncios: según membresía
const ADS_EVERY_NONE     = 5;   // sin membresía
const ADS_EVERY_MEMBER   = 10;  // mensual / anual
const LIMIT = 12;

// ── Photon (Komoot/OSM) geocoding ─────────────────────────────
interface CityResult {
  name: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
}

async function searchCities(q: string): Promise<CityResult[]> {
  if (q.length < 2) return [];
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&lang=es&limit=6`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data.features || [])
      .filter((f: any) => f.properties?.name && f.geometry?.coordinates)
      .map((f: any) => ({
        name:        f.properties.name,
        country:     f.properties.country || "",
        countryCode: (f.properties.countrycode || "").toLowerCase(),
        lat:         f.geometry.coordinates[1],
        lng:         f.geometry.coordinates[0],
      }));
  } catch {
    return [];
  }
}

// Emoji de bandera a partir de código de país
function flagEmoji(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const base = 0x1f1e6;
  const chars = [...code.toUpperCase()].map(c => String.fromCodePoint(base + c.charCodeAt(0) - 65));
  return chars.join("");
}

// ── Skeleton de post ──────────────────────────────────────────
function PostSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden border border-border/60" style={{ background: "#0e0c09" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full" style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite" }} />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 rounded-full w-24" style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite" }} />
          <div className="h-2 rounded-full w-16" style={{ background: "#141210", animation: "aura-pulse 2s ease-in-out infinite 0.3s" }} />
        </div>
      </div>
      {/* Image */}
      <div className="h-72 w-full" style={{ background: "linear-gradient(135deg, #141210 0%, #0e0c09 100%)", animation: "aura-pulse 2s ease-in-out infinite 0.1s" }} />
      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <div className="h-4 w-10 rounded-full" style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite 0.2s" }} />
        <div className="h-4 w-10 rounded-full" style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite 0.3s" }} />
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────
export default function Feed() {
  const { user } = useAuthStore();

  // Feed state
  const [posts, setPosts]             = useState<Post[]>([]);
  const [loading, setLoading]         = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore]         = useState(true);
  const [offset, setOffset]           = useState(0);
  const [showCreate, setShowCreate]   = useState(false);
  const [feedTab, setFeedTab]         = useState<"all" | "following">("all");
  const [feedAds, setFeedAds]         = useState<Ad[]>([]);
  const [selectedStory, setSelectedStory] = useState<Story | null>(null);
  const sentinelRef                   = useRef<HTMLDivElement>(null);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [radius, setRadius]           = useState(100);
  const [mundial, setMundial]         = useState(false);

  // GPS
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  // Búsqueda de ciudad (Photon)
  const [cityQuery, setCityQuery]         = useState("");
  const [citySuggestions, setCitySuggestions] = useState<CityResult[]>([]);
  const [selectedCity, setSelectedCity]   = useState<CityResult | null>(null);
  const [loadingCities, setLoadingCities] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScreenCapture({ warn: true });

  // GPS
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); },
      () => {}
    );
  }, []);

  // Debounced Photon autocomplete
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (cityQuery.length < 2) { setCitySuggestions([]); return; }
    setLoadingCities(true);
    debounceRef.current = setTimeout(async () => {
      const results = await searchCities(cityQuery);
      setCitySuggestions(results);
      setLoadingCities(false);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityQuery]);

  function selectCity(city: CityResult) {
    setSelectedCity(city);
    setCityQuery(city.name);
    setCitySuggestions([]);
  }

  function clearCity() {
    setSelectedCity(null);
    setCityQuery("");
    setCitySuggestions([]);
  }

  // Coordenadas efectivas: ciudad manual > GPS
  const effectiveLat = selectedCity?.lat ?? userLat;
  const effectiveLng = selectedCity?.lng ?? userLng;
  const geoLabel = selectedCity
    ? `${selectedCity.name} · ${mundial ? "Mundial" : `${radius}km`}`
    : userLat ? `Mi ubicación · ${mundial ? "Mundial" : `${radius}km`}` : null;

  function buildParams(off: number) {
    const p: Record<string, any> = { limit: LIMIT, offset: off };
    if (!mundial) p.radius_km = radius;
    if (effectiveLat && effectiveLng) {
      p.lat = effectiveLat;
      p.lng = effectiveLng;
    }
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
        setHasMore(false);
      } else {
        const { data } = await feedApi.getFeed(buildParams(0));
        newPosts = data.posts || [];
        setHasMore(newPosts.length === LIMIT);
        adsApi.feedAds("banner", 5).then(r => setFeedAds(r.data)).catch(() => {});
      }
      setPosts(newPosts);
    } catch { /* ignore */ }
    setLoading(false);
  }, [radius, mundial, effectiveLat, effectiveLng, feedTab]);

  useEffect(() => { loadFeed(); }, [loadFeed]);

  // Infinite scroll
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
  }, [offset, loadingMore, hasMore, loading, radius, mundial, effectiveLat, effectiveLng]);

  function removePost(id: string) {
    setPosts(ps => ps.filter(p => p.id !== id));
  }

  // Frecuencia de ads según membresía
  const adsEvery = user?.membership_type && user.membership_type !== "none"
    ? (user.membership_type === "lifetime" ? Infinity : ADS_EVERY_MEMBER)
    : ADS_EVERY_NONE;

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center justify-between">
        <NavLogo />
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`p-2 rounded-xl transition-colors ${showFilters ? "bg-bg-muted" : "hover:bg-bg-muted"}`}
            aria-label="Filtros"
          >
            <SlidersHorizontal
              size={18}
              weight="light"
              style={{ color: showFilters ? "var(--gold, #C9A227)" : undefined }}
              className="text-text-muted"
            />
          </button>
        </div>
      </header>

      {/* ── Tabs ───────────────────────────────────────────────── */}
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

      {/* ── Panel de filtros (rediseñado) ──────────────────────── */}
      {showFilters && (
        <div className="border-b border-border bg-bg-card px-4 py-4 space-y-4">

          {/* Búsqueda de ciudad */}
          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2">Ciudad</p>
            <div className="relative">
              <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-bg-muted transition-colors ${
                cityQuery ? "border-[rgba(201,162,39,0.4)]" : "border-border"
              }`}>
                <MagnifyingGlass size={14} weight="light" className="text-text-muted flex-shrink-0" />
                <input
                  value={cityQuery}
                  onChange={e => setCityQuery(e.target.value)}
                  placeholder="¿En qué ciudad querés buscar?"
                  className="flex-1 bg-transparent text-sm outline-none placeholder:text-text-muted/60"
                  autoComplete="off"
                />
                {cityQuery && (
                  <button onClick={clearCity} className="text-text-muted hover:text-text-primary">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Autocomplete dropdown */}
              {(citySuggestions.length > 0 || loadingCities) && cityQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-bg-card border border-border rounded-xl overflow-hidden shadow-xl">
                  {loadingCities && (
                    <div className="px-4 py-3 text-xs text-text-muted">Buscando…</div>
                  )}
                  {citySuggestions.map((city, i) => (
                    <button
                      key={i}
                      onClick={() => selectCity(city)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-muted transition-colors text-left"
                    >
                      <span className="text-lg leading-none flex-shrink-0">{flagEmoji(city.countryCode)}</span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{city.name}</p>
                        <p className="text-xs text-text-muted truncate">{city.country}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Info GPS */}
            {userLat && !selectedCity && (
              <p className="text-xs text-text-muted mt-2 flex items-center gap-1.5">
                <MapPin size={11} weight="light" style={{ color: "var(--gold, #C9A227)" }} />
                GPS activo · usando tu ubicación real. Seleccioná una ciudad para sobreescribirlo.
              </p>
            )}
          </div>

          {/* Slider de radio */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Radio</p>
              <span
                className="text-sm font-semibold tabular-nums"
                style={{ color: "var(--gold, #C9A227)", fontFamily: "var(--font-mono)" }}
              >
                {mundial ? "Mundial" : `${radius} km`}
              </span>
            </div>

            <input
              type="range"
              min={5}
              max={500}
              step={5}
              value={radius}
              disabled={mundial}
              onChange={e => { setMundial(false); setRadius(Number(e.target.value)); }}
              className="w-full accent-[#C9A227] disabled:opacity-40"
              style={{ cursor: mundial ? "not-allowed" : "pointer" }}
            />
            <div className="flex justify-between text-[9px] text-text-muted mt-1 px-0.5">
              <span>5</span><span>25</span><span>100</span><span>250</span><span>500</span>
              <button
                onClick={() => setMundial(v => !v)}
                className={`text-[9px] font-medium transition-colors ${
                  mundial ? "text-[#C9A227]" : "text-text-muted hover:text-text-primary"
                }`}
              >
                Mundial
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-lg mx-auto pb-[100px]">

        {/* ── Stories ─────────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          <StoryBar
            province={selectedCity?.name || user.province || undefined}
            onSelectStory={s => setSelectedStory(s)}
          />
        </div>

        {/* ── Geo pill contextual ──────────────────────────────── */}
        {geoLabel && (
          <div className="px-4 pb-2">
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
              style={{
                background: "rgba(201,162,39,0.08)",
                border: "1px solid rgba(201,162,39,0.25)",
                color: "var(--gold, #C9A227)",
                fontFamily: "var(--font-sans)",
              }}
            >
              <MapPin size={11} weight="fill" />
              <span>{geoLabel}</span>
              <button
                onClick={() => { clearCity(); setMundial(false); setRadius(100); }}
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                aria-label="Limpiar filtro"
              >
                <X size={11} />
              </button>
            </div>
          </div>
        )}

        {/* ── Posts ───────────────────────────────────────────── */}
        <div className="space-y-4 px-4 pt-2">
          {loading && posts.length === 0 && [1, 2, 3].map(i => <PostSkeleton key={i} />)}

          {!loading && posts.length === 0 && (
            <div className="text-center py-16 text-text-muted">
              <div className="w-14 h-14 rounded-full border border-border flex items-center justify-center mx-auto mb-4 bg-bg-muted">
                <MagnifyingGlass size={22} weight="light" className="text-text-muted" />
              </div>
              <p className="font-semibold mb-1">
                {selectedCity
                  ? `Todavía no hay muchos miembros cerca de ${selectedCity.name}`
                  : "No hay publicaciones cerca"}
              </p>
              <p className="text-sm text-text-muted/70">
                {selectedCity
                  ? "Los que hay son reales. Expandí el radio o buscá otra ciudad."
                  : "Probá expandir el radio o seleccioná una ciudad."}
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="mt-6 px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90"
                style={{ background: "var(--gold, #C9A227)", color: "#0a0a0f" }}
              >
                Sé el primero en publicar
              </button>
            </div>
          )}

          {/* Sin ad fijo al tope — va intercalado según membresía */}
          {(posts as any[]).map((post, idx) => (
            <div key={post.id}>
              <PostCard post={post} currentUserId={user.id} onDelete={removePost} />
              {/* Ad intercalado según plan — vitalicios no ven ads */}
              {feedAds.length > 0 &&
                isFinite(adsEvery) &&
                (idx + 1) % adsEvery === 0 && (
                  <AdBanner
                    ad={feedAds[(Math.floor(idx / adsEvery)) % feedAds.length]}
                  />
              )}
            </div>
          ))}
        </div>

        {/* Sentinel infinite scroll */}
        <div ref={sentinelRef} className="py-4 flex justify-center">
          {loadingMore && (
            <div className="w-5 h-5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"/>
          )}
          {!hasMore && posts.length > 0 && (
            <p className="text-[10px] text-text-muted tracking-widest uppercase">Ya viste todo</p>
          )}
        </div>
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-[76px] right-4 w-12 h-12 bg-accent-purple rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform z-30"
        aria-label="Nueva publicación"
      >
        <Plus size={22} />
      </button>

      {showCreate && (
        <CreatePost
          onCreated={() => { setShowCreate(false); loadFeed(); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {selectedStory && (
        <StoryViewer story={selectedStory} onClose={() => setSelectedStory(null)} />
      )}

      <BottomNav />
    </div>
  );
}

// ── Story Viewer ──────────────────────────────────────────────
const STORY_EMOJIS = ["❤️", "🔥", "😮", "😂", "👏", "💫"];

function StoryViewer({ story, onClose }: { story: Story; onClose: () => void }) {
  const [idx, setIdx]               = useState(0);
  const [reacted, setReacted]       = useState<string | null>(null);
  const [showEmojis, setShowEmojis] = useState(false);
  const current                     = story.stories[idx];

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
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col"
      onTouchStart={() => {}}
      onTouchEnd={() => {}}
    >
      <div className="flex-shrink-0 pt-safe"
        style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.75) 0%,transparent 100%)" }}>
        <div className="flex gap-1 px-3 pt-3 pb-1">
          {story.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/25">
              <div className={`h-full bg-white ${i < idx ? "w-full" : i === idx ? "w-full animate-[story-progress_5s_linear]" : "w-0"}`}/>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between px-3 py-2">
          <button onClick={onClose} className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/25 flex-shrink-0">
              {story.avatar
                ? <img src={story.avatar} alt="" className="w-full h-full object-cover"/>
                : <div className="w-full h-full bg-white/10"/>}
            </div>
            <span className="text-white text-sm font-semibold drop-shadow">{story.name}</span>
          </button>
          <button onClick={onClose} className="w-10 h-10 flex items-center justify-center text-white/80">
            <X size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {current.media_url
          ? <img src={current.media_url} alt="" draggable={false}
              onContextMenu={e => e.preventDefault()}
              className="w-full h-full object-contain select-none pointer-events-none"/>
          : <div className="w-full h-full flex items-center justify-center text-white/30">Sin imagen</div>
        }
        <div className="absolute inset-0 flex" style={{ bottom: 80 }}>
          <div className="w-1/3 h-full" onClick={prev}/>
          <div className="w-2/3 h-full" onClick={next}/>
        </div>
      </div>

      <div className="flex-shrink-0 pb-safe"
        style={{ background: "linear-gradient(to top,rgba(0,0,0,.75) 0%,transparent 100%)" }}>
        {showEmojis && (
          <div className="flex justify-center gap-3 px-4 py-3 animate-fade-in">
            {STORY_EMOJIS.map(e => (
              <button key={e} onClick={() => handleReact(e)}
                className="text-3xl hover:scale-125 transition-transform drop-shadow-lg">{e}</button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-3">
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
          {story.stories.length > 1 && (
            <div className="flex gap-1.5">
              {story.stories.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "bg-white w-3" : "bg-white/40 w-1.5"}`}/>
              ))}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes story-progress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
