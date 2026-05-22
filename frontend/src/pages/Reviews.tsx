import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Star, ArrowLeft, Shield, Award } from "lucide-react";
import { reviewsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Review, ReviewStats } from "@/types";

const MEDAL_CONFIG = {
  none:        { label: "Sin medalla",   color: "text-text-muted",           bg: "bg-bg-muted" },
  bronze:      { label: "Bronce",        color: "text-amber-600",            bg: "bg-amber-500/10" },
  silver:      { label: "Plata",         color: "text-slate-400",            bg: "bg-slate-400/10" },
  silver_plus: { label: "Plata Plus",    color: "text-slate-300",            bg: "bg-slate-300/10" },
  gold:        { label: "Oro",           color: "text-yellow-400",           bg: "bg-yellow-400/10" },
};

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
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
            size={onChange ? 24 : 16}
            className={`transition-colors ${i <= (hover || value) ? "text-yellow-400 fill-yellow-400" : "text-border"}`}
          />
        </button>
      ))}
    </div>
  );
}

export default function Reviews() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<ReviewStats | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [myReview, setMyReview] = useState<Review | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ rating: 5, text: "", is_anonymous: true });
  const [loading, setLoading] = useState(false);
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

  const medal = stats ? MEDAL_CONFIG[stats.medal] : null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="sticky top-0 z-10 bg-bg-base/80 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-bg-muted rounded-xl">
          <ArrowLeft size={18} className="text-text-muted" />
        </button>
        <h1 className="font-bold">Reseñas</h1>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Stats + Medalla */}
        {stats && (
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-3xl font-bold">{stats.avg_rating ?? "â€”"}</p>
                <StarRating value={Math.round(stats.avg_rating ?? 0)} />
                <p className="text-text-muted text-sm mt-1">{stats.total_reviews} reseña{stats.total_reviews !== 1 ? "s" : ""} · {stats.positive_count} positiva{stats.positive_count !== 1 ? "s" : ""}</p>
              </div>
              {medal && stats.medal !== "none" && (
                <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-2xl ${medal.bg}`}>
                  <Award size={28} className={medal.color} />
                  <span className={`text-xs font-semibold ${medal.color}`}>{medal.label}</span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Jerarquía de medallas */}
        <Card className="p-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Sistema de medallas</p>
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            {[
              { medal: "bronze",      qty: "5+",  label: "Bronce" },
              { medal: "silver",      qty: "10+", label: "Plata" },
              { medal: "silver_plus", qty: "15+", label: "Plata+" },
              { medal: "gold",        qty: "20+", label: "Oro" },
            ].map(({ medal: m, qty, label }) => (
              <div key={m} className={`rounded-xl p-2 ${MEDAL_CONFIG[m as keyof typeof MEDAL_CONFIG].bg}`}>
                <Award size={20} className={`mx-auto mb-1 ${MEDAL_CONFIG[m as keyof typeof MEDAL_CONFIG].color}`} />
                <p className={`font-bold ${MEDAL_CONFIG[m as keyof typeof MEDAL_CONFIG].color}`}>{qty}</p>
                <p className="text-text-muted">{label}</p>
              </div>
            ))}
          </div>
        </Card>

        {/* Acción: dejar reseña */}
        {!isOwnProfile && (
          <div>
            {feedback && (
              <div className="p-3 bg-status-success/10 border border-status-success/30 rounded-xl text-status-success text-sm mb-3">{feedback}</div>
            )}
            {myReview ? (
              <Card className="p-4">
                <p className="text-sm font-medium mb-1">Tu reseña</p>
                <StarRating value={myReview.rating} />
                {myReview.text && <p className="text-sm text-text-secondary mt-2">{myReview.text}</p>}
                <div className="flex gap-2 mt-3">
                  <button onClick={() => { setForm({ rating: myReview.rating, text: myReview.text || "", is_anonymous: myReview.is_anonymous }); setShowForm(true); }} className="text-xs text-accent-purple hover:underline">Editar</button>
                  <button onClick={handleDelete} className="text-xs text-status-error hover:underline">Eliminar</button>
                </div>
              </Card>
            ) : (
              <Button onClick={() => setShowForm(v => !v)} className="w-full">
                {showForm ? "Cancelar" : "Dejar una reseña"}
              </Button>
            )}

            {showForm && (
              <Card className="p-4 mt-3 space-y-3">
                <div>
                  <p className="text-sm text-text-secondary mb-1">Calificación</p>
                  <StarRating value={form.rating} onChange={v => setForm(f => ({...f, rating: v}))} />
                </div>
                <textarea
                  value={form.text}
                  onChange={e => setForm(f => ({...f, text: e.target.value}))}
                  placeholder="Contá tu experiencia (opcional)"
                  rows={3}
                  maxLength={500}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-purple"
                />
                <label className="flex items-center gap-2 text-sm text-text-secondary cursor-pointer">
                  <input type="checkbox" checked={form.is_anonymous} onChange={e => setForm(f => ({...f, is_anonymous: e.target.checked}))} className="rounded" />
                  <Shield size={14} /> Publicar de forma anónima
                </label>
                <Button loading={loading} onClick={handleSubmit}>Publicar reseña</Button>
              </Card>
            )}
          </div>
        )}

        {/* Lista de reseñas */}
        <div className="space-y-3">
          <h2 className="font-semibold text-sm">{reviews.length > 0 ? `Reseñas (${reviews.length})` : "Sin reseñas aún"}</h2>
          {reviews.map(r => (
            <Card key={r.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {r.reviewer?.profile_photo_url ? (
                    <img src={r.reviewer.profile_photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-bg-muted flex items-center justify-center text-xs">
                      {r.is_anonymous ? "?" : r.reviewer?.first_name?.charAt(0)}
                    </div>
                  )}
                  <span className="text-sm font-medium">
                    {r.is_anonymous ? "Anónimo/a" : `${r.reviewer?.first_name} ${r.reviewer?.last_name}`}
                  </span>
                </div>
                <StarRating value={r.rating} />
              </div>
              {r.text && <p className="text-sm text-text-secondary">{r.text}</p>}
              <p className="text-xs text-text-muted">{new Date(r.created_at).toLocaleDateString("es-AR")}</p>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

