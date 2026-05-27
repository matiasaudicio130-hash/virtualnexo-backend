import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, MapPin, Heart, FileText, ChevronRight, Check } from "lucide-react";
import { mediaApi, albumsApi, profileApi } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Logo } from "@/components/brand/Logo";

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
    const data = await res.json();
    return data.map((r: any) => ({
      name: r.address?.city || r.address?.town || r.address?.village || r.name,
      state: r.address?.state || "",
      country: r.address?.country || "",
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      display: r.display_name?.split(",")[0] || r.name,
    }));
  } catch { return []; }
}

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // Step 0 — Photo
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Step 1 — Bio
  const [bio, setBio] = useState("");

  // Step 2 — Seeking tags
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Step 3 — City
  const [cityQuery, setCityQuery] = useState("");
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [selectedCity, setSelectedCity] = useState<CityResult | null>(null);
  const cityTimer = useRef<ReturnType<typeof setTimeout>>();

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
    cityTimer.current = setTimeout(async () => {
      const results = await searchCities(val);
      setCityResults(results);
    }, 350);
  }

  async function submitStep() {
    setLoading(true);
    try {
      if (step === 0 && avatarFile) {
        const { data } = await mediaApi.uploadAvatar(avatarFile);
        updateUser?.({ profile_photo_url: data.url });
      }
      if (step === 1 && bio.trim()) {
        await profileApi.updateProfile({ bio: bio.trim() });
        updateUser?.({ bio: bio.trim() });
      }
      if (step === 2 && selectedTags.length > 0) {
        await albumsApi.setSeeking({ tags: selectedTags, text: "" });
        updateUser?.({ seeking_tags: selectedTags });
      }
      if (step === 3 && selectedCity) {
        await profileApi.updateProfile({
          city: selectedCity.name,
          province: selectedCity.state,
          lat: selectedCity.lat,
          lng: selectedCity.lng,
        });
        updateUser?.({ city: selectedCity.name, province: selectedCity.state });
      }
      if (step < 3) {
        setStep(s => s + 1);
      } else {
        localStorage.setItem("onboarding_done", "1");
        navigate("/feed");
      }
    } catch { /* non-blocking */ }
    setLoading(false);
  }

  function skip() {
    if (step < 3) { setStep(s => s + 1); return; }
    localStorage.setItem("onboarding_done", "1");
    navigate("/feed");
  }

  const steps = [
    { icon: <Camera size={22} />, label: "Tu foto" },
    { icon: <FileText size={22} />, label: "Tu bio" },
    { icon: <Heart size={22} />, label: "Qué buscás" },
    { icon: <MapPin size={22} />, label: "Tu ciudad" },
  ];

  const canContinue =
    (step === 0 && !!avatarFile) ||
    (step === 1 && bio.trim().length >= 3) ||
    (step === 2 && selectedTags.length > 0) ||
    (step === 3 && !!selectedCity);

  return (
    <div style={{
      minHeight: "100vh", background: "#020207", display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: "24px 16px",
      fontFamily: "Manrope, sans-serif",
    }}>
      {/* Logo */}
      <div style={{ marginBottom: 32 }}>
        <Logo variant="primary" size={52} />
      </div>

      {/* Progress dots */}
      <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
        {steps.map((s, i) => (
          <div key={i} style={{
            width: i === step ? 28 : 10, height: 10, borderRadius: 5,
            background: i < step ? "#C9A227" : i === step ? "#C9A227" : "#1a1a2e",
            transition: "all 0.3s ease",
            opacity: i > step ? 0.4 : 1,
          }} />
        ))}
      </div>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 440,
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,162,39,0.15)",
        borderRadius: 20, padding: "32px 28px",
      }}>

        {/* Step header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ color: "#C9A227" }}>{steps[step].icon}</div>
          <span style={{ fontSize: 11, letterSpacing: 2, color: "#C9A227", fontFamily: "JetBrains Mono, monospace", textTransform: "uppercase" }}>
            {step + 1} de 4
          </span>
        </div>

        {/* Step 0 — Photo */}
        {step === 0 && (
          <>
            <h2 style={{ color: "#F5F1E8", fontSize: 22, fontFamily: "Cormorant Garamond, serif", fontWeight: 400, margin: "0 0 8px" }}>
              Poné tu mejor foto
            </h2>
            <p style={{ color: "#9999aa", fontSize: 13, margin: "0 0 28px", lineHeight: 1.5 }}>
              Es lo primero que ve alguien cuando llega a tu perfil.
            </p>
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
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: "100%", padding: "12px", background: "rgba(201,162,39,0.1)",
                border: "1px solid rgba(201,162,39,0.3)", borderRadius: 10,
                color: "#C9A227", fontSize: 14, cursor: "pointer", fontFamily: "Manrope, sans-serif",
              }}
            >
              {avatarPreview ? "Cambiar foto" : "Subir foto"}
            </button>
          </>
        )}

        {/* Step 1 — Bio */}
        {step === 1 && (
          <>
            <h2 style={{ color: "#F5F1E8", fontSize: 22, fontFamily: "Cormorant Garamond, serif", fontWeight: 400, margin: "0 0 8px" }}>
              ¿Quién sos en pocas palabras?
            </h2>
            <p style={{ color: "#9999aa", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              Tres líneas son suficientes. Escribí lo que te define.
            </p>
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              maxLength={200}
              rows={4}
              placeholder={"Ej: Fotógrafa. Explorando con curiosidad.\nBuenos Aires."}
              style={{
                width: "100%", padding: "14px", background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(201,162,39,0.2)", borderRadius: 10,
                color: "#F5F1E8", fontSize: 14, resize: "none", outline: "none",
                fontFamily: "Manrope, sans-serif", lineHeight: 1.6,
                boxSizing: "border-box",
              }}
            />
            <div style={{ textAlign: "right", color: "#555", fontSize: 11, marginTop: 6 }}>
              {bio.length}/200
            </div>
            <div style={{ marginTop: 16, padding: "12px 14px", background: "rgba(201,162,39,0.05)", borderRadius: 10, borderLeft: "3px solid rgba(201,162,39,0.4)" }}>
              <p style={{ color: "#9999aa", fontSize: 12, margin: 0, lineHeight: 1.6 }}>
                <em>"Diseñadora. Vivo el lifestyle desde hace 5 años. Curiosa y discreta."</em>
              </p>
            </div>
          </>
        )}

        {/* Step 2 — Seeking tags */}
        {step === 2 && (
          <>
            <h2 style={{ color: "#F5F1E8", fontSize: 22, fontFamily: "Cormorant Garamond, serif", fontWeight: 400, margin: "0 0 8px" }}>
              ¿Qué te trajo a Aura?
            </h2>
            <p style={{ color: "#9999aa", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              Elegí hasta 5 tags. Los usamos para conectarte con personas que buscan lo mismo.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {SEEKING_TAGS.map(tag => {
                const active = selectedTags.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.id)}
                    style={{
                      padding: "8px 16px", borderRadius: 20, fontSize: 13, cursor: "pointer",
                      fontFamily: "Manrope, sans-serif", transition: "all 0.15s",
                      background: active ? "#C9A227" : "rgba(201,162,39,0.08)",
                      border: `1px solid ${active ? "#C9A227" : "rgba(201,162,39,0.25)"}`,
                      color: active ? "#020207" : "#C9A227",
                      fontWeight: active ? 700 : 400,
                    }}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
            {selectedTags.length > 0 && (
              <p style={{ color: "#C9A227", fontSize: 12, marginTop: 14, opacity: 0.8 }}>
                {selectedTags.length}/5 elegidos
              </p>
            )}
          </>
        )}

        {/* Step 3 — City */}
        {step === 3 && (
          <>
            <h2 style={{ color: "#F5F1E8", fontSize: 22, fontFamily: "Cormorant Garamond, serif", fontWeight: 400, margin: "0 0 8px" }}>
              ¿Desde dónde explorás?
            </h2>
            <p style={{ color: "#9999aa", fontSize: 13, margin: "0 0 20px", lineHeight: 1.5 }}>
              Lo usamos para mostrarte personas cerca tuyo.
            </p>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                value={selectedCity ? selectedCity.display : cityQuery}
                onChange={e => onCityInput(e.target.value)}
                placeholder="Buscar ciudad..."
                inputMode="search"
                style={{
                  width: "100%", padding: "14px 16px", fontSize: "16px",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)",
                  borderRadius: 10, color: "#F5F1E8", outline: "none",
                  fontFamily: "Manrope, sans-serif", boxSizing: "border-box",
                }}
              />
              {cityResults.length > 0 && !selectedCity && (
                <div style={{
                  position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
                  background: "#12121f", border: "1px solid rgba(201,162,39,0.2)",
                  borderRadius: 10, overflow: "hidden",
                }}>
                  {cityResults.map((c, i) => (
                    <div
                      key={i}
                      onClick={() => { setSelectedCity(c); setCityQuery(c.display); setCityResults([]); }}
                      style={{
                        padding: "12px 16px", cursor: "pointer", borderBottom: i < cityResults.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
                      }}
                    >
                      <div style={{ color: "#F5F1E8", fontSize: 14 }}>{c.display}</div>
                      <div style={{ color: "#666", fontSize: 12, marginTop: 2 }}>
                        {[c.state, c.country].filter(Boolean).join(", ")}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedCity && (
              <div style={{
                marginTop: 12, padding: "10px 14px", background: "rgba(201,162,39,0.08)",
                borderRadius: 10, display: "flex", alignItems: "center", gap: 8,
              }}>
                <Check size={16} color="#C9A227" />
                <span style={{ color: "#C9A227", fontSize: 13 }}>
                  {selectedCity.display}, {selectedCity.state}
                </span>
              </div>
            )}
          </>
        )}

        {/* Actions */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
          <button
            onClick={submitStep}
            disabled={!canContinue || loading}
            style={{
              width: "100%", padding: "15px", borderRadius: 12,
              background: canContinue ? "#C9A227" : "rgba(201,162,39,0.2)",
              border: "none", color: canContinue ? "#020207" : "#666",
              fontSize: 15, fontWeight: 700, cursor: canContinue ? "pointer" : "not-allowed",
              fontFamily: "Manrope, sans-serif", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8, transition: "all 0.2s",
            }}
          >
            {loading ? "..." : step < 3 ? (
              <><span>Continuar</span><ChevronRight size={18} /></>
            ) : (
              <><span>Entrar a Aura</span><ChevronRight size={18} /></>
            )}
          </button>
          <button
            onClick={skip}
            style={{
              background: "none", border: "none", color: "#555", fontSize: 13,
              cursor: "pointer", padding: "8px", fontFamily: "Manrope, sans-serif",
            }}
          >
            Hacerlo después
          </button>
        </div>
      </div>

      {/* Welcome message step 3 */}
      {step === 3 && (
        <p style={{ color: "#555", fontSize: 12, marginTop: 24, textAlign: "center", maxWidth: 300, lineHeight: 1.6 }}>
          Todas las personas que vas a ver verificaron su identidad con DNI y biometría.
        </p>
      )}
    </div>
  );
}
