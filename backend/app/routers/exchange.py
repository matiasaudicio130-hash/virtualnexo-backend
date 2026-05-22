from fastapi import APIRouter, Query

from app.services.exchange_service import exchange_service

router = APIRouter(prefix="/exchange", tags=["exchange"])


@router.get("/dolar-blue")
async def dolar_blue(force_refresh: bool = Query(False, description="Forzar refresh ignorando cache")):
    """Cotización Dólar Blue. Cacheada 15 min por defecto."""
    return await exchange_service.get_current_rate(force_refresh=force_refresh)
