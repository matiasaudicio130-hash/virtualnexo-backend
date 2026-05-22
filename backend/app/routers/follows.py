"""
Sistema de Follow/Followers.
Permite a los usuarios seguirse mutuamente, ver quién los sigue y a quién siguen.
"""
from fastapi import APIRouter, HTTPException, Request, Query
from app.core.security import decode_access_token
from app.db.supabase import get_supabase

router = APIRouter(prefix="/follows", tags=["follows"])


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


@router.post("/{user_id}", status_code=201)
async def follow_user(user_id: str, request: Request):
    """Seguir a un usuario. Idempotente."""
    payload = _require_auth(request)
    me = payload["sub"]
    if me == user_id:
        raise HTTPException(400, "No podés seguirte a vos mismo")

    db = get_supabase()
    # Verificar que el usuario existe y está activo
    target = db.table("users").select("id,status").eq("id", user_id).execute()
    if not target.data or target.data[0]["status"] != "active":
        raise HTTPException(404, "Usuario no encontrado")

    # Upsert — si ya existe no falla
    try:
        db.table("user_follows").insert({"follower_id": me, "following_id": user_id}).execute()
    except Exception:
        pass  # Ya existe — idempotente

    # Notificar al seguido
    try:
        me_data = db.table("users").select("first_name,last_name").eq("id", me).execute().data
        if me_data:
            name = f"{me_data[0]['first_name']} {me_data[0]['last_name']}"
            db.table("notifications").insert({
                "user_id": user_id,
                "type": "new_follower",
                "title": "Nuevo seguidor",
                "body": f"{name} empezó a seguirte",
                "data": {"follower_id": me},
            }).execute()
    except Exception:
        pass

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

    return {
        "i_follow":   bool(i_follow.data),
        "follows_me": bool(follows_me.data),
        "mutual":     bool(i_follow.data) and bool(follows_me.data),
    }


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
