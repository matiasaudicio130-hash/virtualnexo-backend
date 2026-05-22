from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta

from app.core.security import decode_access_token
from app.db.supabase import get_supabase
from app.services.master_key_service import master_key_service
from app.services.email_service import send_kyc_approved_email
from app.schemas.master_key import MasterKeyCreate, MasterKeyBatchCreate

router = APIRouter(prefix="/admin", tags=["admin"])


def _require_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    if payload.get("role") != "admin":
        raise HTTPException(403, "Acceso denegado: se requiere rol admin")
    return payload


# ============================================================
# MASTER KEYS
# ============================================================

@router.post("/keys", status_code=201)
async def create_key(body: MasterKeyCreate, request: Request):
    payload = _require_admin(request)
    key = master_key_service.create(body.model_dump(), payload["sub"])
    return key


@router.post("/keys/batch", status_code=201)
async def create_keys_batch(body: MasterKeyBatchCreate, request: Request):
    payload = _require_admin(request)
    if body.quantity > 100:
        raise HTTPException(400, "Máximo 100 keys por lote")
    keys = master_key_service.create_batch(body.quantity, body.model_dump(), payload["sub"])
    return {"created": len(keys), "keys": keys}


@router.get("/keys")
async def list_keys(
    request: Request,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    _require_admin(request)
    return master_key_service.list_all(limit, offset)


@router.delete("/keys/{key_id}")
async def deactivate_key(key_id: str, request: Request):
    _require_admin(request)
    ok = master_key_service.deactivate(key_id)
    if not ok:
        raise HTTPException(404, "Key no encontrada")
    return {"deactivated": True}


# ============================================================
# GESTIÓN DE USUARIOS
# ============================================================

@router.get("/users")
async def list_users(
    request: Request,
    status: str = Query(None),
    role: str = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    _require_admin(request)
    db = get_supabase()
    query = db.table("users").select(
        "id,email,first_name,last_name,role,status,membership_type,membership_expires_at,"
        "master_key_used,province,city,is_shadow_banned,created_at,last_login_at"
    )
    if status:
        query = query.eq("status", status)
    if role:
        query = query.eq("role", role)
    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return result.data


@router.get("/users/pending-manual")
async def pending_manual_users(request: Request):
    """Usuarios que esperan aprobación manual (entraron con master key)."""
    _require_admin(request)
    db = get_supabase()
    result = db.table("users").select("*").eq("status", "pending_manual").order("created_at").execute()
    return result.data


@router.post("/users/{user_id}/approve")
async def approve_user(user_id: str, request: Request):
    """Aprobar manualmente un usuario (pending_manual)."""
    _require_admin(request)
    db = get_supabase()
    user_result = db.table("users").select("*").eq("id", user_id).execute()
    if not user_result.data:
        raise HTTPException(404, "Usuario no encontrado")
    user = user_result.data[0]
    if user["status"] != "pending_manual":
        raise HTTPException(400, f"El usuario tiene estado '{user['status']}', no 'pending_manual'")

    db.table("users").update({
        "status": "active",
        "kyc_verified_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user_id).execute()

    send_kyc_approved_email(user["email"], user["first_name"])
    return {"approved": True, "user_id": user_id}


@router.post("/users/{user_id}/suspend")
async def suspend_user(user_id: str, request: Request):
    _require_admin(request)
    db = get_supabase()
    db.table("users").update({"status": "suspended"}).eq("id", user_id).execute()
    return {"suspended": True}


@router.post("/users/{user_id}/shadow-ban")
async def shadow_ban_user(user_id: str, request: Request):
    _require_admin(request)
    db = get_supabase()
    db.table("users").update({"is_shadow_banned": True}).eq("id", user_id).execute()
    return {"shadow_banned": True}


@router.post("/users/{user_id}/unshadow-ban")
async def remove_shadow_ban(user_id: str, request: Request):
    _require_admin(request)
    db = get_supabase()
    db.table("users").update({"is_shadow_banned": False}).eq("id", user_id).execute()
    return {"shadow_ban_removed": True}


# ============================================================
# MEMBRESÍAS MANUALES (pagos en efectivo)
# ============================================================

@router.post("/users/{user_id}/membership")
async def assign_membership(user_id: str, request: Request):
    """
    Asignar membresía manual (pago en efectivo u otro método offline).
    Body: { "type": "monthly" | "lifetime", "days": 30 }
    """
    _require_admin(request)
    body = await request.json()
    membership_type = body.get("type", "monthly")
    days = body.get("days", 30)

    if membership_type not in ("monthly", "lifetime"):
        raise HTTPException(400, "type debe ser 'monthly' o 'lifetime'")

    db = get_supabase()
    expires_at = None if membership_type == "lifetime" else (
        datetime.now(timezone.utc) + timedelta(days=days)
    ).isoformat()

    db.table("users").update({
        "membership_type": membership_type,
        "membership_expires_at": expires_at,
        "status": "active",
    }).eq("id", user_id).execute()

    return {"membership_assigned": membership_type, "expires_at": expires_at}


# ============================================================
# ESTADÍSTICAS
# ============================================================

@router.get("/stats")
async def dashboard_stats(request: Request):
    _require_admin(request)
    db = get_supabase()

    statuses = ["pending_email", "pending_kyc", "pending_manual", "active", "suspended", "rejected"]
    stats = {}
    for s in statuses:
        r = db.table("users").select("id").eq("status", s).execute()
        stats[s] = len(r.data)

    keys_r = db.table("master_keys").select("id").eq("is_active", True).execute()
    stats["active_keys"] = len(keys_r.data)

    return stats
