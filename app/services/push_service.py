"""
Servicio de Push Notifications via Web Push / VAPID.
Se envía a todos los dispositivos suscritos del usuario.
"""
import json, logging
from typing import Optional
from app.db.supabase import get_supabase
from app.core.config import get_settings

logger   = logging.getLogger(__name__)
settings = get_settings()


def _get_webpusher():
    try:
        from pywebpush import webpush, WebPushException
        return webpush, WebPushException
    except ImportError:
        return None, None


def send_push(
    user_id:  str,
    title:    str,
    body:     str,
    url:      str = "/",
    icon:     str = "/brand/logo-mark-dark.png",
    data:     Optional[dict] = None,
) -> int:
    """Envía push a todos los dispositivos del usuario. Devuelve cantidad enviada."""
    webpush, WebPushException = _get_webpusher()
    if not webpush:
        return 0
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        return 0

    db   = get_supabase()
    subs = db.table("push_subscriptions").select("*").eq("user_id", user_id).execute().data
    if not subs:
        return 0

    payload = json.dumps({
        "title": title,
        "body":  body,
        "icon":  icon,
        "url":   url,
        "data":  data or {},
    })

    sent = 0
    failed_ids = []

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub["endpoint"],
                    "keys": {
                        "p256dh": sub["p256dh"],
                        "auth":   sub["auth"],
                    },
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={
                    "sub": settings.VAPID_SUBJECT or "mailto:soporte@aurasw.club",
                },
                content_encoding="aesgcm",
            )
            sent += 1
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                # Suscripción expirada → borrar
                failed_ids.append(sub["id"])
            else:
                logger.warning(f"Push failed for {user_id}: {e}")
        except Exception as e:
            logger.warning(f"Push error: {e}")

    if failed_ids:
        db.table("push_subscriptions").delete().in_("id", failed_ids).execute()

    return sent


push_service = type("PushService", (), {"send": staticmethod(send_push)})()
