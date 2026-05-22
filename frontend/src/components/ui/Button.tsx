/**
 * Button — sistema de marca Aura SW.
 * Variants: primary (gold), ghost (outline), danger (red outline).
 * Siempre pill (border-radius 999px), tipografía Manrope uppercase.
 */
import { forwardRef, ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size    = "sm" | "md" | "lg";

interface BaseProps {
  variant?:   Variant;
  size?:      Size;
  loading?:   boolean;
  fullWidth?: boolean;
  children:   ReactNode;
  className?: string;
}
type AsBtnProps  = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };
type AsLinkProps = BaseProps & { href: string; target?: string; rel?: string };
type Props = AsBtnProps | AsLinkProps;

const V: Record<Variant, string> = {
  primary:   "bg-[var(--gold)] text-[var(--obsidian)] border border-[var(--gold-bright)] hover:bg-[var(--gold-bright)] active:scale-[0.97]",
  secondary: "bg-transparent text-[var(--paper)] border border-[var(--ash)] hover:border-[var(--mist)] active:scale-[0.97]",
  ghost:     "bg-transparent text-[var(--paper)] border border-[var(--ash)] hover:border-[var(--mist)] active:scale-[0.97]",
  danger:    "bg-transparent text-[var(--danger)] border border-[var(--danger)] hover:bg-[rgba(194,90,90,0.08)] active:scale-[0.97]",
};
const S: Record<Size, string> = {
  sm: "px-4    py-2    text-[10px] tracking-[0.18em]",
  md: "px-[22px] py-[14px] text-[11px] tracking-[0.20em]",
  lg: "px-8    py-[18px] text-[12px] tracking-[0.22em]",
};
const BASE = "inline-flex items-center justify-center gap-2 rounded-pill font-sans font-normal uppercase transition-all duration-150 select-none outline-none focus-visible:ring-1 focus-visible:ring-[var(--gold)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--obsidian)] disabled:opacity-40 disabled:cursor-not-allowed";

export const Button = forwardRef<HTMLButtonElement, Props>((props, ref) => {
  const { variant = "primary", size = "md", loading = false, children, className = "" } = props;
  const { fullWidth = false } = props as BaseProps;
  const cls = `${BASE} ${V[variant]} ${S[size]} ${fullWidth ? "w-full" : ""} ${className}`;

  if ("href" in props && props.href) {
    return (
      <Link to={props.href} className={cls} target={props.target} rel={props.rel}>
        {loading ? <Spin /> : children}
      </Link>
    );
  }

  const { href: _h, target: _t, rel: _r, loading: _l, variant: _v, size: _s, ...btnProps } = props as any;
  return (
    <button ref={ref} className={cls} disabled={loading || btnProps.disabled} {...btnProps}>
      {loading ? <Spin /> : children}
    </button>
  );
});
Button.displayName = "Button";

function Spin() {
  return (
    <svg className="animate-spin" width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
  );
}
