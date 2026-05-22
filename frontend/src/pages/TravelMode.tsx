import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, MapPin, Calendar, X, Plane } from "lucide-react";
import { travelApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
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
  return `En ${days} días`;
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

  return (
    <div className="min-h-screen bg-bg-base text-text-primary">
      <header className="sticky top-0 z-10 bg-bg-base/80 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-bg-muted rounded-xl">
          <ArrowLeft size={18} className="text-text-muted" />
        </button>
        <Plane size={18} className="text-accent-purple" />
        <h1 className="font-bold">Modo Viaje</h1>
      </header>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["explore","mine","create"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t ? "border-accent-purple text-accent-purple" : "border-transparent text-text-muted"}`}
          >
            {t === "explore" ? "Explorar" : t === "mine" ? "Mis viajes" : "Nuevo"}
          </button>
        ))}
      </div>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* â”€â”€ EXPLORAR â”€â”€ */}
        {tab === "explore" && (
          <>
            {/* Filtro por provincia */}
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={16} className="text-accent-purple flex-shrink-0" />
              <select
                value={filterProvince}
                onChange={e => setFilterProvince(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl bg-bg-card border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
              >
                <option value="">Todas las provincias</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            {plans.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <Plane size={32} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No hay viajeros{filterProvince ? ` hacia ${filterProvince}` : ""}</p>
                <p className="text-sm mt-1">Sé el primero en publicar un itinerario.</p>
                <button onClick={() => setTab("create")} className="mt-4 text-accent-purple text-sm hover:underline">
                  Crear mi plan de viaje â†’
                </button>
              </div>
            ) : (
              plans.map(plan => (
                <TravelCard key={plan.id} plan={plan} />
              ))
            )}
          </>
        )}

        {/* â”€â”€ MIS VIAJES â”€â”€ */}
        {tab === "mine" && (
          <>
            {mine.length === 0 ? (
              <div className="text-center py-12 text-text-muted">
                <p className="font-medium">No tenés viajes activos</p>
                <button onClick={() => setTab("create")} className="mt-3 text-accent-purple text-sm hover:underline">
                  Crear un plan â†’
                </button>
              </div>
            ) : (
              mine.map(plan => (
                <Card key={plan.id} className={`p-4 ${plan.status !== "active" ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{plan.dest_city}, {plan.dest_province}</p>
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <Calendar size={10} />
                        {fmtDate(plan.arrival_date)}
                        {plan.departure_date && ` â†’ ${fmtDate(plan.departure_date)}`}
                        <span className="ml-1 text-accent-purple">· {daysUntil(plan.arrival_date)}</span>
                      </p>
                      {plan.description && <p className="text-sm text-text-secondary mt-2">{plan.description}</p>}
                    </div>
                    {plan.status === "active" && (
                      <button
                        onClick={() => handleCancel(plan.id)}
                        className="p-1.5 text-text-muted hover:text-status-error transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </Card>
              ))
            )}
          </>
        )}

        {/* â”€â”€ CREAR PLAN â”€â”€ */}
        {tab === "create" && (
          <Card className="p-5 space-y-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Plus size={16} /> Publicar itinerario
            </h2>
            <p className="text-xs text-text-muted -mt-2">
              Otros usuarios de la provincia de destino podrán ver tu llegada y coordinar con vos.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Provincia destino *</label>
                <select
                  value={form.dest_province}
                  onChange={e => setForm(f => ({...f, dest_province: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
                >
                  <option value="">Elegir...</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <Input
                label="Ciudad destino *"
                value={form.dest_city}
                onChange={e => setForm(f => ({...f, dest_city: e.target.value}))}
                placeholder="Ej: Mendoza"
              />
              <Input
                label="Fecha de llegada *"
                type="date"
                value={form.arrival_date}
                onChange={e => setForm(f => ({...f, arrival_date: e.target.value}))}
              />
              <Input
                label="Fecha de regreso"
                type="date"
                value={form.departure_date}
                onChange={e => setForm(f => ({...f, departure_date: e.target.value}))}
              />
              <Input
                label="Tu ciudad de origen"
                value={form.origin_city}
                onChange={e => setForm(f => ({...f, origin_city: e.target.value}))}
                placeholder="Ej: Buenos Aires"
              />
              <div>
                <label className="text-xs text-text-muted mb-1 block">Tu provincia</label>
                <select
                  value={form.origin_province}
                  onChange={e => setForm(f => ({...f, origin_province: e.target.value}))}
                  className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
                >
                  <option value="">Elegir...</option>
                  {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-text-muted mb-1 block">Descripción (opcional)</label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({...f, description: e.target.value}))}
                placeholder="Contá algo sobre tu viaje..."
                rows={2}
                maxLength={300}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-purple"
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">¿Qué buscás? (opcional)</label>
              <input
                value={form.looking_for}
                onChange={e => setForm(f => ({...f, looking_for: e.target.value}))}
                placeholder="Ej: Conocer gente de la zona, salir a cenar..."
                maxLength={150}
                className="w-full px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
              />
            </div>

            {feedback && (
              <p className={`text-sm ${feedback.startsWith("¡") ? "text-status-success" : "text-status-error"}`}>
                {feedback}
              </p>
            )}
            <Button loading={loading} onClick={handleCreate} className="w-full">
              Publicar itinerario
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}

function TravelCard({ plan }: { plan: any }) {
  const author = plan.author || {};
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <ProtectedAvatar src={author.avatar || ""} size={40} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{author.name || "Usuario"}</p>
          <div className="flex items-center gap-1 text-xs text-text-muted">
            {author.from && <><MapPin size={10} /><span>{author.from}</span><span>â†’</span></>}
            <span className="text-accent-purple font-medium">{plan.dest_city}, {plan.dest_province}</span>
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-semibold text-accent-purple">{daysUntil(plan.arrival_date)}</p>
          <p className="text-[10px] text-text-muted">{fmtDate(plan.arrival_date)}</p>
        </div>
      </div>

      {plan.description && (
        <p className="text-sm text-text-secondary mt-3 line-clamp-2">{plan.description}</p>
      )}
      {plan.looking_for && (
        <p className="text-xs text-text-muted mt-1 italic">"{plan.looking_for}"</p>
      )}
    </Card>
  );
}

