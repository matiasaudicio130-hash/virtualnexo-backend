from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel


class UpdateProfileTypeBody(BaseModel):
    profile_type: Optional[str] = None
    sexual_orientation: Optional[str] = None
    interested_in: Optional[list] = None
    visible_to: Optional[list] = None
    no_messages_from: Optional[list] = None
    hide_from_solos: Optional[bool] = None
    no_messages_from_solos: Optional[bool] = None
    bio: Optional[str] = None
    province: Optional[str] = None
    city: Optional[str] = None

from app.core.limiter import limiter

from app.schemas.auth import (
    RegisterRequest, LoginRequest, RefreshRequest,
    TokenResponse, VerifyEmailRequest, MessageResponse,
)
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token,
    generate_email_token, decode_access_token,
)
from app.core.config import get_settings
from app.db.supabase import get_supabase
from app.services.email_service import send_verification_email
from app.services.master_key_service import master_key_service

router = APIRouter(prefix="/auth", tags=["auth"])
settings = get_settings()


def _get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido o expirado")
    return payload


@router.post("/register", response_model=MessageResponse, status_code=201)
@limiter.limit("5/minute;20/hour")
async def register(request: Request, body: RegisterRequest):
    db = get_supabase()

    # Verificar email duplicado
    existing = db.table("users").select("id").eq("email", body.email).execute()
    if existing.data:
        raise HTTPException(409, "El email ya está registrado")

    # Validar master key si fue provista
    master_key_info = None
    if body.master_key:
        validation = master_key_service.validate(body.master_key)
        if not validation["valid"]:
            raise HTTPException(400, validation["message"])
        master_key_info = validation

    # Crear usuario
    initial_status = "pending_email"
    user_payload = {
        "email": body.email,
        "password_hash": hash_password(body.password),
        "first_name": body.first_name,
        "last_name": body.last_name,
        "birth_date": body.birth_date.isoformat(),
        "role": "miembro",
        "status": initial_status,
        "master_key_used": body.master_key or None,
    }
    result = db.table("users").insert(user_payload).execute()
    user = result.data[0]
    user_id = user["id"]

    # Si usó master key, consumirla
    if body.master_key and master_key_info:
        master_key_service.consume(body.master_key)

    # Crear token de verificación de email
    token = generate_email_token()
    expires = datetime.now(timezone.utc) + timedelta(hours=24)
    db.table("email_verifications").insert({
        "user_id": user_id,
        "token": token,
        "expires_at": expires.isoformat(),
    }).execute()

    # Enviar email de verificación
    send_verification_email(body.email, body.first_name, token)

    return MessageResponse(
        message="Registro exitoso",
        detail="Revisá tu email para verificar tu cuenta."
    )


