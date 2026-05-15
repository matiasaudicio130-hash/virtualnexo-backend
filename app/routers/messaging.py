from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional

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


class SendMessageBody(BaseModel):
    recipient_id: str
    content: str
    type: str = "text"
    media_url: Optional[str] = None


@router.get("/conversations")
async def list_conversations(request: Request):
    """Lista todas las conversaciones del usuario con unreads."""
    payload = _require_auth(request)
    return messaging_service.get_conversations(payload["sub"])


@router.post("/conversations/start")
async def start_conversation(body: dict, request: Request):
    """Obtiene o inicia una conversación con otro usuario."""
    payload = _require_auth(request)
    recipient_id = body.get("recipient_id")
    if not recipient_id:
        raise HTTPException(400, "recipient_id requerido")
    if recipient_id == payload["sub"]:
        raise HTTPException(400, "No podés chatear con vos mismo")
    try:
        conv = messaging_service.get_or_create_conversation(payload["sub"], recipient_id)
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
    """
    Envía un mensaje. Verifica no_messages_from y visible_to antes de enviarlo.
    """
    payload = _require_auth(request)
    try:
        return messaging_service.send_message(
            sender_id=payload["sub"],
            recipient_id=body.recipient_id,
            content=body.content,
            msg_type=body.type,
            media_url=body.media_url,
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
