/**
 * ChatInput — barra de entrada de mensajes moderna.
 * Features: emoji picker · adjuntar foto/video · grabación audio ·
 *           GIFs · vista única · reply context · envío por Enter.
 */
import { useState, useRef, useCallback } from "react";
import {
  Smile, Paperclip, Mic, Send, X, Image as ImageIcon,
  Video, Film, Eye, EyeOff,
} from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { GifPicker }   from "./GifPicker";
import { AudioRecorder } from "./AudioRecorder";
import { chatMediaApi } from "@/lib/api";

interface ReplyTo {
  id: string;
  content: string;
  author: string;
}

interface Props {
  onSend: (msg: {
    content:     string;
    media_url?:  string;
    media_type?: string;
    view_once?:  boolean;
    reply_to_id?: string;
    audio_duration?: number;
  }) => void;
  onTyping?: (typing: boolean) => void;
  replyTo?: ReplyTo | null;
  onCancelReply?: () => void;
  disabled?: boolean;
  recipientName?: string;
}

type Panel = "emoji" | "gif" | "attach" | null;

export function ChatInput({
  onSend, onTyping, replyTo, onCancelReply, disabled, recipientName,
}: Props) {
  const [text, setText]           = useState("");
  const [panel, setPanel]         = useState<Panel>(null);
  const [showAudio, setShowAudio] = useState(false);
  const [viewOnce, setViewOnce]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{url: string; type: string; blob?: Blob; remoteUrl?: string; remotePath?: string; gifTitle?: string} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimer = useRef<any>(null);

  function handleTextChange(v: string) {
    setText(v);
    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
    // Typing indicator
    onTyping?.(true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => onTyping?.(false), 2000);
  }

  function insertEmoji(emoji: string) {
    const el   = textareaRef.current;
    if (!el) { setText(t => t + emoji); return; }
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const newText = text.slice(0, start) + emoji + text.slice(end);
    setText(newText);
    setTimeout(() => {
      el.selectionStart = el.selectionEnd = start + emoji.length;
      el.focus();
    }, 0);
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const kind = file.type.startsWith("video") ? "video"
               : file.type.startsWith("audio") ? "audio"
               : "image";

    // Local preview inmediata
    const localUrl = URL.createObjectURL(file);
    setMediaPreview({ url: localUrl, type: kind });
    setPanel(null);
    setUploading(true);

    try {
      const { data } = await chatMediaApi.upload(file);
      setMediaPreview(prev => prev ? {
        ...prev,
        remoteUrl:  data.url,
        remotePath: data.path,
      } : null);
    } catch (e: any) {
      setMediaPreview(null);
      const detail = e?.response?.data?.detail ?? "Error al subir el archivo";
      alert(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    setUploading(false);
  }

  async function handleAudioSend(blob: Blob, duration: number) {
    setPanel(null);
    setUploading(true);
    try {
      const mime = blob.type || "audio/webm";
      const ext  = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
      const file = new File([blob], `audio.${ext}`, { type: mime });
      const { data } = await chatMediaApi.upload(file);
      onSend({
        content: "🎤 Audio",
        media_url:  data.url,
        media_type: "audio",
        reply_to_id: replyTo?.id,
        audio_duration: duration,
      });
      onCancelReply?.();
    } catch {
      alert("Error al enviar audio");
    }
    setUploading(false);
  }

  function handleGifSelect(gif: { url: string; title: string }) {
    // Mostrar como preview para que el usuario confirme antes de enviar
    setMediaPreview({ url: gif.url, type: "gif", remoteUrl: gif.url, gifTitle: gif.title });
    setPanel(null);
  }

  function removeMedia() {
    setMediaPreview(null);
    setViewOnce(false);
  }

  function handleSend() {
    if (disabled || uploading) return;

    if (mediaPreview) {
      if (!mediaPreview.remoteUrl) { alert("Espera a que termine de subir"); return; }
      const defaultContent =
        mediaPreview.type === "gif"   ? (mediaPreview.gifTitle || "🎬 GIF") :
        mediaPreview.type === "video" ? "📹 Video" : "📷 Foto";
      onSend({
        content:     text.trim() || defaultContent,
        media_url:   mediaPreview.remoteUrl,
        media_type:  mediaPreview.type === "gif" ? "image" : mediaPreview.type,
        view_once:   viewOnce,
        reply_to_id: replyTo?.id,
      });
      setMediaPreview(null);
      setText("");
      setViewOnce(false);
      onCancelReply?.();
      return;
    }

    if (!text.trim()) return;
    onSend({ content: text.trim(), reply_to_id: replyTo?.id });
    setText("");
    onTyping?.(false);
    clearTimeout(typingTimer.current);
    onCancelReply?.();
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }

  function togglePanel(p: Panel) {
    setPanel(prev => prev === p ? null : p);
  }

  const canSend = !uploading && (!!text.trim() || (!!mediaPreview && !!mediaPreview.remoteUrl));

  return (
    <div className="flex-shrink-0 border-t border-border/60">

      {/* Reply context */}
      {replyTo && (
        <div className="flex items-center gap-2 px-4 py-2 bg-bg-muted/40 border-b border-border/40">
          <div className="w-0.5 h-8 bg-accent-purple rounded-full flex-shrink-0"/>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-accent-purple font-medium">{replyTo.author}</p>
            <p className="text-xs text-text-muted truncate">{replyTo.content}</p>
          </div>
          <button onClick={onCancelReply}><X size={13} className="text-text-muted"/></button>
        </div>
      )}

      {/* Media preview */}
      {mediaPreview && (
        <div className="px-4 py-3 border-b border-border/40 bg-bg-muted/20">
          <div className="flex items-start gap-3">
            <div className="relative w-20 h-20 rounded-xl overflow-hidden bg-bg-muted flex-shrink-0 border border-border">
              {mediaPreview.type === "video" ? (
                <video src={mediaPreview.url} className="w-full h-full object-cover"/>
              ) : (
                <img src={mediaPreview.url} alt="" className="w-full h-full object-cover"/>
              )}
              {uploading && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
                </div>
              )}
            </div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-1.5">
                {mediaPreview.type === "video" ? <Video size={13} className="text-accent-purple"/> :
                 mediaPreview.type === "gif"   ? <Film size={13} className="text-accent-purple"/> :
                 <ImageIcon size={13} className="text-accent-purple"/>}
                <span className="text-xs text-text-muted capitalize">
                  {mediaPreview.type === "gif" ? "GIF" : mediaPreview.type}
                </span>
                {uploading && <span className="text-[10px] text-text-muted">Subiendo...</span>}
              </div>
              {/* Vista única toggle — no aplica a GIFs externos */}
              {mediaPreview.type !== "gif" && (
                <button
                  onClick={() => setViewOnce(v => !v)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                    viewOnce
                      ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple"
                      : "border-border text-text-muted hover:border-accent-purple/40"
                  }`}
                >
                  {viewOnce ? <EyeOff size={11}/> : <Eye size={11}/>}
                  {viewOnce ? "Vista única" : "Permanente"}
                </button>
              )}
            </div>
            <button onClick={removeMedia} className="p-1 text-text-muted hover:text-status-error transition-colors">
              <X size={15}/>
            </button>
          </div>
        </div>
      )}

      {/* Floating panels */}
      <div className="relative">
        {panel === "emoji" && (
          <EmojiPicker onSelect={insertEmoji} onClose={() => setPanel(null)} theme="dark"/>
        )}
        {panel === "gif" && (
          <GifPicker onSelect={handleGifSelect} onClose={() => setPanel(null)}/>
        )}
        {panel === "attach" && (
          <div className="absolute bottom-full mb-2 left-0 z-50 bg-bg-card border border-border rounded-2xl p-2 shadow-xl animate-slide-up">
            <div className="grid grid-cols-2 gap-1.5 w-40">
              {[
                { icon: ImageIcon, label: "Foto",         accept: "image/*" },
                { icon: Video,     label: "Video",        accept: "video/*" },
                { icon: Film,      label: "GIF",          accept: "image/gif" },
              ].map(({ icon: Icon, label, accept }) => (
                <button
                  key={label}
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.accept = accept;
                      fileInputRef.current.click();
                    }
                    setPanel(null);
                  }}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-bg-muted transition-colors"
                >
                  <Icon size={20} className="text-accent-purple"/>
                  <span className="text-xs text-text-secondary">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main input row */}
      {showAudio ? (
        <div className="flex items-center gap-2 px-4 py-3">
          <AudioRecorder
            onSend={handleAudioSend}
            onCancel={() => setShowAudio(false)}
          />
        </div>
      ) : (
        <div className="flex items-end gap-2 px-4 py-3">

          {/* Left actions */}
          <div className="flex items-center gap-0.5 flex-shrink-0 pb-0.5">
            <button
              onClick={() => togglePanel("emoji")}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${panel === "emoji" ? "text-accent-purple" : "text-text-muted hover:text-text-primary"}`}
            >
              <Smile size={18}/>
              <span className="text-[9px] leading-none">Emoji</span>
            </button>
            <button
              onClick={() => togglePanel("attach")}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${panel === "attach" ? "text-accent-purple" : "text-text-muted hover:text-text-primary"}`}
            >
              <Paperclip size={18}/>
              <span className="text-[9px] leading-none">Adjunto</span>
            </button>
            <button
              onClick={() => togglePanel("gif")}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors ${panel === "gif" ? "text-accent-purple" : "text-text-muted hover:text-text-primary"}`}
            >
              <span className="text-[13px] font-bold tracking-tight leading-none">GIF</span>
              <span className="text-[9px] leading-none">Buscar</span>
            </button>
          </div>

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={text}
            onChange={e => handleTextChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={disabled ? "Bloqueado" : `Mensaje${recipientName ? ` a ${recipientName}` : ""}…`}
            disabled={disabled}
            rows={1}
            maxLength={2000}
            className="flex-1 px-4 py-2.5 rounded-2xl bg-bg-muted border border-border text-sm text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent-purple/60 max-h-28 transition-colors disabled:opacity-50"
            style={{ minHeight: 42 }}
          />

          {/* Right: mic or send */}
          <div className="flex items-center gap-1 flex-shrink-0 pb-0.5">
            {canSend ? (
              <button
                onClick={handleSend}
                className="p-2.5 bg-accent-purple rounded-xl text-white hover:bg-accent-purple/90 active:scale-95 transition-all"
              >
                <Send size={18}/>
              </button>
            ) : (
              <button
                onClick={() => setShowAudio(true)}
                className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-xl transition-colors text-text-muted hover:text-text-primary"
              >
                <Mic size={18}/>
                <span className="text-[9px] leading-none">Audio</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileSelect}
      />
    </div>
  );
}
