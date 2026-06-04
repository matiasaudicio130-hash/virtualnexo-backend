from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File
from typing import Optional, Literal, List
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


class ReactionBody(BaseModel):
    type: Literal["fire", "heart", "star"]



class CreatePostBody(BaseModel):
    type: str = "photo"           # photo | text | story | poll
    caption: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    city: Optional[str] = None
    province: Optional[str] = None
    is_story: bool = False
    story_audience: str = "all"  # all | followers | partner
    # Poll fields (solo cuando type="poll")
    poll_question: Optional[str] = None
    poll_options: Optional[List[str]] = None   # 2-10 opciones
    poll_duration_hours: int = 24              # 1-168 horas
    media_urls: Optional[List[str]] = None     # fotos pre-subidas para polls


class PollVoteBody(BaseModel):
    option_index: int   # 0-3


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


@router.get("/user/{author_id}")
async def get_user_posts(
    request: Request,
    author_id: str,
    limit: int  = Query(18, le=50),
    offset: int = Query(0, ge=0),
):
    """Posts públicos de un usuario específico (para su perfil)."""
    payload = _require_auth(request)
    viewer_id = payload["sub"]
    from app.db.supabase import get_supabase
    db = get_supabase()
    SELECT = (
        "id,user_id,caption,media_url,media_urls,storage_path,type,created_at,city,province,"
        "expires_at,extra_data,allow_share,"
        "users!posts_user_id_fkey(id,first_name,last_name,profile_photo_url,profile_type,username)"
    )
    rows = (
        db.table("posts")
        .select(SELECT)
        .eq("user_id", author_id)
        .eq("status", "active")
        .in_("type", ["photo", "video", "text", "poll"])
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
        .data
    )

    posts = []
    for r in rows:
        author_raw = r.pop("users!posts_user_id_fkey", None) or {}
        # Normalizar author al shape que espera PostCard
        author = {
            "id":           author_raw.get("id"),
            "name":         f"{author_raw.get('first_name','')} {author_raw.get('last_name','')}".strip(),
            "username":     author_raw.get("username"),
            "avatar":       author_raw.get("profile_photo_url"),
            "profile_type": author_raw.get("profile_type"),
        }
        posts.append({**r, "author": author, "viewer_reaction": None, "reactions": {}})

    post_ids = [p["id"] for p in posts]

    # Reacciones del viewer
    if post_ids:
        try:
            rxn_r = db.table("post_reactions").select("post_id,type").eq("user_id", viewer_id).in_("post_id", post_ids).execute()
            viewer_reactions = {r["post_id"]: r["type"] for r in rxn_r.data}
            for p in posts:
                p["viewer_reaction"] = viewer_reactions.get(p["id"])
        except Exception:
            pass

    # Conteo de reacciones por post
    if post_ids:
        try:
            from collections import Counter
            for pid in post_ids:
                rc = db.table("post_reactions").select("type").eq("post_id", pid).execute()
                cnt = Counter(r["type"] for r in rc.data)
                for p in posts:
                    if p["id"] == pid:
                        p["reactions"] = dict(cnt)
                        break
        except Exception:
            pass

    feed_service._refresh_signed_urls(posts, db)
    return {"posts": posts}


@router.get("/stories")
async def get_stories(
    request: Request,
    province: Optional[str] = Query(None),
):
    payload = _require_auth(request)
    return feed_service.get_stories(viewer_id=payload["sub"], province=province)


