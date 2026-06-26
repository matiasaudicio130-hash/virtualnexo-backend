"""
Servicio de comentarios en posts.
- Threading (parent_id)
- El dueño del post puede borrar cualquier comentario
- El autor puede borrar su propio comentario
- Reportes de comentarios
"""
from datetime import datetime, timezone
from app.db.supabase import get_supabase
from app.services.notifications_service import create_notification


class CommentsService:

    def get_comments(self, post_id: str, viewer_id: str) -> list:
        db = get_supabase()
        r = db.table("post_comments").select(
            "id,content,is_deleted,parent_id,created_at,"
            "users!post_comments_user_id_fkey(id,first_name,last_name,profile_photo_url,profile_type)"
        ).eq("post_id", post_id).order("created_at").execute()

        comments = []
        for c in r.data:
            user = c.get("users") or {}
            comments.append({
                "id":         c["id"],
                "post_id":    post_id,
                "parent_id":  c.get("parent_id"),
                "content":    "[eliminado]" if c["is_deleted"] else c["content"],
                "is_deleted": c["is_deleted"],
                "created_at": c["created_at"],
                "author": {
                    "id":                user.get("id"),
                    "name":              f"{user.get('first_name','')} {user.get('last_name','')}".strip(),
                    "avatar":            user.get("profile_photo_url"),
                    "profile_type":      user.get("profile_type"),
                },
                "can_delete": c.get("user_id") == viewer_id,
            })
        return comments

    def add_comment(self, post_id: str, user_id: str, content: str, parent_id: str | None = None) -> dict:
        db = get_supabase()

        # Verificar que el post existe, está activo y es visible para el comentador
        post_r = db.table("posts").select("user_id,extra_data").eq("id", post_id).eq("status", "active").execute()
        if not post_r.data:
            raise ValueError("Post no encontrado")
        post_row = post_r.data[0]
        post_owner_id = post_row["user_id"]
        visibility = (post_row.get("extra_data") or {}).get("visibility", "public")
        if visibility == "only_me" and user_id != post_owner_id:
            raise ValueError("No se puede comentar un post privado")

        # Verificar que el post tiene comentarios habilitados
        # (si el owner deshabilitó comentarios)
        # Por ahora no hay campo de disable_comments, se puede agregar después

        result = db.table("post_comments").insert({
            "post_id":   post_id,
            "user_id":   user_id,
            "content":   content.strip(),
            "parent_id": parent_id,
        }).execute()

        comment = result.data[0]

        # Notificar al dueño del post (si no es el mismo que comenta)
        if post_owner_id != user_id:
            user_r = db.table("users").select("first_name").eq("id", user_id).execute()
            name = user_r.data[0]["first_name"] if user_r.data else "Alguien"
            create_notification(
                post_owner_id, "comment",
                f"{name} comentó en tu publicación",
                {"post_id": post_id, "comment_id": comment["id"]},
                actor_id=user_id,
            )

        # Si es reply, notificar al autor del comentario padre
        if parent_id and parent_id != user_id:
            parent_r = db.table("post_comments").select("user_id").eq("id", parent_id).execute()
            if parent_r.data:
                parent_owner = parent_r.data[0]["user_id"]
                if parent_owner != user_id and parent_owner != post_owner_id:
                    user_r = db.table("users").select("first_name").eq("id", user_id).execute()
                    name = user_r.data[0]["first_name"] if user_r.data else "Alguien"
                    create_notification(
                        parent_owner, "comment_reply",
                        f"{name} respondió tu comentario",
                        {"post_id": post_id, "comment_id": comment["id"]},
                        actor_id=user_id,
                    )

        return comment

    def delete_comment(self, comment_id: str, requester_id: str) -> dict:
        db = get_supabase()

        c_r = db.table("post_comments").select("user_id,post_id").eq("id", comment_id).execute()
        if not c_r.data:
            raise ValueError("Comentario no encontrado")

        c = c_r.data[0]

        # Verificar permisos: autor del comentario O dueño del post
        post_r = db.table("posts").select("user_id").eq("id", c["post_id"]).execute()
        post_owner = post_r.data[0]["user_id"] if post_r.data else None

        if c["user_id"] != requester_id and post_owner != requester_id:
            raise PermissionError("Sin permisos para eliminar este comentario")

        # Soft delete para preservar threading
        db.table("post_comments").update({
            "is_deleted": True,
            "content":    "[eliminado]",
        }).eq("id", comment_id).execute()

        return {"deleted": True}

    def report_comment(self, comment_id: str, reporter_id: str, reason: str) -> dict:
        from fastapi import HTTPException
        db = get_supabase()
        c_r = db.table("post_comments").select("user_id").eq("id", comment_id).maybe_single().execute()
        if c_r.data and c_r.data["user_id"] == reporter_id:
            raise HTTPException(400, "No podés reportar tu propio comentario")
        db.table("comment_reports").upsert({
            "comment_id":  comment_id,
            "reporter_id": reporter_id,
            "reason":      reason,
        }, on_conflict="comment_id,reporter_id").execute()
        return {"reported": True}


comments_service = CommentsService()
