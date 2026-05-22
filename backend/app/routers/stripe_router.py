from fastapi import APIRouter, HTTPException, Request, Header
from typing import Optional
from pydantic import BaseModel

from app.core.security import decode_access_token
from app.services.stripe_service import stripe_service
from app.services.audit_service import audit_service
from app.core.config import get_settings

settings = get_settings()
router = APIRouter(prefix="/stripe", tags=["stripe"])


class CheckoutRequest(BaseModel):
    plan: str = "monthly"
    currency: str = "ARS"


class SimulateSuccessBody(BaseModel):
    session_id: str


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido o expirado")
    return payload


@router.get("/config")
async def stripe_config():
    """Devuelve la publishable key y si está en modo simulación."""
    return {
        "publishable_key": settings.STRIPE_PUBLISHABLE_KEY or None,
        "simulation_mode": stripe_service.simulation_mode,
    }


VALID_PLANS = {"monthly", "annual", "lifetime"}
VALID_CURRENCIES = {"ARS", "USD"}


@router.post("/create-checkout")
async def create_checkout(body: CheckoutRequest, request: Request):
    """
    Crea una Checkout Session.
    En modo real devuelve {url} para redirigir a Stripe.
    En modo simulación devuelve {session_id, simulation: true}.
    """
    if body.plan not in VALID_PLANS:
        raise HTTPException(400, f"Plan inválido. Opciones: {', '.join(VALID_PLANS)}")
    if body.currency not in VALID_CURRENCIES:
        raise HTTPException(400, f"Moneda inválida. Opciones: {', '.join(VALID_CURRENCIES)}")
    payload = _require_auth(request)

    from app.db.supabase import get_supabase
    db = get_supabase()
    user_r = db.table("users").select("email,first_name,last_name,membership_type,status").eq(
        "id", payload["sub"]
    ).execute()
    if not user_r.data:
        raise HTTPException(404, "Usuario no encontrado")
    user = user_r.data[0]

    frontend_url = settings.FRONTEND_URL
    session = await stripe_service.create_checkout_session(
        user_id=payload["sub"],
        email=user["email"],
        name=f"{user['first_name']} {user['last_name']}",
        plan=body.plan,
        currency=body.currency,
        success_url=f"{frontend_url}/checkout/success",
        cancel_url=f"{frontend_url}/checkout/cancel",
    )

    audit_service.log(
        action="stripe.checkout_created",
        actor_id=payload["sub"],
        resource_type="stripe_session",
        resource_id=session["session_id"],
        metadata={"plan": body.plan, "currency": body.currency, "simulation": session["simulation"]},
        request=request,
    )
    return session


@router.post("/simulate-success")
async def simulate_success(body: SimulateSuccessBody, request: Request):
    """
    DEV ONLY: simula que Stripe confirmó el pago.
    Solo disponible cuando STRIPE_SECRET_KEY está vacío.
    """
    if not stripe_service.simulation_mode:
        raise HTTPException(403, "Solo disponible en modo simulación")

    payload = _require_auth(request)
    session_id = body.session_id

    # Verificar que la session pertenece al usuario autenticado
    from app.db.supabase import get_supabase
    db = get_supabase()
    sess_r = db.table("stripe_sessions").select("user_id").eq(
        "stripe_session_id", session_id
    ).execute()
    if not sess_r.data or sess_r.data[0]["user_id"] != payload["sub"]:
        raise HTTPException(403, "Session no válida para este usuario")

    result = await stripe_service.simulate_success(session_id)
    audit_service.log(
        action="stripe.payment_simulated",
        actor_id=payload["sub"],
        resource_type="stripe_session",
        resource_id=session_id,
        request=request,
    )
    return result


@router.post("/webhook", include_in_schema=False)
async def stripe_webhook(
    request: Request,
    stripe_signature: Optional[str] = Header(None),
):
    """Webhook de Stripe. Stripe llama aquí cuando se completa un pago."""
    if stripe_service.simulation_mode:
        raise HTTPException(404, "Webhook no activo en modo simulación")

    payload = await request.body()
    if not stripe_signature:
        raise HTTPException(400, "Missing Stripe-Signature header")

    try:
        result = await stripe_service.handle_webhook(payload, stripe_signature)
    except Exception as e:
        import logging
        logging.getLogger(__name__).error(f"Stripe webhook error: {e}", exc_info=True)
        raise HTTPException(400, "Webhook inválido o firma incorrecta")

    return result


@router.get("/session/{session_id}")
async def get_session_status(session_id: str, request: Request):
    """Consulta el estado de una checkout session."""
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    sess_r = db.table("stripe_sessions").select("*").eq(
        "stripe_session_id", session_id
    ).eq("user_id", payload["sub"]).execute()
    if not sess_r.data:
        raise HTTPException(404, "Session no encontrada")
    return sess_r.data[0]
