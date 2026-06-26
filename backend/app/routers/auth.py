from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from typing import Optional
from pydantic import BaseModel


class PrivacyBody(BaseModel):
    is_private: bool


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
    lat: Optional[float] = None
    lng: Optional[float] = None
    identity_description: Optional[str] = None
    profile_extended: Optional[dict] = None

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


def _parse_device_name(user_agent: str) -> str:
    """Extrae un nombre legible del User-Agent (ej: 'Chrome en Windows')."""
    ua = user_agent.lower()
    if not ua:
        return "Dispositivo desconocido"
    browser = "Chrome" if "chrome" in ua else "Firefox" if "firefox" in ua else \
              "Safari" if "safari" in ua else "Edge" if "edg" in ua else "Navegador"
    os_name = "Android" if "android" in ua else "iOS" if "iphone" in ua or "ipad" in ua else \
              "Windows" if "windows" in ua else "Mac" if "mac" in ua else \
              "Linux" if "linux" in ua else "Desconocido"
    return f"{browser} en {os_name}"


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

    # Normalizar email a minúsculas para evitar duplicados case-sensitive
    body.email = body.email.strip().lower()

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

    # Enviar email de verificación — no bloqueante: si falla SMTP el usuario igual se registra
    try:
        send_verification_email(body.email, body.first_name, token)
    except Exception:
        pass  # El usuario puede reenviar el email desde /verificar-email

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

    # Eliminar token (GDPR + previene reutilización) — usado_at como backup
    try:
        db.table("email_verifications").delete().eq("id", verif["id"]).execute()
    except Exception:
        # Si el delete falla, al menos marcarlo como usado
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

    result = db.table("users").select("*").eq("email", body.email.strip().lower()).execute()
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

    # Limpiar sesiones expiradas y limitar sesiones activas por usuario (max 10)
    now_iso = datetime.now(timezone.utc).isoformat()
    db.table("sessions").delete().eq("user_id", user["id"]).lt("expires_at", now_iso).execute()
    active_sessions = db.table("sessions").select("id,created_at").eq("user_id", user["id"]).order("created_at").execute()
    MAX_SESSIONS = 10
    if len(active_sessions.data) >= MAX_SESSIONS:
        oldest_ids = [s["id"] for s in active_sessions.data[:len(active_sessions.data) - MAX_SESSIONS + 1]]
        db.table("sessions").delete().in_("id", oldest_ids).execute()

    # Crear sesión (siempre, con refresh token placeholder si hay 2FA)
    expires = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_token = create_refresh_token()
    session_r = db.table("sessions").insert({
        "user_id": user["id"],
        "refresh_token": refresh_token,
        "user_agent": request.headers.get("user-agent", ""),
        "ip_address": request.client.host if request.client else "",
        "expires_at": expires.isoformat(),
        "device_name": _parse_device_name(request.headers.get("user-agent", "")),
        "last_used_at": datetime.now(timezone.utc).isoformat(),
    }).execute()
    session_id = session_r.data[0]["id"] if session_r.data else ""

    # Actualizar last_login
    db.table("users").update(
        {"last_login_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", user["id"]).execute()

    # Notificar si es un dispositivo no visto antes para este usuario
    device_name = _parse_device_name(request.headers.get("user-agent", ""))
    try:
        prev_r = (
            db.table("sessions")
            .select("id")
            .eq("user_id", user["id"])
            .eq("device_name", device_name)
            .neq("id", session_id)
            .execute()
        )
        if not prev_r.data:
            from app.services.push_service import send_push
            send_push(
                user_id=user["id"],
                title="Nueva sesión detectada",
                body=f"Acceso desde {device_name}. ¿Fuiste vos?",
                url="/dashboard",
            )
    except Exception:
        pass  # No bloquear el login si la notificación falla

    # Si 2FA está activo → devolver token temporal, NO el access token
    if user.get("totp_enabled"):
        from app.core.security import create_totp_session_token
        totp_token = create_totp_session_token(user["id"], session_id)
        return TokenResponse(
            access_token="",
            refresh_token="",
            user_id=user["id"],
            status=user["status"],
            role=user["role"],
            requires_2fa=True,
            totp_session=totp_token,
        )

    access_token = create_access_token({
        "sub": user["id"],
        "role": user["role"],
        "status": user["status"],
    })

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
        "profile_photo_url,bio,province,city,is_private,"
        "profile_type,sexual_orientation,interested_in,visible_to,no_messages_from,"
        "identity_description,profile_extended,"
        "hide_from_solos,no_messages_from_solos,"
        "current_streak,longest_streak,last_streak_date,"
        "username,seeking_tags,seeking_text,"
        "totp_enabled"
    ).eq("id", payload["sub"]).execute()
    if not result.data:
        raise HTTPException(404, "Usuario no encontrado")
    user = result.data[0]

    # Expiración lazy: si la membresía venció, revocarla en este mismo request
    from datetime import datetime, timezone
    exp = user.get("membership_expires_at")
    if exp and user.get("membership_type") and user["membership_type"] != "lifetime":
        try:
            exp_dt = datetime.fromisoformat(exp.replace("Z", "+00:00"))
            if exp_dt < datetime.now(timezone.utc):
                db.table("users").update({
                    "membership_type": None,
                    "membership_expires_at": None,
                }).eq("id", payload["sub"]).execute()
                user["membership_type"] = None
                user["membership_expires_at"] = None
        except Exception:
            pass

    return user


