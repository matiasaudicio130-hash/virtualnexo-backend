/**
 * ProfileView — perfil público rediseñado según La Estratega.
 * Orden: Trust (foto + badge) → Acción → Bio → Qué buscás → Stats/Racha → Galería → Albums
 */
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Heart, ShieldOff, Flag, MapPin, Star, Share2, Pencil,
  Lock, Users, User, MessageSquare, Images, ChevronLeft, ChevronRight, X,
} from "lucide-react";
import { profilesApi, followsApi, albumsApi, feedApi, reviewsApi, extendedProfileApi } from "@/lib/api";
import { ReportModal }    from "@/components/ReportModal";
import { BadgeRow }       from "@/components/BadgeDisplay";
import { ProfileQRModal } from "@/components/ProfileQRModal";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useOnlineStatus, formatLastSeen } from "@/hooks/useOnlineStatus";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { ProtectedAvatar } from "@/components/ProtectedImage";
import { PostCard } from "@/components/PostCard";
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

/* ── Album card ─────────────────────────────────────────────── */
function AlbumCard({ album, onRequestAccess, onOpen }: { album: any; onRequestAccess: (id: string) => void; onOpen: (album: any) => void }) {
  const isPrivate  = album.is_private;
  const hasAccess  = album.has_access;
  const reqStatus  = album.my_request_status;
  const canOpen    = !isPrivate || hasAccess;

  return (
    <div
      onClick={() => canOpen && onOpen(album)}
      style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface)", cursor: canOpen ? "pointer" : "default", transition: "border-color 0.15s" }}
      onMouseEnter={e => { if (canOpen) e.currentTarget.style.borderColor = "var(--gold-deep)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border-soft)"; }}
    >
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
            onClick={e => { e.stopPropagation(); onRequestAccess(album.id); }}
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
  const [iBlockedThem, setIBlockedThem] = useState(false);
  const [liked, setLiked]             = useState(false);
  const [matched, setMatched]         = useState(false);
  const [blocked, setBlocked]         = useState(false);
  const [showReport, setShowReport]   = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showQR,     setShowQR]       = useState(false);
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [albums, setAlbums]           = useState<any[]>([]);
  const [posts, setPosts]             = useState<any[]>([]);
  const [pinLoading, setPinLoading]   = useState(false);
  const [reviews, setReviews]         = useState<any[]>([]);
  const [followListType, setFollowListType] = useState<"followers"|"following"|null>(null);
  const [followList, setFollowList]   = useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<any[]>([]);
  const [albumPhotoIdx, setAlbumPhotoIdx] = useState(0);
  const [shareCopied, setShareCopied] = useState(false);

  const isOwnProfile = me?.id === userId;
  const onlineStatus = useOnlineStatus(isOwnProfile ? undefined : userId);

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
          const msg = typeof detail === "object" ? (detail.message ?? "") : detail;
          if (msg.includes("bloqueado")) {
            setError("blocked");
            setIBlockedThem(typeof detail === "object" ? (detail.i_blocked_them ?? false) : false);
          } else {
            setError("private");
          }
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
    feedApi.getUserPosts(userId, { limit: 18 }).then(r => {
      setPosts(r.data.posts || []);
    }).catch(() => {});

    // Reseñas
    reviewsApi.forUser(userId, { limit: 5 }).then(r => {
      setReviews(r.data.reviews || r.data || []);
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
    setShowBlockConfirm(true);
  }

  async function confirmBlock() {
    if (!userId) return;
    setShowBlockConfirm(false);
    setActionLoading(true);
    try {
      const { data } = await profilesApi.block(userId);
      setBlocked(data.blocked);
      if (data.blocked) navigate(-1);
    } catch {
      alert("No se pudo bloquear. Intentá de nuevo.");
    }
    setActionLoading(false);
  }

  async function handleUnblock() {
    if (!userId) return;
    setActionLoading(true);
    try {
      await profilesApi.block(userId);
      setError(null);
      setIBlockedThem(false);
      setLoading(true);
      profilesApi.get(userId).then(r => {
        setProfile(r.data);
        setLiked(r.data.viewer_liked ?? false);
        setMatched(r.data.matched ?? false);
      }).catch(() => setError("notfound")).finally(() => setLoading(false));
    } catch {
      alert("No se pudo desbloquear. Intentá de nuevo.");
    }
    setActionLoading(false);
  }

  // handleReport is now handled inside ReportModal directly via moderationApi

  async function handlePinPost(postId: string) {
    const currentPinned = profile?.profile_extended?.pinned_post_id;
    const isPinned      = currentPinned === postId;
    setPinLoading(true);
    try {
      if (isPinned) {
        await extendedProfileApi.unpinPost();
        setProfile((p: any) => ({ ...p, profile_extended: { ...(p.profile_extended || {}), pinned_post_id: null } }));
      } else {
        await extendedProfileApi.pinPost(postId);
        setProfile((p: any) => ({ ...p, profile_extended: { ...(p.profile_extended || {}), pinned_post_id: postId } }));
      }
    } catch { /* ignore */ }
    setPinLoading(false);
  }

  async function handleRequestAlbumAccess(albumId: string) {
    try {
      await albumsApi.requestAccess(albumId);
      setAlbums(prev => prev.map(a => a.id === albumId ? { ...a, my_request_status: "pending" } : a));
    } catch { /* ignore */ }
  }

  async function openFollowList(type: "followers" | "following") {
    if (!userId) return;
    setFollowListType(type);
    setFollowList([]);
    setFollowListLoading(true);
    try {
      const r = type === "followers"
        ? await followsApi.followers(userId, { limit: 100 })
        : await followsApi.following(userId, { limit: 100 });
      // Backend returns { followers: [...] } or { following: [...] }
      const list = type === "followers" ? r.data.followers : r.data.following;
      setFollowList(Array.isArray(list) ? list : []);
    } catch { /* ignore */ }
    setFollowListLoading(false);
  }

  async function openAlbum(album: any) {
    if (album.is_private && !album.has_access) return;
    setSelectedAlbum(album);
    setAlbumPhotoIdx(0);
    setAlbumPhotos([]);
    try {
      const r = await albumsApi.getPhotos(album.id);
      setAlbumPhotos(r.data.photos || r.data || []);
    } catch { /* ignore */ }
  }

  async function handleShare() {
    if (!profile) return;
    const url = `${window.location.origin}/profile/${userId}`;
    const shareData = {
      title: `${profile.first_name} en Aura SW`,
      text: profile.bio ? profile.bio.slice(0, 100) : "Conocé este perfil en Aura SW",
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        setShareCopied(true);
        setTimeout(() => setShareCopied(false), 2000);
      }
    } catch { /* user cancelled */ }
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
      {error === "blocked" && iBlockedThem && (
        <button
          onClick={handleUnblock}
          disabled={actionLoading}
          style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--paper)", letterSpacing: "0.14em", background: "var(--gold-deep)", border: "none", cursor: "pointer", textTransform: "uppercase", padding: "10px 20px", borderRadius: 8, marginBottom: 12, opacity: actionLoading ? 0.6 : 1 }}
        >
          {actionLoading ? "Desbloqueando..." : "Desbloquear"}
        </button>
      )}
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
            <Tooltip label={shareCopied ? "¡Link copiado!" : "Compartir"} position="bottom">
              <button onClick={handleShare} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <Share2 size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
            <Tooltip label="Bloquear" position="bottom">
              <button onClick={handleBlock} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <ShieldOff size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
            <Tooltip label="Reportar" position="bottom">
              <button onClick={() => setShowReport(true)} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <Flag size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
          </div>
        )}
        {isOwnProfile && (
          <div style={{ display: "flex", gap: 4 }}>
            <Tooltip label="Mi QR" position="bottom">
              <button onClick={() => setShowQR(true)} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="3" height="3"/>
                  <rect x="19" y="14" width="2" height="2"/><rect x="14" y="19" width="2" height="2"/>
                  <rect x="18" y="18" width="3" height="3"/>
                </svg>
              </button>
            </Tooltip>
            <Tooltip label={shareCopied ? "¡Link copiado!" : "Compartir"} position="bottom">
              <button onClick={handleShare} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <Share2 size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
            <Tooltip label="Editar perfil" position="bottom">
              <button onClick={() => navigate("/dashboard")} style={{ padding: 8, background: "none", border: "none", color: "var(--gold)", cursor: "pointer" }}>
                <Pencil size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
          </div>
        )}
      </header>

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "0 0 80px" }}>

        {/* ── ZONA 1: Trust + Atracción ── */}
        <div style={{ position: "relative", textAlign: "center", padding: "32px 24px 0" }}>
          {/* Foto grande — click abre lightbox */}
          <button
            onClick={() => profile.profile_photo_url && setShowPhotoLightbox(true)}
            style={{ width: 110, height: 110, borderRadius: "50%", overflow: "hidden", margin: "0 auto 16px", border: "2px solid var(--gold-deep)", boxShadow: "0 0 24px rgba(201,162,39,0.25)", display: "block", padding: 0, cursor: profile.profile_photo_url ? "zoom-in" : "default", background: "none" }}
          >
            {profile.profile_photo_url
              ? <img src={profile.profile_photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
              : <div style={{ width: "100%", height: "100%", background: "var(--pewter)", display: "flex", alignItems: "center", justifyContent: "center" }}><User size={44} style={{ color: "var(--mist)" }}/></div>
            }
          </button>

          {/* Username + Badge — inseparables según La Estratega */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-m)", fontWeight: 400, color: "var(--paper)" }}>
              {displayName}
            </h1>
            <VerifiedBadge size="sm"/>
          </div>

          {/* Estado de conexión */}
          {!isOwnProfile && onlineStatus.minutes_ago !== null && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 10 }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: onlineStatus.online ? "#4ade80" : "var(--ash)",
                boxShadow: onlineStatus.online ? "0 0 6px rgba(74,222,128,0.5)" : "none",
              }}/>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: onlineStatus.online ? "#4ade80" : "var(--mist)" }}>
                {onlineStatus.online ? "En línea" : formatLastSeen(onlineStatus.minutes_ago)}
              </span>
            </div>
          )}

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
            {/* Website link */}
            {profile.profile_extended?.website && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 8 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <a
                  href={profile.profile_extended.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--gold)", textDecoration: "none", letterSpacing: "0.02em" }}
                  onClick={e => e.stopPropagation()}
                >
                  {profile.profile_extended.website.replace(/^https?:\/\//, "")}
                </a>
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

        {/* ── ZONA 3: Stats ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, margin: "0 0 24px", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", background: "var(--border-soft)" }}>
          {[
            { value: followCounts.followers, label: "Seguidores", onClick: () => openFollowList("followers") },
            { value: followCounts.following, label: "Siguiendo",  onClick: () => openFollowList("following") },
            { value: profile.review_stats?.total_reviews || 0, label: "Reseñas", onClick: () => navigate(`/reviews/${userId}`) },
          ].map((s, i) => (
            <button
              key={i}
              onClick={s.onClick}
              style={{ background: "var(--obsidian)", padding: "14px 8px", textAlign: "center", border: "none", color: "inherit", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,162,39,0.04)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "var(--obsidian)"; }}
            >
              <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--paper)" }}>
                {s.value}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--mist)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                {s.label}
              </p>
            </button>
          ))}
        </div>

        {/* ── ZONA 3b: Badges ── */}
        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "center" }}>
          <BadgeRow userId={userId!} maxShow={6} size="sm" />
        </div>

        {/* ── ZONA 4: Galería IG-style ── */}
        <div style={{ padding: "0 0 0" }}>
          {/* Tab bar: Publicaciones / Albums */}
          <div style={{ display: "flex", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", marginBottom: 2 }}>
            <div style={{ flex: 1, padding: "10px 0", textAlign: "center", borderBottom: "2px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
              <Images size={13} style={{ color: "var(--gold)" }}/>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--gold)" }}>
                Publicaciones ({posts.length})
              </span>
            </div>
            {albums.length > 0 && (
              <div style={{ flex: 1, padding: "10px 0", textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Lock size={12} style={{ color: "var(--mist)" }}/>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mist)" }}>
                  Exclusivos ({albums.length})
                </span>
              </div>
            )}
          </div>

          {/* Grid posts */}
          {posts.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <Images size={28} style={{ color: "var(--ash)", margin: "0 auto 8px" }}/>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)", letterSpacing: "0.14em", textTransform: "uppercase" }}>Sin publicaciones aún</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
              {(() => {
                const pinnedId = profile?.profile_extended?.pinned_post_id as string | undefined;
                const sorted   = pinnedId
                  ? [...posts].sort((a, b) => (a.id === pinnedId ? -1 : b.id === pinnedId ? 1 : 0))
                  : posts;
                return sorted;
              })().map(post => {
                const pinnedId = profile?.profile_extended?.pinned_post_id as string | undefined;
                const isPinned = post.id === pinnedId;
                const isPoll      = post.type === "poll";
                const items       = Array.isArray(post.media_urls) ? post.media_urls : [];
                const isCarousel  = items.length > 1;
                const firstItem   = items[0];
                const coverIsVideo = firstItem?.type === "video";
                const cover       = firstItem?.url || post.media_url;
                return (
                  <button
                    key={post.id}
                    onClick={() => setSelectedPost(post)}
                    style={{ position: "relative", aspectRatio: "1", overflow: "hidden", background: "var(--smoke)", cursor: "pointer", border: "none", padding: 0 }}
                  >
                    {cover && coverIsVideo ? (
                      <>
                        <video
                          src={cover}
                          muted
                          playsInline
                          preload="metadata"
                          onContextMenu={e => e.preventDefault()}
                          style={{ width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none" }}
                        />
                        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.15)", pointerEvents: "none" }}>
                          <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z"/></svg>
                          </div>
                        </div>
                      </>
                    ) : cover ? (
                      <img
                        src={cover}
                        alt=""
                        draggable={false}
                        onContextMenu={e => e.preventDefault()}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 10, background: isPoll ? "rgba(201,162,39,0.06)" : "var(--smoke)" }}>
                        {isPoll && (
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="1.5" style={{ marginBottom: 6, opacity: 0.7 }}>
                            <rect x="3" y="3" width="18" height="18" rx="2"/>
                            <line x1="8" y1="12" x2="16" y2="12"/>
                            <line x1="8" y1="8" x2="13" y2="8"/>
                            <line x1="8" y1="16" x2="11" y2="16"/>
                          </svg>
                        )}
                        <p style={{ fontFamily: "var(--font-sans)", fontSize: 10, color: "var(--mist)", lineHeight: 1.4, textAlign: "center", overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                          {(post.caption || post.poll_question)?.slice(0, 80)}
                        </p>
                      </div>
                    )}
                    {/* Overlay: carrusel */}
                    {isCarousel && (
                      <div style={{ position: "absolute", top: 5, right: 5, display: "flex", alignItems: "center", gap: 3, padding: "2px 6px", background: "rgba(2,2,7,0.7)", borderRadius: 6 }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="7" y="7" width="14" height="14" rx="2"/>
                          <path d="M3 17V5a2 2 0 0 1 2-2h12"/>
                        </svg>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "white", letterSpacing: "0.04em" }}>
                          {post.media_urls.length}
                        </span>
                      </div>
                    )}
                    {/* Overlay: poll */}
                    {isPoll && cover && (
                      <div style={{ position: "absolute", top: 5, right: 5 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <line x1="8" y1="12" x2="16" y2="12"/>
                          <line x1="8" y1="8" x2="13" y2="8"/>
                          <line x1="8" y1="16" x2="11" y2="16"/>
                        </svg>
                      </div>
                    )}
                    {/* Overlay: post fijado (badge 📌) */}
                    {isPinned && (
                      <div style={{ position: "absolute", top: 4, left: 4, background: "rgba(201,162,39,0.85)", borderRadius: 4, padding: "2px 5px", display: "flex", alignItems: "center", gap: 3 }}>
                        <span style={{ fontSize: 10 }}>📌</span>
                      </div>
                    )}
                    {/* Botón fijar/desfijar — solo en perfil propio */}
                    {isOwnProfile && (
                      <button
                        onClick={e => { e.stopPropagation(); handlePinPost(post.id); }}
                        style={{ position: "absolute", bottom: 4, right: 4, background: isPinned ? "rgba(201,162,39,0.85)" : "rgba(2,2,7,0.65)", borderRadius: 4, border: "none", padding: "3px 6px", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, opacity: pinLoading ? 0.5 : 1 }}
                        title={isPinned ? "Desfijar" : "Fijar en perfil"}
                      >
                        <span style={{ fontSize: 10 }}>📌</span>
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── ZONA 5: Albums exclusivos ── */}
        {albums.length > 0 && (
          <div style={{ padding: "24px 16px" }}>
            <p className="brand-eyebrow" style={{ marginBottom: 14 }}>Contenido exclusivo</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {albums.map(album => (
                <AlbumCard key={album.id} album={album} onRequestAccess={handleRequestAlbumAccess} onOpen={openAlbum}/>
              ))}
            </div>
          </div>
        )}

        {/* ── ZONA 6: Reseñas (preview) ── */}
        {reviews.length > 0 && (
          <div style={{ padding: "24px 16px", borderTop: "1px solid var(--border-soft)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <p className="brand-eyebrow" style={{ margin: 0 }}>Reseñas recientes</p>
              <button
                onClick={() => navigate(`/reviews/${userId}`)}
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold)", background: "none", border: "none", cursor: "pointer" }}
              >
                Ver todas →
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {reviews.slice(0, 3).map((r: any) => {
                const reviewer = r.users || r.reviewer || {};
                const displayName = r.is_anonymous
                  ? "Anónimo"
                  : (reviewer.first_name ? `${reviewer.first_name} ${reviewer.last_name?.[0] ?? ""}.` : "Usuario");
                return (
                  <div key={r.id} style={{ padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", background: "var(--surface)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      {!r.is_anonymous && reviewer.profile_photo_url ? (
                        <ProtectedAvatar src={reviewer.profile_photo_url} size={22}/>
                      ) : (
                        <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--pewter)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <User size={11} style={{ color: "var(--mist)" }}/>
                        </div>
                      )}
                      <span style={{ fontFamily: "var(--font-sans)", fontSize: 12, fontWeight: 500, color: "var(--paper)" }}>{displayName}</span>
                      <div style={{ marginLeft: "auto", display: "flex", gap: 1 }}>
                        {[1,2,3,4,5].map(i => (
                          <Star key={i} size={11} fill={i <= r.rating ? "var(--gold)" : "none"} stroke="var(--gold)" strokeWidth={1.5}/>
                        ))}
                      </div>
                    </div>
                    {r.text && (
                      <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--silver)", lineHeight: 1.55, margin: 0 }}>
                        {r.text}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Miembro desde */}
        {profile.created_at && (
          <p style={{ textAlign: "center", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-dim)", letterSpacing: "0.16em", textTransform: "uppercase", paddingTop: 24, paddingBottom: 24 }}>
            Miembro desde {new Date(profile.created_at).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}
          </p>
        )}
      </main>

      {/* ── QR Modal ── */}
      {showQR && profile && (
        <ProfileQRModal
          userId={userId!}
          userName={`${profile.first_name} ${profile.last_name || ""}`.trim()}
          onClose={() => setShowQR(false)}
        />
      )}

      {/* ── Modal de reporte ── */}
      {showReport && profile && (
        <ReportModal
          targetType="user"
          targetId={userId!}
          targetName={`${profile.first_name} ${profile.last_name || ""}`.trim()}
          onClose={() => setShowReport(false)}
        />
      )}

      {/* ── Confirmación de bloqueo ── */}
      {showBlockConfirm && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(2,2,7,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center", padding: "0 0 env(safe-area-inset-bottom,0)" }}
          onClick={() => setShowBlockConfirm(false)}
        >
          <div
            style={{ width: "100%", maxWidth: 480, background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", border: "1px solid var(--border-soft)" }}
            onClick={e => e.stopPropagation()}
          >
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--danger, #c25a5a)", marginBottom: 8 }}>Bloquear usuario</p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 14, color: "var(--paper)", marginBottom: 20 }}>
              ¿Bloqueás a <strong>{profile.first_name}</strong>? No podrán ver tu perfil ni escribirte.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowBlockConfirm(false)} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "1px solid var(--border-soft)", background: "transparent", color: "var(--mist)", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={confirmBlock} style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "none", background: "var(--danger, #c25a5a)", color: "white", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}>
                Bloquear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal lista de seguidores/siguiendo ── */}
      {followListType && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(2,2,7,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setFollowListType(null)}
        >
          <div
            style={{ width: "100%", maxWidth: 480, maxHeight: "75vh", background: "var(--surface)", borderRadius: "20px 20px 0 0", padding: "20px 0 24px", border: "1px solid var(--border-soft)", display: "flex", flexDirection: "column" }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ padding: "0 20px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-soft)" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--gold)" }}>
                {followListType === "followers" ? `Seguidores (${followCounts.followers})` : `Siguiendo (${followCounts.following})`}
              </p>
              <button onClick={() => setFollowListType(null)} style={{ padding: 4, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <X size={16}/>
              </button>
            </div>
            <div style={{ overflowY: "auto", flex: 1, padding: "8px 0" }}>
              {followListLoading && (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ width: 24, height: 24, border: "2px solid var(--ash)", borderTop: "2px solid var(--gold)", borderRadius: "50%", margin: "0 auto", animation: "spin 1s linear infinite" }}/>
                </div>
              )}
              {!followListLoading && followList.length === 0 && (
                <p style={{ textAlign: "center", padding: 40, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mist)", letterSpacing: "0.14em" }}>
                  {followListType === "followers" ? "Sin seguidores aún" : "No sigue a nadie aún"}
                </p>
              )}
              {followList.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => { setFollowListType(null); navigate(`/profile/${u.id}`); }}
                  style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left", color: "inherit" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(201,162,39,0.04)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  {u.profile_photo_url ? (
                    <ProtectedAvatar src={u.profile_photo_url} size={40}/>
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--pewter)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <User size={18} style={{ color: "var(--mist)" }}/>
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--paper)" }}>
                      {u.username ? `@${u.username}` : `${u.first_name} ${u.last_name}`}
                    </p>
                    {u.province && (
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 2 }}>
                        {u.province}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Modal detalle de publicación: PostCard completo ── */}
      {selectedPost && me && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(2,2,7,0.92)", display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "32px 12px" }}
          onClick={() => setSelectedPost(null)}
        >
          <button onClick={() => setSelectedPost(null)} style={{ position: "fixed", top: 16, right: 16, padding: 8, background: "rgba(255,255,255,0.12)", border: "none", borderRadius: "50%", color: "white", cursor: "pointer", zIndex: 72, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <X size={18}/>
          </button>
          <div
            style={{ maxWidth: 520, width: "100%" }}
            onClick={e => e.stopPropagation()}
          >
            <PostCard
              post={selectedPost}
              currentUserId={me.id}
              onDelete={() => {
                setPosts(prev => prev.filter(p => p.id !== selectedPost.id));
                setSelectedPost(null);
              }}
            />
          </div>
        </div>
      )}

      {/* ── Visor de álbum ── */}
      {selectedAlbum && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 75, background: "rgba(2,2,7,0.96)", display: "flex", flexDirection: "column" }}
          onClick={() => setSelectedAlbum(null)}
        >
          <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid var(--border-soft)" }} onClick={e => e.stopPropagation()}>
            <p style={{ fontFamily: "var(--font-display)", fontSize: 16, color: "var(--paper)" }}>{selectedAlbum.title}</p>
            <button onClick={() => setSelectedAlbum(null)} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
              <X size={18}/>
            </button>
          </div>
          {albumPhotos.length === 0 ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
              <div style={{ width: 32, height: 32, border: "2px solid var(--ash)", borderTop: "2px solid var(--gold)", borderRadius: "50%", animation: "spin 1s linear infinite" }}/>
            </div>
          ) : (
            <div style={{ flex: 1, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={e => e.stopPropagation()}>
              <img
                src={albumPhotos[albumPhotoIdx]?.url || albumPhotos[albumPhotoIdx]?.media_url}
                alt=""
                draggable={false}
                onContextMenu={e => e.preventDefault()}
                style={{ maxWidth: "92vw", maxHeight: "75vh", objectFit: "contain", userSelect: "none" }}
              />
              {albumPhotoIdx > 0 && (
                <button
                  onClick={() => setAlbumPhotoIdx(i => Math.max(0, i - 1))}
                  style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", padding: 10, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", color: "white", cursor: "pointer" }}
                >
                  <ChevronLeft size={20}/>
                </button>
              )}
              {albumPhotoIdx < albumPhotos.length - 1 && (
                <button
                  onClick={() => setAlbumPhotoIdx(i => Math.min(albumPhotos.length - 1, i + 1))}
                  style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", padding: 10, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", color: "white", cursor: "pointer" }}
                >
                  <ChevronRight size={20}/>
                </button>
              )}
              <div style={{ position: "absolute", bottom: 20, left: "50%", transform: "translateX(-50%)", padding: "4px 12px", background: "rgba(2,2,7,0.7)", borderRadius: "var(--radius-pill)", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--paper)", letterSpacing: "0.12em" }}>
                {albumPhotoIdx + 1} / {albumPhotos.length}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Lightbox foto de perfil ── */}
      {showPhotoLightbox && profile.profile_photo_url && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 80, background: "rgba(2,2,7,0.96)", display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowPhotoLightbox(false)}
        >
          <img
            src={profile.profile_photo_url}
            alt=""
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 12, objectFit: "contain", userSelect: "none", pointerEvents: "none" }}
          />
          <button onClick={() => setShowPhotoLightbox(false)} style={{ position: "absolute", top: 16, right: 16, padding: 8, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, color: "white", cursor: "pointer" }}>
            ✕
          </button>
        </div>
      )}
    </div>
  );
}


