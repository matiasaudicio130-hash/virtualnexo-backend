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
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gradient-brand": "var(--gradient-brand)",
        "gradient-dark":  "linear-gradient(180deg, rgb(var(--bg-card)) 0%, rgb(var(--bg-base)) 100%)",
      },
      animation: {
        "fade-in":    "fadeIn 0.35s ease-out",
        "slide-up":   "slideUp 0.35s ease-out",
        "pulse-slow": "pulse 3s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" },                              to: { opacity: "1" } },
        slideUp: { from: { opacity: "0", transform: "translateY(12px)" }, to: { opacity: "1", transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
