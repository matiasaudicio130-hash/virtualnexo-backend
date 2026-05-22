-- ============================================================
-- VIRTUALNEXO - Migración 002: Row Level Security (RLS)
-- El backend usa service_role key → bypasses RLS
-- RLS actúa como capa de seguridad adicional si alguien
-- obtiene acceso directo a la DB con una anon key
-- ============================================================

-- Activar RLS en todas las tablas sensibles
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE master_keys          ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_verifications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE kyc_verifications    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions             ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Rol de servicio (backend FastAPI): acceso total
-- El backend usa SUPABASE_SERVICE_ROLE_KEY → bypasses todo
-- ============================================================

-- TABLA: users
-- Anon no puede leer nada
CREATE POLICY "anon_no_access_users"
  ON users FOR ALL
  TO anon
  USING (false);

-- Usuarios autenticados solo ven su propio registro
CREATE POLICY "users_read_own"
  ON users FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = id::TEXT);

CREATE POLICY "users_update_own"
  ON users FOR UPDATE
  TO authenticated
  USING (auth.uid()::TEXT = id::TEXT)
  WITH CHECK (auth.uid()::TEXT = id::TEXT);

-- ============================================================
-- TABLA: master_keys (solo admin)
-- ============================================================
CREATE POLICY "anon_no_access_master_keys"
  ON master_keys FOR ALL
  TO anon
  USING (false);

CREATE POLICY "auth_no_access_master_keys"
  ON master_keys FOR ALL
  TO authenticated
  USING (false);

-- ============================================================
-- TABLA: email_verifications
-- ============================================================
CREATE POLICY "anon_no_access_email_verif"
  ON email_verifications FOR ALL
  TO anon
  USING (false);

CREATE POLICY "auth_read_own_email_verif"
  ON email_verifications FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

-- ============================================================
-- TABLA: kyc_verifications
-- ============================================================
CREATE POLICY "anon_no_access_kyc"
  ON kyc_verifications FOR ALL
  TO anon
  USING (false);

CREATE POLICY "auth_read_own_kyc"
  ON kyc_verifications FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

-- ============================================================
-- TABLA: sessions
-- ============================================================
CREATE POLICY "anon_no_access_sessions"
  ON sessions FOR ALL
  TO anon
  USING (false);

CREATE POLICY "auth_read_own_sessions"
  ON sessions FOR SELECT
  TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

-- ============================================================
-- Vista segura para el admin (via backend con service_role)
-- No exponer via postgREST directamente
-- ============================================================
CREATE OR REPLACE VIEW admin_users_view AS
SELECT
  id, email, first_name, last_name, birth_date,
  role, status, membership_type, membership_expires_at,
  master_key_used, province, city,
  is_shadow_banned, created_at, last_login_at
FROM users;

REVOKE ALL ON admin_users_view FROM anon, authenticated;
