/**
 * AuraLogo — componente unificado de marca para toda la app.
 *
 * variant="full"    → logo completo con texto AURA (hero, login)
 * variant="mark"    → solo el mark circular (header, favicon)
 * variant="wordmark"→ solo texto AURA sin mark
 *
 * El truco mix-blend-mode:screen hace que el fondo negro
 * de las imágenes sea invisible sobre fondos oscuros.
 */

interface Props {
  variant?: "full" | "mark" | "wordmark";
  size?: number;
  animate?: boolean;
  light?: boolean; // true = usar versión para fondos claros
  className?: string;
}

export function AuraLogo({
  variant = "mark",
  size = 40,
  animate = false,
  light = false,
  className = "",
}: Props) {

  const spinStyle: React.CSSProperties = animate
    ? { animation: "aura-spin 22s linear infinite" }
    : {};

  const glowStyle: React.CSSProperties = {
    filter: light
      ? "none"
      : "drop-shadow(0 0 8px rgba(201,162,39,0.55))",
  };

  const blendStyle: React.CSSProperties = light
    ? {}
    : { mixBlendMode: "screen" as const };

  if (variant === "wordmark") {
    return (
      <span
        className={`font-light tracking-[.28em] text-amber-400 ${className}`}
        style={{ fontSize: size * 0.28, letterSpacing: "0.28em" }}
      >
        AURA
      </span>
    );
  }

  if (variant === "full") {
    const src = light ? "/brand/logo-light-digital.png" : "/brand/logo-full-dark.jpg";
    return (
      <img
        src={src}
        alt="AURA"
        draggable={false}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          ...glowStyle,
          ...blendStyle,
          ...spinStyle,
        }}
      />
    );
  }

  // variant="mark" — anillos sin texto
  const src = light ? "/brand/logo-light-digital.png" : "/brand/logo-mark-dark.png";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }} className={className}>
      <img
        src={src}
        alt="AURA"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          ...glowStyle,
          ...blendStyle,
          ...spinStyle,
        }}
      />
    </div>
  );
}

/** Logo de nav — logo completo estático, sin animación */
export function NavLogo({ light = false }: { light?: boolean }) {
  // logo-full-dark-removebg-preview.png tiene canal alpha real (removebg.com)
  const src = light ? "/brand/logo-light-digital.png" : "/brand/logo-full-dark-removebg-preview.png";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <img
        src={src}
        alt="AURA"
        draggable={false}
        style={{
          width: 36,
          height: 36,
          objectFit: "contain",
          filter: light ? "none" : "drop-shadow(0 0 6px rgba(201,162,39,0.5))",
        }}
      />
      <span style={{
        fontSize: 11,
        letterSpacing: "0.32em",
        fontWeight: 300,
        color: light ? "#7a5010" : "rgba(255,229,102,0.82)",
        textTransform: "uppercase" as const,
      }}>
        AURA
      </span>
    </div>
  );
}
