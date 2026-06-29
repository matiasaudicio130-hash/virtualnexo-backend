-- 010_increment_profile_views.sql
-- Agrega profile_views_count a users y crea la función RPC atómica.
-- Equivalente a 006_atomic_post_views.sql pero para vistas de perfil.

-- Columna contadora (idempotente)
alter table users
  add column if not exists profile_views_count integer default 0;

-- Función RPC atómica (idempotente)
create or replace function increment_profile_views(p_user_id uuid)
returns void
language sql
as $$
  update users
     set profile_views_count = coalesce(profile_views_count, 0) + 1
   where id = p_user_id;
$$;
