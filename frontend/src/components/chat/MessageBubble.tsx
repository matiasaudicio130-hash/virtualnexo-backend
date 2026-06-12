/**
 * MessageBubble — renderiza un mensaje con soporte para:
 * imagen · video · audio · gif · vista única · reply · reacciones · edición
 */
import { useState, useRef, useEffect } from "react";
import {
  Eye, EyeOff, MoreVertical,
  Reply, Trash2, Pencil,
} from "lucide-react";
import { AudioPlayer } from "./AudioRecorder";
import { messagingV2Api } from "@/lib/api";

const EMOJIS = ["❤️", "🔥", "😮", "😂", "👍", "👎"];

interface Props {
  msg:           any;
  isMe:          boolean;
  currentUserId: string;
  onDelete:      (id: string, forAll: boolean) => void;
  onReply:       (msg: any) => void;
  onReload:      () => void;
}

function timeAgo(iso: string) {
  const d = Date.now() - new Date(iso).getTime();
  const m = Math.floor(d / 60000);
  if (m < 1)  return "ahora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

/* ── Vista única ─────────────────────────────────────────── */
function ViewOnceContent({ msg, isMe }: { msg: any; isMe: boolean }) {
  // idle → viewing → expired
  const [viewState, setViewState] = useState<"idle" | "viewing" | "expired">(() =>
    msg.viewed_at ? "expired" : "idle"
  );

  if (isMe) {
    return (
      <div className="flex items-center gap-2 py-1.5 text-xs text-white/60 italic">
        <EyeOff size={13}/>
        <span>{msg.viewed_at ? "Vista por el destinatario" : "Vista única — enviada"}</span>
      </div>
    );
  }

  if (viewState === "idle") {
    return (
      <button
        onClick={async (e) => {
          e.stopPropagation();
          try { await messagingV2Api.markViewOnce(msg.id); } catch {}
          setViewState("viewing");
        }}
        className="flex items-center gap-2 py-2 text-sm text-accent-purple active:text-accent-purple/70 transition-colors"
      >
        <Eye size={16}/>
        <span>Toca para ver · Vista única</span>
      </button>
    );
  }

  if (viewState === "viewing") {
    return (
      <div
        className="fixed inset-0 z-[200] bg-black/96 flex items-center justify-center"
        onClick={() => setViewState("expired")}
      >
        <img
          src={msg.media_url}
          alt="vista única"
          draggable={false}
          onContextMenu={e => e.preventDefault()}
          className="max-w-[90vw] max-h-[80vh] object-contain select-none"
          style={{ touchAction: "none" }}
        />
        <button
          onClick={() => setViewState("expired")}
          className="absolute top-4 right-4 w-9 h-9 bg-black/60 rounded-full flex items-center justify-center text-white text-lg"
        >
          ✕
        </button>
        <p className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/50 text-xs text-center px-4">
          Toca para cerrar · Esta foto no se podrá ver de nuevo
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-1.5 text-xs text-text-muted italic">
      <EyeOff size={13}/>
      <span>Vista única — expirada</span>
    </div>
  );
}

/* ── Media renderer ─────────────────────────────────────── */
function MediaContent({ msg, isMe }: { msg: any; isMe: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (!msg.media_url) return null;

  if (msg.view_once) {
    return <ViewOnceContent msg={msg} isMe={isMe}/>;
  }

  const mime = msg.type || "image";

  if (mime === "audio") {
    return <AudioPlayer url={msg.media_url} duration={msg.audio_duration}/>;
  }

  if (mime === "video") {
    return (
      <div className="relative rounded-xl overflow-hidden max-w-[220px]">
        <video
          src={msg.media_url}
          controls
          preload="metadata"
          className="w-full max-h-48 object-cover"
          onContextMenu={e => e.preventDefault()}
          draggable={false}
        />
      </div>
    );
  }

  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)} className="rounded-xl overflow-hidden block max-w-[220px]">
        <img
          src={msg.media_url}
          alt="media"
          draggable={false}
          onContextMenu={e => e.preventDefault()}
          className="w-full max-h-52 object-cover select-none pointer-events-none"
        />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={() => setExpanded(false)}
    >
      <img
        src={msg.media_url}
        alt="media"
        draggable={false}
        onContextMenu={e => e.preventDefault()}
        className="max-w-full max-h-full object-contain select-none pointer-events-none"
        style={{ touchAction: "none" }}
      />
      <button
        onClick={() => setExpanded(false)}
        className="absolute top-4 right-4 w-9 h-9 bg-black/50 rounded-full flex items-center justify-center text-white"
      >
        ✕
      </button>
    </div>
  );
}

