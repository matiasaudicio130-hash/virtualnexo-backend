"""
Sistema de hashtags: trending + feed por tag.
No requiere cambios de esquema — extrae #tags de captions existentes.
"""
import re
from fastapi import APIRouter, HTTPException, Request, Query
from datetime import datetime, timezone, timedelta

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/hashtags", tags=["hashtags"])

# Acepta letras (incluye tildes y ñ), números y guión bajo
_HASHTAG_RE = re.compile(r"#([A-Za-z0-9À-ɏ_]{1,50})")


def extract_hashtags(text: str) -> list[str]:
    """Devuelve lista de hashtags en minúsculas sin el #."""
    return [m.lower() for m in _HASHTAG_RE.findall(text or "")]


@router.get("/trending")
async def trending_hashtags(
    request:   Request,
    days:      int = Query(default=7,  ge=1, le=30),
    limit:     int = Query(default=20, ge=1, le=50),
):
    """
    Top hashtags usados en los últimos N días.
    Escanea captions de posts recientes (máx 1000) y cuenta ocurrencias.
    """
    _require_auth(request)
    db   = get_supabase()
    from_dt = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

    posts_r = (
        db.table("posts")
        .select("caption")
        .eq("status", "active")
        .neq("type", "story")
        .gte("created_at", from_dt)
        .limit(1000)
        .execute()
    )

    counts: dict[str, int] = {}
    for p in posts_r.data or []:
        for tag in extract_hashtags(p.get("caption") or ""):
            counts[tag] = counts.get(tag, 0) + 1

    trending = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:limit]
    return [{"tag": tag, "count": cnt} for tag, cnt in trending]


@router.get("/{tag}/posts")
async def posts_by_hashtag(
    tag:    str,
    request: Request,
    limit:   int = Query(default=24, ge=1, le=50),
    offset:  int = Query(default=0,  ge=0),
):
    """Posts activos que contienen el hashtag (búsqueda por caption ILIKE)."""
    _require_auth(request)
    db  = get_supabase()
    tag_clean = tag.lstrip("#").lower()

    if not tag_clean:
        raise HTTPException(400, "Tag inválido")

    posts_r = (
        db.table("posts")
        .select(
            "id, type, caption, media_url, media_urls, created_at, "
            "users!posts_user_id_fkey(id, first_name, last_name, profile_photo_url, username)"
        )
        .eq("status", "active")
        .neq("type", "story")
        .ilike("caption", f"%#{tag_clean}%")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
        .execute()
    )

    posts = []
    for p in posts_r.data or []:
        author = p.get("users") or {}
        thumb  = p.get("media_url")
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
                "id":       author.get("id"),
                "name":     f"{author.get('first_name','')} {author.get('last_name','')}".strip(),
                "username": author.get("username") or "",
                "avatar":   author.get("profile_photo_url"),
            },
        })

    return {
        "tag":      tag_clean,
        "posts":    posts,
        "has_more": len(posts) == limit,
    }
