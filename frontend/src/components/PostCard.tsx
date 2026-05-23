import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Trash2, MoreHorizontal } from "lucide-react";
import {
  Heart, Fire, BookmarkSimple, PaperPlaneTilt, ChatCircle,
} from "@phosphor-icons/react";
import { feedApi } from "@/lib/api";
import { ProtectedAvatar } from "@/components/ProtectedImage";
import { CommentsSection } from "@/components/Comments";
import { Carousel } from "@/components/Carousel";
import { DoubleTapLike } from "@/components/DoubleTapLike";
import { ShareModal } from "@/components/ShareModal";
import { PollCard } from "@/components/PollCard";
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
}

export function PostCard({ post, currentUserId, onDelete }: Props) {
  const navigate = useNavigate();
  const [reactions, setReactions] = useState(post.reactions);
  const [myReaction, setMyReaction] = useState(post.viewer_reaction);
  const [loading, setLoading]     = useState(false);
  const [showMenu, setShowMenu]   = useState(false);
  const [saved, setSaved]         = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [pollVotes, setPollVotes] = useState<number[]>(
    (post as any).extra_data?.poll?.votes ?? []
  );
  const [pollTotal, setPollTotal] = useState<number>(
    (post as any).extra_data?.poll?.total_votes ?? 0
  );
  const [pollUserVote, setPollUserVote] = useState<number | null>(
    (post as any).user_poll_vote ?? null
  );

  const isPoll  = post.type === "poll" || !!(post as any).extra_data?.poll;
  const isOwner = post.user_id === currentUserId;

  const mediaItems: { url: string; type?: string }[] = post.media_urls?.length
    ? post.media_urls.map((m: any) => ({ url: m.url, type: m.type || "image" }))
    : post.media_url
      ? [{ url: post.media_url, type: "image" }]
      : [];

  async function handleReact(type: string) {
    if (loading) return;
    setLoading(true);
    try {
      const { data } = await feedApi.react(post.id, type);
      setReactions(prev => {
        const next = { ...prev };
        if (data.action === "removed") {
          next[type] = Math.max(0, (next[type] || 0) - 1);
          setMyReaction(undefined);
        } else if (data.action === "changed") {
          if (myReaction) next[myReaction] = Math.max(0, (next[myReaction] || 0) - 1);
          next[type] = (next[type] || 0) + 1;
          setMyReaction(type);
        } else {
          next[type] = (next[type] || 0) + 1;
          setMyReaction(type);
        }
        return next;
      });
    } catch { /* ignore */ }
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
    <article className="bg-bg-card border border-border rounded-2xl overflow-hidden">

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
                <button
                  onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-status-error hover:bg-bg-muted"
                >
                  <Trash2 size={13}/> Eliminar
                </button>
              )}
              <button
                onClick={() => navigate(`/profile/${post.author.id}`)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-bg-muted"
              >
                Ver perfil
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Media */}
      {mediaItems.length > 0 && (
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
          {post.caption}
        </p>
      )}

      {/* ── Actions bar ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 pb-3 pt-2">

        {/* Izquierda: reacciones — engagement emocional */}
        <div className="flex items-center gap-4">
          {REACTIONS.map(({ type, Icon, colorActive }) => {
            const count  = reactions?.[type] || 0;
            const active = myReaction === type;
            return (
              <button
                key={type}
                onClick={() => handleReact(type)}
                disabled={loading}
                className="flex items-center gap-1.5 transition-transform active:scale-110"
                aria-label={type === "heart" ? "Me gusta" : "Fuego"}
              >
                <Icon
                  size={20}
                  weight={active ? "fill" : "light"}
                  style={{ color: active ? colorActive : "var(--color-text-muted, #6b7280)" }}
                />
                {count > 0 && (
                  <span
                    className="text-xs font-medium tabular-nums"
                    style={{ color: active ? colorActive : "var(--color-text-muted, #6b7280)" }}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Derecha: utilidades — sin contadores */}
        <div className="flex items-center gap-3">
          {/* Guardar */}
          <button
            onClick={handleSave}
            className="p-1 transition-colors"
            title={saved ? "Guardado" : "Guardar"}
          >
            <BookmarkSimple
              size={19}
              weight={saved ? "fill" : "light"}
              style={{ color: saved ? "var(--gold, #C9A227)" : "var(--color-text-muted, #6b7280)" }}
            />
          </button>

          {/* Compartir */}
          {post.allow_share !== false && (
            <button
              onClick={() => setShowShare(true)}
              className="p-1 text-text-muted transition-colors hover:text-text-primary"
              title="Compartir"
            >
              <PaperPlaneTilt size={19} weight="light" />
            </button>
          )}

          {/* Mensaje directo al autor */}
          {!isOwner && (
            <button
              onClick={() => navigate(`/messages?with=${post.author.id}`)}
              className="p-1 transition-colors hover:text-accent-purple"
              title="Enviar mensaje"
              style={{ color: "var(--color-text-muted, #6b7280)" }}
            >
              <ChatCircle size={19} weight="light" />
            </button>
          )}
        </div>
      </div>

      {/* Comments */}
      {post.type !== "story" && (
        <CommentsSection postId={post.id} postOwnerId={post.author.id}/>
      )}

      {/* Share modal */}
      {showShare && (
        <ShareModal
          postId={post.id}
          caption={post.caption}
          onClose={() => setShowShare(false)}
        />
      )}
    </article>
  );
}
