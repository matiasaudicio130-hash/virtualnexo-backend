from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("/")
async def list_notifications(
    request: Request,
    unread_only: bool = Query(False),
    limit: int = Query(30, le=100),
    offset: int = Query(0, ge=0),
):
    payload = _require_auth(request)
    db = get_supabase()
    q = db.table("notifications").select("*").eq("user_id", payload["sub"])
    if unread_only:
        q = q.is_("read_at", "null")
    return q.order("created_at", desc=True).range(offset, offset + limit - 1).execute().data


@router.get("/unread-count")
async def unread_count(request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    rows = db.table("notifications").select("id").eq(
        "user_id", payload["sub"]
    ).is_("read_at", "null").execute().data
    return {"count": len(rows)}


@router.post("/{notif_id}/read")
async def mark_read(notif_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    db.table("notifications").update({
        "read_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", notif_id).eq("user_id", payload["sub"]).execute()
    return {"read": True}


@router.post("/read-all")
async def mark_all_read(request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    db.table("notifications").update({
        "read_at": datetime.now(timezone.utc).isoformat()
    }).eq("user_id", payload["sub"]).is_("read_at", "null").execute()
    return {"all_read": True}


@router.post("/read-conversation/{sender_id}")
async def mark_conversation_read(sender_id: str, request: Request):
    """Marca como leídas todas las notificaciones new_message de un remitente específico."""
    payload = _require_auth(request)
    user_id = payload["sub"]
    db = get_supabase()
    try:
        unread_r = db.table("notifications").select("id,data").eq(
            "user_id", user_id
        ).eq("type", "new_message").is_("read_at", "null").execute()
        ids = [
            n["id"] for n in (unread_r.data or [])
            if (n.get("data") or {}).get("sender_id") == sender_id
        ]
        if ids:
            now = datetime.now(timezone.utc).isoformat()
            for nid in ids:
                db.table("notifications").update({"read_at": now}).eq("id", nid).execute()
    except Exception:
        pass
    return {"cleared": True}
