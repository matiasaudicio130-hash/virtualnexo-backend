from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

from app.core.security import decode_access_token

router = APIRouter(prefix="/discovery", tags=["discovery"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


class LocationBody(BaseModel):
    lat: float
    lng: float


@router.post("/location")
async def update_location(body: LocationBody, request: Request):
    """Actualiza la ubicación del usuario (llamar al abrir la app)."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    get_supabase().table("users").update({
        "lat":         body.lat,
        "lng":         body.lng,
        "location_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", payload["sub"]).execute()
    return {"updated": True}


@router.get("/nearby")
async def nearby_users(
    request: Request,
    lat:       float = Query(...),
    lng:       float = Query(...),
    radius_km: int   = Query(50, le=200),
    limit:     int   = Query(20, le=50),
):
    """Usuarios verificados y activos cerca de las coordenadas dadas."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()

    # Guardar ubicación del viewer
    db.table("users").update({
        "lat": lat, "lng": lng,
        "location_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", payload["sub"]).execute()

    # Obtener usuarios con ubicación reciente (últimas 24h)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    users  = db.table("users").select(
        "id,first_name,last_name,profile_photo_url,profile_type,province,city,lat,lng,location_at"
    ).eq("status", "active").neq("id", payload["sub"]).gte(
        "location_at", cutoff
    ).not_.is_("lat", "null").limit(200).execute().data

    # Filtrar por distancia en Python (rápido para <200 usuarios)
    import math
    def dist(u):
        dlat = math.radians(float(u["lat"]) - lat)
        dlng = math.radians(float(u["lng"]) - lng)
        a = math.sin(dlat/2)**2 + math.cos(math.radians(lat)) * math.cos(math.radians(float(u["lat"]))) * math.sin(dlng/2)**2
        return 6371 * 2 * math.asin(math.sqrt(a))

    nearby = []
    for u in users:
        try:
            km = round(dist(u), 1)
            if km <= radius_km:
                u["distance_km"] = km
                nearby.append(u)
        except Exception:
            pass

    nearby.sort(key=lambda u: u["distance_km"])
    return {"users": nearby[:limit], "total": len(nearby[:limit])}


@router.get("/suggestions")
async def profile_suggestions(
    request: Request,
    limit:   int = Query(12, le=30),
):
    """Perfiles sugeridos basados en provincia y tipo de perfil del viewer."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()

    # Datos del viewer
    viewer_r = db.table("users").select(
        "province,profile_type,interested_in"
    ).eq("id", payload["sub"]).execute()
    if not viewer_r.data:
        return {"users": []}
    viewer = viewer_r.data[0]

    from app.utils.profile_constants import ATTRACTION_MAP, SOLO_TYPES
    from app.services.profile_service import _resolve_viewer_category

    # Tipos compatibles según interested_in
    interested = viewer.get("interested_in") or []
    target_types: set = set()
    if interested:
        for cat in interested:
            target_types |= ATTRACTION_MAP.get(cat, set())
    else:
        target_types = set(ATTRACTION_MAP.keys())

    # Usuarios ya vistos recientemente
    viewed_r = db.table("profile_views").select("viewed_id").eq(
        "viewer_id", payload["sub"]
    ).gte("viewed_at", (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()).execute()
    viewed_ids = {r["viewed_id"] for r in viewed_r.data}
    viewed_ids.add(payload["sub"])

    # Buscar candidatos
    q = db.table("users").select(
        "id,first_name,last_name,profile_photo_url,profile_type,province,city,bio"
    ).eq("status", "active").neq("is_shadow_banned", True)

    if viewer.get("province"):
        q = q.eq("province", viewer["province"])

    candidates = q.limit(100).execute().data

    # Filtrar: tipo compatible, no visto recientemente
    from app.utils.profile_constants import VALID_PROFILE_TYPES
    suggestions = []
    for u in candidates:
        if u["id"] in viewed_ids:
            continue
        pt = u.get("profile_type")
        if pt and (not target_types or pt in target_types):
            suggestions.append(u)

    # Shuffle
    import random
    random.shuffle(suggestions)
    return {"users": suggestions[:limit]}


@router.post("/anonymous-mode")
async def toggle_anonymous_mode(request: Request):
    """Activa/desactiva el modo anónimo (no registra visitas al perfil)."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    r = db.table("users").select("anonymous_mode,membership_type").eq(
        "id", payload["sub"]
    ).execute()
    if not r.data:
        raise HTTPException(404, "Usuario no encontrado")

    user = r.data[0]
    # Solo disponible con membresía activa
    if user.get("membership_type") == "none":
        raise HTTPException(403, "El modo anónimo requiere membresía activa")

    new_mode = not bool(user.get("anonymous_mode"))
    db.table("users").update({"anonymous_mode": new_mode}).eq("id", payload["sub"]).execute()
    return {"anonymous_mode": new_mode}
