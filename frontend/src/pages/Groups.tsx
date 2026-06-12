import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Send, ArrowLeft, Crown, Settings, X, Pencil,
  UserMinus, ShieldCheck, ShieldOff, Trash2, UserPlus, Check, Search,
} from "lucide-react";
import { groupsApi, searchApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/store/toastStore";
import { BottomNav } from "@/components/BottomNav";

interface Group {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  member_count: number;
  last_message_at?: string;
  last_message_preview?: string;
  my_role?: string;
}

interface GroupMessage {
  id: string;
  content?: string;
  media_url?: string;
  sender_id: string;
  created_at: string;
  sender?: { id?: string; name: string; avatar?: string };
}

interface Member {
  user_id: string;
  role: string;
  name: string;
  avatar?: string;
}

// ── Lista de grupos ────────────────────────────────────────────────

export default function Groups() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [groups, setGroups]       = useState<Group[]>([]);
  const [loading, setLoading]     = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [showCreate, setShowCreate]   = useState(false);

  useEffect(() => {
    if (!user) return;
    groupsApi.list()
      .then(r => setGroups(Array.isArray(r.data) ? r.data : []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (!user) return null;

  if (activeGroup) {
    return (
      <GroupChat
        groupId={activeGroup}
        userId={user.id}
        onBack={() => setActiveGroup(null)}
        onGroupUpdated={g => setGroups(prev => prev.map(x => x.id === g.id ? { ...x, ...g } : x))}
        onGroupDeleted={id => { setGroups(prev => prev.filter(x => x.id !== id)); setActiveGroup(null); }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-bg-base text-text-primary flex flex-col">
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center justify-between">
        <h1
          className="text-sm tracking-[0.2em] uppercase"
          style={{ color: "var(--gold, #C9A227)", fontFamily: "var(--font-display, 'Cormorant Garamond', serif)" }}
        >
          Grupos
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
          style={{ background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)", color: "var(--gold, #C9A227)" }}
        >
          <Plus size={13} />
          Nuevo
        </button>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full pb-[80px]">
        {loading && (
          <div className="px-4 pt-8 text-center">
            <p className="text-xs text-text-muted">Cargando grupos...</p>
          </div>
        )}

        {!loading && groups.length === 0 && (
          <div className="px-4 pt-12 flex flex-col items-center gap-4 text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center"
              style={{ background: "rgba(201,162,39,0.08)", border: "1px solid rgba(201,162,39,0.2)" }}
            >
              <Users size={28} style={{ color: "rgba(201,162,39,0.5)" }} />
            </div>
            <div>
              <p className="text-sm font-semibold mb-1">Todavía no estás en ningún grupo</p>
              <p className="text-xs text-text-muted">Creá un grupo o esperá a que alguien te agregue.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="px-5 py-2.5 rounded-full text-xs font-medium"
              style={{ background: "var(--gold, #C9A227)", color: "#020207" }}
            >
              Crear grupo
            </button>
          </div>
        )}

        {!loading && groups.length > 0 && (
          <div className="divide-y divide-border/40">
            {groups.map(g => (
              <button
                key={g.id}
                onClick={() => setActiveGroup(g.id)}
                className="w-full flex items-center gap-3 px-4 py-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-lg font-light"
                  style={{
                    background: g.avatar_url ? `url(${g.avatar_url}) center/cover` : "rgba(201,162,39,0.1)",
                    border: "1px solid rgba(201,162,39,0.2)",
                    color: "var(--gold, #C9A227)",
                  }}
                >
                  {!g.avatar_url && g.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium truncate">{g.name}</span>
                    {g.my_role === "admin" && (
                      <Crown size={11} style={{ color: "var(--gold, #C9A227)", flexShrink: 0 }} />
                    )}
                  </div>
                  <p className="text-xs text-text-muted truncate mt-0.5">
                    {g.last_message_preview || g.description || `${g.member_count} miembros`}
                  </p>
                </div>
                <span className="text-[10px] text-text-muted flex-shrink-0">
                  {g.member_count} 👤
                </span>
              </button>
            ))}
          </div>
        )}
      </main>

      <BottomNav />

      {showCreate && (
        <CreateGroupModal
          onClose={() => setShowCreate(false)}
          onCreate={(g) => {
            setGroups(prev => [g, ...prev]);
            setShowCreate(false);
            setActiveGroup(g.id);
          }}
        />
      )}
    </div>
  );
}

// ── Crear grupo ────────────────────────────────────────────────────

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (g: Group) => void }) {
  const [name, setName]     = useState("");
  const [desc, setDesc]     = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await groupsApi.create({ name: name.trim(), description: desc.trim() || undefined });
      onCreate(data);
    } catch {
      toast.error("Error al crear el grupo.");
    }
    setLoading(false);
  }

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(2,2,7,0.85)", display: "flex", alignItems: "flex-end" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 500, margin: "0 auto", background: "#0e0e1a", borderRadius: "20px 20px 0 0", padding: "24px 20px 32px", fontFamily: "Manrope, sans-serif" }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ color: "#F5F1E8", fontSize: 16, fontWeight: 600 }}>Nuevo grupo</h3>
          <button onClick={onClose} style={{ color: "#666", background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        <input
          type="text" placeholder="Nombre del grupo" value={name}
          onChange={e => setName(e.target.value)} maxLength={60}
          style={{ width: "100%", padding: "12px 14px", marginBottom: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 10, color: "#F5F1E8", fontSize: 14, outline: "none", fontFamily: "Manrope, sans-serif", boxSizing: "border-box" }}
        />
        <textarea
          placeholder="Descripción (opcional)" value={desc}
          onChange={e => setDesc(e.target.value)} rows={2}
          style={{ width: "100%", padding: "12px 14px", marginBottom: 20, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 10, color: "#F5F1E8", fontSize: 13, outline: "none", resize: "none", fontFamily: "Manrope, sans-serif", boxSizing: "border-box" }}
        />
        <button
          onClick={submit} disabled={!name.trim() || loading}
          style={{ width: "100%", padding: "14px", borderRadius: 12, background: name.trim() ? "#C9A227" : "rgba(201,162,39,0.2)", border: "none", color: name.trim() ? "#020207" : "#666", fontSize: 14, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed", fontFamily: "Manrope, sans-serif" }}
        >
          {loading ? "Creando..." : "Crear grupo"}
        </button>
      </div>
    </div>
  );
}

// ── Chat del grupo ─────────────────────────────────────────────────

function GroupChat({
  groupId, userId, onBack, onGroupUpdated, onGroupDeleted,
}: {
  groupId: string;
  userId: string;
  onBack: () => void;
  onGroupUpdated: (g: Partial<Group> & { id: string }) => void;
  onGroupDeleted: (id: string) => void;
}) {
  const [group, setGroup]     = useState<{ id: string; name: string; description?: string; created_by?: string; members: Member[] } | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText]       = useState("");
  const [sending, setSending] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const myRole = group?.members.find(m => m.user_id === userId)?.role ?? "member";
  const isAdmin = myRole === "admin";

  useEffect(() => {
    groupsApi.get(groupId).then(r => setGroup(r.data)).catch(() => {});
    groupsApi.messages(groupId, { limit: 50 })
      .then(r => setMessages((r.data.messages || []).reverse()))
      .catch(() => {});
  }, [groupId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMsg() {
    if (!text.trim() || sending) return;
    setSending(true);
    const content = text.trim();
    setText("");
    try {
      const { data } = await groupsApi.sendMessage(groupId, { content });
      setMessages(prev => [...prev, data]);
    } catch { setText(content); }
    setSending(false);
  }

  function handleGroupUpdated(updated: typeof group) {
    if (!updated) return;
    setGroup(updated);
    onGroupUpdated({ id: groupId, name: updated.name, description: updated.description });
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0"
            style={{ background: "rgba(201,162,39,0.1)", color: "var(--gold, #C9A227)" }}
          >
            {group?.name.charAt(0).toUpperCase() || "G"}
          </div>
          <div>
            <p className="text-sm font-medium leading-none">{group?.name || "Grupo"}</p>
            <p className="text-[10px] text-text-muted mt-0.5">
              {group?.members.length || 0} miembros verificados
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 rounded-xl text-text-muted hover:text-text-primary hover:bg-bg-muted transition-colors"
        >
          <Settings size={18} />
        </button>
      </header>

      {/* Mensajes */}
      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-[100px]">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <p className="text-xs text-text-muted">Todavía no hay mensajes. ¡Empezá la conversación!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"} items-end gap-2`}>
              {!isMe && (
                <div className="w-6 h-6 rounded-full flex-shrink-0 overflow-hidden bg-white/5 flex items-center justify-center text-[10px] text-text-muted">
                  {msg.sender?.avatar
                    ? <img src={msg.sender.avatar} alt="" className="w-full h-full object-cover" />
                    : msg.sender?.name.charAt(0).toUpperCase()
                  }
                </div>
              )}
              <div
                style={{
                  maxWidth: "75%", padding: "8px 12px",
                  borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: isMe ? "var(--gold, #C9A227)" : "rgba(255,255,255,0.06)",
                  color: isMe ? "#020207" : "#F5F1E8",
                  fontSize: 13, lineHeight: 1.5,
                }}
              >
                {!isMe && msg.sender && (
                  <p style={{ fontSize: 10, fontWeight: 600, opacity: 0.6, marginBottom: 2 }}>
                    {msg.sender.name}
                  </p>
                )}
                {msg.content && <p>{msg.content}</p>}
                {msg.media_url && <img src={msg.media_url} alt="" style={{ maxWidth: "100%", borderRadius: 8, marginTop: 4 }} />}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </main>

      {/* Input */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-bg-base border-t border-border px-4 py-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      >
        <div className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text" value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMsg())}
            placeholder="Escribí algo..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 20, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#F5F1E8", fontSize: 14, outline: "none", fontFamily: "Manrope, sans-serif" }}
          />
          <button
            onClick={sendMsg} disabled={!text.trim() || sending}
            style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: text.trim() ? "var(--gold, #C9A227)" : "rgba(255,255,255,0.08)", color: text.trim() ? "#020207" : "#555", display: "flex", alignItems: "center", justifyContent: "center", cursor: text.trim() ? "pointer" : "not-allowed", transition: "all 0.15s" }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      {/* Panel de configuración */}
      {showSettings && group && (
        <GroupSettings
          group={group}
          userId={userId}
          isAdmin={isAdmin}
          onClose={() => setShowSettings(false)}
          onUpdated={handleGroupUpdated}
          onDeleted={() => onGroupDeleted(groupId)}
          onLeft={() => onBack()}
        />
      )}
    </div>
  );
}

// ── Panel de configuración del grupo ──────────────────────────────

function GroupSettings({
  group, userId, isAdmin, onClose, onUpdated, onDeleted, onLeft,
}: {
  group: { id: string; name: string; description?: string; created_by?: string; members: Member[] };
  userId: string;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: (g: typeof group) => void;
  onDeleted: () => void;
  onLeft: () => void;
}) {
  const [name, setName]       = useState(group.name);
  const [desc, setDesc]       = useState(group.description ?? "");
  const [editingName, setEditingName] = useState(false);
  const [members, setMembers] = useState<Member[]>(group.members);
  const [saving, setSaving]   = useState(false);

  // Búsqueda para agregar miembro
  const [showAddMember, setShowAddMember] = useState(false);
  const [addQuery, setAddQuery]           = useState("");
  const [addResults, setAddResults]       = useState<{ id: string; name: string; avatar?: string }[]>([]);
  const [addLoading, setAddLoading]       = useState(false);
  const addDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (addDebounce.current) clearTimeout(addDebounce.current);
    if (addQuery.trim().length < 2) { setAddResults([]); return; }
    setAddLoading(true);
    addDebounce.current = setTimeout(async () => {
      try {
        const { data } = await searchApi.search(addQuery.trim(), 10);
        const memberIds = new Set(members.map(m => m.user_id));
        setAddResults(
          (data.users || [])
            .filter((u: any) => !memberIds.has(u.id))
            .map((u: any) => ({ id: u.id, name: u.name || `${u.first_name || ""} ${u.last_name || ""}`.trim(), avatar: u.avatar || u.profile_photo_url }))
        );
      } catch { setAddResults([]); }
      setAddLoading(false);
    }, 300);
  }, [addQuery, members]);

  async function addMember(u: { id: string; name: string; avatar?: string }) {
    try {
      await groupsApi.addMember(group.id, u.id);
      const newMember: Member = { user_id: u.id, role: "member", name: u.name, avatar: u.avatar };
      const updated = [...members, newMember];
      setMembers(updated);
      onUpdated({ ...group, members: updated });
      setAddQuery("");
      setAddResults([]);
      setShowAddMember(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "No se pudo agregar.");
    }
  }

  async function saveName() {
    if (!name.trim() || name.trim() === group.name) { setEditingName(false); return; }
    setSaving(true);
    try {
      const { data } = await groupsApi.update(group.id, { name: name.trim(), description: desc.trim() || undefined });
      onUpdated({ ...group, ...data, members });
      setEditingName(false);
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Error al guardar.");
    }
    setSaving(false);
  }

  async function promoteOrDemote(m: Member) {
    const newRole = m.role === "admin" ? "member" : "admin";
    try {
      await groupsApi.setMemberRole(group.id, m.user_id, newRole);
      const updated = members.map(x => x.user_id === m.user_id ? { ...x, role: newRole } : x);
      setMembers(updated);
      onUpdated({ ...group, members: updated });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "No se pudo cambiar el rol.");
    }
  }

  async function kickMember(m: Member) {
    if (!confirm(`¿Expulsar a ${m.name}?`)) return;
    try {
      await groupsApi.removeMember(group.id, m.user_id);
      const updated = members.filter(x => x.user_id !== m.user_id);
      setMembers(updated);
      onUpdated({ ...group, members: updated });
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "Error al expulsar.");
    }
  }

  async function leaveGroup() {
    if (!confirm("¿Salir del grupo?")) return;
    try {
      await groupsApi.removeMember(group.id, userId);
      onLeft();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "No se pudo salir del grupo.");
    }
  }

  async function deleteGroup() {
    if (!confirm(`¿Eliminar el grupo "${group.name}"? Esta acción no se puede deshacer.`)) return;
    try {
      await groupsApi.delete(group.id);
      onDeleted();
    } catch (e: any) {
      toast.error(e?.response?.data?.detail ?? "No se pudo eliminar el grupo.");
    }
  }

  const isCreator = group.created_by === userId;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(2,2,7,0.85)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-bg-card border-t border-border rounded-t-2xl overflow-hidden"
        style={{ maxHeight: "85vh", display: "flex", flexDirection: "column" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <p className="font-semibold text-sm">Info del grupo</p>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text-primary">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 pb-8">
          {/* Nombre editable */}
          <div className="px-5 py-4 border-b border-border">
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2">Nombre</p>
            {editingName ? (
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && saveName()}
                  maxLength={60}
                  autoFocus
                  className="flex-1 bg-bg-muted border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-600/50"
                />
                <button
                  onClick={saveName}
                  disabled={saving}
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: "var(--gold, #C9A227)" }}
                >
                  <Check size={15} style={{ color: "#020207" }} />
                </button>
                <button
                  onClick={() => { setName(group.name); setEditingName(false); }}
                  className="w-9 h-9 rounded-xl bg-bg-muted flex items-center justify-center"
                >
                  <X size={14} className="text-text-muted" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{name}</p>
                {isAdmin && (
                  <button onClick={() => setEditingName(true)} className="p-1.5 text-text-muted hover:text-text-primary">
                    <Pencil size={14} />
                  </button>
                )}
              </div>
            )}
            {group.description && !editingName && (
              <p className="text-xs text-text-muted mt-1">{group.description}</p>
            )}
          </div>

          {/* Miembros */}
          <div className="px-5 py-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-text-muted uppercase tracking-widest">
                Miembros · {members.length}
              </p>
              {isAdmin && (
                <button
                  onClick={() => setShowAddMember(v => !v)}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-1 rounded-full transition-colors"
                  style={{ background: "rgba(201,162,39,0.1)", color: "var(--gold,#C9A227)", border: "1px solid rgba(201,162,39,0.25)" }}
                >
                  <UserPlus size={10} /> Agregar
                </button>
              )}
            </div>

            {/* Buscador de usuarios para agregar */}
            {showAddMember && (
              <div className="mb-3">
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-bg-muted border border-border mb-1">
                  <Search size={13} className="text-text-muted flex-shrink-0" />
                  <input
                    value={addQuery}
                    onChange={e => setAddQuery(e.target.value)}
                    placeholder="Buscar usuario por nombre…"
                    autoFocus
                    className="flex-1 bg-transparent outline-none text-sm placeholder:text-text-muted/60"
                    style={{ fontSize: "16px" }}
                  />
                  {addLoading && <div className="w-3 h-3 border-2 border-accent-purple/30 border-t-accent-purple rounded-full animate-spin flex-shrink-0" />}
                  {addQuery && !addLoading && (
                    <button onClick={() => { setAddQuery(""); setAddResults([]); }} className="text-text-muted">
                      <X size={12} />
                    </button>
                  )}
                </div>
                {addResults.length > 0 && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    {addResults.map(u => (
                      <button
                        key={u.id}
                        onClick={() => addMember(u)}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-bg-muted transition-colors text-left border-b border-border/50 last:border-0"
                      >
                        <div className="w-7 h-7 rounded-full overflow-hidden bg-bg-muted flex-shrink-0 flex items-center justify-center text-xs text-text-muted">
                          {u.avatar
                            ? <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                            : u.name.charAt(0).toUpperCase()
                          }
                        </div>
                        <span className="text-sm truncate">{u.name}</span>
                        <UserPlus size={12} className="text-text-muted ml-auto flex-shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
                {addQuery.trim().length >= 2 && !addLoading && addResults.length === 0 && (
                  <p className="text-xs text-text-muted text-center py-2">Sin resultados</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              {members.map(m => {
                const isMe = m.user_id === userId;
                return (
                  <div key={m.user_id} className="flex items-center gap-3">
                    {/* Avatar */}
                    <div
                      className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center text-xs text-text-muted bg-bg-muted"
                      style={{ border: m.role === "admin" ? "1.5px solid var(--gold, #C9A227)" : "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {m.avatar
                        ? <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                        : m.name.charAt(0).toUpperCase()
                      }
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm truncate">{m.name}{isMe ? " (vos)" : ""}</span>
                        {m.role === "admin" && (
                          <Crown size={10} style={{ color: "var(--gold, #C9A227)", flexShrink: 0 }} />
                        )}
                      </div>
                      <p className="text-[10px] text-text-muted">{m.role === "admin" ? "Admin" : "Miembro"}</p>
                    </div>

                    {/* Acciones de admin (no sobre sí mismo) */}
                    {isAdmin && !isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => promoteOrDemote(m)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-bg-muted transition-colors"
                          title={m.role === "admin" ? "Quitar admin" : "Hacer admin"}
                        >
                          {m.role === "admin" ? <ShieldOff size={13} /> : <ShieldCheck size={13} />}
                        </button>
                        <button
                          onClick={() => kickMember(m)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-text-muted hover:text-status-error transition-colors"
                          title="Expulsar"
                        >
                          <UserMinus size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Acciones peligrosas */}
          <div className="px-5 pt-2 space-y-2 border-t border-border">
            <button
              onClick={leaveGroup}
              className="w-full flex items-center gap-3 py-3 text-sm text-text-muted hover:text-status-error transition-colors"
            >
              <ArrowLeft size={15} />
              Salir del grupo
            </button>
            {isCreator && (
              <button
                onClick={deleteGroup}
                className="w-full flex items-center gap-3 py-3 text-sm text-status-error hover:opacity-80 transition-opacity"
              >
                <Trash2 size={15} />
                Eliminar grupo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
