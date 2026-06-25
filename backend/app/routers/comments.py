from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from pydantic import BaseModel
from datetime import datetime, timezone

from app.core.security import require_auth as _require_auth
from app.services.comments_service import comments_service

router = APIRouter(prefix="/comments", tags=["comments"])


class CommentBody(BaseModel):
    content:   str
    parent_id: Optional[str] = None


class ReportBody(BaseModel):
    reason: str


@router.get("/post/{post_id}")
async def get_comments(post_id: str, request: Request):
    payload = _require_auth(request)
    return comments_service.get_comments(post_id, payload["sub"])


@router.post("/post/{post_id}", status_code=201)
async def add_comment(post_id: str, body: CommentBody, request: Request):
    payload = _require_auth(request)
    actor_id = payload["sub"]
    if not body.content.strip():
        raise HTTPException(400, "El comentario no puede estar vacío")
    if len(body.content) > 500:
        raise HTTPException(400, "Máximo 500 caracteres")
    # Rate limit: máximo 1 comentario cada 5 segundos por usuario
    try:
        from app.db.supabase import get_supabase as _gs
        from datetime import timedelta
        _db = _gs()
        cutoff = (datetime.now(timezone.utc) - timedelta(seconds=5)).isoformat()
        recent = _db.table("comments").select("id", count="exact").eq(
            "user_id", actor_id
        ).gte("created_at", cutoff).execute()
        if (recent.count or 0) > 0:
            raise HTTPException(429, "Demasiados comentarios. Esperá unos segundos.")
    except HTTPException:
        raise
    except Exception:
        pass
    try:
        result = comments_service.add_comment(
            post_id, actor_id, body.content, body.parent_id
        )
    except ValueError as e:
        raise HTTPException(404, str(e))

    # Notificar a usuarios mencionados en el comentario
    try:
        from app.db.supabase import get_supabase
        from app.utils.mentions import notify_mentions
        _db = get_supabase()
        _name_r = _db.table("users").select("first_name,last_name").eq("id", actor_id).maybe_single().execute()
        actor_display = ""
        if _name_r.data:
            actor_display = f"{_name_r.data.get('first_name','')} {_name_r.data.get('last_name','')}".strip()
        notify_mentions(body.content, actor_id, actor_display or "Alguien", url="/feed")
    except Exception:
        pass

    # Push al dueño del post (o al autor del comentario padre si es reply)
    try:
        from app.db.supabase import get_supabase
        from app.services.push_service import send_push
        db = get_supabase()

        # Obtener autor del post
        post_r = db.table("posts").select("user_id").eq("id", post_id).maybe_single().execute()
        post_author = post_r.data["user_id"] if post_r.data else None

        # Nombre del comentador
        user_r = db.table("users").select("first_name,last_name").eq("id", actor_id).maybe_single().execute()
        name = ""
        if user_r.data:
            name = f"{user_r.data.get('first_name','')} {user_r.data.get('last_name','')}".strip()

        if post_author and post_author != actor_id:
            send_push(
                post_author,
                "Nuevo comentario",
                f"{name or 'Alguien'} comentó en tu publicación.",
                url="/feed",
            )

        # Si es reply, notificar también al autor del comentario padre
        if body.parent_id:
            parent_r = db.table("comments").select("user_id").eq("id", body.parent_id).maybe_single().execute()
            parent_author = parent_r.data["user_id"] if parent_r.data else None
            if parent_author and parent_author != actor_id and parent_author != post_author:
                send_push(
                    parent_author,
                    "Nueva respuesta",
                    f"{name or 'Alguien'} respondió tu comentario.",
                    url="/feed",
                )
    except Exception:
        pass  # Push nunca bloquea la respuesta

    return result


@router.delete("/{comment_id}")
async def delete_comment(comment_id: str, request: Request):
    payload = _require_auth(request)
    try:
        return comments_service.delete_comment(comment_id, payload["sub"])
    except ValueError as e:
        raise HTTPException(404, str(e))
    except PermissionError as e:
        raise HTTPException(403, str(e))


@router.post("/{comment_id}/report")
async def report_comment(comment_id: str, body: ReportBody, request: Request):
    payload = _require_auth(request)
    return comments_service.report_comment(comment_id, payload["sub"], body.reason)
