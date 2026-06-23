-- ============================================================
-- AURA SW — Reemplazar ads placeholder por autopublicidad
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Desactivar todos los ads/anunciantes placeholder
UPDATE advertisers
SET active = false
WHERE name ILIKE '%ejemplo%'
   OR name ILIKE '%placeholder%'
   OR name ILIKE '%test%'
   OR name ILIKE '%demo%';

UPDATE ads
SET active = false
WHERE advertiser_id IN (
  SELECT id FROM advertisers
  WHERE name ILIKE '%ejemplo%'
     OR name ILIKE '%placeholder%'
     OR name ILIKE '%test%'
     OR name ILIKE '%demo%'
);

-- 2. Insertar anunciante "Aura" (autopublicidad)
INSERT INTO advertisers (id, name, category, logo_url, website_url, active)
VALUES (
  gen_random_uuid(),
  'AURA',
  'lifestyle',
  null,
  'https://aurasw.club',
  true
)
ON CONFLICT (name) DO UPDATE SET active = true;

-- 3. Insertar ad de autopublicidad — Álbumes privados
INSERT INTO ads (
  advertiser_id, type, title, description,
  image_url, target_url, cta_text, active,
  starts_at, ends_at
)
SELECT
  a.id,
  'banner',
  'Álbumes privados verificados',
  'Compartí contenido exclusivo solo con quien vos elegís. Cada foto con firma digital invisible.',
  null,
  '/dashboard',
  'Crear mi álbum',
  true,
  NOW(),
  NOW() + INTERVAL '90 days'
FROM advertisers a
WHERE a.name = 'AURA'
LIMIT 1;

-- 4. Insertar segundo ad — Perfil verificado
INSERT INTO ads (
  advertiser_id, type, title, description,
  image_url, target_url, cta_text, active,
  starts_at, ends_at
)
SELECT
  a.id,
  'banner',
  'Tu identidad, verificada.',
  'DNI + biometría real. Nadie puede hacerse pasar por vos. La única red donde todos son reales.',
  null,
  '/registro',
  'Invitá a alguien',
  true,
  NOW(),
  NOW() + INTERVAL '90 days'
FROM advertisers a
WHERE a.name = 'AURA'
LIMIT 1;
