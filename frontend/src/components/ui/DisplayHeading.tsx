/**
 * DisplayHeading — Cormorant Garamond en 4 tamaños.
 * level 1 = display-xl (hero) → level 4 = display-m (card heading).
 */
import { HTMLAttributes, ReactNode, ElementType } from "react";

type Level = 1 | 2 | 3 | 4;

interface DisplayHeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?:     Level;
  italic?:    boolean;
  gradient?:  boolean; // aplica gradiente dorado
  children:   ReactNode;
  className?: string;
}

const TAG_MAP: Record<Level, ElementType> = { 1: "h1", 2: "h2", 3: "h3", 4: "h4" };

const SIZE_MAP: Record<Level, string> = {
  1: "var(--fs-display-xl)",
  2: "var(--fs-display-l)",
  3: "var(--fs-display-m)",
  4: "clamp(22px,2vw,28px)",
};

const LH_MAP: Record<Level, string> = { 1: "1.02", 2: "1.08", 3: "1.15", 4: "1.2" };
const LS_MAP: Record<Level, string> = { 1: "-0.015em", 2: "-0.012em", 3: "-0.01em", 4: "-0.008em" };

const GOLD_GRADIENT = "linear-gradient(135deg,#C9A227 0%,#E6C25A 50%,#8A6B14 100%)";

export function DisplayHeading({
  level = 2,
  italic = false,
  gradient = false,
  children,
  className = "",
  style,
  ...props
}: DisplayHeadingProps) {
  const Tag = TAG_MAP[level];

  return (
    <Tag
      className={className}
      style={{
        fontFamily:    "var(--font-display)",
        fontWeight:    400,
        fontStyle:     italic ? "italic" : "normal",
        fontSize:      SIZE_MAP[level],
        lineHeight:    LH_MAP[level],
        letterSpacing: LS_MAP[level],
        color:         gradient ? "transparent" : "var(--paper)",
        ...(gradient ? {
          background:             GOLD_GRADIENT,
          WebkitBackgroundClip:   "text",
          WebkitTextFillColor:    "transparent",
        } : {}),
        margin: 0,
        ...style,
      }}
      {...props}
    >
      {children}
    </Tag>
  );
}
