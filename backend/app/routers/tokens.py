"""
Módulo de Economía de Tokens.
Activo SOLO si system_settings.feature_tokens_enabled == true.
El check se hace en cada endpoint con _require_tokens_feature().

ESTADO ACTUAL: Código completo pero deshabilitado por feature flag.
Para activarlo: admin debe togglear `feature_tokens_enabled` en /admin/settings.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase


class SendGiftBody(BaseModel):
    gift_id: str

router = APIRouter(prefix="/tokens", tags=["tokens"])


def _require_tokens_feature():
    """Si la feature está OFF, todos los endpoints devuelven 404."""
    db = get_supabase()
    result = db.table("system_settings").select("value").eq("key", "feature_tokens_enabled").execute()
    enabled = result.data and (result.data[0]["value"] is True or result.data[0]["value"] == "true")
    if not enabled:
        raise HTTPException(404, "Feature no disponible")


@router.get("/wallet")
async def get_wallet(request: Request):
    """Devuelve el saldo de tokens del usuario autenticado."""
    _require_tokens_feature()
    payload = _require_auth(request)
    db = get_supabase()
    result = db.table("token_wallets").select("*").eq("user_id", payload["sub"]).execute()
    if not result.data:
        db.table("token_wallets").insert({"user_id": payload["sub"], "balance": 0}).execute()
        return {"user_id": payload["sub"], "balance": 0}
    return result.data[0]


@router.get("/transactions")
async def get_transactions(request: Request):
    _require_tokens_feature()
    payload = _require_auth(request)
    db = get_supabase()
    result = db.table("token_transactions").select("*").eq("user_id", payload["sub"]).order(
        "created_at", desc=True
    ).limit(50).execute()
    return result.data


@router.get("/gifts/catalog")
async def gifts_catalog(request: Request):
    _require_tokens_feature()
    _require_auth(request)
    db = get_supabase()
    return db.table("gift_catalog").select("*").eq("is_active", True).execute().data


@router.post("/gifts/send/{recipient_id}")
async def send_gift(recipient_id: str, body: SendGiftBody, request: Request):
    """Envía un regalo virtual a otro usuario (debita tokens)."""
    _require_tokens_feature()
    payload = _require_auth(request)
    sender_id = payload["sub"]
    gift_id = body.gift_id

    db = get_supabase()
    gift_r = db.table("gift_catalog").select("*").eq("id", gift_id).eq("is_active", True).execute()
    if not gift_r.data:
        raise HTTPException(404, "Regalo no encontrado")
    cost = gift_r.data[0]["cost_tokens"]

    wallet_r = db.table("token_wallets").select("balance").eq("user_id", sender_id).execute()
    balance = wallet_r.data[0]["balance"] if wallet_r.data else 0
    if balance < cost:
        raise HTTPException(400, "Saldo insuficiente")

    # Debitar
    db.table("token_wallets").update({"balance": balance - cost}).eq("user_id", sender_id).execute()
    db.table("token_transactions").insert({
        "user_id": sender_id,
        "amount": -cost,
        "reason": "gift_sent",
        "related_user": recipient_id,
        "metadata": {"gift_id": gift_id},
    }).execute()
    # Notificar al destinatario (en una versión futura podría ir a una tabla de notifications)
    db.table("token_transactions").insert({
        "user_id": recipient_id,
        "amount": 0,
        "reason": "gift_received",
        "related_user": sender_id,
        "metadata": {"gift_id": gift_id},
    }).execute()
    return {"sent": True, "remaining_balance": balance - cost}
