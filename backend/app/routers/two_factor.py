"""
Router de autenticación de dos factores (2FA / TOTP).
Usa Google Authenticator / Authy / cualquier app TOTP compatible.

Flujo de activación:
  1. POST /2fa/setup      → genera secret + QR URI
  2. POST /2fa/verify-setup → verifica primer código TOTP → activa 2FA + genera backup codes

Flujo de login con 2FA activo:
  - Login devuelve { requires_2fa: true, totp_session: "<token temporal>" }
  - POST /2fa/verify → verifica código + devuelve access/refresh token

Desactivar:
  - POST /2fa/disable → requiere código TOTP actual o backup code + contraseña
"""
import secrets
import string
import io
import base64
from datetime import datetime, timezone, timedelta

import pyotp
import qrcode
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.security import decode_access_token, create_access_token, create_refresh_token
from app.core.branding import APP_NAME
from app.db.supabase import get_supabase

router = APIRouter(prefix="/2fa", tags=["2fa"])

TOTP_ISSUER    = APP_NAME
BACKUP_CODE_N  = 8    # Cantidad de códigos de respaldo
# Token temporal para el step 2 del login: corta vida (5 min)
TOTP_SESSION_EXPIRE_MINUTES = 5


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


def _generate_backup_codes() -> list[str]:
    """Genera 8 códigos de respaldo de 10 caracteres alfanuméricos."""
    chars = string.ascii_uppercase + string.digits
    return ["".join(secrets.choice(chars) for _ in range(10)) for _ in range(BACKUP_CODE_N)]


