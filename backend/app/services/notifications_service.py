"""
Helper para crear notificaciones in-app.
Módulo independiente para evitar imports circulares.
"""
import logging
from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)


def create_notification(
    user_id: str,
    notif_type: str,
    title: str,
    body: str = "",
    data: dict | None = None,
    actor_id: str | None = None,
) -> None:
    """Crea una notificación. Nunca lanza excepciones — falla silenciosamente.
    Si se provee actor_id, enriquece data con actor_name y actor_avatar."""
    try:
        db = get_supabase()
        payload = dict(data or {})

        if actor_id and "actor_avatar" not in payload:
            actor_r = db.table("users").select(
                "first_name,last_name,profile_photo_url"
            ).eq("id", actor_id).execute()
            if actor_r.data:
                u = actor_r.data[0]
                payload["actor_name"]   = f"{u['first_name']} {u['last_name']}".strip()
                payload["actor_avatar"] = u.get("profile_photo_url") or ""

        db.table("notifications").insert({
            "user_id": user_id,
            "type":    notif_type,
            "title":   title,
            "body":    body,
            "data":    payload,
        }).execute()
    except Exception as e:
        logger.debug(f"Notificación no creada ({notif_type}): {e}")
