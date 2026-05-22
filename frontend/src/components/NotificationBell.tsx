import { useState, useEffect, useRef } from "react";
import { Bell, MessageSquare, Flame, Star, Award, Info, X } from "lucide-react";
import { notificationsApi } from "@/lib/api";

interface Notification {
  id: string;
  type: string;
  title: string;
  body?: string;
  read_at: string | null;
  created_at: string;
  data?: Record<string, string>;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  new_message:          MessageSquare,
  new_reaction:         Flame,
  new_review:           Star,
  kyc_approved:         Award,
  membership_activated: Award,
  system:               Info,
};

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function NotificationBell() {
  const [open, setOpen]         = useState(false);
  const [count, setCount]       = useState(0);
  const [items, setItems]       = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Cargar contador cada 30 segundos
  useEffect(() => {
    const load = () =>
      notificationsApi.unreadCount().then(r => setCount(r.data.count)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  // Cerrar al hacer click fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleOpen() {
    if (!open) {
      setLoading(true);
      const r = await notificationsApi.list(false);
      setItems(r.data);
      setLoading(false);
    }
    setOpen(v => !v);
  }

  async function markAllRead() {
    await notificationsApi.markAllRead();
    setCount(0);
    setItems(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
  }

  async function markOne(id: string) {
    await notificationsApi.markRead(id);
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setCount(prev => Math.max(0, prev - 1));
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-xl hover:bg-bg-muted text-text-muted transition-colors"
        aria-label="Notificaciones"
      >
        <Bell size={20} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-status-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 w-80 bg-bg-card border border-border rounded-2xl shadow-xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <p className="font-semibold text-sm">Notificaciones</p>
            <div className="flex items-center gap-2">
              {count > 0 && (
                <button onClick={markAllRead} className="text-xs text-accent-purple hover:underline">
                  Marcar todas
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Lista */}
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {loading && (
              <div className="p-6 text-center text-text-muted text-sm">Cargando…</div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-6 text-center text-text-muted text-sm">
                <Bell size={24} className="mx-auto mb-2 opacity-30" />
                Sin notificaciones
              </div>
            )}
            {items.map(n => {
              const Icon = TYPE_ICONS[n.type] ?? Info;
              const unread = !n.read_at;
              return (
                <div
                  key={n.id}
                  onClick={() => unread && markOne(n.id)}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors ${
                    unread ? "bg-accent-purple/5 cursor-pointer hover:bg-accent-purple/10" : "hover:bg-bg-muted"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    unread ? "bg-accent-purple/20" : "bg-bg-muted"
                  }`}>
                    <Icon size={15} className={unread ? "text-accent-purple" : "text-text-muted"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${unread ? "font-semibold" : "font-normal"}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-[10px] text-text-muted mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  {unread && (
                    <div className="w-2 h-2 rounded-full bg-accent-purple flex-shrink-0 mt-2" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