def _qr_dataurl(uri: str) -> str:
    """Genera QR como data URL base64 (para mostrar en frontend sin servidor de imágenes)."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    b64 = base64.b64encode(buf.read()).decode()
    return f"data:image/png;base64,{b64}"


# ── Modelos ─────────────────────────────────────────────────────

class VerifySetupBody(BaseModel):
    code: str   # 6 dígitos del autenticador

class DisableBody(BaseModel):
    code: str       # código TOTP actual o backup code
    password: str   # contraseña para confirmar

class VerifyLoginBody(BaseModel):
    totp_session: str   # token temporal devuelto en el login
    code: str           # 6 dígitos del autenticador


# ── Endpoints ───────────────────────────────────────────────────

@router.post("/setup")
async def setup_2fa(request: Request):
    """Genera un secret TOTP y devuelve el URI para QR + la imagen QR como data URL."""
    payload = _require_auth(request)
    user_id = payload["sub"]
    db = get_supabase()

    user = db.table("users").select("email,totp_enabled").eq("id", user_id).execute().data
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    if user[0].get("totp_enabled"):
        raise HTTPException(400, "El 2FA ya está activado. Desactivalo antes de reconfigurar.")

    secret = pyotp.random_base32()
    totp   = pyotp.TOTP(secret)
    uri    = totp.provisioning_uri(name=user[0]["email"], issuer_name=TOTP_ISSUER)
    qr     = _qr_dataurl(uri)

    # Guardar el secret (pendiente de verificación — totp_enabled sigue false)
    db.table("users").update({"totp_secret": secret}).eq("id", user_id).execute()

    return {
        "secret":  secret,
        "uri":     uri,
        "qr_url":  qr,
        "message": "Escaneá el QR en tu app autenticadora y confirmá con el código.",
    }


@router.post("/verify-setup")
async def verify_setup(body: VerifySetupBody, request: Request):
    """Activa 2FA verificando el primer código TOTP. Devuelve los backup codes."""
    payload = _require_auth(request)
    user_id = payload["sub"]
    db = get_supabase()

    user = db.table("users").select("totp_secret,totp_enabled").eq("id", user_id).execute().data
    if not user or not user[0].get("totp_secret"):
        raise HTTPException(400, "Primero llamá a /2fa/setup")
    if user[0].get("totp_enabled"):
        raise HTTPException(400, "2FA ya activado")

    totp = pyotp.TOTP(user[0]["totp_secret"])
    if not totp.verify(body.code.strip(), valid_window=1):
        raise HTTPException(400, "Código incorrecto. Verificá la hora de tu dispositivo.")

    backup_codes = _generate_backup_codes()
    db.table("users").update({
        "totp_enabled":      True,
        "totp_backup_codes": backup_codes,
    }).eq("id", user_id).execute()

    return {
        "enabled": True,
        "backup_codes": backup_codes,
        "message": "2FA activado. Guardá estos códigos de respaldo en un lugar seguro.",
    }


@router.post("/disable")
async def disable_2fa(body: DisableBody, request: Request):
    """Desactiva 2FA. Requiere código TOTP (o backup) + contraseña."""
    from app.core.security import verify_password
    payload = _require_auth(request)
    user_id = payload["sub"]
    db = get_supabase()

    user = db.table("users").select("totp_secret,totp_enabled,totp_backup_codes,password_hash").eq("id", user_id).execute().data
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    u = user[0]
    if not u.get("totp_enabled"):
        raise HTTPException(400, "El 2FA no está activado")

    # Verificar contraseña
    if not verify_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Contraseña incorrecta")

    # Verificar código TOTP o backup code
    code = body.code.strip()
    totp = pyotp.TOTP(u["totp_secret"])
    backup_codes: list = u.get("totp_backup_codes") or []

    if not totp.verify(code, valid_window=1) and code.upper() not in backup_codes:
        raise HTTPException(400, "Código TOTP o código de respaldo incorrecto")

    db.table("users").update({
        "totp_enabled":      False,
        "totp_secret":       None,
        "totp_backup_codes": [],
    }).eq("id", user_id).execute()

    return {"disabled": True, "message": "2FA desactivado correctamente."}


@router.post("/verify")
async def verify_totp_login(body: VerifyLoginBody):
    """
    Paso 2 del login con 2FA.
    Recibe totp_session (token temporal) + código TOTP.
    Devuelve access_token + refresh_token definitivos.
    """
    db = get_supabase()

    # Decodificar el token temporal
    payload = decode_access_token(body.totp_session)
    if not payload or payload.get("type") != "totp_pending":
        raise HTTPException(401, "Sesión 2FA inválida o expirada")

    user_id = payload["sub"]
    session_id = payload.get("session_id")

    user = db.table("users").select("id,role,status,totp_secret,totp_backup_codes,totp_enabled").eq("id", user_id).execute().data
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    u = user[0]

    if u["status"] != "active":
        raise HTTPException(403, "Cuenta no activa")
    if not u.get("totp_enabled") or not u.get("totp_secret"):
        raise HTTPException(400, "2FA no configurado")

    code = body.code.strip()
    totp = pyotp.TOTP(u["totp_secret"])
    backup_codes: list = u.get("totp_backup_codes") or []
    used_backup = code.upper() in backup_codes

    if not totp.verify(code, valid_window=1) and not used_backup:
        raise HTTPException(400, "Código incorrecto")

    # Consumir backup code si se usó
    if used_backup:
        new_codes = [c for c in backup_codes if c != code.upper()]
        db.table("users").update({"totp_backup_codes": new_codes}).eq("id", user_id).execute()

    # Activar la sesión temporal (ya creada en /auth/login)
    if session_id:
        db.table("sessions").update({"last_used_at": datetime.now(timezone.utc).isoformat()}).eq("id", session_id).execute()

    access  = create_access_token({"sub": user_id, "role": u["role"]})
    refresh = create_refresh_token()
    db.table("sessions").update({"refresh_token": refresh}).eq("id", session_id).execute()

    return {
        "access_token":  access,
        "refresh_token": refresh,
        "token_type":    "bearer",
        "requires_2fa":  False,
    }


@router.get("/status")
async def get_2fa_status(request: Request):
    """Devuelve si el usuario tiene 2FA activado y cuántos backup codes le quedan."""
    payload = _require_auth(request)
    db = get_supabase()
    user = db.table("users").select("totp_enabled,totp_backup_codes").eq("id", payload["sub"]).execute().data
    if not user:
        raise HTTPException(404, "Usuario no encontrado")
    u = user[0]
    return {
        "enabled":            u.get("totp_enabled", False),
        "backup_codes_left":  len(u.get("totp_backup_codes") or []),
    }