@router.post("/posts", status_code=201)
async def create_text_post(body: CreatePostBody, request: Request):
    """Crea un post de texto o poll (sin imagen)."""
    payload = _require_auth(request)
    if body.type == "photo" and not body.caption:
        raise HTTPException(400, "Los posts de foto deben subirse con /feed/posts/upload")

    extra_data = None
    if body.type == "poll":
        if not body.poll_question or not body.poll_question.strip():
            raise HTTPException(400, "poll_question es requerido")
        opts = body.poll_options or []
        if len(opts) < 2 or len(opts) > 10:
            raise HTTPException(400, "Un poll necesita entre 2 y 10 opciones")
        if not all(o.strip() for o in opts):
            raise HTTPException(400, "Todas las opciones deben tener texto")
        dur = max(1, min(168, body.poll_duration_hours))
        extra_data = {
            "poll": {
                "question": body.poll_question.strip(),
                "options": [o.strip() for o in opts],
                "duration_hours": dur,
                "total_votes": 0,
                "votes": [0] * len(opts),
            }
        }

    post = feed_service.create_post(
        user_id=payload["sub"],
        post_type=body.type,
        caption=body.poll_question if body.type == "poll" else body.caption,
        lat=body.lat,
        lng=body.lng,
        city=body.city,
        province=body.province,
        is_story=body.is_story,
        story_audience=body.story_audience,
    )

    if extra_data:
        from app.db.supabase import get_supabase
        update_payload: dict = {"extra_data": extra_data}
        if body.media_urls:
            update_payload["media_url"] = body.media_urls[0]
            if len(body.media_urls) > 1:
                update_payload["media_urls"] = [{"url": u, "type": "image"} for u in body.media_urls]
        get_supabase().table("posts").update(update_payload).eq("id", post["id"]).execute()
        post["extra_data"] = extra_data
        if body.media_urls:
            post["media_url"] = body.media_urls[0]

    return post


ALLOWED_IMAGE_MIMES = {"image/jpeg","image/jpg","image/png","image/webp","image/gif","image/heic","image/heif"}
ALLOWED_VIDEO_MIMES = {"video/mp4","video/quicktime","video/webm","video/x-matroska","video/mpeg","video/x-m4v","video/x-msvideo"}
MAX_IMAGE_BYTES = 20 * 1024 * 1024     # 20 MB
MAX_VIDEO_BYTES = 200 * 1024 * 1024    # 200 MB


# ── Upload directo a Supabase (bypass Railway para archivos grandes) ──
class SignedUploadBody(BaseModel):
    kind:     Literal["image","video"] = "image"
    filename: Optional[str] = None


@router.post("/posts/signed-upload")
async def get_signed_upload(body: SignedUploadBody, request: Request):
    """
    Devuelve una signed upload URL para subir DIRECTAMENTE a Supabase Storage.
    El frontend usa esta URL via PUT, evitando el límite de body de Railway.
    Después se llama /posts/from-storage para crear el post.
    """
    import uuid as _uuid
    from datetime import datetime as _dt, timezone as _tz
    from app.db.supabase import get_supabase

    payload = _require_auth(request)
    user_id = payload["sub"]

    ext = "mp4" if body.kind == "video" else "png"
    if body.filename and "." in body.filename:
        ext = body.filename.rsplit(".", 1)[-1].lower()[:5]
    ts  = _dt.now(_tz.utc).strftime("%Y%m%d_%H%M%S")
    uid = _uuid.uuid4().hex[:8]
    path = f"{user_id}/{ts}_{uid}.{ext}"

    db = get_supabase()
    signed = db.storage.from_("media").create_signed_upload_url(path)
    raw_url = signed.get("signed_url") if isinstance(signed, dict) else getattr(signed, "signed_url", None)
    # Normalizar doble // que genera storage3 en algunos setups
    if raw_url:
        raw_url = raw_url.replace("/v1//", "/v1/")
    return {
        "upload_url": raw_url,
        "token":      signed.get("token") if isinstance(signed, dict) else getattr(signed, "token", None),
        "path":       path,
    }


class FromStorageBody(BaseModel):
    path:       str                       # Path del archivo subido a Supabase
    kind:       Literal["image","video"] = "image"
    caption:    str = ""
    province:   str = ""
    city:       str = ""
    lat:        Optional[float] = None
    lng:        Optional[float] = None
    is_story:   bool = False
    story_audience: str = "all"


