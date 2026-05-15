from typing import Optional
from app.core.security import generate_master_key_code
from app.db.supabase import get_supabase
import logging

logger = logging.getLogger(__name__)


class MasterKeyService:
    def validate(self, code: str) -> dict:
        """Valida una master key. Retorna info si es válida, error si no."""
        db = get_supabase()
        result = db.table("master_keys").select("*").eq("code", code).eq("is_active", True).execute()

        if not result.data:
            return {"valid": False, "message": "Código inválido o inactivo"}

        key = result.data[0]

        if key["uses_count"] >= key["max_uses"]:
            return {"valid": False, "message": "Este código ya alcanzó su límite de usos"}

        from datetime import datetime, timezone
        if key["expires_at"]:
            exp = datetime.fromisoformat(key["expires_at"].replace("Z", "+00:00"))
            if exp < datetime.now(timezone.utc):
                return {"valid": False, "message": "Este código ha expirado"}

        return {
            "valid": True,
            "type": key["type"],
            "discount_pct": key["discount_pct"],
            "temp_days": key["temp_days"],
            "message": "Código válido",
        }

    def consume(self, code: str) -> bool:
        """Incrementa el contador de usos de una key."""
        db = get_supabase()
        result = db.table("master_keys").select("id,uses_count,max_uses").eq("code", code).execute()
        if not result.data:
            return False
        key = result.data[0]
        new_count = key["uses_count"] + 1
        db.table("master_keys").update({
            "uses_count": new_count,
            "is_active": new_count < key["max_uses"],
        }).eq("id", key["id"]).execute()
        return True

    def create(self, data: dict, admin_id: str) -> dict:
        db = get_supabase()
        code = generate_master_key_code()
        payload = {
            "code": code,
            "type": data["type"],
            "discount_pct": data.get("discount_pct", 0),
            "temp_days": data.get("temp_days"),
            "max_uses": data.get("max_uses", 1),
            "expires_at": data.get("expires_at"),
            "notes": data.get("notes"),
            "created_by": admin_id,
            "is_active": True,
        }
        result = db.table("master_keys").insert(payload).execute()
        return result.data[0]

    def create_batch(self, quantity: int, data: dict, admin_id: str) -> list:
        quantity = min(quantity, 100)
        return [self.create(data, admin_id) for _ in range(quantity)]

    def list_all(self, limit: int = 50, offset: int = 0) -> list:
        db = get_supabase()
        result = (
            db.table("master_keys")
            .select("*")
            .order("created_at", desc=True)
            .range(offset, offset + limit - 1)
            .execute()
        )
        return result.data

    def deactivate(self, key_id: str) -> bool:
        db = get_supabase()
        result = db.table("master_keys").update({"is_active": False}).eq("id", key_id).execute()
        return bool(result.data)


master_key_service = MasterKeyService()
