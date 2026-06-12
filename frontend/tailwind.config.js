/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  safelist: [
    "pt-safe", "pb-safe", "pl-safe", "pr-safe",
    "mt-safe", "mb-safe", "top-safe",
    "pt-safe-3", "pb-safe-3",
    "min-h-dvh", "h-dvh",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Legacy theme vars (backward compat) ── */
        bg: {
          base:  "rgb(var(--bg-base)  / <alpha-value>)",
          card:  "rgb(var(--bg-card)  / <alpha-value>)",
          muted: "rgb(var(--bg-muted) / <alpha-value>)",
        },
        border: "rgb(var(--border) / <alpha-value>)",
        accent: {
          purple:  "rgb(var(--accent-primary)   / <alpha-value>)",
          purple2: "rgb(var(--accent-secondary)  / <alpha-value>)",
          pink:    "rgb(var(--accent-secondary)  / <alpha-value>)",
          primary: "rgb(var(--accent-primary)   / <alpha-value>)",
        },
        text: {
          primary:   "rgb(var(--text-primary)   / <alpha-value>)",
          secondary: "rgb(var(--text-secondary) / <alpha-value>)",
          muted:     "rgb(var(--text-muted)     / <alpha-value>)",
        },
        status: {
          success: "#10B981",
          error:   "#EF4444",
          warning: "#F59E0B",
          info:    "#3B82F6",
        },
        /* ── Aura SW brand tokens ── */
        obsidian: '#020207',
        onyx:     '#0B0B12',
        smoke:    '#14141C',
        pewter:   '#1F1F2A',
        ash:      '#3A3A45',
        mist:     '#8A8A95',
        silver:   '#C7C7CE',
        paper:    '#F5F1E8',
        cream:    '#EFE9DA',
        gold: {
          DEFAULT: '#C9A227',
          deep:    '#8A6B14',
          bright:  '#E6C25A',
          light:   '#FFE566',
        },
        danger: '#C25A5A',
      },
      fontFamily: {
        sans:        ["Manrope", "-apple-system", "Helvetica Neue", "Arial", "sans-serif"],
        display:     ['"Cormorant Garamond"', '"EB Garamond"', "Georgia", "serif"],
        displayCaps: ["Cinzel", '"Cormorant Garamond"', "Georgia", "serif"],
        mono:        ['"JetBrains Mono"', "ui-monospace", '"SF Mono"', "Menlo", "monospace"],
      },
      fontSize: {
        'display-xxl': ['clamp(64px,11vw,168px)',  { lineHeight: '0.95', letterSpacing: '-0.02em' }],
        'display-xl':  ['clamp(48px,7vw,96px)',    { lineHeight: '1.02', letterSpacing: '-0.015em' }],
        'display-l':   ['clamp(36px,4.4vw,64px)',  { lineHeight: '1.08', letterSpacing: '-0.012em' }],
        'display-m':   ['clamp(28px,3vw,40px)',    { lineHeight: '1.15', letterSpacing: '-0.01em' }],
        'eyebrow':     ['11px',                    { lineHeight: '1.4',  letterSpacing: '0.22em' }],
      },
      letterSpacing: { eyebrow: '0.22em', caps: '0.18em' },
      borderRadius:  { pill: '999px' },
      backgroundImage: {
        "gradient-brand": "var(--gradient-brand)",
        "gradient-dark":  "linear-gradient(180deg, rgb(var(--bg-card)) 0%, rgb(var(--bg-base)) 100%)",
        "gold-glow":      "radial-gradient(60% 50% at 50% 50%, rgba(201,162,39,0.10), transparent 70%)",
      },
      animation: {
        "fade-in":     "fadeIn 0.35s ease-out",
        "slide-up":    "slideUp 0.35s ease-out",
        "pulse-slow":  "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
        "pop":         "pop 0.28s cubic-bezier(0.36,0.07,0.19,0.97) both",
        "shimmer":     "shimmer 1.8s ease-in-out infinite",
        "badge-pulse": "badgePulse 2.5s ease-in-out infinite",
        "glow-in":     "glowIn 0.2s ease-out",
      },
      keyframes: {
        fadeIn:     { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp:    { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pop:        {
          "0%":   { transform: "scale(1)" },
          "40%":  { transform: "scale(1.38)" },
          "70%":  { transform: "scale(0.88)" },
          "100%": { transform: "scale(1)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-200% center" },
          "100%": { backgroundPosition:  "200% center" },
        },
        badgePulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239,68,68,0.45)" },
          "50%":      { boxShadow: "0 0 0 5px rgba(239,68,68,0)" },
        },
        glowIn: {
          from: { opacity: "0", transform: "scaleX(0.3)" },
          to:   { opacity: "1", transform: "scaleX(1)" },
        },
      },
    },
  },
  plugins: [],
};