@router.post("/verify-email", response_model=MessageResponse)
async def verify_email(body: VerifyEmailRequest):
    db = get_supabase()

    result = db.table("email_verifications").select("*").eq("token", body.token).execute()
    if not result.data:
        raise HTTPException(400, "Token inválido")

    verif = result.data[0]

    if verif["used_at"]:
        raise HTTPException(400, "Token ya utilizado")

    exp = datetime.fromisoformat(verif["expires_at"].replace("Z", "+00:00"))
    if exp < datetime.now(timezone.utc):
        raise HTTPException(400, "Token expirado. Solicitá un nuevo email de verificación.")

    user_id = verif["user_id"]

    # Marcar token como usado
    db.table("email_verifications").update(
        {"used_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", verif["id"]).execute()

    # Obtener usuario para ver si usó master key
    user_result = db.table("users").select("*").eq("id", user_id).execute()
    user = user_result.data[0]

    # Determinar siguiente estado
    if user["master_key_used"]:
        next_status = "pending_manual"
    else:
        next_status = "pending_kyc"

    db.table("users").update({"status": next_status}).eq("id", user_id).execute()

    return MessageResponse(
        message="Email verificado exitosamente",
        detail=next_status
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute;50/hour")
async def login(request: Request, body: LoginRequest):
    db = get_supabase()

    result = db.table("users").select("*").eq("email", body.email).execute()
    if not result.data:
        raise HTTPException(401, "Credenciales incorrectas")

    user = result.data[0]

    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Credenciales incorrectas")

    if user["status"] == "pending_email":
        raise HTTPException(403, "Debés verificar tu email primero")

    if user["status"] == "rejected":
        raise HTTPException(403, "Tu cuenta fue rechazada. Contactá soporte.")

    if user["status"] == "suspended":
        raise HTTPException(403, "Tu cuenta está suspendida.")

    # Crear tokens
    access_token = create_access_token({
        "sub": user["id"],
        "role": user["role"],
        "status": user["status"],
    })
    refresh_token = create_refresh_token()

    # Guardar refresh token
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    db.table("sessions").insert({
        "user_id": user["id"],
        "refresh_token": refresh_token,
        "user_agent": request.headers.get("user-agent", ""),
        "ip_address": request.client.host if request.client else "",
        "expires_at": expires.isoformat(),
    }).execute()

    # Actualizar last_login
    db.table("users").update(
        {"last_login_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", user["id"]).execute()

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user["id"],
        status=user["status"],
        role=user["role"],
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest):
    db = get_supabase()

    result = db.table("sessions").select("*").eq("refresh_token", body.refresh_token).execute()
    if not result.data:
        raise HTTPException(401, "Refresh token inválido")

    session = result.data[0]
    exp = datetime.fromisoformat(session["expires_at"].replace("Z", "+00:00"))
    if exp < datetime.now(timezone.utc):
        db.table("sessions").delete().eq("id", session["id"]).execute()
        raise HTTPException(401, "Refresh token expirado")

    user_result = db.table("users").select("id,role,status").eq("id", session["user_id"]).execute()
    user = user_result.data[0]

    access_token = create_access_token({
        "sub": user["id"],
        "role": user["role"],
        "status": user["status"],
    })
    new_refresh = create_refresh_token()

    db.table("sessions").update({"refresh_token": new_refresh}).eq("id", session["id"]).execute()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user_id=user["id"],
        status=user["status"],
        role=user["role"],
    )


@router.post("/logout", response_model=MessageResponse)
async def logout(body: RefreshRequest):
    db = get_supabase()
    db.table("sessions").delete().eq("refresh_token", body.refresh_token).execute()
    return MessageResponse(message="Sesión cerrada")


@router.get("/me")
async def me(request: Request):
    payload = _get_current_user(request)
    db = get_supabase()
    result = db.table("users").select(
        "id,email,first_name,last_name,role,status,membership_type,membership_expires_at,"
        "profile_photo_url,bio,province,city,"
        "profile_type,hide_from_solos,no_messages_from_solos"
    ).eq("id", payload["sub"]).execute()
    if not result.data:
        raise HTTPException(404, "Usuario no encontrado")
    return result.data[0]


@router.patch("/me/profile-type")
async def update_profile_type(body: UpdateProfileTypeBody, request: Request):
    payload = _get_current_user(request)
    db = get_supabase()

    update_data = body.model_dump(exclude_unset=True)

    if update_data.pop("hide_from_solos", None) is True:
        if "visible_to" not in update_data:
            update_data["visible_to"] = ["parejas", "grupos"]

    if "profile_type" in update_data:
        valid = {"solo_h", "solo_m", "trans_m", "trans_f", "nb", "pareja", "trio_grupo"}
        if update_data["profile_type"] not in valid:
            raise HTTPException(400, f"profile_type debe ser uno de: {', '.join(sorted(valid))}")

    if "sexual_orientation" in update_data:
        valid_o = {"hetero", "gay", "bi", "pan", "flexible", "na"}
        if update_data["sexual_orientation"] not in valid_o:
            raise HTTPException(400, "sexual_orientation inválida")

    VALID_CATEGORIES = {"hombres", "mujeres", "nb", "parejas", "grupos"}
    for field in ("interested_in", "visible_to", "no_messages_from"):
        if field in update_data and update_data[field] is not None:
            bad = set(update_data[field]) - VALID_CATEGORIES
            if bad:
                raise HTTPException(400, f"{field} contiene valores inválidos: {bad}")
            if len(update_data[field]) == 0:
                update_data[field] = None

    if not update_data:
        raise HTTPException(400, "No hay campos válidos para actualizar")

    result = db.table("users").update(update_data).eq("id", payload["sub"]).execute()
    return result.data[0]
