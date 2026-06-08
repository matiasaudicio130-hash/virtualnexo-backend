"""
Router de multimedia.
Endpoints de upload (avatar, post), signed URLs y verificación de filtraciones.
Max upload: 5MB avatars / 20MB media.
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Query

from app.core.security import decode_access_token
from app.services.storage_service import storage_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/media", tags=["media"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024   # 5 MB
MAX_MEDIA_BYTES  = 20 * 1024 * 1024  # 20 MB
ALLOWED_MIME     = {"image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"}


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


def _require_admin(request: Request) -> dict:
    payload = _require_auth(request)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return payload


@router.post("/avatar")
async def upload_avatar(request: Request, file: UploadFile = File(...)):
    """
    Sube/actualiza el avatar del usuario autenticado.
    Aplica marca de agua visible + invisible automáticamente.
    """
    payload = _require_auth(request)

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Formato no permitido. Usar: {', '.join(ALLOWED_MIME)}")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_AVATAR_BYTES:
        raise HTTPException(413, "Imagen demasiado grande. Máximo 5 MB.")
    if len(image_bytes) < 1000:
        raise HTTPException(400, "Archivo inválido o demasiado pequeño.")

    result = await storage_service.upload_avatar(
        image_bytes=image_bytes,
        user_id=payload["sub"],
        original_name=file.filename or "avatar",
    )

    audit_service.log(
        action="media.avatar_upload",
        actor_id=payload["sub"],
        resource_type="media_upload",
        metadata={"size_bytes": result["size_bytes"], "dimensions": f"{result['width']}x{result['height']}"},
        request=request,
    )
    return result


@router.post("/post")
async def upload_post_image(request: Request, file: UploadFile = File(...)):
    """Sube una imagen para una publicación. Devuelve signed URL (1h)."""
    payload = _require_auth(request)

    if file.content_type not in ALLOWED_MIME:
        raise HTTPException(400, f"Formato no permitido. Usar: {', '.join(ALLOWED_MIME)}")

    image_bytes = await file.read()
    if len(image_bytes) > MAX_MEDIA_BYTES:
        raise HTTPException(413, "Imagen demasiado grande. Máximo 20 MB.")

    result = await storage_service.upload_post_image(
        image_bytes=image_bytes,
        user_id=payload["sub"],
        original_name=file.filename or "post",
    )

    audit_service.log(
        action="media.post_upload",
        actor_id=payload["sub"],
        resource_type="media_upload",
        metadata={"size_bytes": result["size_bytes"]},
        request=request,
    )
    return result


@router.get("/signed-url")
async def get_signed_url(
    request: Request,
    path: str = Query(..., description="storage_path de la imagen"),
    bucket: str = Query("media"),
    expires: int = Query(3600, le=86400),
):
    """Genera una nueva signed URL para acceder a una imagen privada."""
    payload = _require_auth(request)
    if bucket not in ("avatars", "media"):
        raise HTTPException(400, "Bucket inválido")
    # Verificar que el path pertenece al usuario autenticado (previene path traversal)
    user_id = payload["sub"]
    if not path.startswith(f"{user_id}/"):
        raise HTTPException(403, "Acceso denegado a este archivo")
    url = storage_service.get_signed_url(path, bucket=bucket, expires=expires)
    return {"signed_url": url, "expires_in": expires}


@router.post("/verify-leak")
async def verify_leak(request: Request, file: UploadFile = File(...)):
    """
    ADMIN: Analiza una imagen filtrada para identificar al usuario que la filtró.
    Extrae el watermark invisible (LSB) y devuelve user_id + timestamp.
    """
    admin_payload = _require_admin(request)
    image_bytes = await file.read()
    result = await storage_service.verify_leak(image_bytes)

    if result.get("found") and result.get("user_id"):
        from app.db.supabase import get_supabase
        db = get_supabase()
        user_r = db.table("users").select("email,first_name,last_name").eq(
            "id", result["user_id"]
        ).execute()
        if user_r.data:
            u = user_r.data[0]
            result["user_info"] = {
                "email": u["email"],
                "name": f"{u['first_name']} {u['last_name']}",
            }

    audit_service.log(
        action="media.verify_leak",
        actor_id=admin_payload["sub"],
        metadata={"result": result.get("found"), "user_id": result.get("user_id")},
        request=request,
    )
    return result


@router.get("/my-uploads")
async def my_uploads(request: Request):
    """Lista los uploads del usuario autenticado."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    result = db.table("media_uploads").select(
        "id,bucket,storage_path,original_name,width,height,size_bytes,created_at"
    ).eq("user_id", payload["sub"]).order("created_at", desc=True).limit(50).execute()
    return result.data
