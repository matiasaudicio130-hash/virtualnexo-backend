# PLAN — Habilitar Row Level Security en 25 tablas desprotegidas

## 0. Hallazgo clave de esta sesión (verificar que sigue vigente antes de actuar)

Investigué el patrón de acceso a datos del proyecto y encontré algo que cambia
radicalmente el nivel de riesgo de esta tarea:

- **El backend FastAPI usa `SUPABASE_SERVICE_ROLE_KEY`** (`backend/app/db/supabase.py:16`),
  que **bypasea RLS por completo**.
- **El frontend NO usa el cliente de Supabase en absoluto** — `grep -rln "createClient\|@supabase/supabase-js\|supabase\.from(" frontend/src/`
  no devuelve ningún resultado. Cero `VITE_SUPABASE_*`. Todo el acceso a datos
  pasa por el backend FastAPI.

**Conclusión:** habilitar RLS con políticas restrictivas (incluso "deny-all" para
`anon`/`authenticated`) en estas 25 tablas **no debería romper nada de la app
actual**, porque el único consumidor real (el backend) sigue funcionando — usa
`service_role`, que ignora RLS. Lo único que cambia es que se cierra el agujero
por el cual cualquiera con la `anon key` pública puede hoy leer/escribir estas
tablas directamente vía la REST API de Supabase (PostgREST), sin pasar por el
backend ni su lógica de autorización.

⚠️ **Esto hay que volver a confirmarlo en la futura sesión** — el código puede
haber cambiado. Si alguna parte del frontend empezó a usar Supabase Realtime o
el cliente JS directo, el análisis cambia y las políticas SÍ importan para esos
casos.

## 1. Las 25 tablas y su sensibilidad

| Tabla | Sensibilidad | Notas |
|---|---|---|
| `user_follows` | Alta | relaciones sociales — recién extendida en Parte 3 (follow_requests sí tiene RLS) |
| `user_blocks` | Alta | quién bloqueó a quién — info sensible |
| `user_reports` | Alta | reportes de usuarios — moderación |
| `comment_reports` | Alta | reportes de comentarios |
| `profile_views` | Media | quién vio qué perfil |
| `profile_likes` | Media | likes entre perfiles (matches) |
| `matches` | Alta | matches entre usuarios |
| `post_comments` | Media | comentarios en posts |
| `post_reactions`* | — | (ya tiene RLS, no está en la lista) |
| `message_reactions` | Alta | reacciones a mensajes privados |
| `conversation_settings` | Media | config de conversaciones DM |
| `typing_indicators` | Baja | indicadores efímeros de "escribiendo..." |
| `post_saves` | Media | guardados de posts del usuario |
| `story_reactions` | Media | reacciones a historias |
| `story_highlights` | Media | historias destacadas |
| `story_highlight_items` | Media | ítems de historias destacadas |
| `push_subscriptions` | Alta | tokens de push notifications (sensibles) |
| `events` | Baja-Media | eventos comunitarios (públicos por diseño) |
| `event_attendees` | Media | quién asiste a qué evento |
| `post_poll_votes` | Media | votos de encuestas |
| `group_chats` | Alta | grupos de chat |
| `group_members` | Alta | membresía de grupos |
| `group_messages` | Alta | mensajes de grupo (contenido privado) |
| `albums` | Alta | álbumes exclusivos (contenido pago/privado) |
| `album_photos` | Alta | fotos de álbumes exclusivos |
| `album_access_requests` | Media | solicitudes de acceso a álbumes |

## 2. Plan de acción recomendado (orden, no todo de una vez)

1. **Re-confirmar el hallazgo del punto 0** — re-correr los greps, confirmar que
   `app/db/supabase.py` sigue usando `service_role`, y además buscar
   `supabase.channel`/`.realtime`/`createClient` por si se agregó algo nuevo
   desde esta sesión (2026-06-08).

2. **Decidir el tipo de política**:
   - **Opción A (recomendada, más simple y rápida):** `ENABLE ROW LEVEL
     SECURITY` sin políticas permisivas → deny-all efectivo para `anon`/
     `authenticated`. El backend sigue funcionando vía `service_role`. Cierra
     el agujero hoy mismo con cero riesgo de romper la app actual.
   - **Opción B (más fina, más trabajo):** agregar políticas explícitas tipo
     "el dueño puede ver/editar sus propias filas" — sólo vale la pena si en
     algún momento se planea acceso directo desde el cliente (Realtime,
     Storage policies, etc.). Si la Opción A no rompe nada, puede hacerse
     después como mejora incremental, sin apuro ni presión de "arreglar ya".

   → Mi recomendación: arrancar con **Opción A** (rápida, de bajo riesgo,
   cierra el hueco crítico ya), y dejar la Opción B como mejora futura
   solo si surge una necesidad real de acceso directo desde el cliente.

