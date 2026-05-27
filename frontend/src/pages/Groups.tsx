import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Users, Plus, Send, ArrowLeft, Crown } from "lucide-react";
import { groupsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
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
  sender?: { name: string; avatar?: string };
}

interface Member {
  user_id: string;
  role: string;
  name: string;
  avatar?: string;
}

export default function Groups() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

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

function CreateGroupModal({ onClose, onCreate }: { onClose: () => void; onCreate: (g: Group) => void }) {
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setLoading(true);
    try {
      const { data } = await groupsApi.create({ name: name.trim(), description: desc.trim() || undefined });
      onCreate(data);
    } catch {
      alert("Error al crear el grupo.");
    }
    setLoading(false);
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(2,2,7,0.85)", display: "flex", alignItems: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 500, margin: "0 auto",
          background: "#0e0e1a", borderRadius: "20px 20px 0 0",
          padding: "24px 20px 32px", fontFamily: "Manrope, sans-serif",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <h3 style={{ color: "#F5F1E8", fontSize: 16, fontWeight: 600 }}>Nuevo grupo</h3>
          <button onClick={onClose} style={{ color: "#666", background: "none", border: "none", fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>

        <input
          type="text"
          placeholder="Nombre del grupo"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={60}
          style={{
            width: "100%", padding: "12px 14px", marginBottom: 12,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)",
            borderRadius: 10, color: "#F5F1E8", fontSize: 14, outline: "none",
            fontFamily: "Manrope, sans-serif", boxSizing: "border-box",
          }}
        />
        <textarea
          placeholder="Descripción (opcional)"
          value={desc}
          onChange={e => setDesc(e.target.value)}
          rows={2}
          style={{
            width: "100%", padding: "12px 14px", marginBottom: 20,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)",
            borderRadius: 10, color: "#F5F1E8", fontSize: 13, outline: "none", resize: "none",
            fontFamily: "Manrope, sans-serif", boxSizing: "border-box",
          }}
        />

        <button
          onClick={submit}
          disabled={!name.trim() || loading}
          style={{
            width: "100%", padding: "14px", borderRadius: 12,
            background: name.trim() ? "#C9A227" : "rgba(201,162,39,0.2)",
            border: "none", color: name.trim() ? "#020207" : "#666",
            fontSize: 14, fontWeight: 700, cursor: name.trim() ? "pointer" : "not-allowed",
            fontFamily: "Manrope, sans-serif",
          }}
        >
          {loading ? "Creando..." : "Crear grupo"}
        </button>
      </div>
    </div>
  );
}

function GroupChat({ groupId, userId, onBack }: { groupId: string; userId: string; onBack: () => void }) {
  const [group, setGroup] = useState<{ name: string; members: Member[] } | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <header className="sticky top-0 z-20 bg-bg-base/90 backdrop-blur-md border-b border-border px-4 pt-safe-3 pb-3 flex items-center gap-3">
        <button onClick={onBack} className="text-text-muted hover:text-text-primary transition-colors">
          <ArrowLeft size={20} />
        </button>
        <button
          onClick={() => setShowMembers(v => !v)}
          className="flex-1 flex items-center gap-2 text-left"
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-sm"
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
        </button>
      </header>

      {showMembers && group && (
        <div className="bg-bg-card border-b border-border px-4 py-3">
          <p className="text-xs text-text-muted mb-2">Miembros</p>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {group.members.map(m => (
              <div key={m.user_id} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div
                  className="w-9 h-9 rounded-full overflow-hidden border"
                  style={{ borderColor: m.role === "admin" ? "var(--gold, #C9A227)" : "rgba(255,255,255,0.1)" }}
                >
                  {m.avatar
                    ? <img src={m.avatar} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-white/5 flex items-center justify-center text-xs text-text-muted">
                        {m.name.charAt(0)}
                      </div>
                  }
                </div>
                <span className="text-[9px] text-text-muted truncate max-w-[48px]">{m.name.split(" ")[0]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 py-3 space-y-3 pb-[100px]">
        {messages.length === 0 && (
          <div className="text-center pt-8">
            <p className="text-xs text-text-muted">Todavía no hay mensajes. ¡Empezá la conversación!</p>
          </div>
        )}
        {messages.map(msg => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                style={{
                  maxWidth: "75%", padding: "8px 12px", borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
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

      <div
        className="fixed bottom-0 left-0 right-0 bg-bg-base border-t border-border px-4 py-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 12px)" }}
      >
        <div className="flex gap-2 max-w-lg mx-auto">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMsg())}
            placeholder="Escribí algo..."
            style={{
              flex: 1, padding: "10px 14px", borderRadius: 20,
              background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
              color: "#F5F1E8", fontSize: 14, outline: "none", fontFamily: "Manrope, sans-serif",
            }}
          />
          <button
            onClick={sendMsg}
            disabled={!text.trim() || sending}
            style={{
              width: 40, height: 40, borderRadius: "50%", border: "none",
              background: text.trim() ? "var(--gold, #C9A227)" : "rgba(255,255,255,0.08)",
              color: text.trim() ? "#020207" : "#555",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: text.trim() ? "pointer" : "not-allowed", transition: "all 0.15s",
            }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
