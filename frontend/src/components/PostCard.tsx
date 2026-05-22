import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapPin, Flame, Heart, Star, Trash2, MoreHorizontal,
  MessageSquare, Bookmark, BookmarkCheck, Share2,
} from "lucide-react";
import { feedApi } from "@/lib/api";
import { ProtectedAvatar } from "@/components/ProtectedImage";
import { CommentsSection } from "@/components/Comments";
import { Carousel } from "@/components/Carousel";
import { DoubleTapLike } from "@/components/DoubleTapLike";
import { ShareModal } from "@/components/ShareModal";
import { PollCard } from "@/components/PollCard";
import { PROFILE_TYPE_CONFIG } from "@/types";
import type { Post, ProfileType } from "@/types";

const REACTIONS = [
  { type: "fire",  icon: Flame,  label: "Fuego" },
  { type: "heart", icon: Heart,  label: "Me gusta" },
  { type: "star",  icon: Star,   label: "Destacado" },
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

  const isPoll = post.type === "poll" || !!(post as any).extra_data?.poll;

  const isOwner = post.user_id === currentUserId;
  const totalReactions = Object.values(reactions || {}).reduce((a: number, b) => a + (b as number), 0);

  // Carrusel: usar media_urls si hay más de una imagen
  const mediaItems: { url: string; type?: string }[] = post.media_urls?.length
    ? post.media_urls.map((m: any) => ({ url: m.url, type: m.type || "image" }))
    : post.media_url
      ? [{ url: post.media_url, type: post.type === "story" ? "image" : "image" }]
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
          <button onClick={() => navigate(`/profile/${post.author.id}`)} className="flex-shrink-0">
            <ProtectedAvatar src={post.author.avatar || ""} size={36} />
          </button>
          <div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigate(`/profile/${post.author.id}`)}
                className="text-sm font-semibold leading-tight hover:text-accent-purple transition-colors"
              >
                {post.author.name || "Usuario"}
              </button>
              {post.author.profile_type && (() => {
                const cfg = PROFILE_TYPE_CONFIG[post.author.profile_type as ProfileType];
                return cfg ? <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${cfg.dot}`}/> : null;
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
            <div className="absolute right-0 top-8 bg-bg-card border border-border rounded-xl shadow-xl z-20 py-1.5 min-w-[140px]"
              onClick={() => setShowMenu(false)}>
              {isOwner && (
                <button onClick={handleDelete}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-status-error hover:bg-bg-muted">
                  <Trash2 size={13}/> Eliminar
                </button>
              )}
              <button onClick={() => navigate(`/profile/${post.author.id}`)}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-text-secondary hover:bg-bg-muted">
                Ver perfil
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Media — carrusel con doble tap */}
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

      {/* Caption (en polls ya está en la pregunta, no mostrar doble) */}
      {post.caption && !isPoll && (
        <p className="px-4 py-2.5 text-sm text-text-secondary leading-relaxed">
          <span className="font-semibold text-text-primary mr-1.5">{post.author.name?.split(" ")[0]}</span>
          {post.caption}
        </p>
      )}

      {/* Actions bar */}
      <div className="flex items-center gap-1 px-3 pb-3 pt-1">
        {/* Reactions */}
        {REACTIONS.map(({ type, icon: Icon }) => {
          const count  = reactions?.[type] || 0;
          const active = myReaction === type;
          return (
            <button
              key={type}
              onClick={() => handleReact(type)}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-all ${
                active
                  ? "bg-accent-purple/15 text-accent-purple border border-accent-purple/35"
                  : "bg-bg-muted/60 text-text-muted hover:bg-bg-muted border border-transparent"
              }`}
            >
              <Icon size={14} className={active ? "fill-current" : ""}/>
              {count > 0 && <span className="text-xs font-medium">{count}</span>}
            </button>
          );
        })}

        {/* Spacer */}
        <div className="flex-1"/>

        {/* Save */}
        <button
          onClick={handleSave}
          className={`p-2 rounded-xl transition-colors ${
            saved ? "text-accent-purple" : "text-text-muted hover:text-text-primary"
          }`}
          title={saved ? "Guardado" : "Guardar"}
        >
          {saved ? <BookmarkCheck size={17}/> : <Bookmark size={17}/>}
        </button>

        {/* Share */}
        {post.allow_share !== false && (
          <button
            onClick={() => setShowShare(true)}
            className="p-2 rounded-xl text-text-muted hover:text-text-primary transition-colors"
            title="Compartir"
          >
            <Share2 size={17}/>
          </button>
        )}

        {/* Message */}
        {!isOwner && (
          <button
            onClick={() => navigate(`/messages?with=${post.author.id}`)}
            className="p-2 rounded-xl text-text-muted hover:text-accent-purple transition-colors"
            title="Enviar mensaje"
          >
            <MessageSquare size={17}/>
          </button>
        )}
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
