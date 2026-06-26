from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import Optional

from app.core.security import decode_access_token
from app.services.payouts_service import payouts_service
from app.services.audit_service import audit_service

router = APIRouter(prefix="/payouts", tags=["payouts"])


def _require_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload or payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return payload


class RegisterPayoutBody(BaseModel):
    influencer_id: str
    amount_ars:  float = Field(..., gt=0, le=50_000_000, description="Monto en ARS (máximo $50M)")
    payout_pct:  float = Field(..., ge=0, le=100)
    period_start: str   # YYYY-MM-DD
    period_end: str     # YYYY-MM-DD
    reference: Optional[str] = None
    notes: Optional[str] = None


class UpdateKeyPctBody(BaseModel):
    key_code: str
    payout_pct: float = Field(..., ge=0, le=100)


@router.get("/summary")
async def payout_summary(request: Request):
    """Resumen de lo adeudado a cada influencer."""
    _require_admin(request)
    return payouts_service.get_summary()


@router.get("/history")
async def payout_history(
    request: Request,
    influencer_id: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Historial de liquidaciones realizadas (paginado)."""
    _require_admin(request)
    return payouts_service.list_payouts(influencer_id=influencer_id, limit=limit, offset=offset)


@router.post("/register", status_code=201)
async def register_payout(body: RegisterPayoutBody, request: Request):
    """Registra una liquidación manual a un influencer."""
    admin = _require_admin(request)
    payout = payouts_service.register_payout(
        influencer_id=body.influencer_id,
        amount_ars=body.amount_ars,
        payout_pct=body.payout_pct,
        period_start=body.period_start,
        period_end=body.period_end,
        reference=body.reference,
        notes=body.notes,
        processed_by=admin["sub"],
    )
    audit_service.log(
        action="payout.registered",
        actor_id=admin["sub"],
        actor_role="admin",
        resource_type="payout",
        resource_id=payout["id"],
        metadata={
            "influencer_id": body.influencer_id,
            "amount_ars": body.amount_ars,
            "period": f"{body.period_start} → {body.period_end}",
        },
        request=request,
    )
    return payout


@router.put("/key-pct")
async def update_key_pct(body: UpdateKeyPctBody, request: Request):
    """Actualiza el % de payout de una master_key específica."""
    _require_admin(request)
    if not (0 <= body.payout_pct <= 100):
        raise HTTPException(400, "payout_pct debe estar entre 0 y 100")
    payouts_service.update_pct_for_key(body.key_code, body.payout_pct)
    return {"key_code": body.key_code, "payout_pct": body.payout_pct}
