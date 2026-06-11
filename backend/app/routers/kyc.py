from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase
from app.services.metamap_service import metamap_service
from app.services.email_service import send_kyc_approved_email, send_kyc_rejected_email

router = APIRouter(prefix="/kyc", tags=["kyc"])
settings = get_settings()


@router.post("/start")
async def start_kyc(request: Request):
    """Inicia el proceso de verificación KYC para el usuario autenticado."""
    payload = _require_auth(request)
    user_id = payload["sub"]

    db = get_supabase()
    user_result = db.table("users").select("*").eq("id", user_id).execute()
    if not user_result.data:
        raise HTTPException(404, "Usuario no encontrado")

    user = user_result.data[0]
    if user["status"] != "pending_kyc":
        raise HTTPException(400, f"Estado actual '{user['status']}' no permite iniciar KYC")

    # Verificar si ya hay un KYC pendiente
    existing = db.table("kyc_verifications").select("*").eq("user_id", user_id).eq("status", "pending").execute()
    if existing.data:
        kyc = existing.data[0]
        flow_data = await metamap_service.create_verification_flow(user_id)
        return {
            "flow_id": kyc["metamap_flow_id"],
            "widget_url": flow_data["widget_url"],
            "status": "pending",
        }

    # Crear nuevo flow
    flow_data = await metamap_service.create_verification_flow(user_id)

    db.table("kyc_verifications").insert({
        "user_id": user_id,
        "metamap_flow_id": flow_data["flow_id"],
        "status": "pending",
    }).execute()

    db.table("users").update({"kyc_flow_id": flow_data["flow_id"]}).eq("id", user_id).execute()

    return {
        "flow_id": flow_data["flow_id"],
        "widget_url": flow_data["widget_url"],
        "status": "pending",
    }


@router.get("/status")
async def kyc_status(request: Request):
    """Consulta el estado actual del KYC del usuario."""
    payload = _require_auth(request)
    user_id = payload["sub"]

    db = get_supabase()
    result = db.table("kyc_verifications").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(1).execute()

    if not result.data:
        return {"status": "not_started"}

    return {"status": result.data[0]["status"]}


@router.post("/webhook")
async def metamap_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook que recibe MetaMap cuando cambia el estado de una verificación.
    En producción, esta URL se configura en el dashboard de MetaMap.
    """
    body = await request.body()
    signature = request.headers.get("x-signature", "")

    if not metamap_service.verify_webhook_signature(body, signature):
        raise HTTPException(401, "Firma inválida")

    data = await request.json()
    parsed = metamap_service.parse_webhook_event(data)

    if not parsed["identity_id"]:
        return {"ok": True}

    background_tasks.add_task(_process_kyc_result, parsed, data)
    return {"ok": True}


async def _process_kyc_result(parsed: dict, raw_data: dict):
    db = get_supabase()

    kyc_result = db.table("kyc_verifications").select("*").eq(
        "metamap_flow_id", parsed["identity_id"]
    ).execute()

    if not kyc_result.data:
        kyc_result = db.table("kyc_verifications").select("*").eq(
            "metamap_identity_id", parsed["identity_id"]
        ).execute()

    if not kyc_result.data:
        return

    kyc = kyc_result.data[0]
    user_id = kyc["user_id"]

    db.table("kyc_verifications").update({
        "status": parsed["status"],
        "metamap_identity_id": parsed["identity_id"],
        "rejection_reason": parsed.get("reason", ""),
        "webhook_data": raw_data,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", kyc["id"]).execute()

    user_result = db.table("users").select("email,first_name").eq("id", user_id).execute()
    if not user_result.data:
        return
    user = user_result.data[0]

    if parsed["status"] == "verified":
        db.table("users").update({
            "status": "active",
            "kyc_identity_id": parsed["identity_id"],
            "kyc_verified_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", user_id).execute()
        send_kyc_approved_email(user["email"], user["first_name"])

    elif parsed["status"] in ("rejected", "expired"):
        db.table("users").update({"status": "rejected"}).eq("id", user_id).execute()
        send_kyc_rejected_email(user["email"], user["first_name"], parsed.get("reason", ""))


@router.post("/simulate/{action}")
async def simulate_kyc(action: str, request: Request):
    """
    SOLO DISPONIBLE EN DEV. Simula aprobación/rechazo de KYC para testing.
    action: 'approve' | 'reject'
    """
    if not settings.METAMAP_SIMULATION_MODE:
        raise HTTPException(403, "Solo disponible en modo simulación")

    payload = _require_auth(request)
    user_id = payload["sub"]

    if action not in ("approve", "reject"):
        raise HTTPException(400, "action debe ser 'approve' o 'reject'")

    fake_event = {
        "identity_id": f"sim_identity_{user_id[:8]}",
        "status": "verified" if action == "approve" else "rejected",
        "reason": "" if action == "approve" else "Simulación de rechazo",
    }
    await _process_kyc_result(fake_event, {})
    return {"simulated": action, "user_id": user_id}
