import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Heart, Shield, ShieldOff, Flag,
  MapPin, Star, Eye, Lock, Users, User,
} from "lucide-react";
import { StoryHighlights } from "@/components/StoryHighlights";
import { profilesApi, followsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { ProtectedImage } from "@/components/ProtectedImage";
import { Card } from "@/components/ui/Card";
import { PROFILE_TYPE_CONFIG, ORIENTATION_CONFIG } from "@/types";
import type { ProfileType, SexualOrientation } from "@/types";

const REPORT_REASONS: { value: string; label: string }[] = [
  { value: "spam",                label: "Spam o publicidad" },
  { value: "acoso",               label: "Acoso o amenazas" },
  { value: "contenido_inapropiado", label: "Contenido inapropiado" },
  { value: "perfil_falso",        label: "Perfil falso o suplantación" },
  { value: "menor_de_edad",       label: "Posible menor de edad" },
  { value: "otro",                label: "Otro motivo" },
];

function MatchModal({ name, avatar, onClose }: { name: string; avatar?: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-card border border-accent-purple/30 rounded-2xl p-8 max-w-xs w-full mx-4 text-center shadow-glow animate-slide-up">
        <div className="flex justify-center gap-4 mb-6">
          <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-accent-purple/50">
            {avatar
              ? <img src={avatar} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-accent-purple/20 flex items-center justify-center"><User size={32} className="text-accent-purple" /></div>
            }
          </div>
        </div>
        <p className="text-xs text-accent-purple uppercase tracking-widest font-semibold mb-2">Match</p>
        <h2 className="text-xl font-bold mb-2">Es mutuo con {name}</h2>
        <p className="text-text-muted text-sm mb-6">Ambos mostraron interés. Pueden iniciar una conversación.</p>
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-accent-purple text-white font-semibold text-sm hover:opacity-90 transition-all"
        >
          Continuar
        </button>
      </div>
    </div>
  );
}

function ReportModal({ onClose, onSubmit }: { onClose: () => void; onSubmit: (reason: string, details: string) => void }) {
  const [reason, setReason]   = useState("");
  const [details, setDetails] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-bg-card border border-border rounded-2xl p-6 max-w-sm w-full mx-4 animate-slide-up">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Flag size={15} className="text-status-error" /> Reportar perfil
        </h3>
        <div className="space-y-2 mb-4">
          {REPORT_REASONS.map(r => (
            <button
              key={r.value}
              onClick={() => setReason(r.value)}
              className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all ${
                reason === r.value
                  ? "border-status-error/50 bg-status-error/8 text-status-error"
                  : "border-border/60 bg-bg-muted/40 text-text-secondary hover:border-status-error/30"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <textarea
          value={details}
          onChange={e => setDetails(e.target.value)}
          placeholder="Detalles adicionales (opcional)..."
          rows={3}
          className="w-full bg-bg-muted/60 border border-border/60 rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-status-error/50 mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-border text-sm text-text-muted hover:bg-bg-muted transition-all">
            Cancelar
          </button>
          <button
            onClick={() => reason && onSubmit(reason, details)}
            disabled={!reason}
            className="flex-1 py-2.5 rounded-xl bg-status-error text-white text-sm font-semibold disabled:opacity-40 hover:opacity-90 transition-all"
          >
            Enviar reporte
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProfileView() {
  const { userId } = useParams<{ userId: string }>();
  const navigate   = useNavigate();
  const { user: me } = useAuthStore();
  useScreenCapture({ warn: true });

  const [profile, setProfile]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<"blocked" | "private" | "notfound" | null>(null);
  const [liked, setLiked]             = useState(false);
  const [matched, setMatched]         = useState(false);
  const [blocked, setBlocked]         = useState(false);
  const [showMatch, setShowMatch]     = useState(false);
  const [showReport, setShowReport]   = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [reported, setReported]       = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followCounts, setFollowCounts] = useState({ followers: 0, following: 0 });

  const isOwnProfile = me?.id === userId;

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    profilesApi.get(userId)
      .then(r => {
        setProfile(r.data);
        setLiked(r.data.viewer_liked ?? false);
        setMatched(r.data.matched ?? false);
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

    if (!isOwnProfile) {
      followsApi.status(userId).then(r => setIsFollowing(r.data.i_follow)).catch(() => {});
    }
    // Cargar contadores de seguidores
    Promise.all([
      followsApi.followers(userId, { limit: 1 }),
      followsApi.following(userId, { limit: 1 }),
    ]).then(([frs, fng]) => {
      setFollowCounts({ followers: frs.data.total, following: fng.data.total });
    }).catch(() => {});
  }, [userId, isOwnProfile]);

  async function handleLike() {
    if (!userId || actionLoading) return;
    setActionLoading(true);
    try {
      const { data } = await profilesApi.like(userId);
      setLiked(data.liked);
      if (data.matched && !matched) {
        setMatched(true);
        setShowMatch(true);
      } else if (!data.liked) {
        setMatched(false);
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

  async function handleReport(reason: string, details: string) {
    if (!userId) return;
    try {
      await profilesApi.report(userId, { reason, details });
      setReported(true);
    } catch { /* ignore */ }
    setShowReport(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-bg-base flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-accent-purple/40 border-t-accent-purple rounded-full animate-spin" />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-bg-base flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-full bg-bg-card border border-border flex items-center justify-center mb-4">
        {error === "blocked" ? <ShieldOff size={24} className="text-text-muted" /> : <Lock size={24} className="text-text-muted" />}
      </div>
      <h2 className="font-semibold mb-2">
        {error === "blocked" ? "Perfil bloqueado" : error === "private" ? "Perfil privado" : "Perfil no encontrado"}
      </h2>
      <p className="text-text-muted text-sm mb-6">
        {error === "blocked"
          ? "No podés ver este perfil."
          : error === "private"
            ? "Este perfil no está disponible para tu tipo de cuenta."
            : "Este perfil no existe o fue eliminado."}
      </p>
      <button onClick={() => navigate(-1)} className="text-accent-purple text-sm hover:underline">Volver</button>
    </div>
  );

  if (!profile) return null;

  const typeCfg   = profile.profile_type ? PROFILE_TYPE_CONFIG[profile.profile_type as ProfileType] : null;
  const orientCfg = profile.sexual_orientation && profile.sexual_orientation !== "na"
    ? ORIENTATION_CONFIG[profile.sexual_orientation as SexualOrientation] : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary animate-fade-in">
      {showMatch && (
        <MatchModal
          name={profile.first_name}
          avatar={profile.profile_photo_url}
          onClose={() => setShowMatch(false)}
        />
      )}
      {showReport && (
        <ReportModal
          onClose={() => setShowReport(false)}
          onSubmit={handleReport}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/85 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-bg-muted transition-colors">
          <ArrowLeft size={17} className="text-text-muted" />
        </button>
        <span className="font-semibold text-sm text-text-primary truncate max-w-[160px]">
          {profile.first_name} {profile.last_name}
        </span>
        {!isOwnProfile && (
          <div className="flex gap-1">
            <button
              onClick={handleBlock}
              className={`p-2 rounded-xl transition-colors ${blocked ? "text-status-error" : "text-text-muted hover:bg-bg-muted"}`}
              title="Bloquear"
            >
              <ShieldOff size={17} />
            </button>
            <button
              onClick={() => setShowReport(true)}
              disabled={reported}
              className="p-2 rounded-xl text-text-muted hover:bg-bg-muted transition-colors disabled:opacity-40"
              title="Reportar"
            >
              <Flag size={17} />
            </button>
          </div>
        )}
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Avatar + info principal */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-28 h-28 rounded-full overflow-hidden border-2 border-border">
            {profile.profile_photo_url
              ? <img src={profile.profile_photo_url} alt="" className="w-full h-full object-cover" />
              : <div className="w-full h-full bg-bg-muted flex items-center justify-center"><User size={40} className="text-text-muted" /></div>
            }
          </div>

          <div>
            <h1 className="text-xl font-bold">{profile.first_name} {profile.last_name}</h1>
            <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
              {typeCfg && (
                <span className={`text-xs px-2.5 py-1 rounded-full bg-bg-muted flex items-center gap-1.5 ${typeCfg.color}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${typeCfg.dot}`} />
                  {typeCfg.label}
                </span>
              )}
              {orientCfg && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-bg-muted text-text-muted">{orientCfg.label}</span>
              )}
              {profile.matched && (
                <span className="text-xs px-2.5 py-1 rounded-full bg-accent-purple/15 border border-accent-purple/30 text-accent-purple">
                  Match
                </span>
              )}
            </div>
            {profile.province && (
              <p className="text-text-muted text-xs mt-1 flex items-center justify-center gap-1">
                <MapPin size={11} /> {profile.city ? `${profile.city}, ` : ""}{profile.province}
              </p>
            )}
          </div>

          {/* Contadores seguidores */}
          <div className="flex items-center gap-6 text-center">
            <div>
              <p className="text-lg font-bold">{followCounts.followers}</p>
              <p className="text-xs text-text-muted">Seguidores</p>
            </div>
            <div className="w-px h-8 bg-border"/>
            <div>
              <p className="text-lg font-bold">{followCounts.following}</p>
              <p className="text-xs text-text-muted">Siguiendo</p>
            </div>
          </div>

          {/* Highlights */}
          {userId && <StoryHighlights userId={userId} isOwn={isOwnProfile} />}

          {/* Bio */}
          {profile.bio && <p className="text-text-secondary text-sm max-w-sm">{profile.bio}</p>}

          {/* Descripción identidad diversa */}
          {profile.identity_description && (
            <p className="text-text-muted text-xs italic max-w-sm">{profile.identity_description}</p>
          )}

          {/* Botones de acción (no propio perfil) */}
          {!isOwnProfile && (
            <div className="flex gap-3">
              {/* Follow */}
              <button
                onClick={handleFollow}
                disabled={actionLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  isFollowing
                    ? "border-border bg-bg-muted text-text-secondary"
                    : "border-accent-purple/40 bg-accent-purple/8 text-accent-purple hover:bg-accent-purple/15"
                }`}
              >
                <Users size={14} />
                {isFollowing ? "Siguiendo" : "Seguir"}
              </button>
              {/* Like */}
              <button
                onClick={handleLike}
                disabled={actionLoading}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  liked
                    ? "border-status-error/50 bg-status-error/10 text-status-error"
                    : "border-border bg-bg-muted text-text-muted hover:text-status-error hover:border-status-error/30"
                }`}
              >
                <Heart size={14} fill={liked ? "currentColor" : "none"} />
                {liked ? (matched ? "Match" : "Te gusta") : "Me gusta"}
              </button>
            </div>
          )}
        </div>

        {/* Extended profile: pareja/grupo */}
        {profile.profile_extended?.members?.length > 0 && (
          <Card className="p-4">
            <p className="text-xs text-text-muted uppercase tracking-widest mb-3 font-medium">
              {profile.profile_type === "pareja" ? "Integrantes" : `Grupo de ${profile.profile_extended.size ?? profile.profile_extended.members.length}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {profile.profile_extended.members.map((m: any, i: number) => (
                <div key={i} className="bg-bg-muted/50 rounded-xl px-3 py-2.5 border border-border/40">
                  <p className="text-xs font-medium text-text-primary capitalize">{m.gender ?? "—"}</p>
                  {m.orientation && <p className="text-[11px] text-text-muted">{ORIENTATION_CONFIG[m.orientation as SexualOrientation]?.label}</p>}
                  <div className="flex gap-2 mt-1 text-[11px] text-text-muted">
                    {m.age && <span>{m.age}a</span>}
                    {m.height && <span>{m.height}cm</span>}
                    {m.weight && <span>{m.weight}kg</span>}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Reseñas stats */}
        {profile.review_stats && profile.review_stats.total_reviews > 0 && (
          <Card className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-bg-muted flex items-center justify-center flex-shrink-0">
              <Star size={18} className="text-amber-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">{profile.review_stats.avg_rating?.toFixed(1) ?? "—"} / 5</p>
              <p className="text-text-muted text-xs">{profile.review_stats.total_reviews} reseña{profile.review_stats.total_reviews !== 1 ? "s" : ""}</p>
            </div>
          </Card>
        )}

        {/* Posts */}
        {profile.posts?.length > 0 && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-widest mb-3 font-medium">Publicaciones</p>
            <div className="grid grid-cols-3 gap-1.5">
              {profile.posts.map((p: any) => (
                <div key={p.id} className="aspect-square rounded-xl overflow-hidden bg-bg-muted border border-border/40">
                  {p.media_url
                    ? <ProtectedImage src={p.media_url} alt="" className="w-full h-full object-cover" />
                    : (
                      <div className="w-full h-full flex items-center justify-center p-2">
                        <p className="text-[10px] text-text-muted text-center leading-tight">{p.caption}</p>
                      </div>
                    )
                  }
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reseñas */}
        {profile.reviews?.length > 0 && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-widest mb-3 font-medium">Reseñas</p>
            <div className="space-y-3">
              {profile.reviews.map((r: any) => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-muted">
                        {r.users?.profile_photo_url
                          ? <img src={r.users.profile_photo_url} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center"><User size={12} className="text-text-muted" /></div>
                        }
                      </div>
                      <p className="text-xs text-text-muted">
                        {r.is_anonymous ? "Anónimo" : `${r.users?.first_name ?? ""}`}
                      </p>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(s => (
                        <Star key={s} size={11} className={s <= r.rating ? "text-amber-400" : "text-border"} fill={s <= r.rating ? "currentColor" : "none"} />
                      ))}
                    </div>
                  </div>
                  {r.text && <p className="text-sm text-text-secondary">{r.text}</p>}
                </Card>
              ))}
            </div>
          </div>
        )}

        {reported && (
          <p className="text-center text-status-success text-sm">Reporte enviado. Lo revisaremos pronto.</p>
        )}
      </main>
    </div>
  );
}
