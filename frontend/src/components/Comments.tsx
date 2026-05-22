import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Trash2, Flag, Reply, ChevronDown, ChevronUp } from "lucide-react";
import { commentsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ProtectedAvatar } from "@/components/ProtectedImage";

interface Comment {
  id: string;
  content: string;
  is_deleted: boolean;
  parent_id: string | null;
  created_at: string;
  can_delete: boolean;
  author: {
    id: string;
    name: string;
    avatar?: string;
    profile_type?: string;
  };
  replies?: Comment[];
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60)  return "ahora";
  if (s < 3600) return `${Math.floor(s/60)}m`;
  if (s < 86400) return `${Math.floor(s/3600)}h`;
  return `${Math.floor(s/86400)}d`;
}

/* ── CommentItem ─────────────────────────────────────────── */
function CommentItem({
  comment,
  postOwnerId,
  onDelete,
  onReply,
}: {
  comment: Comment;
  postOwnerId: string;
  onDelete: (id: string) => void;
  onReply: (comment: Comment) => void;
}) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [showReport, setShowReport] = useState(false);
  const [showReplies, setShowReplies] = useState(true);
  const canDelete = user?.id === comment.author.id || user?.id === postOwnerId;

  async function handleReport() {
    await commentsApi.report(comment.id, "contenido_inapropiado");
    setShowReport(false);
  }

  if (comment.is_deleted) {
    return (
      <div className="py-2 pl-3 border-l border-border/30">
        <p className="text-xs text-text-muted italic">[comentario eliminado]</p>
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2 space-y-2 ml-3">
            {comment.replies.map(r => (
              <CommentItem key={r.id} comment={r} postOwnerId={postOwnerId}
                onDelete={onDelete} onReply={onReply} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="group">
      <div className="flex gap-2.5 py-2">
        {/* Avatar clicable */}
        <button onClick={() => navigate(`/profile/${comment.author.id}`)} className="flex-shrink-0 mt-0.5">
          <ProtectedAvatar src={comment.author.avatar || ""} size={28} />
        </button>

        <div className="flex-1 min-w-0">
          <div className="bg-bg-muted/50 rounded-xl px-3 py-2">
            <button
              onClick={() => navigate(`/profile/${comment.author.id}`)}
              className="text-xs font-semibold text-text-primary hover:text-accent-purple transition-colors mr-1.5"
            >
              {comment.author.name}
            </button>
            <span className="text-sm text-text-secondary leading-snug">{comment.content}</span>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-3 mt-1 px-1">
            <span className="text-[10px] text-text-muted">{timeAgo(comment.created_at)}</span>
            <button
              onClick={() => onReply(comment)}
              className="text-[10px] text-text-muted hover:text-accent-purple transition-colors flex items-center gap-0.5"
            >
              <Reply size={10}/> Responder
            </button>
            {canDelete && (
              <button
                onClick={() => onDelete(comment.id)}
                className="text-[10px] text-text-muted hover:text-status-error transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 size={10}/>
              </button>
            )}
            {!canDelete && (
              <button
                onClick={() => setShowReport(!showReport)}
                className="text-[10px] text-text-muted hover:text-status-warning transition-colors opacity-0 group-hover:opacity-100"
              >
                <Flag size={10}/>
              </button>
            )}
          </div>

          {showReport && (
            <div className="mt-1 px-1 flex items-center gap-2">
              <span className="text-[10px] text-text-muted">¿Reportar este comentario?</span>
              <button onClick={handleReport} className="text-[10px] text-status-error hover:underline">Sí, reportar</button>
              <button onClick={() => setShowReport(false)} className="text-[10px] text-text-muted hover:underline">Cancelar</button>
            </div>
          )}

          {/* Replies */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2 ml-1">
              <button
                onClick={() => setShowReplies(v => !v)}
                className="text-[10px] text-accent-purple flex items-center gap-0.5 mb-2"
              >
                {showReplies ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
                {comment.replies.length} {comment.replies.length === 1 ? "respuesta" : "respuestas"}
              </button>
              {showReplies && (
                <div className="space-y-1 border-l border-accent-purple/20 pl-3">
                  {comment.replies.map(r => (
                    <CommentItem key={r.id} comment={r} postOwnerId={postOwnerId}
                      onDelete={onDelete} onReply={onReply} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sección de comentarios ──────────────────────────────── */
export function CommentsSection({
  postId,
  postOwnerId,
  initialCount = 0,
}: {
  postId: string;
  postOwnerId: string;
  initialCount?: number;
}) {
  const { user } = useAuthStore();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try {
      const { data } = await commentsApi.list(postId);
      // Construir árbol de comentarios (threading)
      const map = new Map<string, Comment & { replies: Comment[] }>();
      const roots: (Comment & { replies: Comment[] })[] = [];
      for (const c of data) map.set(c.id, { ...c, replies: [] });
      for (const c of data) {
        if (c.parent_id && map.has(c.parent_id)) {
          map.get(c.parent_id)!.replies.push(map.get(c.id)!);
        } else if (!c.parent_id) {
          roots.push(map.get(c.id)!);
        }
      }
      setComments(roots);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => {
    if (open && comments.length === 0) load();
  }, [open]);

  async function handleDelete(commentId: string) {
    await commentsApi.delete(commentId);
    load();
  }

  function handleReply(comment: Comment) {
    setReplyTo(comment);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || submitting) return;
    setSubmitting(true);
    try {
      await commentsApi.add(postId, text.trim(), replyTo?.id);
      setText("");
      setReplyTo(null);
      load();
    } catch { /* ignore */ }
    setSubmitting(false);
  }

  const totalCount = comments.reduce((s, c) => s + 1 + (c.replies?.length || 0), 0) || initialCount;

  return (
    <div className="border-t border-border/40">
      {/* Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-muted hover:text-text-secondary transition-colors"
      >
        <span className="flex items-center gap-1.5">
          {open ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}
          {totalCount > 0 ? `${totalCount} comentario${totalCount !== 1 ? "s" : ""}` : "Comentar"}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4">
          {/* Input */}
          {user && (
            <form onSubmit={handleSubmit} className="flex gap-2.5 mb-4">
              <ProtectedAvatar src={user.profile_photo_url || ""} size={28} />
              <div className="flex-1 min-w-0">
                {replyTo && (
                  <div className="text-[10px] text-accent-purple mb-1 flex items-center gap-1">
                    <Reply size={10}/> Respondiendo a {replyTo.author.name}
                    <button type="button" onClick={() => setReplyTo(null)} className="ml-1 text-text-muted hover:text-text-primary">×</button>
                  </div>
                )}
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    placeholder={replyTo ? "Escribe una respuesta..." : "Agrega un comentario..."}
                    maxLength={500}
                    className="flex-1 bg-bg-muted/60 border border-border/60 rounded-xl px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple/50 transition-colors"
                  />
                  <button
                    type="submit"
                    disabled={!text.trim() || submitting}
                    className="px-3 py-2 bg-accent-purple text-white text-xs rounded-xl disabled:opacity-40 hover:opacity-90 transition-all"
                  >
                    {submitting ? "..." : "Publicar"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Lista */}
          {loading ? (
            <div className="space-y-3">
              {[1,2].map(i => <div key={i} className="h-10 bg-bg-muted/40 rounded-xl animate-pulse"/>)}
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-text-muted text-center py-4">Sin comentarios. Sé el primero.</p>
          ) : (
            <div className="space-y-1">
              {comments.map(c => (
                <CommentItem key={c.id} comment={c} postOwnerId={postOwnerId}
                  onDelete={handleDelete} onReply={handleReply} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
