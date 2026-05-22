"""
Servicio de auditoría. Registra acciones críticas de admins.
"""
import logging
from typing import Optional
from fastapi import Request

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)


class AuditService:
    def log(
        self,
        action: str,
        actor_id: Optional[str] = None,
        actor_role: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        metadata: Optional[dict] = None,
        request: Optional[Request] = None,
    ) -> None:
        """Registra una acción en el audit log. Nunca rompe el flujo principal."""
        try:
            db = get_supabase()
            payload = {
                "actor_id": actor_id,
                "actor_role": actor_role,
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "metadata": metadata or {},
            }
            if request:
                payload["ip_address"] = request.client.host if request.client else None
                payload["user_agent"] = request.headers.get("user-agent")
            db.table("audit_log").insert(payload).execute()
        except Exception as e:
            logger.error(f"Audit log error (action={action}): {e}")

    def list_recent(self, limit: int = 100, offset: int = 0) -> list:
        db = get_supabase()
        result = (
            db.table("audit_log")
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data


audit_service = AuditService()
