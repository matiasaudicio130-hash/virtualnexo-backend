-- Fix tildes faltantes en ads de auto-promoción de Aura SW
-- Columnas reales: title, description, cta_text (NO "body")
-- Ejecutado manualmente el 2026-06-25 via Python script

UPDATE ads SET
  title       = REPLACE(title,       'Albumes',   'Álbumes'),
  description = REPLACE(REPLACE(description, 'Albumes', 'Álbumes'), 'biometria', 'biometría'),
  cta_text    = REPLACE(cta_text,    'album',     'álbum')
WHERE
  title       ILIKE '%albumes%'
  OR description ILIKE '%albumes%'
  OR description ILIKE '%biometria%'
  OR cta_text ILIKE '%album%';
