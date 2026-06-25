-- Fix tildes faltantes en ads de auto-promoción de Aura SW
-- BUG F: "Albumes privados verificados" → "Álbumes privados verificados"
--        "Crear mi album" → "Crear mi álbum"
--        "biometria real" → "biometría real"

UPDATE ads SET
  title   = REPLACE(title,   'Albumes', 'Álbumes'),
  body    = REPLACE(REPLACE(body, 'Albumes', 'Álbumes'), 'biometria', 'biometría'),
  cta_text = REPLACE(cta_text, 'album', 'álbum')
WHERE
  title   ILIKE '%albumes%'
  OR body  ILIKE '%albumes%'
  OR body  ILIKE '%biometria%'
  OR cta_text ILIKE '%album%';
