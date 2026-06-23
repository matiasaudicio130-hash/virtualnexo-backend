/**
 * Aura Check — pequeño indicador verde sobre avatares.
 * Se muestra cuando el usuario estuvo activo en las últimas 24 horas.
 * Se oculta si fue hace más de 24h o si last_active_at es null.
 */

const MS_24H = 24 * 60 * 60 * 1000;

export function isRecentlyActive(lastActiveAt: string | null | undefined): boolean {
  if (!lastActiveAt) return false;
  return Date.now() - new Date(lastActiveAt).getTime() < MS_24H;
}

interface Props {
  lastActiveAt?: string | null;
  size?: number;         // diámetro del dot en px
  offset?: number;       // desplazamiento desde el borde
}

/** Punto verde superpuesto — poner dentro de un contenedor `relative`. */
export function AuraCheckBadge({ lastActiveAt, size = 10, offset = 2 }: Props) {
  if (!isRecentlyActive(lastActiveAt)) return null;
  return (
    <span
      aria-label="Activo recientemente"
      style={{
        position:  "absolute",
        bottom:    offset,
        right:     offset,
        width:     size,
        height:    size,
        borderRadius: "50%",
        background:   "#22c55e",
        border:       "2px solid var(--obsidian, #020207)",
        flexShrink: 0,
        display:    "block",
      }}
    />
  );
}
