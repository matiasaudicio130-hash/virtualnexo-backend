"""
Endpoint público de precios de membresía.
Los precios se leen de system_settings → editables desde el admin sin tocar código.

Argentina paga en ARS (precio fijo, sin importar el dólar blue).
Internacional paga en USD.
El dólar blue se muestra solo como referencia informativa.
"""
from fastapi import APIRouter
from app.db.supabase import get_supabase
from app.services.exchange_service import exchange_service

router = APIRouter(prefix="/pricing", tags=["pricing"])

PLAN_KEYS = {
    "monthly":  {"label": "Mensual",  "days": 30,   "annual_equiv_months": 1},
    "annual":   {"label": "Anual",    "days": 365,  "annual_equiv_months": 12},
    "lifetime": {"label": "Vitalicio","days": None, "annual_equiv_months": None},
}


def _load_settings(db) -> dict:
    keys = [f"price_{plan}_{currency}"
            for plan in PLAN_KEYS
            for currency in ("ars", "usd")]
    result = db.table("system_settings").select("key,value").in_("key", keys).execute()
    return {row["key"]: float(row["value"]) for row in result.data}


@router.get("/plans")
async def get_plans():
    """
    Devuelve los 3 planes con precios en ARS y USD.
    - ARS: precio fijo para Argentina.
    - USD: precio para internacional.
    - El dólar blue se adjunta como referencia.
    """
    db = get_supabase()
    settings = _load_settings(db)
    rate = await exchange_service.get_current_rate()

    plans = []
    for plan_id, meta in PLAN_KEYS.items():
        price_ars = settings.get(f"price_{plan_id}_ars", 0)
        price_usd = settings.get(f"price_{plan_id}_usd", 0)

        # Ahorro vs mensual (solo para anual)
        savings = None
        if plan_id == "annual":
            monthly_ars = settings.get("price_monthly_ars", 0)
            if monthly_ars > 0:
                full_year_ars = monthly_ars * 12
                savings = {
                    "ars": full_year_ars - price_ars,
                    "pct": round((1 - price_ars / full_year_ars) * 100),
                }

        plans.append({
            "id": plan_id,
            "label": meta["label"],
            "days": meta["days"],
            "price_ars": price_ars,
            "price_usd": price_usd,
            "savings": savings,
        })

    return {
        "plans": plans,
        "dolar_blue": {
            "sell": rate["sell"],
            "buy":  rate["buy"],
            "source": rate["source"],
            "stale": rate.get("stale", False),
        },
        "currency_note": "Precios en ARS para Argentina. Precios en USD para pagos internacionales.",
    }


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str):
    if plan_id not in PLAN_KEYS:
        from fastapi import HTTPException
        raise HTTPException(404, "Plan no existe")
    db = get_supabase()
    settings = _load_settings(db)
    rate = await exchange_service.get_current_rate()
    meta = PLAN_KEYS[plan_id]
    return {
        "id": plan_id,
        "label": meta["label"],
        "days": meta["days"],
        "price_ars": settings.get(f"price_{plan_id}_ars", 0),
        "price_usd": settings.get(f"price_{plan_id}_usd", 0),
        "dolar_blue_sell": rate["sell"],
    }
