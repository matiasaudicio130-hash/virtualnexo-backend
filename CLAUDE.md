# Aura SW — Contexto del Proyecto

## Nombre y URL
- **Nombre:** Aura SW  
- **Dominio:** aurasw.club (producción online)
- **Nombre anterior (no usar):** VirtualNexo
- Para renombrar: `frontend/src/config/app.ts`, `backend/app/core/branding.py`, `frontend/index.html`, `frontend/vite.config.ts`

## Stack tecnológico

### Backend
- **Framework:** FastAPI (Python 3.11+)
- **Base de datos:** Supabase (PostgreSQL con RLS) — cliente service_role en `backend/app/db/supabase.py`
- **Auth:** JWT propio (access + refresh tokens), bcrypt para passwords
- **Rate limiting:** SlowAPI (200 req/min por IP)
- **Entry point:** `backend/main.py`
- **Puerto dev:** `http://localhost:8000` | Docs: `http://localhost:8000/docs`
- **Activar venv:** `backend\venv\Scripts\activate` (Windows)
- **Iniciar:** `python main.py`

### Frontend
- **Framework:** React + TypeScript, Vite, PWA
- **Estado:** Zustand (authStore, themeStore, langStore)
- **Fetching:** React Query + Axios (`frontend/src/lib/api.ts`)
- **Forms:** React Hook Form + Zod
- **Estilos:** Tailwind CSS con variables CSS custom (temas: dark/blue/red/pure)
- **Animaciones:** GSAP
- **Íconos:** Lucide React
- **Entry point:** `frontend/src/main.tsx`
- **Puerto dev:** `http://localhost:5173`
- **Iniciar:** `npm run dev` (desde `/frontend`)

### Base de datos
- Migraciones en `supabase/migrations/` (3 archivos SQL, ejecutar en orden en Supabase SQL Editor)
- El backend usa `service_role` key (bypasa RLS) — nunca exponer en frontend

## Routers del backend (`/api/v1`)

| Router | Archivo | Descripción |
|--------|---------|-------------|
| auth | routers/auth.py | Registro, login, refresh, logout, /me, profile type |
| kyc | routers/kyc.py | MetaMap KYC, webhook, simulación dev |
| admin | routers/admin.py | Master keys, gestión usuarios, stats dashboard |
| exchange | routers/exchange.py | Cotización dólar blue (caché 15min) |
| payments | routers/payments.py | Pagos manuales, historial, stats admin |
| settings | routers/settings.py | Feature flags, configuración allowlist |
| tokens | routers/tokens.py | Economía de tokens (feature-flagged, comentado) |
| pricing | routers/pricing.py | Planes: monthly/annual/lifetime, ARS y USD |
| stripe_router | routers/stripe_router.py | Checkout Stripe, webhooks, estado sesión |
| reports | routers/reports.py | Reportes PDF financieros |
| payouts | routers/payouts.py | Payouts para influencers |
| media | routers/media.py | Upload avatar/posts (watermark), URLs firmadas |
| feed | routers/feed.py | Posts, stories, reactions, saves, carrusel |
| reviews | routers/reviews.py | Reviews 1-5 estrellas, anónimas, medallas |
| ads | routers/ads.py | Ads banner/overlay, tracking, admin |
| travel | routers/travel.py | Planes de viaje, filtro por provincia |
| messaging | routers/messaging.py | DMs, media, typing, view-once, reacciones |
| notifications | routers/notifications.py | Notificaciones in-app |
| profiles | routers/profiles.py | Matches, viewers, perfil público, likes/blocks |
| comments | routers/comments.py | Comentarios con replies anidados |
| push | routers/push.py | Web push (VAPID) |
| highlights | routers/highlights.py | Highlights de stories, reacciones |
| events | routers/events.py | Eventos comunitarios, RSVP |
| discovery | routers/discovery.py | Usuarios cercanos (Haversine), sugerencias |

## Páginas del frontend

Landing, Register, Login, VerifyEmail, KYCVerification, PendingApproval, AccessDenied, Dashboard, Feed, ProfileView, Reviews, TravelMode, Messages, Events, Checkout, CheckoutPay, CheckoutSuccess, CheckoutCancel, AdminPanel, Privacidad, Terminos

## Flujos clave

### Registro estándar
`/registro` → verificación email (link en consola en dev) → `/kyc` (MetaMap o simulación) → dashboard

### Registro con Master Key
Admin genera key en `/admin` → usuario se registra con key → estado `pending_manual` → admin aprueba en `/admin > Pendientes`

### Crear primer admin
```sql
UPDATE users SET role = 'admin', status = 'active' WHERE email = 'tu-email@gmail.com';
```

## Roles y estados de usuario

**Roles:** `miembro`, `influencer`, `socio`, `admin`

**Estados:** `pending_email` → `pending_kyc` | `pending_manual` → `active` | `rejected` | `suspended`

## Features especiales

- **Shadow ban:** Usuario bloqueado invisiblemente (ve su feed normal, otros no lo ven)
- **Watermarking:** Visible (user ID) + invisible LSB (esteganografía) para detección de filtraciones
- **Modo anónimo:** Feature premium, requiere membresía activa
- **Feature flags:** Tabla `system_settings` controla qué está activo
- **Módulo Tokens:** Código completo pero comentado — activar desde panel admin cuando sea necesario

## Convenciones del código

- Variables de entorno: backend via `app/core/config.py` (Pydantic Settings), frontend via `VITE_` prefix
- Supabase client: siempre el singleton de `app/db/supabase.py` (service_role)
- Temas CSS: variables en `index.css`, selector `[data-theme="dark|blue|red|pure"]`
- i18n: `langStore` con traducciones ES/EN inline en componentes

## Skills instaladas en este proyecto

- `supabase` — Buenas prácticas oficiales de Supabase
- `supabase-postgres-best-practices` — Best practices PostgreSQL en Supabase
- `vercel-react-best-practices` — Best practices React + Vercel
- `find-skills` — Descubrir e instalar nuevas skills

## Estado de desarrollo (Mayo 2026)

- **Producción online:** aurasw.club
- **Fase 1:** Completa — auth, KYC, admin básico, pagos, feed social
- **Fase 2:** En progreso — backoffice admin completo, reportes PDF, pagos manuales UI, payouts
- **Fase 3:** Planificada — multimedia Supabase Storage, marca de agua UI, bloqueo capturas nativo
