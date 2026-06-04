import { useState, useEffect } from "react";
import { badgesApi } from "@/lib/api";

export interface Badge {
  id:          string;
  label:       string;
  description: string;
  emoji:       string;
  color:       string;
  tier:        "bronze" | "silver" | "gold";
  earned:      boolean;
  progress:    number;   // 0-1
  value:       number;
  threshold:   number;
}

interface BadgeResponse {
  user_id:      string;
  badges:       Badge[];
  earned_count: number;
  total:        number;
}

// ── Tooltip mini ─────────────────────────────────────────────────────────────
function BadgeTooltip({ badge, visible }: { badge: Badge; visible: boolean }) {
  if (!visible) return null;
  return (
    <div
      className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 pointer-events-none"
      style={{ minWidth: 160 }}
    >
      <div
        className="rounded-xl border px-3 py-2.5 shadow-xl text-center"
        style={{ background: "rgba(14,12,9,0.96)", borderColor: badge.earned ? badge.color + "44" : "rgba(255,255,255,0.1)" }}
      >
        <p className="text-xs font-semibold text-white">{badge.label}</p>
        <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{badge.description}</p>
        {!badge.earned && (
          <div className="mt-2">
            <div className="h-1 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${badge.progress * 100}%`, background: badge.color }}
              />
            </div>
            <p className="text-[9px] text-text-muted mt-1 tabular-nums">
              {badge.value} / {badge.threshold}
            </p>
          </div>
        )}
      </div>
      {/* Arrow */}
      <div className="w-2.5 h-2.5 rotate-45 mx-auto -mt-1.5 rounded-sm"
        style={{ background: "rgba(14,12,9,0.96)" }} />
    </div>
  );
}

// ── Single badge pill ─────────────────────────────────────────────────────────
function BadgePill({ badge, size = "md" }: { badge: Badge; size?: "sm" | "md" | "lg" }) {
  const [hovered, setHovered] = useState(false);
  const px = size === "sm" ? "px-1.5 py-0.5" : size === "lg" ? "px-3 py-1.5" : "px-2 py-1";
  const emojiSize = size === "sm" ? "text-sm" : size === "lg" ? "text-2xl" : "text-base";
  const labelSize = size === "sm" ? "text-[9px]" : size === "lg" ? "text-xs" : "text-[10px]";

  return (
    <div
      className={`relative flex items-center gap-1 rounded-full border ${px} transition-all cursor-default select-none`}
      style={{
        background:  badge.earned ? `${badge.color}18` : "rgba(255,255,255,0.04)",
        borderColor: badge.earned ? `${badge.color}44`  : "rgba(255,255,255,0.08)",
        opacity:     badge.earned ? 1 : 0.45,
        filter:      badge.earned ? "none" : "grayscale(0.6)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onTouchStart={() => setHovered(true)}
      onTouchEnd={() => setTimeout(() => setHovered(false), 1800)}
    >
      <span className={emojiSize}>{badge.emoji}</span>
      {size !== "sm" && (
        <span className={`${labelSize} font-medium`} style={{ color: badge.earned ? badge.color : "rgba(255,255,255,0.35)" }}>
          {badge.label}
        </span>
      )}
      <BadgeTooltip badge={badge} visible={hovered} />
    </div>
  );
}

// ── Compact row (for profiles) ────────────────────────────────────────────────
interface CompactProps {
  userId:    string;
  maxShow?:  number;
  size?:     "sm" | "md";
}

export function BadgeRow({ userId, maxShow = 5, size = "sm" }: CompactProps) {
  const [data, setData] = useState<BadgeResponse | null>(null);

  useEffect(() => {
    badgesApi.forUser(userId)
      .then(r => setData(r.data))
      .catch(() => {});
  }, [userId]);

  if (!data) return null;
  const earned = data.badges.filter(b => b.earned);
  if (earned.length === 0) return null;

  const visible = earned.slice(0, maxShow);
  const extra   = earned.length - maxShow;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(b => <BadgePill key={b.id} badge={b} size={size} />)}
      {extra > 0 && (
        <span className="text-[10px] text-text-muted px-1.5 py-0.5 rounded-full border border-white/10 bg-white/4">
          +{extra}
        </span>
      )}
    </div>
  );
}

// ── Full grid (for Analytics / Logros page) ───────────────────────────────────
interface GridProps {
  userId: string;
}

export function BadgeGrid({ userId }: GridProps) {
  const [data,    setData]    = useState<BadgeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    badgesApi.forUser(userId)
      .then(r => { setData(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [userId]);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-16 rounded-xl"
            style={{ background: "#1a1815", animation: "aura-pulse 2s ease-in-out infinite" }} />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-text-muted uppercase tracking-widest">Logros</p>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={{ background: "rgba(201,162,39,0.12)", color: "var(--gold,#C9A227)" }}
        >
          {data.earned_count} / {data.total}
        </span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-2">
        {data.badges.map(badge => (
          <BadgePill key={badge.id} badge={badge} size="lg" />
        ))}
      </div>

      {/* Progress bar total */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] text-text-muted">Progreso total</p>
          <p className="text-[10px] text-text-muted tabular-nums">
            {Math.round((data.earned_count / data.total) * 100)}%
          </p>
        </div>
        <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${(data.earned_count / data.total) * 100}%`,
              background: "var(--gold,#C9A227)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
