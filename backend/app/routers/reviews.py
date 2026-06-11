from fastapi import APIRouter, HTTPException, Request, Query
from typing import Optional
from pydantic import BaseModel, field_validator

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase
from app.services.audit_service import audit_service

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _require_admin(request: Request) -> dict:
    payload = _require_auth(request)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return payload


class CreateReviewBody(BaseModel):
    reviewed_id: str
    rating: int
    text: Optional[str] = None
    is_anonymous: bool = True

    @field_validator("rating")
    @classmethod
    def valid_rating(cls, v: int) -> int:
        if not 1 <= v <= 5:
            raise ValueError("Rating debe ser entre 1 y 5")
        return v


@router.post("/", status_code=201)
async def create_review(body: CreateReviewBody, request: Request):
    payload = _require_auth(request)
    if payload["sub"] == body.reviewed_id:
        raise HTTPException(400, "No podés reseñarte a vos mismo")

    db = get_supabase()
    # Verificar que el usuario reseñado existe y está activo
    target = db.table("users").select("id,status").eq("id", body.reviewed_id).execute()
    if not target.data or target.data[0]["status"] != "active":
        raise HTTPException(404, "Usuario no encontrado")

    # Upsert: actualiza si ya existe una reseña previa de este reviewer
    result = db.table("reviews").upsert({
        "reviewer_id":  payload["sub"],
        "reviewed_id":  body.reviewed_id,
        "rating":       body.rating,
        "text":         body.text,
        "is_anonymous": body.is_anonymous,
        "status":       "active",
    }, on_conflict="reviewer_id,reviewed_id").execute()

    return result.data[0]


@router.get("/user/{user_id}")
async def get_user_reviews(
    user_id: str,
    request: Request,
    include_anonymous: bool = Query(True),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
):
    payload = _require_auth(request)
    db = get_supabase()

    q = db.table("reviews").select(
        "id,rating,text,is_anonymous,created_at,"
        "reviewer:users!reviews_reviewer_id_fkey(id,first_name,last_name,profile_photo_url)"
    ).eq("reviewed_id", user_id).eq("status", "active")

    reviews = q.order("created_at", desc=True).range(offset, offset + limit - 1).execute().data

    # Ocultar identidad de reseñas anónimas (excepto el propio reviewer)
    for r in reviews:
        if r.get("is_anonymous") and r.get("reviewer", {}).get("id") != payload["sub"]:
            r["reviewer"] = {"id": None, "first_name": "Usuario", "last_name": "Anónimo", "profile_photo_url": None}

    # Stats
    stats_r = db.table("user_review_stats").select("*").eq("user_id", user_id).execute()
    stats = stats_r.data[0] if stats_r.data else {"total_reviews": 0, "avg_rating": None, "positive_count": 0, "medal": "none"}

    return {"stats": stats, "reviews": reviews}


@router.get("/my-review/{reviewed_id}")
async def my_review_for_user(reviewed_id: str, request: Request):
    """Devuelve la reseña que el usuario autenticado escribió sobre otro."""
    payload = _require_auth(request)
    db = get_supabase()
    r = db.table("reviews").select("*").eq("reviewer_id", payload["sub"]).eq("reviewed_id", reviewed_id).execute()
    return r.data[0] if r.data else None


@router.delete("/{review_id}")
async def delete_review(review_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    db.table("reviews").delete().eq("id", review_id).eq("reviewer_id", payload["sub"]).execute()
    return {"deleted": True}


# Admin: moderar reseñas
@router.put("/admin/{review_id}/hide")
async def admin_hide_review(review_id: str, request: Request):
    admin = _require_admin(request)
    db = get_supabase()
    r = db.table("reviews").update({"status": "hidden"}).eq("id", review_id).execute()
    audit_service.log("review.hidden", actor_id=admin["sub"], resource_type="review", resource_id=review_id, request=request)
    return r.data[0] if r.data else {"status": "hidden"}


@router.get("/admin/flagged")
async def admin_flagged_reviews(request: Request):
    _require_admin(request)
    db = get_supabase()
    return db.table("reviews").select("*").eq("status", "flagged").execute().data
