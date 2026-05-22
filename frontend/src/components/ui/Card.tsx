import { type HTMLAttributes } from "react";
import { clsx } from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  glow?: boolean;
}

export function Card({ glow, className, children, ...props }: CardProps) {
  return (
    <div
      className={clsx(
        "bg-bg-card border border-border rounded-2xl",
        glow && "shadow-lg shadow-accent-purple/10",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
