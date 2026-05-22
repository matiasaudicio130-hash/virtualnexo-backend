# Aura SW — Contexto del Proyecto

## Identidad
- **Nombre:** Aura SW (nombre anterior NO usar: VirtualNexo)
- **Dominio:** aurasw.club (producción online)
- **Repo GitHub:** https://github.com/matiasaudicio130-hash/virtualnexo-backend (nombre viejo, contiene todo el proyecto)
- **Rama principal:** `master` (push con `git push github clean-deploy:master`)

## Stack
| Capa | Tecnología | Puerto dev |
|------|------------|------------|
| Backend | FastAPI Python 3.11+ | localhost:8000 |
| Frontend | React + TypeScript + Vite PWA | localhost:5173 |
| DB | Supabase PostgreSQL (proyecto lwrtsllcanbvrsyqbgol) | — |

## Comandos rápidos
```bash
# Backend
cd backend && venv\Scripts\activate && python main.py

# Frontend  
cd frontend && npm run dev

# Deploy (activa GitHub Actions → Railway + Vercel automáticamente)
git add backend/ frontend/
git commit -m "feat/fix: descripción"
git push github clean-deploy:master
```

## Infraestructura de producción
| Servicio | URL | Notas |
|----------|-----|-------|
| Backend | https://api-production-a7d3.up.railway.app | Railway, nixpacks, auto-deploy via CLI |
| Frontend | https://aurasw.club | Vercel, proyecto prj_31JL82A6GgUBOO25DQWFoVyWk7m1 |
| DB | https://lwrtsllcanbvrsyqbgol.supabase.co | Supabase |

### IDs de servicios (en railway_ids.json del repo)
- Railway project: `251659a5-2a37-4409-ad7b-065b60a59aa2`
- Railway service: `0fc4ee5b-182b-4a1e-af9e-4f868a7caecc`
- Railway environment: `a14ba470-67e6-45a3-99eb-9b521bc0c5ea`
- Vercel org: `wdyZLuGcf0JXyLyPhhSxU2nF` (user: matiasaudicio130-9449)

### Secretos (NUNCA en git — están en GitHub Actions secrets)
- `RAILWAY_TOKEN` + `RAILWAY_PROJECT_TOKEN` + `RAILWAY_SERVICE_ID` + `RAILWAY_ENV_ID`
- `VERCEL_TOKEN` + `VERCEL_ORG_ID` + `VERCEL_PROJECT_ID`
- Backend: variables en Railway dashboard (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, JWT_SECRET_KEY, etc.)
- Dev: `backend/.env` (gitignored)

## Cómo deploar
```bash
# Push → GitHub Actions hace todo automáticamente:
# 1. railway up --service ... → sube backend a Railway
# 2. vercel --prod → buildea y sube frontend a Vercel

# Si el deploy de Vercel falla (ver historial):
cd frontend && npx vercel --token TOKEN --yes --prod
# Después manualmente: alias aurasw.club al nuevo deploy via Vercel API

# Si el backend da 404 en endpoints nuevos = código viejo en Railway:
cd backend && $env:RAILWAY_TOKEN="PROJECT_TOKEN" && railway up --service SERVICE_ID
```

## ⚠️ Problemas conocidos y soluciones

### Pantalla blanca en producción
**Causa:** Service worker PWA cachea bundle viejo cuando hay un nuevo deploy con diferente hash.  
**Fix:** Hacer un nuevo deploy (cambia el hash → SW se actualiza). El `ErrorBoundary` en `main.tsx` evita pantalla completamente en blanco.  
**Prevención:** No hacer múltiples deploys seguidos sin testear — cada deploy cambia el hash del bundle.

### Backend da 404 en endpoints nuevos
**Causa:** Railway re-deployó el código VIEJO (no estaba conectado a GitHub).  
**Fix:** Usar `railway up` desde el directorio `backend/` con el project token (no el personal token).  
**Nota:** El GitHub Actions workflow usa `RAILWAY_PROJECT_TOKEN` (generado con `projectTokenCreate` mutation) no el personal token.

### Push a GitHub bloqueado por secrets
**Causa:** Algún commit viejo tiene credenciales hardcodeadas.  
**Fix:** Crear orphan branch y force push:
```bash
git checkout --orphan clean-deploy
git add backend/ frontend/ CLAUDE.md supabase/  # NO agregar create_admin.py / run_migrations.py
git commit -m "..."
git push --force github clean-deploy:master
```

## Arquitectura backend — 27 routers (/api/v1)

