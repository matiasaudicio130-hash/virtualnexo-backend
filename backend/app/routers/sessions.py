"""
Session manager — ver y revocar sesiones activas.
Permite al usuario saber desde qué dispositivos está conectado y cerrar sesiones remotamente.
"""
from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Request

from app.core.security import decode_access_token
from app.db.supabase import get_supabase

router = APIRouter(prefix="/sessions", tags=["sessions"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


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

    result = db.table("sessions").select("id,user_id").eq("id", session_id).execute()
    if not result.data:
        raise HTTPException(404, "Sesión no encontrada")
    if result.data[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "No tenés permiso para revocar esta sesión")

    db.table("sessions").delete().eq("id", session_id).execute()
    return {"revoked": True}


@router.delete("/")
async def revoke_all_other_sessions(request: Request):
    """Revoca todas las sesiones excepto la actual."""
    payload = _require_auth(request)
    db = get_supabase()

    # Identificar sesión actual por el refresh token del header (si se envía)
    # Como no lo tenemos, borramos las más antiguas que no fueron usadas recientemente
    # Estrategia: mantener la sesión usada en los últimos 2 minutos, borrar el resto
    from datetime import timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(minutes=2)).isoformat()

    result = db.table("sessions").select("id,last_used_at").eq("user_id", payload["sub"]).execute()
    to_delete = [
        s["id"] for s in result.data
        if not s.get("last_used_at") or s["last_used_at"] < cutoff
    ]

    for sid in to_delete:
        db.table("sessions").delete().eq("id", sid).execute()

    return {"revoked": len(to_delete), "kept": len(result.data) - len(to_delete)}


def _label_ua(ua: str) -> str:
    ua = ua.lower()
    browser = "Chrome" if "chrome" in ua else "Firefox" if "firefox" in ua else \
              "Safari" if "safari" in ua else "Edge" if "edg" in ua else "App"
    os_name = "Android" if "android" in ua else "iOS" if "iphone" in ua or "ipad" in ua else \
              "Windows" if "windows" in ua else "Mac" if "mac" in ua else "Otro"
    return f"{browser} en {os_name}"
