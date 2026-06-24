import { useState, useEffect, useRef, useCallback } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { X, Check, MapPin, FileText, Link, Camera, Plus, Trash, Lock } from "@phosphor-icons/react";
import { profileApi, extendedProfileApi, authApi, mediaApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import type { ProfileLink } from "@/types";

interface PhotonFeature {
  properties: { name?: string; city?: string; state?: string; country?: string; countrycode?: string; };
}

interface Props {
  onClose:  () => void;
  onSaved?: () => void;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 16px", borderRadius: 14, fontSize: 14,
  background: "var(--smoke)", border: "1px solid var(--border-soft)", color: "var(--paper)",
  fontFamily: "var(--font-sans)", outline: "none",
};
const labelStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mist)",
  fontFamily: "var(--font-mono)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8,
};

/** Drawer de edición de perfil — bottom-sheet (móvil) / modal centrado (desktop), tokens gold/obsidian. */
export function EditProfileDrawer({ onClose, onSaved }: Props) {
  const { user, refreshUser } = useAuthStore();
  const extended = (user as any)?.profile_extended || {};

  const [bio,      setBio]      = useState(user?.bio ?? "");
  const [website,  setWebsite]  = useState(extended.website ?? "");
  const [links,    setLinks]    = useState<ProfileLink[]>(extended.links ?? []);
  const [isPrivate, setIsPrivate] = useState(!!user?.is_private);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");
  const [saved,    setSaved]    = useState(false);

  const [cityInput,        setCityInput]        = useState(user?.city ?? user?.province ?? "");
  const [citySuggestions,  setCitySuggestions]  = useState<PhotonFeature[]>([]);
  const [selectedCity,     setSelectedCity]     = useState<string>(user?.city ?? "");
  const [selectedProvince, setSelectedProvince] = useState<string>(user?.province ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sheetRef    = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!sheetRef.current || !backdropRef.current) return;
    if (reduceMotion()) {
      gsap.set(sheetRef.current, { y: 0 });
      gsap.set(backdropRef.current, { opacity: 1 });
      return;
    }
    gsap.fromTo(backdropRef.current, { opacity: 0 }, { opacity: 1, duration: 0.25, ease: "power1.out" });
    gsap.fromTo(sheetRef.current, { y: "100%" }, { y: 0, duration: 0.35, ease: "power3.out" });
  }, []);

  function close() {
    if (reduceMotion() || !sheetRef.current || !backdropRef.current) return onClose();
    gsap.to(sheetRef.current, { y: "100%", duration: 0.28, ease: "power2.in" });
    gsap.to(backdropRef.current, { opacity: 0, duration: 0.28, onComplete: onClose });
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Ciudad (Photon autocomplete) ──────────────────────────────
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

  // ── Links múltiples (máx. 5) ──────────────────────────────────
  function addLink() {
    if (links.length >= 5) return;
    setLinks(l => [...l, { label: "", url: "" }]);
  }
  function updateLink(i: number, field: keyof ProfileLink, value: string) {
    setLinks(l => l.map((link, idx) => idx === i ? { ...link, [field]: value } : link));
  }
  function removeLink(i: number) {
    setLinks(l => l.filter((_, idx) => idx !== i));
  }

  // ── Avatar drag & drop + crop ─────────────────────────────────
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [cropSrc, setCropSrc]   = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarStatus, setAvatarStatus]   = useState<"idle" | "uploading" | "ok" | "error">("idle");
  const [avatarError, setAvatarError]     = useState("");

  const ALLOWED_IMG = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  function pickFile(file: File | undefined | null) {
    if (!file) return;
    if (!ALLOWED_IMG.includes(file.type)) { setAvatarError("Solo JPEG, PNG o WebP."); return; }
    if (file.size > 5 * 1024 * 1024) { setAvatarError("Máximo 5 MB."); return; }
    setAvatarError("");
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files?.[0]);
  }

  async function handleCropConfirm(blob: Blob) {
    setCropSrc(null);
    const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
    setAvatarStatus("uploading");
    try {
      const { data } = await mediaApi.uploadAvatar(file);
      setAvatarStatus("ok");
      setAvatarPreview(data.url);
      refreshUser?.();
      setTimeout(() => setAvatarStatus("idle"), 2500);
    } catch (e: any) {
      setAvatarStatus("error");
      setAvatarError(e.response?.data?.detail ?? "Error al subir la foto.");
    }
  }

  const avatarSrc = avatarPreview ?? user?.profile_photo_url ?? null;

  // ── Guardar ───────────────────────────────────────────────────
  async function handleSave() {
    setLoading(true); setError("");
    try {
      await profileApi.updateType({
        bio:      bio.trim() || null,
        city:     selectedCity || cityInput.trim() || null,
        province: selectedProvince || null,
      });

      const normalizedWeb = normalizeWebsite(website.trim());
      const cleanLinks = links
        .map(l => ({ label: l.label.trim(), url: normalizeWebsite(l.url.trim()) }))
        .filter(l => l.url);
      await extendedProfileApi.update({ website: normalizedWeb || null, links: cleanLinks });

      if (isPrivate !== !!user?.is_private) {
        await authApi.setPrivacy(isPrivate);
      }

      await refreshUser?.();
      setSaved(true);
      setTimeout(() => { onSaved?.(); close(); }, 800);
    } catch (e: any) {
      setError(e.response?.data?.detail ?? "Error al guardar");
      setLoading(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }} className="sm:items-center">
      <div ref={backdropRef} onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(2,2,7,0.72)", backdropFilter: "blur(6px)" }} />

      <div
        ref={sheetRef}
        className="w-full sm:max-w-md"
        style={{
          position: "relative", background: "var(--surface)", border: "1px solid var(--border-soft)",
          borderBottom: "none", borderRadius: "20px 20px 0 0", overflow: "hidden",
          maxHeight: "88vh", display: "flex", flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 400, color: "var(--paper)" }}>Editar perfil</h2>
          <button onClick={close} style={{ padding: 6, borderRadius: 8, background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
            <X size={18} strokeWidth={1.5}/>
          </button>
        </div>

        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 22, overflowY: "auto" }}>
          {/* Avatar */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              style={{
                width: 96, height: 96, borderRadius: "50%", position: "relative", cursor: "pointer",
                border: `2px dashed ${dragOver ? "var(--gold)" : "var(--border-soft)"}`,
                background: "var(--smoke)", overflow: "hidden",
                transform: dragOver ? "scale(1.05)" : "scale(1)", transition: "transform 0.15s, border-color 0.15s",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >
              {avatarSrc ? (
                <img src={avatarSrc} alt="Avatar" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <Camera size={28} style={{ color: "var(--mist)" }} />
              )}
              {avatarStatus === "uploading" && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,7,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--gold)", letterSpacing: "0.1em" }}>...</span>
                </div>
              )}
              {avatarStatus === "ok" && (
                <div style={{ position: "absolute", inset: 0, background: "rgba(2,2,7,0.45)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Check size={26} style={{ color: "var(--gold)" }} strokeWidth={1.5}/>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept={ALLOWED_IMG.join(",")} className="hidden"
              onChange={e => pickFile(e.target.files?.[0])} aria-hidden />
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mist)" }}>
              {avatarStatus === "uploading" ? "Subiendo…" : avatarStatus === "ok" ? "¡Foto actualizada!" : "Arrastrá o tocá para cambiar"}
            </p>
            {avatarError && <p style={{ fontSize: 11, color: "var(--danger)" }}>{avatarError}</p>}
          </div>

          {/* Nombre (bloqueado post-KYC) */}
          <div style={{ padding: "12px 16px", background: "var(--smoke)", border: "1px solid var(--border-soft)", borderRadius: 14 }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mist)", marginBottom: 4 }}>
              Nombre (verificado con DNI)
            </p>
            <p style={{ fontSize: 14, color: "var(--paper)" }}>{user?.first_name} {user?.last_name}</p>
          </div>

          {/* Bio */}
          <div>
            <label style={labelStyle}><FileText size={12} strokeWidth={1.5}/> Descripción / Bio</label>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={300}
              rows={3}
              placeholder="Contá algo sobre vos (opcional)…"
              style={{ ...inputStyle, resize: "none" }}
            />
            <p style={{ fontSize: 10, color: "var(--mist)", textAlign: "right", marginTop: 4 }}>{bio.length}/300</p>
          </div>

          {/* Website */}
          <div>
            <label style={labelStyle}><Link size={12} strokeWidth={1.5}/> Sitio web principal</label>
            <input
              value={website}
              onChange={e => setWebsite(e.target.value)}
              type="text"
              placeholder="ej: instagram.com/tu_usuario"
              inputMode="url"
              autoCapitalize="none"
              style={inputStyle}
            />
          </div>

          {/* Links adicionales */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}><Link size={12} strokeWidth={1.5}/> Links ({links.length}/5)</label>
              {links.length < 5 && (
                <button onClick={addLink} style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer" }}>
                  <Plus size={12} strokeWidth={1.5}/> Agregar
                </button>
              )}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {links.map((link, i) => (
                <div key={i} style={{ display: "flex", gap: 8 }}>
                  <input
                    value={link.label}
                    onChange={e => updateLink(i, "label", e.target.value)}
                    placeholder="Etiqueta"
                    style={{ ...inputStyle, width: "38%", padding: "10px 12px", fontSize: 13 }}
                  />
                  <input
                    value={link.url}
                    onChange={e => updateLink(i, "url", e.target.value)}
                    placeholder="URL"
                    inputMode="url"
                    autoCapitalize="none"
                    style={{ ...inputStyle, flex: 1, padding: "10px 12px", fontSize: 13 }}
                  />
                  <button onClick={() => removeLink(i)} style={{ flexShrink: 0, padding: "0 8px", background: "none", border: "none", color: "var(--mist)", cursor: "pointer" }}>
                    <Trash size={15} strokeWidth={1.5}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Ciudad */}
          <div style={{ position: "relative" }}>
            <label style={labelStyle}><MapPin size={12} strokeWidth={1.5}/> Ciudad</label>
            <input
              value={cityInput}
              onChange={e => { setCityInput(e.target.value); setSelectedCity(""); setSelectedProvince(""); }}
              placeholder="Ej: Buenos Aires, Madrid, Miami…"
              style={inputStyle}
            />
            {citySuggestions.length > 0 && (
              <div style={{ position: "absolute", zIndex: 10, width: "100%", marginTop: 4, background: "var(--surface)", border: "1px solid var(--border-soft)", borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 32px rgba(0,0,0,0.4)" }}>
                {citySuggestions.map((feat, i) => {
                  const city    = feat.properties.city || feat.properties.name || "";
                  const country = feat.properties.country || "";
                  return (
                    <button key={i} onClick={() => pickCity(feat)}
                      style={{ width: "100%", textAlign: "left", padding: "10px 16px", fontSize: 13, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, color: "var(--paper)" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{city}</span>
                      <span style={{ flexShrink: 0, fontSize: 11, color: "var(--mist)" }}>{country}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Privacidad */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "14px 16px", background: "var(--smoke)", border: "1px solid var(--border-soft)", borderRadius: 14 }}>
            <div style={{ display: "flex", gap: 10 }}>
              <Lock size={16} strokeWidth={1.5} style={{ color: "var(--mist)", marginTop: 2 }}/>
              <div>
                <p style={{ fontSize: 13, color: "var(--paper)" }}>Cuenta privada</p>
                <p style={{ fontSize: 11, color: "var(--mist)", marginTop: 2 }}>Solo quienes apruebes verán tu contenido</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={isPrivate}
              onClick={() => setIsPrivate(p => !p)}
              style={{
                flexShrink: 0, width: 44, height: 26, borderRadius: 999, position: "relative", border: "none", cursor: "pointer",
                background: isPrivate ? "var(--gold)" : "var(--ash)", transition: "background 0.2s",
              }}
            >
              <span style={{
                position: "absolute", top: 3, left: isPrivate ? 21 : 3, width: 20, height: 20, borderRadius: "50%",
                background: "var(--obsidian)", transition: "left 0.2s ease",
              }}/>
            </button>
          </div>

          {error && <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>}

          <Button onClick={handleSave} loading={loading} fullWidth>
            {saved ? <><Check size={15} strokeWidth={1.5}/> Guardado</> : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {cropSrc && (
        <AvatarCropModal src={cropSrc} onCancel={() => setCropSrc(null)} onConfirm={handleCropConfirm} />
      )}
    </div>
  );
}

// ── Crop circular del avatar (react-easy-crop) ──────────────────
function AvatarCropModal({ src, onCancel, onConfirm }: { src: string; onCancel: () => void; onConfirm: (blob: Blob) => void }) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);
  const [working, setWorking] = useState(false);

  const onCropComplete = useCallback((_: Area, pixels: Area) => setArea(pixels), []);

  async function confirm() {
    if (!area) return;
    setWorking(true);
    try {
      const blob = await cropToBlob(src, area);
      if (blob) onConfirm(blob);
    } finally {
      setWorking(false);
    }
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18, background: "rgba(2,2,7,0.92)", backdropFilter: "blur(6px)" }}>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--mist)" }}>Ajustá tu foto</p>
      <div style={{ position: "relative", width: 280, height: 280, borderRadius: 16, overflow: "hidden" }}>
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{ containerStyle: { background: "#080808" } }}
        />
      </div>
      <input type="range" min={1} max={3} step={0.05} value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: 240, accentColor: "var(--gold)" }} />
      <div style={{ display: "flex", gap: 12 }}>
        <Button variant="ghost" size="sm" onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" size="sm" onClick={confirm} loading={working}>
          <Check size={13} strokeWidth={1.5}/> Listo
        </Button>
      </div>
    </div>
  );
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropToBlob(src: string, area: Area): Promise<Blob | null> {
  const img = await loadImage(src);
  const SIZE = 480;
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, SIZE, SIZE);
  return new Promise(resolve => canvas.toBlob(b => resolve(b), "image/jpeg", 0.92));
}
