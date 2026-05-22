from fastapi import APIRouter, HTTPException, Request, Query
from typing import Literal, Optional
from pydantic import BaseModel

from app.core.security import decode_access_token
from app.services.profile_service import profile_service

router = APIRouter(prefix="/profiles", tags=["profiles"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


class ReportBody(BaseModel):
    reason: Literal[
        "spam",
        "acoso",
        "contenido_inapropiado",
        "perfil_falso",
        "menor_de_edad",
        "otro",
    ]
    details: Optional[str] = None


@router.get("/matches")
async def my_matches(request: Request):
    payload = _require_auth(request)
    return profile_service.get_matches(payload["sub"])


@router.get("/viewers")
async def my_viewers(request: Request, limit: int = Query(50, le=100)):
    payload = _require_auth(request)
    return profile_service.get_viewers(payload["sub"], limit=limit)


@router.get("/{user_id}")
async def get_profile(user_id: str, request: Request):
    payload = _require_auth(request)
    viewer_id = payload["sub"]

    # Registrar visita (no registrar si es el propio perfil)
    if viewer_id != user_id:
        profile_service.record_view(viewer_id, user_id)

    profile = profile_service.get_public_profile(user_id, viewer_id)
    if profile is None:
        raise HTTPException(404, "Perfil no encontrado")
    if profile.get("blocked"):
        raise HTTPException(403, "Perfil bloqueado")
    if profile.get("private"):
        raise HTTPException(403, "Perfil privado")
    return profile


@router.post("/{user_id}/like")
async def toggle_like(user_id: str, request: Request):
    payload = _require_auth(request)
    if payload["sub"] == user_id:
        raise HTTPException(400, "No podés darte like a vos mismo")
    return profile_service.toggle_like(payload["sub"], user_id)


@router.post("/{user_id}/block")
async def toggle_block(user_id: str, request: Request):
    payload = _require_auth(request)
    if payload["sub"] == user_id:
        raise HTTPException(400, "Acción inválida")
    return profile_service.toggle_block(payload["sub"], user_id)


@router.post("/{user_id}/report")
async def report_user(user_id: str, body: ReportBody, request: Request):
    payload = _require_auth(request)
    if payload["sub"] == user_id:
        raise HTTPException(400, "Acción inválida")
    return profile_service.report_user(payload["sub"], user_id, body.reason, body.details or "")


@router.post("/{user_id}/view")
async def record_view(user_id: str, request: Request):
    payload = _require_auth(request)
    profile_service.record_view(payload["sub"], user_id)
    return {"recorded": True}
