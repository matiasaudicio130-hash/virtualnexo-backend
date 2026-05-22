/**
 * Aura SW — Theme tokens (TypeScript)
 *
 * Drop into frontend/src/lib/theme.ts
 * Import where you need typed access to brand values:
 *
 *   import { theme } from '@/lib/theme';
 *   <div style={{ color: theme.colors.gold }}>...
 */

export const colors = {
  // Neutros
  obsidian: '#020207',
  onyx:     '#0B0B12',
  smoke:    '#14141C',
  pewter:   '#1F1F2A',
  ash:      '#3A3A45',
  mist:     '#8A8A95',
  silver:   '#C7C7CE',
  paper:    '#F5F1E8',
  cream:    '#EFE9DA',

  // Dorado
  goldDeep:   '#8A6B14',
  gold:       '#C9A227',
  goldBright: '#E6C25A',
  goldLight:  '#FFE566',

  // Semánticos
  bg:          '#020207',
  surface:     '#0B0B12',
  fg:          '#F5F1E8',
  fgMute:      '#8A8A95',
  accent:      '#C9A227',
  accentHover: '#E6C25A',
  danger:      '#C25A5A',
  success:     '#C9A227',

  // Borders (rgba)
  border:     'rgba(255, 229, 102, 0.10)',
  borderSoft: 'rgba(245, 241, 232, 0.06)',
} as const;

export const fonts = {
  display:     '"Cormorant Garamond", "EB Garamond", Georgia, serif',
  displayCaps: '"Cinzel", "Cormorant Garamond", Georgia, serif',
  sans:        '"Manrope", -apple-system, "Helvetica Neue", Arial, sans-serif',
  mono:        '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace',
} as const;

export const fontSize = {
  displayXxl: 'clamp(64px, 11vw, 168px)',
  displayXl:  'clamp(48px, 7vw, 96px)',
  displayL:   'clamp(36px, 4.4vw, 64px)',
  displayM:   'clamp(28px, 3vw, 40px)',
  bodyL:      '18px',
  body:       '15px',
  eyebrow:    '11px',
} as const;

export const radii = {
  sm:   '4px',
  md:   '8px',
  lg:   '14px',
  pill: '999px',
} as const;

export const spacing = {
  gutterMobile:  '24px',
  gutterDesktop: '64px',
  gutter:        'clamp(20px, 4vw, 56px)',
  sectionY:      'clamp(80px, 12vh, 160px)',
} as const;

export const tracking = {
  eyebrow: '0.22em',
  caps:    '0.18em',
} as const;

/**
 * Voice copy library — single source of truth for brand microcopy.
 * Use these constants instead of hardcoding strings in components.
 */
export const copy = {
  taglineHero:        'Donde la identidad siempre es real.',
  taglineSecondary:   'Confianza por diseño, no por promesa.',
  taglineDifference:  'Nadie pretende ser quien no es.',
  taglinePrivacy:     'Tus fotos no van a ningún lado.',

  ctaPrimary:         'Pedí tu invitación',
  ctaVerify:          'Verificá tu identidad',
  ctaLearn:           'Conocé cómo',

  verifyOnce:         'Verificá una vez. Confiá para siempre.',
  verifySuccess:      'Listo. Tu identidad está verificada.',
  verifyError:        'No reconocemos esa identidad. Probá otra vez.',

  onboardingIntro:    'Antes de entrar, queremos saber quién sos. Es la única vez que vas a tener que hacerlo.',

  welcomeBack:        'Bienvenida de nuevo.',
  firstTime:          '¿Primera vez?',
  requestInvite:      'Pedí tu invitación',
} as const;

export const theme = {
  colors,
  fonts,
  fontSize,
  radii,
  spacing,
  tracking,
  copy,
} as const;

export type Theme = typeof theme;
export default theme;
