"""
Sistema de Follow/Followers.
Permite a los usuarios seguirse mutuamente, ver quién los sigue y a quién siguen.
"""
from fastapi import APIRouter, HTTPException, Request, Query
from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/follows", tags=["follows"])


@router.post("/{user_id}", status_code=201)
async def follow_user(user_id: str, request: Request):
    """Seguir a un usuario. Si la cuenta es privada, crea una solicitud pendiente. Idempotente."""
    payload = _require_auth(request)
    me = payload["sub"]
    if me == user_id:
        raise HTTPException(400, "No podés seguirte a vos mismo")

    db = get_supabase()
    # Verificar que el usuario existe y está activo
    target = db.table("users").select("id,status,is_private,first_name,last_name,username,profile_photo_url").eq("id", user_id).execute()
    if not target.data or target.data[0]["status"] != "active":
        raise HTTPException(404, "Usuario no encontrado")
    target_user = target.data[0]

    # Cuenta privada y todavía no la sigo → crear solicitud pendiente
    if target_user.get("is_private"):
        existing = db.table("user_follows").select("id").eq("follower_id", me).eq("following_id", user_id).execute()
        if not existing.data:
            try:
                db.table("follow_requests").insert({"requester_id": me, "target_id": user_id, "status": "pending"}).execute()
            except Exception:
                pass  # Ya existe — idempotente

            try:
                me_data = db.table("users").select("first_name,last_name,username,profile_photo_url").eq("id", me).execute().data
                if me_data:
                    u = me_data[0]
                    handle = u.get("username") or u["first_name"]
                    name = f"@{handle}" if u.get("username") else u["first_name"]
                    from app.services.notifications_service import create_notification
                    create_notification(
                        user_id=user_id,
                        notif_type="follow_request",
                        title="Solicitud de seguimiento",
                        body=f"{name} quiere seguirte",
                        data={
                            "requester_id": me,
                            "actor_name":   f"{u['first_name']} {u['last_name']}".strip(),
                            "actor_avatar": u.get("profile_photo_url") or "",
                        },
                    )
                    from app.services.push_service import send_push
                    send_push(
                        user_id=user_id,
                        title="Solicitud de seguimiento",
                        body=f"{name} quiere seguirte",
                        url="/notifications",
                    )
            except Exception:
                pass

            return {"requested": True, "following": False, "following_id": user_id}

    # Upsert — si ya existe no falla
    try:
        db.table("user_follows").insert({"follower_id": me, "following_id": user_id}).execute()
    except Exception:
        pass  # Ya existe — idempotente

    # Notificar al seguido
    try:
        me_data = db.table("users").select("first_name,last_name,username,profile_photo_url").eq("id", me).execute().data
        if me_data:
            u = me_data[0]
            handle = u.get("username") or u["first_name"]
            name = f"@{handle}" if u.get("username") else u["first_name"]
            from app.services.notifications_service import create_notification
            create_notification(
                user_id=user_id,
                notif_type="new_follower",
                title="Nuevo seguidor",
                body=f"{name} empezó a seguirte",
                data={
                    "follower_id":   me,
                    "actor_name":    f"{u['first_name']} {u['last_name']}".strip(),
                    "actor_avatar":  u.get("profile_photo_url") or "",
                },
            )
            from app.services.push_service import send_push
            send_push(
                user_id=user_id,
                title="Nuevo seguidor",
                body=f"{name} empezó a seguirte",
                url=f"/profile/{me}",
            )
    except Exception:
        pass

    # ── Detección de mutual follow → mensaje de compatibilidad ──
    try:
        other_follows_me = db.table("user_follows").select("id").eq(
            "follower_id", user_id
        ).eq("following_id", me).execute()

        if other_follows_me.data:
            # Mutual follow detectado — crear conversación y enviar icebreaker
            from app.services.messaging_service import messaging_service
            conv = messaging_service.get_or_create_conversation(me, user_id)
            conv_id = conv["id"]

            # Verificar que no se haya enviado ya el icebreaker
            existing_ice = db.table("messages").select("id").eq(
                "conversation_id", conv_id
            ).eq("type", "system").eq("sender_id", "system").execute()

            if not existing_ice.data:
                me_data    = db.table("users").select("first_name").eq("id", me).execute().data
                other_data = db.table("users").select("first_name").eq(
                    "id", user_id
                ).execute().data

                name_a = me_data[0]["first_name"] if me_data else "Alguien"
                name_b = other_data[0]["first_name"] if other_data else "Alguien"

                icebreaker = (
                    f"✦ {name_a} y {name_b} se siguen mutuamente ✦\n\n"
                    "Para romper el hielo, 3 preguntas rápidas:\n\n"
                    "1. ¿Qué te llamó la atención del perfil de la otra persona?\n"
                    "2. ¿Qué estás buscando en este momento?\n"
                    "3. ¿Preferís un chat primero o ir directo al grano?"
                )
                db.table("messages").insert({
                    "conversation_id": conv_id,
                    "sender_id":       "system",
                    "content":         icebreaker,
                    "type":            "system",
                }).execute()

                # Notificar a ambos del mutual follow
                from app.services.notifications_service import create_notification
                create_notification(
                    user_id=user_id,
                    notif_type="match",
                    title="¡Conexión mutua!",
                    body=f"Vos y {name_a} se siguen mutuamente",
                    data={"follower_id": me, "actor_name": name_a},
                )
    except Exception:
        pass  # El follow ya se insertó — el icebreaker es best-effort

    return {"following": True, "following_id": user_id}