| Router | Descripción |
|--------|-------------|
| auth | Registro, login, refresh, logout, /me, heartbeat (streaks), profile-type |
| kyc | MetaMap KYC, webhook, simulación dev |
| admin | Master keys, gestión usuarios, stats dashboard |
| exchange | Cotización dólar blue (caché 15min) |
| payments | Pagos manuales, historial, stats admin |
| settings | Feature flags, configuración allowlist |
| tokens | Economía de tokens (feature-flagged, comentado) |
| pricing | Planes: monthly/annual/lifetime, ARS y USD |
| stripe_router | Checkout Stripe, webhooks, estado sesión |
| reports | Reportes PDF financieros (fpdf2) |
| payouts | Payouts para influencers |
| media | Upload avatar/posts (watermark), URLs firmadas |
| feed | Posts, stories, polls, reactions, saves, carrusel |
| reviews | Reviews 1-5 estrellas, anónimas, medallas |
| ads | Ads banner/overlay, tracking, admin |
| travel | Planes de viaje, filtro por provincia |
| messaging | DMs, media, typing, view-once, reacciones, audios |
| notifications | Notificaciones in-app |
| profiles | Matches, viewers, perfil público, likes/blocks |
| comments | Comentarios con replies anidados |
| push | Web push (VAPID) |
| highlights | Highlights de stories, reacciones |
| events | Eventos comunitarios, RSVP |
| discovery | Usuarios cercanos (Haversine), sugerencias |
| two_factor | 2FA TOTP (Google Authenticator) |
| sessions | Ver/revocar sesiones activas |
| follows | Follow/followers, feed de seguidos |
| groups | Grupos de chat (group_chats, group_members, group_messages) |

## Páginas del frontend (21+)

Landing, Register, Login, VerifyEmail, KYCVerification, PendingApproval, AccessDenied, Dashboard, Feed, ProfileView, Reviews, TravelMode, Messages, Events, Checkout, CheckoutPay, CheckoutSuccess, CheckoutCancel, AdminPanel (`/admin`), Privacidad, Terminos

## Tablas Supabase importantes (además de las core)

| Tabla | Descripción |
|-------|-------------|
| users | + totp_secret, totp_enabled, totp_backup_codes, current_streak, longest_streak, last_streak_date |
| sessions | + device_name, last_used_at |
| posts | type CHECK incluye 'poll', extra_data JSONB para poll data |
| post_poll_votes | Votos de encuestas (unique: post_id + user_id) |
| user_follows | Follow/followers (unique: follower_id + following_id) |
| group_chats | Grupos de chat |
| group_members | Membresía en grupos (role: admin/member) |
| group_messages | Mensajes de grupos |

## Flujos clave

### Registro
`/registro` → verificación email → `/kyc` (MetaMap o simulación) → dashboard

### Registro con Master Key
Admin genera key en `/admin` → usuario se registra con key → `pending_manual` → admin aprueba

### Login con 2FA activo
`POST /auth/login` → `{requires_2fa: true, totp_session: "..."}` → usuario ingresa código → `POST /2fa/verify` → tokens normales

### Deploy de emergencia (si GitHub Actions falla)
```bash
# Frontend
cd frontend && npm run build
npx vercel --token VERCEL_TOKEN --yes --prod

# Backend  
cd backend && $env:RAILWAY_TOKEN="92a42943-f458-48b4-ac80-de6faca4bdf3"
railway up --service 0fc4ee5b-182b-4a1e-af9e-4f868a7caecc
```

## Decisiones de marca

- **Emoción primaria:** Seguridad y confianza
- **Diferenciador:** Verificación KYC con DNI + biometría real
- **Tono:** Sofisticado y sugerente
- **Copy hero:** "Donde la identidad siempre es real."
- **Color principal:** Dorado `#C9A227` / `#FFE566`
- **Background:** `#020207` (casi negro)

## Estado de desarrollo (Mayo 2026)

- **Fase 1 ✅** — auth, KYC, admin básico, pagos, feed social
- **Fase 2 ✅** — backoffice admin completo (11 tabs), reportes PDF, payouts
- **Fase 3 ✅** — multimedia Supabase Storage, watermarks, screenshot blocking
- **Features extra ✅** — 2FA, sessions, polls, follow/followers, streaks, grupos, edit perfil
- **Módulo Tokens** — código completo pero comentado, activar cuando haya 50+ usuarios reales
- **Pendiente** — landing page (al usuario no le gusta la versión actual, refactorizar)

## Variables de entorno de producción (Railway)
Ver Railway dashboard. Las críticas son:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET_KEY` (cambiar si hay brecha de seguridad)
- `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_SUBJECT`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (cuando se active Stripe)
- `METAMAP_CLIENT_ID`, `METAMAP_CLIENT_SECRET` (KYC real)
- `SMTP_USER`, `SMTP_PASSWORD` (emails reales)
- `FRONTEND_URL=https://aurasw.club`
