import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SquaresFour, MagnifyingGlass, ChatTeardrop, Bell, UserCircle, X, Chat, Fire, Star, Trophy, Heart, UserPlus, Info } from "@phosphor-icons/react";

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

const TYPE_ICONS: Record<string, typeof Info> = {
  new_message:          Chat,
  new_reaction:         Fire,
  story_reaction:       Fire,
  new_review:           Star,
  kyc_approved:         Trophy,
  membership_activated: Trophy,
  new_like:             Heart,
  new_follower:         UserPlus,
  group_invite:         UserPlus,
  like:                 Heart,
  match:                Heart,
  comment:              Chat,
  comment_reply:        Chat,
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
  like:                 "#EC4899",
  match:                "#EC4899",
  new_follower:         "#3B82F6",
  group_invite:         "#C9A227",
  comment:              "#8B5CF6",
  comment_reply:        "#8B5CF6",
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

function NotifAvatar({ url, name, color }: { url?: string; name?: string; color: string }) {
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

const ICON_WEIGHT = "light";
const ICON_SIZE = 22;

export function BottomNav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const path      = location.pathname;

  const [notifCount, setNotifCount]       = useState(0);
  const [showPanel, setShowPanel]         = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loadingNotifs, setLoadingNotifs] = useState(false);

  useEffect(() => {
    const load = () =>
      notificationsApi.unreadCount().then(r => setNotifCount(r.data.count)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  async function handleAlertas() {
    if (showPanel) { setShowPanel(false); return; }
    setLoadingNotifs(true);
    setShowPanel(true);
    try {
      const r = await notificationsApi.list(false);
      setNotifications(r.data);
    } catch { /* ignore */ }
    setLoadingNotifs(false);
  }

  async function markOne(id: string) {
    await notificationsApi.markRead(id).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setNotifCount(prev => Math.max(0, prev - 1));
  }

  async function markAll() {
    await notificationsApi.markAllRead().catch(() => {});
    setNotifCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
  }

  const tabs = [
    { id: "feed",    label: "Feed",     Icon: SquaresFour,    path: "/feed",      prefetch: () => import("../pages/Feed")      },
    { id: "explore", label: "Explorar", Icon: MagnifyingGlass, path: "/explore",  prefetch: () => import("../pages/Explore")  },
    { id: "msgs",    label: "Mensajes", Icon: ChatTeardrop,   path: "/messages",  prefetch: () => import("../pages/Messages")  },
    { id: "alerts",  label: "Alertas",  Icon: Bell,           path: null,         prefetch: undefined                          },
    { id: "profile", label: "Mi perfil",Icon: UserCircle,     path: "/dashboard", prefetch: () => import("../pages/Dashboard") },
  ];

  function isActive(tab: typeof tabs[number]) {
    if (tab.id === "alerts") return showPanel;
    return path.startsWith(tab.path ?? "__none__");
  }

  return (
    <>
      {/* Notification bottom sheet */}
      {showPanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowPanel(false)}
        >
          <div
            className="absolute bottom-[60px] left-0 right-0 bg-bg-card border-t border-border rounded-t-2xl shadow-2xl max-h-[60vh] overflow-hidden flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <p className="font-semibold text-sm">Notificaciones</p>
              <div className="flex items-center gap-3">
                {notifCount > 0 && (
                  <button onClick={markAll} className="text-xs" style={{ color: "var(--gold)" }}>
                    Marcar todas
                  </button>
                )}
                <button onClick={() => setShowPanel(false)} className="text-text-muted hover:text-text-primary">
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 divide-y divide-border">
              {loadingNotifs && (
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
              {!loadingNotifs && notifications.length === 0 && (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-bg-muted mx-auto mb-3 flex items-center justify-center">
                    <Bell size={20} weight="light" className="text-text-muted opacity-50"/>
                  </div>
                  <p className="text-sm font-medium text-text-secondary">Todo al día</p>
                  <p className="text-xs text-text-muted mt-1">No tenés notificaciones sin leer</p>
                </div>
              )}
              {notifications.map(n => {
                const unread      = !n.read_at;
                const Icon        = TYPE_ICONS[n.type] ?? Info;
                const color       = TYPE_COLORS[n.type] ?? "#6B7280";
                const actorAvatar = n.data?.actor_avatar;
                const actorName   = n.data?.actor_name;

                return (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (unread) markOne(n.id);
                      const url = getNotifUrl(n);
                      if (url) { setShowPanel(false); navigate(url); }
                    }}
                    className={`flex items-start gap-3 px-4 py-3 transition-colors cursor-pointer ${
                      unread ? "bg-accent-purple/5 hover:bg-accent-purple/10" : "hover:bg-bg-muted"
                    }`}
                  >
                    {/* Avatar con ícono de tipo superpuesto */}
                    <div className="relative flex-shrink-0 mt-0.5">
                      <NotifAvatar url={actorAvatar} name={actorName} color={color} />
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
                    {unread && <div className="w-2 h-2 rounded-full bg-accent-purple flex-shrink-0 mt-2" />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 bg-bg-base/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around h-[60px] max-w-lg mx-auto px-2">
          {tabs.map(tab => {
            const active = isActive(tab);
            const { Icon, id, label, path: tabPath, prefetch } = tab;

            return (
              <button
                key={id}
                onMouseEnter={() => prefetch?.()}
                onTouchStart={() => prefetch?.()}
                onClick={() => {
                  if (id === "alerts") {
                    handleAlertas();
                  } else if (tabPath) {
                    setShowPanel(false);
                    navigate(tabPath);
                  }
                }}
                className="flex flex-col items-center gap-1 px-3 pt-2.5 pb-1 relative"
                aria-label={label}
              >
                {/* Active indicator pill */}
                <span
                  className="absolute top-0 h-[2px] rounded-full transition-all duration-250"
                  style={{
                    width: active ? "24px" : "0px",
                    background: "var(--gold)",
                    opacity: active ? 1 : 0,
                  }}
                />
                <div className="relative">
                  <Icon
                    size={ICON_SIZE}
                    weight={active ? "fill" : ICON_WEIGHT}
                    style={{ color: active ? "var(--gold)" : "var(--color-text-muted, #6b7280)" }}
                  />
                  {id === "alerts" && notifCount > 0 && (
                    <span
                      className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] bg-status-error text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none animate-badge-pulse"
                    >
                      {notifCount > 9 ? "9+" : notifCount}
                    </span>
                  )}
                </div>
                <span
                  className="text-[10px] tracking-wide leading-none transition-colors duration-150"
                  style={{
                    color: active ? "var(--gold)" : "var(--color-text-muted, #6b7280)",
                    fontFamily: "var(--font-sans, Manrope, sans-serif)",
                  }}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
