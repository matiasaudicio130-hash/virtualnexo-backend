-- ═══════════════════════════════════════════════════════════════════
-- Tabla: content_reports — Reportes de moderación de contenido
-- Ejecutar UNA VEZ en el SQL Editor del dashboard de Supabase
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS content_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type  TEXT NOT NULL CHECK (target_type IN ('post', 'user')),
  target_id    UUID NOT NULL,          -- post_id o user_id
  reason       TEXT NOT NULL,
  details      TEXT    DEFAULT '',
  status       TEXT    NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'dismissed', 'actioned')),
  admin_note   TEXT    DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT now(),
  reviewed_at  TIMESTAMPTZ,
  reviewed_by  UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS cr_status_idx  ON content_reports(status, created_at DESC);
CREATE INDEX IF NOT EXISTS cr_target_idx  ON content_reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS cr_reporter_idx ON content_reports(reporter_id);

-- RLS: el backend usa service_role y bypasea RLS automáticamente.
-- Habilitamos RLS para que el cliente anon no pueda leer directamente.
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
