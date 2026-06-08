from fastapi import APIRouter, HTTPException, Request, Query, UploadFile, File
from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime, timezone
import uuid

from app.core.security import decode_access_token
from app.services.messaging_service import messaging_service

router = APIRouter(prefix="/messages", tags=["messages"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


class ConversationStartBody(BaseModel):
    recipient_id: str


class SendMessageBody(BaseModel):
    recipient_id: str
    content: str = ""
    type: str = "text"
    media_url: Optional[str] = None
    audio_duration: Optional[int] = None
    reply_to_id: Optional[str] = None
    view_once: bool = False

    def model_post_init(self, __context) -> None:
        if len(self.content) > 2000:
            raise ValueError("El mensaje no puede superar los 2000 caracteres")
        if self.type not in ("text", "image", "video", "audio", "gif", "share"):
            raise ValueError(f"Tipo de mensaje inválido: {self.type}")


class ReactionBody(BaseModel):
    emoji: Literal["❤️", "🔥", "😮", "😂", "👍", "👎"]


class ConvSettingsBody(BaseModel):
    auto_delete_days: Optional[Literal[15, 30, 90]] = None
    screenshot_alert: bool = True


class TypingBody(BaseModel):
    is_typing: bool


@router.get("/conversations")
async def list_conversations(request: Request):
    """Lista todas las conversaciones del usuario con unreads."""
    payload = _require_auth(request)
    return messaging_service.get_conversations(payload["sub"])


class MessageRequestBody(BaseModel):
    first_message: str = ""  # Mensaje que se envía junto con la solicitud


@router.post("/conversations/start")
async def start_conversation(body: ConversationStartBody, request: Request):
    """Obtiene o inicia una conversación con otro usuario."""
    from app.db.supabase import get_supabase
    import uuid as _uuid

    payload   = _require_auth(request)
    user_id   = payload["sub"]
    recipient = body.recipient_id

    if recipient == user_id:
        raise HTTPException(400, "No podés chatear con vos mismo")

    db = get_supabase()

    # ── Verificar configuración de mensajes del destinatario ─────────────────
    try:
        recip_r = db.table("users").select(
            "id,first_name,last_name,profile_photo_url,profile_type,province,profile_extended,status"
        ).eq("id", recipient).maybe_single().execute()
        recip_data = recip_r.data or {}
    except Exception:
        recip_data = {}

    msg_settings = (recip_data.get("profile_extended") or {}).get("message_settings", "everyone")

    if msg_settings == "nobody":
        raise HTTPException(403, "Este usuario no acepta mensajes de nadie")

    if msg_settings == "followers":
        follow_r = db.table("user_follows").select("id").eq("follower_id", user_id).eq("following_id", recipient).maybe_single().execute()
        if not follow_r.data:
            # Crear solicitud de mensaje en lugar de conversación directa
            sender_r = db.table("users").select("first_name,last_name,profile_photo_url").eq("id", user_id).maybe_single().execute()
            sender   = sender_r.data or {}

            req_id   = str(_uuid.uuid4())
            new_req  = {
                "id":            req_id,
                "from_id":       user_id,
                "from_name":     f"{sender.get('first_name','')} {sender.get('last_name','')}".strip(),
                "from_avatar":   sender.get("profile_photo_url"),
                "first_message": (body.first_message if hasattr(body, 'first_message') else "")[:300],
                "created_at":    __import__("datetime").datetime.utcnow().isoformat(),
            }

            # Merge en profile_extended.message_requests
            ext      = recip_data.get("profile_extended") or {}
            requests = [r for r in (ext.get("message_requests") or []) if r.get("from_id") != user_id]
            requests.insert(0, new_req)
            ext["message_requests"] = requests[:50]  # Max 50 solicitudes pendientes
            db.table("users").update({"profile_extended": ext}).eq("id", recipient).execute()

            return {
                "status":  "request_sent",
                "request_id": req_id,
                "message": "Tu solicitud fue enviada. Si el usuario la acepta podrán chatear.",
            }

    # ── Flujo normal ─────────────────────────────────────────────────────────
    try:
        conv  = messaging_service.get_or_create_conversation(user_id, recipient)
        other = recip_data or None
        return {**conv, "other_user": other, "unread_count": 0, "blocked_me": False, "status": "active"}
    except PermissionError as e:
        raise HTTPException(403, str(e))


# ── Solicitudes de mensaje ───────────────────────────────────────────────────
@router.get("/search")
async def search_messages(
    request:  Request,
    q:        str = Query(..., min_length=2, max_length=100),
    limit:    int = Query(default=20, ge=1, le=50),
):
    """Busca mensajes del usuario en todas sus conversaciones."""
    from app.db.supabase import get_supabase
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()

    # Obtener todas las conversaciones del usuario
    convs_r = db.table("conversations").select(
        "id,participant_a,participant_b,"
        "user_a:users!conversations_participant_a_fkey(id,first_name,last_name,profile_photo_url),"
        "user_b:users!conversations_participant_b_fkey(id,first_name,last_name,profile_photo_url)"
    ).or_(f"participant_a.eq.{user_id},participant_b.eq.{user_id}").execute()

    if not convs_r.data:
        return {"results": [], "query": q}

    # Mapeo conv_id → otro usuario
    other_by_conv: dict = {}
    for c in convs_r.data:
        is_a  = c["participant_a"] == user_id
        other = c.get("user_b") if is_a else c.get("user_a")
        other_by_conv[c["id"]] = other

    conv_ids = list(other_by_conv.keys())

    # Buscar en el contenido de mensajes (case-insensitive)
    msgs_r = db.table("messages").select(
        "id,conversation_id,content,created_at,sender_id,type"
    ).in_("conversation_id", conv_ids).ilike(
        "content", f"%{q.strip()}%"
    ).eq("type", "text").order(
        "created_at", desc=True
    ).limit(limit).execute()

    results = []
    for m in msgs_r.data or []:
        other = other_by_conv.get(m["conversation_id"]) or {}
        other_name = f"{other.get('first_name','')} {other.get('last_name','')}".strip()
        results.append({
            "message_id":      m["id"],
            "conversation_id": m["conversation_id"],
            "content":         m["content"],
            "created_at":      m["created_at"],
            "is_mine":         m["sender_id"] == user_id,
            "other_user": {
                "id":     other.get("id"),
                "name":   other_name,
                "avatar": other.get("profile_photo_url"),
            },
        })

    return {"results": results, "query": q}


@router.get("/requests")
async def get_message_requests(request: Request):
    """Lista las solicitudes de mensaje pendientes del usuario."""
    from app.db.supabase import get_supabase
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()

    ext_r = db.table("users").select("profile_extended").eq("id", user_id).maybe_single().execute()
    ext   = (ext_r.data.get("profile_extended") or {}) if ext_r.data else {}
    reqs  = ext.get("message_requests") or []
    return {"requests": reqs, "count": len(reqs)}


@router.post("/requests/{from_id}/accept", status_code=201)
async def accept_message_request(from_id: str, request: Request):
    """Acepta una solicitud: crea la conversación y elimina la solicitud."""
    from app.db.supabase import get_supabase
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()

    ext_r = db.table("users").select("profile_extended").eq("id", user_id).maybe_single().execute()
    ext   = (ext_r.data.get("profile_extended") or {}) if ext_r.data else {}
    reqs  = ext.get("message_requests") or []

    matched = next((r for r in reqs if r.get("from_id") == from_id), None)
    if not matched:
        raise HTTPException(404, "Solicitud no encontrada")

    # Eliminar la solicitud
    ext["message_requests"] = [r for r in reqs if r.get("from_id") != from_id]
    db.table("users").update({"profile_extended": ext}).eq("id", user_id).execute()

    # Crear conversación
    conv = messaging_service.get_or_create_conversation(user_id, from_id)

    # Si había un primer mensaje, enviarlo como mensaje real
    first_msg = (matched.get("first_message") or "").strip()
    if first_msg:
        try:
            messaging_service.send_message(from_id, user_id, first_msg)
        except Exception:
            pass

    return {**conv, "status": "active", "accepted": True}


@router.delete("/requests/{from_id}/reject")
async def reject_message_request(from_id: str, request: Request):
    """Rechaza y elimina una solicitud de mensaje."""
    from app.db.supabase import get_supabase
    payload = _require_auth(request)
    user_id = payload["sub"]
    db      = get_supabase()

    ext_r = db.table("users").select("profile_extended").eq("id", user_id).maybe_single().execute()
    ext   = (ext_r.data.get("profile_extended") or {}) if ext_r.data else {}
    ext["message_requests"] = [r for r in (ext.get("message_requests") or []) if r.get("from_id") != from_id]
    db.table("users").update({"profile_extended": ext}).eq("id", user_id).execute()
    return {"rejected": True}


@router.get("/conversations/{conv_id}/messages")
async def get_messages(
    conv_id: str,
    request: Request,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    payload = _require_auth(request)
    try:
        return messaging_service.get_messages(conv_id, payload["sub"], limit=limit, offset=offset)
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.post("/conversations/{conv_id}/messages", status_code=201)
async def send_message(_conv_id: str, body: SendMessageBody, request: Request):
    payload = _require_auth(request)
    try:
        return messaging_service.send_message(
            sender_id=payload["sub"],
            recipient_id=body.recipient_id,
            content=body.content,
            msg_type=body.type,
            media_url=body.media_url,
            audio_duration=body.audio_duration,
            reply_to_id=body.reply_to_id,
            view_once=body.view_once,
        )
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.post("/conversations/{conv_id}/block")
async def block_in_conversation(conv_id: str, request: Request):
    payload = _require_auth(request)
    try:
        messaging_service.block_user(payload["sub"], conv_id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return {"blocked": True}


@router.get("/unread-count")
async def unread_count(request: Request):
    """Total de mensajes no leídos del usuario."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    convs = db.table("conversations").select("id,participant_a,participant_b").or_(
        f"participant_a.eq.{payload['sub']},participant_b.eq.{payload['sub']}"
    ).execute().data
    conv_ids = [c["id"] for c in convs]
    if not conv_ids:
        return {"count": 0}
    unread = db.table("messages").select("id").in_(
        "conversation_id", conv_ids
    ).neq("sender_id", payload["sub"]).is_("read_at", "null").execute().data
    return {"count": len(unread)}


# ── Nuevos endpoints v2 ───────────────────────────────────────

@router.delete("/messages/{message_id}")
async def delete_message(
    message_id: str,
    request: Request,
    for_all: bool = Query(False),
):
    """Elimina un mensaje. for_all=true borra para ambos lados."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()

    msg = db.table("messages").select("sender_id,conversation_id").eq("id", message_id).execute()
    if not msg.data:
        raise HTTPException(404, "Mensaje no encontrado")
    if msg.data[0]["sender_id"] != payload["sub"]:
        raise HTTPException(403, "Solo podés eliminar tus propios mensajes")

    if for_all:
        db.table("messages").update({
            "deleted_at": datetime.now(timezone.utc).isoformat(),
            "deleted_for_all": True,
            "content": "",
        }).eq("id", message_id).execute()
    else:
        db.table("messages").update({
            "deleted_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", message_id).execute()

    return {"deleted": True, "for_all": for_all}


@router.post("/messages/{message_id}/react")
async def react_to_message(message_id: str, body: ReactionBody, request: Request):
    """Toggle reacción emoji en un mensaje."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()

    existing = db.table("message_reactions").select("id").eq(
        "message_id", message_id
    ).eq("user_id", payload["sub"]).execute()

    if existing.data:
        db.table("message_reactions").delete().eq("id", existing.data[0]["id"]).execute()
        return {"reacted": False}

    db.table("message_reactions").insert({
        "message_id": message_id,
        "user_id": payload["sub"],
        "emoji": body.emoji,
    }).execute()
    return {"reacted": True, "emoji": body.emoji}


@router.post("/messages/{message_id}/view")
async def mark_view_once(message_id: str, request: Request):
    """Marca un mensaje view-once como visto. Solo el destinatario puede marcarlo."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    msg = db.table("messages").select("sender_id,conversation_id,view_once,viewed_at").eq(
        "id", message_id
    ).execute()
    if not msg.data:
        raise HTTPException(404, "Mensaje no encontrado")
    m = msg.data[0]
    if not m.get("view_once"):
        raise HTTPException(400, "El mensaje no es view-once")
    if m["sender_id"] == payload["sub"]:
        raise HTTPException(403, "El emisor no puede marcar su propio mensaje como visto")
    conv = db.table("conversations").select("participant_a,participant_b").eq(
        "id", m["conversation_id"]
    ).execute()
    if not conv.data or payload["sub"] not in (conv.data[0]["participant_a"], conv.data[0]["participant_b"]):
        raise HTTPException(403, "No tenés acceso a este mensaje")
    if not m.get("viewed_at"):
        db.table("messages").update({
            "viewed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", message_id).execute()
    return {"viewed": True}


@router.post("/conversations/{conv_id}/typing")
async def set_typing(conv_id: str, body: TypingBody, request: Request):
    """Actualiza el indicador de escritura."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    if body.is_typing:
        db.table("typing_indicators").upsert({
            "conversation_id": conv_id,
            "user_id": payload["sub"],
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="conversation_id,user_id").execute()
    else:
        db.table("typing_indicators").delete().eq(
            "conversation_id", conv_id
        ).eq("user_id", payload["sub"]).execute()
    return {"ok": True}


@router.get("/conversations/{conv_id}/typing")
async def get_typing(conv_id: str, request: Request):
    """Devuelve quién está escribiendo en la conversación."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    conv = db.table("conversations").select("participant_a,participant_b").eq("id", conv_id).execute()
    if not conv.data or payload["sub"] not in (conv.data[0]["participant_a"], conv.data[0]["participant_b"]):
        raise HTTPException(403, "No tenés acceso a esta conversación")
    r = db.table("typing_indicators").select("user_id,updated_at").eq(
        "conversation_id", conv_id
    ).neq("user_id", payload["sub"]).execute()
    return {"typing": [row["user_id"] for row in r.data]}


@router.put("/conversations/{conv_id}/settings")
async def update_conv_settings(conv_id: str, body: ConvSettingsBody, request: Request):
    """Configura auto-limpieza y alertas de captura para esta conversación."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    db.table("conversation_settings").upsert({
        "conversation_id": conv_id,
        "user_id": payload["sub"],
        "auto_delete_days": body.auto_delete_days,
        "screenshot_alert": body.screenshot_alert,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }, on_conflict="conversation_id,user_id").execute()
    return {"updated": True}


@router.delete("/conversations/{conv_id}/history")
async def clear_chat_history(conv_id: str, request: Request):
    """Limpia el historial de mensajes para el usuario que lo solicita."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    # Verifica que el usuario es parte de la conversación
    conv = db.table("conversations").select("participant_a,participant_b").eq("id", conv_id).execute()
    if not conv.data:
        raise HTTPException(404, "Conversación no encontrada")
    c = conv.data[0]
    if payload["sub"] not in (c["participant_a"], c["participant_b"]):
        raise HTTPException(403, "No sos parte de esta conversación")

    # Marca solo los mensajes del que lo pide como borrados para él (soft delete)
    sender_msgs = db.table("messages").select("id,sender_id").eq(
        "conversation_id", conv_id
    ).is_("deleted_at", "null").execute().data
    own_ids = [m["id"] for m in sender_msgs if m["sender_id"] == payload["sub"]]
    other_ids = [m["id"] for m in sender_msgs if m["sender_id"] != payload["sub"]]
    now = datetime.now(timezone.utc).isoformat()
    if own_ids:
        db.table("messages").update({"deleted_at": now, "deleted_for_all": True, "content": ""}).in_("id", own_ids).execute()
    if other_ids:
        db.table("messages").update({"deleted_at": now}).in_("id", other_ids).execute()
    return {"cleared": True}


@router.post("/cleanup-run")
async def run_cleanup(request: Request):
    """Ejecuta la limpieza de mensajes expirados. Solo admins."""
    payload = _require_auth(request)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    from app.db.supabase import get_supabase
    result = get_supabase().rpc("cleanup_expired_messages").execute()
    return {"deleted": result.data}


@router.post("/upload-media")
async def upload_chat_media(
    request: Request,
    file: UploadFile = File(...),
):
    """Sube un archivo (imagen/video/audio/gif) al bucket chat y devuelve signed URL."""
    payload = _require_auth(request)

    ALLOWED = {
        "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif",
        "image/heic", "image/heif",
        "video/mp4", "video/webm", "video/quicktime",
        "audio/webm", "audio/mp4", "audio/ogg", "audio/mpeg",
    }
    content_type = (file.content_type or "").lower()
    if content_type not in ALLOWED:
        raise HTTPException(400, "Tipo de archivo no permitido")

    MAX_SIZES = {
        "image": 10 * 1024 * 1024,   # 10 MB
        "video": 50 * 1024 * 1024,   # 50 MB
        "audio":  5 * 1024 * 1024,   # 5 MB
    }
    media_kind = content_type.split("/")[0]
    data = await file.read()
    max_size = MAX_SIZES.get(media_kind, 10 * 1024 * 1024)
    if len(data) > max_size:
        raise HTTPException(413, f"Archivo demasiado grande (max {max_size // 1024 // 1024}MB)")

    ext = (file.filename or "file").rsplit(".", 1)[-1].lower() or "bin"

    # HEIC/HEIF (fotos de iPhone) no se renderizan en navegadores — convertir a JPEG
    if content_type in ("image/heic", "image/heif"):
        try:
            from PIL import Image
            import io as _io
            img = Image.open(_io.BytesIO(data)).convert("RGB")
            buf = _io.BytesIO()
            img.save(buf, format="JPEG", quality=90)
            data = buf.getvalue()
            content_type = "image/jpeg"
            ext = "jpg"
        except Exception:
            raise HTTPException(400, "No se pudo procesar la imagen HEIC/HEIF")

    from app.db.supabase import get_supabase
    db  = get_supabase()
    path = f"{payload['sub']}/{uuid.uuid4().hex}.{ext}"

    # Crear bucket "chat" si no existe (idempotente)
    try:
        db.storage.create_bucket("chat", options={"public": False})
    except Exception:
        pass  # Ya existe o no se puede crear — intentar subir igual

    try:
        db.storage.from_("chat").upload(path, data, {
            "content-type": content_type,
            "upsert": "true",
        })
    except Exception as e:
        raise HTTPException(500, f"Error al subir archivo: {str(e)}")

    # Generar signed URL (compatible con storage3 v0.x y v1.x)
    url = ""
    try:
        signed = db.storage.from_("chat").create_signed_url(path, 86400 * 7)
        if isinstance(signed, dict):
            url = signed.get("signedUrl") or signed.get("signedURL") or ""
        else:
            url = (
                getattr(signed, "signed_url", None)
                or getattr(signed, "signedUrl", None)
                or ""
            )
    except Exception:
        pass

    if not url:
        raise HTTPException(500, "Archivo subido pero no se pudo generar la URL. Reintentá.")

    return {
        "url":   url,
        "path":  path,
        "type":  media_kind,
        "mime":  content_type,
        "size":  len(data),
    }


@router.post("/online")
async def update_online(request: Request):
    """Actualiza last_active_at del usuario (llamar cada 30s)."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    get_supabase().table("users").update({
        "last_active_at": datetime.now(timezone.utc).isoformat()
    }).eq("id", payload["sub"]).execute()
    return {"ok": True}


@router.get("/online/{user_id}")
async def get_online_status(user_id: str, request: Request):
    """Devuelve el estado online de un usuario."""
    _require_auth(request)
    from app.db.supabase import get_supabase
    from datetime import timedelta
    r = get_supabase().table("users").select("last_active_at").eq("id", user_id).execute()
    if not r.data or not r.data[0].get("last_active_at"):
        return {"online": False, "last_seen": None}
    last = datetime.fromisoformat(r.data[0]["last_active_at"].replace("Z", "+00:00"))
    diff = datetime.now(timezone.utc) - last
    online = diff.total_seconds() < 120  # online si activo en los últimos 2 min
    return {
        "online": online,
        "last_seen": r.data[0]["last_active_at"],
        "minutes_ago": int(diff.total_seconds() / 60),
    }
