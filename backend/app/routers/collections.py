"""
Colecciones de guardados.
Las colecciones se almacenan en profile_extended.save_collections (JSONB).
No requiere tabla nueva.

Estructura: save_collections = [
  { "id": uuid, "name": str, "post_ids": [str, ...], "created_at": iso }
]
"""
import uuid as _uuid
from fastapi import APIRouter, HTTPException, Request, Path
from pydantic import BaseModel, Field

from app.core.security import decode_access_token
from app.db.supabase import get_supabase

router = APIRouter(prefix="/collections", tags=["collections"])

MAX_COLLECTIONS  = 30
MAX_POSTS_PER    = 500


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


def _get_ext(user_id: str, db) -> dict:
    r = db.table("users").select("profile_extended").eq("id", user_id).maybe_single().execute()
    return (r.data.get("profile_extended") or {}) if r.data else {}


def _save_ext(user_id: str, ext: dict, db) -> None:
    db.table("users").update({"profile_extended": ext}).eq("id", user_id).execute()


# ── List ─────────────────────────────────────────────────────────────────────
@router.get("/")
async def list_collections(request: Request):
    payload = _require_auth(request)
    db  = get_supabase()
    ext = _get_ext(payload["sub"], db)
    return ext.get("save_collections") or []


# ── Create ───────────────────────────────────────────────────────────────────
class CreateBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)


@router.post("/", status_code=201)
async def create_collection(body: CreateBody, request: Request):
    payload  = _require_auth(request)
    user_id  = payload["sub"]
    db       = get_supabase()
    ext      = _get_ext(user_id, db)
    cols     = ext.get("save_collections") or []

    if len(cols) >= MAX_COLLECTIONS:
        raise HTTPException(400, f"Máximo {MAX_COLLECTIONS} colecciones")

    new_col = {
        "id":         str(_uuid.uuid4()),
        "name":       body.name.strip(),
        "post_ids":   [],
        "created_at": __import__("datetime").datetime.utcnow().isoformat(),
    }
    cols.append(new_col)
    ext["save_collections"] = cols
    _save_ext(user_id, ext, db)
    return new_col


# ── Rename ───────────────────────────────────────────────────────────────────
class RenameBody(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)


@router.patch("/{col_id}")
async def rename_collection(col_id: str, body: RenameBody, request: Request):
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()
    ext     = _get_ext(user_id, db)
    cols    = ext.get("save_collections") or []

    for c in cols:
        if c["id"] == col_id:
            c["name"] = body.name.strip()
            ext["save_collections"] = cols
            _save_ext(user_id, ext, db)
            return c

    raise HTTPException(404, "Colección no encontrada")


# ── Delete ───────────────────────────────────────────────────────────────────
@router.delete("/{col_id}")
async def delete_collection(col_id: str, request: Request):
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()
    ext     = _get_ext(user_id, db)
    cols    = ext.get("save_collections") or []
    ext["save_collections"] = [c for c in cols if c["id"] != col_id]
    _save_ext(user_id, ext, db)
    return {"deleted": True}


# ── Add post ─────────────────────────────────────────────────────────────────
@router.post("/{col_id}/posts/{post_id}", status_code=201)
async def add_post(col_id: str, post_id: str, request: Request):
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()
    ext     = _get_ext(user_id, db)
    cols    = ext.get("save_collections") or []

    for c in cols:
        if c["id"] == col_id:
            if post_id not in c["post_ids"]:
                if len(c["post_ids"]) >= MAX_POSTS_PER:
                    raise HTTPException(400, "La colección está llena")
                c["post_ids"].insert(0, post_id)
            ext["save_collections"] = cols
            _save_ext(user_id, ext, db)
            return {"added": True, "collection_id": col_id}

    raise HTTPException(404, "Colección no encontrada")


# ── Remove post ───────────────────────────────────────────────────────────────
@router.delete("/{col_id}/posts/{post_id}")
async def remove_post(col_id: str, post_id: str, request: Request):
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()
    ext     = _get_ext(user_id, db)
    cols    = ext.get("save_collections") or []

    for c in cols:
        if c["id"] == col_id:
            c["post_ids"] = [p for p in c["post_ids"] if p != post_id]
            ext["save_collections"] = cols
            _save_ext(user_id, ext, db)
            return {"removed": True}

    raise HTTPException(404, "Colección no encontrada")
