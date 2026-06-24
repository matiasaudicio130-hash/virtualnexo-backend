import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";


import { imgUrl } from "@/utils/image";
import { useGeolocation } from "@/hooks/useGeolocation";
import { NearbyUsers } from "@/components/NearbyUsers";
import { ProfileSuggestions } from "@/components/ProfileSuggestions";
import { BottomNav } from "@/components/BottomNav";
import { useAuthStore } from "@/store/authStore";
import { searchApi, followsApi, hashtagsApi } from "@/lib/api";
import { Airplane, CalendarBlank, Clock, Compass, Hash, MagnifyingGlass, MapPin, Tag, UserCircle, X } from "@phosphor-icons/react";


type Tab = "personas" | "interes" | "eventos" | "viaje" | "hashtag";

interface TrendingTag { tag: string; count: number; }
interface HashtagPost { id: string; type: string; caption: string; thumb?: string; author: { id: string; name: string; }; }

const SEEKING_TAGS = [
  { id: "conexion_real",        label: "Conexión real" },
  { id: "duo_femenino",         label: "Dúo femenino" },
  { id: "parejas_abiertas",     label: "Parejas abiertas" },
  { id: "explorar_en_pareja",   label: "Explorar en pareja" },
  { id: "lifestyle_activo",     label: "Lifestyle activo" },
  { id: "mujeres_solas",        label: "Mujeres solas" },
  { id: "hombres_solos",        label: "Hombres solos" },
  { id: "parejas_para_conocer", label: "Parejas para conocer" },
  { id: "viajes",               label: "Viajes" },
  { id: "eventos",              label: "Eventos" },
  { id: "discrecion",           label: "Discreción" },
  { id: "amistad",              label: "Amistad" },
  { id: "explorar_sin_apuro",   label: "Explorar sin apuro" },
  { id: "charlar_y_ver",        label: "Charlar y ver" },
  { id: "planes_y_salidas",     label: "Planes y salidas" },
  { id: "conexiones_reales",    label: "Conexiones reales" },
  { id: "experiencias_nuevas",  label: "Experiencias nuevas" },
  { id: "en_pareja_explorando", label: "En pareja explorando" },
  { id: "solo_curiosidad",      label: "Solo curiosidad" },
];

const RECENT_KEY = "aura_recent_searches";
const MAX_RECENT = 8;

function getRecent(): string[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function saveRecent(q: string) {
  const prev = getRecent().filter(r => r !== q);
  localStorage.setItem(RECENT_KEY, JSON.stringify([q, ...prev].slice(0, MAX_RECENT)));
}
function removeRecent(q: string) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(getRecent().filter(r => r !== q)));
}
function clearRecent() { localStorage.removeItem(RECENT_KEY); }

interface SearchUser  { id: string; name: string; username: string; avatar?: string; profile_type?: string; province?: string; }
interface SearchPost  { id: string; type: string; caption: string; thumb?: string; author: SearchUser; }
interface SearchResults { users: SearchUser[]; posts: SearchPost[]; query: string; }

