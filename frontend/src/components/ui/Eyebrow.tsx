/**
 * Eyebrow — kicker/label en JetBrains Mono uppercase.
 * Color "accent" (gold) o "muted" (gris).
 */
import { HTMLAttributes, ReactNode } from "react";

interface EyebrowProps extends HTMLAttributes<HTMLParagraphElement> {
  children:   ReactNode;
  muted?:     boolean;
  className?: string;
}

export function Eyebrow({ children, muted = false, className = "", style, ...props }: EyebrowProps) {
  return (
    <p
      className={className}
      style={{
        fontFamily:    "var(--font-mono)",
        fontSize:      "var(--fs-eyebrow)",
        letterSpacing: "var(--tracking-eyebrow)",
        textTransform: "uppercase",
        color:         muted ? "var(--fg-mute)" : "var(--gold)",
        fontWeight:    500,
        margin:        0,
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
}
