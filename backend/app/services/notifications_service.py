"""
Helper para crear notificaciones in-app.
Módulo independiente para evitar imports circulares.
"""
import logging
from datetime import datetime, timezone
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
    Si se provee actor_id, enriquece data con actor_name y actor_avatar.
    Para new_message: agrupa mensajes del mismo remitente en una sola notificación no leída."""
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

        # Agrupar notificaciones de mensajes del mismo remitente.
        # Se buscan todas las no leídas del tipo y se filtra en Python
        # para evitar dependencia del operador ->> de JSONB en supabase-py.
        if notif_type == "new_message" and actor_id:
            try:
                unread_r = db.table("notifications").select("id,data").eq(
                    "user_id", user_id
                ).eq("type", "new_message").is_("read_at", "null").execute()
                match = next(
                    (n for n in (unread_r.data or [])
                     if (n.get("data") or {}).get("sender_id") == actor_id),
                    None,
                )
                if match:
                    prev_data = match.get("data") or {}
                    count = prev_data.get("msg_count", 1) + 1
                    actor_name = payload.get("actor_name") or prev_data.get("actor_name") or "Alguien"
                    new_payload = {**prev_data, **payload, "msg_count": count}
                    new_title = f"{actor_name} te mandó {count} mensajes"
                    db.table("notifications").update({
                        "title":      new_title,
                        "body":       body,
                        "data":       new_payload,
                        "created_at": datetime.now(timezone.utc).isoformat(),
                    }).eq("id", match["id"]).execute()
                    return
            except Exception:
                pass  # Si falla el agrupado, crear notificación nueva normalmente

        db.table("notifications").insert({
            "user_id": user_id,
            "type":    notif_type,
            "title":   title,
            "body":    body,
            "data":    payload,
        }).execute()
    except Exception as e:
        logger.debug(f"Notificación no creada ({notif_type}): {e}")
