"""
Servicio MetaMap (KYC).
En modo METAMAP_SIMULATION_MODE=true → simula respuestas para desarrollo.
Para producción: setear METAMAP_SIMULATION_MODE=false y completar credenciales reales.

Docs reales: https://docs.metamap.com
"""
import httpx
import hashlib
import hmac
import logging
from typing import Optional

from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

METAMAP_API_URL = "https://api.getmati.com"


class MetaMapService:
    def __init__(self):
        self._token: Optional[str] = None

    async def _get_auth_token(self) -> str:
        if settings.METAMAP_SIMULATION_MODE:
            return "sim_token_fake"
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{METAMAP_API_URL}/oauth",
                data={
                    "grant_type": "client_credentials",
                    "client_id": settings.METAMAP_CLIENT_ID,
                    "client_secret": settings.METAMAP_CLIENT_SECRET,
                },
            )
            resp.raise_for_status()
            return resp.json()["access_token"]

    async def create_verification_flow(self, user_id: str) -> dict:
        """
        Inicia un flow de verificación KYC para un usuario.
        Retorna: { flow_id, widget_url }
        """
        if settings.METAMAP_SIMULATION_MODE:
            sim_flow_id = f"sim_flow_{user_id[:8]}"
            return {
                "flow_id": sim_flow_id,
                "widget_url": f"{settings.FRONTEND_URL}/kyc/simulate?flow_id={sim_flow_id}&user_id={user_id}",
            }

        token = await self._get_auth_token()
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                f"{METAMAP_API_URL}/v2/identities",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "flowId": settings.METAMAP_FLOW_ID,
                    "metadata": {"user_id": user_id},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return {
                "flow_id": data["_id"],
                "widget_url": f"https://signup.getmati.com/?merchantToken={settings.METAMAP_CLIENT_ID}&flowId={settings.METAMAP_FLOW_ID}&metadata={{\"user_id\":\"{user_id}\"}}",
            }

    async def get_verification_status(self, identity_id: str) -> dict:
        """Consulta el estado de una verificación."""
        if settings.METAMAP_SIMULATION_MODE:
            return {"status": "pending", "identity_id": identity_id}

        token = await self._get_auth_token()
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{METAMAP_API_URL}/v2/identities/{identity_id}",
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            return resp.json()

    def verify_webhook_signature(self, payload: bytes, signature: str) -> bool:
        """Verifica la firma HMAC del webhook de MetaMap."""
        if settings.METAMAP_SIMULATION_MODE:
            return True
        expected = hmac.new(
            settings.METAMAP_WEBHOOK_SECRET.encode(),
            payload,
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, signature)

    def parse_webhook_event(self, data: dict) -> dict:
        """
        Parsea el payload del webhook de MetaMap.
        Retorna: { identity_id, status, reason }
        """
        event_name = data.get("eventName", "")
        resource = data.get("resource", {})

        if "verification_completed" in event_name:
            steps = resource.get("steps", [])
            all_passed = all(s.get("status") == "verified" for s in steps)
            return {
                "identity_id": resource.get("_id", ""),
                "status": "verified" if all_passed else "rejected",
                "reason": "" if all_passed else "Verificación fallida en uno o más pasos",
            }
        elif "verification_expired" in event_name:
            return {
                "identity_id": resource.get("_id", ""),
                "status": "expired",
                "reason": "La sesión de verificación expiró",
            }
        return {"identity_id": "", "status": "pending", "reason": ""}


metamap_service = MetaMapService()
