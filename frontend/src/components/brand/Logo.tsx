/**
 * Logo — sirve las 4 variantes del logo de Aura SW.
 * Variante primaria (dorado): para la mayoría de los contextos sobre fondo oscuro.
 * Siempre PNG con fondo transparente — no usar mix-blend-mode.
 */
import { CSSProperties } from "react";

type Variant = "primary" | "soft" | "cream" | "dark";

interface LogoProps {
  variant?: Variant;
  size?: number;
  className?: string;
  style?: CSSProperties;
  animate?: boolean; // rotación lenta del aura
}

const LOGO_MAP: Record<Variant, string> = {
  primary: "/brand/logo-aura.png",
  soft:    "/brand/logo-aura-soft.png",
  cream:   "/brand/logo-aura-cream.png",
  dark:    "/brand/logo-aura-dark.png",
};

const GLOW_MAP: Record<Variant, string> = {
  primary: "drop-shadow(0 0 24px rgba(201,162,39,0.55)) drop-shadow(0 0 48px rgba(201,162,39,0.20))",
  soft:    "drop-shadow(0 0 20px rgba(201,162,39,0.40))",
  cream:   "drop-shadow(0 0 16px rgba(239,233,218,0.35))",
  dark:    "none",
};

export function Logo({ variant = "primary", size = 48, className = "", style, animate = false }: LogoProps) {
  return (
    <img
      src={LOGO_MAP[variant]}
      alt="Aura SW"
      draggable={false}
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        objectFit: "contain",
        filter: GLOW_MAP[variant],
        animation: animate ? "aura-rotate 20s linear infinite" : undefined,
        ...style,
      }}
    />
  );
}

/**
 * Wordmark — fallback de texto cuando el logo no se puede usar.
 * Usar cuando size < 80px o en contextos donde el PNG no carga.
 */
export function Wordmark({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <span
      className={className}
      style={{
        fontFamily: '"Cinzel", "Cormorant Garamond", serif',
        fontWeight: 600,
        letterSpacing: "0.2em",
        color: "var(--gold)",
        fontSize: size,
        userSelect: "none",
      }}
    >
      AURA{" "}
      <span style={{ fontSize: size * 0.32, letterSpacing: "0.32em", verticalAlign: "0.85em" }}>
        SW
      </span>
    </span>
  );
}
