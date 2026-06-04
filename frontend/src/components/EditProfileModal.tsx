import { useState, useEffect, useRef } from "react";
import { X, Check, MapPin, FileText, Link2 } from "lucide-react";
import { profileApi, extendedProfileApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";

interface PhotonFeature {
  properties: { name?: string; city?: string; state?: string; country?: string; countrycode?: string; };
}

interface Props {
  onClose:  () => void;
  onSaved?: () => void;
}

export function EditProfileModal({ onClose, onSaved }: Props) {
  const { user, refreshUser } = useAuthStore();
  const extended = (user as any)?.profile_extended || {};

  const [bio,      setBio]      = useState(user?.bio ?? "");
  const [website,  setWebsite]  = useState(extended.website ?? "");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [saved,    setSaved]    = useState(false);

  const [cityInput,        setCityInput]        = useState(user?.city ?? user?.province ?? "");
  const [citySuggestions,  setCitySuggestions]  = useState<PhotonFeature[]>([]);
  const [selectedCity,     setSelectedCity]     = useState<string>(user?.city ?? "");
  const [selectedProvince, setSelectedProvince] = useState<string>(user?.province ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (cityInput.length < 2) { setCitySuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(cityInput)}&lang=es&limit=6`);
        const json = await res.json();
        setCitySuggestions(json.features || []);
      } catch { setCitySuggestions([]); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cityInput]);

  function pickCity(feat: PhotonFeature) {
    const city     = feat.properties.city || feat.properties.name || "";
    const province = feat.properties.state || "";
    const country  = feat.properties.country || "";
    setCityInput([city, country].filter(Boolean).join(", "));
    setSelectedCity(city);
    setSelectedProvince(province);
    setCitySuggestions([]);
  }

  function normalizeWebsite(url: string): string {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  }

  async function handleSave() {
    setLoading(true); setError("");
    try {
      await profileApi.updateType({
        bio:      bio.trim() || null,
        city:     selectedCity || cityInput.trim() || null,
        province: selectedProvince || null,
      });
      // Guardar website en profile_extended (merge)
      const normalizedWeb = normalizeWebsite(website.trim());
      await extendedProfileApi.update({ website: normalizedWeb || null });

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

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
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

          {/* Website */}
          <div>
            <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
              <Link2 size={12} /> Sitio web o link
            </label>
            <input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              type="url"
              placeholder="ej: instagram.com/tu_usuario"
              inputMode="url"
              autoCapitalize="none"
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
            />
          </div>

          {/* Ciudad */}
          <div className="relative">
            <label className="flex items-center gap-1.5 text-xs text-text-secondary mb-2">
              <MapPin size={12} /> Ciudad
            </label>
            <input
              value={cityInput}
              onChange={e => { setCityInput(e.target.value); setSelectedCity(""); setSelectedProvince(""); }}
              placeholder="Ej: Buenos Aires, Madrid, Miami…"
              className="w-full px-4 py-3 rounded-xl bg-bg-muted border border-border text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-purple placeholder-text-muted"
            />
            {citySuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-bg-card border border-border rounded-xl overflow-hidden shadow-xl">
                {citySuggestions.map((feat, i) => {
                  const city    = feat.properties.city || feat.properties.name || "";
                  const country = feat.properties.country || "";
                  return (
                    <button key={i} onClick={() => pickCity(feat)}
                      className="w-full text-left px-4 py-2.5 text-sm hover:bg-bg-muted transition-colors flex items-center justify-between gap-3">
                      <span className="text-text-primary truncate">{city}</span>
                      <span className="text-text-muted text-xs flex-shrink-0">{country}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-xs text-status-error">{error}</p>}

          <Button onClick={handleSave} loading={loading} className="w-full">
            {saved ? <><Check size={15} /> Guardado</> : "Guardar cambios"}
          </Button>
        </div>
      </div>
    </div>
  );
}
