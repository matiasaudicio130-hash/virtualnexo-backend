import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, MapPin, Calendar, X, Plane, MessageCircle, CheckCircle } from "lucide-react";
import { travelApi, messagingApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ProtectedAvatar } from "@/components/ProtectedImage";

const PROVINCES = [
  "Buenos Aires","CABA","Catamarca","Chaco","Chubut","Córdoba","Corrientes",
  "Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones",
  "Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe",
  "Santiago del Estero","Tierra del Fuego","Tucumán",
];

function fmtDate(d: string) {
  if (!d) return "";
  const [y,m,day] = d.split("-");
  return `${day}/${m}/${y}`;
}

function daysUntil(d: string) {
  const diff = new Date(d).getTime() - Date.now();
  const days = Math.ceil(diff / 86400000);
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days < 0) return "Pasado";
  return `En ${days}d`;
}

function fieldClass(focus?: boolean) {
  return `w-full px-4 py-2.5 rounded-xl bg-bg-muted border text-sm text-text-primary placeholder-text-muted focus:outline-none transition-colors ${
    focus ? "border-accent-purple/60" : "border-border"
  }`;
}

export default function TravelMode() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [tab, setTab] = useState<"explore"|"mine"|"create">("explore");
  const [plans, setPlans] = useState<any[]>([]);
  const [mine, setMine] = useState<any[]>([]);
  const [filterProvince, setFilterProvince] = useState("");
  const [form, setForm] = useState({
    dest_city: "", dest_province: "",
    arrival_date: "", departure_date: "",
    origin_city: user?.province || "", origin_province: user?.province || "",
    description: "", looking_for: "",
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [contactingId, setContactingId] = useState<string|null>(null);

  const load = async () => {
    const [plansR, mineR] = await Promise.all([
      travelApi.plans(filterProvince || undefined),
      travelApi.mine(),
    ]);
    setPlans(plansR.data);
    setMine(mineR.data);
  };

  useEffect(() => { load(); }, [filterProvince]);

  async function handleCreate() {
    if (!form.dest_province || !form.dest_city || !form.arrival_date) {
      setFeedback("Destino, ciudad y fecha de llegada son obligatorios.");
      return;
    }
    setLoading(true); setFeedback("");
    try {
      await travelApi.create(form);
      setFeedback("¡Plan de viaje publicado!");
      setTab("mine");
      load();
      setForm(f => ({ ...f, dest_city:"", dest_province:"", arrival_date:"", departure_date:"", description:"", looking_for:"" }));
    } catch (e: any) {
      setFeedback(e.response?.data?.detail ?? "Error al crear el plan.");
    }
    setLoading(false);
  }

  async function handleCancel(id: string) {
    await travelApi.cancel(id);
    load();
  }

  async function handleContact(authorId: string) {
    if (!authorId || contactingId === authorId) return;
    setContactingId(authorId);
    try {
      const r = await messagingApi.startConversation(authorId);
      navigate(`/messages?conv=${r.data.id}`);
    } catch {
      setContactingId(null);
    }
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary animate-fade-in">
      <header className="sticky top-0 z-20 bg-bg-base/95 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-0">
        <div className="flex items-center gap-3 pb-3">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-bg-muted rounded-xl">
            <ArrowLeft size={17} className="text-text-muted"/>
          </button>
          <div className="flex items-center gap-2">
            <Plane size={16} className="text-accent-purple"/>
            <h1
              className="text-sm tracking-[0.2em] uppercase"
              style={{ color: "var(--gold,#C9A227)", fontFamily: "var(--font-display,'Cormorant Garamond',serif)" }}
            >
              Modo Viaje
            </h1>
          </div>
          <div className="flex-1"/>
          <button
            onClick={() => setTab("create")}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-xl text-white transition-all hover:opacity-90"
            style={{ background: "var(--accent-purple,#8B5CF6)" }}
          >
            <Plus size={13}/> Publicar
          </button>
        </div>

        {/* Tabs */}
        <div className="flex -mx-4 px-4">
          {([
            { id: "explore", label: "Explorar" },
            { id: "mine",    label: "Mis viajes" },
            { id: "create",  label: "Nuevo" },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                tab === t.id
                  ? "border-accent-purple text-accent-purple"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">

        {/* ── EXPLORAR ── */}
        {tab === "explore" && (
          <>
            <div className="flex items-center gap-2">
              <MapPin size={15} className="text-text-muted flex-shrink-0"/>
              <select
                value={filterProvince}
                onChange={e => setFilterProvince(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:border-accent-purple/60 text-text-primary transition-colors"
              >
                <option value="">Todas las provincias</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <Plane size={36} className="mx-auto mb-3 opacity-30"/>
                <p className="font-medium text-sm">
                  No hay viajeros{filterProvince ? ` hacia ${filterProvince}` : ""}
                </p>
                <p className="text-xs mt-1">Sé el primero en publicar un itinerario.</p>
                <button
                  onClick={() => setTab("create")}
                  className="mt-4 text-xs px-4 py-2 rounded-xl transition-all hover:opacity-80"
                  style={{ color: "var(--gold,#C9A227)", border: "1px solid rgba(201,162,39,0.3)" }}
                >
                  Publicar mi viaje →
                </button>
              </div>
            ) : (
              plans.map(plan => (
                <TravelCard
                  key={plan.id}
                  plan={plan}
                  currentUserId={user.id}
                  contacting={contactingId === plan.author?.id}
                  onContact={() => handleContact(plan.author?.id)}
                />
              ))
            )}
          </>
        )}

        {/* ── MIS VIAJES ── */}
        {tab === "mine" && (
          <>
            {mine.length === 0 ? (
              <div className="text-center py-16 text-text-muted">
                <Plane size={36} className="mx-auto mb-3 opacity-30"/>
                <p className="font-medium text-sm">No tenés viajes activos</p>
                <button
                  onClick={() => setTab("create")}
                  className="mt-4 text-xs px-4 py-2 rounded-xl transition-all hover:opacity-80"
                  style={{ color: "var(--gold,#C9A227)", border: "1px solid rgba(201,162,39,0.3)" }}
                >
                  Crear un plan →
                </button>
              </div>
            ) : (
              mine.map(plan => (
                <div
                  key={plan.id}
                  className={`bg-bg-card border border-border rounded-2xl p-4 ${plan.status !== "active" ? "opacity-50" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <MapPin size={13} className="text-accent-purple flex-shrink-0"/>
                        <p className="font-semibold text-sm">{plan.dest_city}, {plan.dest_province}</p>
                      </div>
                      <p className="text-xs text-text-muted flex items-center gap-1.5 mt-1">
                        <Calendar size={10}/>
                        {fmtDate(plan.arrival_date)}
                        {plan.departure_date && ` → ${fmtDate(plan.departure_date)}`}
                        <span
                          className="ml-1 font-medium"
                          style={{ color: "var(--gold,#C9A227)" }}
                        >
                          · {daysUntil(plan.arrival_date)}
                        </span>
                      </p>
                      {plan.description && (
                        <p className="text-xs text-text-muted mt-2 line-clamp-2">{plan.description}</p>
                      )}
                    </div>
                    {plan.status === "active" && (
                      <button
                        onClick={() => handleCancel(plan.id)}
                        className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded-lg hover:bg-bg-muted flex-shrink-0"
                        title="Cancelar viaje"
                      >
                        <X size={14}/>
                      </button>
                    )}
                  </div>
                  {plan.status !== "active" && (
                    <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-bg-muted text-text-muted">
                      Cancelado
                    </span>
                  )}
                </div>
              ))
            )}
          </>
        )}

        {/* ── CREAR PLAN ── */}
        {tab === "create" && (
          <div className="bg-bg-card border border-border rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-semibold text-sm flex items-center gap-2">
                <Plus size={15} className="text-accent-purple"/> Publicar itinerario
              </h2>
              <p className="text-xs text-text-muted mt-1">
                Otros usuarios del destino verán tu llegada y podrán contactarte.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                  Provincia destino *
                </label>
                <select
                  value={form.dest_province}
                  onChange={e => setForm(f => ({...f, dest_province: e.target.value}))}
                  className={fieldClass()}
                >
                  <option value="">Elegir…</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                  Ciudad destino *
                </label>
                <input
                  value={form.dest_city}
                  onChange={e => setForm(f => ({...f, dest_city: e.target.value}))}
                  placeholder="Ej: Mendoza"
                  className={fieldClass()}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                  Llegada *
                </label>
                <input
                  type="date"
                  value={form.arrival_date}
                  onChange={e => setForm(f => ({...f, arrival_date: e.target.value}))}
                  className={fieldClass()}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                  Regreso
                </label>
                <input
                  type="date"
                  value={form.departure_date}
                  onChange={e => setForm(f => ({...f, departure_date: e.target.value}))}
                  className={fieldClass()}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                  Ciudad origen
                </label>
                <input
                  value={form.origin_city}
                  onChange={e => setForm(f => ({...f, origin_city: e.target.value}))}
                  placeholder="Ej: Buenos Aires"
                  className={fieldClass()}
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                  Provincia origen
                </label>
                <select
                  value={form.origin_province}
                  onChange={e => setForm(f => ({...f, origin_province: e.target.value}))}
                  className={fieldClass()}
                >
                  <option value="">Elegir…</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                Descripción (opcional)
              </label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}
                placeholder="Contá algo sobre tu viaje…"
                rows={2}
                maxLength={300}
                className="w-full px-4 py-2.5 rounded-xl bg-bg-muted border border-border text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-purple/60 transition-colors"
              />
            </div>
            <div>
              <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1.5">
                ¿Qué buscás? (opcional)
              </label>
              <input
                value={form.looking_for}
                onChange={e => setForm(f => ({...f, looking_for: e.target.value}))}
                placeholder="Ej: Conocer gente de la zona, salir a cenar…"
                maxLength={150}
                className={fieldClass()}
              />
            </div>

            {feedback && (
              <p className={`text-sm ${feedback.startsWith("¡") ? "text-status-success" : "text-status-error"}`}>
                {feedback}
              </p>
            )}

            <button
              onClick={handleCreate}
              disabled={!form.dest_province || !form.dest_city || !form.arrival_date || loading}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40"
              style={{ background: "var(--accent-purple,#8B5CF6)" }}
            >
              {loading ? "Publicando…" : "Publicar itinerario"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function TravelCard({
  plan,
  currentUserId,
  contacting,
  onContact,
}: {
  plan: any;
  currentUserId: string;
  contacting: boolean;
  onContact: () => void;
}) {
  const author   = plan.author || {};
  const isOwn    = author.id === currentUserId;
  const isPast   = new Date(plan.arrival_date).getTime() < Date.now() - 86400000;

  return (
    <div className={`bg-bg-card border border-border rounded-2xl overflow-hidden transition-all ${isPast ? "opacity-60" : ""}`}>
      <div className="p-4">
        <div className="flex items-start gap-3">
          <ProtectedAvatar src={author.avatar || ""} size={42}/>

          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm leading-tight">{author.name || "Usuario"}</p>
            <div className="flex items-center gap-1 text-xs text-text-muted mt-0.5">
              {author.from && (
                <>
                  <MapPin size={10}/> <span>{author.from}</span>
                  <span className="mx-0.5 opacity-40">→</span>
                </>
              )}
              <span className="font-medium" style={{ color: "var(--gold,#C9A227)" }}>
                {plan.dest_city}, {plan.dest_province}
              </span>
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <p
              className="text-xs font-semibold"
              style={{ color: isPast ? undefined : "var(--accent-purple,#8B5CF6)" }}
            >
              {daysUntil(plan.arrival_date)}
            </p>
            <p className="text-[10px] text-text-muted mt-0.5">{fmtDate(plan.arrival_date)}</p>
          </div>
        </div>

        {plan.description && (
          <p className="text-xs text-text-muted mt-3 leading-relaxed line-clamp-2">
            {plan.description}
          </p>
        )}
        {plan.looking_for && (
          <p
            className="text-xs mt-1.5 italic"
            style={{ color: "rgba(201,162,39,0.7)" }}
          >
            "{plan.looking_for}"
          </p>
        )}

        {!isOwn && !isPast && (
          <button
            onClick={onContact}
            disabled={contacting}
            className="mt-3 flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl transition-all disabled:opacity-50"
            style={{
              background: contacting ? "rgba(139,92,246,0.2)" : "rgba(139,92,246,0.12)",
              color: contacting ? "rgba(139,92,246,0.6)" : "var(--accent-purple,#8B5CF6)",
              border: "1px solid rgba(139,92,246,0.25)",
            }}
          >
            {contacting
              ? <><CheckCircle size={12}/> Conectando…</>
              : <><MessageCircle size={12}/> Contactar</>
            }
          </button>
        )}
      </div>
    </div>
  );
}
