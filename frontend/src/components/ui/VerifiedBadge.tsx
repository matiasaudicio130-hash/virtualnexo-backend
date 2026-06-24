/**
 * VerifiedBadge — pill que indica un usuario verificado.
 * Border gold-deep, ícono shield-check, texto en eyebrow style.
 */
import { ShieldCheck } from "@phosphor-icons/react";

interface VerifiedBadgeProps {
  label?: string;
  size?:  "sm" | "md";
  className?: string;
}

export function VerifiedBadge({ label = "Verificado", size = "md", className = "" }: VerifiedBadgeProps) {
  const iconSize = size === "sm" ? 11 : 13;
  const fontSize = size === "sm" ? 9 : 10;

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      style={{
        padding:       size === "sm" ? "3px 8px" : "4px 10px",
        border:        "1px solid var(--gold-deep)",
        borderRadius:  "var(--radius-pill)",
        background:    "rgba(138,107,20,0.08)",
        color:         "var(--gold-bright)",
        fontFamily:    "var(--font-mono)",
        fontSize,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight:    500,
        whiteSpace:    "nowrap",
      }}
    >
      <ShieldCheck size={iconSize} strokeWidth={1.5} />
      {label}
    </span>
  );
}
