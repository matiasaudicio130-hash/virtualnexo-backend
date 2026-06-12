/**
 * MyProfileSection — sección "mi perfil" en el Dashboard.
 * Muestra: completitud del perfil, stats privados, preview "así te ven", albums.
 */
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Images, Lock, Plus, Flame, AlertCircle, X } from "lucide-react";
import { albumsApi } from "@/lib/api";
import { toast } from "@/store/toastStore";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Button";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";

const SEEKING_TAGS = [
  { id: "explorar_sin_apuro",   label: "Explorar sin apuro" },
  { id: "charlar_y_ver",        label: "Charlar y ver qué pasa" },
  { id: "planes_y_salidas",     label: "Planes y salidas" },
  { id: "conexiones_reales",    label: "Conexiones reales" },
  { id: "experiencias_nuevas",  label: "Experiencias nuevas" },
  { id: "en_pareja_explorando", label: "En pareja, explorando" },
  { id: "solo_curiosidad",      label: "Solo curiosidad por ahora" },
];

function calcCompleteness(user: any): { pct: number; missing: string[] } {
  const checks = [
    [!!(user.profile_photo_url), "Foto de perfil"],
    [!!(user.username), "Username (@handle)"],
    [!!(user.bio?.trim()), "Bio"],
    [!!(user.province || user.city), "Ubicación"],
    [!!(user.seeking_tags?.length), "Qué buscás"],
    [!!(user.profile_type), "Tipo de perfil"],
    [!!(user.sexual_orientation && user.sexual_orientation !== "na"), "Orientación"],
  ] as [boolean, string][];
  const done = checks.filter(([v]) => v).length;
  const missing = checks.filter(([v]) => !v).map(([, label]) => label);
  return { pct: Math.round((done / checks.length) * 100), missing };
}

/* ── Username setup ─────────────────────────────────────────── */
function UsernameSetup({ onSaved }: { onSaved: (u: string) => void }) {
  const [value, setValue]   = useState("");
  const [status, setStatus] = useState<"idle"|"checking"|"available"|"taken"|"invalid">("idle");
  const [saving, setSaving] = useState(false);

  async function check(val: string) {
    if (val.length < 4) { setStatus("idle"); return; }
    setStatus("checking");
    try {
      const { data } = await albumsApi.checkUsername(val);
      setStatus(data.available ? "available" : data.reason === "invalid_format" ? "invalid" : "taken");
    } catch { setStatus("idle"); }
  }

  async function save() {
    setSaving(true);
    try {
      const { data } = await albumsApi.setUsername(value.toLowerCase());
      onSaved(data.username);
    } catch (e: any) {
      toast.error(e.response?.data?.detail ?? "Error al guardar");
    }
    setSaving(false);
  }

  return (
    <div style={{ padding: "16px", border: "1px solid var(--gold-deep)", borderRadius: "var(--radius-lg)", background: "rgba(201,162,39,0.04)", marginBottom: 16 }}>
      <p className="brand-eyebrow" style={{ marginBottom: 8 }}>Elegí tu username</p>
      <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mist)", marginBottom: 12 }}>
        Así te van a conocer. Podés cambiarlo cada 60 días.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <span style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--mist)" }}>@</span>
          <input
            value={value}
            onChange={e => { setValue(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")); check(e.target.value); }}
            maxLength={20}
            placeholder="tu_nombre"
            style={{
              width: "100%", paddingLeft: 18, paddingBottom: 8,
              background: "transparent", border: "none", borderBottom: "1px solid var(--ash)",
              color: "var(--paper)", fontFamily: "var(--font-mono)", fontSize: 15, outline: "none",
            }}
          />
        </div>
        <Button size="sm" disabled={status !== "available" || saving} onClick={save} loading={saving}>
          Guardar
        </Button>
      </div>
      {status === "available" && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--gold)", marginTop: 6, letterSpacing: "0.12em" }}>✓ Disponible</p>}
      {status === "taken"     && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--danger)", marginTop: 6, letterSpacing: "0.12em" }}>Ya está en uso</p>}
      {status === "invalid"   && <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--danger)", marginTop: 6, letterSpacing: "0.12em" }}>4-20 caracteres: letras, números y _</p>}
    </div>
  );
}

/* ── Seeking editor ─────────────────────────────────────────── */
function SeekingEditor({ current, currentText, onSaved }: { current: string[]; currentText: string; onSaved: () => void }) {
  const [selected, setSelected]  = useState<string[]>(current);
  const [text, setText]          = useState(currentText || "");
  const [saving, setSaving]      = useState(false);
  const [open, setOpen]          = useState(false);

  async function save() {
    setSaving(true);
    try {
      await albumsApi.setSeeking({ tags: selected, text: text || null });
      onSaved();
      setOpen(false);
    } catch { /* ignore */ }
    setSaving(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 0", background: "none", border: "none", cursor: "pointer", color: "var(--gold)", fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase" }}>
        <Plus size={12} strokeWidth={1.5}/> {selected.length ? "Editar qué buscás" : "Agregar qué buscás"}
      </button>
    );
  }

  return (
    <div style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 16 }}>
      <p className="brand-eyebrow" style={{ marginBottom: 10 }}>Qué buscás (hasta 3)</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
        {SEEKING_TAGS.map(tag => {
          const active = selected.includes(tag.id);
          return (
            <button key={tag.id} onClick={() => {
              setSelected(prev => active ? prev.filter(t => t !== tag.id) : prev.length < 3 ? [...prev, tag.id] : prev);
            }} style={{
              padding: "5px 12px", borderRadius: "var(--radius-pill)", fontSize: 12, cursor: "pointer",
              fontFamily: "var(--font-sans)", border: active ? "1px solid var(--gold)" : "1px solid var(--ash)",
              background: active ? "rgba(201,162,39,0.10)" : "transparent",
              color: active ? "var(--gold)" : "var(--mist)",
            }}>
              {tag.label}
            </button>
          );
        })}
      </div>
      <input
        value={text}
        onChange={e => setText(e.target.value.slice(0, 80))}
        placeholder="Algo más (opcional, 80 chars)..."
        style={{
          width: "100%", paddingBottom: 8, marginBottom: 12,
          background: "transparent", border: "none", borderBottom: "1px solid var(--ash)",
          color: "var(--paper)", fontFamily: "var(--font-sans)", fontSize: 13, outline: "none",
        }}
      />
      <div style={{ display: "flex", gap: 8 }}>
        <Button size="sm" onClick={save} loading={saving}>Guardar</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════════ */
