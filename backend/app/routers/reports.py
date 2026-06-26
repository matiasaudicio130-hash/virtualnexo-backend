from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response
from datetime import datetime

from app.core.security import decode_access_token
from app.services.reports_service import reports_service

router = APIRouter(prefix="/reports", tags=["reports"])


def _require_admin(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload or payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return payload


@router.get("/financial/monthly/{year}/{month}")
async def download_monthly_report(year: int, month: int, request: Request):
    """Descarga el reporte financiero mensual en PDF."""
    _require_admin(request)
    if not (1 <= month <= 12):
        raise HTTPException(400, "Mes debe ser entre 1 y 12")
    if year < 2024 or year > datetime.now().year + 1:
        raise HTTPException(400, "Año inválido")

    pdf_bytes = reports_service.generate_monthly(year, month)
    month_names = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]
    filename = f"reporte_{month_names[month-1]}_{year}.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/financial/annual/{year}")
async def download_annual_report(year: int, request: Request):
    """Descarga el reporte financiero anual en PDF."""
    _require_admin(request)
    if year < 2024 or year > datetime.now().year + 1:
        raise HTTPException(400, "Año inválido")

    pdf_bytes = reports_service.generate_annual(year)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="reporte_anual_{year}.pdf"'},
    )


@router.get("/financial/preview/{year}/{month}")
async def preview_report_data(year: int, month: int, request: Request):
    """Preview de datos del reporte (JSON) — para renderizar en la UI antes de descargar."""
    _require_admin(request)
    if not (1 <= month <= 12):
        raise HTTPException(400, "Mes inválido (debe ser 1-12)")
    from app.db.supabase import get_supabase
    db = get_supabase()
    if month:
        start = f"{year}-{month:02d}-01"
        end   = f"{year}-{month+1:02d}-01" if month < 12 else f"{year+1}-01-01"
        pays = db.table("payments").select("amount_ars,amount_usd,method,membership_type").gte("created_at", start).lt("created_at", end).eq("status","completed").execute().data
    else:
        pays = []

    from collections import defaultdict
    total_ars = sum(float(p["amount_ars"]) for p in pays)
    total_usd = sum(float(p["amount_usd"]) for p in pays)
    by_method: dict = defaultdict(lambda: {"count":0,"ars":0.0})
    for p in pays:
        by_method[p["method"]]["count"] += 1
        by_method[p["method"]]["ars"]   += float(p["amount_ars"])

    return {
        "year": year, "month": month, "count": len(pays),
        "total_ars": round(total_ars, 2),
        "total_usd": round(total_usd, 2),
        "by_method": {k: {"count":v["count"],"ars":round(v["ars"],2)} for k,v in by_method.items()},
    }
