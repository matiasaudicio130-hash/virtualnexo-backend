from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from pydantic import BaseModel, field_validator
from datetime import date

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/travel", tags=["travel"])


class TravelPlanBody(BaseModel):
    dest_city: str
    dest_province: str
    arrival_date: str
    departure_date: Optional[str] = None
    origin_city: Optional[str] = None
    origin_province: Optional[str] = None
    description: Optional[str] = None
    looking_for: Optional[str] = None

    @field_validator("description", "looking_for", mode="before")
    @classmethod
    def limit_text(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 500:
            raise ValueError("El texto no puede superar los 500 caracteres")
        return v

    @field_validator("dest_city", "dest_province", mode="before")
    @classmethod
    def limit_city(cls, v: str) -> str:
        if v and len(v) > 100:
            raise ValueError("El campo no puede superar los 100 caracteres")
        return v

    @field_validator("arrival_date")
    @classmethod
    def arrival_not_past(cls, v: str) -> str:
        try:
            d = date.fromisoformat(v)
        except ValueError:
            raise ValueError("Fecha inválida (usar YYYY-MM-DD)")
        if d < date.today():
            raise ValueError("La fecha de llegada no puede ser en el pasado")
        return v


@router.get("/plans")
async def list_travel_plans(
    request: Request,
    province: Optional[str] = Query(None, description="Filtrar por provincia de destino"),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
):
    """
    Lista planes de viaje activos.
    Si se pasa province, filtra por destino.
    Por defecto muestra todos los planes futuros.
    """
    payload = _require_auth(request)
    db = get_supabase()

    q = db.table("travel_plans").select(
        "*, user:users!travel_plans_user_id_fkey(id,first_name,last_name,profile_photo_url,province)"
    ).eq("status", "active").gte("arrival_date", date.today().isoformat())

    if province:
        q = q.eq("dest_province", province)

    plans = q.order("arrival_date").range(offset, offset + limit - 1).execute().data

    # Filtrar shadow-banned
    banned_r = db.table("users").select("id").eq("is_shadow_banned", True).execute()
    banned_ids = {u["id"] for u in banned_r.data}

    result = []
    for p in plans:
        user = p.get("user") or {}
        if user.get("id") in banned_ids:
            continue
        result.append({
            **p,
            "author": {
                "id":     user.get("id"),
                "name":   f"{user.get('first_name','')} {user.get('last_name','')}".strip(),
                "avatar": user.get("profile_photo_url"),
                "from":   user.get("province"),
            },
        })

    return result


@router.get("/plans/mine")
async def my_travel_plans(request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    return db.table("travel_plans").select("*").eq(
        "user_id", payload["sub"]
    ).order("arrival_date", desc=True).execute().data


@router.post("/plans", status_code=201)
async def create_travel_plan(body: TravelPlanBody, request: Request):
    payload = _require_auth(request)
    db = get_supabase()

    # Cancelar viajes activos previos al mismo destino
    db.table("travel_plans").update({"status": "canceled"}).eq(
        "user_id", payload["sub"]
    ).eq("status", "active").eq("dest_province", body.dest_province).execute()

    result = db.table("travel_plans").insert({
        "user_id":        payload["sub"],
        "dest_city":      body.dest_city,
        "dest_province":  body.dest_province,
        "arrival_date":   body.arrival_date,
        "departure_date": body.departure_date,
        "origin_city":    body.origin_city,
        "origin_province":body.origin_province,
        "description":    body.description,
        "looking_for":    body.looking_for,
        "status":         "active",
    }).execute()
    return result.data[0]


@router.delete("/plans/{plan_id}")
async def cancel_travel_plan(plan_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    db.table("travel_plans").update({"status": "canceled"}).eq(
        "id", plan_id
    ).eq("user_id", payload["sub"]).execute()
    return {"canceled": True}
