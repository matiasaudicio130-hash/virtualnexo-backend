import { useState } from "react";
import { Link } from "react-router-dom";
import { EnvelopeSimple } from "@phosphor-icons/react";
import { supabase } from "@/lib/supabase";
import { NavLogo } from "@/components/AuraLogo";

export default function ForgotPassword() {
  const [email,   setEmail]   = useState("");
  const [status,  setStatus]  = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [errMsg,  setErrMsg]  = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "https://aurasw.club/reset-password",
    });
    if (error) {
      setErrMsg("No encontramos una cuenta con ese email.");
      setStatus("error");
    } else {
      setStatus("sent");
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

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "14px 16px",
    background: "var(--bg-muted, #141210)",
    border: "1px solid rgba(201,162,39,0.18)",
    borderRadius: 12, color: "var(--paper, #f5f0e8)",
    fontSize: 15, outline: "none", boxSizing: "border-box",
  };

  const btnStyle: React.CSSProperties = {
    width: "100%", padding: "14px",
    background: "linear-gradient(135deg,#C9A227,#A07818)",
    border: "none", borderRadius: 12, color: "#020207",
    fontSize: 15, fontWeight: 700, cursor: "pointer",
    opacity: status === "loading" ? 0.7 : 1,
  };

  if (status === "sent") {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <NavLogo />
          <div style={{ textAlign: "center" }}>
            <EnvelopeSimple size={40} weight="light" style={{ color: "#C9A227", margin: "0 auto 16px" }} />
            <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 400, fontStyle: "italic", color: "var(--paper)", marginBottom: 12 }}>
              Revisá tu email
            </h1>
            <p style={{ fontSize: 14, color: "var(--mist, #9b9590)", lineHeight: 1.6 }}>
              Te mandamos las instrucciones para recuperar tu contraseña.<br />
              Revisá también tu carpeta de spam.
            </p>
          </div>
          <Link to="/login" style={{ textAlign: "center", fontSize: 13, color: "rgba(201,162,39,0.7)" }}>
            Volver al login
          </Link>
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
            Recuperar contraseña
          </h1>
          <p style={{ fontSize: 13, color: "var(--mist, #9b9590)" }}>
            Ingresá tu email y te enviamos un link para crear una nueva.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <input
            type="email"
            value={email}
            onChange={e => { setEmail(e.target.value); setStatus("idle"); }}
            placeholder="tu@email.com"
            required
            autoComplete="email"
            style={inputStyle}
          />
          {status === "error" && (
            <p style={{ fontSize: 13, color: "#ef4444", margin: "-8px 0" }}>{errMsg}</p>
          )}
          <button type="submit" disabled={status === "loading"} style={btnStyle}>
            {status === "loading" ? "Enviando…" : "Enviar instrucciones"}
          </button>
        </form>

        <Link to="/login" style={{ textAlign: "center", fontSize: 13, color: "rgba(201,162,39,0.7)" }}>
          Volver al login
        </Link>
      </div>
    </div>
  );
}
