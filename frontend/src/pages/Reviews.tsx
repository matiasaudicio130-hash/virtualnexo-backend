import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Star, ArrowLeft, Shield, Trophy, Trash } from "@phosphor-icons/react";
import { reviewsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import type { Review, ReviewStats } from "@/types";

const MEDAL_CONFIG = {
  none:        { label: "Sin medalla", color: "#6B7280", bg: "rgba(107,114,128,0.1)" },
  bronze:      { label: "Bronce",      color: "#D97706", bg: "rgba(217,119,6,0.1)"   },
  silver:      { label: "Plata",       color: "#94A3B8", bg: "rgba(148,163,184,0.1)" },
  silver_plus: { label: "Plata+",      color: "#CBD5E1", bg: "rgba(203,213,225,0.1)" },
  gold:        { label: "Oro",         color: "#C9A227", bg: "rgba(201,162,39,0.1)"  },
};

const MEDAL_TIERS = [
  { key: "bronze",      min: "5+",  label: "Bronce"  },
  { key: "silver",      min: "10+", label: "Plata"   },
  { key: "silver_plus", min: "15+", label: "Plata+"  },
  { key: "gold",        min: "20+", label: "Oro"     },
] as const;

function StarRating({ value, onChange, size = 16 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(i => (
        <button
          key={i}
          type="button"
          onClick={() => onChange?.(i)}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          disabled={!onChange}
          className="focus:outline-none disabled:cursor-default"
        >
          <Star
            size={size}
            className={`transition-colors ${i <= (hover || value) ? "text-yellow-400 fill-yellow-400" : "text-border"}`}
          />
        </button>
      ))}
    </div>
  );
}

