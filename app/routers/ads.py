from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from pydantic import BaseModel

from app.core.security import decode_access_token
from app.services.ads_service import ads_service
from app.db.supabase import get_supabase

router = APIRouter(prefix="/ads", tags=["ads"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


def _require_admin(request: Request) -> dict:
    p = _require_auth(request)
    if p.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return p


def _get_user_province(user_id: str) -> Optional[str]:
    db = get_supabase()
    r = db.table("users").select("province").eq("id", user_id).execute()
    return r.data[0]["province"] if r.data else None


# ── Endpoints públicos (para el frontend) ─────────────────────

@router.get("/feed")
async def feed_ads(
    request: Request,
    type: str = Query("banner"),
    limit: int = Query(3, le=10),
):
    """Devuelve anuncios para el feed del usuario autenticado (filtrados por provincia)."""
    payload = _require_auth(request)
    province = _get_user_province(payload["sub"])
    return ads_service.get_ads_for_user(user_province=province, ad_type=type, limit=limit)


@router.post("/{ad_id}/event")
async def record_ad_event(ad_id: str, body: dict, request: Request):
    """
    Registra un evento (impression | click | overlay_open | overlay_close).
    El frontend llama este endpoint cuando el usuario interactúa con un anuncio.
    """
    payload = _require_auth(request)
    action = body.get("action", "click")
    if action not in {"impression", "click", "overlay_open", "overlay_close"}:
        raise HTTPException(400, "Acción inválida")

    province = body.get("province") or _get_user_province(payload["sub"])
    ads_service.record_event(
        ad_id=ad_id,
        action=action,
        user_id=payload["sub"],
        user_province=province,
        session_id=body.get("session_id"),
    )
    return {"recorded": True}


# ── Endpoints admin ────────────────────────────────────────────

class AdvertiserBody(BaseModel):
    name: str
    category: str = "other"
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    notes: Optional[str] = None


class AdBody(BaseModel):
    advertiser_id: str
    type: str = "banner"
    title: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    target_url: str
    cta_text: str = "Ver más"
    provinces: Optional[list] = None   # None = todas las provincias
    priority: int = 1
    ends_at: Optional[str] = None


@router.get("/admin/advertisers")
async def list_advertisers(request: Request):
    _require_admin(request)
    return ads_service.list_advertisers()


@router.post("/admin/advertisers", status_code=201)
async def create_advertiser(body: AdvertiserBody, request: Request):
    _require_admin(request)
    return ads_service.create_advertiser(body.model_dump(exclude_none=True))


@router.get("/admin/list")
async def list_ads(request: Request, active_only: bool = Query(False)):
    _require_admin(request)
    return ads_service.list_ads(active_only=active_only)


@router.post("/admin/ads", status_code=201)
async def create_ad(body: AdBody, request: Request):
    _require_admin(request)
    return ads_service.create_ad(body.model_dump(exclude_none=True))


@router.put("/admin/ads/{ad_id}")
async def update_ad(ad_id: str, body: dict, request: Request):
    _require_admin(request)
    return ads_service.update_ad(ad_id, body)


@router.get("/admin/stats")
async def ad_stats(request: Request, ad_id: Optional[str] = Query(None)):
    _require_admin(request)
    return ads_service.get_ad_stats(ad_id=ad_id)


@router.get("/admin/report/{ad_id}")
async def ad_detailed_report(ad_id: str, request: Request):
    """Reporte detallado de clicks por provincia y acción para un anuncio."""
    _require_admin(request)
    db = get_supabase()
    clicks = db.table("ad_clicks").select(
        "action,user_province,created_at"
    ).eq("ad_id", ad_id).order("created_at", desc=True).limit(500).execute().data

    from collections import defaultdict
    by_province: dict = defaultdict(lambda: {"impression": 0, "click": 0, "overlay_open": 0})
    by_day: dict = defaultdict(int)
    for c in clicks:
        prov = c["user_province"] or "Desconocida"
        by_province[prov][c["action"]] = by_province[prov].get(c["action"], 0) + 1
        day = c["created_at"][:10]
        by_day[day] += 1 if c["action"] == "click" else 0

    return {
        "ad_id": ad_id,
        "total_events": len(clicks),
        "by_province": {k: dict(v) for k, v in by_province.items()},
        "clicks_by_day": dict(sorted(by_day.items())),
    }
