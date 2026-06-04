"""
Sistema de badges / logros.
Los badges se computan dinámicamente desde los datos existentes — sin tabla nueva.
"""
from fastapi import APIRouter, HTTPException, Request

from app.core.security import decode_access_token
from app.db.supabase import get_supabase

router = APIRouter(prefix="/badges", tags=["badges"])

BADGE_DEFS = [
    {
        "id":          "verified",
        "label":       "Verificado",
        "description": "Identidad verificada con DNI y biometría real",
        "emoji":       "✓",
        "color":       "#C9A227",
        "tier":        "gold",
        "key":         "verified",
        "threshold":   1,
    },
    {
        "id":          "influencer",
        "label":       "Influencer",
        "description": "100 o más seguidores",
        "emoji":       "⭐",
        "color":       "#F59E0B",
        "tier":        "gold",
        "key":         "followers",
        "threshold":   100,
    },
    {
        "id":          "creator",
        "label":       "Creador",
        "description": "10 o más publicaciones",
        "emoji":       "📸",
        "color":       "#A78BFA",
        "tier":        "silver",
        "key":         "posts",
        "threshold":   10,
    },
    {
        "id":          "popular",
        "label":       "Popular",
        "description": "50 reacciones recibidas en total",
        "emoji":       "🔥",
        "color":       "#F87171",
        "tier":        "silver",
        "key":         "reactions",
        "threshold":   50,
    },
    {
        "id":          "communicator",
        "label":       "Comunicador",
        "description": "20 comentarios recibidos en publicaciones",
        "emoji":       "💬",
        "color":       "#60A5FA",
        "tier":        "bronze",
        "key":         "comments_received",
        "threshold":   20,
    },
    {
        "id":          "social",
        "label":       "Social",
        "description": "Seguí a 20 o más personas",
        "emoji":       "🤝",
        "color":       "#34D399",
        "tier":        "bronze",
        "key":         "following",
        "threshold":   20,
    },
    {
        "id":          "streak",
        "label":       "Constante",
        "description": "Racha activa de 7 días o más",
        "emoji":       "⚡",
        "color":       "#FCD34D",
        "tier":        "bronze",
        "key":         "streak",
        "threshold":   7,
    },
    {
        "id":          "gold_review",
        "label":       "Premiado",
        "description": "Medalla de oro en reseñas de la comunidad",
        "emoji":       "🥇",
        "color":       "#C9A227",
        "tier":        "gold",
        "key":         "gold_medal",
        "threshold":   1,
    },
    {
        "id":          "exclusive",
        "label":       "Exclusivo",
        "description": "Publicó contenido exclusivo en un álbum",
        "emoji":       "🔐",
        "color":       "#8B5CF6",
        "tier":        "bronze",
        "key":         "albums",
        "threshold":   1,
    },
    {
        "id":          "traveler",
        "label":       "Viajero",
        "description": "Activó el modo viaje al menos una vez",
        "emoji":       "🌍",
        "color":       "#34D399",
        "tier":        "bronze",
        "key":         "travel_mode",
        "threshold":   1,
    },
]


def _require_auth(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(401, "Token requerido")
    payload = decode_access_token(auth.split(" ")[1])
    if not payload:
        raise HTTPException(401, "Token inválido")
    return payload


@router.get("/{user_id}")
async def get_badges(user_id: str, request: Request):
    """Calcula los badges del usuario. Público para cualquier usuario autenticado."""
    _require_auth(request)
    db = get_supabase()

    # ── Recopilar stats en paralelo (secuencial por limitación del cliente sync) ──

    # Usuario base
    user_r = db.table("users").select(
        "id, status, current_streak, profile_extended"
    ).eq("id", user_id).maybe_single().execute()
    u = user_r.data or {}

    # Seguidores
    followers_r = db.table("user_follows").select("id", count="exact").eq("following_id", user_id).execute()

    # Siguiendo
    following_r = db.table("user_follows").select("id", count="exact").eq("follower_id", user_id).execute()

    # Posts activos (no stories)
    posts_r = db.table("posts").select("id").eq("user_id", user_id).eq("status", "active").neq("type", "story").execute()
    post_ids = [p["id"] for p in posts_r.data or []]

    # Reacciones recibidas
    reactions_count = 0
    if post_ids:
        rxn_r = db.table("post_reactions").select("id", count="exact").in_("post_id", post_ids).execute()
        reactions_count = rxn_r.count or 0

    # Comentarios recibidos (de otros)
    comments_count = 0
    if post_ids:
        cmt_r = db.table("comments").select("id", count="exact").in_("post_id", post_ids).neq("user_id", user_id).execute()
        comments_count = cmt_r.count or 0

    # Medalla en reseñas
    medal = "none"
    try:
        rev_r = db.table("review_stats").select("medal").eq("user_id", user_id).maybe_single().execute()
        medal = rev_r.data.get("medal", "none") if rev_r.data else "none"
    except Exception:
        pass

    # Álbumes públicos
    albums_r = db.table("albums").select("id", count="exact").eq("user_id", user_id).eq("is_private", False).execute()

    # Modo viaje (travel_plan)
    travel_r = db.table("travel_plans").select("id").eq("user_id", user_id).limit(1).execute()

    stats = {
        "verified":          1 if u.get("status") == "active" else 0,
        "followers":         followers_r.count or 0,
        "following":         following_r.count or 0,
        "posts":             len(post_ids),
        "reactions":         reactions_count,
        "comments_received": comments_count,
        "streak":            u.get("current_streak", 0) or 0,
        "gold_medal":        1 if medal == "gold" else 0,
        "albums":            albums_r.count or 0,
        "travel_mode":       1 if travel_r.data else 0,
    }

    badges = []
    for bd in BADGE_DEFS:
        val       = stats.get(bd["key"], 0)
        threshold = bd["threshold"]
        earned    = val >= threshold
        progress  = min(1.0, val / threshold) if threshold > 0 else 1.0
        badges.append({
            "id":          bd["id"],
            "label":       bd["label"],
            "description": bd["description"],
            "emoji":       bd["emoji"],
            "color":       bd["color"],
            "tier":        bd["tier"],
            "earned":      earned,
            "progress":    round(progress, 2),
            "value":       val,
            "threshold":   threshold,
        })

    earned_count = sum(1 for b in badges if b["earned"])
    return {
        "user_id":      user_id,
        "badges":       badges,
        "earned_count": earned_count,
        "total":        len(BADGE_DEFS),
    }