3. **Aplicar en tandas pequeñas y probar entre cada una** — no las 25 juntas:
   - Tanda 1 (bajo riesgo / efímero): `typing_indicators`, `push_subscriptions`,
     `conversation_settings`, `profile_views`
   - Tanda 2 (medio): `post_comments`, `comment_reports`, `post_saves`,
     `story_reactions`, `story_highlights`, `story_highlight_items`,
     `post_poll_votes`, `events`, `event_attendees`, `album_access_requests`
   - Tanda 3 (alto / crítico): `user_follows`, `user_blocks`, `user_reports`,
     `profile_likes`, `matches`, `message_reactions`, `group_chats`,
     `group_members`, `group_messages`, `albums`, `album_photos`

4. **Smoke test después de cada tanda** contra producción (o un Supabase branch
   si se prefiere no tocar prod directamente):
   - Seguir/dejar de seguir, bloquear, reportar
   - Comentar posts, reaccionar, guardar posts
   - Abrir conversaciones DM, reaccionar a mensajes, indicador de "escribiendo"
   - Ver/crear historias destacadas, reaccionar a stories
   - Eventos: ver, RSVP
   - Grupos: ver, enviar mensajes
   - Álbumes: ver, solicitar acceso, ver fotos
   - Encuestas: votar

5. **Registrar la migración** en `backend/supabase/migration_rls_<tanda>.sql`
   siguiendo la convención del proyecto (header, `ENABLE ROW LEVEL SECURITY`,
   NO auto-aplicar — o aplicar vía `mcp__supabase__apply_migration` igual que
   se hizo con `post_tags`/`follow_privacy` en esta sesión, dejando el archivo
   como registro).

6. **Monitorear logs** (`mcp__supabase__get_logs`, `railway logs`) por errores
   nuevos durante las horas/días posteriores a cada tanda.

## 3. Rollback

`ALTER TABLE <tabla> DISABLE ROW LEVEL SECURITY;` revierte instantáneamente sin
pérdida de datos — es seguro experimentar tanda por tanda.

---

## PROMPT PARA LA PRÓXIMA SESIÓN

```
Contexto: "Aura SW" (proyecto Supabase lwrtsllcanbvrsyqbgol, repo en
c:\Users\matu_\Desktop\SwPaginaWeb). Una sesión anterior detectó que 25 tablas
de la base de datos de producción tienen Row Level Security DESHABILITADO,
exponiéndolas completamente a las claves anon/authenticated de Supabase
(advisory crítico de `mcp__supabase__list_tables`). Esa sesión NO aplicó la
remediación por las dudas, y dejó un plan detallado en
`PLAN_RLS_SEGURIDAD.md` (leelo primero, completo).

HALLAZGO CLAVE que hace esta tarea de bajo riesgo (re-confirmalo, no asumas que
sigue igual):
- El backend FastAPI usa SUPABASE_SERVICE_ROLE_KEY (bypasea RLS) — ver
  backend/app/db/supabase.py
- El frontend NO usa el cliente de Supabase directamente (sin createClient,
  sin supabase.from, sin VITE_SUPABASE_*) — TODO pasa por el backend FastAPI
- Por lo tanto, habilitar RLS con políticas restrictivas (o sin políticas
  permisivas = deny-all) en estas 25 tablas no debería romper la app actual.

TAREA:
1. Re-correr los greps del punto 0 del plan para confirmar que el patrón de
   acceso (todo vía backend con service_role, cero Supabase client en
   frontend) sigue siendo así. Si encontrás supabase.channel/.realtime/
   createClient en el frontend, PARÁ y replanteá — el análisis de riesgo
   cambia.
2. Si se confirma: aplicar `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` (Opción
   A del plan — sin políticas permisivas, deny-all para anon/authenticated)
   en TANDAS según el orden del plan (bajo riesgo → medio → alto), probando
   los flujos relevantes de la app entre cada tanda (lista de smoke tests en
   el punto 4 del plan).
3. Usar `mcp__supabase__apply_migration` para aplicar cada tanda, y dejar
   registro en `backend/supabase/migration_rls_<tanda>.sql` siguiendo la
   convención de migraciones del proyecto (ver migration_follow_privacy.sql
   como ejemplo de formato).
4. Monitorear logs (`mcp__supabase__get_logs`, `railway logs`) por errores
   nuevos tras cada tanda antes de avanzar a la siguiente.
5. Si algo se rompe: `ALTER TABLE <tabla> DISABLE ROW LEVEL SECURITY;` revierte
   al instante sin pérdida de datos.

Trabajá con cuidado — es la base de datos de producción de una app social en
uso real (~22 usuarios activos). Confirmá conmigo antes de cada tanda si algo
no está 100% claro, y nunca apliques las 25 tablas de una sola vez.

Si te falta alguna skill (p.ej. para diseño de políticas RLS de Postgres/
Supabase), instalala vos mismo antes de empezar — sos senior, hacé el research
que necesites.
```
