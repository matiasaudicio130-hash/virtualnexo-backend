"""
Generación de reportes financieros en PDF.
Usa fpdf2 (puro Python, sin dependencias de C).
"""
import io
from datetime import datetime
from typing import Optional
from fpdf import FPDF, XPos, YPos

from app.core.branding import APP_NAME
from app.db.supabase import get_supabase


# ── Paleta de colores (RGB) ──────────────────────────────────
C_BG       = (10,  10,  18)    # fondo oscuro (no usable en PDF blanco)
C_PURPLE   = (99,  60,  180)   # acento principal
C_DARK     = (30,  30,  45)    # encabezados de tabla
C_MED      = (60,  60,  80)    # filas impares
C_LIGHT    = (240, 240, 245)   # filas pares
C_TEXT     = (30,  30,  30)    # texto principal
C_MUTED    = (120, 120, 140)   # texto secundario
C_SUCCESS  = (16,  185, 129)   # verde

def _safe(text: str) -> str:
    """Convierte a Latin-1 compatible: reemplaza chars fuera de rango."""
    replacements = {"—": "-", "–": "-", "’": "'", "“": '"', "”": '"', "•": "*"}
    for src, dst in replacements.items():
        text = text.replace(src, dst)
    return text.encode("latin-1", errors="replace").decode("latin-1")

def _fmt_ars(v: float) -> str:
    return f"$ {v:,.0f}".replace(",", ".")

def _fmt_usd(v: float) -> str:
    return f"USD {v:,.2f}"

def _fmt_date(s: str) -> str:
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.strftime("%d/%m/%Y")
    except Exception:
        return s[:10] if s else ""


