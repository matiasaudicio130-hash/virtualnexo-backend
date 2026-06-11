from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from app.core.security import require_auth as _require_auth
from app.core.config import get_settings

router   = APIRouter(prefix="/push", tags=["push"])
settings = get_settings()


class SubscribeBody(BaseModel):
    endpoint: str
    p256dh:   str
    auth:     str
    user_agent: Optional[str] = None


@router.get("/vapid-key")
async def get_vapid_key():
    """Devuelve la clave pública VAPID para registrar push subscriptions."""
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe")
async def subscribe(body: SubscribeBody, request: Request):
    """Registra o actualiza la suscripción push del usuario."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    db.table("push_subscriptions").upsert({
        "user_id":    payload["sub"],
        "endpoint":   body.endpoint,
        "p256dh":     body.p256dh,
        "auth":       body.auth,
        "user_agent": body.user_agent or request.headers.get("user-agent", ""),
    }, on_conflict="user_id,endpoint").execute()
    return {"subscribed": True}


@router.delete("/unsubscribe")
async def unsubscribe(request: Request):
    """Elimina todas las suscripciones push del usuario en este dispositivo."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    get_supabase().table("push_subscriptions").delete().eq(
        "user_id", payload["sub"]
    ).execute()
    return {"unsubscribed": True}
