# Estado de Implementación — Aura SW
## Última actualización: 2026-06-23

> Este archivo refleja el estado real del codebase verificado con lectura directa de archivos.
> La Estratega lo lee al inicio de cada sesión para saber dónde estamos parados.

---

## CÓMO USAR ESTE ARCHIVO

**El Constructor:** cuando terminás un ítem, cambiá el emoji de estado y completá la fila.
**La Estratega:** leer siempre este archivo antes de dar nuevas instrucciones.

### Estados:
- ✅ Implementado y en producción
- 🔧 En progreso (en desarrollo, no deployado)
- ❌ No implementado
- 🐛 Implementado pero con bugs o pendiente de mejora
- ⸸ Pausado / postergado
- 🚫 Descartado (con motivo)

---

## ARQUITECTURA DE NAVEGACIÓN

| Componente | Estado | Notas del Constructor |
|------------|--------|----------------------|
| BottomNav (5 tabs: Feed / Explorar / Mensajes / Alertas / Perfil) | ✅ | Phosphor icons, pill activo dorado, badge de notif con `animate-badge-pulse` |
| Header simplificado (Logo + botón filtros) | ✅ | NavLogo + SlidersHorizontal en Feed; sin los 8 iconos viejos |
| Iconografía Phosphor Light (reemplazar Lucide) | 🐛 | Phosphor instalado y en uso; algunos componentes todavía importan Lucide |
| Pull-to-refresh (reemplazar botón Refresh) | ❌ | No implementado |
| Eventos y Modo Viaje movidos a Explorar | ✅ | Explore tiene tabs: personas / interés / eventos / viaje / hashtag |

---

## BUGS — LOTE A (quick wins)

| Bug | Descripción | Estado | Notas |
|-----|-------------|--------|-------|
| #4 | Explore vacío: fallback GPS + empty state + botón "Activar GPS" | ✅ | `requestGPS()` implementado; fallback UI cuando `!coords` en la tab personas |
| #5 | calcCompleteness falso negativo (mismatch de campos) | ✅ | Verifica `profile_photo_url`, `username`, `bio`, `province/city`, `seeking_tags`, `profile_type`, `sexual_orientation` |
| #2 | Streak badge sin explicación | ✅ | Badge muestra label "racha"; tappable para popover con explicación en mobile |
| #7 | Copy "Mostrás más de vos" → "Completá tu perfil" | ✅ | MyProfileSection muestra "Completá tu perfil" / "Perfil completo ✓" |
| #10 | Cards de navegación redundantes en Dashboard (eliminar) | ❌ | Verificar Dashboard.tsx |

---

## BUGS — LOTE B (upload features)

| Bug | Descripción | Estado | Notas |
|-----|-------------|--------|-------|
| #8 | Albums: click → drawer → upload fotos | ❌ | Verificar MyProfileSection |
| #6 | Highlights: subir foto de portada en modal de creación | ❌ | HighlightCreator.tsx existe, verificar si upload funciona |

---

## BUGS — LOTE C (geo + assets)

| Bug | Descripción | Estado | Notas |
|-----|-------------|--------|-------|
| #1 | NavLogo cuadrado negro (JPG → PNG transparente) | ❌ | Verificar AuraLogo.tsx y asset en /public |
| #3 | Feed carga lento: GPS two-phase fetch + skeleton dark | ✅ | GPS corre en paralelo; feed carga inmediatamente sin coords. PostSkeleton usa `#1a1815` + `aura-pulse` |
| #11 | EditProfile solo Argentina → Photon autocomplete mundial | ✅ | Ya implementado con `photon.komoot.io`; muestra city + country |

---

## BUGS — LOTE D (perfiles)

| Bug | Descripción | Estado | Notas |
|-----|-------------|--------|-------|
| #9A | Ver perfil propio puede crashear en ProfileView | ❌ | Verificar ProfileView.tsx |
| #9B | Ver perfiles ajenos desde Explore | ❌ | Verificar flujo Explore → ProfileView |

---

## PERFORMANCE