class AuraSWPDF(FPDF):
    """PDF con header/footer propios del proyecto."""

    def __init__(self, title: str = "", period: str = ""):
        super().__init__()
        self._title  = title
        self._period = period
        self.set_margins(15, 15, 15)
        self.set_auto_page_break(auto=True, margin=20)

    def header(self):
        # Barra de color
        self.set_fill_color(*C_PURPLE)
        self.rect(0, 0, 210, 18, "F")
        self.set_y(3)
        self.set_font("Helvetica", "B", 13)
        self.set_text_color(255, 255, 255)
        self.cell(0, 8, _safe(APP_NAME.upper()), align="L", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_y(20)
        # Título
        self.set_font("Helvetica", "B", 16)
        self.set_text_color(*C_TEXT)
        self.cell(0, 9, _safe(self._title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        if self._period:
            self.set_font("Helvetica", "", 10)
            self.set_text_color(*C_MUTED)
            self.cell(0, 6, _safe(self._period), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.ln(4)

    def footer(self):
        self.set_y(-15)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(*C_MUTED)
        ts = datetime.now().strftime("%d/%m/%Y %H:%M")
        self.cell(0, 10, f"Generado el {ts}  ·  Página {self.page_no()}", align="C")

    def kpi_card(self, label: str, value: str, sub: str = "", x: float | None = None, y: float | None = None, w: float = 55):
        if x is not None and y is not None:
            self.set_xy(x, y)
        self.set_fill_color(*C_LIGHT)
        h = 22
        self.rect(self.get_x(), self.get_y(), w, h, "F")
        # Borde superior de color
        self.set_fill_color(*C_PURPLE)
        self.rect(self.get_x(), self.get_y(), w, 1.5, "F")
        cx = self.get_x() + 3
        cy = self.get_y() + 3
        self.set_xy(cx, cy)
        self.set_font("Helvetica", "", 7)
        self.set_text_color(*C_MUTED)
        self.cell(w - 6, 4, _safe(label.upper()), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_xy(cx, cy + 5)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*C_TEXT)
        self.cell(w - 6, 6, _safe(value), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        if sub:
            self.set_xy(cx, cy + 12)
            self.set_font("Helvetica", "", 7)
            self.set_text_color(*C_MUTED)
            self.cell(w - 6, 4, _safe(sub))

    def section(self, title: str):
        self.ln(6)
        self.set_font("Helvetica", "B", 11)
        self.set_text_color(*C_PURPLE)
        self.cell(0, 7, _safe(title), new_x=XPos.LMARGIN, new_y=YPos.NEXT)
        self.set_fill_color(*C_PURPLE)
        self.rect(15, self.get_y(), 180, 0.5, "F")
        self.ln(3)

    def table_header(self, cols: list):
        self.set_fill_color(*C_DARK)
        self.set_text_color(255, 255, 255)
        self.set_font("Helvetica", "B", 8)
        for (label, w, align) in cols:
            self.cell(w, 7, _safe(label), border=0, fill=True, align=align,
                      new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.ln()

    def table_row(self, values: list, cols: list, row_idx: int = 0):
        self.set_fill_color(*(C_LIGHT if row_idx % 2 == 0 else (255, 255, 255)))
        self.set_text_color(*C_TEXT)
        self.set_font("Helvetica", "", 8)
        for val, (_, w, align) in zip(values, cols):
            self.cell(w, 6, _safe(str(val)), border=0, fill=True, align=align,
                      new_x=XPos.RIGHT, new_y=YPos.TOP)
        self.ln()


class ReportsService:

    def _load_payments(self, year: int, month: Optional[int] = None) -> list:
        db = get_supabase()
        if month:
            start = f"{year}-{month:02d}-01"
            if month == 12:
                end = f"{year+1}-01-01"
            else:
                end = f"{year}-{month+1:02d}-01"
            result = db.table("payments").select("*").gte("created_at", start).lt("created_at", end).eq("status", "completed").order("created_at").execute()
        else:
            result = db.table("payments").select("*").gte("created_at", f"{year}-01-01").lt("created_at", f"{year+1}-01-01").eq("status", "completed").order("created_at").execute()
        return result.data

    def _load_users_map(self) -> dict:
        db = get_supabase()
        result = db.table("users").select("id,first_name,last_name,email").execute()
        return {u["id"]: u for u in result.data}

    def generate_monthly(self, year: int, month: int) -> bytes:
        payments = self._load_payments(year, month)
        users_map = self._load_users_map()
        month_names = ["Enero","Febrero","Marzo","Abril","Mayo","Junio",
                       "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"]
        period_label = f"{month_names[month-1]} {year}"

        pdf = AuraSWPDF(
            title="Reporte Financiero Mensual",
            period=period_label
        )
        pdf.add_page()

        # ── KPIs ────────────────────────────────────────────
        total_ars = sum(float(p["amount_ars"]) for p in payments)
        total_usd = sum(float(p["amount_usd"]) for p in payments)
        count = len(payments)
        avg_ars = (total_ars / count) if count else 0

        left = 15
        gap  = 4
        w    = (180 - gap * 2) / 3
        y    = pdf.get_y()
        pdf.kpi_card("Total ARS",      _fmt_ars(total_ars),  f"{count} pagos",          x=left,       y=y, w=w)
        pdf.kpi_card("Total USD ref.", _fmt_usd(total_usd),  "equivalente en USD",       x=left+w+gap, y=y, w=w)
        pdf.kpi_card("Ticket promedio",_fmt_ars(avg_ars),    "ARS por pago",             x=left+2*(w+gap), y=y, w=w)
        pdf.set_y(y + 25)

        # ── Desglose por método ──────────────────────────────
        from collections import defaultdict
        by_method: dict = defaultdict(lambda: {"count": 0, "ars": 0.0})
        by_plan:   dict = defaultdict(lambda: {"count": 0, "ars": 0.0})
        for p in payments:
            by_method[p["method"]]["count"] += 1
            by_method[p["method"]]["ars"]   += float(p["amount_ars"])
            by_plan[p["membership_type"]]["count"] += 1
            by_plan[p["membership_type"]]["ars"]   += float(p["amount_ars"])

        pdf.section("Desglose por método de pago")
        cols_method = [
            ("Método",  55, "L"),
            ("Cantidad",30, "C"),
            ("Total ARS",55,"R"),
            ("% del total",40,"R"),
        ]
        pdf.table_header(cols_method)
        for i, (method, data) in enumerate(sorted(by_method.items())):
            pct = (data["ars"] / total_ars * 100) if total_ars else 0
            pdf.table_row(
                [method.title(), data["count"], _fmt_ars(data["ars"]), f"{pct:.1f}%"],
                cols_method, i
            )

        # ── Desglose por plan ────────────────────────────────
        plan_labels = {"monthly": "Mensual", "annual": "Anual", "lifetime": "Vitalicio"}
        pdf.section("Desglose por plan")
        cols_plan = [("Plan", 55, "L"), ("Cantidad", 30, "C"), ("Total ARS", 55, "R"), ("% del total", 40, "R")]
        pdf.table_header(cols_plan)
        for i, (pt, data) in enumerate(sorted(by_plan.items())):
            pct = (data["ars"] / total_ars * 100) if total_ars else 0
            pdf.table_row(
                [plan_labels.get(pt, pt), data["count"], _fmt_ars(data["ars"]), f"{pct:.1f}%"],
                cols_plan, i
            )

        # ── Listado de pagos ─────────────────────────────────
        pdf.section(f"Listado de pagos  - {period_label}")
        cols_payments = [
            ("Fecha",     22, "C"),
            ("Usuario",   50, "L"),
            ("Plan",      25, "C"),
            ("Método",    25, "C"),
            ("ARS",       35, "R"),
            ("USD",       23, "R"),
        ]
        pdf.table_header(cols_payments)
        for i, p in enumerate(payments):
            u = users_map.get(p["user_id"], {})
            name = f"{u.get('first_name','')} {u.get('last_name','')}".strip() or p["user_id"][:8]
            pdf.table_row(
                [
                    _fmt_date(p["created_at"]),
                    name[:28],
                    plan_labels.get(p["membership_type"], p["membership_type"]),
                    p["method"].title(),
                    _fmt_ars(float(p["amount_ars"])),
                    _fmt_usd(float(p["amount_usd"])),
                ],
                cols_payments, i
            )

        # ── Total final ──────────────────────────────────────
        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*C_PURPLE)
        pdf.cell(0, 8, _safe(f"TOTAL DEL PERIODO: {_fmt_ars(total_ars)}  ({_fmt_usd(total_usd)})"),
                 align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        buf = io.BytesIO()
        buf.write(pdf.output())
        buf.seek(0)
        return buf.read()

    def generate_annual(self, year: int) -> bytes:
        payments = self._load_payments(year)
        month_names = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"]

        pdf = AuraSWPDF(title="Reporte Financiero Anual", period=str(year))
        pdf.add_page()

        total_ars = sum(float(p["amount_ars"]) for p in payments)
        total_usd = sum(float(p["amount_usd"]) for p in payments)
        count = len(payments)

        # KPIs
        left = 15; gap = 4; w = (180 - gap * 2) / 3; y = pdf.get_y()
        pdf.kpi_card("Total ARS",     _fmt_ars(total_ars),  f"{count} pagos",    x=left,           y=y, w=w)
        pdf.kpi_card("Total USD ref.",_fmt_usd(total_usd),  "equivalente USD",   x=left+w+gap,     y=y, w=w)
        pdf.kpi_card("Pagos totales", str(count),           f"en {year}",        x=left+2*(w+gap), y=y, w=w)
        pdf.set_y(y + 25)

        # Por mes
        from collections import defaultdict
        by_month: dict = defaultdict(lambda: {"count": 0, "ars": 0.0})
        for p in payments:
            m = int(p["created_at"][5:7])
            by_month[m]["count"] += 1
            by_month[m]["ars"]   += float(p["amount_ars"])

        pdf.section("Ingresos por mes")
        cols = [("Mes", 40, "L"), ("Pagos", 30, "C"), ("Total ARS", 60, "R"), ("% del año", 50, "R")]
        pdf.table_header(cols)
        for i in range(1, 13):
            data = by_month.get(i, {"count": 0, "ars": 0.0})
            pct = (data["ars"] / total_ars * 100) if total_ars else 0
            pdf.table_row(
                [month_names[i-1], data["count"] or " -", _fmt_ars(data["ars"]) if data["ars"] else " -", f"{pct:.1f}%"],
                cols, i-1
            )

        pdf.ln(3)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(*C_PURPLE)
        pdf.cell(0, 8, _safe(f"TOTAL {year}: {_fmt_ars(total_ars)}  ({_fmt_usd(total_usd)})"),
                 align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

        buf = io.BytesIO()
        buf.write(pdf.output())
        buf.seek(0)
        return buf.read()


reports_service = ReportsService()
