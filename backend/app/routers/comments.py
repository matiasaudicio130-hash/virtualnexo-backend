from fastapi import APIRouter, HTTPException, Request
from typing import Optional
from pydantic import BaseModel

from app.core.security import decode_access_token
from app.services.comments_service import comments_service

router = APIRouter(prefix="/comments", tags=["comments"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


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
    if not body.content.strip():
        raise HTTPException(400, "El comentario no puede estar vacío")
    if len(body.content) > 500:
        raise HTTPException(400, "Máximo 500 caracteres")
    try:
        return comments_service.add_comment(
            post_id, payload["sub"], body.content, body.parent_id
        )
    except ValueError as e:
        raise HTTPException(404, str(e))


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
