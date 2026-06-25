import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, MapPin, Heart, FileText, CaretRight, Check, Sparkle, UserPlus } from "@phosphor-icons/react";
import { mediaApi, albumsApi, profileApi, followsApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Logo } from "@/components/brand/Logo";
import { toast } from "@/store/toastStore";

const SEEKING_TAGS = [
  { id: "conexion_real",        label: "Conexión real" },
  { id: "duo_femenino",         label: "Dúo femenino" },
  { id: "parejas_abiertas",     label: "Parejas abiertas" },
  { id: "explorar_en_pareja",   label: "Explorar en pareja" },
  { id: "lifestyle_activo",     label: "Lifestyle activo" },
  { id: "mujeres_solas",        label: "Mujeres solas" },
  { id: "hombres_solos",        label: "Hombres solos" },
  { id: "parejas_para_conocer", label: "Parejas para conocer" },
  { id: "viajes",               label: "Viajes" },
  { id: "eventos",              label: "Eventos" },
  { id: "discrecion",           label: "Discreción" },
  { id: "amistad",              label: "Amistad" },
];

type CityResult = { name: string; state: string; country: string; lat: number; lng: number; display: string };

async function searchCities(q: string): Promise<CityResult[]> {
  if (q.length < 2) return [];
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&featuretype=settlement&format=json&addressdetails=1&limit=6`,
      { signal: ctrl.signal, headers: { "Accept-Language": "es" } }
    );
    return (await res.json()).map((r: any) => ({
      name:    r.address?.city || r.address?.town || r.address?.village || r.name,
      state:   r.address?.state || "",
      country: r.address?.country || "",
      lat:     parseFloat(r.lat),
      lng:     parseFloat(r.lon),
      display: r.display_name?.split(",")[0] || r.name,
    }));
  } catch { return []; }
}

interface SuggestedUser { id: string; name: string; profile_type?: string; province?: string; avatar?: string; }

// ── Step count ─────────────────────────────────────────────────────────────────
//  0 = Bienvenida
//  1 = Foto
//  2 = Bio
//  3 = Qué buscás
//  4 = Ciudad
//  5 = Personas sugeridas
const TOTAL = 5;

const card: React.CSSProperties = {
  width: "100%", maxWidth: 440,
  background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,162,39,0.15)",
  borderRadius: 20, padding: "32px 28px",
};

const goldBtn = (active: boolean): React.CSSProperties => ({
  width: "100%", padding: "15px", borderRadius: 12,
  background: active ? "#C9A227" : "rgba(201,162,39,0.15)",
  border: "none", color: active ? "#020207" : "#666",
  fontSize: 15, fontWeight: 700, cursor: active ? "pointer" : "not-allowed",
  fontFamily: "Manrope, sans-serif",
  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
  transition: "all 0.2s",
});

const h2: React.CSSProperties = {
  color: "#F5F1E8", fontSize: 22,
  fontFamily: "Cormorant Garamond, serif", fontWeight: 400,
  margin: "0 0 8px",
};

const sub: React.CSSProperties = { color: "#9999aa", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 };

export default function OnboardingWizard() {
  const navigate          = useNavigate();
  const { user, updateUser } = useAuthStore();
  const [step, setStep]   = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 1 — Photo
  const [avatarPreview, setAvatarPreview] = useState<string | null>(user?.profile_photo_url || null);
  const [avatarFile,    setAvatarFile]    = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 2 — Bio
  const [bio, setBio] = useState((user as any)?.bio || "");

  // Step 3 — Seeking tags
  const [selectedTags, setSelectedTags] = useState<string[]>((user as any)?.seeking_tags || []);

  // Step 4 — City
  const [cityQuery, setCityQuery] = useState((user as any)?.city || "");
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const cityTimer = useRef<ReturnType<typeof setTimeout>>();

  // Step 5 — Suggestions
  const [suggestions,    setSuggestions]    = useState<SuggestedUser[]>([]);
  const [followedIds,    setFollowedIds]    = useState<Set<string>>(new Set());
  const [loadingSugg,    setLoadingSugg]    = useState(false);

  useEffect(() => {
    if (step === TOTAL) {
      setLoadingSugg(true);
      import("@/lib/api").then(({ discoveryApi }) => {
        discoveryApi.suggestions()
          .then((r: any) => setSuggestions((r.data || []).slice(0, 8)))
          .catch(() => {})
          .finally(() => setLoadingSugg(false));
      });
    }
  }, [step]);

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  }

  function toggleTag(id: string) {
    setSelectedTags(prev =>
      prev.includes(id) ? prev.filter(t => t !== id) : prev.length < 5 ? [...prev, id] : prev
    );
  }

  function onCityInput(val: string) {
    setCityQuery(val);
    setSelectedCity(null);
    clearTimeout(cityTimer.current);
    if (val.length < 2) { setCityResults([]); return; }
    cityTimer.current = setTimeout(async () => setCityResults(await searchCities(val)), 350);
  }

  async function toggleFollow(u: SuggestedUser) {
    try {
      if (followedIds.has(u.id)) {
        await followsApi.unfollow(u.id);
        setFollowedIds(prev => { const n = new Set(prev); n.delete(u.id); return n; });
      } else {
        await followsApi.follow(u.id);
        setFollowedIds(prev => new Set([...prev, u.id]));
      }
    } catch { /* ignore */ }
  }

  async function submitStep() {
    setLoading(true);
    try {
      if (step === 1 && avatarFile) {
        const { data } = await mediaApi.uploadAvatar(avatarFile);
        updateUser?.({ profile_photo_url: data.url });
      }
      if (step === 2 && bio.trim()) {
        await profileApi.updateProfile({ bio: bio.trim() });
        updateUser?.({ bio: bio.trim() });
      }
      if (step === 3 && selectedTags.length > 0) {
        await albumsApi.setSeeking({ tags: selectedTags, text: "" });
        updateUser?.({ seeking_tags: selectedTags });
      }
      if (step === 4 && selectedCity) {
        await profileApi.updateProfile({
          city: selectedCity.name, province: selectedCity.state,
          lat: selectedCity.lat, lng: selectedCity.lng,
        });
        updateUser?.({ city: selectedCity.name, province: selectedCity.state });
      }
      if (step < TOTAL) {
        setStep(s => s + 1);
      } else {
        finish();
      }
    } catch {
      toast.warning("No se pudo guardar este paso. Podés completarlo desde tu perfil más tarde.");
    }
    setLoading(false);
  }

  function skip() {
    if (step < TOTAL) { setStep(s => s + 1); return; }
    finish();
  }

  function finish() {
    localStorage.setItem("onboarding_done", "1");
    navigate("/feed");
  }

  // canContinue per step
  const canContinue =
    step === 0 ||                              // bienvenida — siempre continúa
    (step === 1 && !!avatarFile) ||
    (step === 2 && bio.trim().length >= 3) ||
    (step === 3 && selectedTags.length > 0) ||
    (step === 4 && !!selectedCity) ||
    step === TOTAL;                            // sugerencias — siempre continúa

  const progressSteps = [
    { icon: <Camera size={20} />,    label: "Foto"      },
    { icon: <FileText size={20} />,  label: "Bio"       },
    { icon: <Heart size={20} />,     label: "Buscás"    },
    { icon: <MapPin size={20} />,    label: "Ciudad"    },
    { icon: <UserPlus size={20} />,  label: "Seguir"    },
  ];

  return (
    <div style={{
      minHeight: "100vh", background: "#020207",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "24px 16px", fontFamily: "Manrope, sans-serif",
    }}>
      <div style={{ marginBottom: 28 }}>
        <Logo variant="primary" size={48} />
      </div>

      {/* Progress bar (hidden on welcome step) */}
      {step > 0 && step < TOTAL + 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 24, alignItems: "center" }}>
          {progressSteps.map((s, i) => {
            const idx = i + 1;
            const done    = idx < step;
            const current = idx === step;
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                <div style={{
                  width: current ? 32 : 28, height: current ? 32 : 28, borderRadius: "50%",
                  background: done ? "#C9A227" : current ? "rgba(201,162,39,0.25)" : "rgba(255,255,255,0.05)",
                  border: `1.5px solid ${done || current ? "#C9A227" : "rgba(255,255,255,0.1)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: done ? "#020207" : current ? "#C9A227" : "#555",
                  transition: "all 0.25s",
                }}>
                  {done ? <Check size={14} /> : s.icon}
                </div>
                <span style={{ fontSize: 9, color: current ? "#C9A227" : "#444", textTransform: "uppercase", letterSpacing: 1 }}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Card */}
      <div style={card}>

        {/* ── Step 0: Bienvenida ─────────────────────────────────── */}
        {step === 0 && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✨</div>
            <h2 style={{ ...h2, fontSize: 28, textAlign: "center" }}>
              Bienvenido/a a Aura
            </h2>
            <p style={{ ...sub, textAlign: "center", marginBottom: 24 }}>
              Sos parte de una comunidad adulta verificada, donde la identidad siempre es real.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
              {[
                { e: "🔐", t: "Tu identidad fue verificada con DNI y biometría" },
                { e: "🤝", t: "Las personas que vas a conocer son reales" },
                { e: "🛡",  t: "Tu privacidad está protegida en todo momento" },
              ].map(({ e, t }) => (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", background: "rgba(201,162,39,0.06)", borderRadius: 10 }}>
                  <span style={{ fontSize: 20 }}>{e}</span>
                  <span style={{ color: "#aaa", fontSize: 13, lineHeight: 1.4 }}>{t}</span>
                </div>
              ))}
            </div>
            <p style={{ color: "#666", fontSize: 12, marginBottom: 4 }}>
              Completá tu perfil en 2 minutos para que los demás puedan conocerte.
            </p>
          </div>
        )}

        {/* ── Step 1: Foto ───────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h2 style={h2}>Poné tu mejor foto</h2>
            <p style={sub}>Es lo primero que ve alguien al llegar a tu perfil.</p>
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: 120, height: 120, borderRadius: "50%", margin: "0 auto 24px",
                background: avatarPreview ? `url(${avatarPreview}) center/cover` : "rgba(201,162,39,0.08)",
                border: `2px dashed ${avatarPreview ? "#C9A227" : "rgba(201,162,39,0.3)"}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              {!avatarPreview && <Camera size={32} color="rgba(201,162,39,0.5)" />}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickFile} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} style={{ width: "100%", padding: "12px", background: "rgba(201,162,39,0.1)", border: "1px solid rgba(201,162,39,0.3)", borderRadius: 10, color: "#C9A227", fontSize: 14, cursor: "pointer", fontFamily: "Manrope, sans-serif" }}>
              {avatarPreview ? "Cambiar foto" : "Subir foto"}
            </button>
          </>
        )}

        {/* ── Step 2: Bio ────────────────────────────────────────── */}
        {step === 2 && (
          <>
            <h2 style={h2}>¿Quién sos en pocas palabras?</h2>
            <p style={sub}>Tres líneas son suficientes. Escribí lo que te define.</p>
            <textarea value={bio} onChange={e => setBio(e.target.value)} maxLength={200} rows={4}
              placeholder={"Ej: Fotógrafa. Explorando con curiosidad.\nBuenos Aires."}
              style={{ width: "100%", padding: "14px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 10, color: "#F5F1E8", fontSize: 14, resize: "none", outline: "none", fontFamily: "Manrope, sans-serif", lineHeight: 1.6, boxSizing: "border-box" }}
            />
            <div style={{ textAlign: "right", color: "#555", fontSize: 11, marginTop: 6 }}>{bio.length}/200</div>
            <div style={{ marginTop: 14, padding: "12px 14px", background: "rgba(201,162,39,0.05)", borderRadius: 10, borderLeft: "3px solid rgba(201,162,39,0.4)" }}>
              <p style={{ color: "#9999aa", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                <em>"Diseñadora. Vivo el lifestyle desde hace 5 años. Curiosa y discreta."</em>
              </p>
            </div>
          </>
        )}

        {/* ── Step 3: Seeking tags ───────────────────────────────── */}
        {step === 3 && (
          <>
            <h2 style={h2}>¿Qué te trajo a Aura?</h2>
            <p style={sub}>Elegí hasta 5 tags. Te conectamos con personas que buscan lo mismo.</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {SEEKING_TAGS.map(tag => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button key={tag.id} onClick={() => toggleTag(tag.id)} style={{ padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer", fontFamily: "Manrope, sans-serif", transition: "all 0.15s", background: active ? "#C9A227" : "rgba(201,162,39,0.08)", border: `1px solid ${active ? "#C9A227" : "rgba(201,162,39,0.25)"}`, color: active ? "#020207" : "#C9A227", fontWeight: active ? 700 : 400 }}>
                    {tag.label}
                  </button>
                );
              })}
            </div>
            {selectedTags.length > 0 && (
              <p style={{ color: "#C9A227", fontSize: 12, marginTop: 14, opacity: 0.8 }}>{selectedTags.length}/5 elegidos</p>
            )}
          </>
        )}

        {/* ── Step 4: Ciudad ────────────────────────────────────── */}
        {step === 4 && (
          <>
            <h2 style={h2}>¿Desde dónde explorás?</h2>
            <p style={sub}>Lo usamos para mostrarte personas cerca tuyo.</p>
            <div style={{ position: "relative" }}>
              <input type="text" value={selectedCity ? selectedCity.display : cityQuery} onChange={e => onCityInput(e.target.value)} placeholder="Buscar ciudad..." inputMode="search"
                style={{ width: "100%", padding: "14px 16px", fontSize: "16px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 10, color: "#F5F1E8", outline: "none", fontFamily: "Manrope, sans-serif", boxSizing: "border-box" }}
              />
              {cityResults.length > 0 && !selectedCity && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: "#12121f", border: "1px solid rgba(201,162,39,0.2)", borderRadius: 10, overflow: "hidden" }}>
                  {cityResults.map((c, i) => (
                    <div key={i} onClick={() => { setSelectedCity(c); setCityQuery(c.display); setCityResults([]); }}
                      style={{ padding: "12px 16px", cursor: "pointer", borderBottom: i < cityResults.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                      <div style={{ color: "#F5F1E8", fontSize: 14 }}>{c.display}</div>
                      <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>{[c.state, c.country].filter(Boolean).join(", ")}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCity && (
              <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(201,162,39,0.08)", borderRadius: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <Check size={16} color="#C9A227" />
                <span style={{ color: "#C9A227", fontSize: 13 }}>{selectedCity.display}, {selectedCity.state}</span>
              </div>
            )}
          </>
        )}

        {/* ── Step 5: Sugerencias ────────────────────────────────── */}
        {step === TOTAL && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Sparkle size={20} color="#C9A227" />
              <h2 style={{ ...h2, margin: 0 }}>¡Listo! Conocé a alguien</h2>
            </div>
            <p style={sub}>Seguí a personas que podrían interesarte para empezar a conectar.</p>

            {loadingSugg ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{ height: 80, borderRadius: 12, background: "rgba(255,255,255,0.04)", animation: "aura-pulse 2s infinite" }} />
                ))}
              </div>
            ) : suggestions.length === 0 ? (
              <p style={{ color: "#666", fontSize: 13, textAlign: "center", margin: "20px 0" }}>
                Todavía no hay sugerencias. ¡Explorá el feed para encontrar personas!
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxHeight: 300, overflowY: "auto" }}>
                {suggestions.map(u => {
                  const isFollowed = followedIds.has(u.id);
                  return (
                    <div key={u.id} style={{ padding: "12px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,162,39,0.12)", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", overflow: "hidden", background: "rgba(201,162,39,0.1)", border: "1.5px solid rgba(201,162,39,0.2)" }}>
                        {u.avatar
                          ? <img src={u.avatar} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#C9A227", fontSize: 18 }}>
                              {u.name.charAt(0).toUpperCase()}
                            </div>
                        }
                      </div>
                      <div>
                        <p style={{ color: "#F5F1E8", fontSize: 12, fontWeight: 600, margin: 0 }}>{u.name.split(" ")[0]}</p>
                        {u.province && <p style={{ color: "#666", fontSize: 10, margin: "2px 0 0" }}>{u.province}</p>}
                      </div>
                      <button
                        onClick={() => toggleFollow(u)}
                        style={{ padding: "5px 14px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "Manrope, sans-serif", transition: "all 0.15s", background: isFollowed ? "transparent" : "#C9A227", border: isFollowed ? "1px solid rgba(201,162,39,0.4)" : "none", color: isFollowed ? "#C9A227" : "#020207" }}
                      >
                        {isFollowed ? "Siguiendo" : "Seguir"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={submitStep} disabled={!canContinue || loading} style={goldBtn(canContinue && !loading)}>
            {loading ? "…" :
             step === 0         ? <><span>Empezar</span><CaretRight size={18}/></> :
             step < TOTAL       ? <><span>Continuar</span><CaretRight size={18}/></> :
                                  <><span>¡Entrar a Aura!</span><CaretRight size={18}/></>
            }
          </button>
          {step > 0 && step < TOTAL && (
            <button onClick={skip} style={{ background: "none", border: "none", color: "#555", fontSize: 13, cursor: "pointer", padding: "8px", fontFamily: "Manrope, sans-serif" }}>
              Hacerlo después
            </button>
          )}
        </div>
      </div>

      {step === TOTAL && (
        <p style={{ color: "#444", fontSize: 11, marginTop: 20, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
          Todas las personas en Aura verificaron su identidad con DNI y biometría real.
        </p>
      )}
    </div>
  );
}
