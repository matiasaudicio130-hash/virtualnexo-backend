-- 006_atomic_post_views.sql
-- Incremento atómico de posts.views_count.
--
-- Antes el backend hacía read-then-write (SELECT views_count → UPDATE +1), que
-- pierde conteos cuando dos usuarios ven la misma story al mismo tiempo. Esta
-- función mueve el incremento al motor de la base, donde el UPDATE es atómico.
--
-- El backend la llama vía RPC: db.rpc("increment_post_views", {"p_post_id": id}).
-- Es idempotente de aplicar (CREATE OR REPLACE) y reversible (DROP FUNCTION).

create or replace function increment_post_views(p_post_id uuid)
returns void
language sql
as $$
  update posts
     set views_count = coalesce(views_count, 0) + 1
   where id = p_post_id;
$$;
