from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from app.core.security import decode_access_token

router = APIRouter(prefix="/highlights", tags=["highlights"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


class CreateHighlightBody(BaseModel):
    title:    str
    story_ids: list[str]
    cover_url: Optional[str] = None


class ReactStoryBody(BaseModel):
    emoji: str


@router.get("/user/{user_id}")
async def get_user_highlights(user_id: str, request: Request):
    _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    hl = db.table("story_highlights").select(
        "*, items:story_highlight_items(story_id, sort_order, posts!story_highlight_items_story_id_fkey(id,media_url,storage_path))"
    ).eq("user_id", user_id).order("created_at").execute()
    return hl.data


@router.get("/mine")
async def my_highlights(request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    hl = db.table("story_highlights").select(
        "*, items:story_highlight_items(story_id, sort_order)"
    ).eq("user_id", payload["sub"]).order("created_at").execute()
    return hl.data


@router.post("/", status_code=201)
async def create_highlight(body: CreateHighlightBody, request: Request):
    payload = _require_auth(request)
    if not body.title.strip():
        raise HTTPException(400, "El título es obligatorio")

    from app.db.supabase import get_supabase
    db = get_supabase()
    hl = db.table("story_highlights").insert({
        "user_id":   payload["sub"],
        "title":     body.title.strip(),
        "cover_url": body.cover_url,
    }).execute().data[0]

    if body.story_ids:
        items = [
            {"highlight_id": hl["id"], "story_id": sid, "sort_order": i}
            for i, sid in enumerate(body.story_ids)
        ]
        db.table("story_highlight_items").insert(items).execute()
    return hl


@router.delete("/{highlight_id}")
async def delete_highlight(highlight_id: str, request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    hl = db.table("story_highlights").select("user_id").eq("id", highlight_id).execute()
    if not hl.data or hl.data[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "Sin permisos")
    db.table("story_highlights").delete().eq("id", highlight_id).execute()
    return {"deleted": True}


# ── Story reactions ───────────────────────────────────────────

@router.post("/stories/{story_id}/react")
async def react_to_story(story_id: str, body: ReactStoryBody, request: Request):
    """Reacciona a una story con emoji → notifica al autor vía DM."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    from app.services.notifications_service import create_notification
    db = get_supabase()

    # Registrar reacción
    db.table("story_reactions").upsert({
        "story_id": story_id,
        "user_id":  payload["sub"],
        "emoji":    body.emoji,
    }, on_conflict="story_id,user_id").execute()

    # Obtener dueño de la story
    story_r = db.table("posts").select("user_id").eq("id", story_id).execute()
    if not story_r.data:
        raise HTTPException(404, "Story no encontrada")
    owner_id = story_r.data[0]["user_id"]

    if owner_id != payload["sub"]:
        # Obtener o crear conversación
        from app.services.messaging_service import messaging_service
        conv = messaging_service.get_or_create_conversation(payload["sub"], owner_id)

        # Enviar mensaje con la reacción
        user_r = db.table("users").select("first_name").eq("id", payload["sub"]).execute()
        name   = user_r.data[0]["first_name"] if user_r.data else "Alguien"

        db.table("messages").insert({
            "conversation_id": conv["id"],
            "sender_id":       payload["sub"],
            "content":         f"{body.emoji} reaccionó a tu historia",
            "type":            "text",
        }).execute()

        db.table("conversations").update({
            "last_message_at":      __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat(),
            "last_message_preview": f"{body.emoji} reaccionó a tu historia",
            "last_sender_id":       payload["sub"],
        }).eq("id", conv["id"]).execute()

        create_notification(
            owner_id, "story_reaction",
            f"{name} reaccionó a tu historia con {body.emoji}",
            {"from_user_id": payload["sub"], "story_id": story_id}
        )

    return {"reacted": True, "conversation_opened": owner_id != payload["sub"]}


@router.get("/stories/{story_id}/reactions")
async def get_story_reactions(story_id: str, request: Request):
    _require_auth(request)
    from app.db.supabase import get_supabase
    r = get_supabase().table("story_reactions").select(
        "emoji, users!story_reactions_user_id_fkey(id,first_name,profile_photo_url)"
    ).eq("story_id", story_id).execute()
    return r.data
