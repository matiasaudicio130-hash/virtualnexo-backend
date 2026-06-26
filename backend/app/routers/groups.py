"""
Grupos de chat — conversaciones con múltiples participantes verificados.
Estructura separada de los DMs 1-on-1 para no romper compatibilidad.
"""
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/groups", tags=["groups"])

MAX_MEMBERS   = 50
MAX_NAME_LEN  = 60
MAX_MSG_LEN   = 2000


def _require_member(db, group_id: str, user_id: str) -> dict:
    m = db.table("group_members").select("role").eq("group_id", group_id).eq("user_id", user_id).execute()
    if not m.data:
        raise HTTPException(403, "No sos miembro de este grupo")
    return m.data[0]


def _require_admin(db, group_id: str, user_id: str):
    member = _require_member(db, group_id, user_id)
    if member["role"] != "admin":
        raise HTTPException(403, "Solo los admins pueden hacer esto")


# ── Schemas ──────────────────────────────────────────────────────

class CreateGroupBody(BaseModel):
    name: str
    description: Optional[str] = None
    member_ids: list[str] = []   # IDs de usuarios a invitar al crear


class SendGroupMessageBody(BaseModel):
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    reply_to_id: Optional[str] = None


class UpdateGroupBody(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


# ── Endpoints ────────────────────────────────────────────────────

@router.post("/", status_code=201)
async def create_group(body: CreateGroupBody, request: Request):
    """Crea un grupo y agrega al creador como admin + los miembros invitados."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    name = body.name.strip()
    if len(name) < 3 or len(name) > MAX_NAME_LEN:
        raise HTTPException(400, f"El nombre debe tener entre 3 y {MAX_NAME_LEN} caracteres")

    # Validar que los miembros existen y están activos
    invited = list({uid for uid in body.member_ids if uid != me})[:MAX_MEMBERS - 1]
    if invited:
        valid = db.table("users").select("id").in_("id", invited).eq("status", "active").execute()
        invited = [u["id"] for u in valid.data]

    # Crear el grupo
    group_r = db.table("group_chats").insert({
        "name": name,
        "description": body.description,
        "created_by": me,
        "member_count": 1 + len(invited),
    }).execute()
    group = group_r.data[0]
    gid = group["id"]

    # Agregar miembros
    members_to_insert = [{"group_id": gid, "user_id": me, "role": "admin"}]
    for uid in invited:
        members_to_insert.append({"group_id": gid, "user_id": uid, "role": "member"})
    db.table("group_members").insert(members_to_insert).execute()

    # Notificar a los invitados
    me_data = db.table("users").select("first_name,last_name").eq("id", me).execute().data
    creator_name = f"{me_data[0]['first_name']} {me_data[0]['last_name']}" if me_data else "Alguien"
    for uid in invited:
        try:
            db.table("notifications").insert({
                "user_id": uid,
                "type": "group_invite",
                "title": f"Te agregaron a '{name}'",
                "body": f"{creator_name} te agregó al grupo",
                "data": {"group_id": gid},
            }).execute()
        except Exception:
            pass

    group["members"] = members_to_insert
    return group


@router.get("/")
async def list_my_groups(request: Request):
    """Lista todos los grupos en los que participo."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    memberships = db.table("group_members").select("group_id").eq("user_id", me).execute()
    group_ids = [m["group_id"] for m in memberships.data]
    if not group_ids:
        return []

    groups = db.table("group_chats").select(
        "id,name,description,avatar_url,member_count,last_message_at,last_message_preview,created_by,created_at"
    ).in_("id", group_ids).order("last_message_at", desc=True).execute()

    # Agregar rol del usuario en cada grupo
    role_map = {m["group_id"]: None for m in memberships.data}
    roles = db.table("group_members").select("group_id,role").eq("user_id", me).in_("group_id", group_ids).execute()
    for r in roles.data:
        role_map[r["group_id"]] = r["role"]

    result = []
    for g in groups.data:
        g["my_role"] = role_map.get(g["id"])
        result.append(g)
    return result


@router.get("/{group_id}")
async def get_group(group_id: str, request: Request):
    """Detalle del grupo + lista de miembros."""
    payload = _require_auth(request)
    db = get_supabase()
    _require_member(db, group_id, payload["sub"])

    group_r = db.table("group_chats").select("*").eq("id", group_id).execute()
    if not group_r.data:
        raise HTTPException(404, "Grupo no encontrado")

    members_r = db.table("group_members").select(
        "user_id, role, joined_at, users!group_members_user_id_fkey(id,first_name,last_name,profile_photo_url)"
    ).eq("group_id", group_id).execute()

    members = []
    for m in members_r.data:
        u = m.pop("users", {}) or {}
        members.append({
            "user_id":   m["user_id"],
            "role":      m["role"],
            "joined_at": m["joined_at"],
            "name":      f"{u.get('first_name','')} {u.get('last_name','')}".strip(),
            "avatar":    u.get("profile_photo_url"),
        })

    group = group_r.data[0]
    group["members"] = members
    return group


@router.get("/{group_id}/messages")
async def get_messages(
    group_id: str,
    request: Request,
    limit: int = Query(50, le=100),
    before: Optional[str] = Query(None),
):
    """Mensajes del grupo (paginación por cursor)."""
    payload = _require_auth(request)
    db = get_supabase()
    _require_member(db, group_id, payload["sub"])

    q = db.table("group_messages").select(
        "id,content,media_url,media_type,reply_to_id,created_at,sender_id,"
        "users!group_messages_sender_id_fkey(id,first_name,last_name,profile_photo_url)"
    ).eq("group_id", group_id).is_("deleted_at", "null")

    if before:
        q = q.lt("created_at", before)

    messages_r = q.order("created_at", desc=True).limit(limit).execute()

    messages = []
    for m in messages_r.data:
        sender = m.pop("users", {}) or {}
        messages.append({
            **m,
            "sender": {
                "id":     sender.get("id"),
                "name":   f"{sender.get('first_name','')} {sender.get('last_name','')}".strip(),
                "avatar": sender.get("profile_photo_url"),
            },
        })

    messages.reverse()  # Cronológico
    return {"messages": messages, "has_more": len(messages) == limit}


@router.post("/{group_id}/messages", status_code=201)
async def send_message(group_id: str, body: SendGroupMessageBody, request: Request):
    """Enviar un mensaje al grupo."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()
    _require_member(db, group_id, me)

    content = (body.content or "").strip()
    if not content and not body.media_url:
        raise HTTPException(400, "El mensaje no puede estar vacío")
    if len(content) > MAX_MSG_LEN:
        raise HTTPException(400, f"Mensaje demasiado largo (max {MAX_MSG_LEN} chars)")

    # Validar que reply_to_id pertenece al mismo grupo
    if body.reply_to_id:
        ref_r = db.table("group_messages").select("id").eq("id", body.reply_to_id).eq("group_id", group_id).maybe_single().execute()
        if not ref_r.data:
            raise HTTPException(400, "El mensaje citado no pertenece a este grupo")

    msg_r = db.table("group_messages").insert({
        "group_id":    group_id,
        "sender_id":   me,
        "content":     content or None,
        "media_url":   body.media_url,
        "media_type":  body.media_type,
        "reply_to_id": body.reply_to_id,
    }).execute()
    msg = msg_r.data[0]

    # Actualizar preview del grupo
    preview = content[:80] if content else f"[{body.media_type or 'media'}]"
    db.table("group_chats").update({
        "last_message_at":      datetime.now(timezone.utc).isoformat(),
        "last_message_preview": preview,
    }).eq("id", group_id).execute()

    me_data = db.table("users").select("first_name,last_name").eq("id", me).execute().data
    sender_name = f"{me_data[0]['first_name']} {me_data[0]['last_name']}" if me_data else "Alguien"

    msg["sender"] = {"id": me, "name": sender_name, "avatar": None}
    return msg


@router.post("/{group_id}/members")
async def add_member(group_id: str, request: Request):
    """Admin agrega un miembro al grupo. Body: { user_id }"""
    payload = _require_auth(request)
    db = get_supabase()
    _require_admin(db, group_id, payload["sub"])

    body = await request.json()
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPException(400, "user_id requerido")

    count_r = db.table("group_members").select("id", count="exact").eq("group_id", group_id).execute()
    if (count_r.count or 0) >= MAX_MEMBERS:
        raise HTTPException(400, f"El grupo ya tiene el máximo de {MAX_MEMBERS} miembros")

    try:
        db.table("group_members").insert({"group_id": group_id, "user_id": user_id, "role": "member"}).execute()
        db.table("group_chats").update({"member_count": (count_r.count or 0) + 1}).eq("id", group_id).execute()
    except Exception:
        raise HTTPException(409, "El usuario ya es miembro del grupo")

    return {"added": True, "user_id": user_id}


@router.delete("/{group_id}/members/{user_id}")
async def remove_member(group_id: str, user_id: str, request: Request):
    """Admin remueve un miembro (o el usuario se remueve a sí mismo)."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    if user_id != me:
        _require_admin(db, group_id, me)

    # Prevenir grupo sin admin: verificar si es el único admin antes de eliminar
    target_role_r = db.table("group_members").select("role").eq("group_id", group_id).eq("user_id", user_id).maybe_single().execute()
    if target_role_r.data and target_role_r.data.get("role") == "admin":
        admin_count_r = db.table("group_members").select("id", count="exact").eq("group_id", group_id).eq("role", "admin").execute()
        if (admin_count_r.count or 0) <= 1:
            if user_id == me:
                raise HTTPException(400, "Sos el único admin. Designá otro admin antes de salir del grupo.")
            else:
                raise HTTPException(400, "No podés remover al único admin del grupo.")

    db.table("group_members").delete().eq("group_id", group_id).eq("user_id", user_id).execute()
    count_r = db.table("group_members").select("id", count="exact").eq("group_id", group_id).execute()
    db.table("group_chats").update({"member_count": count_r.count or 0}).eq("id", group_id).execute()

    return {"removed": True}


@router.patch("/{group_id}")
async def update_group(group_id: str, body: UpdateGroupBody, request: Request):
    """Admin actualiza nombre o descripción del grupo."""
    payload = _require_auth(request)
    db = get_supabase()
    _require_admin(db, group_id, payload["sub"])

    update = {}
    if body.name is not None:
        name = body.name.strip()
        if not name or len(name) > MAX_NAME_LEN:
            raise HTTPException(400, "Nombre inválido")
        update["name"] = name
    if body.description is not None:
        update["description"] = body.description.strip() or None

    if not update:
        raise HTTPException(400, "Nada que actualizar")

    r = db.table("group_chats").update(update).eq("id", group_id).execute()
    return r.data[0]


@router.patch("/{group_id}/members/{user_id}/role")
async def set_member_role(group_id: str, user_id: str, request: Request):
    """Admin promueve o degrada a un miembro. Body: { role: 'admin'|'member' }"""
    payload = _require_auth(request)
    db = get_supabase()
    _require_admin(db, group_id, payload["sub"])

    body = await request.json()
    role = body.get("role")
    if role not in ("admin", "member"):
        raise HTTPException(400, "role debe ser 'admin' o 'member'")

    # No permitir degradarse a sí mismo si es el único admin
    if user_id == payload["sub"] and role == "member":
        admins = db.table("group_members").select("user_id").eq("group_id", group_id).eq("role", "admin").execute()
        if len(admins.data) <= 1:
            raise HTTPException(400, "No podés degradarte — sos el único admin. Asigná otro admin primero.")

    db.table("group_members").update({"role": role}).eq("group_id", group_id).eq("user_id", user_id).execute()
    return {"user_id": user_id, "role": role}


@router.delete("/{group_id}")
async def delete_group(group_id: str, request: Request):
    """Solo el creador original puede eliminar el grupo."""
    payload = _require_auth(request)
    db = get_supabase()
    group_r = db.table("group_chats").select("created_by").eq("id", group_id).execute()
    if not group_r.data:
        raise HTTPException(404, "Grupo no encontrado")
    if group_r.data[0]["created_by"] != payload["sub"]:
        raise HTTPException(403, "Solo el creador puede eliminar el grupo")
    db.table("group_chats").delete().eq("id", group_id).execute()
    return {"deleted": True}
