import { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { MapPin, Trash2, MoreHorizontal, Flag, BarChart2 } from "lucide-react";
import {
  Heart, Fire, BookmarkSimple, PaperPlaneTilt, ChatCircle,
} from "@phosphor-icons/react";
import { feedApi } from "@/lib/api";
import { imgUrl } from "@/utils/image";
import { ProtectedAvatar } from "@/components/ProtectedImage";
import { CommentsSection } from "@/components/Comments";
import { Carousel } from "@/components/Carousel";
import { DoubleTapLike } from "@/components/DoubleTapLike";
import { ShareModal }     from "@/components/ShareModal";
import { ReportModal }    from "@/components/ReportModal";
import { PostStatsModal } from "@/components/PostStatsModal";
import { PollCard }       from "@/components/PollCard";
import { PROFILE_TYPE_CONFIG } from "@/types";
import type { Post, ProfileType } from "@/types";

// Solo 2 reacciones — semántica inmediata, sin ambigüedad
const REACTIONS = [
  { type: "heart", Icon: Heart,  colorActive: "#e05068" },
  { type: "fire",  Icon: Fire,   colorActive: "#f97316" },
] as const;

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

interface Props {
  post: Post & { media_urls?: any[]; save_count?: number; allow_share?: boolean };
  currentUserId: string;
  onDelete?: (id: string) => void;
  initialSaved?: boolean;
}

const TOKEN_RE = /(#[A-Za-z0-9À-ɏ_]{1,50}|@[A-Za-z0-9_]{2,30})/g;

function CaptionText({
  text, onTag, onMention,
}: {
  text: string;
  onTag: (tag: string) => void;
  onMention: (username: string) => void;
}) {
  // Reset lastIndex between calls since it's a global regex
  TOKEN_RE.lastIndex = 0;
  const parts = text.split(TOKEN_RE);
  return (
    <>
      {parts.map((part, i) => {
        if (/^#[A-Za-z0-9À-ɏ_]{1,50}$/.test(part)) {
          return (
            <span key={i} className="cursor-pointer font-medium"
              style={{ color: "var(--gold,#C9A227)" }}
              onClick={e => { e.stopPropagation(); onTag(part.slice(1)); }}>
              {part}
            </span>
          );
        }
        if (/^@[A-Za-z0-9_]{2,30}$/.test(part)) {
          return (
            <span key={i} className="cursor-pointer font-semibold"
              style={{ color: "var(--gold,#C9A227)" }}
              onClick={e => { e.stopPropagation(); onMention(part.slice(1)); }}>
              {part}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

export function PostCard({ post, currentUserId, onDelete, initialSaved = false }: Props) {
  const navigate = useNavigate();
  const [reactions, setReactions] = useState(post.reactions);
  const [myReaction, setMyReaction] = useState(post.viewer_reaction);
  const [loading, setLoading]     = useState(false);
  const [poppingReaction, setPoppingReaction] = useState<string | null>(null);
  const [showMenu, setShowMenu]   = useState(false);
  const [saved, setSaved]         = useState(initialSaved);
  const [showShare,  setShowShare]  = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showStats,  setShowStats]  = useState(false);
  const [pollVotes, setPollVotes] = useState<number[]>(
    (post as any).extra_data?.poll?.votes ?? []
  );
  const [pollTotal, setPollTotal] = useState<number>(
    (post as any).extra_data?.poll?.total_votes ?? 0
  );
  const [pollUserVote, setPollUserVote] = useState<number | null>(
    (post as any).user_poll_vote ?? null
  );

  const isPoll    = post.type === "poll" || !!(post as any).extra_data?.poll;
  const isOwner   = post.user_id === currentUserId;
  const repostData = (post.extra_data as any)?.repost === true ? post.extra_data as any : null;

  const mediaItems: { url: string; type?: string }[] = post.media_urls?.length
    ? post.media_urls.map((m: any) => ({ url: m.url, type: m.type || "image" }))
    : post.media_url
      ? [{ url: post.media_url, type: "image" }]
      : [];

  async function handleReact(type: string) {
    if (loading) return;

    // Pop animation feedback
    setPoppingReaction(type);
    setTimeout(() => setPoppingReaction(null), 280);

    // Optimistic update: aplicar el cambio visualmente de inmediato
    const prevReactions  = reactions;
    const prevMyReaction = myReaction;

    setLoading(true);
    if (myReaction === type) {
      setReactions(prev => ({ ...prev, [type]: Math.max(0, (prev[type] || 0) - 1) }));
      setMyReaction(undefined);
    } else if (myReaction) {
      setReactions(prev => {
        const next = { ...prev };
        next[myReaction!] = Math.max(0, (next[myReaction!] || 0) - 1);
        next[type] = (next[type] || 0) + 1;
        return next;
      });
      setMyReaction(type);
    } else {
      setReactions(prev => ({ ...prev, [type]: (prev[type] || 0) + 1 }));
      setMyReaction(type);
    }

    try {
      await feedApi.react(post.id, type);
    } catch {
      // Rollback si falla la API
      setReactions(prevReactions);
      setMyReaction(prevMyReaction);
    }
    setLoading(false);
  }

  async function handleDoubleTap() {
    if (myReaction === "heart") return;
    handleReact("heart");
  }

  async function handleSave() {
    try {
      const { data } = await feedApi.savePost(post.id);
      setSaved(data.saved);
    } catch { /* ignore */ }
  }

  async function handleDelete() {
    if (!confirm("¿Eliminar esta publicación?")) return;
    await feedApi.deletePost(post.id);
    onDelete?.(post.id);
    setShowMenu(false);
  }

  return (
    <article className="bg-bg-card border border-border rounded-2xl overflow-hidden card-hover hover:border-accent-purple/20">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Avatar con badge de verificación */}
          <button
            onClick={() => navigate(`/profile/${post.author.id}`)}
            className="relative flex-shrink-0"
          >
            <ProtectedAvatar src={post.author.avatar || ""} size={36} />
            {/* Badge dorado — todos los usuarios están verificados por KYC */}
            <div
              className="absolute -bottom-0.5 -right-0.5 w-[11px] h-[11px] rounded-full border-2 border-bg-card flex items-center justify-center"
              style={{ background: "#C9A227" }}
            >
              <svg width="6" height="5" viewBox="0 0 6 5" fill="none">
                <path d="M1 2.5l1.2 1.2L5 1" stroke="#020207" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </button>

          <div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate(`/profile/${post.author.id}`)}
                className="text-sm font-semibold leading-tight hover:text-accent-purple transition-colors"
              >
                {(post.author as any).username
                  ? `@${(post.author as any).username}`
                  : post.author.name || "Usuario"}
              </button>
              {post.author.profile_type && (() => {
                const cfg = PROFILE_TYPE_CONFIG[post.author.profile_type as ProfileType];
                return cfg
                  ? <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${cfg.dot}`}/>
                  : null;
              })()}
            </div>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {post.distance_km != null && (
                <span className="flex items-center gap-0.5">
                  <MapPin size={10}/> {post.distance_km}km
                </span>
              )}
              {post.city && <span>{post.city}</span>}
              <span>{timeAgo(post.created_at)}</span>
              {/* Visibilidad no-pública — badge sólo visible para el autor */}
              {isOwner && (post.extra_data as any)?.visibility === "followers" && (
                <span className="flex items-center gap-0.5" style={{ color: "var(--color-text-muted)" }}>
                  👥
                </span>
              )}
              {isOwner && (post.extra_data as any)?.visibility === "only_me" && (
                <span className="flex items-center gap-0.5" style={{ color: "var(--color-text-muted)" }}>
                  🔒
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={() => setShowMenu(v => !v)}
            className="p-1.5 rounded-lg hover:bg-bg-muted text-text-muted"
          >
            <MoreHorizontal size={16}/>
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-8 bg-bg-card border border-border rounded-xl shadow-xl z-20 py-1.5 min-w-[140px]"
              onClick={() => setShowMenu(false)}
            >
              {isOwner && (
                <>
                  <button
                    onClick={() => { setShowMenu(false); setShowStats(true); }}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-bg-muted"
                  >
                    <BarChart2 size={13}/> Ver estadísticas
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex items-center gap-2 w-full px-4 py-2 text-sm text-status-error hover:bg-bg-muted"
                  >
                    <Trash2 size={13}/> Eliminar
                  </button>
                </>
              )}
              <button
                onClick={() => navigate(`/profile/${post.author.id}`)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-bg-muted"
              >
                Ver perfil
              </button>
              {!isOwner && (
                <button
                  onClick={() => { setShowMenu(false); setShowReport(true); }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-status-error hover:bg-bg-muted"
                >
                  <Flag size={13}/> Reportar
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Repost: post original embebido ─────────────────────── */}
      {repostData && (
        <div
          className="mx-3 mb-1 rounded-xl border border-border/70 overflow-hidden cursor-pointer hover:border-border transition-colors"
          style={{ background: "rgba(255,255,255,0.03)" }}
          onClick={() => navigate(`/profile/${repostData.repost_author_id}`)}
        >
          {/* Autor original */}
          <div className="flex items-center gap-2 px-3 pt-2.5 pb-1.5">
            <div className="w-6 h-6 rounded-full overflow-hidden bg-bg-muted flex-shrink-0 border border-border/40">
              {repostData.repost_author_avatar
                ? <img src={imgUrl(repostData.repost_author_avatar, "avatar-sm")} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async"/>
                : <div className="w-full h-full bg-accent-purple/20"/>
              }
            </div>
            <span className="text-xs font-semibold truncate">{repostData.repost_author_name}</span>
            <span className="text-[10px] text-text-muted ml-auto flex-shrink-0">Post original</span>
          </div>

          {/* Media original */}
          {repostData.repost_media_url && (
            <div className="max-h-64 overflow-hidden">
              {repostData.repost_type === "photo" && (Array.isArray(repostData.repost_media_urls) && repostData.repost_media_urls.length > 1) ? (
                <Carousel
                  items={repostData.repost_media_urls.map((m: any) => ({ url: m.url, type: m.type || "image" }))}
                  aspectRatio="square"
                />
              ) : repostData.repost_media_urls?.[0]?.type === "video" || /\.(mp4|mov|webm)/i.test(repostData.repost_media_url) ? (
                <video
                  src={repostData.repost_media_url}
                  className="w-full object-cover max-h-64"
                  muted playsInline preload="metadata"
                />
              ) : (
                <img
                  src={repostData.repost_media_url}
                  alt=""
                  className="w-full object-cover max-h-64"
                  draggable={false}
                />
              )}
            </div>
          )}

          {/* Caption original */}
          {repostData.repost_caption && (
            <p className="px-3 py-2 text-xs text-text-secondary leading-relaxed line-clamp-3">
              {repostData.repost_caption}
            </p>
          )}
          {!repostData.repost_media_url && !repostData.repost_caption && (
            <p className="px-3 py-2 text-xs text-text-muted italic">Publicación original</p>
          )}
        </div>
      )}

      {/* Media */}
      {!repostData && mediaItems.length > 0 && (
        <DoubleTapLike onDoubleTap={handleDoubleTap}>
          <Carousel items={mediaItems} aspectRatio="square"/>
        </DoubleTapLike>
      )}

      {/* Poll */}
      {isPoll && (post as any).extra_data?.poll && (
        <PollCard
          postId={post.id}
          poll={{
            ...(post as any).extra_data.poll,
            votes: pollVotes.length ? pollVotes : (post as any).extra_data.poll.votes,
            total_votes: pollTotal || (post as any).extra_data.poll.total_votes,
          }}
          userVote={pollUserVote}
          expiresAt={post.expires_at ?? null}
          onVoted={(idx, votes, total) => {
            setPollUserVote(idx);
            setPollVotes(votes);
            setPollTotal(total);
          }}
        />
      )}

      {/* Caption */}
      {post.caption && !isPoll && (
        <p className="px-4 py-2.5 text-sm text-text-secondary leading-relaxed">
          <span
            className="font-semibold text-text-primary mr-1.5 cursor-pointer hover:underline"
            onClick={() => navigate(`/profile/${post.author.id}`)}
          >
            {(post.author as any).username
              ? `@${(post.author as any).username}`
              : post.author.name?.split(" ")[0]}
          </span>
          <CaptionText
            text={post.caption}
            onTag={tag => navigate(`/explore?tab=hashtag&tag=${encodeURIComponent(tag)}`)}
            onMention={async username => {
              try {
                const { searchApi } = await import("@/lib/api");
                const { data } = await searchApi.search(username, 1);
                const u = data.users?.find((u: any) => u.username?.toLowerCase() === username.toLowerCase());
                if (u?.id) navigate(`/profile/${u.id}`);
                else navigate(`/explore?q=${encodeURIComponent("@" + username)}`);
              } catch { navigate(`/explore`); }
            }}
          />
        </p>
      )}

      {/* ── Actions bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pb-3 pt-2">

        {/* Izquierda: reacciones — engagement emocional */}
        <div className="flex items-center gap-4">
          {REACTIONS.map(({ type, Icon, colorActive }) => {
            const count  = reactions?.[type] || 0;
            const active = myReaction === type;
            const label  = type === "heart" ? "Me gusta" : "Me encanta";
            return (
              <button
                key={type}
                onClick={() => handleReact(type)}
                disabled={loading}
                className={`flex flex-col items-center gap-0.5 transition-transform active:scale-95 ${poppingReaction === type ? "animate-pop" : ""}`}
                aria-label={label}
              >
                <div
                  className={`flex items-center gap-1 px-2 py-1 rounded-xl transition-all duration-150 ${active ? "bg-white/[0.05]" : ""}`}
                >
                  <Icon
                    size={20}
                    weight={active ? "fill" : "light"}
                    style={{ color: active ? colorActive : "var(--color-text-muted, #6b7280)" }}
                  />
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{ color: active ? colorActive : count > 0 ? "var(--color-text-secondary, #9ca3af)" : "var(--color-text-muted, #6b7280)", opacity: count === 0 ? 0.4 : 1 }}
                    >
                      {count}
                    </span>
                </div>
                <span className="text-[9px] leading-none" style={{ color: active ? colorActive : "var(--color-text-muted, #6b7280)" }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Derecha: utilidades */}
        <div className="flex items-center gap-3">
          {/* Comentarios con contador */}
          {post.type !== "story" && (
            <div className="flex flex-col items-center gap-0.5">
              <div className="flex items-center gap-1 px-2 py-1 rounded-xl">
                <ChatCircle size={20} weight="light" style={{ color: "var(--color-text-muted, #6b7280)" }} />
                <span className="text-xs font-medium tabular-nums" style={{ color: (post.comments_count ?? 0) > 0 ? "var(--color-text-secondary, #9ca3af)" : "var(--color-text-muted, #6b7280)", opacity: (post.comments_count ?? 0) === 0 ? 0.4 : 1 }}>
                  {post.comments_count ?? 0}
                </span>
              </div>
              <span className="text-[9px] leading-none" style={{ color: "var(--color-text-muted, #6b7280)" }}>Comentarios</span>
            </div>
          )}
          {/* Guardar */}
          <button
            onClick={handleSave}
            className="flex flex-col items-center gap-0.5 transition-colors"
            title={saved ? "Guardado" : "Guardar"}
          >
            <BookmarkSimple
              size={19}
              weight={saved ? "fill" : "light"}
              style={{ color: saved ? "var(--gold, #C9A227)" : "var(--color-text-muted, #6b7280)" }}
            />
            <span className="text-[9px] leading-none" style={{ color: saved ? "var(--gold, #C9A227)" : "var(--color-text-muted, #6b7280)" }}>
              {saved ? "Guardado" : "Guardar"}
            </span>
          </button>

          {/* Compartir */}
          {post.allow_share !== false && (
            <button
              onClick={() => setShowShare(true)}
              className="flex flex-col items-center gap-0.5 text-text-muted transition-colors hover:text-text-primary"
              title="Compartir"
            >
              <PaperPlaneTilt size={19} weight="light" />
              <span className="text-[9px] leading-none">Compartir</span>
            </button>
          )}

          {/* Mensaje directo al autor */}
          {!isOwner && (
            <button
              onClick={() => navigate(`/messages?with=${post.author.id}`)}
              className="flex flex-col items-center gap-0.5 transition-colors hover:text-accent-purple"
              title="Enviar mensaje"
              style={{ color: "var(--color-text-muted, #6b7280)" }}
            >
              <ChatCircle size={19} weight="light" />
              <span className="text-[9px] leading-none">Mensaje</span>
            </button>
          )}
        </div>
      </div>

      {/* Comments */}
      {post.type !== "story" && (
        <CommentsSection postId={post.id} postOwnerId={post.author.id}/>
      )}

      {/* Stats modal */}
      {showStats && createPortal(
        <PostStatsModal postId={post.id} onClose={() => setShowStats(false)} />,
        document.body
      )}

      {/* Report modal */}
      {showReport && createPortal(
        <ReportModal
          targetType="post"
          targetId={post.id}
          targetName={post.caption?.slice(0, 80)}
          onClose={() => setShowReport(false)}
        />,
        document.body
      )}

      {/* Share modal — portal para evitar que position:fixed quede relativo al article */}
      {showShare && createPortal(
        <ShareModal
          postId={post.id}
          authorId={post.author.id}
          currentUserId={currentUserId}
          caption={post.caption}
          onClose={() => setShowShare(false)}
        />,
        document.body
      )}
    </article>
  );
}
