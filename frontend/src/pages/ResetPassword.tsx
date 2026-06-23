import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "@/store/toastStore";
import { NavLogo } from "@/components/AuraLogo";
import { Eye, EyeSlash } from "@phosphor-icons/react";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [password,  setPassword]  = useState("");
  const [confirm,   setConfirm]   = useState("");
  const [showPwd,   setShowPwd]   = useState(false);
  const [showCfm,   setShowCfm]   = useState(false);
  const [status,    setStatus]    = useState<"idle" | "loading" | "done">("idle");
  const [error,     setError]     = useState("");
  const [ready,     setReady]     = useState(false);

  // Supabase maneja el token desde el URL hash automáticamente
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    setStatus("loading");
    const { error: err } = await supabase.auth.updateUser({ password });
    if (err) {
      setError("No pudimos actualizar tu contraseña. El link puede haber expirado.");
      setStatus("idle");
    } else {
      setStatus("done");
      toast.success("Contraseña actualizada correctamente.");
      setTimeout(() => navigate("/feed"), 1500);
    }
  }

  const containerStyle: React.CSSProperties = {
    minHeight: "100dvh", background: "var(--obsidian, #020207)",
    display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", padding: "32px 24px",
  };

  const cardStyle: React.CSSProperties = {
    width: "100%", maxWidth: 400,
    background: "var(--surface, #0e0c09)",
    border: "1px solid rgba(201,162,39,0.12)",
    borderRadius: 20, padding: "36px 32px",
    display: "flex", flexDirection: "column", gap: 24,
  };

  const inputWrap: React.CSSProperties = { position: "relative" };

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 44px 14px 16px",
    background: "var(--bg-muted, #141210)",
    border: "1px solid rgba(201,162,39,0.18)",
    borderRadius: 12, color: "var(--paper, #f5f0e8)",
    fontSize: 15, outline: "none", boxSizing: "border-box",
  };

  const eyeBtn: React.CSSProperties = {
    position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", cursor: "pointer",
    color: "rgba(155,149,144,0.7)", padding: 0,
  };

  const btnStyle: React.CSSProperties = {
    width: "100%", padding: "14px",
    background: "linear-gradient(135deg,#C9A227,#A07818)",
    border: "none", borderRadius: 12, color: "#020207",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    opacity: status === "loading" ? 0.7 : 1,
  };

  if (!ready) {
    return (
      <div style={containerStyle}>
        <div style={{ ...cardStyle, textAlign: "center" }}>
          <NavLogo />
          <p style={{ fontSize: 14, color: "var(--mist, #9b9590)" }}>Verificando enlace…</p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <NavLogo />
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 400, fontStyle: "italic", color: "var(--paper)", marginBottom: 8 }}>
            Nueva contraseña
          </h1>
          <p style={{ fontSize: 13, color: "var(--mist, #9b9590)" }}>
            Elegí una contraseña segura de al menos 8 caracteres.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={inputWrap}>
            <input
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Nueva contraseña"
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            <button type="button" onClick={() => setShowPwd(v => !v)} style={eyeBtn}>
              {showPwd ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <div style={inputWrap}>
            <input
              type={showCfm ? "text" : "password"}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Confirmar contraseña"
              required
              autoComplete="new-password"
              style={inputStyle}
            />
            <button type="button" onClick={() => setShowCfm(v => !v)} style={eyeBtn}>
              {showCfm ? <EyeSlash size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p style={{ fontSize: 13, color: "#ef4444", margin: "-8px 0" }}>{error}</p>}

          <button type="submit" disabled={status === "loading" || status === "done"} style={btnStyle}>
            {status === "loading" ? "Guardando…" : status === "done" ? "¡Listo!" : "Guardar contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
}
