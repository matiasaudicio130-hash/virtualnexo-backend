-- ═══════════════════════════════════════════════════════════════════
-- Cuentas privadas + solicitudes de follow
-- Ejecutar UNA VEZ en el SQL Editor del dashboard de Supabase
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_private BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS follow_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (requester_id, target_id)
);

CREATE INDEX IF NOT EXISTS idx_follow_requests_target ON follow_requests (target_id, status);

-- RLS: el backend usa service_role y bypasea RLS automáticamente.
-- Habilitamos RLS para que el cliente anon no pueda leer directamente.
ALTER TABLE follow_requests ENABLE ROW LEVEL SECURITY;
