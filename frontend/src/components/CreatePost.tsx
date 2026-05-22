import { useRef, useState } from "react";
import { Image as ImageIcon, X, MapPin, Clock, BarChart2, Plus, Trash2 } from "lucide-react";
import { feedApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/store/authStore";

interface Props {
  onCreated: () => void;
  onClose: () => void;
}

type Mode = "post" | "story" | "poll";

const POLL_DURATIONS = [
  { label: "1 hora",   hours: 1 },
  { label: "24 horas", hours: 24 },
  { label: "3 días",   hours: 72 },
  { label: "7 días",   hours: 168 },
];

export function CreatePost({ onCreated, onClose }: Props) {
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<Mode>("post");
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [province, setProvince] = useState(user?.province || "");
  // Poll state
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions]   = useState(["", ""]);
  const [pollDuration, setPollDuration] = useState(24);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    const r = new FileReader();
    r.onload = () => setPreview(r.result as string);
    r.readAsDataURL(f);
  }

  function addOption() {
    if (pollOptions.length < 4) setPollOptions(p => [...p, ""]);
  }
  function removeOption(i: number) {
    if (pollOptions.length > 2) setPollOptions(p => p.filter((_, idx) => idx !== i));
  }
  function setOption(i: number, v: string) {
    setPollOptions(p => p.map((o, idx) => idx === i ? v : o));
  }

  async function handleSubmit() {
    setError("");

    if (mode === "poll") {
      if (!pollQuestion.trim()) { setError("Escribí la pregunta."); return; }
      if (pollOptions.some(o => !o.trim())) { setError("Completá todas las opciones."); return; }
      setLoading(true);
      try {
        await feedApi.createPost({
          type: "poll",
          poll_question: pollQuestion.trim(),
          poll_options: pollOptions.map(o => o.trim()),
          poll_duration_hours: pollDuration,
          province,
        });
        onCreated();
      } catch (e: any) {
        setError(e.response?.data?.detail ?? "Error al publicar.");
      }
      setLoading(false);
      return;
    }

    if (!caption && !file) { setError("Agregá una foto o texto."); return; }
    setLoading(true);
    try {
      if (file) {
        await feedApi.uploadPost(file, { caption, province, is_story: mode === "story" });
      } else {
        await feedApi.createPost({ type: "text", caption, province, is_story: mode === "story" });
      }
      onCreated();
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al publicar.");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="font-semibold text-sm">Nueva publicación</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-bg-muted text-text-muted">
            <X size={16} />
          </button>
        </div>

        {/* Mode selector */}
        <div className="flex border-b border-border flex-shrink-0">
          {([
            { id: "post",  label: "Post",    icon: ImageIcon },
            { id: "story", label: "Story",   icon: Clock },
            { id: "poll",  label: "Encuesta",icon: BarChart2 },
          ] as const).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                mode === id
                  ? "border-accent-purple text-accent-purple"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">

          {/* ── POST / STORY ── */}
          {mode !== "poll" && (
            <>
              {preview ? (
                <div className="relative rounded-xl overflow-hidden">
                  <img src={preview} alt="preview" className="w-full max-h-60 object-cover" />
                  <button
                    onClick={() => { setFile(null); setPreview(null); }}
                    className="absolute top-2 right-2 p-1.5 bg-black/60 rounded-full"
                  >
                    <X size={14} className="text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => inputRef.current?.click()}
                  className="w-full border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center gap-2 text-text-muted hover:border-accent-purple/50 transition-colors"
                >
                  <ImageIcon size={28} className="opacity-50" />
                  <span className="text-xs">Tap para agregar foto (opcional)</span>
                </button>
              )}
              <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

              <textarea
                value={caption}
                onChange={e => setCaption(e.target.value)}
                placeholder="¿Qué querés compartir?"
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
              />
              <p className="text-xs text-text-muted text-right -mt-2">{caption.length}/500</p>

              {mode === "story" && (
                <p className="text-xs text-accent-purple/80">
                  Las stories desaparecen a las 24 horas.
                </p>
              )}
            </>
          )}

          {/* ── POLL ── */}
          {mode === "poll" && (
            <>
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

              <div className="space-y-2">
                <label className="text-xs text-text-secondary block">Opciones (2–4)</label>
                {pollOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt}
                      onChange={e => setOption(i, e.target.value)}
                      placeholder={`Opción ${i + 1}`}
                      maxLength={80}
                      className="flex-1 px-3 py-2.5 rounded-xl bg-bg-muted border border-border text-sm focus:outline-none focus:ring-2 focus:ring-accent-purple"
                    />
                    {pollOptions.length > 2 && (
                      <button onClick={() => removeOption(i)} className="p-1.5 text-text-muted hover:text-status-error">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 4 && (
                  <button
                    onClick={addOption}
                    className="flex items-center gap-1.5 text-xs text-accent-purple hover:opacity-80 transition-opacity"
                  >
                    <Plus size={13} /> Agregar opción
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs text-text-secondary mb-1 block">Duración</label>
                <div className="flex gap-2 flex-wrap">
                  {POLL_DURATIONS.map(d => (
                    <button
                      key={d.hours}
                      onClick={() => setPollDuration(d.hours)}
                      className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${
                        pollDuration === d.hours
                          ? "border-accent-purple bg-accent-purple/10 text-accent-purple"
                          : "border-border text-text-muted hover:border-accent-purple/40"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Provincia (en todos los modos) */}
          <div className="flex items-center gap-2 px-3 py-2 bg-bg-muted border border-border rounded-xl text-sm">
            <MapPin size={14} className="text-text-muted flex-shrink-0" />
            <input
              value={province}
              onChange={e => setProvince(e.target.value)}
              placeholder="Provincia (opcional)"
              className="bg-transparent flex-1 focus:outline-none text-xs"
            />
          </div>

          {error && <p className="text-xs text-status-error">{error}</p>}

          <Button onClick={handleSubmit} loading={loading} className="w-full">
            {mode === "poll" ? "Publicar encuesta" : mode === "story" ? "Publicar story" : "Publicar"}
          </Button>
        </div>
      </div>
    </div>
  );
}
