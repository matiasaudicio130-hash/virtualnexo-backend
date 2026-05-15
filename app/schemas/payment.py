from pydantic import BaseModel, field_validator
from typing import Optional, Literal
from datetime import datetime


class ManualPaymentCreate(BaseModel):
    user_id: str
    plan: str = "monthly"                   # monthly | annual | lifetime
    currency: Literal["ARS", "USD"] = "ARS" # ARS = Argentina (precio fijo ARS), USD = internacional
    method: str = "cash"                    # cash | transfer | mercadopago | crypto | other | stripe
    reference: Optional[str] = None
    notes: Optional[str] = None
    # Monto custom (si el admin quiere poner un precio distinto al estándar)
    amount_override_ars: Optional[float] = None
    amount_override_usd: Optional[float] = None

    @field_validator("method")
    @classmethod
    def valid_method(cls, v: str) -> str:
        valid = {"cash", "transfer", "mercadopago", "crypto", "other", "stripe"}
        if v not in valid:
            raise ValueError(f"Método inválido. Opciones: {', '.join(valid)}")
        return v

    @field_validator("plan")
    @classmethod
    def valid_plan(cls, v: str) -> str:
        if v not in {"monthly", "annual", "lifetime"}:
            raise ValueError("Plan debe ser monthly, annual o lifetime")
        return v


class PaymentResponse(BaseModel):
    id: str
    user_id: str
    amount_usd: float
    amount_ars: float
    exchange_rate: float
    method: str
    membership_type: str
    membership_days: int
    status: str
    reference: Optional[str]
    notes: Optional[str]
    external_id: Optional[str]
    processed_by: Optional[str]
    created_at: datetime