@router.patch("/me/extended")
async def update_profile_extended(request: Request):
    """
    Actualiza campos en profile_extended con MERGE (no reemplaza).
    Usado para website, pinned_post_id y cualquier dato adicional del perfil.
    """
    from typing import Any as AnyType
    import json

    payload = _get_current_user(request)
    db      = get_supabase()

    body_bytes = await request.body()
    try:
        updates: dict = json.loads(body_bytes) if body_bytes else {}
    except Exception:
        raise HTTPException(400, "JSON inválido")

    if not isinstance(updates, dict) or not updates:
        raise HTTPException(400, "Body vacío o inválido")

    # Sanitizar URLs de links (prevenir XSS con javascript: u otros protocolos)
    if "links" in updates and isinstance(updates["links"], list):
        safe_links = []
        for link in updates["links"]:
            if not isinstance(link, dict):
                continue
            url = str(link.get("url", "")).strip()
            if url and not (url.startswith("http://") or url.startswith("https://")):
                url = f"https://{url}"
            try:
                from urllib.parse import urlparse
                parsed = urlparse(url)
                if parsed.scheme not in ("http", "https"):
                    continue  # descartar links con protocolos peligrosos
            except Exception:
                continue
            safe_links.append({"label": str(link.get("label", ""))[:80], "url": url[:500]})
        updates["links"] = safe_links

    if "website" in updates and updates["website"]:
        w = str(updates["website"]).strip()
        if not (w.startswith("http://") or w.startswith("https://")):
            w = f"https://{w}"
        from urllib.parse import urlparse
        try:
            p = urlparse(w)
            if p.scheme not in ("http", "https"):
                updates["website"] = None
            else:
                updates["website"] = w[:500]
        except Exception:
            updates["website"] = None

    # Validar ownership de pinned_post_id (no se puede pinear post ajeno)
    if "pinned_post_id" in updates and updates["pinned_post_id"] is not None:
        pin_id = str(updates["pinned_post_id"])
        pin_r = db.table("posts").select("user_id").eq("id", pin_id).maybe_single().execute()
        if not pin_r.data or pin_r.data["user_id"] != payload["sub"]:
            raise HTTPException(403, "Solo podés fijar tus propios posts")

    # Obtener profile_extended actual y mergear
    user_r = db.table("users").select("profile_extended").eq("id", payload["sub"]).maybe_single().execute()
    current: dict = (user_r.data.get("profile_extended") or {}) if user_r.data else {}
    merged  = {**current, **updates}

    db.table("users").update({"profile_extended": merged}).eq("id", payload["sub"]).execute()
    return {"updated": True, "profile_extended": merged}


