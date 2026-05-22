# VirtualNexo — Guía de Setup

> **Nombre provisional.** Para renombrar la app, editar SOLO:
> - `frontend/src/config/app.ts` → campo `name`
> - `backend/app/core/branding.py` → campo `APP_NAME`
> - `frontend/index.html` → tag `<title>`
> - `frontend/vite.config.ts` → campo `name` y `short_name` del PWA manifest

---

## Requisitos previos

- Node.js 20+
- Python 3.11+
- Cuenta en [Supabase](https://supabase.com) (free tier OK para dev)

---

## 1. Base de Datos (Supabase)

1. Crear un nuevo proyecto en Supabase
2. Ir a **SQL Editor** y ejecutar en orden:
   - `supabase/migrations/001_create_tables.sql`
   - `supabase/migrations/002_rls_policies.sql`
3. Copiar las credenciales: URL, anon key, service role key

---

## 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

cp .env.example .env
# Completar .env con tus credenciales de Supabase y JWT secret
```

**Variables mínimas para correr en dev:**
```
JWT_SECRET_KEY=cualquier-string-largo-y-aleatorio
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
METAMAP_SIMULATION_MODE=true
```

**Iniciar el servidor:**
```bash
python main.py
# API disponible en http://localhost:8000
# Docs en http://localhost:8000/docs (solo en dev)
```

**Crear el primer admin** (ejecutar en la SQL Editor de Supabase después de registrar tu usuario):
```sql
UPDATE users SET role = 'admin', status = 'active' WHERE email = 'tu-email@gmail.com';
```

---

## 3. Frontend (React PWA)

```bash
cd frontend
npm install

cp .env.example .env
# .env contiene solo: VITE_API_URL=http://localhost:8000/api/v1

npm run dev
# App en http://localhost:5173
```

---

## Flujo de registro completo (dev)

1. Ir a `http://localhost:5173/registro`
2. Completar el formulario → el backend logueará el email en consola (modo dev sin SMTP)
3. En la consola del backend, copiar el link de verificación
4. Abrir el link → redirige a `/kyc`
5. En la página KYC, usar los botones "Simular APROBACIÓN/RECHAZO"
6. Accedés al dashboard ✓

---

## Flujo con Master Key

1. Como admin: ir a `/admin` → pestaña "Master Keys" → generar una key
2. Compartir la key con el usuario
3. El usuario se registra con la key en el campo opcional
4. Email verificado → estado `pending_manual` → esperá aprobación admin
5. Admin va a `/admin` → "Pendientes" → Aprobar

---

## Estructura del proyecto

```
SwPaginaWeb/
├── frontend/               # React + TypeScript PWA
│   └── src/
│       ├── config/app.ts   ← NOMBRE DE LA APP (frontend)
│       ├── pages/          ← Landing, Register, Login, KYC, Dashboard, Admin
│       ├── components/     ← UI reutilizable
│       ├── store/          ← Estado global (Zustand)
│       └── lib/api.ts      ← Axios + helpers de API
├── backend/                # FastAPI (Python)
│   └── app/
│       ├── core/branding.py  ← NOMBRE DE LA APP (backend)
│       ├── routers/          ← auth, kyc, admin
│       └── services/         ← metamap, email, master_keys
└── supabase/
    └── migrations/           ← SQL + RLS
```

---

## Fase 2 (próxima)

- Panel admin completo (backoffice independiente)
- Generador de reportes PDF
- Gestión de pagos manuales
- Configuración de payouts para influencers

## Fase 3

- Almacenamiento multimedia en Supabase Storage
- Marca de agua visible (ID de usuario en foto)
- Marca de agua invisible (esteganografía)
- Bloqueo de capturas nativo

## Módulo Tokens (listo para activar)

El código del sistema de tokens está escrito pero **comentado** en el codebase.
Se activa desde el panel admin cuando el admin lo habilite.
