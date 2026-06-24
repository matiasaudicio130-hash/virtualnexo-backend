import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, UserMinus, Check, X } from "@phosphor-icons/react";
import { couplesApi } from "@/lib/api";

interface Partner {
  id: string;
  first_name: string;
  last_name: string;
  username?: string;
  profile_photo_url?: string;
  profile_type?: string;
  province?: string;
  city?: string;
}

interface CoupleStatus {
  partner: Partner | null;
  request_from: Partner | null;
  request_sent_to: string | null;
}

export function CoupleSection() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CoupleStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    couplesApi.status().then(r => setStatus(r.data)).catch(() => {});
  }, []);

  async function sendRequest() {
    if (!targetInput.trim()) return;
    setError("");
    setLoading(true);
    try {
      await couplesApi.request(targetInput.trim());
      const r = await couplesApi.status();
      setStatus(r.data);
      setTargetInput("");
      setOpen(false);
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Error al enviar la solicitud");
    }
    setLoading(false);
  }

  async function accept() {
    if (!status?.request_from) return;
    setLoading(true);
    try {
      await couplesApi.accept(status.request_from.id);
      const r = await couplesApi.status();
      setStatus(r.data);
    } catch {}
    setLoading(false);
  }

  async function decline() {
    if (!status?.request_from) return;
    setLoading(true);
    try {
      await couplesApi.decline(status.request_from.id);
      const r = await couplesApi.status();
      setStatus(r.data);
    } catch {}
    setLoading(false);
  }

  async function unlink() {
    if (!confirm("¿Desvincularse de la pareja?")) return;
    setLoading(true);
    try {
      await couplesApi.unlink();
      setStatus({ partner: null, request_from: null, request_sent_to: null });
    } catch {}
    setLoading(false);
  }

  const gold = "var(--gold, #C9A227)";

  return (
    <div
      style={{
        margin: "0 0 12px", padding: "16px",
        background: "rgba(201,162,39,0.03)",
        border: "1px solid rgba(201,162,39,0.15)",
        borderRadius: 16,
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, color: "#F5F1E8", fontFamily: "Manrope, sans-serif" }}>
          <Heart size={14} color={gold} />
          Perfil de pareja
          {status?.partner && (
            <span style={{ fontSize: 11, color: gold, fontWeight: 400 }}>· Vinculado</span>
          )}
          {status?.request_from && (
            <span style={{ fontSize: 11, background: gold, color: "#020207", padding: "1px 8px", borderRadius: 10, fontWeight: 700 }}>
              1 solicitud
            </span>
          )}
        </span>
        <span style={{ fontSize: 11, color: gold }}>{open ? "Cerrar" : "Ver"}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>

          {/* Pareja vinculada */}
          {status?.partner && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "rgba(201,162,39,0.06)", borderRadius: 12, marginBottom: 12 }}>
              <div
                style={{
                  width: 44, height: 44, borderRadius: "50%", flexShrink: 0, border: `2px solid ${gold}`,
                  background: status.partner.profile_photo_url ? `url(${status.partner.profile_photo_url}) center/cover` : "rgba(201,162,39,0.1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: gold, fontSize: 16,
                }}
              >
                {!status.partner.profile_photo_url && status.partner.first_name.charAt(0)}
              </div>
              <div style={{ flex: 1 }}>
                <button
                  onClick={() => navigate(`/profile/${status.partner!.id}`)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#F5F1E8", fontFamily: "Manrope, sans-serif" }}>
                    {status.partner.username ? `@${status.partner.username}` : `${status.partner.first_name} ${status.partner.last_name}`}
                  </p>
                  <p style={{ fontSize: 11, color: "#888" }}>
                    {[status.partner.city, status.partner.province].filter(Boolean).join(", ")}
                  </p>
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 10, color: gold, border: `1px solid ${gold}`, padding: "2px 8px", borderRadius: 8 }}>
                  Pareja verificada
                </span>
                <button
                  onClick={unlink}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#666", padding: 4 }}
                  title="Desvincular"
                >
                  <UserMinus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Solicitud recibida */}
          {status?.request_from && !status.partner && (
            <div style={{ padding: "12px", background: "rgba(201,162,39,0.08)", borderRadius: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#F5F1E8", marginBottom: 10, fontFamily: "Manrope, sans-serif" }}>
                <strong>
                  {status.request_from.username ? `@${status.request_from.username}` : status.request_from.first_name}
                </strong>{" "}
                quiere vincularse como pareja
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={accept}
                  disabled={loading}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, background: gold, border: "none", color: "#020207", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <Check size={13} /> Aceptar
                </button>
                <button
                  onClick={decline}
                  disabled={loading}
                  style={{ flex: 1, padding: "8px", borderRadius: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#888", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
                >
                  <X size={13} /> Rechazar
                </button>
              </div>
            </div>
          )}

          {/* Solicitud enviada pendiente */}
          {status?.request_sent_to && !status.partner && (
            <div style={{ padding: "10px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 12, marginBottom: 12 }}>
              <p style={{ fontSize: 12, color: "#888", fontFamily: "Manrope, sans-serif" }}>
                Solicitud enviada — esperando respuesta
              </p>
            </div>
          )}

          {/* Formulario para enviar solicitud */}
          {!status?.partner && !status?.request_sent_to && !status?.request_from && (
            <div>
              <p style={{ fontSize: 12, color: "#777", marginBottom: 10, lineHeight: 1.5, fontFamily: "Manrope, sans-serif" }}>
                Ingresá el ID de usuario de tu pareja para enviarle una solicitud de vinculación.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="text"
                  value={targetInput}
                  onChange={e => setTargetInput(e.target.value)}
                  placeholder="ID de usuario"
                  style={{
                    flex: 1, padding: "10px 12px", borderRadius: 10,
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(201,162,39,0.2)",
                    color: "#F5F1E8", fontSize: 13, outline: "none", fontFamily: "Manrope, sans-serif",
                  }}
                />
                <button
                  onClick={sendRequest}
                  disabled={!targetInput.trim() || loading}
                  style={{
                    padding: "10px 16px", borderRadius: 10, border: "none",
                    background: targetInput.trim() ? gold : "rgba(201,162,39,0.2)",
                    color: targetInput.trim() ? "#020207" : "#666",
                    fontSize: 12, fontWeight: 700, cursor: targetInput.trim() ? "pointer" : "not-allowed",
                    fontFamily: "Manrope, sans-serif",
                  }}
                >
                  {loading ? "..." : "Enviar"}
                </button>
              </div>
              {error && <p style={{ fontSize: 11, color: "#f87171", marginTop: 8 }}>{error}</p>}
              <p style={{ fontSize: 11, color: "#555", marginTop: 8, fontFamily: "Manrope, sans-serif" }}>
                Tu ID: <code style={{ color: gold, fontSize: 11 }}>{/* user ID shown via parent */}</code>
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