@router.delete("/{user_id}")
async def unfollow_user(user_id: str, request: Request):
    """Dejar de seguir a un usuario."""
    payload = _require_auth(request)
    db = get_supabase()
    db.table("user_follows").delete().eq("follower_id", payload["sub"]).eq("following_id", user_id).execute()
    return {"following": False, "following_id": user_id}


@router.get("/{user_id}/status")
async def follow_status(user_id: str, request: Request):
    """¿Sigo a este usuario? ¿Me sigue?"""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    i_follow = db.table("user_follows").select("id").eq("follower_id", me).eq("following_id", user_id).execute()
    follows_me = db.table("user_follows").select("id").eq("follower_id", user_id).eq("following_id", me).execute()

    request_pending = False
    if not i_follow.data:
        req = db.table("follow_requests").select("id").eq("requester_id", me).eq("target_id", user_id).eq("status", "pending").execute()
        request_pending = bool(req.data)

    return {
        "i_follow":        bool(i_follow.data),
        "follows_me":      bool(follows_me.data),
        "mutual":          bool(i_follow.data) and bool(follows_me.data),
        "request_pending": request_pending,
    }


@router.get("/requests")
async def get_follow_requests(request: Request):
    """Solicitudes de follow pendientes recibidas."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    result = db.table("follow_requests").select(
        "id,requester_id,created_at,"
        "users!follow_requests_requester_id_fkey(id,first_name,last_name,profile_photo_url,province)"
    ).eq("target_id", me).eq("status", "pending").order("created_at", desc=True).execute()

    requests_list = []
    for r in result.data:
        u = r.pop("users", None) or {}
        requests_list.append({**r, "requester": u})

    return {"requests": requests_list, "total": len(requests_list)}


@router.post("/requests/{requester_id}/accept")
async def accept_follow_request(requester_id: str, request: Request):
    """Aceptar una solicitud de follow pendiente: crea el follow y borra la solicitud."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    req = db.table("follow_requests").select("id").eq("requester_id", requester_id).eq("target_id", me).eq("status", "pending").execute()
    if not req.data:
        raise HTTPException(404, "Solicitud no encontrada")

    try:
        db.table("user_follows").insert({"follower_id": requester_id, "following_id": me}).execute()
    except Exception:
        pass  # Ya existe — idempotente

    db.table("follow_requests").delete().eq("id", req.data[0]["id"]).execute()

    try:
        me_data = db.table("users").select("first_name,last_name,username,profile_photo_url").eq("id", me).execute().data
        if me_data:
            u = me_data[0]
            handle = u.get("username") or u["first_name"]
            name = f"@{handle}" if u.get("username") else u["first_name"]
            from app.services.notifications_service import create_notification
            create_notification(
                user_id=requester_id,
                notif_type="follow_request_accepted",
                title="Solicitud aceptada",
                body=f"{name} aceptó tu solicitud de seguimiento",
                data={
                    "target_id":   me,
                    "actor_name":  f"{u['first_name']} {u['last_name']}".strip(),
                    "actor_avatar": u.get("profile_photo_url") or "",
                },
            )
            from app.services.push_service import send_push
            send_push(
                user_id=requester_id,
                title="Solicitud aceptada",
                body=f"{name} aceptó tu solicitud de seguimiento",
                url=f"/profile/{me}",
            )
    except Exception:
        pass

    return {"accepted": True, "requester_id": requester_id}


