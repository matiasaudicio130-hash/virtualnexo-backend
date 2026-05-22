-- ============================================================
-- VIRTUALNEXO - Migración 003: Pagos, Auditoría y Settings
-- Incluye al final tablas para Tokens (creadas pero feature
-- desactivado por flag en system_settings).
-- ============================================================

-- ============================================================
-- TABLA: payments
-- Registra TODOS los pagos (digitales y efectivo)
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_usd          DECIMAL(10, 2) NOT NULL,
  amount_ars          DECIMAL(12, 2) NOT NULL,
  exchange_rate       DECIMAL(10, 2) NOT NULL,  -- ARS por 1 USD al momento del pago
  method              TEXT NOT NULL
                        CHECK (method IN ('cash', 'transfer', 'stripe', 'mercadopago', 'crypto', 'other')),
  membership_type     TEXT NOT NULL
                        CHECK (membership_type IN ('monthly', 'lifetime')),
  membership_days     INTEGER NOT NULL DEFAULT 30,
  status              TEXT NOT NULL DEFAULT 'completed'
                        CHECK (status IN ('pending', 'completed', 'refunded', 'failed')),
  reference           TEXT,                     -- nro de operación, ticket, etc.
  notes               TEXT,
  external_id         TEXT,                     -- ID de Stripe/MP/etc.
  processed_by        UUID REFERENCES users(id), -- admin que cargó (para pagos manuales)
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payments_user_id     ON payments(user_id);
CREATE INDEX idx_payments_status      ON payments(status);
CREATE INDEX idx_payments_method      ON payments(method);
CREATE INDEX idx_payments_created_at  ON payments(created_at DESC);

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_payments"
  ON payments FOR ALL TO anon USING (false);

CREATE POLICY "users_read_own_payments"
  ON payments FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);


-- ============================================================
-- TABLA: system_settings
-- Feature flags y configuración global. Solo admin escribe.
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
  key         TEXT PRIMARY KEY,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES users(id),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_settings"
  ON system_settings FOR ALL TO anon USING (false);

-- Settings iniciales
INSERT INTO system_settings (key, value, description) VALUES
  ('membership_price_usd', '25', 'Precio mensual en USD (se convierte a ARS via dólar blue)'),
  ('feature_tokens_enabled', 'false', 'Habilita la economía de tokens y tienda de socios'),
  ('feature_reviews_enabled', 'false', 'Habilita el sistema de reseñas (Fase 4)'),
  ('feature_travel_mode_enabled', 'false', 'Habilita el modo viaje en el feed (Fase 4)'),
  ('exchange_rate_cache_minutes', '15', 'Minutos de caché para la cotización del dólar blue')
ON CONFLICT (key) DO NOTHING;


-- ============================================================
-- TABLA: audit_log
-- Trazabilidad de acciones admin
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id        UUID REFERENCES users(id),  -- quien hizo la acción
  actor_role      TEXT,
  action          TEXT NOT NULL,               -- ej: 'user.approve', 'payment.create', 'key.generate'
  resource_type   TEXT,                        -- 'user', 'payment', 'master_key', etc.
  resource_id     TEXT,
  metadata        JSONB,                       -- detalles adicionales
  ip_address      TEXT,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_actor_id   ON audit_log(actor_id);
CREATE INDEX idx_audit_action     ON audit_log(action);
CREATE INDEX idx_audit_resource   ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_created_at ON audit_log(created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_audit"
  ON audit_log FOR ALL TO anon USING (false);

CREATE POLICY "auth_no_access_audit"
  ON audit_log FOR ALL TO authenticated USING (false);


-- ============================================================
-- TABLA: exchange_rate_cache
-- Cachea la cotización del dólar blue para no spamear la API
-- ============================================================
CREATE TABLE IF NOT EXISTS exchange_rate_cache (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  currency_pair TEXT NOT NULL,                 -- 'USD_ARS_BLUE'
  buy           DECIMAL(10, 2),
  sell          DECIMAL(10, 2),
  source        TEXT NOT NULL DEFAULT 'dolarapi.com',
  fetched_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_exchange_pair_fetched ON exchange_rate_cache(currency_pair, fetched_at DESC);

ALTER TABLE exchange_rate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_no_access_exchange"
  ON exchange_rate_cache FOR ALL TO anon USING (false);


-- ============================================================
-- TABLAS DE TOKENS (creadas pero feature deshabilitado)
-- Se activan vía system_settings.feature_tokens_enabled = true
-- ============================================================

-- Saldo de tokens por usuario
CREATE TABLE IF NOT EXISTS token_wallets (
  user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance     INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE token_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_wallets"
  ON token_wallets FOR ALL TO anon USING (false);
CREATE POLICY "users_read_own_wallet"
  ON token_wallets FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

-- Histórico de transacciones de tokens
CREATE TABLE IF NOT EXISTS token_transactions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount        INTEGER NOT NULL,              -- positivo=ingreso, negativo=egreso
  reason        TEXT NOT NULL,                  -- 'purchase', 'gift_sent', 'gift_received', 'partner_redeem'
  related_user  UUID REFERENCES users(id),
  metadata      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_tx_user_id ON token_transactions(user_id);
CREATE INDEX idx_token_tx_created ON token_transactions(created_at DESC);

ALTER TABLE token_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_token_tx"
  ON token_transactions FOR ALL TO anon USING (false);
CREATE POLICY "users_read_own_token_tx"
  ON token_transactions FOR SELECT TO authenticated
  USING (auth.uid()::TEXT = user_id::TEXT);

-- Catálogo de regalos virtuales
CREATE TABLE IF NOT EXISTS gift_catalog (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  icon_url    TEXT,
  cost_tokens INTEGER NOT NULL CHECK (cost_tokens > 0),
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE gift_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_no_access_gifts"
  ON gift_catalog FOR ALL TO anon USING (false);
