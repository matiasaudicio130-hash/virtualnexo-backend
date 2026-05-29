"""
Servicio del feed social.
- Filtra posts por distancia (Haversine), provincia o global.
- Excluye posts de usuarios shadow-banned (para otros usuarios).
- Excluye posts de usuarios con hide_from_solos=TRUE cuando el viewer es solo.
- Un shadow-banned ve todo normalmente (no sabe que está baneado).
- Los stories expiran a las 24h automáticamente.
"""
import math
from datetime import datetime, timezone, timedelta
from typing import Optional

from app.db.supabase import get_supabase
from app.services.notifications_service import create_notification
from app.utils.profile_constants import SOLO_TYPES, resolve_interested_types


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Distancia en km entre dos coordenadas (Haversine)."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    return R * 2 * math.asin(math.sqrt(a))


def _resolve_interested_types(interested_in: list[str]) -> set[str]:
    return resolve_interested_types(interested_in)


class FeedService:

    def _get_viewer_data(self, viewer_id: str) -> dict:
        db = get_supabase()
        r = db.table("users").select("profile_type,interested_in").eq("id", viewer_id).execute()
        return r.data[0] if r.data else {"profile_type": "solo_h", "interested_in": None}

    def get_feed(
        self,
        viewer_id: str,
        viewer_lat: Optional[float] = None,
        viewer_lng: Optional[float] = None,
        radius_km: int = 100,
        province: Optional[str] = None,
        post_type: Optional[str] = None,    # 'photo','text','story' o None=todos
        limit: int = 30,
        offset: int = 0,
    ) -> dict:
        """
        Devuelve posts del feed para el viewer.
        Aplica filtro de shadow ban: posts de shadow-banned no aparecen para otros.
        """
        db = get_supabase()

        # 1. Datos del viewer: tipo + lo que quiere ver
        viewer_data    = self._get_viewer_data(viewer_id)
        viewer_type    = viewer_data.get("profile_type", "solo_h")
        viewer_is_solo = viewer_type in SOLO_TYPES
        interested_in  = viewer_data.get("interested_in") or []

        # Tipos permitidos que el viewer quiere descubrir (None = sin filtro)
        allowed_types: Optional[set] = None
        if interested_in:
            allowed_types = _resolve_interested_types(interested_in)

        # IDs bloqueados en ambas direcciones — excluir del feed
        blocked_ids: set = set()
        try:
            block_r = db.table("user_blocks").select("blocker_id,blocked_id").or_(
                f"blocker_id.eq.{viewer_id},blocked_id.eq.{viewer_id}"
            ).execute()
            for b in block_r.data:
                other = b["blocked_id"] if b["blocker_id"] == viewer_id else b["blocker_id"]
                blocked_ids.add(other)
        except Exception:
            pass

        # 2. Query base — posts activos no expirados
        q = db.table("posts").select(
            "*, users!posts_user_id_fkey("
            "id,first_name,last_name,profile_photo_url,province,username,"
            "profile_type,is_shadow_banned,hide_from_solos,visible_to)"
        ).eq("status", "active")

        if post_type:
            q = q.eq("type", post_type)

        q = q.or_(f"expires_at.is.null,expires_at.gt.{datetime.now(timezone.utc).isoformat()}")

        if province and not (viewer_lat and viewer_lng):
            q = q.eq("province", province)

        q = q.order("created_at", desc=True).range(offset, offset + limit * 3 - 1)
        raw = q.execute().data

        # 3. Filtrado en Python (shadow ban, visible_to, interested_in, distancia)
        posts = []
        for p in raw:
            user = p.get("users") or {}
            uid  = user.get("id")
            author_type = user.get("profile_type", "solo_h")

            # El viewer siempre ve sus propios posts
            is_own = uid == viewer_id

            if not is_own:
                # Bloqueos mutuos
                if uid in blocked_ids:
                    continue

                # Shadow ban
                if user.get("is_shadow_banned"):
                    continue

                # ── visible_to: filtro granular del autor ──────────────
                # Sistema nuevo (visible_to array):
                author_visible_to = user.get("visible_to") or []
                if author_visible_to:
                    # Resolver categorías a tipos de perfil concretos
                    allowed_viewers = _resolve_interested_types(author_visible_to)
                    if viewer_type not in allowed_viewers:
                        continue
                elif user.get("hide_from_solos") and viewer_is_solo:
                    # Fallback legacy: hide_from_solos booleano
                    continue

                # ── interested_in: qué quiere ver el viewer ────────────
                if allowed_types and author_type not in allowed_types:
                    continue

            # Distancia
            dist_km = None
            if viewer_lat and viewer_lng and p.get("lat") and p.get("lng"):
                dist_km = round(_haversine_km(viewer_lat, viewer_lng, float(p["lat"]), float(p["lng"])), 1)
                if dist_km > radius_km:
                    continue

            posts.append({
                **p,
                "author": {
                    "id":           uid,
                    "name":         f"{user.get('first_name','')} {user.get('last_name','')}".strip(),
                    "username":     user.get('username'),
                    "avatar":       user.get("profile_photo_url"),
                    "province":     user.get("province"),
                    "profile_type": author_type,
                },
                "distance_km":   dist_km,
                "is_story":      p.get("type") == "story",
                "viewer_is_solo": viewer_is_solo,
            })

            if len(posts) >= limit:
                break

        # 4. Reacciones del viewer en estos posts
        post_ids = [p["id"] for p in posts]
        viewer_reactions: dict = {}
        if post_ids:
            rxn_r = db.table("post_reactions").select("post_id,type").eq("user_id", viewer_id).in_("post_id", post_ids).execute()
            viewer_reactions = {r["post_id"]: r["type"] for r in rxn_r.data}

        # 5. Conteo de reacciones por post
        reaction_counts: dict = {}
        if post_ids:
            for pid in post_ids:
                rc = db.table("post_reactions").select("type").eq("post_id", pid).execute()
                from collections import Counter
                cnt = Counter(r["type"] for r in rc.data)
                reaction_counts[pid] = dict(cnt)

        for p in posts:
            p["viewer_reaction"] = viewer_reactions.get(p["id"])
            p["reactions"] = reaction_counts.get(p["id"], {})

        self._refresh_signed_urls(posts, db)

        return {
            "posts":  posts,
            "total":  len(posts),
            "radius_km": radius_km if viewer_lat else None,
        }

    def get_stories(self, viewer_id: str, province: Optional[str] = None) -> list:
        """Stories activas (últimas 24h) de usuarios cercanos/provincia."""
        db = get_supabase()
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        q = db.table("posts").select(
            "id,user_id,media_url,storage_path,created_at,expires_at,extra_data,"
            "users!posts_user_id_fkey(id,first_name,last_name,profile_photo_url,username,is_shadow_banned)"
        ).eq("type", "story").eq("status", "active").gt("created_at", cutoff).order("created_at", desc=True)

        if province:
            q = q.eq("province", province)

        raw = q.execute().data

        banned_r = db.table("users").select("id").eq("is_shadow_banned", True).execute()
        banned_ids = {u["id"] for u in banned_r.data if u["id"] != viewer_id}

        # Batch: viewer's follows + viewer's partner_id
        follows_r = db.table("user_follows").select("following_id").eq("follower_id", viewer_id).execute()
        viewer_follows = {f["following_id"] for f in follows_r.data}

        # Batch: partner_id for each story author (for "partner" audience stories)
        author_ids = list({p["user_id"] for p in raw})
        author_ext_map: dict = {}
        if author_ids:
            ae_r = db.table("users").select("id,profile_extended").in_("id", author_ids).execute()
            author_ext_map = {
                row["id"]: (row.get("profile_extended") or {}).get("partner_id")
                for row in ae_r.data
            }

        stories_by_user: dict = {}
        for p in raw:
            user = p.get("users") or {}
            uid = user.get("id")
            if uid in banned_ids:
                continue

            # Audience gate (skip own stories)
            if uid != viewer_id:
                audience = (p.get("extra_data") or {}).get("audience", "all")
                if audience == "followers" and uid not in viewer_follows:
                    continue
                if audience == "partner":
                    # Visible only to the author's linked partner
                    if author_ext_map.get(uid) != viewer_id:
                        continue

            if uid not in stories_by_user:
                stories_by_user[uid] = {
                    "user_id":  uid,
                    "name":     f"{user.get('first_name','')} {user.get('last_name','')}".strip(),
                    "username": user.get("username"),
                    "avatar":   user.get("profile_photo_url"),
                    "stories":  [],
                }
            stories_by_user[uid]["stories"].append({
                "id":           p["id"],
                "media_url":    p["media_url"],
                "storage_path": p.get("storage_path"),
                "created_at":   p["created_at"],
                "audience":     (p.get("extra_data") or {}).get("audience", "all"),
            })

        # Refresh signed URLs para stories
        all_story_items = [s for u in stories_by_user.values() for s in u["stories"]]
        self._refresh_signed_urls(all_story_items, db)

        return list(stories_by_user.values())

    def _refresh_signed_urls(self, items: list, db) -> None:
        """Genera signed URLs frescas (24h) para items con storage_path."""
        paths = [item["storage_path"] for item in items if item.get("storage_path")]
        if not paths:
            return
        try:
            signed = db.storage.from_("media").create_signed_urls(paths, 86400)
            url_map = {
                r.get("path", "").lstrip("/"): (r.get("signedUrl") or r.get("signedURL", ""))
                for r in (signed or [])
            }
            for item in items:
                sp = item.get("storage_path", "")
                if sp and url_map.get(sp):
                    item["media_url"] = url_map[sp]
        except Exception:
            pass

    def create_post(
        self,
        user_id: str,
        post_type: str,
        caption: Optional[str] = None,
        media_url: Optional[str] = None,
        storage_path: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        city: Optional[str] = None,
        province: Optional[str] = None,
        is_story: bool = False,
        story_audience: str = "all",
    ) -> dict:
        db = get_supabase()
        expires_at = (
            (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat()
            if is_story else None
        )
        extra_data = {"audience": story_audience} if is_story else None
        result = db.table("posts").insert({
            "user_id":      user_id,
            "type":         "story" if is_story else post_type,
            "caption":      caption,
            "media_url":    media_url,
            "storage_path": storage_path,
            "lat":          lat,
            "lng":          lng,
            "city":         city,
            "province":     province,
            "expires_at":   expires_at,
            "extra_data":   extra_data,
            "status":       "active",
        }).execute()
        return result.data[0]

    def toggle_reaction(self, post_id: str, user_id: str, reaction_type: str) -> dict:
        """Toggle reacción: si ya existe la borra, si no la crea."""
        db = get_supabase()
        existing = db.table("post_reactions").select("id,type").eq("post_id", post_id).eq("user_id", user_id).execute()

        if existing.data:
            current = existing.data[0]
            if current["type"] == reaction_type:
                db.table("post_reactions").delete().eq("id", current["id"]).execute()
                return {"action": "removed", "type": reaction_type}
            else:
                db.table("post_reactions").update({"type": reaction_type}).eq("id", current["id"]).execute()
                return {"action": "changed", "type": reaction_type}
        else:
            db.table("post_reactions").insert({"post_id": post_id, "user_id": user_id, "type": reaction_type}).execute()
            # Notificar al autor del post (no al propio usuario)
            post_r = db.table("posts").select("user_id").eq("id", post_id).execute()
            if post_r.data and post_r.data[0]["user_id"] != user_id:
                emojis = {"fire": "🔥", "heart": "❤️", "star": "⭐"}
                create_notification(
                    user_id=post_r.data[0]["user_id"],
                    notif_type="new_reaction",
                    title="Nueva reacción",
                    body=f"Alguien reaccionó con {emojis.get(reaction_type, reaction_type)} a tu publicación",
                    data={"post_id": post_id, "reaction": reaction_type},
                )
            return {"action": "added", "type": reaction_type}

    def record_story_view(self, post_id: str, viewer_id: str) -> None:
        db = get_supabase()
        db.table("story_views").upsert({"post_id": post_id, "viewer_id": viewer_id}).execute()
        db.table("posts").update({"views_count": db.table("posts").select("views_count").eq("id", post_id).execute().data[0]["views_count"] + 1}).eq("id", post_id).execute()

    def delete_post(self, post_id: str, user_id: str) -> None:
        db = get_supabase()
        db.table("posts").update({"status": "deleted"}).eq("id", post_id).eq("user_id", user_id).execute()


feed_service = FeedService()