@router.post("/requests/{requester_id}/reject")
async def reject_follow_request(requester_id: str, request: Request):
    """Rechazar una solicitud de follow pendiente."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    db.table("follow_requests").delete().eq("requester_id", requester_id).eq("target_id", me).eq("status", "pending").execute()
    return {"rejected": True, "requester_id": requester_id}


@router.get("/{user_id}/followers")
async def get_followers(
    user_id: str,
    request: Request,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Lista de usuarios que siguen a user_id."""
    _require_auth(request)
    db = get_supabase()
    result = db.table("user_follows").select(
        "follower_id, users!user_follows_follower_id_fkey(id,first_name,last_name,profile_photo_url,province)"
    ).eq("following_id", user_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    followers = [r["users"] for r in result.data if r.get("users")]
    total_r = db.table("user_follows").select("id", count="exact").eq("following_id", user_id).execute()
    return {"followers": followers, "total": total_r.count or len(followers)}


@router.get("/{user_id}/following")
async def get_following(
    user_id: str,
    request: Request,
    limit: int = Query(50, le=100),
    offset: int = Query(0, ge=0),
):
    """Lista de usuarios a los que sigue user_id."""
    _require_auth(request)
    db = get_supabase()
    result = db.table("user_follows").select(
        "following_id, users!user_follows_following_id_fkey(id,first_name,last_name,profile_photo_url,province)"
    ).eq("follower_id", user_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    following = [r["users"] for r in result.data if r.get("users")]
    total_r = db.table("user_follows").select("id", count="exact").eq("follower_id", user_id).execute()
    return {"following": following, "total": total_r.count or len(following)}


@router.get("/me/feed")
async def following_feed(
    request: Request,
    limit: int = Query(30, le=50),
    offset: int = Query(0, ge=0),
):
    """Feed filtrado: solo posts de personas que sigo."""
    payload = _require_auth(request)
    me = payload["sub"]
    db = get_supabase()

    # IDs de usuarios que sigo
    follows_r = db.table("user_follows").select("following_id").eq("follower_id", me).execute()
    ids = [f["following_id"] for f in follows_r.data]

    if not ids:
        return {"posts": [], "total": 0}

    result = db.table("posts").select(
        "id,type,caption,media_url,media_urls,storage_path,city,province,created_at,views_count,save_count,share_count,extra_data,"
        "users!posts_user_id_fkey(id,first_name,last_name,profile_photo_url,province)"
    ).in_("user_id", ids).eq("status", "active").order("created_at", desc=True).range(offset, offset + limit - 1).execute()

    posts = []
    for p in result.data:
        author = p.pop("users", {}) or {}
        posts.append({
            **p,
            "author": {
                "id":     author.get("id", ""),
                "name":   f"{author.get('first_name','')} {author.get('last_name','')}".strip(),
                "avatar": author.get("profile_photo_url"),
                "province": author.get("province"),
            },
            "reactions": {},
        })

    return {"posts": posts, "total": len(posts)}
