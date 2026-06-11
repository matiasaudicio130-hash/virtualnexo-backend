"""
Analytics privados del creador — endpoint único que agrega todas las métricas
de rendimiento: vistas de perfil, seguidores, likes, comentarios, guardados,
posts más exitosos y evolución semanal.
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone, timedelta
from collections import defaultdict

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def analytics_overview(request: Request):
    """
    Devuelve métricas completas del creador autenticado.
    Una sola llamada — el frontend no necesita múltiples requests.
    """
    payload  = _require_auth(request)
    user_id  = payload["sub"]
    db       = get_supabase()
    now      = datetime.now(timezone.utc)
    d7       = (now - timedelta(days=7)).isoformat()
    d30      = (now - timedelta(days=30)).isoformat()

    # ── Vistas de perfil ─────────────────────────────────────────────────────
    try:
        views_7d_r  = db.table("profile_views").select("id", count="exact") \
                        .eq("viewed_id", user_id).gte("viewed_at", d7).execute()
        views_30d_r = db.table("profile_views").select("id", count="exact") \
                        .eq("viewed_id", user_id).gte("viewed_at", d30).execute()
        user_r = db.table("users").select("profile_views_count,current_streak") \
                   .eq("id", user_id).maybe_single().execute()
        u = user_r.data or {}
        views_7d    = views_7d_r.count  or 0
        views_30d   = views_30d_r.count or 0
        views_total = u.get("profile_views_count", 0)
    except Exception:
        views_7d = views_30d = views_total = 0
        u = {}

    # ── Seguidores ───────────────────────────────────────────────────────────
    try:
        followers_r    = db.table("user_follows").select("id", count="exact") \
                           .eq("following_id", user_id).execute()
        followers_7d_r = db.table("user_follows").select("id", count="exact") \
                           .eq("following_id", user_id).gte("created_at", d7).execute()
        followers_total = followers_r.count    or 0
        followers_7d    = followers_7d_r.count or 0
    except Exception:
        followers_total = followers_7d = 0

    # ── Posts del usuario ────────────────────────────────────────────────────
    try:
        posts_r = db.table("posts").select(
            "id, type, caption, media_url, media_urls, created_at"
        ).eq("user_id", user_id).eq("status", "active").neq("type", "story").execute()
        posts    = posts_r.data or []
        post_ids = [p["id"] for p in posts]
    except Exception:
        posts = post_ids = []

    posts_total = len(posts)

    # ── Reacciones recibidas ─────────────────────────────────────────────────
    reactions_by_post: dict = defaultdict(int)
    reactions_total = 0
    reactions_7d    = 0
    if post_ids:
        try:
            rxn_r = db.table("post_reactions").select("post_id, created_at") \
                      .in_("post_id", post_ids).execute()
            for r in rxn_r.data or []:
                reactions_by_post[r["post_id"]] += 1
                reactions_total += 1
                if r.get("created_at", "") >= d7:
                    reactions_7d += 1
        except Exception:
            pass

    # ── Comentarios recibidos ────────────────────────────────────────────────
    comments_by_post: dict = defaultdict(int)
    comments_total = 0
    comments_7d    = 0
    if post_ids:
        try:
            cmt_r = db.table("comments").select("post_id, created_at") \
                      .in_("post_id", post_ids).neq("user_id", user_id).execute()
            for c in cmt_r.data or []:
                comments_by_post[c["post_id"]] += 1
                comments_total += 1
                if c.get("created_at", "") >= d7:
                    comments_7d += 1
        except Exception:
            pass

    # ── Guardados recibidos ──────────────────────────────────────────────────
    saves_by_post: dict = defaultdict(int)
    saves_total = 0
    if post_ids:
        try:
            sav_r = db.table("post_saves").select("post_id").in_("post_id", post_ids).execute()
            for s in sav_r.data or []:
                saves_by_post[s["post_id"]] += 1
                saves_total += 1
        except Exception:
            pass

    # ── Top 6 posts por engagement ───────────────────────────────────────────
    def engagement(p: dict) -> int:
        pid = p["id"]
        return reactions_by_post[pid] + comments_by_post[pid] * 2 + saves_by_post[pid] * 3

    top_posts = sorted(posts, key=engagement, reverse=True)[:6]
    top_posts_out = []
    for p in top_posts:
        pid   = p["id"]
        thumb = p.get("media_url")
        if not thumb:
            mu = p.get("media_urls")
            if isinstance(mu, list) and mu:
                thumb = mu[0].get("url")
        top_posts_out.append({
            "id":        pid,
            "type":      p["type"],
            "caption":   (p.get("caption") or "")[:80],
            "thumb":     thumb,
            "reactions": reactions_by_post[pid],
            "comments":  comments_by_post[pid],
            "saves":     saves_by_post[pid],
            "score":     engagement(p),
        })

    # ── Evolución semanal de seguidores (últimas 7 semanas) ──────────────────
    weekly_followers = []
    try:
        for i in range(7, 0, -1):
            wk_start = (now - timedelta(weeks=i)).isoformat()
            wk_end   = (now - timedelta(weeks=i - 1)).isoformat()
            wk_r = db.table("user_follows").select("id", count="exact") \
                     .eq("following_id", user_id) \
                     .gte("created_at", wk_start) \
                     .lt("created_at", wk_end).execute()
            # Label: "S-6" para hace 6 semanas, "Esta" para la más reciente
            label = "Esta" if i == 1 else f"S-{i-1}"
            weekly_followers.append({"label": label, "count": wk_r.count or 0})
    except Exception:
        weekly_followers = []

    # ── Tasa de engagement ───────────────────────────────────────────────────
    engagement_rate = 0.0
    if followers_total > 0 and posts_total > 0:
        avg_engagement = (reactions_total + comments_total) / posts_total
        engagement_rate = round((avg_engagement / followers_total) * 100, 1)

    return {
        "profile": {
            "views_7d":        views_7d,
            "views_30d":       views_30d,
            "views_total":     views_total,
        },
        "followers": {
            "total":           followers_total,
            "gained_7d":       followers_7d,
            "weekly":          weekly_followers,
        },
        "posts": {
            "total":           posts_total,
        },
        "reactions": {
            "total":           reactions_total,
            "last_7d":         reactions_7d,
        },
        "comments": {
            "total":           comments_total,
            "last_7d":         comments_7d,
        },
        "saves": {
            "total":           saves_total,
        },
        "engagement_rate":     engagement_rate,
        "top_posts":           top_posts_out,
        "streak":              u.get("current_streak", 0),
    }
