import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import type { Icon } from "@phosphor-icons/react";
import { CaretLeft, TrendUp, Users, Heart, Chat, BookmarkSimple, Eye, ChartBar, Lightning } from "@phosphor-icons/react";

import { analyticsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { BottomNav }    from "@/components/BottomNav";
import { BadgeGrid }    from "@/components/BadgeDisplay";

const GOLD = "var(--gold,#C9A227)";

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeekPoint { label: string; count: number; }
interface TopPost   { id: string; type: string; caption: string; thumb?: string; reactions: number; comments: number; saves: number; score: number; }
interface Overview  {
  profile:        { views_7d: number; views_30d: number; views_total: number };
  followers:      { total: number; gained_7d: number; weekly: WeekPoint[] };
  posts:          { total: number };
  reactions:      { total: number; last_7d: number };
  comments:       { total: number; last_7d: number };
  saves:          { total: number };
  engagement_rate: number;
  top_posts:      TopPost[];
  streak:         number;
}

// ── Mini bar chart (SVG, sin dependencias) ────────────────────────────────────
function WeeklyChart({ data }: { data: WeekPoint[] }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.count), 1);
  const H = 70;

  return (
    <svg
      viewBox={`0 0 ${data.length * 16} ${H + 14}`}
      className="w-full"
      style={{ overflow: "visible" }}
    >
      {data.map((d, i) => {
        const barH  = Math.max((d.count / max) * H, d.count > 0 ? 3 : 1);
        const x     = i * 16 + 1;
        const isMax = d.count === max && max > 0;
        return (
          <g key={i}>
            {/* Bar */}
            <rect
              x={x} y={H - barH} width={14} height={barH}
              rx={2}
              fill={isMax ? "var(--gold,#C9A227)" : "rgba(201,162,39,0.35)"}
            />
            {/* Value on top */}
            {d.count > 0 && (
              <text
                x={x + 7} y={H - barH - 3}
                textAnchor="middle"
                fontSize={4.5}
                fill={isMax ? "var(--gold,#C9A227)" : "rgba(255,255,255,0.45)"}
                fontWeight={isMax ? "700" : "400"}
              >
                {d.count}
              </text>
            )}
            {/* Label */}
            <text
              x={x + 7} y={H + 9}
              textAnchor="middle"
              fontSize={4}
              fill="rgba(255,255,255,0.35)"
            >
              {d.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
const CARD_COLORS = {
  gold:   { bg: "rgba(201,162,39,0.12)",  border: "rgba(201,162,39,0.25)",  text: "#C9A227"  },
  purple: { bg: "rgba(139,92,246,0.12)",  border: "rgba(139,92,246,0.25)",  text: "#A78BFA"  },
  pink:   { bg: "rgba(236,72,153,0.12)",  border: "rgba(236,72,153,0.25)",  text: "#F472B6"  },
  teal:   { bg: "rgba(52,211,153,0.12)",  border: "rgba(52,211,153,0.25)",  text: "#34D399"  },
} as const;

function StatCard({
  Icon, label, value, sub, color = "gold",
}: {
  Icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: keyof typeof CARD_COLORS;
}) {
  const c = CARD_COLORS[color];
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-text-muted uppercase tracking-widest font-medium">{label}</span>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}
        >
          <Icon size={14} />
        </div>
      </div>
      <div>
        <p
          className="text-2xl font-bold tabular-nums"
          style={{ color: c.text, fontFamily: "var(--font-mono,'Courier New',monospace)" }}
        >
          {typeof value === "number" ? value.toLocaleString("es-AR") : value}
        </p>
        {sub && <p className="text-[10px] text-text-muted mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-xl ${className}`}
      style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite" }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const navigate  = useNavigate();
  const { user }  = useAuthStore();
  const [data,    setData]    = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    analyticsApi.overview()
      .then(r  => { setData(r.data); setLoading(false); })
      .catch(() => { setError("No se pudieron cargar las estadísticas."); setLoading(false); });
  }, []);

  return (
    <div className="min-h-screen bg-bg-base text-text-primary pb-[80px]">

      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl hover:bg-bg-muted transition-colors text-text-muted hover:text-text-primary"
        >
          <CaretLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-sm">Mis estadísticas</h1>
          <p className="text-[10px] text-text-muted">Rendimiento de tu perfil y publicaciones</p>
        </div>
        <ChartBar size={18} className="text-text-muted" style={{ color: "var(--gold,#C9A227)" } as React.CSSProperties} />
      </header>

      {/* Error */}
      {error && (
        <div className="m-4 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm text-center">
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading && (
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-36" />
          <Skeleton className="h-48" />
        </div>
      )}

      {data && !loading && (
        <div className="max-w-lg mx-auto px-4 space-y-5 pt-4">

          {/* ── Resumen principal (4 cards) ─────────────────────────── */}
          <section>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">Resumen</p>
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                Icon={Eye}
                label="Vistas del perfil"
                value={data.profile.views_total}
                sub={`+${data.profile.views_7d} esta semana`}
                color="gold"
              />
              <StatCard
                Icon={Users}
                label="Seguidores"
                value={data.followers.total}
                sub={data.followers.gained_7d > 0 ? `+${data.followers.gained_7d} esta semana` : "Sin cambios"}
                color="purple"
              />
              <StatCard
                Icon={Heart}
                label="Likes recibidos"
                value={data.reactions.total}
                sub={`+${data.reactions.last_7d} últimos 7 días`}
                color="pink"
              />
              <StatCard
                Icon={BookmarkSimple}
                label="Guardados"
                value={data.saves.total}
                sub={`En ${data.posts.total} publicaciones`}
                color="teal"
              />
            </div>
          </section>

          {/* ── Engagement rate ─────────────────────────────────────── */}
          <section
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: "rgba(201,162,39,0.07)", border: "1px solid rgba(201,162,39,0.18)" }}
          >
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: "rgba(201,162,39,0.15)" }}
            >
              <Lightning size={22} style={{ color: "var(--gold,#C9A227)" } as React.CSSProperties} />
            </div>
            <div className="flex-1">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Tasa de engagement</p>
              <p
                className="text-3xl font-bold tabular-nums mt-0.5"
                style={{ color: "var(--gold,#C9A227)", fontFamily: "var(--font-mono,'Courier New',monospace)" }}
              >
                {(isNaN(data.engagement_rate) || !isFinite(data.engagement_rate)) ? "0" : data.engagement_rate}%
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">
                (likes + comentarios) ÷ seguidores ÷ publicaciones
              </p>
            </div>
          </section>

          {/* ── Gráfico: seguidores por semana ──────────────────────── */}
          {data.followers.weekly.length > 0 && (
            <section
              className="rounded-2xl p-4"
              style={{ background: "#0e0c09", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-text-muted uppercase tracking-widest">Seguidores nuevos por semana</p>
                <TrendUp size={14} style={{ color: "var(--gold,#C9A227)" } as React.CSSProperties} />
              </div>
              <WeeklyChart data={data.followers.weekly} />
              <p className="text-[9px] text-text-muted text-center mt-2">Últimas 7 semanas</p>
            </section>
          )}

          {/* ── Comentarios ─────────────────────────────────────────── */}
          <section
            className="rounded-2xl p-4 flex items-center gap-4"
            style={{ background: "#0e0c09", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <Chat size={20} className="text-text-muted flex-shrink-0" />
            <div className="flex-1">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">Comentarios recibidos</p>
              <p className="text-xl font-bold tabular-nums">{data.comments.total.toLocaleString("es-AR")}</p>
            </div>
            {data.comments.last_7d > 0 && (
              <span
                className="text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0"
                style={{ background: "rgba(201,162,39,0.15)", color: "var(--gold,#C9A227)" }}
              >
                +{data.comments.last_7d} esta semana
              </span>
            )}
          </section>

          {/* ── Top publicaciones ────────────────────────────────────── */}
          {data.top_posts.length > 0 && (
            <section>
              <p className="text-[10px] text-text-muted uppercase tracking-widest mb-3">
                Top publicaciones · por engagement
              </p>
              <div className="space-y-2">
                {data.top_posts.map((post, i) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 rounded-2xl p-3 cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ background: "#0e0c09", border: "1px solid rgba(255,255,255,0.07)" }}
                    onClick={() => navigate(`/feed`)}
                  >
                    {/* Rank */}
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold tabular-nums"
                      style={{
                        background: i === 0 ? "rgba(201,162,39,0.2)" : "rgba(255,255,255,0.05)",
                        color:      i === 0 ? "var(--gold,#C9A227)" : "rgba(255,255,255,0.4)",
                      }}
                    >
                      {i + 1}
                    </div>

                    {/* Thumbnail */}
                    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-bg-muted">
                      {post.thumb ? (
                        <img src={post.thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-[10px] text-text-muted text-center p-1 leading-tight line-clamp-3">
                            {post.caption || "Post"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Caption */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text-primary truncate">
                        {post.caption || (post.type === "poll" ? "Encuesta" : "Sin descripción")}
                      </p>
                      <p className="text-[10px] text-text-muted capitalize mt-0.5">{post.type}</p>
                    </div>

                    {/* Stats */}
                    <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Heart size={9} /> {post.reactions}
                      </span>
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <Chat size={9} /> {post.comments}
                      </span>
                      <span className="text-[10px] text-text-muted flex items-center gap-1">
                        <BookmarkSimple size={9} /> {post.saves}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── Sin publicaciones ────────────────────────────────────── */}
          {data.posts.total === 0 && (
            <div className="py-12 text-center">
              <ChartBar size={36} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm text-text-muted">Publicá contenido para ver tus estadísticas</p>
            </div>
          )}

          {/* ── Logros / Badges ────────────────────────────────────── */}
          {user && (
            <section
              className="rounded-2xl p-4"
              style={{ background: "#0e0c09", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <BadgeGrid userId={user.id} />
            </section>
          )}

          <p className="text-[9px] text-text-muted text-center pb-2">
            Estadísticas calculadas en tiempo real
          </p>
        </div>
      )}

      <BottomNav />
    </div>
  );
}