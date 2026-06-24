/**
 * VideoTrimmer — recorta un video local antes de subirlo.
 *
 * Estrategia: usa video.captureStream() + MediaRecorder para re-codificar
 * el segmento elegido. Funciona en Chrome, Firefox, Edge y Safari 14.1+.
 * En navegadores que no soportan captureStream, muestra mensaje y deja
 * solo cancelar.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { X, Scissors, Play, Pause } from "@phosphor-icons/react";

interface Props {
  file:        File;
  maxSeconds:  number;
  onDone:      (trimmed: File) => void;
  onCancel:    () => void;
}

function fmt(t: number) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function pickRecorderMime(): string | null {
  const candidates = [
    "video/mp4",
    "video/webm;codecs=h264",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported?.(c)) {
      return c;
    }
  }
  return null;
}

export function VideoTrimmer({ file, maxSeconds, onDone, onCancel }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = useMemo(() => URL.createObjectURL(file), [file]);

  const [duration, setDuration] = useState(0);
  const [startT, setStartT]     = useState(0);
  const [endT, setEndT]         = useState(maxSeconds);
  const [playing, setPlaying]   = useState(false);
  const [busy, setBusy]         = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState<string | null>(null);

  // Cleanup blob URL
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  function onLoaded() {
    const v = videoRef.current;
    if (!v) return;
    const d = v.duration || 0;
    setDuration(d);
    setStartT(0);
    setEndT(Math.min(maxSeconds, d));
  }

  // Mantener video sincronizado con startT cuando lo mueven y no está reproduciendo
  function onStartChange(val: number) {
    const v = Math.max(0, Math.min(val, endT - 0.5));
    setStartT(v);
    if (videoRef.current && !playing) videoRef.current.currentTime = v;
  }

  function onEndChange(val: number) {
    const maxAllowed = Math.min(duration, startT + maxSeconds);
    const v = Math.max(startT + 0.5, Math.min(val, maxAllowed));
    setEndT(v);
    if (videoRef.current && !playing) videoRef.current.currentTime = v;
  }

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (playing) { v.pause(); return; }
    if (v.currentTime < startT || v.currentTime >= endT) v.currentTime = startT;
    v.play().catch(() => {});
  }

  // Detener auto-play al pasar el endT
  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    if (v.currentTime >= endT) {
      v.pause();
      v.currentTime = startT;
    }
  }

  async function handleTrim() {
    setError(null);
    const v = videoRef.current;
    if (!v) return;

    const captureFn = (v as any).captureStream || (v as any).mozCaptureStream;
    if (!captureFn) {
      setError("Tu navegador no soporta recortar acá. Usá la app de fotos para recortar antes de subir.");
      return;
    }

    const mime = pickRecorderMime();
    if (!mime) {
      setError("Tu navegador no soporta grabar video. Recortá con tu app de fotos antes de subir.");
      return;
    }

    setBusy(true);
    setProgress(0);

    try {
      // Posicionar al inicio
      v.muted = true;
      v.currentTime = startT;
      await new Promise<void>((resolve) => {
        const h = () => { v.removeEventListener("seeked", h); resolve(); };
        v.addEventListener("seeked", h);
      });

      const stream: MediaStream = captureFn.call(v);
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };

      const stopped = new Promise<void>((resolve) => { recorder.onstop = () => resolve(); });

      recorder.start(250);
      await v.play();

      const targetLen = endT - startT;
      const watcher = setInterval(() => {
        if (!videoRef.current) return;
        const elapsed = v.currentTime - startT;
        setProgress(Math.min(100, Math.round((elapsed / targetLen) * 100)));
        if (v.currentTime >= endT || v.ended) {
          clearInterval(watcher);
          v.pause();
          if (recorder.state !== "inactive") recorder.stop();
        }
      }, 100);

      await stopped;
      clearInterval(watcher);

      const ext = mime.startsWith("video/mp4") ? "mp4" : "webm";
      const blob = new Blob(chunks, { type: mime.split(";")[0] });
      if (blob.size === 0) {
        setError("No se pudo recortar el video. Probá recortar con tu app de fotos.");
        setBusy(false);
        return;
      }
      const trimmed = new File([blob], `trimmed_${Date.now()}.${ext}`, { type: blob.type });
      onDone(trimmed);
    } catch (err) {
      console.error("trim error", err);
      setError("Falló el recorte. Probá recortar con tu app de fotos antes de subir.");
      setBusy(false);
    }
  }

  const clipLen = endT - startT;
  const exceeded = clipLen > maxSeconds;

  return (
    <div className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl overflow-hidden flex flex-col max-h-[95vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Scissors size={15} className="text-accent-purple"/>
            <h2 className="font-semibold text-sm">Recortar video</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-bg-muted text-text-muted">
            <X size={16}/>
          </button>
        </div>

        {/* Player */}
        <div className="bg-black flex items-center justify-center" style={{ aspectRatio: "16/10" }}>
          <video
            ref={videoRef}
            src={url}
            playsInline
            onLoadedMetadata={onLoaded}
            onTimeUpdate={onTimeUpdate}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            controls={false}
            className="max-h-full max-w-full"
          />
        </div>

        {/* Controls */}
        <div className="p-4 space-y-4">
          {/* Play / Time */}
          <div className="flex items-center justify-between">
            <button
              onClick={togglePlay}
              disabled={busy}
              className="w-10 h-10 rounded-full bg-accent-purple text-white flex items-center justify-center disabled:opacity-50"
            >
              {playing ? <Pause size={16}/> : <Play size={16}/>}
            </button>
            <div className="flex items-center gap-2 text-xs text-text-secondary">
              <span>{fmt(startT)}</span>
              <span className="text-text-muted">→</span>
              <span>{fmt(endT)}</span>
              <span className={`ml-2 font-medium ${exceeded ? "text-status-error" : "text-text-muted"}`}>
                ({fmt(clipLen)})
              </span>
            </div>
          </div>

          {/* Inicio */}
          <div>
            <label className="text-xs text-text-muted">Inicio</label>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={startT}
              onChange={e => onStartChange(parseFloat(e.target.value))}
              disabled={busy || duration === 0}
              className="w-full accent-accent-purple"
            />
          </div>

          {/* Fin */}
          <div>
            <label className="text-xs text-text-muted">Fin</label>
            <input
              type="range"
              min={0}
              max={duration}
              step={0.1}
              value={endT}
              onChange={e => onEndChange(parseFloat(e.target.value))}
              disabled={busy || duration === 0}
              className="w-full accent-accent-purple"
            />
          </div>

          {duration > 0 && (
            <p className="text-[11px] text-text-muted">
              Video original: <span className="text-text-secondary">{fmt(duration)}</span>
              {duration > maxSeconds && (
                <> · Máximo permitido: <span className="text-accent-purple">{fmt(maxSeconds)}</span></>
              )}
            </p>
          )}

          {error && <p className="text-xs text-status-error">{error}</p>}

          {busy && (
            <div className="space-y-1">
              <p className="text-xs text-text-secondary">Recortando... {progress}%</p>
              <div className="w-full h-1 bg-bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-accent-purple transition-all" style={{ width: `${progress}%` }}/>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={onCancel}
              disabled={busy}
              className="flex-1 py-2.5 rounded-xl border border-border text-sm text-text-secondary disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleTrim}
              disabled={busy || duration === 0 || clipLen < 0.5}
              className="flex-1 py-2.5 rounded-xl bg-accent-purple text-white text-sm font-medium disabled:opacity-50"
            >
              {busy ? "Procesando..." : "Usar este recorte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
