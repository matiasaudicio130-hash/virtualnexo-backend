from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MasterKeyCreate(BaseModel):
    type: str                         # gratis | descuento | temporal | vitalicio
    discount_pct: int = 0
    temp_days: Optional[int] = None
    max_uses: int = 1
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "type": "descuento",
                "discount_pct": 50,
                "max_uses": 10,
                "notes": "Influencer partner batch Q1"
            }
        }


class MasterKeyBatchCreate(BaseModel):
    quantity: int                     # cantidad de keys a generar (max 100)
    type: str
    discount_pct: int = 0
    temp_days: Optional[int] = None
    max_uses: int = 1
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None


class MasterKeyResponse(BaseModel):
    id: str
    code: str
    type: str
    discount_pct: int
    temp_days: Optional[int]
    max_uses: int
    uses_count: int
    expires_at: Optional[datetime]
    notes: Optional[str]
    is_active: bool
    created_at: datetime


class MasterKeyValidateResponse(BaseModel):
    valid: bool
    type: Optional[str] = None
    discount_pct: Optional[int] = None
    message: str
