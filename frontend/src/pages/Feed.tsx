import { useState, useEffect, useRef, useCallback } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import { SlidersHorizontal, MagnifyingGlass, MapPin, PaperPlaneTilt, Plus, X, Airplane } from "@phosphor-icons/react";
import { NavLogo }    from "@/components/AuraLogo";
import { feedApi, adsApi, followsApi, messagingApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useTravelStore } from "@/store/travelStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { PostCard }   from "@/components/PostCard";
import { StoryBar }   from "@/components/StoryBar";
import { CreatePost } from "@/components/CreatePost";
import { AdBanner }   from "@/components/AdBanner";
import { BottomNav }        from "@/components/BottomNav";
import { PushPromptBanner } from "@/components/PushPromptBanner";
import type { Post, Story } from "@/types";
import type { Ad } from "@/components/AdBanner";

// Anuncios: según membresía
const ADS_EVERY_NONE     = 5;   // sin membresía
const ADS_EVERY_MEMBER   = 10;  // mensual / anual
const LIMIT = 12;

// ── Photon (Komoot/OSM) geocoding ─────────────────────────────
interface CityResult {
  name: string;
  state: string;
  country: string;
  countryCode: string;
  lat: number;
  lng: number;
  display: string;
}

async function searchCities(q: string): Promise<CityResult[]> {
  if (q.length < 2) return [];
  // Nominatim (OSM oficial) — filtra por featuretype=settlement: ciudades, pueblos, villas
  const params = new URLSearchParams({
    q,
    format:         "json",
    limit:          "8",
    addressdetails: "1",
    featuretype:    "settlement",
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        signal:  controller.signal,
        headers: { "Accept-Language": "es,en;q=0.9" },
      }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data: any[] = await res.json();
    const seen    = new Set<string>();
    const results: CityResult[] = [];
    for (const item of data) {
      const addr    = item.address || {};
      const name    = addr.city || addr.town || addr.village || addr.hamlet
                   || addr.suburb || item.name
                   || (item.display_name || "").split(",")[0];
      if (!name) continue;
      const state      = addr.state || addr.county || "";
      const country    = addr.country || "";
      const key        = `${name}|${country}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push({
        name,
        state,
        country,
        countryCode: (addr.country_code || "").toLowerCase(),
        lat:     parseFloat(item.lat),
        lng:     parseFloat(item.lon),
        display: [name, state, country].filter(Boolean).join(", "),
      });
      if (results.length === 6) break;
    }
    return results;
  } catch {
    clearTimeout(timer);
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
  const navigate        = useNavigate();
  const { user }        = useAuthStore();
  const { travelCity }  = useTravelStore();
  const queryClient     = useQueryClient();
  const [searchParams] = useSearchParams();

  // Scroll al post específico cuando se llega desde una notificación (?post=ID)
  useEffect(() => {
    const postId = searchParams.get("post");
    if (!postId) return;
    const tryScroll = (attempts = 0) => {
      const el = document.getElementById(`post-${postId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-accent-purple/60", "ring-offset-2", "ring-offset-bg-base");
        setTimeout(() => el.classList.remove("ring-2", "ring-accent-purple/60", "ring-offset-2", "ring-offset-bg-base"), 3000);
      } else if (attempts < 8) {
        setTimeout(() => tryScroll(attempts + 1), 500);
      }
    };
    tryScroll();
  }, [searchParams]);

  // Feed state
  const [removedIds, setRemovedIds]         = useState(new Set<string>());
  const [showCreate, setShowCreate]         = useState(false);
  const [feedTab, setFeedTab]               = useState<"all" | "following">("all");
  const [feedAds, setFeedAds]               = useState<Ad[]>([]);
  const [allStories, setAllStories]         = useState<Story[]>([]);
  const [selectedStoryIdx, setSelectedStoryIdx] = useState<number | null>(null);
  const sentinelRef                         = useRef<HTMLDivElement>(null);

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
    setCityQuery(city.display);
    setCitySuggestions([]);
  }

  function clearCity() {
    setSelectedCity(null);
    setCityQuery("");
    setCitySuggestions([]);
  }

  // Coordenadas efectivas: Modo Viaje > ciudad manual > GPS
  const effectiveLat = travelCity?.lat ?? selectedCity?.lat ?? userLat;
  const effectiveLng = travelCity?.lng ?? selectedCity?.lng ?? userLng;
  const geoLabel = travelCity
    ? `✈ ${travelCity.name} · ${mundial ? "Mundial" : `${radius}km`}`
    : selectedCity
      ? `${selectedCity.display} · ${mundial ? "Mundial" : `${radius}km`}`
      : userLat ? `Mi ubicación · ${mundial ? "Mundial" : `${radius}km`}` : null;

  const {
    data: feedData,
    isLoading: loading,
    isFetchingNextPage: loadingMore,
    hasNextPage: hasMore,
    fetchNextPage,
    isError: feedError,
    refetch: refetchFeed,
  } = useInfiniteQuery({
    queryKey: ["feed", feedTab, effectiveLat ?? 0, effectiveLng ?? 0, radius, mundial] as const,
    queryFn: async ({ pageParam }: { pageParam: number }) => {
      if (feedTab === "following") {
        const { data } = await followsApi.followingFeed({ limit: LIMIT, offset: pageParam });
        return { posts: (data.posts || []) as Post[], next_offset: 0, has_more: false };
      }
      const p: Record<string, any> = { limit: LIMIT, offset: pageParam };
      if (!mundial) p.radius_km = radius;
      if (effectiveLat && effectiveLng) { p.lat = effectiveLat; p.lng = effectiveLng; }
      const { data } = await feedApi.getFeed(p);
      if (pageParam === 0) {
        adsApi.feedAds("banner", 5).then(r => {
          // Filtrar placeholders hasta tener anunciantes reales
          const real = (r.data as Ad[]).filter(a =>
            !/(ejemplo|placeholder|test|demo)/i.test(a.advertiser?.name ?? "")
          );
          setFeedAds(real);
        }).catch(() => {});
      }
      return {
        posts: (data.posts || []) as Post[],
        next_offset: data.next_offset ?? (pageParam + LIMIT),
        has_more: data.has_more ?? ((data.posts?.length ?? 0) === LIMIT),
      };
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_offset : undefined,
    staleTime: 2 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const posts = (feedData?.pages.flatMap(p => p.posts) ?? []).filter(p => !removedIds.has(p.id));

  function removePost(id: string) {
    setRemovedIds(prev => new Set([...prev, id]));
  }

  const handlePullRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ["feed"] });
  }, [queryClient]);

  const { dist: pullDist, refreshing: pullRefreshing } = usePullToRefresh(handlePullRefresh);

  // Infinite scroll — no disparar mientras el pull-to-refresh está activo
  useEffect(() => {
    if (!sentinelRef.current) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && hasMore && !loadingMore && !loading && !pullRefreshing) fetchNextPage();
    }, { threshold: 0.1 });
    obs.observe(sentinelRef.current);
    return () => obs.disconnect();
  }, [hasMore, loadingMore, loading, fetchNextPage, pullRefreshing]);

  // Frecuencia de ads según membresía
  const adsEvery = user?.membership_type && user.membership_type !== "none"
    ? (user.membership_type === "lifetime" ? Infinity : ADS_EVERY_MEMBER)
    : ADS_EVERY_NONE;

  if (!user) return <GuestFeedGate />;

  // Usuarios autenticados con estado no activo → redirect según estado
  if (user.status === "pending_email")  return <Navigate to="/verificar-email" replace />;
  if (user.status === "pending_kyc")    return <Navigate to="/kyc" replace />;
  if (user.status === "pending_manual") return <Navigate to="/aprobacion-pendiente" replace />;
  if (user.status === "suspended" || user.status === "rejected") return <Navigate to="/acceso-denegado" replace />;

  // Onboarding pendiente
  const onboardingDone = !!localStorage.getItem("onboarding_done");
  if (!onboardingDone && (user as any).role !== "admin" && (!user.profile_photo_url || !(user as any).province)) {
    return <Navigate to="/onboarding" replace />;
  }

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

      {/* ── Banner Modo Viaje activo ───────────────────────────── */}
      {travelCity && (
        <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-border/60 bg-bg-card/60">
          <div className="flex items-center gap-2 min-w-0">
            <Airplane size={14} weight="fill" style={{ color: "var(--gold,#C9A227)", flexShrink: 0 }} />
            <span className="text-xs text-text-secondary truncate">
              Modo Viaje activo — <span style={{ color: "var(--gold,#C9A227)" }}>{travelCity.name}</span>
            </span>
          </div>
          <button
            onClick={() => { const { clearTravel } = useTravelStore.getState(); clearTravel(); queryClient.invalidateQueries({ queryKey: ["feed"] }); }}
            className="text-[10px] text-text-muted hover:text-text-primary flex-shrink-0"
          >
            Desactivar
          </button>
        </div>
      )}

      {/* ── Pull-to-refresh indicator ──────────────────────────── */}
      {(pullDist > 0 || pullRefreshing) && (
        <div
          className="flex items-center justify-center overflow-hidden transition-all duration-200"
          style={{ height: pullDist > 0 ? pullDist : pullRefreshing ? 44 : 0 }}
        >
          <div
            className={`w-8 h-8 rounded-full border-2 border-[var(--ash)] border-t-[var(--gold)] ${pullRefreshing ? "animate-spin" : ""}`}
            style={{ transform: pullRefreshing ? undefined : `rotate(${(pullDist / 72) * 180}deg)` }}
          />
        </div>
      )}

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <div className="flex border-b border-border/60">
        {(["all", "following"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => { setFeedTab(tab); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
                  className="flex-1 bg-transparent outline-none placeholder:text-text-muted/60"
                  style={{ fontSize: "16px" }}
                  inputMode="search"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  onFocus={e => {
                    setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "center" }), 350);
                  }}
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
                        <p className="text-xs text-text-muted truncate">
                          {[city.state, city.country].filter(Boolean).join(", ")}
                        </p>
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
            onStoriesLoaded={setAllStories}
            onSelectStory={(_, i) => setSelectedStoryIdx(i)}
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
              {feedTab === "following" ? (
                <>
                  <p className="font-semibold mb-1">Todavía no seguís a nadie</p>
                  <p className="text-sm text-text-muted/70">Seguí personas para ver sus publicaciones acá.</p>
                  <button
                    onClick={() => navigate("/explore")}
                    className="mt-6 px-6 py-2.5 rounded-full text-sm font-medium transition-all hover:opacity-90"
                    style={{ background: "var(--gold, #C9A227)", color: "#0a0a0f" }}
                  >
                    Explorar personas
                  </button>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          )}

          {/* Sin ad fijo al tope — va intercalado según membresía */}
          {(posts as any[]).map((post, idx) => (
            <div key={post.id} id={`post-${post.id}`}>
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
        <div ref={sentinelRef} className="py-4 flex flex-col items-center gap-2">
          {loadingMore && (
            <div className="w-5 h-5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"/>
          )}
          {feedError && !loadingMore && (
            <div className="flex flex-col items-center gap-2">
              <p className="text-xs text-text-muted">No se pudieron cargar más publicaciones.</p>
              <button
                onClick={() => refetchFeed()}
                className="text-xs px-4 py-1.5 rounded-full border border-border text-text-muted hover:text-text-primary transition-colors"
              >
                Reintentar
              </button>
            </div>
          )}
          {!hasMore && posts.length > 0 && !feedError && (
            <p className="text-[10px] text-text-muted tracking-widest uppercase">Ya viste todo</p>
          )}
        </div>
      </main>

      {/* FAB */}
      <button
        onClick={() => setShowCreate(true)}
        className="fixed bottom-[76px] right-4 w-12 h-12 bg-accent-purple rounded-full shadow-lg flex items-center justify-center text-white hover:scale-105 active:scale-95 transition-transform z-50"
        aria-label="Nueva publicación"
      >
        <Plus size={22} />
      </button>

      {showCreate && (
        <CreatePost
          onCreated={() => { setShowCreate(false); queryClient.invalidateQueries({ queryKey: ["feed"] }); }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {selectedStoryIdx !== null && allStories.length > 0 && (
        <StoryViewer
          stories={allStories}
          initialUserIdx={selectedStoryIdx}
          onClose={() => setSelectedStoryIdx(null)}
        />
      )}

      <PushPromptBanner />
      <BottomNav />
    </div>
  );
}

// ── Guest feed gate ───────────────────────────────────────────
function GuestFeedGate() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center justify-between">
        <NavLogo />
      </header>
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-4 pb-[100px]">
        {/* Placeholder posts bloqueados */}
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl overflow-hidden border border-border/60" style={{ background: "#0e0c09" }}>
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-9 h-9 rounded-full bg-bg-muted blur-sm" />
              <div className="flex-1 space-y-1.5">
                <div className="h-2.5 rounded-full w-24 bg-bg-muted blur-sm" />
                <div className="h-2 rounded-full w-16 bg-bg-muted/60 blur-sm" />
              </div>
            </div>
            <div className="relative h-72 w-full overflow-hidden">
              <div className="absolute inset-0 blur-xl" style={{ background: "linear-gradient(135deg, #1a1208 0%, #0e0c09 100%)" }} />
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)" }}>
                  <Plus size={22} style={{ color: "var(--gold,#C9A227)" }} />
                </div>
                <p className="text-xs text-text-muted text-center px-8 leading-relaxed">
                  {i === 1 ? "Contenido exclusivo de miembros verificados" : i === 2 ? "Fotos, posts y más — solo para miembros" : "Conectá con personas verificadas con DNI real"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 px-4 py-3">
              <div className="h-4 w-12 rounded-full bg-bg-muted/40 blur-sm" />
              <div className="h-4 w-12 rounded-full bg-bg-muted/40 blur-sm" />
            </div>
          </div>
        ))}
      </main>
      {/* CTA sticky */}
      <div className="fixed bottom-0 left-0 right-0 px-4 pb-safe-4 pt-4" style={{ background: "linear-gradient(to top, #020207 70%, transparent)" }}>
        <div className="max-w-lg mx-auto space-y-2">
          <button
            onClick={() => navigate("/register")}
            className="w-full py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: "var(--gold,#C9A227)", color: "#0a0a0f" }}
          >
            Ver el feed completo — Crear cuenta gratis
          </button>
          <button
            onClick={() => navigate("/login")}
            className="w-full py-3 rounded-2xl text-sm text-text-muted border border-border/60"
          >
            Ya tengo cuenta — Iniciar sesión
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Story Viewer ──────────────────────────────────────────────
const STORY_EMOJIS = ["❤️", "🔥", "😮", "😂", "👏", "💫"];
const STORY_DURATION = 5000;

function storyTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "Ahora";
  if (m < 60) return `${m}m`;
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|webm|m4v|mkv|avi|3gpp)(\?|$)/i.test(url);
}

function StoryViewer({
  stories,
  initialUserIdx,
  onClose,
}: {
  stories: Story[];
  initialUserIdx: number;
  onClose: () => void;
}) {
  const navigate                      = useNavigate();
  const [userIdx, setUserIdx]         = useState(initialUserIdx);
  const [storyIdx, setStoryIdx]       = useState(0);
  const [reacted, setReacted]         = useState<string | null>(null);
  const [showEmojis, setShowEmojis]   = useState(false);
  const [comment, setComment]         = useState("");
  const [sending, setSending]         = useState(false);
  const [sent, setSent]               = useState(false);
  const [paused, _setPaused]          = useState(false);
  const pausedRef                     = useRef(false);
  const holdFired                     = useRef(false);
  const holdTimer                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX                   = useRef(0);
  const inputRef                      = useRef<HTMLInputElement>(null);

  function setPaused(v: boolean) { pausedRef.current = v; _setPaused(v); }

  const currentUser = stories[userIdx];
  const current     = currentUser?.stories[storyIdx];

  function advance() {
    const user = stories[userIdx];
    if (storyIdx < user.stories.length - 1) {
      setStoryIdx(s => s + 1);
    } else if (userIdx < stories.length - 1) {
      setUserIdx(u => u + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }

  function retreat() {
    if (storyIdx > 0) {
      setStoryIdx(s => s - 1);
    } else if (userIdx > 0) {
      const prevLen = stories[userIdx - 1].stories.length;
      setUserIdx(u => u - 1);
      setStoryIdx(prevLen - 1);
    }
  }

  // Auto-advance timer
  useEffect(() => {
    if (paused || !current) return;
    const t = setTimeout(advance, STORY_DURATION);
    return () => clearTimeout(t);
  }, [storyIdx, userIdx, paused]);

  // Mark viewed
  useEffect(() => {
    if (current) feedApi.viewStory(current.id).catch(() => {});
  }, [current?.id]);

  // Reset reaction/comment when user changes
  useEffect(() => {
    setReacted(null);
    setSent(false);
    setComment("");
    setShowEmojis(false);
  }, [userIdx]);

  // Touch: hold to pause, tap to navigate
  function handleTouchStart(e: React.TouchEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input,button,a")) return;
    touchStartX.current = e.touches[0].clientX;
    holdFired.current   = false;
    holdTimer.current   = setTimeout(() => {
      holdFired.current = true;
      setPaused(true);
    }, 180);
  }

  function handleTouchEnd(e: React.TouchEvent) {
    const target = e.target as HTMLElement;
    if (target.closest("input,button,a")) return;
    if (holdTimer.current) clearTimeout(holdTimer.current);
    if (holdFired.current) { setPaused(false); holdFired.current = false; return; }
    const x = e.changedTouches[0].clientX;
    if (x < window.innerWidth / 3) retreat(); else advance();
  }

  // Desktop click zones
  function handleClickLeft()  { retreat(); }
  function handleClickRight() { advance(); }

  async function handleReact(emoji: string) {
    if (!current) return;
    setReacted(emoji);
    setShowEmojis(false);
    setPaused(false);
    try {
      const { highlightsApi } = await import("@/lib/api");
      await highlightsApi.reactStory(current.id, emoji);
    } catch { /* ignore */ }
  }

  async function sendComment() {
    if (!comment.trim() || !currentUser) return;
    setSending(true);
    try {
      const { data: conv } = await messagingApi.startConversation(currentUser.user_id);
      await messagingApi.sendMessage(conv.id, { content: comment.trim() });
      setSent(true);
      setComment("");
      setTimeout(() => setSent(false), 2500);
    } catch { /* ignore */ }
    setSending(false);
    setPaused(false);
    inputRef.current?.blur();
  }

  if (!current) { onClose(); return null; }

  const isVideo = isVideoUrl(current.media_url);

  return (
    <div
      className="fixed inset-0 z-50 bg-black flex flex-col select-none"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Header ─────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 pt-safe"
        style={{ background: "linear-gradient(to bottom,rgba(0,0,0,.8) 0%,transparent 100%)" }}
      >
        {/* Progress bars — one per story of current user */}
        <div className="flex gap-1 px-3 pt-3 pb-1">
          {currentUser.stories.map((_, i) => (
            <div key={i} className="flex-1 h-0.5 rounded-full overflow-hidden bg-white/25">
              {i < storyIdx ? (
                <div className="h-full bg-white w-full" />
              ) : i === storyIdx ? (
                <div
                  key={`${userIdx}-${storyIdx}`}
                  className="h-full bg-white"
                  style={{
                    animation: "story-progress 5s linear forwards",
                    animationPlayState: paused ? "paused" : "running",
                  }}
                />
              ) : (
                <div className="h-full w-0" />
              )}
            </div>
          ))}
        </div>

        {/* User row */}
        <div className="flex items-center justify-between px-3 py-2">
          <button
            onClick={() => { onClose(); navigate(`/profile/${currentUser.user_id}`); }}
            className="flex items-center gap-2.5"
          >
            <div className="w-9 h-9 rounded-full overflow-hidden border border-white/30 flex-shrink-0">
              {currentUser.avatar
                ? <img src={currentUser.avatar} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full bg-white/10" />}
            </div>
            <div className="text-left">
              <p className="text-white text-sm font-semibold leading-tight drop-shadow">
                {currentUser.name}
              </p>
              <p className="text-white/50 text-[10px]">
                {storyTimeAgo(current.created_at)}
              </p>
            </div>
          </button>

          {/* User pagination dots (when multiple users) */}
          {stories.length > 1 && (
            <div className="flex gap-1 items-center">
              {stories.map((_, i) => (
                <div
                  key={i}
                  className={`rounded-full transition-all ${
                    i === userIdx ? "bg-white w-2 h-2" : "bg-white/40 w-1.5 h-1.5"
                  }`}
                />
              ))}
            </div>
          )}

          <button
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-white/80 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* ── Media ──────────────────────────────────────────────── */}
      <div className="flex-1 relative overflow-hidden">
        {current.media_url ? (
          isVideo ? (
            <video
              src={current.media_url}
              className="w-full h-full object-contain"
              autoPlay
              muted
              playsInline
              loop={false}
              onEnded={advance}
            />
          ) : (
            <img
              src={current.media_url}
              alt=""
              draggable={false}
              onContextMenu={e => e.preventDefault()}
              onLoad={() => setPaused(false)}
              onLoadStart={() => setPaused(true)}
              onError={() => advance()}
              className="w-full h-full object-contain pointer-events-none"
            />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/30">
            Sin imagen
          </div>
        )}

        {/* Pause indicator */}
        {paused && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center">
              <div className="flex gap-1.5">
                <div className="w-1.5 h-6 bg-white rounded-full" />
                <div className="w-1.5 h-6 bg-white rounded-full" />
              </div>
            </div>
          </div>
        )}

        {/* Desktop click zones */}
        <div className="hidden sm:flex absolute inset-0">
          <div className="w-1/3 h-full cursor-pointer" onClick={handleClickLeft} />
          <div className="flex-1 h-full cursor-pointer" onClick={handleClickRight} />
        </div>
      </div>

      {/* ── Bottom bar ─────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 pb-safe"
        style={{ background: "linear-gradient(to top,rgba(0,0,0,.85) 0%,transparent 100%)" }}
      >
        {/* Emoji picker */}
        {showEmojis && (
          <div className="flex justify-center gap-3 px-4 py-2">
            {STORY_EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => handleReact(e)}
                className="text-3xl hover:scale-125 active:scale-110 transition-transform drop-shadow-lg"
              >
                {e}
              </button>
            ))}
          </div>
        )}

        {/* Sent confirmation */}
        {sent && (
          <p className="text-center text-white/70 text-xs pb-1">Mensaje enviado ✓</p>
        )}

        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Emoji react button */}
          {reacted ? (
            <span className="text-xl flex-shrink-0">{reacted}</span>
          ) : (
            <button
              onClick={e => {
                e.stopPropagation();
                setShowEmojis(v => !v);
                setPaused(!showEmojis);
              }}
              className="text-xl flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
            >
              😊
            </button>
          )}

          {/* Comment / reply input */}
          <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full border border-white/30 bg-white/10">
            <input
              ref={inputRef}
              value={comment}
              onChange={e => setComment(e.target.value)}
              onFocus={() => setPaused(true)}
              onBlur={() => { if (!comment.trim()) setPaused(false); }}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendComment(); } }}
              placeholder={`Responder a ${currentUser.name}…`}
              className="flex-1 bg-transparent outline-none text-white placeholder:text-white/40 text-sm min-w-0"
              style={{ fontSize: "16px" }}
            />
            {comment.trim() && (
              <button
                onClick={e => { e.stopPropagation(); sendComment(); }}
                disabled={sending}
                className="text-white text-sm font-semibold flex-shrink-0 disabled:opacity-50"
              >
                {sending ? "…" : "Enviar"}
              </button>
            )}
          </div>

          {/* DM shortcut */}
          <button
            onClick={e => {
              e.stopPropagation();
              onClose();
              navigate(`/messages?start=${currentUser.user_id}`);
            }}
            className="flex-shrink-0 text-white/70 hover:text-white transition-colors"
          >
            <PaperPlaneTilt size={22} weight="light" />
          </button>
        </div>
      </div>

      <style>{`@keyframes story-progress { from { width: 0% } to { width: 100% } }`}</style>
    </div>
  );
}
