import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft, Plus, Calendar, MapPin, Users,
  Check, Star, X as XIcon, ShieldCheck, Clock, Trash2,
} from "lucide-react";
import { eventsApi } from "@/lib/api";
import { toast } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

function isUpcoming(iso: string) {
  return new Date(iso) > new Date();
}

function countdown(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "Ya comenzó";
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (d > 0) return `En ${d}d ${h}h`;
  if (h > 0) return `En ${h}h ${m}m`;
  return `En ${m}m`;
}

const RSVP_OPTIONS = [
  { status: "going",      icon: Check, label: "Voy",      color: "text-status-success" },
  { status: "interested", icon: Star,  label: "Me interesa", color: "text-amber-400" },
  { status: "not_going",  icon: XIcon, label: "No voy",   color: "text-text-muted" },
];

export default function Events() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  useScreenCapture({ warn: false });

  const [events, setEvents]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [tab, setTab]             = useState<"upcoming"|"mine">("upcoming");
  const [rsvpMap, setRsvpMap]     = useState<Record<string, string>>({});

  // Create form state
  const [form, setForm] = useState({
    title: "", description: "", event_date: "",
    location_name: "", province: "", city: "",
    is_private: false, max_participants: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => { load(); }, [tab]);

  async function load() {
    setLoading(true);
    try {
      if (tab === "mine") {
        const { data } = await eventsApi.mine();
        setEvents([...data.created, ...data.attending].filter((e, i, a) => a.findIndex(x => x.id === e.id) === i));
      } else {
        const { data } = await eventsApi.list({ upcoming_only: true });
        const evs: any[] = data.events || [];
        setEvents(evs);
        // Pre-populate RSVP state from server
        const serverMap: Record<string, string> = {};
        evs.forEach((e: any) => { if (e.my_rsvp) serverMap[e.id] = e.my_rsvp; });
        setRsvpMap(serverMap);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function handleRsvp(eventId: string, status: string) {
    await eventsApi.rsvp(eventId, status);
    setRsvpMap(prev => ({ ...prev, [eventId]: status }));
  }

  async function handleCreate() {
    if (!form.title || !form.event_date || creating) return;
    setCreating(true);
    try {
      await eventsApi.create({ ...form, max_participants: form.max_participants ? parseInt(form.max_participants) : null });
      setShowCreate(false);
      setForm({ title: "", description: "", event_date: "", location_name: "", province: "", city: "", is_private: false, max_participants: "" });
      load();
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? "Error al crear el evento");
    }
    setCreating(false);
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary animate-fade-in">
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-0">
        <div className="flex items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-bg-muted rounded-xl">
              <ArrowLeft size={17} className="text-text-muted"/>
            </button>
            <h1 className="font-semibold text-sm">Eventos</h1>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-accent-purple text-white text-xs rounded-xl hover:opacity-90 transition-all"
          >
            <Plus size={14}/> Crear
          </button>
        </div>
        {/* Tabs */}
        <div className="flex -mx-4 px-4">
          {[{id:"upcoming",label:"Próximos"},{id:"mine",label:"Mis eventos"}].map(t => (
            <button key={t.id} onClick={() => setTab(t.id as any)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                tab === t.id ? "border-accent-purple text-accent-purple" : "border-transparent text-text-muted"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-32 bg-bg-card border border-border rounded-2xl animate-pulse"/>)}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16 text-text-muted">
            <Calendar size={36} className="mx-auto mb-3 opacity-30"/>
            <p className="font-medium text-sm">Sin eventos</p>
            <p className="text-xs mt-1">Sé el primero en crear uno.</p>
          </div>
        ) : events.map(event => {
          const myRsvp  = rsvpMap[event.id];
          const past    = !isUpcoming(event.event_date);
          const isOwner = (event.creator_id ?? event.created_by) === user.id;

          return (
            <div key={event.id}
              className={`bg-bg-card border rounded-2xl overflow-hidden transition-all ${
                past ? "opacity-60 border-border" : myRsvp === "going" ? "border-status-success/40" : "border-border"
              }`}>

              {/* Imagen o header con countdown */}
              {event.image_url ? (
                <div className="relative">
                  <img src={event.image_url} alt={event.title}
                    className="w-full h-36 object-cover" draggable={false}
                    onContextMenu={e => e.preventDefault()}/>
                  {!past && (
                    <div className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium text-white"
                      style={{ background: "rgba(2,2,7,0.75)", backdropFilter: "blur(4px)" }}>
                      <Clock size={9}/> {countdown(event.event_date)}
                    </div>
                  )}
                </div>
              ) : !past ? (
                <div className="px-4 pt-3 pb-0 flex justify-end">
                  <span className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full"
                    style={{ background: "rgba(201,162,39,0.1)", color: "var(--gold,#C9A227)", border: "1px solid rgba(201,162,39,0.2)" }}>
                    <Clock size={9}/> {countdown(event.event_date)}
                  </span>
                </div>
              ) : null}

              <div className="p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-text-primary">{event.title}</h3>
                    {event.description && (
                      <p className="text-xs text-text-muted mt-0.5 leading-relaxed line-clamp-2">{event.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {event.is_private && (
                      <span className="text-[10px] px-2 py-0.5 bg-accent-purple/10 text-accent-purple rounded-full">
                        Privado
                      </span>
                    )}
                    {isOwner && (
                      <button
                        onClick={async () => {
                          if (!confirm("¿Eliminar este evento?")) return;
                          try {
                            await eventsApi.delete(event.id);
                            setEvents(prev => prev.filter(e => e.id !== event.id));
                          } catch { toast.error("Error al eliminar"); }
                        }}
                        className="p-1.5 text-text-muted hover:text-status-error transition-colors rounded-lg hover:bg-bg-muted"
                        title="Eliminar evento"
                      >
                        <Trash2 size={13}/>
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 text-xs text-text-muted mb-3">
                  <span className="flex items-center gap-1">
                    <Calendar size={11}/> {formatDate(event.event_date)}
                  </span>
                  {(event.city || event.location_name) && (
                    <span className="flex items-center gap-1">
                      <MapPin size={11}/> {event.city || event.location_name}
                    </span>
                  )}
                  {(event.going_count || 0) > 0 ? (
                    <span className="flex items-center gap-1 text-status-success">
                      <ShieldCheck size={11}/> {event.going_count} van
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Users size={11}/> Sé el primero
                    </span>
                  )}
                </div>

                {/* Attendee avatar preview */}
                {(event.attendee_preview?.length || 0) > 0 && (
                  <div className="flex items-center gap-1.5 mb-3">
                    <div className="flex -space-x-2">
                      {event.attendee_preview.map((a: any) => (
                        <div key={a.id} className="w-7 h-7 rounded-full border-2 border-bg-card overflow-hidden flex-shrink-0">
                          {a.profile_photo_url
                            ? <img src={a.profile_photo_url} alt="" className="w-full h-full object-cover"/>
                            : <div className="w-full h-full bg-bg-muted flex items-center justify-center text-[10px] text-text-muted font-medium">{a.first_name?.[0]}</div>
                          }
                        </div>
                      ))}
                    </div>
                    {event.going_count > event.attendee_preview.length && (
                      <span className="text-[10px] text-text-muted">+{event.going_count - event.attendee_preview.length} más</span>
                    )}
                  </div>
                )}

                {/* RSVP — diseño mejorado */}
                {!past && (
                  <div className="flex gap-2">
                    {RSVP_OPTIONS.map(({ status, icon: Icon, label }) => {
                      const active = myRsvp === status;
                      const bgMap: Record<string, string> = {
                        going:      "#22C55E",
                        interested: "#EAB308",
                        not_going:  "#6B7280",
                      };
                      return (
                        <button
                          key={status}
                          onClick={() => handleRsvp(event.id, status)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                          style={{
                            background: active ? bgMap[status] : "transparent",
                            border:     `1px solid ${active ? bgMap[status] : "rgba(255,255,255,0.1)"}`,
                            color:      active ? "#fff" : "rgba(255,255,255,0.5)",
                          }}
                        >
                          <Icon size={12}/> {label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Indicador si ya pasó */}
                {past && myRsvp && (
                  <p className="text-[10px] text-text-muted">
                    Fuiste como: <span className="font-medium">
                      {RSVP_OPTIONS.find(r => r.status === myRsvp)?.label}
                    </span>
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </main>

      {/* Create event modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-md bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border sticky top-0 bg-bg-card z-10">
              <h3 className="font-semibold">Crear evento</h3>
              <button onClick={() => setShowCreate(false)}><XIcon size={18} className="text-text-muted"/></button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {[
                { label: "Titulo *",         key: "title",         type: "text",     placeholder: "Nombre del evento" },
                { label: "Descripción",      key: "description",   type: "textarea", placeholder: "De que se trata..." },
                { label: "Fecha y hora *",   key: "event_date",    type: "datetime-local", placeholder: "" },
                { label: "Lugar",            key: "location_name", type: "text",     placeholder: "Bar Palermo, Centro Comercial..." },
                { label: "Ciudad",           key: "city",          type: "text",     placeholder: "Buenos Aires" },
                { label: "Provincia",        key: "province",      type: "text",     placeholder: "Buenos Aires" },
                { label: "Cupos maximos",    key: "max_participants", type: "number", placeholder: "Sin limite" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="text-[11px] text-text-muted uppercase tracking-widest block mb-1">{label}</label>
                  {type === "textarea" ? (
                    <textarea
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      rows={3}
                      className="w-full bg-bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-purple/60 transition-colors"
                    />
                  ) : (
                    <input
                      type={type}
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      placeholder={placeholder}
                      className="w-full bg-bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-purple/60 transition-colors"
                    />
                  )}
                </div>
              ))}

              <label className="flex items-center gap-3 cursor-pointer">
                <input type="checkbox" checked={form.is_private}
                  onChange={e => setForm(f => ({ ...f, is_private: e.target.checked }))}
                  className="rounded"/>
                <div>
                  <p className="text-sm text-text-primary">Evento privado</p>
                  <p className="text-[11px] text-text-muted">Solo visible para miembros con cuenta activa</p>
                </div>
              </label>

              <button
                onClick={handleCreate}
                disabled={!form.title || !form.event_date || creating}
                className="w-full py-3.5 bg-accent-purple text-white text-sm font-semibold rounded-xl disabled:opacity-40 hover:opacity-90 transition-all"
              >
                {creating ? "Creando..." : "Crear evento"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
