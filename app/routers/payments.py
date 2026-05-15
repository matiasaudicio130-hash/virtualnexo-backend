from fastapi import APIRouter, HTTPException, Request, Query

from app.core.security import decode_access_token
from app.services.payment_service import payment_service
from app.services.audit_service import audit_service
from app.schemas.payment import ManualPaymentCreate

router = APIRouter(prefix="/payments", tags=["payments"])


def _require_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    if payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return payload


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


@router.get("/me")
async def my_payments(request: Request):
    """Lista los pagos del usuario autenticado."""
    payload = _require_auth(request)
    return payment_service.list_payments(user_id=payload["sub"])


@router.post("/manual", status_code=201)
async def create_manual_payment(body: ManualPaymentCreate, request: Request):
    """
    Admin: registra un pago manual y activa la membresía.
    currency='ARS' → precio fijo en ARS (Argentina).
    currency='USD' → precio fijo en USD (internacional).
    """
    admin = _require_admin(request)

    payment = await payment_service.register_payment(
        user_id=body.user_id,
        plan=body.plan,
        currency=body.currency,
        method=body.method,
        reference=body.reference,
        notes=body.notes,
        processed_by=admin["sub"],
        status="completed",
        amount_usd_override=body.amount_override_usd,
        amount_ars_override=body.amount_override_ars,
    )

    audit_service.log(
        action="payment.create_manual",
        actor_id=admin["sub"],
        actor_role="admin",
        resource_type="payment",
        resource_id=payment["id"],
        metadata={
            "user_id": body.user_id,
            "plan": body.plan,
            "currency": body.currency,
            "method": body.method,
            "amount_ars": payment["amount_ars"],
            "amount_usd": payment["amount_usd"],
        },
        request=request,
    )
    return payment


@router.get("/admin/list")
async def list_all_payments(
    request: Request,
    method: str = Query(None),
    status: str = Query(None),
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    _require_admin(request)
    return payment_service.list_payments(method=method, status=status, limit=limit, offset=offset)


@router.get("/admin/stats")
async def admin_stats(request: Request):
    _require_admin(request)
    return payment_service.get_revenue_stats()


@router.get("/admin/audit-log")
async def audit_log(
    request: Request,
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
):
    _require_admin(request)
    return audit_service.list_recent(limit=limit, offset=offset)
