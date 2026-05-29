"""
Servicio de perfiles públicos, likes, matches, vistas, bloqueos y reportes.
"""
from datetime import datetime, timezone
from app.db.supabase import get_supabase
from app.services.notifications_service import create_notification
from app.utils.profile_constants import ATTRACTION_MAP


def _resolve_viewer_category(viewer_type: str) -> str:
    """Devuelve la categoría de atracción que representa al viewer."""
    for cat, types in ATTRACTION_MAP.items():
        if viewer_type in types:
            return cat
    return viewer_type


class ProfileService:

    # ── Visitas ──────────────────────────────────────────────────
    def record_view(self, viewer_id: str, viewed_id: str) -> None:
        if viewer_id == viewed_id:
            return
        db = get_supabase()
        # Respetar modo anónimo del viewer (columna opcional)
        try:
            viewer_r = db.table("users").select("anonymous_mode").eq("id", viewer_id).execute()
            if viewer_r.data and viewer_r.data[0].get("anonymous_mode"):
                return
        except Exception:
            pass
        # Registrar visita (tabla puede no existir en entornos sin migración)
        try:
            db.table("profile_views").upsert(
                {"viewer_id": viewer_id, "viewed_id": viewed_id, "viewed_at": datetime.now(timezone.utc).isoformat()},
                on_conflict="viewer_id,viewed_id",
            ).execute()
        except Exception:
            pass
        # Push diario — máximo 1 por día por usuario
        try:
            from app.services.push_service import send_push
            today = datetime.now(timezone.utc).date().isoformat()
            already = db.table("notifications").select("id").eq("user_id", viewed_id).eq(
                "type", "profile_view_daily"
            ).gte("created_at", f"{today}T00:00:00+00:00").limit(1).execute()
            if not already.data:
                db.table("notifications").insert({
                    "user_id": viewed_id,
                    "type": "profile_view_daily",
                    "title": "Vieron tu perfil",
                    "body": "Alguien verificado vio tu perfil hoy.",
                    "data": {},
                }).execute()
                send_push(
                    user_id=viewed_id,
                    title="Vieron tu perfil",
                    body="Alguien verificado vio tu perfil hoy",
                    url="/dashboard",
                )
        except Exception:
            pass

    def get_viewers(self, user_id: str, limit: int = 50) -> list:
        db = get_supabase()
        r = db.table("profile_views").select(
            "viewed_at, users!profile_views_viewer_id_fkey(id,first_name,last_name,profile_photo_url,profile_type,province)"
        ).eq("viewed_id", user_id).order("viewed_at", desc=True).limit(limit).execute()
        return [
            {**row["users"], "viewed_at": row["viewed_at"]}
            for row in r.data if row.get("users")
        ]

    # ── Perfil público ──────────────────────────────────────────
    def get_public_profile(self, target_id: str, viewer_id: str) -> dict | None:
        db = get_supabase()

        # ¿El viewer bloqueó al target o viceversa? (tabla opcional)
        try:
            block = db.table("user_blocks").select("id,blocker_id").or_(
                f"and(blocker_id.eq.{viewer_id},blocked_id.eq.{target_id}),"
                f"and(blocker_id.eq.{target_id},blocked_id.eq.{viewer_id})"
            ).limit(1).execute()
            if block.data:
                i_blocked = block.data[0]["blocker_id"] == viewer_id
                return {"blocked": True, "i_blocked_them": i_blocked}
        except Exception:
            pass

        # Datos base del usuario — query core, si falla retornamos None
        r = db.table("users").select(
            "id,first_name,last_name,profile_photo_url,bio,province,city,"
            "profile_type,sexual_orientation,interested_in,visible_to,"
            "identity_description,profile_extended,membership_type"
        ).eq("id", target_id).eq("status", "active").execute()
        if not r.data:
            return None
        user = r.data[0]

        # Respetar visible_to (falla silenciosa = perfil visible)
        try:
            visible_to = user.get("visible_to") or []
            if visible_to and viewer_id != target_id:
                viewer_r = db.table("users").select("profile_type").eq("id", viewer_id).execute()
                viewer_type = viewer_r.data[0]["profile_type"] if viewer_r.data else "solo_h"
                viewer_cat  = _resolve_viewer_category(viewer_type)
                if viewer_cat not in visible_to:
                    return {"private": True}
        except Exception:
            pass

        # Posts recientes (falla silenciosa = lista vacía)
        posts: list = []
        try:
            posts_r = db.table("posts").select(
                "id,type,caption,media_url,storage_path,city,province,created_at,views_count"
            ).eq("user_id", target_id).eq("status", "active").neq("type", "story").order(
                "created_at", desc=True
            ).limit(12).execute()
            posts = posts_r.data
            self._refresh_urls(posts, db)
        except Exception:
            pass

        # Reseñas (falla silenciosa = lista vacía)
        reviews: list = []
        try:
            reviews_r = db.table("reviews").select(
                "id,rating,text,is_anonymous,created_at,"
                "users!reviews_reviewer_id_fkey(first_name,last_name,profile_photo_url)"
            ).eq("reviewed_id", target_id).order("created_at", desc=True).limit(10).execute()
            reviews = reviews_r.data
        except Exception:
            pass

        # Stats de reseñas (falla silenciosa = None)
        review_stats = None
        try:
            stats_r = db.table("review_stats").select("*").eq("user_id", target_id).execute()
            review_stats = stats_r.data[0] if stats_r.data else None
        except Exception:
            pass

        # Like del viewer (falla silenciosa = False)
        viewer_liked = False
        try:
            like_r = db.table("profile_likes").select("id").eq("user_id", viewer_id).eq("target_id", target_id).execute()
            viewer_liked = bool(like_r.data)
        except Exception:
            pass

        # Match existente (falla silenciosa = no match)
        matched = False
        match_at = None
        try:
            match_r = db.table("matches").select("id,created_at").or_(
                f"and(user_a_id.eq.{viewer_id},user_b_id.eq.{target_id}),"
                f"and(user_a_id.eq.{target_id},user_b_id.eq.{viewer_id})"
            ).limit(1).execute()
            matched  = bool(match_r.data)
            match_at = match_r.data[0]["created_at"] if match_r.data else None
        except Exception:
            pass

        return {
            **user,
            "posts":        posts,
            "reviews":      reviews,
            "review_stats": review_stats,
            "viewer_liked": viewer_liked,
            "matched":      matched,
            "match_at":     match_at,
        }

    def _refresh_urls(self, posts: list, db) -> None:
        paths = [p["storage_path"] for p in posts if p.get("storage_path")]
        if not paths:
            return
        try:
            signed = db.storage.from_("media").create_signed_urls(paths, 86400)
            url_map = {
                r.get("path", "").lstrip("/"): (r.get("signedUrl") or r.get("signedURL", ""))
                for r in (signed or [])
            }
            for p in posts:
                sp = p.get("storage_path", "")
                if sp and url_map.get(sp):
                    p["media_url"] = url_map[sp]
        except Exception:
            pass

    # ── Likes ────────────────────────────────────────────────────
    def toggle_like(self, user_id: str, target_id: str) -> dict:
        db = get_supabase()

        existing = db.table("profile_likes").select("id").eq("user_id", user_id).eq("target_id", target_id).execute()
        if existing.data:
            db.table("profile_likes").delete().eq("id", existing.data[0]["id"]).execute()
            # Eliminar match si existía
            db.table("matches").delete().or_(
                f"and(user_a_id.eq.{user_id},user_b_id.eq.{target_id}),"
                f"and(user_a_id.eq.{target_id},user_b_id.eq.{user_id})"
            ).execute()
            return {"liked": False, "matched": False}

        # Agregar like
        db.table("profile_likes").insert({"user_id": user_id, "target_id": target_id}).execute()

        # Verificar like mutuo → match
        mutual = db.table("profile_likes").select("id").eq("user_id", target_id).eq("target_id", user_id).execute()
        if mutual.data:
            # Crear match (evitar duplicados)
            a, b = sorted([user_id, target_id])
            existing_match = db.table("matches").select("id").eq("user_a_id", a).eq("user_b_id", b).execute()
            if not existing_match.data:
                db.table("matches").insert({"user_a_id": a, "user_b_id": b}).execute()
            # Notificaciones a ambos
            try:
                user_r = db.table("users").select("first_name").eq("id", user_id).execute()
                target_r = db.table("users").select("first_name").eq("id", target_id).execute()
                u_name = user_r.data[0]["first_name"] if user_r.data else "Alguien"
                t_name = target_r.data[0]["first_name"] if target_r.data else "Alguien"
                create_notification(user_id,   "match", f"¡Match con {t_name}!", {"matched_user_id": target_id})
                create_notification(target_id, "match", f"¡Match con {u_name}!", {"matched_user_id": user_id})
            except Exception:
                pass
            return {"liked": True, "matched": True}

        # Notificar al target que alguien le dio like
        try:
            user_r = db.table("users").select("first_name").eq("id", user_id).execute()
            u_name = user_r.data[0]["first_name"] if user_r.data else "Alguien"
            create_notification(target_id, "like", f"{u_name} le dio like a tu perfil", {"from_user_id": user_id})
        except Exception:
            pass

        return {"liked": True, "matched": False}

    # ── Matches ──────────────────────────────────────────────────
    def get_matches(self, user_id: str) -> list:
        db = get_supabase()
        r = db.table("matches").select(
            "id,created_at,"
            "user_a:users!matches_user_a_id_fkey(id,first_name,last_name,profile_photo_url,profile_type,province),"
            "user_b:users!matches_user_b_id_fkey(id,first_name,last_name,profile_photo_url,profile_type,province)"
        ).or_(f"user_a_id.eq.{user_id},user_b_id.eq.{user_id}").order("created_at", desc=True).execute()

        result = []
        for row in r.data:
            other = row["user_b"] if row["user_a"]["id"] == user_id else row["user_a"]
            if other:
                result.append({**other, "match_id": row["id"], "matched_at": row["created_at"]})
        return result

    # ── Bloqueos ─────────────────────────────────────────────────
    def toggle_block(self, blocker_id: str, blocked_id: str) -> dict:
        db = get_supabase()
        existing = db.table("user_blocks").select("id").eq("blocker_id", blocker_id).eq("blocked_id", blocked_id).execute()
        if existing.data:
            db.table("user_blocks").delete().eq("id", existing.data[0]["id"]).execute()
            return {"blocked": False}
        db.table("user_blocks").insert({"blocker_id": blocker_id, "blocked_id": blocked_id}).execute()
        return {"blocked": True}

    def get_blocked_ids(self, user_id: str) -> set:
        db = get_supabase()
        r = db.table("user_blocks").select("blocked_id,blocker_id").or_(
            f"blocker_id.eq.{user_id},blocked_id.eq.{user_id}"
        ).execute()
        ids = set()
        for row in r.data:
            other = row["blocked_id"] if row["blocker_id"] == user_id else row["blocker_id"]
            ids.add(other)
        return ids

    # ── Reportes ─────────────────────────────────────────────────
    def report_user(self, reporter_id: str, reported_id: str, reason: str, details: str = "") -> dict:
        db = get_supabase()
        db.table("user_reports").insert({
            "reporter_id": reporter_id,
            "reported_id": reported_id,
            "reason":      reason,
            "details":     details or None,
        }).execute()
        return {"reported": True}


profile_service = ProfileService()