| Optimización | Archivo | Estado | Notas |
|-------------|---------|--------|-------|
| Code splitting `manualChunks` | vite.config.ts | ✅ | vendor-react, vendor-icons, vendor-query, vendor-forms, vendor-ui + chunks por página; terser minify activo |
| Preconnect Railway + Supabase | index.html | ✅ | `preconnect` Railway + Supabase + `dns-prefetch` Nominatim |
| GPS two-phase fetch en Feed | Feed.tsx | ✅ | `effectiveLat/Lng` empieza en null; feed carga sin coords y re-fetcha cuando GPS responde |
| PostSkeleton dark-mode correcto (#1a1815) | PostSkeleton.tsx | ✅ | Inline en Feed.tsx; usa `#1a1815`, `#141210`, animación `aura-pulse` |
| Imágenes WebP con imgUrl() | utils/image.ts | ✅ | 5 presets (avatar-sm/md/lg, post, thumb); aplicado en NearbyUsers, ProfileSuggestions, ProfileAvatar, PostCard |
| React Query global configurado | main.tsx | ✅ | `QueryClient` con `staleTime: 30_000`, `retry: 1`; `QueryClientProvider` wrapping toda la app |
| React Query en páginas principales | Feed.tsx | ✅ | `useInfiniteQuery` con `staleTime: 2min`; cache entre navegaciones; infinite scroll via `fetchNextPage` |
| Supabase Realtime para mensajes | Messages.tsx | ✅ | `postgres_changes` INSERT + UPDATE en `messages`; polling de typing (3s) se mantiene ya que usa endpoint REST |
| BottomNav prefetch de rutas on hover | BottomNav.tsx | ✅ | `onMouseEnter` + `onTouchStart` disparan import dinámico por tab |
| Health check endpoint FastAPI | backend/main.py | ✅ | `GET /health` en línea 79; configurado en `railway.toml` como healthcheckPath |
| UptimeRobot ping cada 5 min | Servicio externo | ❌ | Sin confirmar si está activo |
| Índices Supabase (created_at, conversation_id, etc.) | SQL Editor Supabase | ✅ | 7/11 aplicados: posts, messages, notifications, user_follows. 4 skipped: deleted_at/reactions/stories/profile_views no existen aún |
| Title y og:title unificados | index.html | ✅ | Ambos: "AURA — La comunidad adulta verificada de Argentina" |
| meta description y og:description unificados | index.html | ❌ | Textos todavía distintos (baja prioridad) |
| Keywords meta reducidas a 15-20 | index.html | ❌ | ~100+ términos actualmente |

---

## SEO / HEAD

| Cambio | Estado | Notas |
|--------|--------|-------|
| Unificar `<title>` con `og:title` | ✅ | Ambos: "AURA — La comunidad adulta verificada de Argentina" |
| Unificar meta description con og:description | ❌ | Textos distintos entre sí |
| Reducir keywords meta a 15-20 términos clave | ❌ | ~100 keywords; se diluye la señal |
| Agregar `<link rel="preconnect">` Railway + Supabase | ✅ | Implementado en index.html |

---

## PLAN ESTRATÉGICO Q3 2026

| Encargo | Feature | Prioridad | Estado | Notas |
|---------|---------|-----------|--------|-------|
| #1 | Quién vio tu perfil (profile views) | P0 | 🐛 | Dashboard tiene `viewers` state y `showViewers`; verificar si el endpoint y la UI están completos |
| #2 | Push notifications completo (Service Worker) | ✅ | `usePushNotifications` hook, `PushPromptBanner`, handler en `sw.ts` |
| #3 | Wizard de onboarding post-KYC (4 pasos) | ✅ | `OnboardingWizard.tsx` existe; verificar si está en el router |
| #4 | Grupos por ciudad/interés | ✅ | `GroupChat.tsx` existe; `group_chats` / `group_members` / `group_messages` en DB |
| #5 | Eventos con RSVP | 🐛 | Tab "eventos" en Explore existe; verificar Events.tsx y endpoint RSVP |
| #6 | Intereses navegables ("Qué buscás" como motor de discovery) | ✅ | Tab "interés" en Explore con `SEEKING_TAGS` navegables |
| #7 | Perfil de pareja (cuenta dual + badge "Pareja Verificada") | 🐛 | `CoupleSection.tsx` existe en Dashboard; verificar badge y lógica de vinculación |
| #8 | Stories con audiencia seleccionable | ❌ | No implementado |
| #9 | Reviews entre usuarios | ✅ | `Reviews.tsx` page existe |
| #10 | Cuentas semilla (acción operativa del equipo) | ❌ | No es código |

---

## FEATURES SUGERIDAS (Auditoría v2 — Sección 8)

| Feature | Estado | Notas |
|---------|--------|-------|
| QR de perfil compartible | ✅ | `ProfileQRModal` importado en Dashboard; `qrcode.react` instalado |
| Feed "Modo Anónimo" (navegar sin dejar rastro) | ❌ | No implementado |
| "Compatibilidad de Qué Buscás" (indicador en perfil ajeno) | ❌ | No implementado |
| "Aura Check" — badge de actividad reciente en avatares | ❌ | No implementado |
| Encuesta de compatibilidad al mutual follow | ❌ | No implementado |
| Historial de solicitudes de álbum | ❌ | No implementado |

---

## DISEÑO — Assets pendientes

| Asset | Para | Estado | Notas |
|-------|------|--------|-------|
| logo-full-transparent.png (fondo transparente, texto dorado) | NavLogo Bug #1 | ❌ | |
| logo-full-white.png (fondo transparente, texto blanco) | NavLogo alternativa | ❌ | |

---

## PRÓXIMOS ITEMS DE MAYOR ROI (menor esfuerzo, mayor impacto)

En orden de prioridad:

1. ~~**Ejecutar migration_performance_indexes.sql**~~ — ✅ completado (7/11 aplicados)
2. **UptimeRobot** — configurar ping a `https://api-production-a7d3.up.railway.app/health` cada 5 min (~10 min)
3. **Bug #1 NavLogo** — PNG con transparencia real (requiere asset de diseño)
4. **imgUrl() en ProfileView** — foto principal del perfil ajeno (~20 min)
5. **Feed.tsx → `useQuery` para el tab "Siguiendo"** — ya tiene `useInfiniteQuery` para "Para vos"

---

## CONTEXTO RÁPIDO PARA LA ESTRATEGA

- **URL producción:** https://aurasw.club
- **API backend:** https://api-production-a7d3.up.railway.app
- **Stack:** React + TypeScript + Vite PWA / FastAPI Python 3.11+ / Supabase PostgreSQL
- **Deploy:** `git push github clean-deploy:master` → GitHub Actions automático (~3 min)
- **Brand:** #C9A227 dorado · #020207 fondo · Cormorant Garamond (display) · Manrope (body)
- **Documentos de referencia:**
  - `AUDITORIA_COMPLETA_v2.md` — performance + UX + GPS + prompt Claude Code optimización
  - `CLAUDE.md` — arquitectura completa, routers, tablas Supabase, comandos de deploy

---

*Actualizado: 2026-06-23 — verificado con lectura directa del codebase*
