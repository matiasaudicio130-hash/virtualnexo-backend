-- ═══════════════════════════════════════════════════════════════════
-- Tabla: post_tags — Usuarios etiquetados en publicaciones
-- Ejecutar UNA VEZ en el SQL Editor del dashboard de Supabase
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS post_tags (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id         UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tagged_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (post_id, tagged_user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_tags_user ON post_tags (tagged_user_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_post ON post_tags (post_id);

-- RLS: el backend usa service_role y bypasea RLS automáticamente.
-- Habilitamos RLS para que el cliente anon no pueda leer directamente.
ALTER TABLE post_tags ENABLE ROW LEVEL SECURITY;
