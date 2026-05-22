-- ============================================================
-- VIRTUALNEXO - Migración 001: Tablas principales
-- NOMBRE DE APP: Buscar "virtualnexo" en este repo para renombrar
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLA: users
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  birth_date          DATE NOT NULL,
  role                TEXT NOT NULL DEFAULT 'miembro'
                        CHECK (role IN ('miembro', 'influencer', 'socio', 'admin')),
  status              TEXT NOT NULL DEFAULT 'pending_email'
                        CHECK (status IN (
                          'pending_email',   -- esperando verificación de email
                          'pending_kyc',     -- email verificado, KYC pendiente
                          'pending_manual',  -- entró con master key, espera aprobación admin
                          'active',          -- acceso completo
                          'suspended',       -- suspendido por admin
                          'rejected'         -- KYC rechazado
                        )),
  kyc_flow_id         TEXT,
  kyc_identity_id     TEXT,
  kyc_verified_at     TIMESTAMPTZ,
  membership_type     TEXT DEFAULT 'none'
                        CHECK (membership_type IN ('none', 'monthly', 'lifetime')),
  membership_expires_at TIMESTAMPTZ,
  master_key_used     TEXT,
  profile_photo_url   TEXT,
  bio                 TEXT,
  city                TEXT,
  province            TEXT,
  lat                 DECIMAL(10, 8),
  lng                 DECIMAL(11, 8),
  is_shadow_banned    BOOLEAN DEFAULT FALSE,
  last_login_at       TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email    ON users(email);
CREATE INDEX idx_users_status   ON users(status);
CREATE INDEX idx_users_role     ON users(role);
CREATE INDEX idx_users_province ON users(province);

-- ============================================================
-- TABLA: master_keys
-- ============================================================
CREATE TABLE IF NOT EXISTS master_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT UNIQUE NOT NULL,
  type            TEXT NOT NULL
                    CHECK (type IN ('gratis', 'descuento', 'temporal', 'vitalicio')),
  discount_pct    INTEGER DEFAULT 0 CHECK (discount_pct BETWEEN 0 AND 100),
  temp_days       INTEGER,           -- solo para tipo 'temporal'
  max_uses        INTEGER DEFAULT 1,
  uses_count      INTEGER DEFAULT 0,
  created_by      UUID REFERENCES users(id),
  expires_at      TIMESTAMPTZ,
  notes           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_master_keys_code ON master_keys(code);
CREATE INDEX idx_master_keys_active ON master_keys(is_active);

-- ============================================================
-- TABLA: email_verifications
-- ============================================================
CREATE TABLE IF NOT EXISTS email_verifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token       TEXT UNIQUE NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_email_verif_token   ON email_verifications(token);
CREATE INDEX idx_email_verif_user_id ON email_verifications(user_id);

-- ============================================================
-- TABLA: kyc_verifications
-- ============================================================
CREATE TABLE IF NOT EXISTS kyc_verifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metamap_flow_id     TEXT,
  metamap_identity_id TEXT,
  status              TEXT DEFAULT 'pending'
                        CHECK (status IN ('pending', 'verified', 'rejected', 'expired')),
  rejection_reason    TEXT,
  webhook_data        JSONB,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_kyc_user_id        ON kyc_verifications(user_id);
CREATE INDEX idx_kyc_flow_id        ON kyc_verifications(metamap_flow_id);
CREATE INDEX idx_kyc_identity_id    ON kyc_verifications(metamap_identity_id);

-- ============================================================
-- TABLA: sessions (refresh tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token   TEXT UNIQUE NOT NULL,
  user_agent      TEXT,
  ip_address      TEXT,
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id       ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);

-- ============================================================
-- FUNCIÓN: actualizar updated_at automáticamente
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_kyc_updated_at
  BEFORE UPDATE ON kyc_verifications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
