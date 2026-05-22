export const APP_CONFIG = {
  name: "AURA",
  tagline: "Exclusive Lifestyle",
  description: "La comunidad adulta verificada mas exclusiva de Argentina",
  supportEmail: "soporte@aurasw.club",
  domain: "aurasw.club",
  version: "1.0.0",
} as const;

export const API_BASE_URL = import.meta.env.VITE_API_URL ?? "/api/v1";