@router.post("/posts/from-storage", status_code=201)
async def create_post_from_storage(body: FromStorageBody, request: Request):
    """Crea el post después de que el frontend ya subió el archivo a Supabase."""
    from app.db.supabase import get_supabase
    payload = _require_auth(request)
    user_id = payload["sub"]

    # Verificar que el path empieza con el user_id (seguridad)
    if not body.path.startswith(f"{user_id}/"):
        raise HTTPException(403, "Path inválido")

    db = get_supabase()
    public_url = db.storage.from_("media").get_public_url(body.path)

    post = feed_service.create_post(
        user_id=user_id,
        post_type="story" if body.is_story else "photo",
        caption=body.caption or None,
        media_url=public_url,
        storage_path=body.path,
        lat=body.lat,
        lng=body.lng,
        city=body.city or None,
        province=body.province or None,
        is_story=body.is_story,
        story_audience=body.story_audience,
    )

    # Si es video, marcar el tipo en media_urls
    if body.kind == "video":
        media_list = [{"url": public_url, "path": body.path, "type": "video"}]
        db.table("posts").update({"media_urls": media_list}).eq("id", post["id"]).execute()
        post["media_urls"] = media_list

    # Notificar menciones en la caption
    if body.caption:
        try:
            from app.utils.mentions import notify_mentions
            user_r = db.table("users").select("first_name,last_name").eq("id", user_id).maybe_single().execute()
            name = ""
            if user_r.data:
                name = f"{user_r.data.get('first_name','')} {user_r.data.get('last_name','')}".strip()
            notify_mentions(body.caption, user_id, name or "Alguien", url="/feed")
        except Exception:
            pass

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
    story_audience: str = "all",
    file: UploadFile = File(...),
):
    """Crea un post con foto o video. Aplica watermarks a fotos."""
    payload = _require_auth(request)
    ctype = (file.content_type or "").lower()
    is_video = ctype.startswith("video/")

    if is_video:
        if ctype not in ALLOWED_VIDEO_MIMES:
            raise HTTPException(400, f"Formato de video no soportado: {ctype}")
        data = await file.read()
        if len(data) > MAX_VIDEO_BYTES:
            raise HTTPException(413, "Video demasiado grande. Máximo 200 MB.")
        upload_result = await storage_service.upload_post_video(
            video_bytes=data, user_id=payload["sub"], content_type=ctype, original_name=file.filename or "video",
        )
    else:
        if ctype not in ALLOWED_IMAGE_MIMES:
            raise HTTPException(400, f"Formato no soportado: {ctype}")
        data = await file.read()
        if len(data) > MAX_IMAGE_BYTES:
            raise HTTPException(413, "Imagen demasiado grande. Máximo 20 MB.")
        upload_result = await storage_service.upload_post_image(
            image_bytes=data, user_id=payload["sub"], original_name=file.filename or "post",
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
        story_audience=story_audience,
    )

    # Guardamos también el tipo per-item en media_urls para que el frontend lo
    # renderice como video (sin esto rompería el constraint de posts.type)
    if is_video:
        from app.db.supabase import get_supabase
        media_list = [{"url": upload_result["url"], "path": upload_result["path"], "type": "video"}]
        get_supabase().table("posts").update({"media_urls": media_list}).eq("id", post["id"]).execute()
        post["media_urls"] = media_list

    return {**post, "upload": upload_result}


@router.post("/posts/{post_id}/react")
async def react_to_post(post_id: str, body: ReactionBody, request: Request):
    """Toggle reacción (fire|heart|star). Si ya existe, la quita."""
    payload = _require_auth(request)
    actor_id = payload["sub"]
    result   = feed_service.toggle_reaction(post_id, actor_id, body.type)

    # Push al dueño del post sólo al AGREGAR (no al quitar)
    if result.get("action") == "added":
        try:
            from app.db.supabase import get_supabase
            from app.services.push_service import send_push
            db = get_supabase()

            post_r = db.table("posts").select("user_id").eq("id", post_id).maybe_single().execute()
            post_author = post_r.data["user_id"] if post_r.data else None

            if post_author and post_author != actor_id:
                emoji = {"heart": "❤️", "fire": "🔥", "star": "⭐"}.get(body.type, "👍")
                user_r = db.table("users").select("first_name").eq("id", actor_id).maybe_single().execute()
                name = user_r.data.get("first_name", "Alguien") if user_r.data else "Alguien"
                send_push(
                    post_author,
                    f"{emoji} Nueva reacción",
                    f"{name} reaccionó a tu publicación.",
                    url="/feed",
                )
        except Exception:
            pass  # Push nunca bloquea la respuesta

    return result


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


