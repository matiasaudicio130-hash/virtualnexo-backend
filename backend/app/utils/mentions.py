"""
Utilidades para el sistema de menciones (@usuario).
Extrae usernames mencionados en texto y envía notificaciones a los usuarios.
"""
import re

MENTION_RE = re.compile(r"@([A-Za-z0-9_]{2,30})")


def extract_mentions(text: str) -> list[str]:
    """Devuelve lista de usernames mencionados (sin @, en minúsculas, sin duplicados)."""
    return list({m.lower() for m in MENTION_RE.findall(text or "")})


def notify_mentions(
    text: str,
    actor_id: str,
    actor_name: str,
    url: str = "/feed",
) -> None:
    """
    Para cada @username en `text`:
    - Busca el usuario por username
    - Crea notificación in-app
    - Envía push notification
    No bloquea — los errores se silencian.
    """
    usernames = extract_mentions(text)
    if not usernames:
        return

    try:
        from app.db.supabase import get_supabase
        from app.services.push_service import send_push

        db = get_supabase()

        # Fetch all mentioned users in one batch query
        users_r = db.table("users").select("id, username").in_("username", usernames).eq("status", "active").execute()

        for u in users_r.data or []:
            if u["id"] == actor_id:
                continue  # No notificarse a uno mismo
            try:
                preview = (text or "")[:100].strip()
                db.table("notifications").insert({
                    "user_id": u["id"],
                    "type":    "mention",
                    "title":   f"{actor_name} te mencionó",
                    "body":    preview,
                }).execute()
                send_push(
                    u["id"],
                    f"💬 {actor_name} te mencionó",
                    preview,
                    url=url,
                )
            except Exception:
                pass
    except Exception:
        pass
