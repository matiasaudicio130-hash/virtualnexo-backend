import { useState, useEffect } from "react";
import { X, Eye, Heart, MessageCircle, Bookmark, Share2, RefreshCcw, BarChart2, TrendingUp } from "lucide-react";
import { feedApi } from "@/lib/api";

interface Stats {
  views:           number;
  reactions:       Record<string, number>;
  total_reactions: number;
  comments:        number;
  saves:           number;
  shares:          number;
  reposts:         number;
  total_engagement: number;
  days_live:       number;
  created_at:      string;
  caption_preview: string;
}

const REACTION_EMOJI: Record<string, string> = {
  heart: "❤️",
  fire:  "🔥",
  star:  "⭐",
};

interface Props {
  postId:    string;
  onClose:   () => void;
}

export function PostStatsModal({ postId, onClose }: Props) {
  const [stats,   setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    feedApi.postStats(postId)
      .then(r => { setStats(r.data); setLoading(false); })
      .catch(() => { setError("No se pudieron cargar las estadísticas."); setLoading(false); });
  }, [postId]);

  const GOLD = "var(--gold,#C9A227)";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl overflow-hidden animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <BarChart2 size={17} style={{ color: GOLD }} />
            <span className="font-semibold text-sm">Estadísticas del post</span>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="p-6 space-y-3">
            {[1,2,3].map(i => (
              <div key={i} className="h-12 bg-bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="p-6 text-center text-status-error text-sm">{error}</div>
        )}

        {/* Stats */}
        {stats && !loading && (
          <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
            {/* Caption preview */}
            {stats.caption_preview && (
              <p className="text-xs text-text-muted bg-bg-muted/50 rounded-xl px-3 py-2 line-clamp-2 italic">
                "{stats.caption_preview}"
              </p>
            )}

            {/* Main KPIs — grid 2×3 */}
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { label: "Vistas",      value: stats.views,           Icon: Eye,         color: GOLD              },
                { label: "Reacciones",  value: stats.total_reactions, Icon: Heart,        color: "#F87171"         },
                { label: "Comentarios", value: stats.comments,        Icon: MessageCircle,color: "#60A5FA"         },
                { label: "Guardados",   value: stats.saves,           Icon: Bookmark,     color: "#34D399"         },
                { label: "Compartidos", value: stats.shares,          Icon: Share2,       color: "#A78BFA"         },
                { label: "Reposts",     value: stats.reposts,         Icon: RefreshCcw,   color: "#FB923C"         },
              ].map(({ label, value, Icon, color }) => (
                <div
                  key={label}
                  className="rounded-2xl p-3 flex flex-col gap-1.5"
                  style={{ background: color + "12", border: `1px solid ${color}30` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-text-muted uppercase tracking-widest leading-tight">{label}</span>
                    <Icon size={12} style={{ color }} />
                  </div>
                  <p
                    className="text-xl font-bold tabular-nums"
                    style={{ color, fontFamily: "var(--font-mono,'Courier New',monospace)" }}
                  >
                    {value.toLocaleString("es-AR")}
                  </p>
                </div>
              ))}
            </div>

            {/* Reactions breakdown */}
            {Object.keys(stats.reactions).length > 0 && (
              <div className="rounded-2xl p-4 space-y-3"
                style={{ background: "#0e0c09", border: "1px solid rgba(255,255,255,0.07)" }}>
                <p className="text-[10px] text-text-muted uppercase tracking-widest">Desglose de reacciones</p>
                {Object.entries(stats.reactions).map(([type, count]) => {
                  const pct = stats.total_reactions > 0 ? Math.round((count / stats.total_reactions) * 100) : 0;
                  return (
                    <div key={type} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5">
                          <span className="text-base">{REACTION_EMOJI[type] || "👍"}</span>
                          <span className="text-text-secondary capitalize">{type}</span>
                        </span>
                        <span className="font-semibold tabular-nums" style={{ color: GOLD }}>
                          {count} <span className="text-text-muted font-normal">({pct}%)</span>
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${pct}%`, background: GOLD }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Engagement total + días */}
            <div className="flex items-center gap-3 rounded-2xl p-4"
              style={{ background: "rgba(201,162,39,0.07)", border: "1px solid rgba(201,162,39,0.18)" }}>
              <TrendingUp size={20} style={{ color: GOLD }} className="flex-shrink-0" />
              <div className="flex-1">
                <p className="text-[10px] text-text-muted uppercase tracking-widest">Engagement total</p>
                <p className="text-2xl font-bold tabular-nums" style={{ color: GOLD }}>
                  {stats.total_engagement.toLocaleString("es-AR")}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-text-muted">Días publicado</p>
                <p className="text-xl font-bold tabular-nums text-text-secondary">
                  {stats.days_live === 0 ? "Hoy" : `${stats.days_live}d`}
                </p>
              </div>
            </div>

            <p className="text-[9px] text-text-muted text-center pb-1">
              Estadísticas actualizadas en tiempo real
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
