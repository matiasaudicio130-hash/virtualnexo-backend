const SUPABASE_STORAGE = "/storage/v1/object/public/";
const SUPABASE_RENDER  = "/storage/v1/render/image/public/";

export type ImageSize = "avatar-sm" | "avatar-md" | "avatar-lg" | "post" | "thumb";

const SIZE_PRESETS: Record<ImageSize, { width: number; quality: number }> = {
  "avatar-sm": { width: 80,  quality: 72 },  // círculos pequeños en feed / stories
  "avatar-md": { width: 120, quality: 75 },  // avatares en listas / nearby
  "avatar-lg": { width: 220, quality: 82 },  // avatar principal en perfil
  "post":      { width: 800, quality: 84 },  // imagen de post en el feed
  "thumb":     { width: 220, quality: 72 },  // thumbnails en grids / albums
};

/**
 * Transforma una URL de Supabase Storage al endpoint de render con WebP.
 * URLs que no sean de Supabase se devuelven sin modificar.
 */
export function imgUrl(url: string | null | undefined, size: ImageSize): string {
  if (!url) return "";
  if (!url.includes(SUPABASE_STORAGE)) return url;

  const { width, quality } = SIZE_PRESETS[size];
  const base = url.replace(SUPABASE_STORAGE, SUPABASE_RENDER);
  return `${base}?width=${width}&quality=${quality}&format=webp`;
}