@router.patch("/me/profile-type")
async def update_profile_type(body: UpdateProfileTypeBody, request: Request):
    payload = _get_current_user(request)
    db = get_supabase()

    update_data = body.model_dump(exclude_unset=True)

    if update_data.pop("hide_from_solos", None) is True:
        if "visible_to" not in update_data:
            update_data["visible_to"] = ["parejas", "grupos"]

    if "profile_type" in update_data:
        from app.utils.profile_constants import VALID_PROFILE_TYPES
        if update_data["profile_type"] not in VALID_PROFILE_TYPES:
            raise HTTPException(400, f"profile_type debe ser uno de: {', '.join(sorted(VALID_PROFILE_TYPES))}")

    if "sexual_orientation" in update_data:
        valid_o = {"hetero", "gay", "bi", "pan", "flexible", "na"}
        if update_data["sexual_orientation"] not in valid_o:
            raise HTTPException(400, "sexual_orientation inválida")

    from app.utils.profile_constants import VALID_CATEGORIES
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


@router.patch("/me/privacy")
async def update_privacy(body: PrivacyBody, request: Request):
    """Activa/desactiva el modo cuenta privada."""
    payload = _get_current_user(request)
    db = get_supabase()
    db.table("users").update({"is_private": body.is_private}).eq("id", payload["sub"]).execute()
    return {"is_private": body.is_private}


@router.post("/heartbeat")
@limiter.limit("10/hour")
async def heartbeat(request: Request):
    """
    Llamar una vez al abrir la app (o al volver al primer plano).
    Actualiza last_active_at y gestiona la racha diaria.
    """
    payload = _get_current_user(request)
    user_id = payload["sub"]
    db = get_supabase()

    today = datetime.now(timezone.utc).date()
    user_r = db.table("users").select(
        "current_streak,longest_streak,last_streak_date"
    ).eq("id", user_id).execute()

    if not user_r.data:
        return {"streak": 0}

    u = user_r.data[0]
    last_date_raw = u.get("last_streak_date")
    current = u.get("current_streak") or 0
    longest = u.get("longest_streak") or 0

    if last_date_raw:
        from datetime import date as date_type
        last_date = date_type.fromisoformat(str(last_date_raw)[:10])
        delta = (today - last_date).days
        if delta == 0:
            # Ya se registró hoy
            return {"streak": current, "longest": longest, "already_today": True}
        elif delta == 1:
            # Día consecutivo
            current += 1
        else:
            # Racha rota
            current = 1
    else:
        current = 1

    longest = max(longest, current)

    db.table("users").update({
        "current_streak":  current,
        "longest_streak":  longest,
        "last_streak_date": today.isoformat(),
        "last_active_at":  datetime.now(timezone.utc).isoformat(),
    }).eq("id", user_id).execute()

    return {"streak": current, "longest": longest, "is_new_day": True}


