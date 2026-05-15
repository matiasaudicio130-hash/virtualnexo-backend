from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File
from typing import Optional
from pydantic import BaseModel

from app.core.security import decode_access_token
from app.services.feed_service import feed_service
from app.services.storage_service import storage_service

router = APIRouter(prefix="/feed", tags=["feed"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


class CreatePostBody(BaseModel):
    type: str = "photo"           # photo | text | story
    caption: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    province: Optional[str] = None
    is_story: bool = False


@router.get("/")
async def get_feed(
    request: Request,
    lat: Optional[float]   = Query(None),
    lng: Optional[float]   = Query(None),
    radius_km: int         = Query(100, ge=10, le=500),
    province: Optional[str]= Query(None),
    type: Optional[str]    = Query(None),
    limit: int             = Query(30, le=50),
    offset: int            = Query(0, ge=0),
):
    payload = _require_auth(request)
    return feed_service.get_feed(
        viewer_id=payload["sub"],
        viewer_lat=lat,
        viewer_lng=lng,
        radius_km=radius_km,
        province=province,
        post_type=type,
        limit=limit,
        offset=offset,
    )


@router.get("/stories")
async def get_stories(
    request: Request,
    province: Optional[str] = Query(None),
):
    payload = _require_auth(request)
    return feed_service.get_stories(viewer_id=payload["sub"], province=province)


@router.post("/posts", status_code=201)
async def create_text_post(body: CreatePostBody, request: Request):
    """Crea un post de texto (sin imagen)."""
    payload = _require_auth(request)
    if body.type == "photo" and not body.caption:
        raise HTTPException(400, "Los posts de foto deben subirse con /feed/posts/upload")
    post = feed_service.create_post(
        user_id=payload["sub"],
        post_type=body.type,
        caption=body.caption,
        lat=body.lat,
        lng=body.lng,
        city=body.city,
        province=body.province,
        is_story=body.is_story,
    )
    return post


@router.post("/posts/upload", status_code=201)
async def create_photo_post(
    request: Request,
    caption: str = "",
    province: str = "",
    city: str = "",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    is_story: bool = False,
    file: UploadFile = File(...),
):
    """Crea un post con imagen. Aplica watermarks antes de subir."""
    payload = _require_auth(request)

    if file.content_type not in {"image/jpeg","image/jpg","image/png","image/webp"}:
        raise HTTPException(400, "Solo JPEG/PNG/WebP")

    image_bytes = await file.read()
    if len(image_bytes) > 20 * 1024 * 1024:
        raise HTTPException(413, "Máximo 20 MB")

    # Upload a Supabase Storage con watermarks
    upload_result = await storage_service.upload_post_image(
        image_bytes=image_bytes,
        user_id=payload["sub"],
        original_name=file.filename or "post",
    )

    post = feed_service.create_post(
        user_id=payload["sub"],
        post_type="story" if is_story else "photo",
        caption=caption or None,
        media_url=upload_result["signed_url"],
        storage_path=upload_result["path"],
        lat=lat,
        lng=lng,
        city=city or None,
        province=province or None,
        is_story=is_story,
    )
    return {**post, "upload": upload_result}


@router.post("/posts/{post_id}/react")
async def react_to_post(post_id: str, body: dict, request: Request):
    """Toggle reacción (fire|heart|star). Si ya existe, la quita."""
    payload = _require_auth(request)
    reaction_type = body.get("type", "fire")
    if reaction_type not in {"fire", "heart", "star"}:
        raise HTTPException(400, "Tipo debe ser fire, heart o star")
    return feed_service.toggle_reaction(post_id, payload["sub"], reaction_type)


@router.post("/posts/{post_id}/view")
async def view_story(post_id: str, request: Request):
    """Registra que el usuario autenticado vio esta story."""
    payload = _require_auth(request)
    feed_service.record_story_view(post_id, payload["sub"])
    return {"recorded": True}


@router.delete("/posts/{post_id}")
async def delete_post(post_id: str, request: Request):
    payload = _require_auth(request)
    feed_service.delete_post(post_id, payload["sub"])
    return {"deleted": True}
