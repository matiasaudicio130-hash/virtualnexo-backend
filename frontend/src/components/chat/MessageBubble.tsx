/**
 * MessageBubble — renderiza un mensaje con soporte para:
 * imagen · video · audio · gif · vista única · reply · reacciones
 */
import { useState } from "react";
import {
  Eye, EyeOff, Play, Mic, MoreVertical,
  Reply, Trash2, Image as ImageIcon,
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

/* ── Media renderer ─────────────────────────────────────── */
function MediaContent({ msg, isMe }: { msg: any; isMe: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [viewed, setViewed]     = useState(!!msg.viewed_at);

  if (!msg.media_url) return null;

  const mime = msg.media_type || "image";

  // Vista única no vista
  if (msg.view_once && !viewed && !isMe) {
    return (
      <button
        onClick={async () => {
          await messagingV2Api.markViewOnce(msg.id);
          setViewed(true);
        }}
        className="flex items-center gap-2 py-2 text-sm text-accent-purple hover:text-accent-purple/80 transition-colors"
      >
        <Eye size={16}/>
        <span>Toca para ver · Vista única</span>
      </button>
    );
  }

  // Vista única expirada
  if (msg.view_once && (viewed || isMe && msg.viewed_at)) {
    return (
      <div className="flex items-center gap-2 py-1.5 text-xs text-text-muted italic">
        <EyeOff size={13}/>
        <span>{isMe ? "Vista única — vista por el destinatario" : "Vista única — expirada"}</span>
      </div>
    );
  }

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

  // Imagen / GIF
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

  // Imagen expandida
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center"
      onClick={() => setExpanded(false)}>
      <img
        src={msg.media_url}
        alt="media"
        draggable={false}
        onContextMenu={e => e.preventDefault()}
        className="max-w-full max-h-full object-contain select-none pointer-events-none"
        style={{ touchAction: "none" }}
      />
      <button onClick={() => setExpanded(false)}
        className="absolute top-safe right-4 mt-4 p-2 bg-black/50 rounded-full text-white">
        ✕
      </button>
    </div>
  );
}

/* ── Main bubble ─────────────────────────────────────────── */
export function MessageBubble({ msg, isMe, currentUserId, onDelete, onReply, onReload }: Props) {
  const [showActions, setShowActions] = useState(false);
  const deleted = msg.deleted_for_all;
  const hasMedia = !!msg.media_url;
  const isAudio  = msg.media_type === "audio";
  const isImage  = msg.media_type === "image" || (!msg.media_type && hasMedia);

  async function handleReact(emoji: string) {
    await messagingV2Api.reactMessage(msg.id, emoji);
    setShowActions(false);
    onReload();
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
      className={`flex ${isMe ? "justify-end" : "justify-start"} mb-1 group`}
      onTouchStart={() => setShowActions(false)}
    >
      <div className={`relative max-w-[78%] ${isMe ? "items-end" : "items-start"} flex flex-col`}>

        {/* Reply context */}
        {msg.reply_to_id && (
          <div className={`text-[10px] mb-1 px-3 py-1 rounded-lg bg-bg-muted/40 border-l-2 border-accent-purple/50 ${isMe ? "self-end" : "self-start"}`}>
            Respondiendo a un mensaje
          </div>
        )}

        <div className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : "flex-row"}`}>

          {/* Action button */}
          <button
            onClick={() => setShowActions(v => !v)}
            className="p-1 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mb-1"
          >
            <MoreVertical size={13}/>
          </button>

          {/* Bubble */}
          <div className={`relative rounded-2xl overflow-hidden ${
            isMe ? "rounded-br-sm" : "rounded-bl-sm"
          } ${
            isImage ? "p-0" : isAudio
              ? `px-3 py-2.5 ${isMe ? "bg-accent-purple" : "bg-bg-card border border-border"}`
              : `px-4 py-2.5 ${isMe ? "bg-accent-purple text-white" : "bg-bg-card border border-border text-text-primary"}`
          }`}>

            <MediaContent msg={msg} isMe={isMe}/>

            {/* Text content (if any alongside media, or text-only) */}
            {(!hasMedia || (hasMedia && msg.content && !["📷 Foto","📹 Video","🎤 Audio","GIF"].includes(msg.content))) && (
              <p className={`text-sm leading-relaxed ${isImage ? "px-4 pt-2 pb-1" : ""} ${isMe ? "text-white" : "text-text-primary"}`}>
                {msg.content}
              </p>
            )}

            {/* Timestamp + status */}
            <p className={`text-[10px] flex items-center gap-1 mt-0.5 ${
              isImage ? "px-4 pb-2 pt-0" : ""
            } ${isMe ? "text-white/55 justify-end" : "text-text-muted justify-start"}`}>
              {timeAgo(msg.created_at)}
              {msg.view_once && <span className="text-amber-400">· 1×</span>}
              {isMe && msg.read_at  && <span className="text-white/80">✓✓</span>}
              {isMe && !msg.read_at && <span className="text-white/40">✓</span>}
            </p>
          </div>
        </div>

        {/* Action panel — emoji + delete + reply */}
        {showActions && (
          <div
            className={`mt-1.5 flex items-center gap-1 p-1.5 bg-bg-card border border-border rounded-2xl shadow-lg animate-fade-in ${isMe ? "self-end" : "self-start"}`}
            onClick={e => e.stopPropagation()}
          >
            {EMOJIS.map(e => (
              <button key={e} onClick={() => handleReact(e)}
                className="text-base hover:scale-125 transition-transform p-0.5">
                {e}
              </button>
            ))}
            <div className="w-px h-4 bg-border mx-0.5"/>
            <button onClick={() => { onReply(msg); setShowActions(false); }}
              className="p-1 text-text-muted hover:text-accent-purple transition-colors">
              <Reply size={14}/>
            </button>
            {isMe && (
              <>
                <button onClick={() => { onDelete(msg.id, false); setShowActions(false); }}
                  className="p-1 text-text-muted hover:text-status-error transition-colors" title="Borrar para mí">
                  <Trash2 size={14}/>
                </button>
                <button onClick={() => { onDelete(msg.id, true); setShowActions(false); }}
                  className="text-[10px] text-status-error/70 hover:text-status-error px-1 leading-none" title="Borrar para todos">
                  ×todos
                </button>
              </>
            )}
          </div>
        )}

        {/* Existing reactions */}
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