# ── GDPR: Exportar datos ──────────────────────────────────────────────────────
@router.get("/me/export")
@limiter.limit("3/hour")
async def export_my_data(request: Request):
    """
    Exporta todos los datos del usuario en formato JSON.
    GDPR Article 20 — portabilidad de datos.
    """
    from fastapi.responses import JSONResponse
    payload = _get_current_user(request)
    user_id = payload["sub"]
    db      = get_supabase()

    # Perfil
    user_r = db.table("users").select(
        "id,first_name,last_name,email,username,bio,province,city,"
        "profile_type,sexual_orientation,seeking_tags,seeking_text,"
        "created_at,membership_type,profile_extended"
    ).eq("id", user_id).maybe_single().execute()
    profile = user_r.data or {}

    # Posts
    posts_r = db.table("posts").select(
        "id,type,caption,media_url,province,city,created_at,status,extra_data"
    ).eq("user_id", user_id).order("created_at", desc=True).execute()
    posts = posts_r.data or []

    # Comentarios escritos
    cmts_r = db.table("comments").select(
        "id,content,created_at,post_id,parent_id"
    ).eq("user_id", user_id).order("created_at", desc=True).execute()
    comments_written = cmts_r.data or []

    # Reseñas dadas
    rev_given_r = db.table("reviews").select(
        "id,rating,text,is_anonymous,created_at,reviewed_id"
    ).eq("reviewer_id", user_id).order("created_at", desc=True).execute()
    reviews_given = rev_given_r.data or []

    # Reseñas recibidas
    rev_recv_r = db.table("reviews").select(
        "id,rating,text,is_anonymous,created_at,reviewer_id"
    ).eq("reviewed_id", user_id).order("created_at", desc=True).execute()
    reviews_received = rev_recv_r.data or []

    # Seguidores / siguiendo
    flwr_r = db.table("user_follows").select("id").eq("following_id", user_id).execute()
    flwg_r = db.table("user_follows").select("following_id").eq("follower_id", user_id).execute()

    # Conversaciones (solo metadata, no contenido)
    conv_r = db.table("conversations").select("id,created_at").or_(
        f"participant_a.eq.{user_id},participant_b.eq.{user_id}"
    ).execute()

    export = {
        "export_version":    "1.0",
        "exported_at":       datetime.now(timezone.utc).isoformat(),
        "platform":          "Aura SW — aurasw.club",
        "profile":           profile,
        "posts":             posts,
        "comments_written":  comments_written,
        "reviews_given":     reviews_given,
        "reviews_received":  reviews_received,
        "followers_count":   len(flwr_r.data or []),
        "following":         [f["following_id"] for f in (flwg_r.data or [])],
        "conversations_count": len(conv_r.data or []),
    }

    return JSONResponse(
        content=export,
        headers={"Content-Disposition": "attachment; filename=\"aura_mis_datos.json\""},
    )


# ── GDPR: Eliminar cuenta ────────────────────────────────────────────────────
@router.delete("/me")
async def delete_my_account(request: Request):
    """
    Elimina permanentemente la cuenta del usuario.
    GDPR Article 17 — derecho al olvido.
    Acciones:
    1. Anonimiza datos personales (nombre, email, foto, bio)
    2. Marca status = 'rejected' (no puede volver a loguearse)
    3. Marca todos los posts como deleted
    4. Invalida los tokens (el cliente debe hacer logout)
    """
    payload = _get_current_user(request)
    user_id = payload["sub"]
    db      = get_supabase()
    ts      = datetime.now(timezone.utc).isoformat()

    # Anonimizar datos personales
    db.table("users").update({
        "first_name":       "Cuenta",
        "last_name":        "Eliminada",
        "email":            f"deleted_{user_id[:8]}@eliminado.aura",
        "bio":              None,
        "profile_photo_url": None,
        "username":         None,
        "status":           "rejected",
        "profile_extended": {"deleted_at": ts, "account_deleted": True},
    }).eq("id", user_id).execute()

    # Eliminar posts
    db.table("posts").update({"status": "deleted"}).eq("user_id", user_id).execute()

    # Eliminar comentarios
    db.table("comments").update({"is_deleted": True, "content": "[cuenta eliminada]"}).eq("user_id", user_id).execute()

    # Revocar todas las sesiones
    try:
        db.table("sessions").delete().eq("user_id", user_id).execute()
    except Exception:
        pass

    # Revocar push subscriptions
    try:
        db.table("push_subscriptions").delete().eq("user_id", user_id).execute()
    except Exception:
        pass

    return {"deleted": True, "message": "Tu cuenta fue eliminada permanentemente."}
