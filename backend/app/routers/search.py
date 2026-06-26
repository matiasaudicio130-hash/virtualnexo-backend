from fastapi import APIRouter, HTTPException, Request, Query
from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/search", tags=["search"])


@router.get("/mentions")
async def mention_autocomplete(
    request: Request,
    q: str = Query(..., min_length=1, max_length=30),
    limit: int = Query(default=6, ge=1, le=15),
):
    """Autocompletado de @menciones: busca usuarios por username o nombre."""
    payload = _require_auth(request)
    viewer_id = payload["sub"]
    db = get_supabase()
    like = f"{q.lower()}%"

    try:
        r = db.table("users").select(
            "id, first_name, last_name, username, profile_photo_url"
        ).neq("id", viewer_id).eq("status", "active").or_(
            f"username.ilike.{like},first_name.ilike.{like}"
        ).limit(limit).execute()
        users = [
            {
                "id":       u["id"],
                "name":     f"{u.get('first_name','')} {u.get('last_name','')}".strip(),
                "username": u.get("username") or "",
                "avatar":   u.get("profile_photo_url"),
            }
            for u in r.data or []
            if u.get("username")  # solo usuarios con username configurado
        ]
    except Exception:
        users = []

    return users


@router.get("")
async def global_search(
    request: Request,
    q: str = Query(..., min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
):
    """
    Búsqueda global de usuarios y publicaciones.
    Requiere al menos 1 carácter. Devuelve hasta `limit` usuarios y `limit` posts.
    """
    payload = _require_auth(request)
    viewer_id = payload["sub"]
    db = get_supabase()

    term = q.strip()
    if not term:
        return {"users": [], "posts": []}

    # Escapar wildcards LIKE para evitar pattern injection
    term_safe = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    like = f"%{term_safe}%"

    # ── Usuarios ──────────────────────────────────────────────────────────────
    # Busca por nombre completo, username o provincia.
    # Excluye al propio viewer.
    try:
        user_q = (
            db.table("users")
            .select(
                "id, first_name, last_name, username, profile_photo_url, "
                "profile_type, province, is_shadow_banned"
            )
            .neq("id", viewer_id)
            .eq("status", "active")
            .or_(
                f"first_name.ilike.{like},"
                f"last_name.ilike.{like},"
                f"username.ilike.{like}"
            )
            .limit(limit)
            .execute()
        )
        raw_users = user_q.data or []
    except Exception:
        raw_users = []

    users = [
        {
            "id":                u["id"],
            "name":              f"{u.get('first_name','')} {u.get('last_name','')}".strip(),
            "username":          u.get("username") or "",
            "avatar":            u.get("profile_photo_url"),
            "profile_type":      u.get("profile_type"),
            "province":          u.get("province"),
        }
        for u in raw_users
        if not u.get("is_shadow_banned")
    ]

    # ── Posts ─────────────────────────────────────────────────────────────────
    # Busca en caption. Excluye stories y posts propios.
    try:
        post_q = (
            db.table("posts")
            .select(
                "id, user_id, type, caption, media_url, media_urls, created_at, "
                "users!posts_user_id_fkey(id, first_name, last_name, profile_photo_url, username)"
            )
            .neq("user_id", viewer_id)
            .eq("status", "active")
            .neq("type", "story")
            .ilike("caption", like)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        raw_posts = post_q.data or []
    except Exception:
        raw_posts = []

    posts = []
    for p in raw_posts:
        author = p.get("users") or {}
        # Thumbnail: first media_url or media_urls[0].url
        thumb = p.get("media_url")
        if not thumb:
            mu = p.get("media_urls")
            if isinstance(mu, list) and mu:
                thumb = mu[0].get("url")
        posts.append({
            "id":         p["id"],
            "type":       p["type"],
            "caption":    p.get("caption") or "",
            "thumb":      thumb,
            "media_urls": p.get("media_urls") or [],
            "created_at": p["created_at"],
            "author": {
                "id":     author.get("id"),
                "name":   f"{author.get('first_name','')} {author.get('last_name','')}".strip(),
                "username": author.get("username") or "",
                "avatar": author.get("profile_photo_url"),
            },
        })

    return {"users": users, "posts": posts, "query": term}
