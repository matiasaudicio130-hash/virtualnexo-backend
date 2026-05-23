"""
Albums — sistema de galerías privadas con solicitudes de acceso.
"Solo para quienes @usuario elige." — La Estratega
"""
import re
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Query
from pydantic import BaseModel

from app.core.security import decode_access_token
from app.db.supabase import get_supabase
from app.services.storage_service import storage_service

router = APIRouter(prefix="/albums", tags=["albums"])

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_]{4,20}$')


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


# ── Username ─────────────────────────────────────────────────────

class SetUsernameBody(BaseModel):
    username: str


@router.get("/username/check/{username}")
async def check_username(username: str):
    """Verificar si un username está disponible."""
    if not USERNAME_RE.match(username):
        return {"available": False, "reason": "invalid_format"}
    db = get_supabase()
    r = db.table("users").select("id").eq("username", username.lower()).execute()
    return {"available": len(r.data) == 0}


@router.post("/username")
async def set_username(body: SetUsernameBody, request: Request):
    """Establecer o cambiar el username. Solo permitido cada 60 días."""
    payload = _require_auth(request)
    user_id = payload["sub"]

    username = body.username.strip().lower()
    if not USERNAME_RE.match(username):
        raise HTTPException(400, "Username inválido. Usá 4-20 caracteres: letras, números y guiones bajos.")

    db = get_supabase()
    user = db.table("users").select("username, username_changed_at").eq("id", user_id).execute().data
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    u = user[0]

    # Verificar cooldown de 60 días
    if u.get("username_changed_at"):
        last = datetime.fromisoformat(u["username_changed_at"].replace("Z", "+00:00"))
        days = (datetime.now(timezone.utc) - last).days
        if days < 60:
            raise HTTPException(400, f"Podés cambiar el username en {60 - days} días.")

    # Verificar unicidad
    existing = db.table("users").select("id").eq("username", username).neq("id", user_id).execute()
    if existing.data:
        raise HTTPException(409, "Ese username ya está en uso.")

    db.table("users").update({
        "username": username,
        "username_changed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", user_id).execute()

    return {"username": username}


# ── Seeking (qué buscás) ─────────────────────────────────────────

class SetSeekingBody(BaseModel):
    tags: list[str] = []
    text: Optional[str] = None


VALID_SEEKING_TAGS = {
    "explorar_sin_apuro", "charlar_y_ver", "planes_y_salidas",
    "conexiones_reales", "experiencias_nuevas", "en_pareja_explorando",
    "solo_curiosidad"
}

@router.post("/seeking")
async def set_seeking(body: SetSeekingBody, request: Request):
    """Actualizar 'qué buscás': hasta 3 tags + 80 chars texto."""
    payload = _require_auth(request)
    tags = [t for t in body.tags if t in VALID_SEEKING_TAGS][:3]
    text = (body.text or "").strip()[:80] or None
    db = get_supabase()
    db.table("users").update({"seeking_tags": tags, "seeking_text": text}).eq("id", payload["sub"]).execute()
    return {"seeking_tags": tags, "seeking_text": text}


# ── Albums ────────────────────────────────────────────────────────

class CreateAlbumBody(BaseModel):
    title: str
    description: Optional[str] = None
    is_private: bool = False


@router.post("/", status_code=201)
async def create_album(body: CreateAlbumBody, request: Request):
    payload = _require_auth(request)
    title = body.title.strip()
    if not title or len(title) > 60:
        raise HTTPException(400, "El título debe tener entre 1 y 60 caracteres.")
    db = get_supabase()
    r = db.table("albums").insert({
        "user_id": payload["sub"],
        "title": title,
        "description": body.description,
        "is_private": body.is_private,
    }).execute()
    return r.data[0]


@router.get("/user/{user_id}")
async def list_user_albums(user_id: str, request: Request):
    """Lista albums de un usuario. Privados solo se muestran con título + candado."""
    payload = _require_auth(request)
    is_owner = payload["sub"] == user_id
    db = get_supabase()

    albums = db.table("albums").select(
        "id,title,description,is_private,cover_blur_url,photos_count,access_requests_count,created_at"
    ).eq("user_id", user_id).order("created_at", desc=False).execute().data

    result = []
    for a in albums:
        if a["is_private"] and not is_owner:
            # Verificar si tiene acceso aprobado
            req = db.table("album_access_requests").select("status").eq("album_id", a["id"]).eq("requester_id", payload["sub"]).execute()
            approved = any(r["status"] == "approved" for r in req.data)
            a["has_access"] = approved
            a["my_request_status"] = req.data[0]["status"] if req.data else None
        else:
            a["has_access"] = True
            a["my_request_status"] = None
        result.append(a)

    return result


@router.get("/mine")
async def my_albums(request: Request):
    """Albums propios con datos completos."""
    payload = _require_auth(request)
    db = get_supabase()
    return db.table("albums").select("*").eq("user_id", payload["sub"]).order("created_at").execute().data


@router.patch("/{album_id}")
async def update_album(album_id: str, body: CreateAlbumBody, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id").eq("id", album_id).execute().data
    if not album or album[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "No tenés permiso para editar este album.")
    r = db.table("albums").update({"title": body.title.strip(), "description": body.description, "is_private": body.is_private, "updated_at": datetime.now(timezone.utc).isoformat()}).eq("id", album_id).execute()
    return r.data[0]


@router.delete("/{album_id}")
async def delete_album(album_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id").eq("id", album_id).execute().data
    if not album or album[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "No tenés permiso.")
    db.table("albums").delete().eq("id", album_id).execute()
    return {"deleted": True}


# ── Album photos ──────────────────────────────────────────────────

@router.post("/{album_id}/photos", status_code=201)
async def add_photo(album_id: str, request: Request, file: UploadFile = File(...)):
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id, photos_count").eq("id", album_id).execute().data
    if not album or album[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "No tenés permiso.")
    if album[0]["photos_count"] >= 50:
        raise HTTPException(400, "Máximo 50 fotos por album.")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(413, "Imagen demasiado grande. Máximo 20 MB.")

    result = await storage_service.upload_post_image(image_bytes=data, user_id=payload["sub"], original_name=file.filename or "photo")
    new_count = album[0]["photos_count"] + 1

    photo_r = db.table("album_photos").insert({
        "album_id": album_id,
        "user_id": payload["sub"],
        "photo_url": result["signed_url"],
        "storage_path": result["path"],
        "display_order": new_count,
    }).execute()

    # Cover blur = primera foto
    update_data = {"photos_count": new_count, "updated_at": datetime.now(timezone.utc).isoformat()}
    if new_count == 1:
        update_data["cover_blur_url"] = result["signed_url"]
    db.table("albums").update(update_data).eq("id", album_id).execute()

    return photo_r.data[0]


@router.get("/{album_id}/photos")
async def get_photos(album_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id, is_private").eq("id", album_id).execute().data
    if not album:
        raise HTTPException(404, "Album no encontrado.")
    a = album[0]
    is_owner = a["user_id"] == payload["sub"]

    if a["is_private"] and not is_owner:
        req = db.table("album_access_requests").select("status").eq("album_id", album_id).eq("requester_id", payload["sub"]).execute()
        if not req.data or req.data[0]["status"] != "approved":
            raise HTTPException(403, "Necesitás acceso aprobado para ver este album.")

    photos = db.table("album_photos").select("*").eq("album_id", album_id).order("display_order").execute()
    return photos.data


@router.delete("/{album_id}/photos/{photo_id}")
async def delete_photo(album_id: str, photo_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id, photos_count").eq("id", album_id).execute().data
    if not album or album[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "No tenés permiso.")
    db.table("album_photos").delete().eq("id", photo_id).eq("album_id", album_id).execute()
    new_count = max(0, album[0]["photos_count"] - 1)
    db.table("albums").update({"photos_count": new_count}).eq("id", album_id).execute()
    return {"deleted": True}


# ── Solicitudes de acceso ─────────────────────────────────────────

@router.post("/{album_id}/request", status_code=201)
async def request_access(album_id: str, request: Request):
    """Pedir acceso exclusivo a un album privado."""
    payload = _require_auth(request)
    requester_id = payload["sub"]
    db = get_supabase()

    album = db.table("albums").select("user_id, is_private, title").eq("id", album_id).execute().data
    if not album:
        raise HTTPException(404, "Album no encontrado.")
    a = album[0]
    if not a["is_private"]:
        raise HTTPException(400, "Este album es público.")
    if a["user_id"] == requester_id:
        raise HTTPException(400, "No podés solicitar acceso a tu propio album.")

    try:
        r = db.table("album_access_requests").insert({
            "album_id": album_id,
            "requester_id": requester_id,
        }).execute()
    except Exception:
        raise HTTPException(409, "Ya enviaste una solicitud para este album.")

    # Notificar al dueño
    db.table("albums").update({
        "access_requests_count": db.table("album_access_requests").select("id", count="exact").eq("album_id", album_id).eq("status", "pending").execute().count or 1
    }).eq("id", album_id).execute()

    req_user = db.table("users").select("first_name, last_name, username").eq("id", requester_id).execute().data
    name = req_user[0].get("username") or f"{req_user[0]['first_name']}" if req_user else "Alguien"
    try:
        db.table("notifications").insert({
            "user_id": a["user_id"],
            "type": "album_access_request",
            "title": "Solicitud de acceso exclusivo",
            "body": f"{name} quiere ver tu album '{a['title']}'",
            "data": {"album_id": album_id, "requester_id": requester_id},
        }).execute()
    except Exception:
        pass

    return r.data[0]


@router.get("/{album_id}/requests")
async def list_requests(album_id: str, request: Request):
    """Lista solicitudes pendientes (solo el dueño)."""
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id").eq("id", album_id).execute().data
    if not album or album[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "Solo el dueño puede ver las solicitudes.")

    reqs = db.table("album_access_requests").select(
        "id, status, created_at, requester_id, "
        "users!album_access_requests_requester_id_fkey(id,username,first_name,last_name,profile_photo_url)"
    ).eq("album_id", album_id).eq("status", "pending").order("created_at").execute()

    result = []
    for r in reqs.data:
        u = r.pop("users", {}) or {}
        result.append({
            **r,
            "requester": {
                "id":       u.get("id"),
                "username": u.get("username") or f"{u.get('first_name','')} {u.get('last_name','')}".strip(),
                "avatar":   u.get("profile_photo_url"),
            }
        })
    return result


@router.post("/{album_id}/requests/{request_id}/approve")
async def approve_request(album_id: str, request_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id, title").eq("id", album_id).execute().data
    if not album or album[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "No tenés permiso.")

    req = db.table("album_access_requests").select("requester_id").eq("id", request_id).execute().data
    if not req:
        raise HTTPException(404, "Solicitud no encontrada.")

    db.table("album_access_requests").update({"status": "approved"}).eq("id", request_id).execute()

    owner = db.table("users").select("username, first_name").eq("id", payload["sub"]).execute().data
    owner_name = owner[0].get("username") or owner[0]["first_name"] if owner else "El usuario"
    try:
        db.table("notifications").insert({
            "user_id": req[0]["requester_id"],
            "type": "album_access_approved",
            "title": "Acceso exclusivo aprobado",
            "body": f"{owner_name} te dio acceso a su album privado.",
            "data": {"album_id": album_id},
        }).execute()
    except Exception:
        pass

    return {"approved": True}


@router.post("/{album_id}/requests/{request_id}/reject")
async def reject_request(album_id: str, request_id: str, request: Request):
    payload = _require_auth(request)
    db = get_supabase()
    album = db.table("albums").select("user_id").eq("id", album_id).execute().data
    if not album or album[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "No tenés permiso.")
    db.table("album_access_requests").update({"status": "rejected"}).eq("id", request_id).execute()
    return {"rejected": True}


# ── Profile views stats ───────────────────────────────────────────

@router.post("/profile/{user_id}/view")
async def record_view(user_id: str, request: Request):
    """Registrar visita al perfil."""
    payload = _require_auth(request)
    viewer_id = payload["sub"]
    if viewer_id == user_id:
        return {"recorded": False}
    db = get_supabase()
    db.table("profile_views").insert({"profile_user_id": user_id, "viewer_user_id": viewer_id}).execute()
    db.rpc("increment_profile_views", {"p_user_id": user_id}).execute()
    return {"recorded": True}


@router.get("/profile/my-stats")
async def my_stats(request: Request):
    """Stats privados del usuario: visitas, solicitudes, likes recibidos."""
    payload = _require_auth(request)
    user_id = payload["sub"]
    db = get_supabase()

    from datetime import timedelta
    seven_days_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

    views_7d = db.table("profile_views").select("id", count="exact").eq("profile_user_id", user_id).gte("viewed_at", seven_days_ago).execute()
    pending_album_reqs = db.table("album_access_requests").select("id", count="exact").eq("status", "pending").in_("album_id", [
        a["id"] for a in db.table("albums").select("id").eq("user_id", user_id).execute().data
    ] or ["none"]).execute()
    likes_7d = db.table("profile_likes").select("id", count="exact").eq("liked_user_id", user_id).gte("created_at", seven_days_ago).execute() if False else None

    user = db.table("users").select("current_streak, profile_views_count").eq("id", user_id).execute().data
    u = user[0] if user else {}

    return {
        "profile_views_7d":       views_7d.count or 0,
        "profile_views_total":    u.get("profile_views_count", 0),
        "pending_album_requests": pending_album_reqs.count or 0,
        "current_streak":         u.get("current_streak", 0),
    }
