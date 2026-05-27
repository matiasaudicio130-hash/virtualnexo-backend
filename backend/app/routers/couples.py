"""
Perfil de pareja — vincula dos usuarios verificados como pareja.
Usa profile_extended JSONB para almacenar partner_id y solicitudes pendientes.
"""
from fastapi import APIRouter, HTTPException, Request
from app.core.security import decode_access_token
from app.db.supabase import get_supabase

router = APIRouter(prefix="/couples", tags=["couples"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


def _get_ext(db, user_id: str) -> dict:
    r = db.table("users").select("profile_extended").eq("id", user_id).execute()
    return (r.data[0].get("profile_extended") or {}) if r.data else {}


def _set_ext(db, user_id: str, updates: dict):
    ext = _get_ext(db, user_id)
    ext.update(updates)
    # Remove keys with None value to clean up
    ext = {k: v for k, v in ext.items() if v is not None}
    db.table("users").update({"profile_extended": ext}).eq("id", user_id).execute()


@router.get("/me")
async def my_couple_status(request: Request):
    """Devuelve el estado de pareja del usuario: partner, solicitud pendiente."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    ext = _get_ext(db, me)
    partner_id = ext.get("partner_id")
    req_from   = ext.get("couple_request_from")
    req_sent   = ext.get("couple_request_sent_to")

    partner = None
    if partner_id:
        pr = db.table("users").select(
            "id,first_name,last_name,username,profile_photo_url,profile_type,province,city"
        ).eq("id", partner_id).eq("status", "active").execute()
        if pr.data:
            partner = pr.data[0]

    requester = None
    if req_from:
        rr = db.table("users").select(
            "id,first_name,last_name,username,profile_photo_url,profile_type"
        ).eq("id", req_from).execute()
        if rr.data:
            requester = rr.data[0]

    return {
        "partner":      partner,
        "request_from": requester,
        "request_sent_to": req_sent,
    }


@router.post("/request/{target_id}", status_code=201)
async def send_couple_request(target_id: str, request: Request):
    """Envía solicitud de vinculación de pareja a otro usuario."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    if me == target_id:
        raise HTTPException(400, "No podés vincularte con vos mismo")

    # Verificar que el target existe y está activo
    target_r = db.table("users").select("id,status,first_name,username").eq(
        "id", target_id
    ).execute()
    if not target_r.data or target_r.data[0]["status"] != "active":
        raise HTTPException(404, "Usuario no encontrado")

    # Verificar que ninguno de los dos ya tiene pareja o solicitud activa
    my_ext  = _get_ext(db, me)
    tgt_ext = _get_ext(db, target_id)

    if my_ext.get("partner_id"):
        raise HTTPException(409, "Ya tenés una pareja vinculada. Desvinculate primero.")
    if tgt_ext.get("partner_id"):
        raise HTTPException(409, "Esa persona ya tiene una pareja vinculada.")
    if my_ext.get("couple_request_sent_to"):
        raise HTTPException(409, "Ya tenés una solicitud pendiente.")

    # Guardar solicitud en ambos lados
    _set_ext(db, me, {"couple_request_sent_to": target_id})
    _set_ext(db, target_id, {"couple_request_from": me})

    # Notificación + push
    me_r = db.table("users").select("first_name,username").eq("id", me).execute().data
    me_name = (me_r[0].get("username") or me_r[0]["first_name"]) if me_r else "Alguien"
    display = f"@{me_name}" if me_r and me_r[0].get("username") else me_name

    try:
        db.table("notifications").insert({
            "user_id": target_id,
            "type": "couple_request",
            "title": "Solicitud de pareja",
            "body": f"{display} quiere vincularse con vos como pareja en Aura",
            "data": {"requester_id": me},
        }).execute()
        from app.services.push_service import send_push
        send_push(
            user_id=target_id,
            title="Solicitud de pareja",
            body=f"{display} quiere vincularse con vos como pareja verificada",
            url="/dashboard",
        )
    except Exception:
        pass

    return {"requested": True, "target_id": target_id}


@router.post("/accept/{requester_id}")
async def accept_couple_request(requester_id: str, request: Request):
    """Acepta la solicitud de vinculación de pareja."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    my_ext = _get_ext(db, me)
    if my_ext.get("couple_request_from") != requester_id:
        raise HTTPException(400, "No hay solicitud pendiente de ese usuario")

    # Vincular ambos
    _set_ext(db, me, {
        "partner_id": requester_id,
        "couple_request_from": None,
    })
    _set_ext(db, requester_id, {
        "partner_id": me,
        "couple_request_sent_to": None,
    })

    # Notificar al requester
    me_r = db.table("users").select("first_name,username").eq("id", me).execute().data
    me_name = (me_r[0].get("username") or me_r[0]["first_name"]) if me_r else "Alguien"
    display = f"@{me_name}" if me_r and me_r[0].get("username") else me_name

    try:
        db.table("notifications").insert({
            "user_id": requester_id,
            "type": "couple_accepted",
            "title": "¡Pareja vinculada!",
            "body": f"{display} aceptó tu solicitud. Ahora son pareja verificada en Aura.",
            "data": {"partner_id": me},
        }).execute()
        from app.services.push_service import send_push
        send_push(
            user_id=requester_id,
            title="¡Pareja vinculada!",
            body=f"{display} aceptó tu solicitud de pareja",
            url="/dashboard",
        )
    except Exception:
        pass

    return {"linked": True, "partner_id": requester_id}


@router.post("/decline/{requester_id}")
async def decline_couple_request(requester_id: str, request: Request):
    """Rechaza la solicitud de vinculación."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    _set_ext(db, me, {"couple_request_from": None})
    _set_ext(db, requester_id, {"couple_request_sent_to": None})

    return {"declined": True}


@router.delete("/unlink")
async def unlink_couple(request: Request):
    """Desvincula la pareja actual."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    my_ext = _get_ext(db, me)
    partner_id = my_ext.get("partner_id")
    if not partner_id:
        raise HTTPException(400, "No tenés pareja vinculada")

    _set_ext(db, me, {"partner_id": None})
    _set_ext(db, partner_id, {"partner_id": None})

    return {"unlinked": True}
