from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, datetime


class UserPublic(BaseModel):
    id: str
    email: str
    first_name: str
    last_name: str
    role: str
    status: str
    membership_type: str
    membership_expires_at: Optional[datetime]
    province: Optional[str]
    city: Optional[str]
    profile_photo_url: Optional[str]
    bio: Optional[str]
    created_at: datetime


class UserAdmin(UserPublic):
    birth_date: date
    kyc_flow_id: Optional[str]
    kyc_verified_at: Optional[datetime]
    master_key_used: Optional[str]
    is_shadow_banned: bool
    last_login_at: Optional[datetime]