# ── Sprint 2: saves, share, carousel ──────────────────────────

@router.post("/posts/{post_id}/save")
async def toggle_save(post_id: str, request: Request):
    """Guarda o quita un post de los guardados."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    result = db.rpc("toggle_post_save", {
        "p_user_id": payload["sub"],
        "p_post_id": post_id,
    }).execute()
    return {"saved": result.data}


@router.get("/posts/saved")
async def get_saved_posts(
    request: Request,
    limit: int = Query(30, le=50),
    offset: int = Query(0, ge=0),
):
    """Posts guardados por el usuario."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    saves = db.table("post_saves").select(
        "post_id, posts!post_saves_post_id_fkey("
        "id,type,caption,media_url,media_urls,storage_path,city,province,"
        "created_at,views_count,save_count,"
        "users!posts_user_id_fkey(id,first_name,last_name,profile_photo_url)"
        ")"
    ).eq("user_id", payload["sub"]).order("created_at", desc=True).range(
        offset, offset + limit - 1
    ).execute()
    posts = [s["posts"] for s in saves.data if s.get("posts")]
    return {"posts": posts, "total": len(posts)}


class RepostBody(BaseModel):
    comment: str = ""   # comentario opcional al repostear


@router.post("/posts/{post_id}/repost", status_code=201)
async def repost_post(post_id: str, body: RepostBody, request: Request):
    """Crea un repost del post en el feed del usuario actual."""
    from app.db.supabase import get_supabase
    payload  = _require_auth(request)
    actor_id = payload["sub"]
    db       = get_supabase()

    # Obtener post original con datos del autor
    orig_r = db.table("posts").select(
        "id, user_id, type, caption, media_url, media_urls, allow_share, status, "
        "users!posts_user_id_fkey(id, first_name, last_name, profile_photo_url)"
    ).eq("id", post_id).maybe_single().execute()

    if not orig_r.data or orig_r.data.get("status") != "active":
        raise HTTPException(404, "Post no encontrado")

    orig = orig_r.data
    if not orig.get("allow_share", True):
        raise HTTPException(403, "Este post no permite compartir")
    if orig["user_id"] == actor_id:
        raise HTTPException(400, "No podés repostear tus propios posts")

    # Verificar que no lo haya reposteado ya
    existing_r = db.table("posts").select("id, extra_data").eq("user_id", actor_id).eq("status", "active").eq("type", "text").execute()
    for p in existing_r.data or []:
        ed = p.get("extra_data") or {}
        if ed.get("repost") is True and ed.get("repost_of_id") == post_id:
            raise HTTPException(409, "Ya reposteaste esta publicación")

    orig_author = orig.get("users") or {}
    author_name = f"{orig_author.get('first_name','')} {orig_author.get('last_name','')}".strip()

    result = db.table("posts").insert({
        "user_id": actor_id,
        "type":    "text",
        "caption": body.comment.strip() or "",
        "status":  "active",
        "extra_data": {
            "repost":               True,
            "repost_of_id":         post_id,
            "repost_author_id":     orig["user_id"],
            "repost_author_name":   author_name,
            "repost_author_avatar": orig_author.get("profile_photo_url"),
            "repost_caption":       orig.get("caption") or "",
            "repost_media_url":     orig.get("media_url"),
            "repost_media_urls":    orig.get("media_urls") or [],
            "repost_type":          orig["type"],
        },
    }).execute()

    # Incrementar share_count en el original
    try:
        db.rpc("increment_share_count", {"p_post_id": post_id}).execute()
    except Exception:
        pass

    # Push al autor original
    try:
        from app.services.push_service import send_push
        user_r = db.table("users").select("first_name").eq("id", actor_id).maybe_single().execute()
        name   = user_r.data.get("first_name", "Alguien") if user_r.data else "Alguien"
        send_push(orig["user_id"], "🔁 Repost", f"{name} reposteó tu publicación.", url="/feed")
    except Exception:
        pass

    return result.data[0] if result.data else {}