/* ── Main bubble ─────────────────────────────────────────── */
export function MessageBubble({ msg, isMe, currentUserId, onDelete, onReply, onReload }: Props) {
  const [showActions, setShowActions] = useState(false);
  const [editing, setEditing]         = useState(false);
  const [editText, setEditText]       = useState(msg.content || "");
  const [savingEdit, setSavingEdit]   = useState(false);
  const bubbleRef                     = useRef<HTMLDivElement>(null);
  const longPressTimer                = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggered            = useRef(false);

  const deleted = msg.deleted_for_all;
  const hasMedia = !!msg.media_url;
  const isAudio  = msg.type === "audio";
  const isImage  = msg.type === "image" || (!msg.type && hasMedia);
  const isText   = !hasMedia && msg.type !== "audio";

  // Cierra el panel de acciones al tocar fuera
  useEffect(() => {
    if (!showActions) return;
    const handler = (e: MouseEvent | TouchEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowActions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showActions]);

  function startLongPress() {
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      setShowActions(v => !v);
      navigator.vibrate?.(40);
    }, 480);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  async function handleReact(emoji: string) {
    await messagingV2Api.reactMessage(msg.id, emoji);
    setShowActions(false);
    onReload();
  }

  async function saveEdit() {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === msg.content) { setEditing(false); return; }
    setSavingEdit(true);
    try {
      await messagingV2Api.editMessage(msg.id, trimmed);
      onReload();
    } catch {}
    setSavingEdit(false);
    setEditing(false);
  }

  if (deleted) {
    return (
      <div className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1`}>
        <p className="text-xs text-text-muted italic px-4 py-2">
          {isMe ? "Eliminaste este mensaje" : "Mensaje eliminado"}
        </p>
      </div>
    );
  }

  return (
    <div
      ref={bubbleRef}
      className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 group`}
    >
      <div className={`relative max-w-[78%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>

        {/* Reply context */}
        {msg.reply_to_id && (
          <div className={`text-[10px] mb-1 px-3 py-1 rounded-lg bg-bg-muted/40 border-l-2 border-accent-purple/50 ${isMe ? "self-end" : "self-start"}`}>
            Respondiendo a un mensaje
          </div>
        )}

        <div className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>

          {/* MoreVertical — solo visible en desktop por hover */}
          <button
            onClick={() => setShowActions(v => !v)}
            className="p-1 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mb-1 hidden sm:flex"
          >
            <MoreVertical size={13}/>
          </button>

          {/* Burbuja — long press en mobile para mostrar acciones */}
          <div
            className={`relative rounded-2xl overflow-hidden select-none ${
              isMe ? "rounded-br-sm shadow-md" : "rounded-bl-sm shadow-sm"
            } ${
              isImage ? "p-0" : isAudio
                ? `px-3 py-2.5 ${isMe ? "" : "bg-bg-card border border-border"}`
                : `px-4 py-2.5 ${isMe ? "" : "bg-bg-card border border-border text-text-primary"}`
            }`}
            style={isMe && !isImage ? {
              background: "var(--gradient-brand, linear-gradient(135deg,#C9A227,#FFE566))",
              color: "var(--obsidian,#020207)",
            } : undefined}
            onTouchStart={startLongPress}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
            onMouseDown={startLongPress}
            onMouseUp={cancelLongPress}
            onMouseLeave={cancelLongPress}
            onContextMenu={e => e.preventDefault()}
            onClick={() => {
              if (longPressTriggered.current) {
                longPressTriggered.current = false;
              } else if (showActions) {
                setShowActions(false);
              }
            }}
          >
            <MediaContent msg={msg} isMe={isMe}/>

            {/* Modo edición inline */}
            {editing ? (
              <div className="flex flex-col gap-1.5 py-1 min-w-[160px]">
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveEdit(); }
                    if (e.key === "Escape") { setEditing(false); setEditText(msg.content); }
                  }}
                  autoFocus
                  rows={2}
                  className="bg-black/10 rounded-lg px-2 py-1 text-sm resize-none outline-none w-full"
                  style={{ color: "var(--obsidian,#020207)" }}
                  onClick={e => e.stopPropagation()}
                  onMouseDown={e => e.stopPropagation()}
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={e => { e.stopPropagation(); setEditing(false); setEditText(msg.content); }}
                    className="text-[10px] opacity-50 hover:opacity-80"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); saveEdit(); }}
                    disabled={savingEdit}
                    className="text-[10px] font-semibold disabled:opacity-50"
                  >
                    {savingEdit ? "…" : "Guardar"}
                  </button>
                </div>
              </div>
            ) : (
              /* Texto del mensaje */
              (!hasMedia || (hasMedia && msg.content && !["📷 Foto","📹 Video","🎤 Audio","GIF"].includes(msg.content))) && (
                <p className={`text-sm leading-relaxed ${isImage ? "px-4 pt-2 pb-1" : ""} ${isMe ? "" : "text-text-primary"}`}>
                  {msg.content}
                  {msg.edited_at && (
                    <span className={`text-[9px] ml-1 opacity-50`}>(editado)</span>
                  )}
                </p>
              )
            )}

            {/* Hora + checks de lectura */}
            {!editing && (
              <p className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${
                isImage ? "px-4 pb-2 pt-0" : ""
              } ${isMe ? "opacity-60 justify-end" : "text-text-muted justify-start"}`}>
                {timeAgo(msg.created_at)}
                {msg.view_once && <span className={`ml-0.5 ${isMe ? "" : "text-amber-400"}`}>· 1×</span>}
                {isMe && (
                  <span
                    className={`ml-1.5 text-[11px] font-bold leading-none tracking-tighter ${
                      msg.read_at ? "text-[#0ea5e9]" : "opacity-50"
                    }`}
                    title={msg.read_at ? "Leído" : "Entregado"}
                  >
                    {msg.read_at ? "✓✓" : "✓"}
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Panel de acciones — aparece al sostener o clic en ··· */}
        {showActions && (
          <div
            className={`mt-1.5 flex items-center gap-0.5 p-1.5 bg-bg-card border border-border rounded-2xl shadow-lg animate-fade-in z-10 ${
              isMe ? "self-end" : "self-start"
            }`}
            onClick={e => e.stopPropagation()}
            onTouchStart={e => e.stopPropagation()}
            onMouseDown={e => e.stopPropagation()}
          >
            {/* Emojis solo para mensajes recibidos — no tiene sentido reaccionar a los propios */}
            {!isMe && EMOJIS.map(e => (
              <button
                key={e}
                onClick={() => handleReact(e)}
                className="text-base active:scale-125 transition-transform p-0.5 touch-manipulation"
              >
                {e}
              </button>
            ))}
            {!isMe && <div className="w-px h-4 bg-border mx-1"/>}

            <button
              onClick={() => { onReply(msg); setShowActions(false); }}
              className="p-1.5 text-text-muted hover:text-accent-purple active:text-accent-purple transition-colors touch-manipulation"
              title="Responder"
            >
              <Reply size={14}/>
            </button>

            {isMe && isText && !msg.view_once && (
              <button
                onClick={() => { setEditing(true); setShowActions(false); }}
                className="p-1.5 text-text-muted hover:text-accent-purple active:text-accent-purple transition-colors touch-manipulation"
                title="Editar"
              >
                <Pencil size={14}/>
              </button>
            )}

            {isMe && (
              <>
                <button
                  onClick={() => { onDelete(msg.id, false); setShowActions(false); }}
                  className="p-1.5 text-text-muted hover:text-status-error active:text-status-error transition-colors touch-manipulation"
                  title="Borrar para mí"
                >
                  <Trash2 size={14}/>
                </button>
                <button
                  onClick={() => { onDelete(msg.id, true); setShowActions(false); }}
                  className="text-[10px] text-status-error/70 hover:text-status-error active:text-status-error px-1.5 py-1 leading-none touch-manipulation"
                  title="Borrar para todos"
                >
                  ×todos
                </button>
              </>
            )}
          </div>
        )}

        {/* Reacciones existentes */}
        {msg.reactions?.length > 0 && (
          <div className={`flex gap-0.5 mt-0.5 ${isMe ? "self-end" : "self-start"}`}>
            {msg.reactions.map((r: any, i: number) => (
              <span key={i} className="text-xs bg-bg-muted rounded-full px-1.5 py-0.5 border border-border/40">
                {r.emoji}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
