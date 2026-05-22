"""
Servicio de pagos.
- Argentina paga en ARS (precio fijo de system_settings).
- Internacional paga en USD (precio fijo de system_settings).
- El dólar blue se usa para convertir entre monedas en el registro contable.
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal

from app.db.supabase import get_supabase
from app.services.exchange_service import exchange_service

logger = logging.getLogger(__name__)

Currency = Literal["ARS", "USD"]

PLAN_DAYS = {"monthly": 30, "annual": 365, "lifetime": None}


class PaymentService:

    def _get_price_settings(self) -> dict:
        db = get_supabase()
        keys = [f"price_{plan}_{cur}"
                for plan in ("monthly", "annual", "lifetime")
                for cur in ("ars", "usd")]
        result = db.table("system_settings").select("key,value").in_("key", keys).execute()
        return {row["key"]: float(row["value"]) for row in result.data}

    async def get_plan_price(self, plan: str = "monthly", currency: Currency = "ARS") -> dict:
        """
        Devuelve el precio de un plan dado.
        ARS → precio fijo en ARS (Argentina).
        USD → precio fijo en USD (internacional), se guarda también en ARS al blue del momento.
        """
        settings = self._get_price_settings()
        rate = await exchange_service.get_current_rate()

        if currency == "ARS":
            price_ars = settings.get(f"price_{plan}_ars", 0)
            price_usd = round(price_ars / rate["sell"], 2) if rate["sell"] else 0
        else:
            price_usd = settings.get(f"price_{plan}_usd", 0)
            price_ars = round(price_usd * rate["sell"], 2)

        return {
            "plan": plan,
            "currency": currency,
            "amount_ars": price_ars,
            "amount_usd": price_usd,
            "exchange_rate": rate["sell"],
            "rate_info": rate,
        }

    async def register_payment(
        self,
        user_id: str,
        plan: str = "monthly",
        currency: Currency = "ARS",
        method: str = "cash",
        reference: Optional[str] = None,
        notes: Optional[str] = None,
        external_id: Optional[str] = None,
        processed_by: Optional[str] = None,
        status: str = "completed",
        # Override manual de monto (para pagos no-standard)
        amount_usd_override: Optional[float] = None,
        amount_ars_override: Optional[float] = None,
    ) -> dict:
        db = get_supabase()
        rate = await exchange_service.get_current_rate()

        if amount_usd_override is not None or amount_ars_override is not None:
            # Monto manual (admin decide el precio exacto)
            if amount_ars_override is not None:
                amount_ars = amount_ars_override
                amount_usd = amount_usd_override or round(amount_ars / rate["sell"], 2)
            else:
                amount_usd = amount_usd_override
                amount_ars = round(amount_usd * rate["sell"], 2)
        else:
            price = await self.get_plan_price(plan, currency)
            amount_ars = price["amount_ars"]
            amount_usd = price["amount_usd"]

        days = PLAN_DAYS.get(plan, 30)
        membership_type = "lifetime" if plan == "lifetime" else "monthly"

        payment_data = {
            "user_id": user_id,
            "amount_usd": amount_usd,
            "amount_ars": amount_ars,
            "exchange_rate": rate["sell"],
            "method": method,
            "membership_type": membership_type,
            "membership_days": days or 0,
            "status": status,
            "reference": reference,
            "notes": notes or f"Plan {plan} | Moneda: {currency}",
            "external_id": external_id,
            "processed_by": processed_by,
        }

        result = db.table("payments").insert(payment_data).execute()
        payment = result.data[0]

        if status == "completed":
            self._activate_membership(user_id, membership_type, days)

        return payment

    def _activate_membership(self, user_id: str, membership_type: str, days: Optional[int]) -> None:
        db = get_supabase()
        user_r = db.table("users").select("membership_expires_at").eq("id", user_id).execute()
        if not user_r.data:
            return

        if membership_type == "lifetime" or days is None:
            expires_at = None
        else:
            now = datetime.now(timezone.utc)
            current_exp = user_r.data[0].get("membership_expires_at")
            if current_exp:
                exp_dt = datetime.fromisoformat(current_exp.replace("Z", "+00:00"))
                base = exp_dt if exp_dt > now else now
            else:
                base = now
            expires_at = (base + timedelta(days=days)).isoformat()

        db.table("users").update({
            "membership_type": membership_type,
            "membership_expires_at": expires_at,
            "status": "active",
        }).eq("id", user_id).execute()

    def list_payments(
        self,
        user_id: Optional[str] = None,
        method: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list:
        db = get_supabase()
        q = db.table("payments").select("*")
        if user_id:
            q = q.eq("user_id", user_id)
        if method:
            q = q.eq("method", method)
        if status:
            q = q.eq("status", status)
        return q.order("created_at", desc=True).range(offset, offset + limit - 1).execute().data

    def get_revenue_stats(self) -> dict:
        db = get_supabase()
        completed = db.table("payments").select(
            "amount_usd,amount_ars,method,status,membership_type,created_at"
        ).eq("status", "completed").execute().data

        total_ars = sum(float(p["amount_ars"]) for p in completed)
        total_usd = sum(float(p["amount_usd"]) for p in completed)

        from collections import defaultdict
        by_method: dict = defaultdict(lambda: {"count": 0, "ars": 0.0, "usd": 0.0})
        by_plan: dict = defaultdict(lambda: {"count": 0, "ars": 0.0})
        for p in completed:
            m = p["method"]
            by_method[m]["count"] += 1
            by_method[m]["ars"] += float(p["amount_ars"])
            by_method[m]["usd"] += float(p["amount_usd"])
            pt = p["membership_type"]
            by_plan[pt]["count"] += 1
            by_plan[pt]["ars"] += float(p["amount_ars"])

        now = datetime.now(timezone.utc)
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        this_month = [p for p in completed if p["created_at"] >= month_start]
        month_ars = sum(float(p["amount_ars"]) for p in this_month)
        month_usd = sum(float(p["amount_usd"]) for p in this_month)

        return {
            # ARS es el primario (la mayoría paga en pesos)
            "total_ars":          round(total_ars, 2),
            "total_usd":          round(total_usd, 2),
            "total_payments":     len(completed),
            "this_month_ars":     round(month_ars, 2),
            "this_month_usd":     round(month_usd, 2),
            "this_month_count":   len(this_month),
            "by_method": {
                k: {"count": v["count"], "ars": round(v["ars"], 2), "usd": round(v["usd"], 2)}
                for k, v in by_method.items()
            },
            "by_plan": {
                k: {"count": v["count"], "ars": round(v["ars"], 2)}
                for k, v in by_plan.items()
            },
        }


payment_service = PaymentService()
