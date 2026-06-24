import { useRef, useState, useCallback } from "react";
import { Image as ImageIcon, X, MapPin, Clock, ChartBar, Plus, Trash, Pencil, Play, Scissors, SquaresFour } from "@phosphor-icons/react";
import { feedApi, mediaApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";
import { ImageCropFilter } from "@/components/ImageCropFilter";
import { VideoTrimmer } from "@/components/VideoTrimmer";
import { CollageMaker } from "@/components/CollageMaker";
import { toErrorMessage } from "@/lib/errors";

const MAX_VIDEO_SECONDS = 120;            // 2 minutos
const MAX_FILE_BYTES    = 48 * 1024 * 1024; // 48 MB (Supabase Storage cap ~50MB)

async function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    v.src = url;
    const cleanup = () => { URL.revokeObjectURL(url); };
    v.onloadedmetadata = () => {
      const d = v.duration;
      cleanup();
      if (Number.isFinite(d) && d > 0) resolve(d);
      else resolve(0);
    };
    v.onerror = () => { cleanup(); reject(new Error("no metadata")); };
    // timeout de seguridad
    setTimeout(() => { cleanup(); resolve(v.duration || 0); }, 8000);
  });
}

type CityResult = { name: string; state: string; country: string; display: string };

async function searchCities(q: string): Promise<CityResult[]> {
  if (q.length < 2) return [];
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&featuretype=settlement&format=json&addressdetails=1&limit=6`,
      { signal: ctrl.signal, headers: { "Accept-Language": "es" } }
    );
    return (await res.json()).map((r: any) => {
      const name  = r.address?.city || r.address?.town || r.address?.village || r.name;
      const state = r.address?.state || r.address?.province || "";
      return { name, state, country: r.address?.country || "", display: [name, state, r.address?.country].filter(Boolean).join(", ") };
    });
  } catch { return []; }
}

interface Props {
  onCreated: () => void;
  onClose:   () => void;
}

type Mode = "post" | "story" | "poll" | "collage";

interface PollPhoto {
  file:      File;
  preview:   string;
  processed: File | null;
}

const POLL_DURATIONS = [
  { label: "1 hora",   hours: 1   },
  { label: "24 horas", hours: 24  },
  { label: "3 días",   hours: 72  },
  { label: "7 días",   hours: 168 },
];

interface GradientPreset {
  label:   string;
  preview: string;  // CSS background for the swatch
  type:    "solid" | "linear" | "radial";
  colors:  string[];
  angle?:  number;
}

const GRADIENT_PRESETS: GradientPreset[] = [
  // Sólidos
  { label: "Negro",        type: "solid",  colors: ["#0a0a0f"],          preview: "#0a0a0f" },
  { label: "Blanco",       type: "solid",  colors: ["#f0f0f0"],          preview: "#f0f0f0" },
  { label: "Dorado",       type: "solid",  colors: ["#C9A227"],          preview: "#C9A227" },
  { label: "Rosa oscuro",  type: "solid",  colors: ["#1a0010"],          preview: "#1a0010" },
  { label: "Azul noche",  type: "solid",  colors: ["#050a1a"],          preview: "#050a1a" },
  { label: "Vino",         type: "solid",  colors: ["#2d0a1a"],          preview: "#2d0a1a" },
  // Degradados lineales
  { label: "Sunset",       type: "linear", angle: 135, colors: ["#FF6B9D","#FFB347"],  preview: "linear-gradient(135deg,#FF6B9D,#FFB347)" },
  { label: "Ocean",        type: "linear", angle: 135, colors: ["#0066FF","#00D4FF"],  preview: "linear-gradient(135deg,#0066FF,#00D4FF)" },
  { label: "Aurora",       type: "linear", angle: 135, colors: ["#A78BFA","#34D399"],  preview: "linear-gradient(135deg,#A78BFA,#34D399)" },
  { label: "Fuego",        type: "linear", angle: 180, colors: ["#FF4500","#FF6B9D"],  preview: "linear-gradient(180deg,#FF4500,#FF6B9D)" },
  { label: "Menta",        type: "linear", angle: 135, colors: ["#00b09b","#96c93d"],  preview: "linear-gradient(135deg,#00b09b,#96c93d)" },
  { label: "Crepúsculo",   type: "linear", angle: 135, colors: ["#1a1a2e","#C9A227"],  preview: "linear-gradient(135deg,#1a1a2e,#C9A227)" },
  // Radiales
  { label: "Rosa radial",  type: "radial", colors: ["#FF6B9D","#1a0010"],  preview: "radial-gradient(circle,#FF6B9D,#1a0010)" },
  { label: "Blue radial",  type: "radial", colors: ["#60A5FA","#050a1a"],  preview: "radial-gradient(circle,#60A5FA,#050a1a)" },
  { label: "Gold radial",  type: "radial", colors: ["#C9A227","#0a0a0f"],  preview: "radial-gradient(circle,#C9A227,#0a0a0f)" },
  { label: "Purple radial",type: "radial", colors: ["#A78BFA","#1a0010"],  preview: "radial-gradient(circle,#A78BFA,#1a0010)" },
  // Tricolores
  { label: "Arcoíris",     type: "linear", angle: 135, colors: ["#FF6B9D","#A78BFA","#60A5FA"], preview: "linear-gradient(135deg,#FF6B9D,#A78BFA,#60A5FA)" },
  { label: "Dorado rojizo",type: "linear", angle: 135, colors: ["#C9A227","#FF4500","#1a0010"], preview: "linear-gradient(135deg,#C9A227,#FF4500,#1a0010)" },
];

export function CreatePost({ onCreated, onClose }: Props) {
  const { user }    = useAuthStore();
  const inputRef    = useRef<HTMLInputElement>(null);
  const photoRef    = useRef<HTMLInputElement>(null);

  const [mode,    setMode]    = useState<Mode>("post");
  const [caption, setCaption] = useState("");
  const [file,    setFile]    = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isVideo, setIsVideo] = useState(false);
  const [province,     setProvince]    = useState(user?.province || "");
  const [cityQuery,    setCityQuery]   = useState(user?.province || "");
  const [cityResults,  setCityResults] = useState<CityResult[]>([]);
  const cityTimer = useRef<ReturnType<typeof setTimeout>>();

  const onCityInput = useCallback((val: string) => {
    setCityQuery(val);
    setProvince(val);
    setCityResults([]);
    clearTimeout(cityTimer.current);
    if (val.length < 2) return;
    cityTimer.current = setTimeout(async () => setCityResults(await searchCities(val)), 350);
  }, []);
  const [pendingTrim, setPendingTrim] = useState<File | null>(null);
  const [showTrimmer, setShowTrimmer] = useState(false);
  const [overlongInfo, setOverlongInfo] = useState<{ duration: number; file: File } | null>(null);

  // Poll
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions,  setPollOptions]  = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(24);
  const [pollPhotos,   setPollPhotos]   = useState<PollPhoto[]>([]);
  const [editingIdx,   setEditingIdx]   = useState<number | null>(null);

  const [loading, setLoading]           = useState(false);
  const [error,   setError]             = useState("");
  const [storyAudience, setStoryAudience] = useState<"all"|"followers"|"partner">("all");
  const [visibility,    setVisibility]    = useState<"public"|"followers"|"only_me">("public");
  const [editingMainPhoto, setEditingMainPhoto] = useState<File | null>(null);

  // ── handlers: post/story media (foto o video) ───────────────
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // reset el input para poder volver a elegir el mismo archivo
    e.target.value = "";
    if (!f) return;

    setError("");
    const video = f.type.startsWith("video/");

    if (!video) {
      // Foto — chequeo de tamaño
      if (f.size > MAX_FILE_BYTES) {
        setError(`La foto pesa ${(f.size/1024/1024).toFixed(1)} MB — máximo permitido: ${MAX_FILE_BYTES/1024/1024} MB.`);
        return;
      }
      setIsVideo(false);
      setEditingMainPhoto(f);  // abre editor antes de confirmar
      return;
    }

    // Video — chequear duración
    let duration = 0;
    try { duration = await getVideoDuration(f); } catch { duration = 0; }

    if (duration > MAX_VIDEO_SECONDS + 0.5) {
      // Forzamos recorte
      setOverlongInfo({ duration, file: f });
      return;
    }

    if (f.size > MAX_FILE_BYTES) {
      // Video corto pero pesado: ofrecer recortar/recomprimir
      setOverlongInfo({ duration, file: f });
      setError(`El video pesa ${(f.size/1024/1024).toFixed(1)} MB — máximo: ${MAX_FILE_BYTES/1024/1024} MB. Recortalo para reducir el tamaño.`);
      return;
    }

    setIsVideo(true);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function applyGradient(g: GradientPreset) {
    const W = 1080, H = 1920; // story 9:16
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;

    let fill: string | CanvasGradient;
    if (g.type === "solid") {
      fill = g.colors[0];
    } else if (g.type === "linear") {
      const rad = ((g.angle ?? 135) * Math.PI) / 180;
      const grd = ctx.createLinearGradient(
        W / 2 - Math.cos(rad) * W / 2, H / 2 - Math.sin(rad) * H / 2,
        W / 2 + Math.cos(rad) * W / 2, H / 2 + Math.sin(rad) * H / 2,
      );
      g.colors.forEach((c, i) => grd.addColorStop(i / (g.colors.length - 1), c));
      fill = grd;
    } else {
      const grd = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.colors.forEach((c, i) => grd.addColorStop(i / (g.colors.length - 1), c));
      fill = grd;
    }

    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, W, H);

    canvas.toBlob(blob => {
      if (!blob) return;
      const f = new File([blob], "fondo.jpg", { type: "image/jpeg" });
      setIsVideo(false);
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }, "image/jpeg", 0.92);
  }

  function applyVideoFile(f: File) {
    setIsVideo(true);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  function startTrimming() {
    if (!overlongInfo) return;
    setPendingTrim(overlongInfo.file);
    setOverlongInfo(null);
    setShowTrimmer(true);
  }

  // ── handlers: poll photos ────────────────────────────────────
  function handlePollPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    e.target.value = "";
    setPollPhotos(prev => {
      const toAdd = files.slice(0, 10 - prev.length).map(f => ({
        file:      f,
        preview:   URL.createObjectURL(f),
        processed: null,
      }));
      return [...prev, ...toAdd];
    });
  }

  function removePollPhoto(i: number) {
    setPollPhotos(prev => {
      URL.revokeObjectURL(prev[i].preview);
      return prev.filter((_, idx) => idx !== i);
    });
  }

  function onCropDone(result: File) {
    if (editingIdx === null) return;
    setPollPhotos(prev => prev.map((p, i) => i === editingIdx ? { ...p, processed: result } : p));
    setEditingIdx(null);
  }

  function onMainPhotoCropDone(result: File) {
    setFile(result);
    setPreview(URL.createObjectURL(result));
    setEditingMainPhoto(null);
  }

  // ── handlers: poll options ───────────────────────────────────
  function addOption()          { if (pollOptions.length < 10) setPollOptions(p => [...p, ""]); }
  function removeOption(i: number) { if (pollOptions.length > 2) setPollOptions(p => p.filter((_, idx) => idx !== i)); }
  function setOption(i: number, v: string) { setPollOptions(p => p.map((o, idx) => idx === i ? v : o)); }

  // ── submit ───────────────────────────────────────────────────
  async function handleSubmit() {
    setError("");

    if (mode === "poll") {
      if (!pollQuestion.trim())                { setError("Escribí la pregunta."); return; }
      if (pollOptions.some(o => !o.trim()))    { setError("Completá todas las opciones."); return; }
      setLoading(true);
      try {
        const mediaUrls: string[] = [];
        for (const p of pollPhotos) {
          const { data } = await mediaApi.uploadPost(p.processed ?? p.file);
          mediaUrls.push(data.signed_url);
        }
        await feedApi.createPost({
          type:                "poll",
          poll_question:       pollQuestion.trim(),
          poll_options:        pollOptions.map(o => o.trim()),
          poll_duration_hours: pollDuration,
          province,
          ...(mediaUrls.length ? { media_urls: mediaUrls } : {}),
        });
        onCreated();
      } catch (e: any) {
        setError(toErrorMessage(e, "Error al publicar."));
      }
      setLoading(false);
      return;
    }

    if (!caption && !file) { setError("Agregá una foto o texto."); return; }
    setLoading(true);
    try {
      if (file) {
        // 1) Pedir signed upload URL
        const kind: "image" | "video" = isVideo ? "video" : "image";
        const { data: signed } = await feedApi.signedUpload({ kind, filename: file.name });
        // 2) Subir DIRECTAMENTE a Supabase (bypass Railway / sin límite de body)
        // Supabase requiere el Content-Type exacto — iPhone graba video/quicktime (.mov)
        const contentType = file.type || (isVideo ? "video/mp4" : "image/jpeg");
        console.log("[upload] PUT", signed.upload_url.slice(0, 80), "type:", contentType, "size:", file.size);
        const putRes = await fetch(signed.upload_url, {
          method: "PUT",
          headers: { "Content-Type": contentType },
          body: file,
        });
        console.log("[upload] PUT status:", putRes.status);
        if (!putRes.ok) {
          let detail = `${putRes.status}`;
          try { const j = await putRes.json(); detail = j.message || j.error || detail; } catch {}
          throw new Error(`No se pudo subir el archivo: ${detail}`);
        }
        // 3) Crear el post con el path subido
        await feedApi.createFromStorage({
          path: signed.path,
          kind,
          caption,
          province,
          is_story:       mode === "story",
          story_audience: storyAudience,
          visibility:     mode === "story" ? "public" : visibility,
        });
      } else {
        await feedApi.createPost({ type: "text", caption, province, is_story: mode === "story", story_audience: storyAudience });
      }
      onCreated();
    } catch (e: any) {
      setError(toErrorMessage(e, "Error al publicar."));
    }
    setLoading(false);
  }

  return (
    <>
      {/* Collage maker (full-screen) */}
      {mode === "collage" && (
        <CollageMaker
          onDone={(collageFile) => {
            setFile(collageFile);
            setPreview(URL.createObjectURL(collageFile));
            setIsVideo(false);
            setMode("post");
          }}
          onCancel={() => setMode("post")}
        />
      )}

      {/* Editor de foto principal (post/story) */}
      {editingMainPhoto && (
        <ImageCropFilter
          file={editingMainPhoto}
          onDone={onMainPhotoCropDone}
          onCancel={() => {
            setEditingMainPhoto(null);
            // Si no había foto previa, limpiamos el estado
            if (!file) { setIsVideo(false); }
          }}
        />
      )}

      {/* Crop/filter modal para fotos de encuesta */}
      {editingIdx !== null && (
        <ImageCropFilter
          file={pollPhotos[editingIdx].file}
          onDone={onCropDone}
          onCancel={() => setEditingIdx(null)}
        />
      )}

      {/* Aviso de video largo */}
      {overlongInfo && (
        <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-sm bg-bg-card border border-border rounded-t-2xl sm:rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Scissors size={16} className="text-accent-purple"/>
              <h3 className="font-semibold text-sm">Video demasiado largo</h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Tu video dura <strong>{Math.round(overlongInfo.duration)}s</strong>.
              El máximo permitido es <strong>{MAX_VIDEO_SECONDS}s</strong> (2 min).
              Recortá acá o desde tu app de fotos antes de subirlo.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setOverlongInfo(null)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm text-text-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={startTrimming}
                className="flex-1 py-2.5 rounded-xl bg-accent-purple text-white text-sm font-medium flex items-center justify-center gap-1.5"
              >
                <Scissors size={13}/> Recortar acá
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trimmer */}
      {showTrimmer && pendingTrim && (
        <VideoTrimmer
          file={pendingTrim}
          maxSeconds={MAX_VIDEO_SECONDS}
          onCancel={() => { setShowTrimmer(false); setPendingTrim(null); }}
          onDone={(trimmed) => {
            applyVideoFile(trimmed);
            setShowTrimmer(false);
            setPendingTrim(null);
          }}
        />
      )}

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
        <div className="w-full sm:max-w-md bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <h2 className="font-semibold text-sm">Nueva publicación</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-muted text-text-muted">
              <X size={16} />
            </button>
          </div>

          {/* Mode tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {([
              { id: "post",    label: "Post",     icon: ImageIcon  },
              { id: "story",   label: "Story",    icon: Clock      },
              { id: "poll",    label: "Encuesta", icon: ChartBar  },
              { id: "collage", label: "Collage",  icon: SquaresFour },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setMode(id)}
                className={`flex-1 flex items-center justify-center gap-1 py-2.5 text-[11px] font-medium border-b-2 transition-colors ${
                  mode === id
                    ? "border-accent-purple text-accent-purple"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}>
                <Icon size={12} /> {label}
              </button>
            ))}
          </div>

          <div className="p-4 space-y-4 overflow-y-auto flex-1">

            {/* ── COLLAGE placeholder ── */}
            {mode === "collage" && !preview && (
              <button
                onClick={() => setMode("collage")}
                className="w-full border-2 border-dashed border-accent-purple/40 rounded-xl p-8 flex flex-col items-center gap-3 text-text-muted hover:border-accent-purple transition-colors bg-accent-purple/5"
              >
                <SquaresFour size={32} className="text-accent-purple/60" />
                <span className="text-sm font-medium text-accent-purple/80">Crear collage</span>
                <span className="text-xs text-text-muted/70 text-center">Combiná 2, 3 o 4 fotos en un solo post</span>
              </button>
            )}

            {/* ── POST / STORY ── */}
            {mode !== "poll" && mode !== "collage" && (
              <>
                {preview ? (
                  <div className="relative rounded-xl overflow-hidden bg-black">
                    {isVideo ? (
                      <video src={preview} controls playsInline className="w-full max-h-72 object-contain"/>
                    ) : (
                      <img src={preview} alt="preview" className="w-full max-h-60 object-cover" />
                    )}
                    {/* Botón cerrar */}
                    <button onClick={() => { setFile(null); setPreview(null); setIsVideo(false); }}
                      className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full">
                      <X size={14} className="text-white" />
                    </button>
                    {/* Botón editar (solo fotos) */}
                    {!isVideo && file && (
                      <button
                        onClick={() => setEditingMainPhoto(file)}
                        className="absolute top-2 left-2 flex items-center gap-1.5 px-2.5 py-1.5 bg-black/60 rounded-full"
                      >
                        <Pencil size={11} className="text-white" />
                        <span className="text-[10px] text-white font-medium">Editar</span>
                      </button>
                    )}
                    {isVideo && (
                      <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 bg-black/60 rounded-full">
                        <Play size={11} className="text-white" fill="white"/>
                        <span className="text-[10px] text-white font-medium">Video</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <button onClick={() => inputRef.current?.click()}
                      className="w-full border-2 border-dashed border-border rounded-xl p-5 flex flex-col items-center gap-2 text-text-muted hover:border-accent-purple/50 transition-colors">
                      <ImageIcon size={26} className="opacity-50" />
                      <span className="text-xs">Tap para agregar foto o video (opcional)</span>
                    </button>
                    {/* Gradient backgrounds */}
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-widest mb-2">O elegí un fondo</p>
                      <div className="grid grid-cols-6 gap-1.5">
                        {GRADIENT_PRESETS.map((g, i) => (
                          <button
                            key={i}
                            onClick={() => applyGradient(g)}
                            className="h-10 rounded-lg hover:scale-105 active:scale-95 transition-transform border border-white/10"
                            style={{ background: g.preview }}
                            title={g.label}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <input ref={inputRef} type="file" accept="image/*,video/*" onChange={handleFile} className="hidden" />

                <textarea
                  value={caption}
                  onChange={e => setCaption(e.target.value)}
                  placeholder="¿Qué querés compartir?"
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
                />
                <p className="text-xs text-text-muted text-right -mt-2">{caption.length}/500</p>

                {/* ── Visibilidad (solo para posts normales) ── */}
                {mode === "post" && (
                  <div>
                    <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">¿Quién puede ver esto?</p>
                    <div className="flex gap-2">
                      {([
                        { id: "public",    label: "🌐 Público",    desc: "Todos" },
                        { id: "followers", label: "👥 Seguidores",  desc: "Solo tus seguidores" },
                        { id: "only_me",   label: "🔒 Solo yo",     desc: "Privado" },
                      ] as const).map(({ id, label }) => (
                        <button
                          key={id}
                          onClick={() => setVisibility(id)}
                          className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                            visibility === id
                              ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple"
                              : "border-border text-text-muted hover:border-accent-purple/30"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {mode === "story" && (
                  <div className="space-y-2">
                    <p className="text-xs text-accent-purple/80">Las stories desaparecen a las 24 horas.</p>
                    <div>
                      <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1.5">¿Quién puede ver esta story?</p>
                      <div className="flex gap-2">
                        {([
                          { id: "all",       label: "Todos" },
                          { id: "followers", label: "Seguidores" },
                          { id: "partner",   label: "Mi pareja" },
                        ] as const).map(({ id, label }) => (
                          <button
                            key={id}
                            onClick={() => setStoryAudience(id)}
                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                              storyAudience === id
                                ? "border-accent-purple/60 bg-accent-purple/10 text-accent-purple"
                                : "border-border text-text-muted hover:border-accent-purple/30"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── POLL ── */}
            {mode === "poll" && (
              <>
                {/* Poll photos */}
                <div>
                  <label className="text-xs text-text-secondary mb-2 block">
                    Fotos <span className="text-text-muted">(opcional · hasta 10)</span>
                  </label>

                  {pollPhotos.length > 0 && (
                    <div className="grid grid-cols-5 gap-1.5 mb-2">
                      {pollPhotos.map((p, i) => (
                        <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-bg-muted group">
                          <img src={p.preview} alt="" className="w-full h-full object-cover" />
                          {/* Edit overlay */}
                          <button onClick={() => setEditingIdx(i)}
                            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Pencil size={14} className="text-white" />
                          </button>
                          {/* Remove */}
                          <button onClick={() => removePollPhoto(i)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/70 rounded-full flex items-center justify-center">
                            <X size={9} className="text-white" />
                          </button>
                          {/* Edited badge */}
                          {p.processed && (
                            <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-amber-500/80 text-black rounded px-1">✓</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {pollPhotos.length < 10 && (
                    <button onClick={() => photoRef.current?.click()}
                      className="flex items-center gap-1.5 text-xs text-text-muted border border-dashed border-border rounded-xl px-3 py-2 hover:border-accent-purple/40 transition-colors">
                      <Plus size={13} />
                      {pollPhotos.length === 0 ? "Agregar fotos" : "Agregar más"}
                    </button>
                  )}
                  <input ref={photoRef} type="file" accept="image/*" multiple onChange={handlePollPhotos} className="hidden" />
                </div>

                {/* Question */}
                <div>
                  <label className="text-xs text-text-secondary mb-1 block">Pregunta *</label>
                  <textarea
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    placeholder="Ej: ¿Cuál es tu favorito?"
                    rows={2}
                    maxLength={200}
                    className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
                  />
                  <p className="text-xs text-text-muted text-right mt-0.5">{pollQuestion.length}/200</p>
                </div>

                {/* Options */}
                <div className="space-y-2">
                  <label className="text-xs text-text-secondary block">
                    Opciones <span className="text-text-muted">(2–10)</span>
                  </label>
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs text-text-muted w-4 text-center flex-shrink-0">{i + 1}</span>
                      <input
                        value={opt}
                        onChange={e => setOption(i, e.target.value)}
                        placeholder={`Opción ${i + 1}`}
                        maxLength={100}
                        className="flex-1 px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
                      />
                      {pollOptions.length > 2 && (
                        <button onClick={() => removeOption(i)}
                          className="p-1.5 text-text-muted hover:text-status-error flex-shrink-0">
                          <Trash size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  {pollOptions.length < 10 && (
                    <button onClick={addOption}
                      className="flex items-center gap-1.5 text-xs text-accent-purple hover:opacity-80 transition-opacity">
                      <Plus size={13} /> Agregar opción
                    </button>
                  )}
                </div>

                {/* Duration */}
                <div>
                  <label className="text-xs text-text-secondary mb-1 block">Duración</label>
                  <div className="flex gap-2 flex-wrap">
                    {POLL_DURATIONS.map(d => (
                      <button key={d.hours} onClick={() => setPollDuration(d.hours)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                          pollDuration === d.hours
                            ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                            : "border-border text-text-muted hover:border-accent-purple/40"
                        }`}>
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* City search (todos los modos) */}
            <div className="relative">
              <div className="flex items-center gap-2 px-3 py-2 bg-bg-muted border border-border rounded-xl">
                <MapPin size={14} className="text-text-muted flex-shrink-0" />
                <input
                  value={cityQuery}
                  onChange={e => onCityInput(e.target.value)}
                  onBlur={() => setTimeout(() => setCityResults([]), 150)}
                  placeholder="Ubicación (opcional)"
                  inputMode="search"
                  className="bg-transparent flex-1 focus:outline-none text-xs"
                />
                {cityQuery && (
                  <button
                    type="button"
                    onClick={() => { setCityQuery(""); setProvince(""); setCityResults([]); }}
                    className="text-text-muted hover:text-white"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              {cityResults.length > 0 && (
                <div className="absolute top-full mt-1 left-0 right-0 z-50 bg-bg-card border border-border rounded-xl overflow-hidden shadow-xl">
                  {cityResults.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      onMouseDown={() => {
                        setCityQuery(c.display);
                        setProvince(c.display);
                        setCityResults([]);
                      }}
                      className="w-full text-left px-3 py-2.5 hover:bg-white/5 transition-colors border-b border-border last:border-0"
                    >
                      <div className="text-xs text-white font-medium">{c.name}</div>
                      <div className="text-[10px] text-text-muted mt-0.5">{[c.state, c.country].filter(Boolean).join(", ")}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-status-error">{error}</p>}

            <Button onClick={handleSubmit} loading={loading} className="w-full">
              {mode === "poll" ? "Publicar encuesta" : mode === "story" ? "Publicar story" : "Publicar"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
