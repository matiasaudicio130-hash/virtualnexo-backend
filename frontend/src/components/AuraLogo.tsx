/**
 * AuraLogo — componente unificado de marca para toda la app.
 *
 * variant="full"     → logo completo (hero, login)
 * variant="mark"     → mark circular (header)
 * variant="wordmark" → solo texto AURA
 *
 * Usa logo-aura-soft.png — PNG con fondo transparente real.
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
    return (
      <img
        src="/brand/logo-aura-soft.png"
        alt="AURA"
        draggable={false}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: "contain",
          ...glowStyle,
          ...spinStyle,
        }}
      />
    );
  }

  // variant="mark" — usa el mismo PNG transparente
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }} className={className}>
      <img
        src="/brand/logo-aura-soft.png"
        alt="AURA"
        draggable={false}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "contain",
          ...glowStyle,
          ...spinStyle,
        }}
      />
    </div>
  );
}

/** Logo de nav — logo completo estático, sin animación */
export function NavLogo({ light = false }: { light?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <img
        src="/brand/logo-aura-soft.png"
        alt="AURA"
        draggable={false}
        style={{
          width: 38,
          height: 38,
          objectFit: "contain",
          filter: light
            ? "brightness(0.6) sepia(1) saturate(3)"
            : "drop-shadow(0 0 6px rgba(201,162,39,0.45))",
        }}
      />
    </div>
  );
}
