from fastapi import APIRouter, HTTPException, Request
from typing import Any
from pydantic import BaseModel

from app.core.security import decode_access_token
from app.db.supabase import get_supabase
from app.services.audit_service import audit_service


class SettingUpdateBody(BaseModel):
    value: Any

router = APIRouter(prefix="/settings", tags=["settings"])

# Settings públicas (no requieren auth, las puede leer el frontend para feature flags)
PUBLIC_SETTINGS = {
    "feature_tokens_enabled",
    "feature_reviews_enabled",
    "feature_travel_mode_enabled",
    "membership_price_usd",
}


def _require_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    if payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return payload


@router.get("/public")
async def public_settings():
    """Devuelve las settings públicas (feature flags, precio, etc.)."""
    db = get_supabase()
    result = db.table("system_settings").select("key,value").in_("key", list(PUBLIC_SETTINGS)).execute()
    return {row["key"]: row["value"] for row in result.data}


@router.get("/admin")
async def all_settings(request: Request):
    """Admin: lista todas las settings."""
    _require_admin(request)
    db = get_supabase()
    result = db.table("system_settings").select("*").order("key").execute()
    return result.data


# Keys que el admin puede modificar (allowlist explícita)
SETTABLE_KEYS = {
    "membership_price_usd",
    "price_monthly_ars", "price_annual_ars", "price_lifetime_ars",
    "price_monthly_usd", "price_annual_usd", "price_lifetime_usd",
    "influencer_payout_pct",
    "feature_tokens_enabled", "feature_reviews_enabled",
    "feature_travel_mode_enabled",
    "ads_between_posts", "ads_enabled",
    "exchange_rate_cache_minutes",
}


@router.put("/admin/{key}")
async def update_setting(key: str, body: SettingUpdateBody, request: Request):
    """Admin: actualiza una setting. body debe contener {value: ...}."""
    admin = _require_admin(request)

    if key not in SETTABLE_KEYS:
        raise HTTPException(403, f"Setting '{key}' no es modificable")

    db = get_supabase()
    existing = db.table("system_settings").select("value").eq("key", key).execute()
    if not existing.data:
        raise HTTPException(404, f"Setting '{key}' no existe")

    from datetime import datetime, timezone
    db.table("system_settings").update({
        "value": body.value,
        "updated_by": admin["sub"],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("key", key).execute()

    audit_service.log(
        action="setting.update",
        actor_id=admin["sub"],
        actor_role="admin",
        resource_type="setting",
        resource_id=key,
        metadata={"old_value": existing.data[0]["value"], "new_value": body.value},
        request=request,
    )
    return {"key": key, "value": body.value}