export default function Explore() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { coords: geoCoords } = useGeolocation();
  const [manualCoords, setManualCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Search state
  const [query,        setQuery]        = useState("");
  const [searching,    setSearching]    = useState(false);
  const [results,      setResults]      = useState<SearchResults | null>(null);
  const [recentList,   setRecentList]   = useState<string[]>(getRecent());
  const [inputFocused, setInputFocused] = useState(false);
  const [followedIds,  setFollowedIds]  = useState<Set<string>>(new Set());
  const inputRef     = useRef<HTMLInputElement>(null);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tabs
  const urlTab       = searchParams.get("tab") as Tab | null;
  const urlTag       = searchParams.get("tag") || "";
  const [tab, setTab]             = useState<Tab>(urlTab ?? "personas");
  const [activeTag, setActiveTag] = useState<string>(urlTag);

  // Trending hashtags
  const [trending,        setTrending]        = useState<TrendingTag[]>([]);
  const [hashtagPosts,    setHashtagPosts]     = useState<HashtagPost[]>([]);
  const [hashtagLoading,  setHashtagLoading]   = useState(false);
  const [activeHashtag,   setActiveHashtag]    = useState(urlTab === "hashtag" ? urlTag : "");

  useEffect(() => {
    if (urlTab) setTab(urlTab as Tab);
    if (urlTag) setActiveTag(urlTag);
    if (urlTab === "hashtag" && urlTag) setActiveHashtag(urlTag);
  }, []);

  // Load trending on mount
  useEffect(() => {
    hashtagsApi.trending().then(r => setTrending(r.data)).catch(() => {});
  }, []);

  // Load hashtag posts when activeHashtag changes
  useEffect(() => {
    if (!activeHashtag) return;
    setHashtagLoading(true);
    hashtagsApi.posts(activeHashtag)
      .then(r => { setHashtagPosts(r.data.posts); setHashtagLoading(false); })
      .catch(() => setHashtagLoading(false));
  }, [activeHashtag]);

  function goToHashtag(tag: string) {
    setActiveHashtag(tag);
    setTab("hashtag");
    setQuery("");
    setResults(null);
    setSearchParams({ tab: "hashtag", tag });
  }

  const coords = manualCoords ?? geoCoords;

  // Debounced search
  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); setSearching(false); return; }
    setSearching(true);
    try {
      const { data } = await searchApi.search(q.trim());
      setResults(data);
    } catch {
      setResults({ users: [], posts: [], query: q });
    }
    setSearching(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults(null); return; }
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    saveRecent(query.trim());
    setRecentList(getRecent());
    runSearch(query.trim());
    inputRef.current?.blur();
  }

  function pickRecent(q: string) {
    setQuery(q);
    runSearch(q);
    inputRef.current?.blur();
    setInputFocused(false);
  }

  function clearSearch() {
    setQuery("");
    setResults(null);
    inputRef.current?.focus();
  }

  async function toggleFollow(userId: string) {
    try {
      if (followedIds.has(userId)) {
        await followsApi.unfollow(userId);
        setFollowedIds(prev => { const n = new Set(prev); n.delete(userId); return n; });
      } else {
        await followsApi.follow(userId);
        setFollowedIds(prev => new Set([...prev, userId]));
      }
    } catch { /* ignore */ }
  }

  const showSearchOverlay = inputFocused && !query.trim();
  const showResults       = !!results;

  if (!user) return null;

  const tabs: { id: Tab; label: string; Icon: any }[] = [
    { id: "personas", label: "Personas",   Icon: Compass       },
    { id: "interes",  label: "Intereses",  Icon: Tag           },
    { id: "hashtag",  label: "Trending",   Icon: Hash          },
    { id: "eventos",  label: "Eventos",    Icon: CalendarBlank },
    { id: "viaje",    label: "Modo Viaje", Icon: Airplane      },
  ];

  function switchTab(t: Tab) {
    setTab(t);
    if (t !== "interes")  setActiveTag("");
    if (t !== "hashtag")  setActiveHashtag("");
    setSearchParams(
      t === "interes" && activeTag  ? { tab: t, tag: activeTag }   :
      t === "hashtag" && activeHashtag ? { tab: t, tag: activeHashtag } :
      { tab: t }
    );
    setQuery("");
    setResults(null);
    setInputFocused(false);
  }

  function selectTag(id: string) {
    const next = activeTag === id ? "" : id;
    setActiveTag(next);
    setSearchParams(next ? { tab: "interes", tag: next } : { tab: "interes" });
  }

  function requestGPS() {
    navigator.geolocation.getCurrentPosition(
      pos => setManualCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => console.warn("GPS denegado:", err.message),
      { timeout: 8000, maximumAge: 60000 },
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">

      {/* ── Header + search bar ──────────────────────────────── */}
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 space-y-3">
        <h1
          className="text-sm tracking-[0.2em] uppercase"
          style={{ color: "var(--gold, #C9A227)", fontFamily: "var(--font-display, 'Cormorant Garamond', serif)" }}
        >
          Explorar
        </h1>

        {/* Search input */}
        <form onSubmit={handleSubmit} className="relative">
          <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-bg-muted transition-colors ${
            inputFocused || query ? "border-[rgba(201,162,39,0.45)]" : "border-border"
          }`}>
            <MagnifyingGlass
              size={16} weight="light"
              style={{ color: inputFocused || query ? "var(--gold,#C9A227)" : undefined }}
              className="text-text-muted flex-shrink-0"
            />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setTimeout(() => setInputFocused(false), 200)}
              placeholder="Buscar personas o publicaciones…"
              className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-muted/60"
              style={{ fontSize: "16px" }}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
            />
            {(query || searching) && (
              <button
                type="button"
                onClick={clearSearch}
                className="text-text-muted hover:text-text-primary transition-colors flex-shrink-0"
              >
                {searching
                  ? <div className="w-3.5 h-3.5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"/>
                  : <X size={14} />
                }
              </button>
            )}
          </div>
        </form>
      </header>

      {/* ── Recent searches overlay ──────────────────────────── */}
      {showSearchOverlay && recentList.length > 0 && (
        <div className="bg-bg-card border-b border-border">
          <div className="flex items-center justify-between px-4 py-2">
            <p className="text-[10px] text-text-muted uppercase tracking-widest">Búsquedas recientes</p>
            <button onClick={() => { clearRecent(); setRecentList([]); }} className="text-[10px] text-text-muted hover:text-accent-purple transition-colors">
              Limpiar
            </button>
          </div>
          {recentList.map(r => (
            <button
              key={r}
              onClick={() => pickRecent(r)}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-bg-muted transition-colors text-left"
            >
              <Clock size={14} weight="light" className="text-text-muted flex-shrink-0" />
              <span className="flex-1 text-sm truncate">{r}</span>
              <button
                onClick={e => { e.stopPropagation(); removeRecent(r); setRecentList(getRecent()); }}
                className="text-text-muted hover:text-text-primary flex-shrink-0 p-1"
              >
                <X size={12} />
              </button>
            </button>
          ))}
        </div>
      )}

      {/* ── Search results ───────────────────────────────────── */}
      {showResults && (
        <div className="max-w-lg mx-auto pb-[80px]">
          {results!.users.length === 0 && results!.posts.length === 0 ? (
            <div className="py-20 text-center">
              <MagnifyingGlass size={36} weight="light" className="mx-auto mb-3 opacity-20" />
              <p className="text-sm text-text-muted">Sin resultados para <strong>"{results!.query}"</strong></p>
              <p className="text-xs text-text-muted/60 mt-1">Probá con un nombre, username o tema</p>
            </div>
          ) : (
            <div className="divide-y divide-border/60">
              {/* Users section */}
              {results!.users.length > 0 && (
                <section className="px-4 pt-4 pb-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">
                    Personas · {results!.users.length}
                  </p>
                  <div className="space-y-1">
                    {results!.users.map(u => (
                      <div
                        key={u.id}
                        className="flex items-center gap-3 py-2 rounded-xl hover:bg-bg-muted px-2 -mx-2 transition-colors cursor-pointer"
                        onClick={() => { saveRecent(query); setRecentList(getRecent()); navigate(`/profile/${u.id}`); }}
                      >
                        {/* Avatar */}
                        <div className="w-11 h-11 rounded-full overflow-hidden bg-bg-muted flex-shrink-0 border border-border">
                          {u.avatar
                            ? <img src={imgUrl(u.avatar, "avatar-md")} alt={u.name} className="w-full h-full object-cover" loading="lazy" decoding="async"/>
                            : <div className="w-full h-full flex items-center justify-center">
                                <UserCircle size={28} weight="light" className="text-text-muted" />
                              </div>
                          }
                        </div>
                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{u.name}</p>
                          <p className="text-xs text-text-muted truncate">
                            {u.username ? `@${u.username}` : ""}
                            {u.province ? ` · ${u.province}` : ""}
                          </p>
                        </div>
                        {/* Follow button */}
                        <button
                          onClick={e => { e.stopPropagation(); toggleFollow(u.id); }}
                          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-medium transition-all ${
                            followedIds.has(u.id)
                              ? "border-border text-text-muted"
                              : "border-transparent text-[#0a0a0f]"
                          }`}
                          style={followedIds.has(u.id) ? {} : { background: "var(--gold,#C9A227)" }}
                        >
                          {followedIds.has(u.id) ? "Siguiendo" : "Seguir"}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Posts section */}
              {results!.posts.length > 0 && (
                <section className="px-4 pt-4 pb-3">
                  <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">
                    Publicaciones · {results!.posts.length}
                  </p>
                  <div className="grid grid-cols-3 gap-1">
                    {results!.posts.map(p => (
                      <button
                        key={p.id}
                        onClick={() => navigate(`/profile/${p.author.id}`)}
                        className="aspect-square rounded-lg overflow-hidden bg-bg-muted relative group"
                      >
                        {p.thumb ? (
                          <img
                            src={p.thumb}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center p-2">
                            <p className="text-[10px] text-text-muted text-center line-clamp-4 leading-tight">
                              {p.caption}
                            </p>
                          </div>
                        )}
                        {/* Author overlay */}
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                          <p className="text-[9px] text-white truncate w-full">{p.author.name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Normal explore (no search active) ───────────────── */}
      {!showResults && (
        <>
          {/* Tab chips */}
          <div className="flex gap-2 px-4 pt-3 pb-2 overflow-x-auto scrollbar-none">
            {tabs.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  onClick={() => switchTab(id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all whitespace-nowrap ${
                    active ? "border-transparent text-[#0a0a0f]" : "border-border text-text-muted hover:border-border/80 bg-transparent"
                  }`}
                  style={active ? { background: "var(--gold, #C9A227)", color: "#0a0a0f" } : {}}
                >
                  <Icon size={13} weight={active ? "fill" : "light"} />
                  {label}
                </button>
              );
            })}
          </div>

          <main className="max-w-lg mx-auto pb-[80px]">
            {tab === "personas" && (
              <>
                {coords ? (
                  <NearbyUsers lat={coords.lat} lng={coords.lng} />
                ) : (
                  <div className="mx-4 mt-3 p-4 rounded-xl border border-border text-center">
                    <MapPin size={20} className="mx-auto mb-2" style={{ color: "var(--gold, #C9A227)" }} />
                    <p className="text-sm text-text-muted mb-3">Activá tu ubicación para ver personas cerca</p>
                    <button
                      onClick={requestGPS}
                      className="text-xs px-4 py-1.5 rounded-full border transition-all hover:opacity-80"
                      style={{ color: "var(--gold, #C9A227)", borderColor: "rgba(201,162,39,0.35)" }}
                    >
                      Activar GPS
                    </button>
                  </div>
                )}
                <ProfileSuggestions />
              </>
            )}

            {tab === "interes" && (
              <InteresesTab activeTag={activeTag} onSelectTag={selectTag} />
            )}

            {tab === "hashtag" && (
              <HashtagTab
                trending={trending}
                posts={hashtagPosts}
                loading={hashtagLoading}
                activeTag={activeHashtag}
                onSelectTag={goToHashtag}
                onNavigate={navigate}
              />
            )}
            {tab === "eventos" && <EventosTab navigate={navigate} />}
            {tab === "viaje"   && <ViajeTab   navigate={navigate} />}
          </main>
        </>
      )}

      <BottomNav />
    </div>
  );
}

// ── Sub-tabs ──────────────────────────────────────────────────────────────────

// ── Hashtag tab ───────────────────────────────────────────────────────────────
function HashtagTab({
  trending, posts, loading, activeTag, onSelectTag, onNavigate,
}: {
  trending:    TrendingTag[];
  posts:       HashtagPost[];
  loading:     boolean;
  activeTag:   string;
  onSelectTag: (tag: string) => void;
  onNavigate:  ReturnType<typeof useNavigate>;
}) {
  return (
    <div className="px-4 pt-4 space-y-5">
      {/* Trending chips */}
      <div>
        <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">
          Trending esta semana
        </p>
        {trending.length === 0 ? (
          <p className="text-xs text-text-muted/60">Todavía no hay hashtags populares.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {trending.map(({ tag, count }) => (
              <button
                key={tag}
                onClick={() => onSelectTag(tag)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all ${
                  activeTag === tag
                    ? "text-[#0a0a0f] border-transparent"
                    : "border-border text-text-muted hover:border-[rgba(201,162,39,0.4)]"
                }`}
                style={activeTag === tag ? { background: "var(--gold,#C9A227)" } : {}}
              >
                <span style={{ color: activeTag === tag ? "#0a0a0f" : "var(--gold,#C9A227)" }}>#</span>
                {tag}
                <span
                  className="text-[9px] opacity-60 tabular-nums"
                  style={{ color: activeTag === tag ? "#0a0a0f" : undefined }}
                >
                  {count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Posts del hashtag activo */}
      {activeTag && (
        <div>
          <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">
            #{activeTag}
          </p>
          {loading ? (
            <div className="grid grid-cols-3 gap-1">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-lg"
                  style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite" }}
                />
              ))}
            </div>
          ) : posts.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-8">
              Ningún post usa <strong>#{activeTag}</strong> todavía.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-1">
              {posts.map(p => (
                <button
                  key={p.id}
                  onClick={() => onNavigate(`/profile/${p.author.id}`)}
                  className="aspect-square rounded-lg overflow-hidden bg-bg-muted relative group"
                >
                  {p.thumb ? (
                    <img src={imgUrl(p.thumb, "thumb")} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async"/>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2">
                      <p className="text-[9px] text-text-muted text-center line-clamp-4 leading-tight">
                        {p.caption}
                      </p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                    <p className="text-[9px] text-white truncate w-full">{p.author.name}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {!activeTag && trending.length > 0 && (
        <p className="text-xs text-text-muted text-center py-4">
          Tocá un hashtag para ver sus publicaciones
        </p>
      )}
    </div>
  );
}

function InteresesTab({ activeTag, onSelectTag }: { activeTag: string; onSelectTag: (id: string) => void }) {
  return (
    <div className="px-4 pt-4">
      <p className="text-xs text-text-muted mb-3">
        {activeTag ? "Mostrando personas con este interés:" : "Elegí un interés para ver personas afines:"}
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {SEEKING_TAGS.map(t => {
          const active = activeTag === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelectTag(t.id)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all"
              style={{
                background: active ? "var(--gold, #C9A227)" : "rgba(201,162,39,0.06)",
                border: `1px solid ${active ? "var(--gold, #C9A227)" : "rgba(201,162,39,0.25)"}`,
                color: active ? "#020207" : "var(--gold, #C9A227)",
                fontWeight: active ? 700 : 400,
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      {activeTag ? (
        <ProfileSuggestions tag={activeTag} />
      ) : (
        <div className="py-8 text-center">
          <Tag size={28} weight="light" style={{ color: "rgba(201,162,39,0.4)", margin: "0 auto 10px" }} />
          <p className="text-xs text-text-muted">Tocá un interés para ver personas que buscan lo mismo</p>
        </div>
      )}
    </div>
  );
}

function EventosTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="px-4 pt-6 flex flex-col items-center gap-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)" }}
      >
        <CalendarBlank size={28} weight="light" style={{ color: "var(--gold, #C9A227)" }} />
      </div>
      <div>
        <p className="font-semibold text-sm mb-1">Eventos de la comunidad</p>
        <p className="text-text-muted text-xs">Encontrá encuentros, fiestas y citas cercanas a vos.</p>
      </div>
      <button
        onClick={() => navigate("/events")}
        className="px-5 py-2.5 rounded-full text-xs font-medium transition-all hover:opacity-90"
        style={{ background: "var(--gold, #C9A227)", color: "#0a0a0f" }}
      >
        Ver eventos
      </button>
    </div>
  );
}

function ViajeTab({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <div className="px-4 pt-6 flex flex-col items-center gap-4 text-center">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)" }}
      >
        <Airplane size={28} weight="light" style={{ color: "var(--gold, #C9A227)" }} />
      </div>
      <div>
        <p className="font-semibold text-sm mb-1">Modo Viaje</p>
        <p className="text-text-muted text-xs">Activá el modo viaje para aparecer en otra ciudad mientras estás de paso.</p>
      </div>
      <button
        onClick={() => navigate("/travel")}
        className="px-5 py-2.5 rounded-full text-xs font-medium transition-all hover:opacity-90"
        style={{ background: "var(--gold, #C9A227)", color: "#0a0a0f" }}
      >
        Activar modo viaje
      </button>
    </div>
  );
}