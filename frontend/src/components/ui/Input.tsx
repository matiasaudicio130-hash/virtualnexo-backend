/**
 * Input — solo underline (sin caja), sistema de marca Aura SW.
 * Label en eyebrow style (JetBrains Mono 9px uppercase).
 * Focus: underline cambia a gold con transición 150ms.
 */
import { forwardRef, InputHTMLAttributes, ReactNode } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?:  string;
  icon?:  ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = "", ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5 w-full">
        {label && (
          <label
            htmlFor={props.id}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--mist)",
              fontWeight: 500,
            }}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          <input
            ref={ref}
            className={`
              w-full bg-transparent
              pt-2 pb-2 pr-2 pl-0
              border-0 border-b border-[var(--ash)]
              text-[var(--paper)] text-[15px]
              placeholder:text-[var(--fg-dim)]
              outline-none
              transition-colors duration-150
              focus:border-[var(--gold)]
              disabled:opacity-40 disabled:cursor-not-allowed
              ${icon ? "pr-8" : ""}
              ${error ? "border-[var(--danger)] focus:border-[var(--danger)]" : ""}
              ${className}
            `}
            style={{ fontFamily: "var(--font-sans)" }}
            {...props}
          />
          {icon && (
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--mist)]">
              {icon}
            </span>
          )}
        </div>

        {error && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--danger)" }}>
            {error}
          </p>
        )}
        {hint && !error && (
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", color: "var(--mist)" }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);
Input.displayName = "Input";