@router.delete("/posts/{post_id}/repost")
async def unrepost_post(post_id: str, request: Request):
    """Elimina el repost del usuario actual de este post."""
    from app.db.supabase import get_supabase
    payload  = _require_auth(request)
    actor_id = payload["sub"]
    db       = get_supabase()

    posts_r = db.table("posts").select("id, extra_data").eq("user_id", actor_id).eq("status", "active").eq("type", "text").execute()
    repost_id = None
    for p in posts_r.data or []:
        ed = p.get("extra_data") or {}
        if ed.get("repost") is True and ed.get("repost_of_id") == post_id:
            repost_id = p["id"]
            break

    if not repost_id:
        raise HTTPException(404, "No reposteaste esta publicación")

    db.table("posts").update({"status": "deleted"}).eq("id", repost_id).execute()
    return {"unreposted": True, "post_id": repost_id}


@router.post("/posts/{post_id}/share")
async def share_post(post_id: str, request: Request):
    """Devuelve los datos del post para compartir por DM."""
    _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    r = db.table("posts").select(
        "id,caption,media_url,allow_share,"
        "users!posts_user_id_fkey(first_name,last_name)"
    ).eq("id", post_id).eq("status", "active").execute()
    if not r.data:
        raise HTTPException(404, "Post no encontrado")
    post = r.data[0]
    if not post.get("allow_share", True):
        raise HTTPException(403, "El autor desactivó el compartir en este post")
    db.rpc("increment_share_count", {"p_post_id": post_id}).execute()
    return {"post_id": post_id, "shareable": True, "preview": post}


@router.post("/posts/upload-carousel", status_code=201)
async def upload_carousel(
    request: Request,
    caption: str = "",
    province: str = "",
    city: str = "",
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    is_story: bool = False,
    allow_share: bool = True,
    files: List[UploadFile] = File(...),
):
    """Crea un post con múltiples imágenes (carrusel, hasta 10)."""
    payload = _require_auth(request)
    if len(files) > 10:
        raise HTTPException(400, "Máximo 10 imágenes por carrusel")
    if len(files) == 0:
        raise HTTPException(400, "Mínimo 1 imagen")

    from app.db.supabase import get_supabase
    from app.services.storage_service import storage_service
    db = get_supabase()

    media_list = []
    for f in files:
        ctype = (f.content_type or "").lower()
        is_video_item = ctype.startswith("video/")
        if is_video_item:
            if ctype not in ALLOWED_VIDEO_MIMES:
                raise HTTPException(400, f"Archivo {f.filename}: formato de video no soportado")
            data = await f.read()
            if len(data) > MAX_VIDEO_BYTES:
                raise HTTPException(413, "Máximo 200 MB por video")
            result = await storage_service.upload_post_video(
                video_bytes=data, user_id=payload["sub"], content_type=ctype, original_name=f.filename or "video",
            )
            item_type = "video"
        else:
            if ctype not in ALLOWED_IMAGE_MIMES:
                raise HTTPException(400, f"Archivo {f.filename}: formato no soportado")
            data = await f.read()
            if len(data) > MAX_IMAGE_BYTES:
                raise HTTPException(413, "Máximo 20 MB por imagen")
            result = await storage_service.upload_post_image(
                image_bytes=data, user_id=payload["sub"], original_name=f.filename or "img",
            )
            item_type = "image"
        media_list.append({
            "url":  result["signed_url"],
            "path": result["path"],
            "type": item_type,
        })

    # Primera imagen como media_url principal (compatibilidad)
    main = media_list[0]
    from app.services.feed_service import feed_service
    post = feed_service.create_post(
        user_id=payload["sub"],
        post_type="story" if is_story else "photo",
        caption=caption or None,
        media_url=main["url"],
        storage_path=main["path"],
        lat=lat, lng=lng,
        city=city or None,
        province=province or None,
        is_story=is_story,
    )
    # Guardar el array completo si hay más de 1, o si hay un video (para preservar el tipo per-item)
    has_video = any(m.get("type") == "video" for m in media_list)
    if len(media_list) > 1 or has_video:
        db.table("posts").update({
            "media_urls": media_list,
            "allow_share": allow_share,
        }).eq("id", post["id"]).execute()
        post["media_urls"] = media_list
    else:
        db.table("posts").update({"allow_share": allow_share}).eq("id", post["id"]).execute()

    return post


