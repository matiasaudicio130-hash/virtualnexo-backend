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
) -> None:
    """Crea una notificación. Nunca lanza excepciones — falla silenciosamente."""
    try:
        db = get_supabase()
        db.table("notifications").insert({
            "user_id": user_id,
            "type":    notif_type,
            "title":   title,
            "body":    body,
            "data":    data or {},
        }).execute()
    except Exception as e:
        logger.debug(f"Notificación no creada ({notif_type}): {e}")
