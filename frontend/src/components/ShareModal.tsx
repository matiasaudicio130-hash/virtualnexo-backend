import { useState, useEffect } from "react";
import { X, Search, Send, Check } from "lucide-react";
import { messagingApi, feedApi } from "@/lib/api";

interface Props {
  postId:   string;
  caption?: string;
  onClose:  () => void;
}

export function ShareModal({ postId, caption, onClose }: Props) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [query, setQuery]                 = useState("");
  const [sent, setSent]                   = useState<Set<string>>(new Set());
  const [sending, setSending]             = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);

  useEffect(() => {
    messagingApi.conversations()
      .then(r => setConversations(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = conversations.filter(c => {
    const name = `${c.other_user?.first_name || ""} ${c.other_user?.last_name || ""}`.toLowerCase();
    return name.includes(query.toLowerCase());
  });

  async function handleShare(conv: any) {
    if (sent.has(conv.id) || sending) return;
    setSending(conv.id);
    try {
      // Obtener datos del post para preview
      const { data: postData } = await feedApi.sharePost(postId);
      // Enviar como mensaje con referencia al post
      await messagingApi.sendMessage(conv.id, {
        recipient_id: conv.other_user?.id,
        content:      `📸 ${caption || "Compartió una publicación"} · aurasw.club`,
      });
      setSent(prev => new Set([...prev, conv.id]));
    } catch { /* ignore */ }
    setSending(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}>
      <div
        className="w-full max-w-sm bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl p-5 animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Compartir por mensaje</h3>
          <button onClick={onClose}><X size={18} className="text-text-muted"/></button>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"/>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Buscar conversación..."
            className="w-full bg-bg-muted border border-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple/60 transition-colors"
          />
        </div>

        {/* Conversation list */}
        <div className="max-h-64 overflow-y-auto space-y-1">
          {loading && (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-bg-muted rounded-xl animate-pulse"/>)}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <p className="text-xs text-text-muted text-center py-6">Sin conversaciones</p>
          )}
          {filtered.map(conv => {
            const other    = conv.other_user;
            const isSent   = sent.has(conv.id);
            const isSending = sending === conv.id;
            return (
              <button
                key={conv.id}
                onClick={() => handleShare(conv)}
                disabled={isSent || !!sending}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-bg-muted transition-colors text-left disabled:opacity-60"
              >
                <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-muted flex-shrink-0 border border-border/40">
                  {other?.profile_photo_url
                    ? <img src={other.profile_photo_url} alt="" className="w-full h-full object-cover"/>
                    : <div className="w-full h-full bg-accent-purple/20"/>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {other ? `${other.first_name} ${other.last_name}` : "Usuario"}
                  </p>
                </div>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                  isSent
                    ? "bg-status-success/20 text-status-success"
                    : "bg-accent-purple text-white hover:bg-accent-purple/80"
                }`}>
                  {isSending ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                  ) : isSent ? (
                    <Check size={14}/>
                  ) : (
                    <Send size={13}/>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
