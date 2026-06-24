# Estado de Implementación — Aura SW
## Última actualización: 2026-06-23 (post Sprint 3)

> Estado verificado con lectura directa del codebase. Refleja producción actual.

---

## ESTADOS
- ✅ Implementado y en producción
- 🐛 Implementado pero con mejoras menores pendientes
- ❌ No implementado
- 🚫 Descartado

---

## ARQUITECTURA Y NAVEGACIÓN ✅

| Componente | Estado | Notas |
|------------|--------|-------|
| BottomNav 5 tabs | ✅ | Phosphor icons, pill activo dorado, badge notif animado |
| Header simplificado | ✅ | NavLogo + botón filtros — sin los 8 iconos viejos |
| Iconografía Phosphor | ✅ | **0 imports de lucide-react** — migración 100% completada (65 archivos) |
| Pull-to-refresh en Feed | ✅ | Hook nativo touch events · spinner dorado · invalida cache |
| NavLogo Bug #1 | ✅ | `logo-aura-soft.png` PNG transparente · sin mix-blend-mode |

---

## BUGS RESUELTOS ✅

| Bug | Estado | Fix |
|-----|--------|-----|
| #1 NavLogo cuadrado negro | ✅ | PNG transparente `logo-aura-soft.png` |
| #2 Streak badge sin explicación | ✅ | Label "racha" + popover explicativo on tap |
| #3 Feed GPS bloquea carga | ✅ | Two-phase fetch — feed carga inmediatamente |
| #4 Explore vacío sin GPS | ✅ | `requestGPS()` + fallback con botón "Activar GPS" |
| #5 calcCompleteness falso negativo | ✅ | Nombres de campos corregidos |
| #6 Highlights upload portada | ✅ | `HighlightCreator.tsx` con canvas compression |
| #7 Copy "Mostrás más de vos" | ✅ | "Completá tu perfil" / "Perfil completo ✓" |
| #8 Albums upload fotos | ✅ | `MyProfileSection.tsx` con `albumsApi.addPhoto` |
| #9A ProfileView crash (propio) | ✅ | Guard `if (!me)` antes de render + `is_private` fix |
| #9B Explore → ProfileView ajeno | ✅ | Resuelto como side-effect de #9A |
| #10 Cards nav redundantes Dashboard | ✅ | No existían en el código actual |
| #11 EditProfile solo Argentina | ✅ | Photon autocomplete mundial implementado |

---

## PERFORMANCE ✅

| Optimización | Estado | Notas |
|-------------|--------|-------|
| Code splitting vite.config.ts | ✅ | manualChunks por vendor/página + terser |
| Preconnect Railway + Supabase | ✅ | `index.html` |
| GPS two-phase fetch Feed | ✅ | effectiveLat empieza en null |
| PostSkeleton dark-mode | ✅ | `#1a1815` + `aura-pulse` |
| Imágenes WebP `imgUrl()` | ✅ | 5 presets · aplicado en 7+ componentes |
| React Query global | ✅ | `QueryClient` staleTime 30s en `main.tsx` |
| Feed `useInfiniteQuery` | ✅ | Cache 2min entre navegaciones |
| Supabase Realtime mensajes | ✅ | `postgres_changes` INSERT+UPDATE reemplaza polling |
| BottomNav prefetch on hover | ✅ | import() dinámico por tab |
| Health check + keepalive | ✅ | `GET /health` + GitHub Actions cron cada 10min |
| Índices Supabase | ✅ | 11/11: posts, messages, notifications, post_reactions, profile_views, user_follows |
| Pull-to-refresh | ✅ | Hook nativo sin librería |

---

## SEO / HEAD ✅

| Cambio | Estado |
|--------|--------|
| `<title>` = `og:title` = `twitter:title` | ✅ |
| `meta description` = `og:description` = `twitter:description` | ✅ |
| Keywords reducidas a 15 términos | ✅ |
| Preconnect Railway + Supabase + dns-prefetch Nominatim | ✅ |

---

## PLAN ESTRATÉGICO Q3 2026 ✅

| Encargo | Feature | Estado |
|---------|---------|--------|
| #1 | Quién vio tu perfil | ✅ Card en Dashboard con badge "NUEVO" (<24h) |
| #2 | Push notifications | ✅ hook + banner + sw.ts |
| #3 | Onboarding wizard post-KYC | ✅ `OnboardingWizard.tsx` |
| #4 | Grupos por ciudad/interés | ✅ `GroupChat.tsx` + tablas DB |
| #5 | Eventos con RSVP | ✅ `Events.tsx` + backend completo |
| #6 | Intereses navegables | ✅ Tab "interés" en Explore con SEEKING_TAGS |
| #7 | Perfil de pareja | ✅ `CoupleSection.tsx` en Dashboard |
| #8 | Stories con audiencia seleccionable | ✅ 3 opciones: Todos/Seguidores/Mi pareja |
| #9 | Reviews entre usuarios | ✅ `Reviews.tsx` |
| #10 | Cuentas semilla | ❌ Operativo — no es código |

---

## FEATURES IMPLEMENTADAS

| Feature | Estado | Notas |
|---------|--------|-------|
| QR de perfil | ✅ | `ProfileQRModal` + `qrcode.react` |
| Modo Anónimo | ✅ | Toggle en Dashboard · inicializa desde `user.anonymous_mode` · pill "Anónimo" visible |
| "Intereses en común" en perfiles | ✅ | Pill dorada en ProfileView comparando `seeking_tags` |
| Aura Check badge | ✅ | Punto verde en avatares cuando `last_active_at < 24h` |
| Encuesta compatibilidad mutual follow | ✅ | Backend detecta mutual → mensaje icebreaker tipo "system" en el chat |
| Historial solicitudes de álbum | ✅ | `GET /albums/my-requests` + sección colapsable en Dashboard |
| Drawer "Quién reaccionó" | ✅ | Tocar contador → lista de usuarios por tipo de reacción |
| Pill "Intereses en común" | ✅ | ProfileView entre visitante y perfil ajeno |
| Badge "NUEVO" en viewers | ✅ | Viewers de las últimas 24h resaltados en Dashboard |
| Guardados + Colecciones | ✅ | `/saved` con grid + colecciones + modal |
| Polls en feed | ✅ | CreatePost modo poll + PollCard + backend |

---

## DISEÑO

| Asset | Estado |
|-------|--------|
| `logo-aura-soft.png` (PNG transparente) | ✅ En uso como NavLogo y AuraLogo |
| `logo-full-white.png` alternativa | ❌ No necesario — soft.png cubre ambos casos |

---

## BACKLOG OPERATIVO (no código)

| Item | Responsable |
|------|-------------|
| Publicar 1 post diario por cuenta semilla | Matias |
| Crear 4-6 cuentas semilla nuevas | Matias |
| Conseguir primer partner para ads | Matias |
| UptimeRobot (alternativa a GH Actions) | Opcional — GH Actions ya cubre |

---

## CONTEXTO RÁPIDO

- **URL:** https://aurasw.club · **API:** https://api-production-a7d3.up.railway.app
- **Deploy:** `git push github clean-deploy:master` → GitHub Actions (~3 min)
- **Stack:** React + TypeScript + Vite PWA / FastAPI 3.11+ / Supabase PostgreSQL
- **Brand:** `#C9A227` dorado · `#020207` fondo · Cormorant Garamond (display) · Manrope (body)
- **Iconos:** 100% `@phosphor-icons/react` weight `light` — lucide-react eliminado

---

*Actualizado: 2026-06-23 — Sprint 1, 2 y 3 completos*
