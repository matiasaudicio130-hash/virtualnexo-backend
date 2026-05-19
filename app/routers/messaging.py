from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Literal, Optional
from datetime import datetime, timezone

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
    content: str
    type: str = "text"
    media_url: Optional[str] = None
    reply_to_id: Optional[str] = None
    view_once: bool = False


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


@router.post("/conversations/start")
async def start_conversation(body: ConversationStartBody, request: Request):
    """Obtiene o inicia una conversación con otro usuario."""
    payload = _require_auth(request)
    if body.recipient_id == payload["sub"]:
        raise HTTPException(400, "No podés chatear con vos mismo")
    try:
        conv = messaging_service.get_or_create_conversation(payload["sub"], body.recipient_id)
        return conv
    except PermissionError as e:
        raise HTTPException(403, str(e))


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
async def send_message(conv_id: str, body: SendMessageBody, request: Request):
    payload = _require_auth(request)
    try:
        return messaging_service.send_message(
            sender_id=payload["sub"],
            recipient_id=body.recipient_id,
            content=body.content,
            msg_type=body.type,
            media_url=body.media_url,
            reply_to_id=body.reply_to_id,
            view_once=body.view_once,
        )
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.post("/conversations/{conv_id}/block")
async def block_in_conversation(conv_id: str, request: Request):
    payload = _require_auth(request)
    messaging_service.block_user(payload["sub"], conv_id)
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
    """Marca un mensaje view-once como visto (se ocultará después)."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    db.table("messages").update({
        "viewed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", message_id).eq("view_once", True).is_("viewed_at", "null").execute()
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

    # Marca todos los mensajes como borrados para este usuario
    db.table("messages").update({
        "deleted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("conversation_id", conv_id).is_("deleted_at", "null").execute()
    return {"cleared": True}


@router.post("/cleanup-run")
async def run_cleanup(request: Request):
    """Ejecuta la limpieza de mensajes expirados."""
    _require_auth(request)
    from app.db.supabase import get_supabase
    result = get_supabase().rpc("cleanup_expired_messages").execute()
    return {"deleted": result.data}
