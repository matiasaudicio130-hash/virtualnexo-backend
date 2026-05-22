/**
 * AvatarUpload — selector de foto de perfil con preview y upload al backend.
 * El backend aplica watermarks antes de subir a Supabase Storage.
 */
import { useRef, useState } from "react";
import { Camera, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { mediaApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

interface Props {
  currentUrl?: string | null;
  size?: number;
  onSuccess?: (url: string) => void;
}

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_MB  = 5;

export function AvatarUpload({ currentUrl, size = 96, onSuccess }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus]   = useState<"idle" | "uploading" | "ok" | "error">("idle");
  const [error, setError]     = useState("");
  const { user, refreshUser } = useAuthStore();

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED.includes(file.type)) {
      setError("Solo JPEG, PNG o WebP.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`Máximo ${MAX_MB} MB.`);
      return;
    }

    setError("");
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    uploadFile(file);
  }

  async function uploadFile(file: File) {
    setStatus("uploading");
    try {
      const { data } = await mediaApi.uploadAvatar(file);
      setStatus("ok");
      onSuccess?.(data.url);
      refreshUser?.();
      // Reset status después de 3s
      setTimeout(() => { setStatus("idle"); setPreview(null); }, 3000);
    } catch (e: any) {
      setStatus("error");
      setError(e.response?.data?.detail ?? "Error al subir. Intentá de nuevo.");
    }
  }

  const displaySrc = preview ?? currentUrl ?? null;

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="relative group focus:outline-none"
        style={{ width: size, height: size }}
        aria-label="Cambiar foto de perfil"
      >
        {/* Avatar actual o placeholder */}
        <div
          className="w-full h-full rounded-full overflow-hidden bg-bg-muted border-2 border-border group-hover:border-accent-purple transition-colors"
        >
          {displaySrc ? (
            <img
              src={displaySrc}
              alt="Avatar"
              draggable={false}
              className="w-full h-full object-cover pointer-events-none select-none"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-text-muted">
              <Camera size={size * 0.35} />
            </div>
          )}
        </div>

        {/* Overlay de hover */}
        {status === "idle" && (
          <div className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera size={size * 0.28} className="text-white" />
          </div>
        )}

        {/* Spinner durante upload */}
        {status === "uploading" && (
          <div className="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
            <Loader2 size={size * 0.3} className="text-white animate-spin" />
          </div>
        )}

        {/* OK */}
        {status === "ok" && (
          <div className="absolute inset-0 rounded-full bg-status-success/30 flex items-center justify-center">
            <CheckCircle size={size * 0.35} className="text-status-success" />
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div className="absolute inset-0 rounded-full bg-status-error/30 flex items-center justify-center">
            <AlertCircle size={size * 0.35} className="text-status-error" />
          </div>
        )}
      </button>

      {/* Texto de estado */}
      <div className="text-center min-h-[1.2rem]">
        {status === "uploading" && (
          <p className="text-xs text-text-muted">Aplicando marcas de agua…</p>
        )}
        {status === "ok" && (
          <p className="text-xs text-status-success">¡Foto actualizada!</p>
        )}
        {error && (
          <p className="text-xs text-status-error">{error}</p>
        )}
        {status === "idle" && !error && (
          <p className="text-xs text-text-muted">Tap para cambiar foto</p>
        )}
      </div>

      {/* Nota sobre watermark */}
      {status === "idle" && !error && (
        <p className="text-[10px] text-text-muted/60 text-center max-w-[180px]">
          Tu foto lleva marca de agua con tu ID de forma invisible.
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ALLOWED.join(",")}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden
      />
    </div>
  );
}
