from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import Optional

from app.core.security import require_auth as _require_auth

router = APIRouter(prefix="/highlights", tags=["highlights"])


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
        "*, items:story_highlight_items(story_id, sort_order, posts!story_highlight_items_story_id_fkey(id,media_url,storage_path,created_at))"
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


@router.get("/my-stories")
async def my_stories(request: Request):
    """Stories propias (incluye expiradas) para elegir al crear/editar un highlight."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    r = db.table("posts").select("id,media_url,storage_path,created_at,expires_at") \
        .eq("user_id", payload["sub"]).eq("type", "story") \
        .order("created_at", desc=True).execute()
    return r.data


MAX_HIGHLIGHTS_PER_USER = 20
MAX_STORIES_PER_HIGHLIGHT = 50

@router.post("/", status_code=201)
async def create_highlight(body: CreateHighlightBody, request: Request):
    payload = _require_auth(request)
    user_id = payload["sub"]
    if not body.title.strip():
        raise HTTPException(400, "El título es obligatorio")
    if len(body.title) > 60:
        raise HTTPException(400, "El título no puede superar 60 caracteres")

    from app.db.supabase import get_supabase
    db = get_supabase()

    # Límite de highlights por usuario
    existing_r = db.table("story_highlights").select("id", count="exact").eq("user_id", user_id).execute()
    if (existing_r.count or 0) >= MAX_HIGHLIGHTS_PER_USER:
        raise HTTPException(400, f"Máximo {MAX_HIGHLIGHTS_PER_USER} highlights por perfil")

    hl = db.table("story_highlights").insert({
        "user_id":   user_id,
        "title":     body.title.strip(),
        "cover_url": body.cover_url,
    }).execute().data[0]

    if body.story_ids:
        # Verificar que las stories pertenecen al usuario antes de agregarlas
        valid_stories = db.table("posts").select("id").in_(
            "id", body.story_ids[:MAX_STORIES_PER_HIGHLIGHT]
        ).eq("type", "story").eq("user_id", user_id).execute()
        valid_ids = [s["id"] for s in valid_stories.data]
        if valid_ids:
            items = [
                {"highlight_id": hl["id"], "story_id": sid, "sort_order": i}
                for i, sid in enumerate(valid_ids)
            ]
            db.table("story_highlight_items").insert(items).execute()
    return hl


class UpdateHighlightBody(BaseModel):
    title:     Optional[str] = None
    cover_url: Optional[str] = None


@router.patch("/{highlight_id}")
async def update_highlight(highlight_id: str, body: UpdateHighlightBody, request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    hl = db.table("story_highlights").select("user_id").eq("id", highlight_id).execute()
    if not hl.data or hl.data[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "Sin permisos")
    update: dict = {}
    if body.title is not None:
        title = body.title.strip()
        if not title:
            raise HTTPException(400, "El título no puede estar vacío")
        update["title"] = title
    if body.cover_url is not None:
        update["cover_url"] = body.cover_url or None
    if not update:
        raise HTTPException(400, "Nada que actualizar")
    r = db.table("story_highlights").update(update).eq("id", highlight_id).execute()
    return r.data[0]


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


class AddHighlightItemsBody(BaseModel):
    story_ids: list[str]


def _own_highlight_or_403(db, highlight_id: str, user_id: str):
    hl = db.table("story_highlights").select("user_id").eq("id", highlight_id).execute()
    if not hl.data or hl.data[0]["user_id"] != user_id:
        raise HTTPException(403, "Sin permisos")


@router.post("/{highlight_id}/items", status_code=201)
async def add_highlight_items(highlight_id: str, body: AddHighlightItemsBody, request: Request):
    """Agrega stories a un highlight existente, respetando sort_order y evitando duplicados."""
    payload = _require_auth(request)
    if not body.story_ids:
        raise HTTPException(400, "Nada para agregar")

    from app.db.supabase import get_supabase
    db = get_supabase()
    _own_highlight_or_403(db, highlight_id, payload["sub"])

    existing = db.table("story_highlight_items").select("story_id, sort_order") \
        .eq("highlight_id", highlight_id).execute().data
    already = {it["story_id"] for it in existing}
    start   = (max((it["sort_order"] or 0) for it in existing) + 1) if existing else 0

    new_ids = [sid for sid in body.story_ids if sid not in already]
    if not new_ids:
        return {"added": 0}

    items = [
        {"highlight_id": highlight_id, "story_id": sid, "sort_order": start + i}
        for i, sid in enumerate(new_ids)
    ]
    db.table("story_highlight_items").insert(items).execute()
    return {"added": len(items)}


@router.delete("/{highlight_id}/items/{story_id}")
async def remove_highlight_item(highlight_id: str, story_id: str, request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    _own_highlight_or_403(db, highlight_id, payload["sub"])
    db.table("story_highlight_items").delete() \
        .eq("highlight_id", highlight_id).eq("story_id", story_id).execute()
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
