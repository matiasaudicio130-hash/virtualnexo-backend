import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, MessageSquare, Flame, Star, Award, Info, Heart, UserPlus, X } from "lucide-react";
import { notificationsApi } from "@/lib/api";
import { getNotifUrl } from "@/lib/notifUtils";

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
  story_reaction:       Flame,
  new_review:           Star,
  kyc_approved:         Award,
  membership_activated: Award,
  new_like:             Heart,
  new_follower:         UserPlus,
  group_invite:         UserPlus,
  system:               Info,
};

const TYPE_COLORS: Record<string, string> = {
  new_message:          "#8B5CF6",
  new_reaction:         "#F97316",
  story_reaction:       "#F97316",
  new_review:           "#EAB308",
  kyc_approved:         "#22C55E",
  membership_activated: "#C9A227",
  new_like:             "#EC4899",
  new_follower:         "#3B82F6",
  group_invite:         "#C9A227",
  system:               "#6B7280",
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

function ActorAvatar({ url, name, color }: { url?: string; name?: string; color: string }) {
  if (url) {
    return (
      <img
        src={url}
        alt={name || ""}
        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    );
  }
  const initials = name
    ? name.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()
    : "?";
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
      style={{ background: color }}
    >
      {initials}
    </div>
  );
}

export function NotificationBell() {
  const navigate                = useNavigate();
  const [open, setOpen]         = useState(false);
  const [count, setCount]       = useState(0);
  const [items, setItems]       = useState<Notification[]>([]);
  const [loading, setLoading]   = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () =>
      notificationsApi.unreadCount().then(r => setCount(r.data.count)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

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
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-status-error text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-badge-pulse">
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
              <div className="divide-y divide-border">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-9 h-9 rounded-full skeleton flex-shrink-0"/>
                    <div className="flex-1 space-y-2">
                      <div className="h-3 skeleton rounded-full w-3/4"/>
                      <div className="h-2 skeleton rounded-full w-1/2"/>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && items.length === 0 && (
              <div className="p-7 text-center">
                <div className="w-11 h-11 rounded-full bg-bg-muted mx-auto mb-3 flex items-center justify-center">
                  <Bell size={18} className="text-text-muted opacity-40"/>
                </div>
                <p className="text-sm font-medium text-text-secondary">Todo al día</p>
                <p className="text-xs text-text-muted mt-0.5">No tenés notificaciones nuevas</p>
              </div>
            )}
            {items.map(n => {
              const Icon    = TYPE_ICONS[n.type] ?? Info;
              const color   = TYPE_COLORS[n.type] ?? "#6B7280";
              const unread  = !n.read_at;
              const actorAvatar = n.data?.actor_avatar;
              const actorName   = n.data?.actor_name;

              return (
                <div
                  key={n.id}
                  onClick={() => {
                    if (unread) markOne(n.id);
                    const url = getNotifUrl(n);
                    if (url) { setOpen(false); navigate(url); }
                  }}
                  className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                    unread ? "bg-accent-purple/5 hover:bg-accent-purple/10" : "hover:bg-bg-muted"
                  }`}
                >
                  {/* Avatar o ícono del tipo */}
                  <div className="relative flex-shrink-0 mt-0.5">
                    <ActorAvatar url={actorAvatar} name={actorName} color={color} />
                    {/* Ícono del tipo superpuesto abajo-derecha */}
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full flex items-center justify-center border border-bg-card"
                      style={{ background: color }}
                    >
                      <Icon size={9} className="text-white" />
                    </div>
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
