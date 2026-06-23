-- ============================================================
-- AURA SW — Índices de performance
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ── POSTS ────────────────────────────────────────────────────

-- Feed principal: posts ordenados por fecha descendente
CREATE INDEX IF NOT EXISTS idx_posts_created_at
  ON posts (created_at DESC);

-- Feed filtrado por usuario (perfil propio, "mis posts")
CREATE INDEX IF NOT EXISTS idx_posts_user_id_created
  ON posts (user_id, created_at DESC);

-- Feed excluyendo eliminados (partial index — más compacto que el full)
CREATE INDEX IF NOT EXISTS idx_posts_active
  ON posts (created_at DESC)
  WHERE deleted_at IS NULL;

-- ── MESSAGES ─────────────────────────────────────────────────

-- Chat window: mensajes de una conversación ordenados cronológicamente
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages (conversation_id, created_at ASC);

-- Supabase Realtime filter por conversation_id (mejora el routing del canal)
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON messages (conversation_id);

-- ── NOTIFICATIONS ────────────────────────────────────────────

-- Panel de notificaciones: no leídas del usuario, más recientes primero
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- ── REACTIONS ────────────────────────────────────────────────

-- Contadores de reacciones por post (DoubleTapLike, PostCard)
CREATE INDEX IF NOT EXISTS idx_reactions_post_id
  ON reactions (post_id, reaction_type);

-- ── STORIES ──────────────────────────────────────────────────

-- StoryBar: stories vigentes ordenadas por fecha
CREATE INDEX IF NOT EXISTS idx_stories_expires_created
  ON stories (expires_at, created_at DESC)
  WHERE expires_at > NOW();

-- ── PROFILE VIEWS ────────────────────────────────────────────

-- "Quién vio tu perfil" (Encargo #1 del Plan Estratégico)
-- Solo crear si la tabla existe
CREATE INDEX IF NOT EXISTS idx_profile_views_viewed_at
  ON profile_views (viewed_user_id, viewed_at DESC);

-- ── FOLLOWS ──────────────────────────────────────────────────

-- Feed de "Siguiendo": posts de usuarios que sigo
CREATE INDEX IF NOT EXISTS idx_user_follows_following
  ON user_follows (following_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower
  ON user_follows (follower_id);

-- ── VERIFICACIÓN ─────────────────────────────────────────────
-- Después de ejecutar, verificar con:
--
-- SELECT indexname, tablename, pg_size_pretty(pg_relation_size(indexrelid)) AS size
-- FROM pg_indexes
-- JOIN pg_class ON pg_class.relname = indexname
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;