function ReviewerAvatar({ review }: { review: Review }) {
  const initials = review.is_anonymous
    ? "?"
    : (review.reviewer?.first_name?.[0] ?? "?").toUpperCase();
  if (!review.is_anonymous && review.reviewer?.profile_photo_url) {
    return (
      <img
        src={review.reviewer.profile_photo_url}
        alt=""
        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
      />
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-bg-muted flex items-center justify-center text-xs font-bold text-text-muted flex-shrink-0">
      {initials}
    </div>
  );
}

export default function Reviews() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats]       = useState<ReviewStats | null>(null);
  const [reviews, setReviews]   = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 5, text: "", is_anonymous: true });
  const [loading, setLoading]   = useState(false);
  const [feedback, setFeedback] = useState("");

  const isOwnProfile = user?.id === userId;

  const load = async () => {
    if (!userId) return;
    const [revR, myR] = await Promise.all([
      reviewsApi.forUser(userId),
      isOwnProfile ? Promise.resolve({ data: null }) : reviewsApi.myReview(userId),
    ]);
    setStats(revR.data.stats);
    setReviews(revR.data.reviews);
    setMyReview(myR.data);
  };

  useEffect(() => { load(); }, [userId]);

  async function handleSubmit() {
    if (!userId) return;
    setLoading(true);
    try {
      await reviewsApi.create({ reviewed_id: userId, ...form });
      setFeedback("¡Reseña publicada!");
      setShowForm(false);
      load();
    } catch (e: any) {
      setFeedback(e.response?.data?.detail ?? "Error");
    }
    setLoading(false);
    setTimeout(() => setFeedback(""), 3000);
  }

  async function handleDelete() {
    if (!myReview) return;
    await reviewsApi.delete(myReview.id);
    setMyReview(null);
    load();
  }

  const medalCfg = stats ? MEDAL_CONFIG[stats.medal] : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary animate-fade-in">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-bg-muted rounded-xl">
          <ArrowLeft size={17} className="text-text-muted"/>
        </button>
        <h1
          className="text-sm tracking-[0.2em] uppercase"
          style={{ color: "var(--gold,#C9A227)", fontFamily: "var(--font-display,'Cormorant Garamond',serif)" }}
        >
          Reseñas
        </h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── Hero stats ── */}
        {stats && (
          <div className="bg-bg-card border border-border rounded-2xl p-5">
            <div className="flex items-center gap-4">
              {/* Score */}
              <div className="flex-1">
                <div className="flex items-end gap-2">
                  <p className="text-4xl font-bold leading-none">{stats.avg_rating ? stats.avg_rating.toFixed(1) : "—"}</p>
                  <div className="pb-0.5">
                    <StarRating value={Math.round(stats.avg_rating ?? 0)} size={14}/>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-2">
                  {stats.total_reviews} reseña{stats.total_reviews !== 1 ? "s" : ""}
                  {stats.positive_count > 0 && (
                    <> · <span className="text-status-success">{stats.positive_count} positiva{stats.positive_count !== 1 ? "s" : ""}</span></>
                  )}
                </p>
              </div>

              {/* Medal badge */}
              {medalCfg && stats.medal !== "none" && (
                <div
                  className="flex flex-col items-center gap-1.5 px-4 py-3 rounded-2xl"
                  style={{ background: medalCfg.bg }}
                >
                  <Trophy size={26} style={{ color: medalCfg.color }}/>
                  <span className="text-xs font-semibold" style={{ color: medalCfg.color }}>
                    {medalCfg.label}
                  </span>
                </div>
              )}
            </div>

            {/* Bar breakdown (1–5) */}
            {stats.total_reviews > 0 && (
              <div className="mt-4 space-y-1.5">
                {[5,4,3,2,1].map(s => {
                  const cnt = (reviews.filter(r => r.rating === s).length);
                  const pct = stats.total_reviews ? Math.round(cnt / stats.total_reviews * 100) : 0;
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-[10px] text-text-muted w-4 text-right">{s}</span>
                      <Star size={8} className="text-yellow-400 fill-yellow-400 flex-shrink-0"/>
                      <div className="flex-1 h-1.5 bg-bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${pct}%`, background: "var(--gold,#C9A227)" }}
                        />
                      </div>
                      <span className="text-[10px] text-text-muted w-6">{cnt > 0 ? cnt : ""}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Medallas info ── */}
        <div className="bg-bg-card border border-border rounded-2xl p-4">
          <p className="text-[10px] font-semibold text-text-muted uppercase tracking-widest mb-3">
            Sistema de medallas
          </p>
          <div className="grid grid-cols-4 gap-2 text-center">
            {MEDAL_TIERS.map(({ key, min, label }) => {
              const cfg = MEDAL_CONFIG[key];
              const isActive = stats?.medal === key;
              return (
                <div
                  key={key}
                  className="rounded-xl p-2.5 transition-all"
                  style={{
                    background: isActive ? cfg.bg : "rgba(255,255,255,0.03)",
                    border: isActive ? `1px solid ${cfg.color}40` : "1px solid transparent",
                  }}
                >
                  <Trophy size={18} className="mx-auto mb-1" style={{ color: cfg.color }}/>
                  <p className="text-xs font-bold" style={{ color: cfg.color }}>{min}</p>
                  <p className="text-[10px] text-text-muted mt-0.5">{label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Dejar/editar reseña ── */}
        {!isOwnProfile && (
          <div>
            {feedback && (
              <div className="p-3 bg-status-success/10 border border-status-success/30 rounded-xl text-status-success text-sm mb-3">
                {feedback}
              </div>
            )}

            {myReview ? (
              <div className="bg-bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-widest mb-2">Tu reseña</p>
                <StarRating value={myReview.rating} size={18}/>
                {myReview.text && (
                  <p className="text-sm text-text-secondary mt-2 leading-relaxed">{myReview.text}</p>
                )}
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => { setForm({ rating: myReview.rating, text: myReview.text || "", is_anonymous: myReview.is_anonymous }); setShowForm(true); }}
                    className="text-xs px-3 py-1.5 rounded-lg transition-colors"
                    style={{ color: "var(--accent-purple,#8B5CF6)", background: "rgba(139,92,246,0.1)" }}
                  >
                    Editar
                  </button>
                  <button
                    onClick={handleDelete}
                    className="text-xs px-3 py-1.5 rounded-lg text-status-error hover:bg-status-error/10 transition-colors flex items-center gap-1"
                  >
                    <Trash size={11}/> Eliminar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowForm(v => !v)}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-all hover:opacity-90"
                style={{
                  background: showForm ? "rgba(139,92,246,0.15)" : "var(--accent-purple,#8B5CF6)",
                  color: showForm ? "var(--accent-purple,#8B5CF6)" : "white",
                  border: showForm ? "1px solid rgba(139,92,246,0.3)" : "none",
                }}
              >
                {showForm ? "Cancelar" : "Dejar una reseña"}
              </button>
            )}

            {showForm && (
              <div className="bg-bg-card border border-border rounded-2xl p-4 mt-3 space-y-4">
                <div>
                  <p className="text-xs text-text-muted mb-2">Calificación</p>
                  <StarRating value={form.rating} onChange={v => setForm(f => ({...f, rating: v}))} size={24}/>
                </div>
                <div className="relative">
                  <textarea
                    value={form.text}
                    onChange={e => setForm(f => ({...f, text: e.target.value}))}
                    placeholder="Contá tu experiencia (opcional)"
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-2.5 rounded-xl bg-bg-muted border border-border text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-purple/60 transition-colors"
                  />
                  {form.text.length > 400 && (
                    <span className={`absolute bottom-2 right-3 text-[10px] tabular-nums ${form.text.length >= 490 ? "text-status-error" : "text-text-muted"}`}>
                      {500 - form.text.length}
                    </span>
                  )}
                </div>
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.is_anonymous}
                    onChange={e => setForm(f => ({...f, is_anonymous: e.target.checked}))}
                    className="rounded"
                  />
                  <Shield size={13} className="text-text-muted"/> Publicar de forma anónima
                </label>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: "var(--accent-purple,#8B5CF6)" }}
                >
                  {loading ? "Publicando…" : "Publicar reseña"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Lista de reseñas ── */}
        <div className="space-y-3">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-widest">
            {reviews.length > 0 ? `${reviews.length} reseña${reviews.length !== 1 ? "s" : ""}` : "Sin reseñas"}
          </p>
          {reviews.map(r => (
            <div key={r.id} className="bg-bg-card border border-border rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ReviewerAvatar review={r}/>
                  <div>
                    <p className="text-sm font-medium leading-tight">
                      {r.is_anonymous ? "Anónimo/a" : `${r.reviewer?.first_name} ${r.reviewer?.last_name}`}
                    </p>
                    <p className="text-[10px] text-text-muted mt-0.5">
                      {new Date(r.created_at).toLocaleDateString("es-AR")}
                    </p>
                  </div>
                </div>
                <StarRating value={r.rating} size={13}/>
              </div>
              {r.text && (
                <p className="text-sm text-text-secondary mt-3 leading-relaxed">{r.text}</p>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
