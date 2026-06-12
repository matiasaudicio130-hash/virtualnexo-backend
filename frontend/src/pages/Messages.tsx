import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, MessageSquare, Lock, Heart, User,
  Shield, Settings, X, Users, Search,
} from "lucide-react";
import { messagingApi, profilesApi, messagingV2Api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { useScreenCapture } from "@/hooks/useScreenCapture";
import { ProtectedAvatar } from "@/components/ProtectedImage";
import { PROFILE_TYPE_CONFIG } from "@/types";
import type { ProfileType } from "@/types";
import { ChatInput }    from "@/components/chat/ChatInput";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { usePresenceHeartbeat, useOnlineStatus, formatLastSeen } from "@/hooks/useOnlineStatus";
import { BottomNav } from "@/components/BottomNav";
import { Tooltip } from "@/components/ui/Tooltip";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ── ChatWindow ────────────────────────────────────────────────
function ChatWindow({
  conv, currentUserId, onClose,
}: { conv: any; currentUserId: string; onClose: () => void }) {
  const navigate                          = useNavigate();
  const [messages, setMessages]           = useState<any[]>([]);
  const [sending, setSending]             = useState(false);
  const [blocked, setBlocked]             = useState(conv.blocked_me);
  const [replyTo, setReplyTo]             = useState<any>(null);
  const [selectedMsg, setSelectedMsg]     = useState<string | null>(null);
  const [showSettings, setShowSettings]   = useState(false);
  const [typingUsers, setTypingUsers]     = useState<string[]>([]);
  const [otherTyping, setOtherTyping]     = useState(false);
  const [settings, setSettings]          = useState({ auto_delete_days: null as number|null, screenshot_alert: true });
  const bottomRef                         = useRef<HTMLDivElement>(null);
  const pollTimer                         = useRef<any>(null);
  const other                             = conv.other_user;

  const load = useCallback(() => {
    messagingApi.getMessages(conv.id).then(r => setMessages(r.data)).catch(() => {});
  }, [conv.id]);

  useEffect(() => { load(); }, [load]);

  // Poll typing indicator
  useEffect(() => {
    pollTimer.current = setInterval(async () => {
      try {
        const { data } = await messagingV2Api.getTyping(conv.id);
        setOtherTyping((data.typing || []).length > 0);
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(pollTimer.current);
  }, [conv.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, otherTyping]);

  const typeCfg   = other?.profile_type ? PROFILE_TYPE_CONFIG[other.profile_type as ProfileType] : null;
  const onlineStatus = useOnlineStatus(other?.id);

  async function handleDeleteMsg(msgId: string, forAll: boolean) {
    await messagingV2Api.deleteMessage(msgId, forAll);
    setSelectedMsg(null);
    load();
  }

  async function handleReact(msgId: string, emoji: string) {
    await messagingV2Api.reactMessage(msgId, emoji);
    setSelectedMsg(null);
    load();
  }

  async function saveSettings() {
    await messagingV2Api.updateSettings(conv.id, settings);
    setShowSettings(false);
  }

  async function clearHistory() {
    if (!confirm("¿Borrar todo el historial de esta conversación? Esta acción no se puede deshacer.")) return;
    await messagingV2Api.clearHistory(conv.id);
    setMessages([]);
    setShowSettings(false);
  }

  const visibleMessages = messages.filter(m => !m.deleted_for_all || m.sender_id === currentUserId);

  return (
    <div className="flex flex-col h-full relative">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 pt-safe-3 pb-3 border-b border-border flex-shrink-0 bg-bg-base/95 backdrop-blur-md">
        <button onClick={onClose} className="p-1.5 hover:bg-bg-muted rounded-xl text-text-muted">
          <ArrowLeft size={18} />
        </button>
        <button onClick={() => other?.id && navigate(`/profile/${other.id}`)} className="flex-shrink-0">
          <ProtectedAvatar src={other?.profile_photo_url || ""} size={36} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-semibold text-sm truncate">
              {other ? `${other.first_name} ${other.last_name}` : "Usuario"}
            </p>
            {typeCfg && <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${typeCfg.dot}`}/>}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${onlineStatus.online ? "bg-status-success" : "bg-text-muted/40"}`}/>
              <span className="text-[9px] text-text-muted">
                {onlineStatus.online ? "En línea" : formatLastSeen(onlineStatus.minutes_ago)}
              </span>
            </div>
            <Shield size={9} className="text-accent-purple/50"/>
            <span className="text-[9px] text-text-muted">Protegido</span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip label="Configuración" position="bottom">
            <button onClick={() => setShowSettings(v => !v)}
              className="p-1.5 text-text-muted hover:text-text-primary rounded-xl transition-colors">
              <Settings size={16}/>
            </button>
          </Tooltip>
          {!blocked && (
            <Tooltip label="Bloquear" position="bottom">
              <button onClick={async () => {
                if (!confirm("¿Bloquear a este usuario?")) return;
                await messagingApi.blockUser(conv.id); setBlocked(true);
              }} className="p-1.5 text-text-muted hover:text-status-error rounded-xl transition-colors">
                <Lock size={16}/>
              </button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ── Panel de configuración ── */}
      {showSettings && (
        <div className="absolute top-[60px] right-3 z-50 w-64 bg-bg-card border border-border rounded-xl shadow-lg p-4 space-y-4 animate-slide-up">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-primary">Configuración del chat</p>
            <button onClick={() => setShowSettings(false)}><X size={14} className="text-text-muted"/></button>
          </div>

          <div>
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2">Auto-limpieza</p>
            <div className="grid grid-cols-4 gap-1.5">
              {([null, 15, 30, 90] as (number|null)[]).map(d => (
                <button key={String(d)}
                  onClick={() => setSettings(s => ({ ...s, auto_delete_days: d }))}
                  className={`py-1.5 rounded-lg text-[10px] border transition-all ${
                    settings.auto_delete_days === d
                      ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple"
                      : "border-border text-text-muted hover:border-accent-purple/30"
                  }`}>
                  {d ? `${d}d` : "Off"}
                </button>
              ))}
            </div>
            {settings.auto_delete_days && (
              <p className="text-[9px] text-text-muted mt-1">
                Mensajes de más de {settings.auto_delete_days} días se eliminan automáticamente
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={settings.screenshot_alert}
              onChange={e => setSettings(s => ({ ...s, screenshot_alert: e.target.checked }))}
              className="rounded"/>
            <div className="flex flex-col">
              <span className="text-xs text-text-secondary">Alerta al detectar captura</span>
              <span className="text-[9px] text-text-muted/50 mt-0.5">
                No disponible en iPhone/iPad (el contenido lleva marca de agua)
              </span>
            </div>
          </label>

          <button onClick={saveSettings}
            className="w-full py-2 bg-accent-purple text-white text-xs rounded-lg hover:opacity-90 transition-all">
            Guardar
          </button>

          <button onClick={clearHistory}
            className="w-full py-2 border border-status-error/40 text-status-error text-xs rounded-lg hover:bg-status-error/8 transition-all">
            Limpiar historial
          </button>
        </div>
      )}

      {/* ── Mensajes ── */}
      <div className="flex-1 overflow-y-auto px-3 py-4"
        onClick={() => {}}>

        {visibleMessages.map((msg, idx) => {
          const prev = visibleMessages[idx - 1];
          const showDate = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-2 my-4">
                  <div className="flex-1 h-px bg-border/30"/>
                  <span className="text-[10px] text-text-muted px-2 bg-bg-base rounded-full border border-border/30">
                    {new Date(msg.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" })}
                  </span>
                  <div className="flex-1 h-px bg-border/30"/>
                </div>
              )}
              <MessageBubble
                msg={msg}
                isMe={msg.sender_id === currentUserId}
                currentUserId={currentUserId}
                onDelete={handleDeleteMsg}
                onReply={setReplyTo}
                onReload={load}
              />
            </div>
          );
        })}

        {/* Typing indicator */}
        {otherTyping && (
          <div className="flex justify-start mb-2">
            <div className="bg-bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
              {[0,150,300].map(d => (
                <span key={d} className="w-1.5 h-1.5 rounded-full bg-text-muted animate-bounce"
                  style={{ animationDelay: `${d}ms` }}/>
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef}/>
      </div>

      {/* ── Input ── */}
      {blocked ? (
        <div className="px-4 py-4 border-t border-border text-center text-sm text-status-error flex items-center justify-center gap-2 pb-safe">
          <Lock size={14}/> Usuario bloqueado
        </div>
      ) : (
        <ChatInput
          onSend={async (msgData) => {
            if (sending) return;
            setSending(true);
            try {
              const { data } = await messagingApi.sendMessage(conv.id, {
                content:      msgData.content,
                media_url:    msgData.media_url,
                type:         msgData.media_type || "text",
                audio_duration: msgData.audio_duration,
                reply_to_id:  msgData.reply_to_id,
                view_once:    msgData.view_once,
              });
              setMessages(prev => [...prev, data]);
              setReplyTo(null);
            } catch (e: any) {
              const detail = e?.response?.data?.detail;
              const msg = Array.isArray(detail)
                ? detail.map((d: any) => d.msg ?? String(d)).join("; ")
                : detail ?? "No se pudo enviar";
              alert(msg);
            }
            setSending(false);
          }}
          onTyping={(t) => {
            messagingV2Api.setTyping(conv.id, t).catch(() => {});
          }}
          replyTo={replyTo ? {
            id:      replyTo.id,
            content: replyTo.content,
            author:  other?.first_name || "Usuario",
          } : null}
          onCancelReply={() => setReplyTo(null)}
          disabled={blocked}
          recipientName={other?.first_name}
        />
      )}
    </div>
  );
}

// ── Página principal de mensajes ─────────────────────────────
export default function Messages() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user } = useAuthStore();
  usePresenceHeartbeat(); // mantiene el usuario como "online"
  const [tab, setTab]                     = useState<"messages" | "matches" | "groups" | "requests">("messages");
  const [conversations, setConversations] = useState<any[]>([]);
  const [matches, setMatches]             = useState<any[]>([]);
  const [requests, setRequests]           = useState<any[]>([]);
  const [activeConv, setActiveConv]       = useState<any | null>(null);
  const [loading, setLoading]             = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [requestAction, setRequestAction] = useState<string | null>(null);
  const [requestSentMsg, setRequestSentMsg] = useState("");

  // Búsqueda
  const [searchQuery,   setSearchQuery]   = useState("");
  const [msgResults,    setMsgResults]    = useState<any[]>([]);
  const [searching,     setSearching]     = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useScreenCapture({ warn: true });

  useEffect(() => {
    messagingApi.conversations()
      .then(r => { setConversations(r.data.conversations ?? r.data); setLoading(false); })
      .catch(() => setLoading(false));

    messagingApi.messageRequests()
      .then(r => setRequests(r.data.requests || []))
      .catch(() => {});

    const withUser  = params.get("with");
    const startUser = params.get("start");
    const target    = withUser || startUser;
    if (target && user) {
      messagingApi.startConversation(target)
        .then(r => {
          if (r.data.status === "request_sent") {
            setRequestSentMsg("Tu solicitud fue enviada. Si te acepta, podrán chatear.");
          } else if (r.data.status === "active" || r.data.id) {
            setActiveConv(r.data);
          }
        })
        .catch(() => {});
    }
  }, []);

  // Poll de conversaciones cada 15s cuando no hay chat activo
  useEffect(() => {
    if (activeConv) return;
    const t = setInterval(() => {
      messagingApi.conversations()
        .then(r => setConversations(r.data.conversations ?? r.data))
        .catch(() => {});
    }, 15000);
    return () => clearInterval(t);
  }, [activeConv]);

  // Búsqueda de mensajes con debounce
  useEffect(() => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (searchQuery.trim().length < 2) { setMsgResults([]); return; }
    setSearching(true);
    searchDebounce.current = setTimeout(async () => {
      try {
        const { data } = await messagingApi.searchMessages(searchQuery.trim());
        setMsgResults(data.results || []);
      } catch { setMsgResults([]); }
      setSearching(false);
    }, 350);
    return () => { if (searchDebounce.current) clearTimeout(searchDebounce.current); };
  }, [searchQuery]);

  useEffect(() => {
    if (tab !== "matches" || matches.length > 0) return;
    setMatchesLoading(true);
    profilesApi.matches()
      .then(r => setMatches(r.data))
      .catch(() => {})
      .finally(() => setMatchesLoading(false));
  }, [tab]);

  if (!user) return null;

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      {/* Header */}
      {!activeConv && (
        <header className="sticky top-0 z-10 bg-bg-base/80 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-0">
          <div className="flex items-center gap-3 pb-3">
            <button onClick={() => navigate(-1)} className="p-2 hover:bg-bg-muted rounded-xl">
              <ArrowLeft size={18} className="text-text-muted" />
            </button>
            <h1 className="font-bold">Bandeja</h1>
          </div>
          {/* Pestañas */}
          <div className="flex border-b border-border -mx-4 px-4 overflow-x-auto scrollbar-none">
            {[
              { id: "messages"  as const, label: "Mensajes",    icon: <MessageSquare size={14} /> },
              { id: "groups"    as const, label: "Grupos",      icon: <Users size={14} /> },
              { id: "matches"   as const, label: "Matches",     icon: <Heart size={14} /> },
              { id: "requests"  as const, label: "Solicitudes", icon: <User size={14} />, badge: requests.length },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px whitespace-nowrap flex-shrink-0 relative ${
                  tab === t.id
                    ? "border-accent-purple text-accent-purple"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                {t.icon} {t.label}
                {(t as any).badge > 0 && (
                  <span className="absolute -top-0.5 -right-1 w-4 h-4 rounded-full bg-status-error text-white text-[9px] font-bold flex items-center justify-center">
                    {(t as any).badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>
      )}

      {/* Chat activo */}
      {activeConv ? (
        <div className="flex-1 flex flex-col h-screen">
          <ChatWindow
            conv={activeConv}
            currentUserId={user.id}
            onClose={() => {
              setActiveConv(null);
              messagingApi.conversations().then(r => setConversations(r.data.conversations ?? r.data));
            }}
          />
        </div>
      ) : tab === "messages" ? (
        /* Lista de conversaciones */
        <main className="flex-1 max-w-lg mx-auto w-full pb-[80px]">

          {/* Barra de búsqueda */}
          <div className="px-4 pt-3 pb-2">
            <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border bg-bg-muted transition-colors ${
              searchQuery ? "border-[rgba(201,162,39,0.4)]" : "border-border"
            }`}>
              <Search size={14} className="text-text-muted flex-shrink-0" style={{ color: searchQuery ? "var(--gold,#C9A227)" : undefined }} />
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Buscar conversaciones o mensajes…"
                className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-muted/60"
                style={{ fontSize: "16px" }}
                autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false}
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(""); setMsgResults([]); }} className="text-text-muted hover:text-text-primary flex-shrink-0">
                  {searching
                    ? <div className="w-3.5 h-3.5 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin"/>
                    : <X size={14}/>
                  }
                </button>
              )}
            </div>
          </div>

          {/* Resultados de búsqueda en mensajes */}
          {searchQuery.trim().length >= 2 && (
            <div>
              {/* Resultados de mensajes del backend */}
              {msgResults.length > 0 && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-widest px-4 py-2">Mensajes</p>
                  <div className="divide-y divide-border/50">
                    {msgResults.map(r => (
                      <button
                        key={r.message_id}
                        onClick={() => {
                          const conv = conversations.find(c => c.id === r.conversation_id);
                          if (conv) { setActiveConv(conv); setSearchQuery(""); setMsgResults([]); }
                        }}
                        className="w-full flex items-start gap-3 px-4 py-3 hover:bg-bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-muted flex-shrink-0 border border-border/40">
                          {r.other_user?.avatar
                            ? <img src={r.other_user.avatar} alt="" className="w-full h-full object-cover"/>
                            : <div className="w-full h-full bg-accent-purple/15"/>
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold">{r.other_user?.name || "Usuario"}</p>
                          <p className="text-xs text-text-muted mt-0.5 truncate">
                            {r.is_mine ? <span className="text-text-muted/60">Vos: </span> : null}
                            {r.content}
                          </p>
                          <p className="text-[10px] text-text-muted/50 mt-0.5">
                            {new Date(r.created_at).toLocaleDateString("es-AR", { day:"numeric", month:"short" })}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Conversaciones filtradas por nombre */}
              {(() => {
                const q = searchQuery.toLowerCase();
                const filtered = conversations.filter(c => {
                  const name = `${c.other_user?.first_name || ""} ${c.other_user?.last_name || ""}`.toLowerCase();
                  return name.includes(q);
                });
                if (filtered.length === 0 && msgResults.length === 0 && !searching) {
                  return (
                    <div className="text-center py-12 text-text-muted px-6">
                      <Search size={28} className="mx-auto mb-2 opacity-30"/>
                      <p className="text-sm">Sin resultados para "{searchQuery}"</p>
                    </div>
                  );
                }
                if (filtered.length === 0) return null;
                return (
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest px-4 py-2">Conversaciones</p>
                    <div className="divide-y divide-border/50">
                      {filtered.map(conv => {
                        const other = conv.other_user;
                        return (
                          <button key={conv.id} onClick={() => { setActiveConv(conv); setSearchQuery(""); setMsgResults([]); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-bg-muted/50 transition-colors text-left">
                            <ProtectedAvatar src={other?.profile_photo_url || ""} size={40} />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{other ? `${other.first_name} ${other.last_name}` : "Usuario"}</p>
                              {conv.last_message_preview && (
                                <p className="text-xs text-text-muted truncate">{conv.last_message_preview}</p>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Lista normal de conversaciones (cuando no hay búsqueda activa) */}
          {!searchQuery.trim() && (
            <>
              {loading && (
                <div className="space-y-2 p-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-16 bg-bg-card rounded-2xl animate-pulse" />)}
                </div>
              )}
              {!loading && conversations.length === 0 && (
                <div className="text-center py-16 text-text-muted px-6">
                  <MessageSquare size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">Sin conversaciones</p>
                  <p className="text-sm mt-1">
                    Encontrá a alguien en el{" "}
                    <button onClick={() => navigate("/feed")} className="text-accent-purple hover:underline">Feed</button>{" "}
                    y enviá un mensaje desde su perfil.
                  </p>
                </div>
              )}
          <div className="divide-y divide-border">
            {conversations.map(conv => {
              const other   = conv.other_user;
              const typeCfg = other?.profile_type ? PROFILE_TYPE_CONFIG[other.profile_type as ProfileType] : null;
              return (
                <div key={conv.id} className="flex items-center gap-3 px-4 py-4 hover:bg-bg-muted/50 transition-colors">
                  {/* Avatar → perfil */}
                  <button
                    className="relative flex-shrink-0"
                    onClick={() => other?.id && navigate(`/profile/${other.id}`)}
                  >
                    <ProtectedAvatar src={other?.profile_photo_url || ""} size={48} />
                    {conv.unread_count > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-accent-purple text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {conv.unread_count}
                      </span>
                    )}
                  </button>
                  {/* Contenido → chat */}
                  <button className="flex-1 min-w-0 text-left" onClick={() => setActiveConv(conv)}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 min-w-0">
                        <p className={`text-sm truncate ${conv.unread_count > 0 ? "font-semibold" : "font-normal"}`}>
                          {other ? `${other.first_name} ${other.last_name}` : "Usuario"}
                        </p>
                        {typeCfg && <span className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${typeCfg.dot}`} />}
                      </div>
                      <p className="text-[11px] text-text-muted flex-shrink-0 ml-2">
                        {conv.last_message_at ? timeAgo(conv.last_message_at) : ""}
                      </p>
                    </div>
                    <p className={`text-xs truncate mt-0.5 ${conv.unread_count > 0 ? "text-text-primary" : "text-text-muted"}`}>
                      {conv.is_last_sender && <span className="mr-1">Vos:</span>}
                      {conv.last_message_preview || "Sin mensajes aún"}
                    </p>
                  </button>
                </div>
              );
            })}
          </div>
            </>
          )}
        </main>
      ) : tab === "groups" ? (
        <main className="flex-1 flex flex-col items-center justify-center pb-[80px] pt-8 gap-4 text-center px-6">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: "rgba(201,162,39,0.08)", border: "1px solid rgba(201,162,39,0.2)" }}
          >
            <Users size={28} style={{ color: "rgba(201,162,39,0.5)" }} />
          </div>
          <div>
            <p className="text-sm font-semibold mb-1">Grupos de chat</p>
            <p className="text-xs text-text-muted">Conversaciones grupales con usuarios verificados</p>
          </div>
          <button
            onClick={() => navigate("/groups")}
            className="px-5 py-2.5 rounded-full text-xs font-medium"
            style={{ background: "var(--gold, #C9A227)", color: "#020207" }}
          >
            Ir a Grupos
          </button>
        </main>

      ) : tab === "requests" ? (
        /* ── Solicitudes de mensaje ─────────────────────── */
        <main className="flex-1 max-w-lg mx-auto w-full pb-[80px]">
          {requests.length === 0 ? (
            <div className="text-center py-16 text-text-muted px-6">
              <User size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin solicitudes pendientes</p>
              <p className="text-sm mt-1 text-text-muted/70">
                Cuando alguien que no te sigue quiera escribirte, aparecerá acá.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {requests.map((req: any) => (
                <div key={req.id} className="flex items-start gap-3 px-4 py-4">
                  <button onClick={() => navigate(`/profile/${req.from_id}`)} className="flex-shrink-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-bg-muted border border-border/40">
                      {req.from_avatar
                        ? <img src={req.from_avatar} alt="" className="w-full h-full object-cover" />
                        : <div className="w-full h-full bg-accent-purple/15 flex items-center justify-center">
                            <User size={18} className="text-accent-purple" />
                          </div>
                      }
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{req.from_name || "Usuario"}</p>
                    {req.first_message && (
                      <p className="text-xs text-text-muted mt-0.5 line-clamp-2">"{req.first_message}"</p>
                    )}
                    <p className="text-[10px] text-text-muted mt-1">
                      {req.created_at ? new Date(req.created_at).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) : ""}
                    </p>
                    <div className="flex gap-2 mt-2.5">
                      <button
                        disabled={requestAction === req.from_id}
                        onClick={async () => {
                          setRequestAction(req.from_id);
                          try {
                            const { data } = await messagingApi.acceptRequest(req.from_id);
                            setRequests(prev => prev.filter(r => r.from_id !== req.from_id));
                            setActiveConv({ ...data, other_user: { id: req.from_id, first_name: req.from_name?.split(" ")[0] || "", profile_photo_url: req.from_avatar }, unread_count: 0 });
                          } catch { /* ignore */ }
                          setRequestAction(null);
                        }}
                        className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-50"
                        style={{ background: "var(--gold,#C9A227)", color: "#0a0a0f" }}
                      >
                        {requestAction === req.from_id ? "…" : "Aceptar"}
                      </button>
                      <button
                        disabled={requestAction === req.from_id}
                        onClick={async () => {
                          setRequestAction(req.from_id);
                          try {
                            await messagingApi.rejectRequest(req.from_id);
                            setRequests(prev => prev.filter(r => r.from_id !== req.from_id));
                          } catch { /* ignore */ }
                          setRequestAction(null);
                        }}
                        className="px-4 py-2 rounded-xl border border-border text-xs text-text-muted hover:border-status-error/40 hover:text-status-error transition-colors disabled:opacity-50"
                      >
                        Rechazar
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

      ) : (
        /* Pestaña Matches */
        <main className="flex-1 max-w-lg mx-auto w-full pb-[80px]">
          {matchesLoading && (
            <div className="space-y-2 p-4">
              {[1, 2, 3].map(i => <div key={i} className="h-16 bg-bg-card rounded-2xl animate-pulse" />)}
            </div>
          )}
          {!matchesLoading && matches.length === 0 && (
            <div className="text-center py-16 text-text-muted px-6">
              <Heart size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Sin matches todavía</p>
              <p className="text-sm mt-1">Cuando dos perfiles se den like mutuamente, aparecerán acá.</p>
            </div>
          )}
          <div className="divide-y divide-border">
            {matches.map(m => {
              const typeCfg = m.profile_type ? PROFILE_TYPE_CONFIG[m.profile_type as ProfileType] : null;
              return (
                <button
                  key={m.match_id}
                  onClick={() => navigate(`/profile/${m.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-4 hover:bg-bg-muted/50 transition-colors text-left"
                >
                  <div className="relative">
                    {m.profile_photo_url
                      ? <img src={m.profile_photo_url} alt="" className="w-12 h-12 rounded-full object-cover border border-accent-purple/30" />
                      : <div className="w-12 h-12 rounded-full bg-accent-purple/10 border border-accent-purple/30 flex items-center justify-center"><User size={20} className="text-accent-purple" /></div>
                    }
                    <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-status-error rounded-full flex items-center justify-center">
                      <Heart size={8} fill="white" className="text-white" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">{m.first_name} {m.last_name}</p>
                      {typeCfg && <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${typeCfg.dot}`} />}
                    </div>
                    <p className="text-xs text-text-muted mt-0.5">
                      {m.province ?? ""} · Match {timeAgo(m.matched_at)}
                    </p>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      messagingApi.startConversation(m.id)
                        .then(r => setActiveConv({ ...r.data, other_user: m, unread_count: 0 }))
                        .catch(() => {});
                    }}
                    className="flex-shrink-0 p-2 rounded-xl bg-accent-purple/10 hover:bg-accent-purple/20 transition-colors"
                    title="Enviar mensaje"
                  >
                    <MessageSquare size={15} className="text-accent-purple" />
                  </button>
                </button>
              );
            })}
          </div>
        </main>
      )}

      {/* Toast: solicitud enviada */}
      {requestSentMsg && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-slide-up">
          <div className="flex items-center gap-3 px-5 py-3 bg-bg-card border border-accent-purple/30 rounded-2xl shadow-lg">
            <User size={18} className="text-accent-purple flex-shrink-0" />
            <p className="text-sm text-text-primary max-w-xs">{requestSentMsg}</p>
          </div>
        </div>
      )}

      {!activeConv && <BottomNav />}
    </div>
  );
}
