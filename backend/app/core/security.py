from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Request, HTTPException
import secrets
import string

from app.core.config import get_settings

settings = get_settings()

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token() -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(64))


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        # Acepta "access" o "totp_pending" (el router 2fa valida el tipo internamente)
        if payload.get("type") not in ("access", "totp_pending"):
            return None
        return payload
    except JWTError:
        return None


def require_auth(request: Request) -> dict:
    """
    Valida el header `Authorization: Bearer <jwt>` y devuelve el payload.
    Fuente única de verdad para la auth de los routers — antes esta función
    estaba copiada (idéntica) en ~29 routers, así que un fix de seguridad había
    que replicarlo a mano en cada uno. Los routers la importan aliasada como
    `_require_auth` para no tocar sus call sites.
    """
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


def optional_auth(request: Request) -> Optional[dict]:
    """Como require_auth pero devuelve None si no hay token válido (en vez de 401)."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    return decode_access_token(auth.split(" ")[1])


def create_totp_session_token(user_id: str, session_id: str) -> str:
    """Token temporal de 5 minutos usado entre el login y la verificación 2FA."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=5)
    data: dict = {
        "sub": user_id,
        "session_id": session_id,
        "type": "totp_pending",
        "exp": expire,
    }
    return jwt.encode(data, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def generate_master_key_code(length: int = 12) -> str:
    """Genera un código de master key legible (sin caracteres confusos)."""
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    raw = "".join(secrets.choice(alphabet) for _ in range(length))
    # Formato: XXXX-XXXX-XXXX
    return f"{raw[:4]}-{raw[4:8]}-{raw[8:12]}"


def generate_email_token() -> str:
    return secrets.token_urlsafe(32)
