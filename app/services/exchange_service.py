"""
Servicio de cotización Dólar Blue.
Fuente: https://dolarapi.com/v1/dolares/blue
Cachea en DB para no spamear la API ni perder cotización por latencia.
"""
import httpx
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.db.supabase import get_supabase

logger = logging.getLogger(__name__)

DOLAR_API_URL = "https://dolarapi.com/v1/dolares/blue"
CURRENCY_PAIR = "USD_ARS_BLUE"


class ExchangeService:
    async def fetch_from_source(self) -> Optional[dict]:
        """Trae la cotización desde dolarapi.com."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(DOLAR_API_URL)
                resp.raise_for_status()
                data = resp.json()
                return {
                    "buy": float(data["compra"]),
                    "sell": float(data["venta"]),
                    "source": "dolarapi.com",
                }
        except Exception as e:
            logger.error(f"Error consultando dolarapi.com: {e}")
            return None

    def get_cached(self, max_age_minutes: int = 15) -> Optional[dict]:
        """Devuelve la última cotización cacheada si no es muy vieja."""
        db = get_supabase()
        result = (
            db.table("exchange_rate_cache")
            .select("*")
            .eq("currency_pair", CURRENCY_PAIR)
            .order("fetched_at", desc=True)
            .limit(1)
            .execute()
        )
        if not result.data:
            return None
        cache = result.data[0]
        fetched = datetime.fromisoformat(cache["fetched_at"].replace("Z", "+00:00"))
        age = datetime.now(timezone.utc) - fetched
        if age > timedelta(minutes=max_age_minutes):
            return None
        return {
            "buy": float(cache["buy"]),
            "sell": float(cache["sell"]),
            "source": cache["source"],
            "fetched_at": cache["fetched_at"],
            "cached": True,
        }

    def save_to_cache(self, data: dict) -> None:
        db = get_supabase()
        db.table("exchange_rate_cache").insert({
            "currency_pair": CURRENCY_PAIR,
            "buy": data["buy"],
            "sell": data["sell"],
            "source": data["source"],
        }).execute()

    async def get_current_rate(self, force_refresh: bool = False) -> dict:
        """Devuelve la cotización actual (cacheada o nueva)."""
        if not force_refresh:
            cached = self.get_cached()
            if cached:
                return cached

        fresh = await self.fetch_from_source()
        if fresh:
            self.save_to_cache(fresh)
            return {**fresh, "cached": False, "fetched_at": datetime.now(timezone.utc).isoformat()}

        # Fallback: última cotización aunque esté vieja
        cached_old = self.get_cached(max_age_minutes=10080)  # 7 días
        if cached_old:
            logger.warning("Usando cotización vieja como fallback")
            return {**cached_old, "stale": True}

        # Último fallback: valor hardcodeado conservador
        logger.error("Sin cotización disponible, usando fallback hardcoded")
        return {"buy": 1200.0, "sell": 1250.0, "source": "fallback", "stale": True}

    async def convert_usd_to_ars(self, amount_usd: float) -> dict:
        """Convierte USD a ARS usando precio de venta del blue."""
        rate = await self.get_current_rate()
        amount_ars = round(amount_usd * rate["sell"], 2)
        return {
            "amount_usd": amount_usd,
            "amount_ars": amount_ars,
            "exchange_rate": rate["sell"],
            "rate_info": rate,
        }


exchange_service = ExchangeService()