export function MyProfileSection() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthStore();
  const [stats, setStats]   = useState<any>(null);
  const [albums, setAlbums] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumPrivate, setNewAlbumPrivate] = useState(false);
  const [openAlbum, setOpenAlbum]   = useState<any | null>(null);
  const [albumPhotos, setAlbumPhotos] = useState<any[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    albumsApi.myStats().then(r => setStats(r.data)).catch(() => {});
    albumsApi.mine().then(r => setAlbums(r.data)).catch(() => {});
  }, []);

  if (!user) return null;

  const { pct, missing } = calcCompleteness(user);

  async function createAlbum() {
    if (!newAlbumTitle.trim()) return;
    try {
      const { data } = await albumsApi.create({ title: newAlbumTitle.trim(), is_private: newAlbumPrivate });
      setAlbums(prev => [...prev, data]);
      setNewAlbumTitle(""); setNewAlbumPrivate(false); setShowCreate(false);
    } catch { /* ignore */ }
  }

  async function handleOpenAlbum(album: any) {
    setOpenAlbum(album);
    try {
      const { data } = await albumsApi.getPhotos(album.id);
      setAlbumPhotos(data || []);
    } catch { setAlbumPhotos([]); }
  }

  async function handleAddPhoto(file: File) {
    if (!openAlbum || uploadingPhoto) return;
    setUploadingPhoto(true);
    try {
      await albumsApi.addPhoto(openAlbum.id, file);
      const { data } = await albumsApi.getPhotos(openAlbum.id);
      setAlbumPhotos(data || []);
      setAlbums(prev => prev.map(a => a.id === openAlbum.id ? { ...a, photos_count: (data || []).length } : a));
    } catch { /* ignore */ }
    setUploadingPhoto(false);
  }

  async function handleDeletePhoto(photoId: string) {
    if (!openAlbum) return;
    try {
      await albumsApi.deletePhoto(openAlbum.id, photoId);
      setAlbumPhotos(prev => prev.filter((p: any) => p.id !== photoId));
      setAlbums(prev => prev.map(a => a.id === openAlbum.id ? { ...a, photos_count: Math.max(0, a.photos_count - 1) } : a));
    } catch { /* ignore */ }
  }

  return (
    <div style={{ padding: "0 0 24px" }}>

      {/* ── Stats privados (solo el usuario los ve) ── */}
      {stats && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 1, marginBottom: 20, background: "var(--border-soft)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {[
            { icon: <Eye size={14} strokeWidth={1.5}/>, value: stats.profile_views_7d, label: "Vistas (7d)", hint: "" },
            { icon: <Lock size={14} strokeWidth={1.5}/>, value: stats.pending_album_requests, label: "Solicitudes", hint: "" },
            { icon: <Flame size={14} strokeWidth={1.5}/>, value: stats.current_streak, label: "Días seguidos", hint: "Días consecutivos activo en Aura" },
          ].map((s, i) => (
            <div key={i} style={{ background: "var(--onyx)", padding: "14px 8px", textAlign: "center" }} title={s.hint || undefined}>
              <div style={{ color: "var(--gold)", display: "flex", justifyContent: "center", marginBottom: 4 }}>{s.icon}</div>
              <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--paper)" }}>{s.value}</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--mist)", letterSpacing: "0.12em", textTransform: "uppercase" }}>{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Completitud del perfil ── */}
      {pct < 100 && (
        <div style={{ marginBottom: 20, padding: "16px", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <p className="brand-eyebrow">{pct < 100 ? "Completá tu perfil" : "Perfil completo ✓"}</p>
              {missing.length > 0 && (
                <p style={{ fontFamily: "var(--font-sans)", fontSize: 11, color: "var(--mist)", marginTop: 2 }}>
                  Falta: {missing.slice(0, 2).join(", ")}{missing.length > 2 ? ` y ${missing.length - 2} más` : ""}
                </p>
              )}
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--gold)" }}>{pct}%</span>
          </div>
          <div style={{ height: 3, background: "var(--smoke)", borderRadius: 2, marginBottom: 12 }}>
            <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg,var(--gold-deep),var(--gold))", borderRadius: 2, transition: "width 0.5s" }}/>
          </div>
          {missing.slice(0, 3).map(m => (
            <div key={m} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <AlertCircle size={11} style={{ color: "var(--mist)", flexShrink: 0 }} strokeWidth={1.5}/>
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 12, color: "var(--mist)" }}>Falta: {m}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Username setup (si no tiene) ── */}
      {!(user as any).username && (
        <UsernameSetup onSaved={async () => { await refreshUser?.(); }}/>
      )}

      {/* ── Qué buscás ── */}
      <SeekingEditor
        current={(user as any).seeking_tags || []}
        currentText={(user as any).seeking_text || ""}
        onSaved={() => refreshUser?.()}
      />

      {/* ── Preview "así te ven" ── */}
      <button
        onClick={() => navigate(`/profile/${user.id}`)}
        style={{
          width: "100%", padding: "12px 16px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          background: "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
          color: "var(--paper)", textAlign: "left",
        }}
      >
        <Eye size={16} style={{ color: "var(--gold)" }} strokeWidth={1.5}/>
        <div>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500 }}>Ver mi perfil</p>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Así te ven los demás</p>
        </div>
      </button>

      {/* ── Albums ── */}
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <p className="brand-eyebrow">Mis albums</p>
        <button onClick={() => setShowCreate(v => !v)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--gold)", display: "flex", alignItems: "center", gap: 4, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase" }}>
          <Plus size={12} strokeWidth={1.5}/> Crear
        </button>
      </div>

      {showCreate && (
        <div style={{ padding: 16, border: "1px solid var(--border-soft)", borderRadius: "var(--radius-lg)", marginBottom: 16 }}>
          <input
            value={newAlbumTitle}
            onChange={e => setNewAlbumTitle(e.target.value)}
            placeholder="Nombre del album"
            style={{ width: "100%", paddingBottom: 8, background: "transparent", border: "none", borderBottom: "1px solid var(--ash)", color: "var(--paper)", fontFamily: "var(--font-sans)", fontSize: 14, outline: "none", marginBottom: 12 }}
          />
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, cursor: "pointer" }}>
            <input type="checkbox" checked={newAlbumPrivate} onChange={e => setNewAlbumPrivate(e.target.checked)} style={{ accentColor: "var(--gold)" }}/>
            <span style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mist)" }}>
              Album privado (solicitud de acceso)
            </span>
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" onClick={createAlbum}>Crear</Button>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {albums.length === 0 && !showCreate && (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <Images size={28} style={{ color: "var(--mist)", margin: "0 auto 8px" }}/>
          <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, color: "var(--mist)" }}>
            Aún no tenés albums. Creá uno para organizar tu contenido.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {albums.map(album => (
          <div
            key={album.id}
            onClick={() => handleOpenAlbum(album)}
            style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-md)", padding: "12px 14px", background: "var(--onyx)", cursor: "pointer" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              {album.is_private && <Lock size={11} style={{ color: "var(--gold)" }} strokeWidth={1.5}/>}
              <p style={{ fontFamily: "var(--font-sans)", fontSize: 13, fontWeight: 500, color: "var(--paper)", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{album.title}</p>
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)", letterSpacing: "0.12em" }}>
              {album.photos_count ?? 0} foto{(album.photos_count ?? 0) !== 1 ? "s" : ""}
              {album.access_requests_count > 0 && ` · ${album.access_requests_count} solicitud${album.access_requests_count !== 1 ? "es" : ""}`}
            </p>
          </div>
        ))}
      </div>

      {/* ── Drawer de album ── */}
      {openAlbum && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(2,2,7,0.96)", display: "flex", flexDirection: "column" }}
          onClick={e => { if (e.target === e.currentTarget) { setOpenAlbum(null); setAlbumPhotos([]); } }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px", borderBottom: "1px solid var(--border-soft)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {openAlbum.is_private && <Lock size={13} style={{ color: "var(--gold)" }} strokeWidth={1.5}/>}
              <span style={{ fontFamily: "var(--font-sans)", fontSize: 15, fontWeight: 500, color: "var(--paper)" }}>{openAlbum.title}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)", letterSpacing: "0.1em" }}>{albumPhotos.length} foto{albumPhotos.length !== 1 ? "s" : ""}</span>
            </div>
            <button
              onClick={() => { setOpenAlbum(null); setAlbumPhotos([]); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mist)", padding: 4 }}
            >
              <X size={18} strokeWidth={1.5}/>
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
              {albumPhotos.map((photo: any) => (
                <div key={photo.id} style={{ position: "relative", aspectRatio: "1", borderRadius: 6, overflow: "hidden", background: "var(--onyx)" }}>
                  <img src={photo.url || photo.photo_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    style={{ position: "absolute", top: 4, right: 4, width: 20, height: 20, borderRadius: "50%", background: "rgba(2,2,7,0.75)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <X size={10} strokeWidth={2} style={{ color: "var(--paper)" }}/>
                  </button>
                </div>
              ))}

              <label
                style={{ aspectRatio: "1", borderRadius: 6, border: "1px dashed var(--ash)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: uploadingPhoto ? "default" : "pointer", opacity: uploadingPhoto ? 0.5 : 1, gap: 4 }}
              >
                {uploadingPhoto
                  ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--mist)" }}>Subiendo...</span>
                  : <>
                      <Plus size={20} strokeWidth={1.5} style={{ color: "var(--mist)" }}/>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--mist)", letterSpacing: "0.1em" }}>AGREGAR</span>
                    </>
                }
                <input
                  type="file"
                  accept="image/*,video/*"
                  style={{ display: "none" }}
                  disabled={uploadingPhoto}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleAddPhoto(f); e.target.value = ""; }}
                />
              </label>
            </div>

            {albumPhotos.length === 0 && !uploadingPhoto && (
              <p style={{ textAlign: "center", padding: "32px 0", color: "var(--mist)", fontFamily: "var(--font-sans)", fontSize: 13 }}>
                Tocá + para subir tu primera foto
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
