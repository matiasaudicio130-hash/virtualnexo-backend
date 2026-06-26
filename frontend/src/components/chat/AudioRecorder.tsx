import { useState, useRef, useEffect } from "react";
import { Microphone, StopCircle, PaperPlaneTilt, Trash } from "@phosphor-icons/react";

interface Props {
  onSend: (blob: Blob, duration: number) => void;
  onCancel: () => void;
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getSupportedMimeType(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/ogg",
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) return t;
  }
  return "";
}

export function AudioRecorder({ onSend, onCancel }: Props) {
  const [state, setState]     = useState<"recording"|"preview">("recording");
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRef  = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef  = useRef<any>(null);
  const blobRef   = useRef<Blob | null>(null);

  useEffect(() => {
    startRecording();
    return () => {
      clearInterval(timerRef.current);
      mediaRef.current?.stream.getTracks().forEach(t => t.stop());
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const mime = mr.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setState("preview");
        stream.getTracks().forEach(t => t.stop());
      };

      mr.start(100);
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err: any) {
      const isDenied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
      if (isDenied) {
        const { toast } = await import("@/store/toastStore");
        toast.error("Permiso de micrófono denegado. Habilitalo en la configuración del navegador.");
      }
      onCancel();
    }
  }

  function stopRecording() {
    clearInterval(timerRef.current);
    mediaRef.current?.stop();
  }

  function handleSend() {
    if (blobRef.current) onSend(blobRef.current, duration);
  }

  if (state === "recording") {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-muted/60 rounded-2xl border border-border flex-1">
        {/* Animated mic indicator */}
        <div className="relative flex-shrink-0">
          <div className="w-2.5 h-2.5 bg-status-error rounded-full animate-pulse"/>
          <div className="absolute inset-0 bg-status-error/30 rounded-full animate-ping"/>
        </div>
        <span className="text-sm text-status-error font-mono tabular-nums flex-1">
          {formatDuration(duration)}
        </span>
        {/* Waveform bars */}
        <div className="flex items-center gap-0.5 flex-1">
          {Array.from({length: 12}).map((_, i) => (
            <div
              key={i}
              className="w-1 bg-accent-purple rounded-full"
              style={{
                height: `${8 + Math.sin(Date.now() / 200 + i) * 6}px`,
                animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`,
                animationDelay: `${i * 80}ms`,
              }}
            />
          ))}
        </div>
        <button onClick={stopRecording}
          className="p-2 bg-status-error rounded-xl text-white hover:bg-status-error/80 transition-colors flex-shrink-0">
          <StopCircle size={14}/>
        </button>
        <button onClick={onCancel}
          className="p-2 text-text-muted hover:text-text-primary transition-colors flex-shrink-0">
          <Trash size={14}/>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-bg-muted/60 rounded-2xl border border-border flex-1">
      {audioUrl && (
        <audio src={audioUrl} controls className="h-10 flex-1 min-w-0"
          style={{ colorScheme: "dark" }}/>
      )}
      <span className="text-xs text-text-muted font-mono tabular-nums flex-shrink-0">
        {formatDuration(duration)}
      </span>
      <button onClick={onCancel}
        className="p-1.5 text-text-muted hover:text-status-error transition-colors flex-shrink-0">
        <Trash size={14}/>
      </button>
      <button onClick={handleSend}
        className="p-1.5 bg-accent-purple rounded-xl text-white hover:opacity-90 transition-all flex-shrink-0">
        <PaperPlaneTilt size={14}/>
      </button>
    </div>
  );
}

/* ── Reproductor de audio para mensajes recibidos ─────────── */
export function AudioPlayer({ url, duration }: { url: string; duration?: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <Microphone size={14} className="text-current opacity-70 flex-shrink-0"/>
      <audio src={url} controls className="h-7 flex-1"
        style={{ colorScheme: "dark", minWidth: 140 }}/>
      {duration && (
        <span className="text-[10px] opacity-60 flex-shrink-0">{formatDuration(duration)}</span>
      )}
    </div>
  );
}
