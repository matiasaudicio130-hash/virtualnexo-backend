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
    payload = _require_admin(request)
    if payload.get("sub") == user_id:
        raise HTTPException(403, "No podés suspenderte a vos mismo")
    db = get_supabase()
    db.table("users").update({"status": "suspended"}).eq("id", user_id).execute()
    # Revocar todas las sesiones activas — el usuario no puede seguir logueado
    db.table("sessions").delete().eq("user_id", user_id).execute()
    return {"suspended": True, "sessions_revoked": True}


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
    from datetime import datetime, timezone, timedelta
    from collections import defaultdict

    db  = get_supabase()
    now = datetime.now(timezone.utc)

    # ── Usuarios por estado ───────────────────────────────────────────────────
    statuses = ["pending_email", "pending_kyc", "pending_manual", "active", "suspended", "rejected"]
    by_status: dict = {}
    for s in statuses:
        r = db.table("users").select("id", count="exact").eq("status", s).execute()
        by_status[s] = r.count or 0

    keys_r = db.table("master_keys").select("id", count="exact").eq("is_active", True).execute()
    by_status["active_keys"] = keys_r.count or 0

    # ── Usuarios nuevos por semana (últimas 8) ────────────────────────────────
    weekly_users = []
    for i in range(8, 0, -1):
        wk_start = (now - timedelta(weeks=i)).isoformat()
        wk_end   = (now - timedelta(weeks=i - 1)).isoformat()
        r = db.table("users").select("id", count="exact").gte("created_at", wk_start).lt("created_at", wk_end).execute()
        label = "Esta" if i == 1 else f"S-{i-1}"
        weekly_users.append({"label": label, "count": r.count or 0})

    # ── Usuarios activos hoy (que usaron la app → last_streak_date = hoy) ─────
    today_str = now.date().isoformat()
    active_today_r = db.table("users").select("id", count="exact").eq("last_streak_date", today_str).execute()

    # ── Usuarios con racha activa ─────────────────────────────────────────────
    streak_r = db.table("users").select("id", count="exact").gt("current_streak", 0).execute()

    # ── Contenido por día (últimos 7) ─────────────────────────────────────────
    daily_content = []
    for i in range(6, -1, -1):
        day_start = (now - timedelta(days=i)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        day_end   = (now - timedelta(days=i - 1)).replace(hour=0, minute=0, second=0, microsecond=0).isoformat()
        posts_r = db.table("posts").select("id", count="exact").eq("status", "active").neq("type", "story").gte("created_at", day_start).lt("created_at", day_end).execute()
        rxn_r   = db.table("post_reactions").select("id", count="exact").gte("created_at", day_start).lt("created_at", day_end).execute()
        cmt_r   = db.table("comments").select("id", count="exact").gte("created_at", day_start).lt("created_at", day_end).execute()
        day_label = "Hoy" if i == 0 else ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"][(now - timedelta(days=i)).weekday()]
        daily_content.append({
            "label":    day_label,
            "posts":    posts_r.count or 0,
            "reactions": rxn_r.count or 0,
            "comments": cmt_r.count or 0,
        })

    # ── Totales de contenido ─────────────────────────────────────────────────
    total_posts_r = db.table("posts").select("id", count="exact").eq("status", "active").neq("type", "story").execute()
    total_stories_r = db.table("posts").select("id", count="exact").eq("type", "story").eq("status", "active").execute()

    # ── Reportes pendientes ───────────────────────────────────────────────────
    reports_pending = 0
    try:
        rep_r = db.table("content_reports").select("id", count="exact").eq("status", "pending").execute()
        reports_pending = rep_r.count or 0
    except Exception:
        pass

    # ── Nuevos usuarios esta semana ───────────────────────────────────────────
    new_this_week = weekly_users[-1]["count"] if weekly_users else 0

    return {
        # Legado (mantiene compatibilidad con el tab de Usuarios)
        **by_status,
        # Nuevas métricas
        "active_today":    active_today_r.count or 0,
        "with_streak":     streak_r.count or 0,
        "new_this_week":   new_this_week,
        "total_posts":     total_posts_r.count or 0,
        "total_stories":   total_stories_r.count or 0,
        "reports_pending": reports_pending,
        "weekly_users":    weekly_users,
        "daily_content":   daily_content,
    }
