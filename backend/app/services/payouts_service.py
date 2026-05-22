"""
Servicio de payouts para influencers.

Lógica:
  - Un influencer genera una master_key con su user_id como `created_by`.
  - Cuando un usuario se registra con esa key, queda `master_key_used` en su perfil.
  - Cada pago de ese usuario genera un payout pendiente para el influencer.
  - Admin calcula y registra la liquidación → status='paid'.
"""
from datetime import date, datetime, timezone
from typing import Optional
from collections import defaultdict

from app.db.supabase import get_supabase


class PayoutsService:

    def _global_pct(self) -> float:
        db = get_supabase()
        r = db.table("system_settings").select("value").eq("key", "influencer_payout_pct").execute()
        return float(r.data[0]["value"]) if r.data else 20.0

    def get_summary(self) -> list:
        """
        Calcula cuánto debe cobrar cada influencer.
        Returns lista de {influencer, total_owed_ars, total_paid_ars, pending_ars, referred_users, referred_payments}
        """
        db = get_supabase()
        global_pct = self._global_pct()

        # Todos los usuarios con master_key_used
        referred = db.table("users").select("id,first_name,last_name,email,master_key_used").not_.is_("master_key_used", "null").execute().data
        if not referred:
            return []

        # Obtener las keys con created_by y payout_pct override
        codes = list({u["master_key_used"] for u in referred})
        keys_r = db.table("master_keys").select("code,created_by,payout_pct").in_("code", codes).execute().data
        key_map = {k["code"]: k for k in keys_r}

        # Todos los pagos completados de usuarios referidos
        referred_ids = [u["id"] for u in referred]
        if not referred_ids:
            return []

        # Pagos de usuarios referidos
        payments_r = db.table("payments").select("user_id,amount_ars,amount_usd,status").in_("user_id", referred_ids).eq("status", "completed").execute().data

        # Agrupar: user_id → pagos
        payments_by_user: dict = defaultdict(list)
        for p in payments_r:
            payments_by_user[p["user_id"]].append(p)

        # Agrupar: influencer_id → datos
        influencer_data: dict = defaultdict(lambda: {
            "referred_users": 0, "referred_payments": 0,
            "total_ars": 0.0, "pct": global_pct,
        })

        for u in referred:
            key_code = u["master_key_used"]
            key_info = key_map.get(key_code)
            if not key_info or not key_info.get("created_by"):
                continue
            inf_id = key_info["created_by"]
            pct    = float(key_info["payout_pct"]) if key_info.get("payout_pct") is not None else global_pct

            influencer_data[inf_id]["pct"] = pct
            influencer_data[inf_id]["referred_users"] += 1
            user_payments = payments_by_user.get(u["id"], [])
            influencer_data[inf_id]["referred_payments"] += len(user_payments)
            influencer_data[inf_id]["total_ars"] += sum(float(p["amount_ars"]) for p in user_payments)

        if not influencer_data:
            return []

        # Pagos ya liquidados
        paid_r = db.table("payouts").select("influencer_id,amount_ars,status").in_(
            "influencer_id", list(influencer_data.keys())
        ).eq("status", "paid").execute().data
        paid_by_inf: dict = defaultdict(float)
        for row in paid_r:
            paid_by_inf[row["influencer_id"]] += float(row["amount_ars"])

        # Datos de influencers
        inf_users_r = db.table("users").select("id,first_name,last_name,email").in_(
            "id", list(influencer_data.keys())
        ).execute().data
        inf_map = {u["id"]: u for u in inf_users_r}

        result = []
        for inf_id, data in influencer_data.items():
            owed   = round(data["total_ars"] * data["pct"] / 100, 2)
            paid   = round(paid_by_inf.get(inf_id, 0.0), 2)
            pending = round(owed - paid, 2)
            inf_u  = inf_map.get(inf_id, {})
            result.append({
                "influencer_id":      inf_id,
                "influencer_name":    f"{inf_u.get('first_name','')} {inf_u.get('last_name','')}".strip(),
                "influencer_email":   inf_u.get("email", ""),
                "payout_pct":         data["pct"],
                "referred_users":     data["referred_users"],
                "referred_payments":  data["referred_payments"],
                "gross_ars":          round(data["total_ars"], 2),
                "total_owed_ars":     owed,
                "total_paid_ars":     paid,
                "pending_ars":        pending,
            })

        return sorted(result, key=lambda x: x["pending_ars"], reverse=True)

    def register_payout(
        self,
        influencer_id: str,
        amount_ars: float,
        payout_pct: float,
        period_start: str,
        period_end: str,
        reference: Optional[str] = None,
        notes: Optional[str] = None,
        processed_by: Optional[str] = None,
    ) -> dict:
        db = get_supabase()

        # Contar pagos referidos en el período
        referred = db.table("users").select("id").not_.is_("master_key_used", "null").execute().data
        referred_ids = [u["id"] for u in referred]
        pay_r = db.table("payments").select("amount_ars,amount_usd").in_("user_id", referred_ids).eq("status", "completed").gte("created_at", period_start).lte("created_at", period_end).execute().data
        count  = len(pay_r)
        total_usd = sum(float(p["amount_usd"]) for p in pay_r)

        result = db.table("payouts").insert({
            "influencer_id":    influencer_id,
            "period_start":     period_start,
            "period_end":       period_end,
            "amount_ars":       amount_ars,
            "amount_usd":       round(total_usd * payout_pct / 100, 2),
            "referred_payments":count,
            "payout_pct":       payout_pct,
            "status":           "paid",
            "reference":        reference,
            "notes":            notes,
            "processed_by":     processed_by,
            "processed_at":     datetime.now(timezone.utc).isoformat(),
        }).execute()
        return result.data[0]

    def list_payouts(self, influencer_id: Optional[str] = None) -> list:
        db = get_supabase()
        q = db.table("payouts").select("*")
        if influencer_id:
            q = q.eq("influencer_id", influencer_id)
        return q.order("created_at", desc=True).execute().data

    def update_pct_for_key(self, key_code: str, pct: float) -> None:
        db = get_supabase()
        db.table("master_keys").update({"payout_pct": pct}).eq("code", key_code).execute()


payouts_service = PayoutsService()
