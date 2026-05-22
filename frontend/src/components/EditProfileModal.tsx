/**
 * EditProfileModal — edición de datos básicos del perfil.
 * Campos: bio, ciudad, provincia.
 * Nombre y email son inmutables post-KYC.
 */
import { useState } from "react";
import { X, Check, MapPin, FileText } from "lucide-react";
import { profileApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";

const AR_PROVINCES = [
  "Buenos Aires", "CABA", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero",
  "Tierra del Fuego", "Tucumán",
];

interface Props {
  onClose: () => void;
  onSaved?: () => void;
}

export function EditProfileModal({ onClose, onSaved }: Props) {
  const { user, refreshUser } = useAuthStore();

  const [bio,      setBio]      = useState(user?.bio ?? "");
  const [city,     setCity]     = useState(user?.city ?? "");
  const [province, setProvince] = useState(user?.province ?? "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [saved,    setSaved]    = useState(false);

  async function handleSave() {
    setLoading(true); setError("");
    try {
      await profileApi.updateType({ bio: bio.trim() || null, city: city.trim() || null, province: province || null });
      await refreshUser?.();
      setSaved(true);
      setTimeout(() => { onSaved?.(); onClose(); }, 800);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al guardar");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full sm:max-w-md bg-bg-card border border-border rounded-t-3xl sm:rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-sm">Editar perfil</h2>
          <button onClick={onClose} className="p-1.5 hover:bg-bg-muted rounded-lg text-text-muted">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Nombre (bloqueado post-KYC) */}
          <div className="px-4 py-3 bg-bg-muted/50 border border-border/60 rounded-xl">
            <p className="text-[10px] text-text-muted uppercase tracking-widest mb-1">Nombre (verificado con DNI)</p>
            <p className="text-sm font-medium text-text-primary">{user?.first_name} {user?.last_name}</p>
          </div>

          {/* Bio */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
              <FileText size={12} /> Descripción / Bio
            </label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Contá algo sobre vos (opcional)…"
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm text-text-primary resize-none focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
            />
            <p className="text-xs text-text-muted text-right mt-1">{bio.length}/300</p>
          </div>

          {/* Provincia */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
              <MapPin size={12} /> Provincia
            </label>
            <select
              value={province}
              onChange={e => setProvince(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple"
            >
              <option value="">— No especificar —</option>
              {AR_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          {/* Ciudad */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
              <MapPin size={12} /> Ciudad (opcional)
            </label>
            <input
              value={city}
              onChange={e => setCity(e.target.value)}
              maxLength={80}
              placeholder="Ej: Palermo, Córdoba capital…"
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
            />
          </div>

          {error && <p className="text-xs text-status-error">{error}</p>}

          <Button onClick={handleSave} loading={loading} className="w-full">
            {saved
              ? <><Check size={15} /> Guardado</>
              : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
