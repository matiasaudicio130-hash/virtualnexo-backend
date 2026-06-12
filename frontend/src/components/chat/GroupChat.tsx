/**
 * GroupChat — UI completa de grupos de chat.
 * Incluye: lista de grupos, ventana de chat, crear grupo, gestionar miembros.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowLeft, Plus, Users, Send, Settings, X,
  UserPlus, Trash2, Crown, LogOut, MoreVertical,
} from "lucide-react";
import { groupsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { ChatInput } from "./ChatInput";

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

// ── Create Group Modal ─────────────────────────────────────────
function CreateGroupModal({ onClose, onCreated }: { onClose: () => void; onCreated: (g: any) => void }) {
  const [name, setName]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");

  async function handleCreate() {
    if (!name.trim()) { setError("El nombre es obligatorio"); return; }
    setLoading(true);
    try {
      const { data } = await groupsApi.create({ name: name.trim(), member_ids: [] });
      onCreated(data);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al crear el grupo");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-sm bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Nuevo grupo</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-bg-muted rounded-lg text-text-muted">
            <X size={16}/>
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Nombre del grupo *</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreate()}
              maxLength={60}
              placeholder="Ej: Amigos de Córdoba"
              autoFocus
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
            />
            <p className="text-xs text-text-muted text-right mt-1">{name.length}/60</p>
          </div>
          <p className="text-xs text-text-muted">
            Podés agregar miembros después de crear el grupo desde la configuración.
          </p>
          {error && <p className="text-xs text-status-error">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            className="w-full py-3 rounded-xl bg-accent-purple text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-40"
          >
            {loading ? "Creando…" : "Crear grupo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Group Settings Panel ───────────────────────────────────────
function GroupSettingsPanel({
  group, onClose, onUpdated, onLeft,
}: { group: any; onClose: () => void; onUpdated: (g: any) => void; onLeft: () => void }) {
  const { user } = useAuthStore();
  const [name, setName]       = useState(group.name);
  const [addUserId, setAddUserId] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const isAdmin = group.my_role === "admin";

  const notify = (msg: string) => { setFeedback(msg); setTimeout(() => setFeedback(""), 3000); };

  async function saveName() {
    if (!name.trim() || name === group.name) return;
    setLoading(true);
    try {
      const { data } = await groupsApi.update(group.id, { name: name.trim() });
      onUpdated({ ...group, name: data.name });
      notify("Nombre actualizado");
    } catch { notify("Error al guardar"); }
    setLoading(false);
  }

  async function addMember() {
    if (!addUserId.trim()) return;
    setLoading(true);
    try {
      await groupsApi.addMember(group.id, addUserId.trim());
      setAddUserId("");
      notify("Miembro agregado");
    } catch (e: any) { notify(e.response?.data?.detail ?? "Error"); }
    setLoading(false);
  }

  async function removeMember(userId: string) {
    if (!confirm("¿Remover a este miembro?")) return;
    await groupsApi.removeMember(group.id, userId);
    onUpdated({ ...group, members: group.members.filter((m: any) => m.user_id !== userId) });
  }

  async function leaveGroup() {
    if (!confirm("¿Salir del grupo?")) return;
    await groupsApi.removeMember(group.id, user!.id);
    onLeft();
  }

  return (
    <div className="absolute inset-0 z-20 bg-bg-base flex flex-col">
      <div className="flex items-center gap-3 px-4 pt-safe-3 pb-3 border-b border-border flex-shrink-0">
        <button onClick={onClose} className="p-1.5 hover:bg-bg-muted rounded-xl text-text-muted">
          <ArrowLeft size={18}/>
        </button>
        <h2 className="font-semibold text-sm">Configuración del grupo</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {feedback && (
          <div className="p-3 rounded-xl text-xs bg-status-success/10 border border-status-success/30 text-status-success">
            {feedback}
          </div>
        )}

        {/* Nombre */}
        {isAdmin && (
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Nombre del grupo</label>
            <div className="flex gap-2">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={60}
                className="flex-1 px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
              />
              <button
                onClick={saveName}
                disabled={loading || !name.trim() || name === group.name}
                className="px-4 py-2.5 rounded-xl bg-accent-purple text-white text-sm disabled:opacity-40"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        {/* Agregar miembro */}
        {isAdmin && (
          <div>
            <label className="text-xs text-text-secondary mb-1.5 block">Agregar miembro por ID</label>
            <div className="flex gap-2">
              <input
                value={addUserId}
                onChange={e => setAddUserId(e.target.value)}
                placeholder="UUID del usuario…"
                className="flex-1 px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
              />
              <button
                onClick={addMember}
                disabled={loading || !addUserId.trim()}
                className="p-2.5 rounded-xl bg-accent-purple text-white disabled:opacity-40"
              >
                <UserPlus size={16}/>
              </button>
            </div>
          </div>
        )}

        {/* Miembros */}
        <div>
          <p className="text-xs text-text-muted uppercase tracking-widest mb-3">
            Miembros ({group.members?.length ?? 0})
          </p>
          <div className="space-y-2">
            {(group.members ?? []).map((m: any) => (
              <div key={m.user_id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-bg-muted/50 border border-border/40">
                <div className="w-8 h-8 rounded-full bg-accent-purple/20 flex items-center justify-center flex-shrink-0 text-accent-purple text-xs font-bold">
                  {m.name?.[0]?.toUpperCase() ?? "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.name || "Usuario"}</p>
                </div>
                {m.role === "admin" && <Crown size={12} className="text-amber-400 flex-shrink-0"/>}
                {isAdmin && m.user_id !== user?.id && (
                  <button onClick={() => removeMember(m.user_id)} className="p-1 text-text-muted hover:text-status-error">
                    <X size={14}/>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Salir */}
        <button
          onClick={leaveGroup}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-status-error/30 text-status-error text-sm hover:bg-status-error/8 transition-colors"
        >
          <LogOut size={14}/> Salir del grupo
        </button>
      </div>
    </div>
  );
}

// ── Group Chat Window ──────────────────────────────────────────
function GroupChatWindow({
  group: initialGroup,
  currentUserId,
  onClose,
}: { group: any; currentUserId: string; onClose: () => void }) {
  const [group, setGroup]         = useState(initialGroup);
  const [messages, setMessages]   = useState<any[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [sending, setSending]     = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);
  const pollRef                   = useRef<any>(null);

  const load = useCallback(() => {
    groupsApi.messages(group.id).then(r => setMessages(r.data.messages || [])).catch(() => {});
  }, [group.id]);

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 5000);
    return () => clearInterval(pollRef.current);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend(msg: { content: string; media_url?: string; media_type?: string; reply_to_id?: string }) {
    if (sending) return;
    setSending(true);
    try {
      const { data } = await groupsApi.sendMessage(group.id, msg);
      setMessages(prev => [...prev, data]);
    } catch { /* ignore */ }
    setSending(false);
  }

  return (
    <div className="flex flex-col h-full relative">
      {showSettings && (
        <GroupSettingsPanel
          group={group}
          onClose={() => setShowSettings(false)}
          onUpdated={g => setGroup(g)}
          onLeft={onClose}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-3 pb-3 border-b border-border flex-shrink-0 bg-bg-base/95 backdrop-blur-md">
        <button onClick={onClose} className="p-1.5 hover:bg-bg-muted rounded-xl text-text-muted">
          <ArrowLeft size={18}/>
        </button>
        <div className="w-9 h-9 rounded-full bg-accent-purple/20 flex items-center justify-center flex-shrink-0">
          <Users size={16} className="text-accent-purple"/>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{group.name}</p>
          <p className="text-[10px] text-text-muted">{group.member_count} miembro{group.member_count !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowSettings(true)} className="p-1.5 hover:bg-bg-muted rounded-xl text-text-muted">
          <Settings size={16}/>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-text-muted text-xs text-center py-8">Sé el primero en escribir algo.</p>
        )}
        {messages.map((m, i) => {
          const isMe = m.sender_id === currentUserId;
          const showName = !isMe && (i === 0 || messages[i-1]?.sender_id !== m.sender_id);
          return (
            <div key={m.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {showName && (
                <p className="text-[10px] text-text-muted mb-0.5 px-1">{m.sender?.name}</p>
              )}
              <div className={`max-w-[78%] px-3.5 py-2 rounded-2xl text-sm leading-relaxed ${
                isMe
                  ? "bg-accent-purple text-white rounded-br-sm"
                  : "bg-bg-card border border-border/60 text-text-primary rounded-bl-sm"
              }`}>
                {m.media_url && m.media_type === "image" && (
                  <img src={m.media_url} alt="" className="rounded-lg max-h-48 mb-1 w-full object-cover" />
                )}
                {m.media_url && m.media_type === "video" && (
                  <video src={m.media_url} controls className="rounded-lg max-h-48 mb-1 w-full" />
                )}
                {m.media_url && m.media_type === "audio" && (
                  <audio src={m.media_url} controls className="h-8 mb-1" style={{ colorScheme: "dark" }}/>
                )}
                {m.content && <span>{m.content}</span>}
              </div>
              <p className={`text-[9px] text-text-muted mt-0.5 px-1`}>
                {timeAgo(m.created_at)}
              </p>
            </div>
          );
        })}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={sending}
        recipientName={group.name}
      />
    </div>
  );
}

// ── Groups List ────────────────────────────────────────────────
export function GroupsList({
  onSelectGroup,
}: { onSelectGroup: (g: any) => void }) {
  const [groups, setGroups]       = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading]     = useState(true);

  const load = () => {
    groupsApi.list().then(r => setGroups(r.data)).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-accent-purple"/>
          <h2 className="font-semibold text-sm">Grupos</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 text-xs text-accent-purple hover:opacity-80 transition-opacity"
        >
          <Plus size={14}/> Nuevo
        </button>
      </div>

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreated={g => { setGroups(prev => [g, ...prev]); setShowCreate(false); }}
        />
      )}

      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {loading && <p className="text-text-muted text-xs text-center py-8">Cargando…</p>}
        {!loading && groups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-12 px-6 text-center">
            <Users size={32} className="text-text-muted/40"/>
            <p className="text-text-muted text-sm">Aún no tenés grupos.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="text-xs text-accent-purple hover:underline"
            >
              Crear el primero
            </button>
          </div>
        )}
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => onSelectGroup(g)}
            className="w-full flex items-center gap-3 px-4 py-4 hover:bg-bg-muted/50 transition-colors text-left"
          >
            <div className="w-11 h-11 rounded-full bg-accent-purple/20 flex items-center justify-center flex-shrink-0">
              <Users size={18} className="text-accent-purple"/>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm truncate">{g.name}</p>
                {g.last_message_at && (
                  <p className="text-[10px] text-text-muted flex-shrink-0">{timeAgo(g.last_message_at)}</p>
                )}
              </div>
              <p className="text-xs text-text-muted truncate mt-0.5">
                {g.last_message_preview ?? `${g.member_count} miembro${g.member_count !== 1 ? "s" : ""}`}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main export: Groups section in Messages ────────────────────
export function GroupsSection() {
  const { user } = useAuthStore();
  const [activeGroup, setActiveGroup] = useState<any | null>(null);

  if (!user) return null;

  if (activeGroup) {
    return (
      <GroupChatWindow
        group={activeGroup}
        currentUserId={user.id}
        onClose={() => setActiveGroup(null)}
      />
    );
  }

  return <GroupsList onSelectGroup={setActiveGroup}/>;
}
