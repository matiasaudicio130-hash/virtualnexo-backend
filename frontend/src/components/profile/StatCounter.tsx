import { useCountUp } from "@/hooks/useCountUp";

/** Formato compacto de miles: 1234 → "1.2k", 12345 → "12k". */
function fmtCount(n: number): string {
  const v = Math.round(n);
  if (v >= 10000) return Math.round(v / 1000) + "k";
  if (v >= 1000)  return (v / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(v);
}

interface Props {
  value: number;
  label: string;
  onClick?: () => void;
}

/** Celda de estadística con conteo animado (count-up al entrar en viewport). */
export function StatCounter({ value, label, onClick }: Props) {
  const ref = useCountUp(value, fmtCount);

  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--obsidian)", padding: "14px 8px", textAlign: "center",
        border: "none", color: "inherit", cursor: onClick ? "pointer" : "default",
        transition: "background 0.15s",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = "rgba(201,162,39,0.04)"; }}
      onMouseLeave={e => { e.currentTarget.style.background = "var(--obsidian)"; }}
    >
      <p style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 400, color: "var(--paper)" }}>
        <span ref={ref}>{fmtCount(value)}</span>
      </p>
      <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--mist)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        {label}
      </p>
    </button>
  );
}