# ── POLLS ────────────────────────────────────────────────────

@router.post("/posts/{post_id}/poll-vote", status_code=201)
async def vote_poll(post_id: str, body: PollVoteBody, request: Request):
    """Vota en un poll. Un voto por usuario, inmutable."""
    payload = _require_auth(request)
    user_id = payload["sub"]
    from app.db.supabase import get_supabase
    db = get_supabase()

    # Verificar que el post es un poll activo
    post_r = db.table("posts").select("id,extra_data,expires_at,status").eq("id", post_id).execute()
    if not post_r.data:
        raise HTTPException(404, "Post no encontrado")
    post = post_r.data[0]
    if post.get("status") != "active":
        raise HTTPException(400, "Post inactivo")
    extra = post.get("extra_data") or {}
    poll = extra.get("poll")
    if not poll:
        raise HTTPException(400, "Este post no es un poll")
    if body.option_index < 0 or body.option_index >= len(poll["options"]):
        raise HTTPException(400, "Índice de opción inválido")

    # Verificar que no expiró
    if post.get("expires_at"):
        from datetime import datetime, timezone
        if datetime.now(timezone.utc) > datetime.fromisoformat(post["expires_at"].replace("Z", "+00:00")):
            raise HTTPException(400, "Este poll ya cerró")

    # Insertar voto (unique constraint previene duplicados)
    try:
        db.table("post_poll_votes").insert({
            "post_id": post_id,
            "user_id": user_id,
            "option_index": body.option_index,
        }).execute()
    except Exception:
        raise HTTPException(409, "Ya votaste en este poll")

    # Recalcular conteos
    votes_r = db.table("post_poll_votes").select("option_index").eq("post_id", post_id).execute()
    counts = [0] * len(poll["options"])
    for v in votes_r.data:
        idx = v["option_index"]
        if 0 <= idx < len(counts):
            counts[idx] += 1
    total = sum(counts)

    poll["votes"] = counts
    poll["total_votes"] = total
    extra["poll"] = poll
    db.table("posts").update({"extra_data": extra}).eq("id", post_id).execute()

    return {
        "voted": True,
        "option_index": body.option_index,
        "votes": counts,
        "total_votes": total,
        "user_vote": body.option_index,
    }


@router.get("/posts/{post_id}/poll-results")
async def get_poll_results(post_id: str, request: Request):
    """Resultados actuales del poll + voto del usuario autenticado."""
    payload = _require_auth(request)
    user_id = payload["sub"]
    from app.db.supabase import get_supabase
    db = get_supabase()

    post_r = db.table("posts").select("id,extra_data,expires_at").eq("id", post_id).execute()
    if not post_r.data:
        raise HTTPException(404, "Post no encontrado")
    extra = post_r.data[0].get("extra_data") or {}
    poll = extra.get("poll")
    if not poll:
        raise HTTPException(400, "No es un poll")

    # Voto del usuario
    vote_r = db.table("post_poll_votes").select("option_index").eq("post_id", post_id).eq("user_id", user_id).execute()
    user_vote = vote_r.data[0]["option_index"] if vote_r.data else None

    return {
        "question": poll["question"],
        "options":  poll["options"],
        "votes":    poll.get("votes", [0] * len(poll["options"])),
        "total_votes": poll.get("total_votes", 0),
        "user_vote": user_vote,
    }
