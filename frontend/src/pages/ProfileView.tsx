/**
 * ProfileView — perfil público rediseñado según La Estratega.
 * Orden: Trust (foto + badge) → Acción → Bio → Qué buscás → Stats/Racha → Galería → Albums
 */
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, Star, ShareNetwork, Pencil, Lock, User, Images, CaretLeft, CaretRight, X, QrCode } from "@phosphor-icons/react";
import { ProfileQRModal } from "@/components/ProfileQRModal";
import { profilesApi, followsApi, albumsApi, feedApi, reviewsApi, extendedProfileApi } from "@/lib/api";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { ProfileNote } from "@/components/profile/ProfileNote";
import { StatCounter } from "@/components/profile/StatCounter";
import { RichBio } from "@/components/profile/RichBio";
import { HighlightsCarousel } from "@/components/profile/HighlightsCarousel";
import { ProfileFeedTabs } from "@/components/profile/ProfileFeedTabs";
import { ProfileGrid } from "@/components/profile/ProfileGrid";
import { ProfileActions } from "@/components/profile/ProfileActions";
import { ShareProfileSheet } from "@/components/profile/ShareProfileSheet";
import { EditProfileDrawer } from "@/components/profile/EditProfileDrawer";
import { type ProfileFeedTab } from "@/hooks/useInfiniteUserPosts";
import { ReportModal } from "@/components/ReportModal";
import { BadgeRow }    from "@/components/BadgeDisplay";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { useOnlineStatus, formatLastSeen } from "@/hooks/useOnlineStatus";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { ProtectedAvatar } from "@/components/ProtectedImage";
import { PostCard } from "@/components/PostCard";
import { Button } from "@/components/ui/Button";
import { PROFILE_TYPE_CONFIG, ORIENTATION_CONFIG } from "@/types";
import type { ProfileType, SexualOrientation, ProfileNote as TProfileNote } from "@/types";
import { toast } from "@/store/toastStore";

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
  const qc = useQueryClient();
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
  const [showPhotoLightbox, setShowPhotoLightbox] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });
  const [albums, setAlbums]           = useState<any[]>([]);
  const [feedTab, setFeedTab]         = useState<ProfileFeedTab>("posts");
  const [pinLoading, setPinLoading]   = useState(false);
  const [reviews, setReviews]         = useState<any[]>([]);
  const [followListType, setFollowListType] = useState<"followers"|"following"|null>(null);
  const [followList, setFollowList]   = useState<any[]>([]);
  const [followListLoading, setFollowListLoading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<any | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<any | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<any[]>([]);
  const [albumPhotoIdx, setAlbumPhotoIdx] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showEditDrawer, setShowEditDrawer] = useState(false);
  const [note, setNote] = useState<TProfileNote | null>(null);

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

    // Follow counts
    Promise.all([
      followsApi.followers(userId, { limit: 1 }),
      followsApi.following(userId, { limit: 1 }),
    ]).then(([frs, fng]) => {
      setFollowCounts({ followers: frs.data.total, following: fng.data.total });
    }).catch(() => {});

    // Albums
    albumsApi.listUser(userId).then(r => setAlbums(r.data)).catch(() => {});

    // Reseñas
    reviewsApi.forUser(userId, { limit: 5 }).then(r => {
      setReviews(r.data.reviews || r.data || []);
    }).catch(() => {});

    // Nota temporal del perfil
    profilesApi.getNote(userId).then(r => setNote(r.data || null)).catch(() => {});

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
      toast.error("No se pudo bloquear. Intentá de nuevo.");
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
      toast.error("No se pudo desbloquear. Intentá de nuevo.");
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

  async function handleSaveNote(text: string) {
    try { const { data } = await profilesApi.setNote(text); setNote(data); }
    catch { /* ignore */ }
  }

  async function handleDeleteNote() {
    setNote(null);
    try { await profilesApi.deleteNote(); } catch { /* ignore */ }
  }

  // Esperar a que auth cargue antes de determinar isOwnProfile.
  // Sin este guard, el componente monta con me=null → isOwnProfile=false →
  // renderiza ProfileActions sobre el propio perfil hasta que auth carga.
  if (!me) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-[var(--ash)] border-t-[var(--gold)] rounded-full animate-spin"/>
    </div>
  );

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

      {/* QR Modal — solo perfil propio */}
      {showQR && isOwnProfile && (
        <ProfileQRModal
          userId={userId!}
          userName={`${profile.first_name} ${profile.last_name}`.trim()}
          onClose={() => setShowQR(false)}
        />
      )}

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(2,2,7,0.92)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-soft)", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button onClick={() => navigate(-1)} style={{ padding: 8, borderRadius: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
          <ArrowLeft size={18} strokeWidth={1.5}/>
        </button>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: "0.18em", color: "var(--mist)", textTransform: "uppercase" }}>
          {displayName}
        </p>
        {/* Acciones (compartir/bloquear/reportar) viven ahora en el overflow de ProfileActions */}
        {!isOwnProfile && <div style={{ width: 34 }} aria-hidden />}
        {isOwnProfile && (
          <div style={{ display: "flex", gap: 4 }}>
            <Tooltip label="Mi QR" position="bottom">
              <button onClick={() => setShowQR(true)} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <QrCode size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
            <Tooltip label="Compartir" position="bottom">
              <button onClick={() => setShowShareSheet(true)} style={{ padding: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                <ShareNetwork size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
            <Tooltip label="Editar perfil" position="bottom">
              <button onClick={() => setShowEditDrawer(true)} style={{ padding: 8, background: "none", border: "none", color: "var(--gold)", cursor: "pointer" }}>
                <Pencil size={16} strokeWidth={1.5}/>
              </button>
            </Tooltip>
          </div>
        )}
      </header>

      <main style={{ maxWidth: 520, margin: "0 auto", padding: "0 0 80px" }}>

        {/* ── ZONA 1: Trust + Atracción ── */}
        <div style={{ position: "relative", textAlign: "center", padding: "32px 24px 0" }}>
          {/* Nota temporal (estilo IG) sobre el avatar */}
          {(note || isOwnProfile) && (
            <ProfileNote note={note} isOwn={isOwnProfile} onSave={handleSaveNote} onDelete={handleDeleteNote} />
          )}

          {/* Avatar con anillo de story — click abre lightbox */}
          <ProfileAvatar
            photoUrl={profile.profile_photo_url}
            hasActiveStory={profile.has_active_story}
            storySeen={profile.story_seen}
            onClick={() => profile.profile_photo_url && setShowPhotoLightbox(true)}
          />

          {/* Username + Badge — inseparables según La Estratega */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 6 }}>
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-m)", fontWeight: 400, color: "var(--paper)" }}>
              {displayName}
            </h1>
            <VerifiedBadge size="sm"/>
          </div>

          {/* Badge "Miembro desde [año]" — señaliza experiencia en la comunidad */}
          {profile.created_at && (
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em",
                textTransform: "uppercase", color: "rgba(201,162,39,0.55)",
                padding: "2px 8px", border: "1px solid rgba(201,162,39,0.18)",
                borderRadius: 99, background: "rgba(201,162,39,0.05)",
              }}>
                Miembro desde {new Date(profile.created_at).getFullYear()}
              </span>
            </div>
          )}

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
            <ProfileActions
              userId={userId!}
              isPrivateAccount={profile.is_private}
              liked={liked}
              onLike={handleLike}
              onFollowChange={(next, prev) => {
                if (next.i_follow !== prev.i_follow) {
                  setFollowCounts(p => ({ ...p, followers: Math.max(0, p.followers + (next.i_follow ? 1 : -1)) }));
                }
              }}
              onShare={() => setShowShareSheet(true)}
              onBlock={handleBlock}
              onReport={() => setShowReport(true)}
            />
          )}
        </div>

        {/* ── Intereses en común (solo visible para el visitante, no para el dueño del perfil) ── */}
        {me && me.id !== userId && (() => {
          const myTags: string[] = (me as any).seeking_tags || [];
          const theirTags: string[] = profile.seeking_tags || [];
          const common = myTags.filter(t => theirTags.includes(t));
          if (common.length === 0) return null;
          return (
            <div style={{ padding: "0 24px 16px", display: "flex", justifyContent: "center" }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 99,
                background: "rgba(201,162,39,0.08)",
                border: "1px solid rgba(201,162,39,0.22)",
              }}>
                <span style={{ fontSize: 12 }}>✦</span>
                <span style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--gold, #C9A227)", fontWeight: 500 }}>
                  {common.length === 1
                    ? `1 interés en común`
                    : `${common.length} intereses en común`}
                </span>
              </div>
            </div>
          );
        })()}

        {/* ── ZONA 2: Bio enriquecida (menciones, hashtags, links) ── */}
        <RichBio bio={profile.bio} links={profile.profile_extended?.links} />

        {(profile.city || profile.province || profile.profile_extended?.website) && (
          <div style={{ padding: "0 24px 20px" }}>
            {(profile.city || profile.province) && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <MapPin size={12} style={{ color: "var(--mist)" }} strokeWidth={1.5}/>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--mist)", letterSpacing: "0.14em" }}>
                  {profile.city && profile.city !== profile.province ? `${profile.city}, ` : ""}{profile.province}
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
        {(() => {
          const hasReviews = (profile.review_stats?.total_reviews || 0) > 0;
          return (
            <div style={{ display: "grid", gridTemplateColumns: hasReviews ? "1fr 1fr 1fr" : "1fr 1fr", gap: 1, margin: "0 0 24px", borderTop: "1px solid var(--border-soft)", borderBottom: "1px solid var(--border-soft)", background: "var(--border-soft)" }}>
              <StatCounter value={followCounts.followers} label="Seguidores" onClick={() => openFollowList("followers")} />
              <StatCounter value={followCounts.following} label="Siguiendo"  onClick={() => openFollowList("following")} />
              {hasReviews && (
                <StatCounter value={profile.review_stats!.total_reviews} label="Reseñas" onClick={() => navigate(`/reviews/${userId}`)} />
              )}
            </div>
          );
        })()}

        {/* ── ZONA 3b: Badges ── */}
        <div style={{ padding: "0 24px 20px", display: "flex", justifyContent: "center" }}>
          <BadgeRow userId={userId!} maxShow={6} size="sm" />
        </div>

        {/* ── ZONA 3c: Highlights ── */}
        <HighlightsCarousel userId={userId!} isOwn={isOwnProfile} />

        {/* ── ZONA 4: Grilla multi-tab (Publicaciones/Reels/Guardados/Etiquetados) ── */}
        {profile.is_private && !isOwnProfile ? (
          <div style={{ padding: "48px 24px", textAlign: "center", borderTop: "1px solid var(--border-soft)" }}>
            <Lock size={26} style={{ color: "var(--mist)", marginBottom: 12 }}/>
            <p style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-display-s)", color: "var(--paper)", marginBottom: 6 }}>
              Esta cuenta es privada
            </p>
            <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--mist)", maxWidth: 280, margin: "0 auto" }}>
              Seguí a {profile.first_name} para ver sus publicaciones y álbumes.
            </p>
          </div>
        ) : (
          <>
            <div style={{ padding: "0 0 0" }}>
              <ProfileFeedTabs tab={feedTab} onChange={setFeedTab} isOwn={isOwnProfile} />
              <ProfileGrid
                userId={userId!}
                tab={feedTab}
                isOwn={isOwnProfile}
                pinnedPostId={profile?.profile_extended?.pinned_post_id as string | undefined}
                pinLoading={pinLoading}
                onTogglePin={handlePinPost}
                onSelectPost={setSelectedPost}
              />
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
          </>
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
                qc.invalidateQueries({ queryKey: ["userPosts", userId] });
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
                  <CaretLeft size={20}/>
                </button>
              )}
              {albumPhotoIdx < albumPhotos.length - 1 && (
                <button
                  onClick={() => setAlbumPhotoIdx(i => Math.min(albumPhotos.length - 1, i + 1))}
                  style={{ position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)", padding: 10, background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", color: "white", cursor: "pointer" }}
                >
                  <CaretRight size={20}/>
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

      {/* ── Compartir perfil ── */}
      {showShareSheet && (
        <ShareProfileSheet
          userId={userId!}
          userName={`${profile.first_name} ${profile.last_name || ""}`.trim()}
          onClose={() => setShowShareSheet(false)}
        />
      )}

      {/* ── Editar perfil ── */}
      {showEditDrawer && isOwnProfile && (
        <EditProfileDrawer
          onClose={() => setShowEditDrawer(false)}
          onSaved={() => {
            setShowEditDrawer(false);
            setLoading(true);
            profilesApi.get(userId!).then(r => setProfile(r.data)).catch(() => {}).finally(() => setLoading(false));
          }}
        />
      )}
    </div>
  );
}


