/**
 * ProfileView — perfil público rediseñado según La Estratega.
 * Orden: Trust (foto + badge) → Acción → Bio → Qué buscás → Stats/Racha → Galería → Albums
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Heart, ShieldOff, Flag, MapPin, Star,
  Lock, Users, User, MessageSquare, Images, Plus, Flame,
} from "lucide-react";
import { profilesApi, followsApi, albumsApi, feedApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { Button } from "@/components/ui/Button";
import { PROFILE_TYPE_CONFIG, ORIENTATION_CONFIG } from "@/types";
import type { ProfileType, SexualOrientation } from "@/types";

const SEEKING_LABELS: Record<string, string> = {
  explorar_sin_apuro:    "Explorar sin apuro",
  charlar_y_ver:         "Charlar y ver qué pasa",
  planes_y_salidas:      "Planes y salidas",
  conexiones_reales:     "Conexiones reales",
  experiencias_nuevas:   "Experiencias nuevas",
  en_pareja_explorando:  "En pareja, explorando",
  solo_curiosidad:       "Solo curiosidad por ahora",
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.floor(days / 30);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

/* ── Album card ─────────────────────────────────────────────── */
function AlbumCard({ album, onRequestAccess }: { album: any; onRequestAccess: (id: string) => void }) {
  const isPrivate = album.is_private;
  const hasAccess = album.has_access;
  const reqStatus = album.my_request_status;

  return (
    <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface)" }}>
      {/* Preview */}
      <div style={{ height: 120, position: "relative", background: "var(--smoke)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {album.cover_blur_url ? (
          <img src={album.cover_blur_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", filter: isPrivate && !hasAccess ? "blur(12px)" : "none" }}/>
        ) : (
          <Images size={28} style={{ color: "var(--mist)" }}/>
        )}
        {isPrivate && !hasAccess && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "rgba(2,2,7,0.5)" }}>
            <Lock size={20} style={{ color: "var(--gold)", marginBottom: 4 }}/>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", color: "var(--gold)", textTransform: "uppercase" }}>
              {album.photos_count} fotos exclusivas
            </p>
          </div>
        )}
      </div>
      {/* Info */}
      <div style={{ padding: "12px 14px" }}>
        <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--paper)", marginBottom: 4 }}>{album.title}</p>
        {isPrivate && !hasAccess && (
          <button
            onClick={() => onRequestAccess(album.id)}
            disabled={!!reqStatus}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
              padding: "6px 12px", borderRadius: "var(--radius-pill)",
              background: reqStatus ? "transparent" : "var(--gold)",
              color: reqStatus ? "var(--mist)" : "var(--obsidian)",
              border: reqStatus ? "1px solid var(--ash)" : "none",
              cursor: reqStatus ? "default" : "pointer", marginTop: 4,
            }}
          >
            {reqStatus === "pending" ? "Solicitud enviada" : reqStatus === "approved" ? "Acceso aprobado" : "Pedir acceso exclusivo"}
          </button>
        )}
        {(!isPrivate || hasAccess) && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)", letterSpacing: "0.12em" }}>
            {album.photos_count} foto{album.photos_count !== 1 ? "s" : ""}
          </p>
        )}
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════ */
export default function ProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate   = useNavigate();
  const { user: me } = useAuthStore();
  useScreenCapture({ warn: true });

  const [profile, setProfile]         = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<"blocked"|"private"|"notfound"|null>(null);
  const [liked, setLiked]             = useState(false);
  const [matched, setMatched]         = useState(false);
  const [blocked, setBlocked]         = useState(false);
  const [showReport, setShowReport]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [albums, setAlbums]           = useState<any[]>([]);
  const [posts, setPosts]             = useState<any[]>([]);

  const isOwnProfile = me?.id === userId;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);

    profilesApi.get(userId)
      .then(r => {
        setProfile(r.data);
        setLiked(r.data.viewer_liked ?? false);
        setMatched(r.data.matched ?? false);
        // Registrar visita
        if (!isOwnProfile) albumsApi.recordView(userId).catch(() => {});
      })
      .catch(e => {
        const status = e.response?.status;
        if (status === 403) {
          const detail = e.response?.data?.detail ?? "";
          setError(detail.includes("bloqueado") ? "blocked" : "private");
        } else {
          setError("notfound");
        }
      })
      .finally(() => setLoading(false));

    // Follow status + counts
    if (!isOwnProfile) {
      followsApi.status(userId).then(r => setIsFollowing(r.data.i_follow)).catch(() => {});
    }
    Promise.all([
      followsApi.followers(userId, { limit: 1 }),
      followsApi.following(userId, { limit: 1 }),
    ]).then(([frs, fng]) => {
      setFollowCounts({ followers: frs.data.total, following: fng.data.total });
    }).catch(() => {});

    // Albums
    albumsApi.listUser(userId).then(r => setAlbums(r.data)).catch(() => {});

    // Posts recientes del usuario
    feedApi.getUserPosts(userId, { limit: 9 }).then(r => {
      setPosts(r.data.posts || []);
    }).catch(() => {});

  }, [userId, isOwnProfile]);

  async function handleLike() {
    if (!userId || actionLoading) return;
    setActionLoading(true);
    try {
      const { data } = await profilesApi.like(userId);
      setLiked(data.liked);
      if (data.matched && !matched) setMatched(true);
      else if (!data.liked) setMatched(false);
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  async function handleFollow() {
    if (!userId || actionLoading) return;
    setActionLoading(true);
    try {
      if (isFollowing) {
        await followsApi.unfollow(userId);
        setIsFollowing(false);
        setFollowCounts(p => ({ ...p, followers: Math.max(0, p.followers - 1) }));
      } else {
        await followsApi.follow(userId);
        setIsFollowing(true);
        setFollowCounts(p => ({ ...p, followers: p.followers + 1 }));
      }
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  async function handleBlock() {
    if (!userId || actionLoading) return;
    setActionLoading(true);
    try {
      const { data } = await profilesApi.block(userId);
      setBlocked(data.blocked);
      if (data.blocked) navigate(-1);
    } catch { /* ignore */ }
    setActionLoading(false);
  }

  async function handleRequestAlbumAccess(albumId: string) {
    try {
      await albumsApi.requestAccess(albumId);
      setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, my_request_status: "pending" } : a));
    } catch { /* ignore */ }
  }

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--ash)] border-t-[var(--gold)] rounded-full animate-spin"/>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6 text-center">
      <Lock size={28} style={{ color: "var(--mist)", marginBottom: 16 }}/>
      <h2 className="brand-title" style={{ fontSize: "var(--fs-display-m)", marginBottom: 8 }}>
        {error === "blocked" ? "Perfil bloqueado" : error === "private" ? "Perfil privado" : "Perfil no encontrado"}
      </h2>
      <button onClick={() => navigate(-1)} style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)", letterSpacing: "0.14em", background: "none", border: "none", cursor: "pointer", textTransform: "uppercase" }}>
        Volver
      </button>
    </div>
  );

  if (!profile) return null;

  const typeCfg   = profile.profile_type ? PROFILE_TYPE_CONFIG[profile.profile_type as ProfileType] : null;
  const orientCfg = profile.sexual_orientation && profile.sexual_orientation !== "na"
    ? ORIENTATION_CONFIG[profile.sexual_orientation as SexualOrientation] : null;
  const displayName = profile.username ? `@${profile.username}` : `${profile.first_name} ${profile.last_name}`;
  const seekingTags: string[] = profile.seeking_tags || [];

  return (
    <div style={{ minHeight: "100vh", background: "var(--obsidian)", color: "var(--paper)" }}>

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(2,2,7,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-soft)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate(-1)} style={{ padding: 8, borderRadius: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
          <ArrowLeft size={18} strokeWidth={1.5}/>
        </button>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--mist)", textTransform: "uppercase" }}>
          {displayName}
        </p>
        {!isOwnProfile && (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={handleBlock} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
              <ShieldOff size={16} strokeWidth={1.5}/>
            </button>
            <button onClick={() => setShowReport(true)} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
              <Flag size={16} strokeWidth={1.5}/>
            </button>
          </div>
        )}
        {isOwnProfile && <div style={{ width: 40 }}/>}
      </header>

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "0 0 80px" }}>

        {/* ── ZONA 1: Trust + Atracción ── */}
        <div style={{ position: "relative", textAlign: "center", padding: "32px 24px 0" }}>
          {/* Foto grande */}
          <div style={{ width: 110, height: 110, borderRadius: "50%", overflow: "hidden", margin: "0 auto 16px", border: "2px solid var(--gold-deep)", boxShadow: "0 0 24px rgba(201,162,39,0.25)" }}>
            {profile.profile_photo_url
              ? <img src={profile.profile_photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              : <div style={{ width: "100%", height: "100%", background: "var(--pewter)", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={44} style={{ color: "var(--mist)" }}/></div>
            }
          </div>

          {/* Username + Badge — inseparables según La Estratega */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 8 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-m)", fontWeight: 400, color: "var(--paper)" }}>
              {displayName}
            </h1>
            <VerifiedBadge size="sm"/>
          </div>

          {/* Tipo de perfil + orientación */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            {typeCfg && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mist)", padding: "3px 8px", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-pill)" }}>
                {typeCfg.label}
              </span>
            )}
            {orientCfg && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mist)", padding: "3px 8px", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-pill)" }}>
                {orientCfg.label}
              </span>
            )}
            {matched && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gold)", padding: "3px 8px", border: "1px solid var(--gold-deep)", borderRadius: "var(--radius-pill)" }}>
                Match
              </span>
            )}
            {profile.profile_extended?.partner_id && (
              <button
                onClick={() => navigate(`/profile/${profile.profile_extended.partner_id}`)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "#C9A227", padding: "3px 8px", border: "1px solid rgba(201,162,39,0.4)", borderRadius: "var(--radius-pill)", background: "rgba(201,162,39,0.06)", cursor: "pointer" }}
              >
                ♥ Pareja verificada
              </button>
            )}
          </div>

          {/* ── ZONA 1b: Botones de acción ── */}
          {!isOwnProfile && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", marginBottom: 20 }}>
              <Button variant={isFollowing ? "ghost" : "primary"} size="sm" onClick={handleFollow}>
                <Users size={13} strokeWidth={1.5}/>
                {isFollowing ? "Siguiendo" : "Seguir"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigate(`/messages?with=${userId}`)}>
                <MessageSquare size={13} strokeWidth={1.5}/>
                Mensaje
              </Button>
              <button
                onClick={handleLike}
                style={{
                  padding: "8px 16px", borderRadius: "var(--radius-pill)", fontSize: 11,
                  fontFamily: "var(--font-mono)", letterSpacing: "0.14em", textTransform: "uppercase",
                  border: `1px solid ${liked ? "rgba(194,90,90,0.5)" : "var(--ash)"}`,
                  background: liked ? "rgba(194,90,90,0.08)" : "transparent",
                  color: liked ? "var(--danger)" : "var(--mist)", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Heart size={13} fill={liked ? "currentColor" : "none"} strokeWidth={1.5}/>
                {liked ? "Te gusta" : "Me gusta"}
              </button>
            </div>
          )}
        </div>

        {/* ── ZONA 2: Bio ── */}
        {(profile.bio || profile.city || profile.province) && (
          <div style={{ padding: "0 24px 20px" }}>
            {profile.bio && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--silver)", lineHeight: 1.65, textAlign: "center", marginBottom: 10 }}>
                {profile.bio}
              </p>
            )}
            {(profile.city || profile.province) && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <MapPin size={12} style={{ color: "var(--mist)" }} strokeWidth={1.5}/>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mist)", letterSpacing: "0.14em" }}>
                  {profile.city ? `${profile.city}, ` : ""}{profile.province}
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── ZONA 2b: Qué buscás — el gancho único ── */}
        {seekingTags.length > 0 && (
          <div style={{ margin: "0 24px 24px", padding: "16px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", background: "rgba(201,162,39,0.03)" }}>
            <p className="brand-eyebrow" style={{ marginBottom: 10 }}>Qué buscás</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {seekingTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => navigate(`/explore?tab=interes&tag=${encodeURIComponent(tag)}`)}
                  style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--paper)", padding: "4px 12px", border: "1px solid var(--gold-deep)", borderRadius: "var(--radius-pill)", background: "rgba(201,162,39,0.06)", cursor: "pointer", transition: "background 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,162,39,0.14)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(201,162,39,0.06)")}
                >
                  {SEEKING_LABELS[tag] || tag}
                </button>
              ))}
            </div>
            {profile.seeking_text && (
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mist)", marginTop: 8, lineHeight: 1.6 }}>
                {profile.seeking_text}
              </p>
            )}
          </div>
        )}

        {/* ── ZONA 3: Stats + Racha ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 1, margin: "0 0 24px", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", background: "var(--border-soft)" }}>
          {[
            { value: followCounts.followers, label: "Seguidores" },
            { value: followCounts.following, label: "Siguiendo" },
            { value: profile.review_stats?.total_reviews || 0, label: "Reseñas" },
            { value: (profile as any).current_streak || 0, label: "🔥 Racha", suffix: "d" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--obsidian)", padding: "14px 8px", textAlign: "center" }}>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--paper)" }}>
                {s.value}{s.suffix || ""}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--mist)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* Highlights */}
        {userId && <div style={{ padding: "0 16px 16px" }}/>}

        {/* ── ZONA 4: Galería (grid IG-style) ── */}
        {posts.length > 0 && (
          <div style={{ padding: "0 0 24px" }}>
            <div style={{ padding: "0 16px 12px" }}>
              <p className="brand-eyebrow">Publicaciones</p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
              {posts.map(post => (
                <div key={post.id} style={{ aspectRatio: "1", overflow: "hidden", background: "var(--smoke)" }}>
                  {post.media_url
                    ? <img src={post.media_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                    : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }}>
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--mist)", lineHeight: 1.4, textAlign: "center" }}>
                          {post.caption?.slice(0, 60)}
                        </p>
                      </div>
                    )
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── ZONA 5: Albums ── */}
        {albums.length > 0 && (
          <div style={{ padding: "0 16px 24px" }}>
            <p className="brand-eyebrow" style={{ marginBottom: 14 }}>Albums</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {albums.map(album => (
                <AlbumCard key={album.id} album={album} onRequestAccess={handleRequestAlbumAccess}/>
              ))}
            </div>
          </div>
        )}

        {/* Miembro desde */}
        {profile.created_at && (
          <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-dim)", letterSpacing: "0.16em", textTransform: "uppercase", paddingBottom: 24 }}>
            Miembro desde {new Date(profile.created_at).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
          </p>
        )}
      </main>
    </div>
  );
}
