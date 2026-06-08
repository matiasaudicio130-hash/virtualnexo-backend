import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { Link, Share2, QrCode, type LucideIcon } from "lucide-react";
import { ProfileQRModal } from "@/components/ProfileQRModal";

interface Props {
  userId: string;
  userName: string;
  onClose: () => void;
}

const reduceMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Bottom-sheet para compartir un perfil: copiar link, compartir nativo o ver QR. */
export function ShareProfileSheet({ userId, userName, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const profileUrl = `${window.location.origin}/profile/${userId}`;

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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* sin permiso de portapapeles */ }
  }

  async function handleNativeShare() {
    if (!navigator.share) return handleCopy();
    try {
      await navigator.share({ title: `${userName} en Aura SW`, url: profileUrl });
      close();
    } catch { /* usuario canceló */ }
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") close(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (showQR) {
    return <ProfileQRModal userId={userId} userName={userName} onClose={() => setShowQR(false)} />;
  }

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div ref={backdropRef} onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(2,2,7,0.7)", backdropFilter: "blur(4px)" }} />
      <div
        ref={sheetRef}
        style={{
          position: "relative", width: "100%", maxWidth: 480, background: "var(--surface)",
          border: "1px solid var(--border-soft)", borderBottom: "none",
          borderRadius: "20px 20px 0 0", padding: "10px 20px 28px",
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: "var(--ash)", margin: "0 auto 18px" }} />
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--mist)", marginBottom: 14, textAlign: "center" }}>
          Compartir perfil
        </p>

        <ShareOption icon={Link} label={copied ? "¡Copiado!" : "Copiar link"} onClick={handleCopy} highlight={copied} />
        <ShareOption icon={Share2} label="Compartir…" onClick={handleNativeShare} />
        <ShareOption icon={QrCode} label="Ver código QR" onClick={() => setShowQR(true)} />
      </div>
    </div>
  );
}

function ShareOption({ icon: Icon, label, onClick, highlight }: { icon: LucideIcon; label: string; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "14px 12px",
        background: "none", border: "none", borderTop: "1px solid var(--border-soft)", cursor: "pointer",
        fontFamily: "var(--font-sans)", fontSize: 14, textAlign: "left",
        color: highlight ? "var(--gold)" : "var(--paper)",
      }}
    >
      <Icon size={17} strokeWidth={1.5} style={{ color: highlight ? "var(--gold)" : "var(--mist)" }}/>
      {label}
    </button>
  );
}
