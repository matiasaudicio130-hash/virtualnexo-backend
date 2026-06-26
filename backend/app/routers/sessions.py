"""
Session manager — ver y revocar sesiones activas.
Permite al usuario saber desde qué dispositivos está conectado y cerrar sesiones remotamente.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/sessions", tags=["sessions"])


@router.get("/")
async def list_sessions(request: Request):
    """Lista todas las sesiones activas del usuario autenticado."""
    payload = _require_auth(request)
    db = get_supabase()

    now = datetime.now(timezone.utc)
    result = db.table("sessions").select(
        "id,user_agent,ip_address,device_name,last_used_at,created_at,expires_at"
    ).eq("user_id", payload["sub"]).order("last_used_at", desc=True).execute()

    sessions = []
    for s in result.data:
        exp = datetime.fromisoformat(s["expires_at"].replace("Z", "+00:00"))
        if exp < now:
            continue
        sessions.append({
            "id":           s["id"],
            "device_name":  s.get("device_name") or _label_ua(s.get("user_agent", "")),
            "ip_address":   s.get("ip_address", ""),
            "last_used_at": s.get("last_used_at"),
            "created_at":   s.get("created_at"),
        })

    return sessions


@router.delete("/{session_id}")
async def revoke_session(session_id: str, request: Request):
    """Revoca una sesión específica (cierre de sesión remoto)."""
    payload = _require_auth(request)
    db = get_supabase()

    # Combina check de ownership y delete en una sola query — evita race condition
    result = db.table("sessions").delete().eq("id", session_id).eq(
        "user_id", payload["sub"]
    ).execute()
    if not result.data:
        raise HTTPException(404, "Sesión no encontrada o sin permiso")
    return {"revoked": True}


@router.delete("/")
async def revoke_all_other_sessions(request: Request):
    """Revoca todas las sesiones excepto la más reciente (la actual)."""
    payload = _require_auth(request)
    db = get_supabase()

    # La sesión actual es la que tiene last_used_at más reciente
    # (acaba de hacer esta request, así que es la mayor)
    result = db.table("sessions").select("id,last_used_at").eq(
        "user_id", payload["sub"]
    ).order("last_used_at", desc=True).execute()

    if not result.data:
        return {"revoked": 0, "kept": 0}

    # Mantener solo la primera (más reciente); borrar el resto
    keep_id = result.data[0]["id"]
    to_delete = [s["id"] for s in result.data[1:]]

    if to_delete:
        db.table("sessions").delete().eq("user_id", payload["sub"]).neq(
            "id", keep_id
        ).execute()

    return {"revoked": len(to_delete), "kept": 1}


def _label_ua(ua: str) -> str:
    ua = ua.lower()
    browser = "Chrome" if "chrome" in ua else "Firefox" if "firefox" in ua else \
              "Safari" if "safari" in ua else "Edge" if "edg" in ua else "App"
    os_name = "Android" if "android" in ua else "iOS" if "iphone" in ua or "ipad" in ua else \
              "Windows" if "windows" in ua else "Mac" if "mac" in ua else "Otro"
    return f"{browser} en {os_name}"
