/**
 * Card — sistema de marca Aura SW.
 * Border soft, radius 14px, padding 28px.
 * Prop glow: agrega gradiente dorado sutil en la parte superior.
 */
import { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?:      boolean;
  children:   ReactNode;
  className?: string;
  padding?:   string | number;
}

export function Card({ glow = false, children, className = "", padding = 28, style, ...props }: CardProps) {
  return (
    <div
      className={className}
      style={{
        background: glow
          ? "linear-gradient(180deg, rgba(255,229,102,0.02) 0%, transparent 60%), var(--surface)"
          : "var(--surface)",
        border:       "1px solid var(--border-soft)",
        borderRadius: "var(--radius-lg)",
        padding:      typeof padding === "number" ? `${padding}px` : padding,
        ...style,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
