"""
Servicio de mensajería directa.
Aplica filtros de:
  - no_messages_from: si el destinatario bloqueó el tipo de perfil del emisor
  - blocked_by_a/b: bloqueos manuales entre usuarios
  - visible_to: si el emisor no es visible para el destinatario, tampoco puede escribir
"""
from datetime import datetime, timezone
from typing import Optional

from app.db.supabase import get_supabase
from app.utils.profile_constants import ATTRACTION_MAP
from app.services.notifications_service import create_notification


def _resolve_blocked_types(categories: list[str]) -> set[str]:
    types: set[str] = set()
    for cat in categories:
        types |= ATTRACTION_MAP.get(cat, set())
    return types


class MessagingService:

    def _can_message(self, sender_id: str, recipient_id: str) -> tuple[bool, str]:
        """
        Verifica si sender puede enviar mensaje a recipient.
        Returns (allowed, reason).
        """
        db = get_supabase()
        users = db.table("users").select(
            "id,profile_type,no_messages_from,visible_to,is_shadow_banned,status"
        ).in_("id", [sender_id, recipient_id]).execute().data

        if len(users) < 2:
            return False, "Usuario no encontrado"

        sender    = next((u for u in users if u["id"] == sender_id), None)
        recipient = next((u for u in users if u["id"] == recipient_id), None)

        if not sender or not recipient:
            return False, "Usuario no encontrado"

        if recipient.get("status") != "active":
            return False, "El usuario no está activo"

        if recipient.get("is_shadow_banned"):
            return False, "No se puede contactar a este usuario"

        # Filtro no_messages_from
        no_msg = recipient.get("no_messages_from") or []
        if no_msg:
            blocked_types = _resolve_blocked_types(no_msg)
            sender_type   = sender.get("profile_type", "solo_h")
            if sender_type in blocked_types:
                return False, "Este usuario no acepta mensajes de tu tipo de perfil"

        # Filtro visible_to (si no me puede ver, no me puede escribir)
        visible_to = recipient.get("visible_to") or []
        if visible_to:
            allowed_viewer_types = set()
            for cat in visible_to:
                allowed_viewer_types |= ATTRACTION_MAP.get(cat, set())
            sender_type = sender.get("profile_type", "solo_h")
            if sender_type not in allowed_viewer_types:
                return False, "Este usuario no acepta mensajes de tu tipo de perfil"

        return True, "ok"

    def get_or_create_conversation(self, user_a: str, user_b: str) -> dict:
        """
        Obtiene o crea una conversación entre dos usuarios.
        Siempre almacena participant_a < participant_b (ordenado) para evitar duplicados
        con UNIQUE constraint.
        """
        db = get_supabase()

        # Normalizar orden para el UNIQUE constraint
        pa, pb = (user_a, user_b) if user_a < user_b else (user_b, user_a)

        existing = db.table("conversations").select("*").eq(
            "participant_a", pa
        ).eq("participant_b", pb).execute()

        if existing.data:
            return existing.data[0]

        result = db.table("conversations").insert({
            "participant_a": pa,
            "participant_b": pb,
        }).execute()
        return result.data[0]

    def send_message(
        self,
        sender_id: str,
        recipient_id: str,
        content: str,
        msg_type: str = "text",
        media_url: Optional[str] = None,
    ) -> dict:
        db = get_supabase()

        allowed, reason = self._can_message(sender_id, recipient_id)
        if not allowed:
            raise PermissionError(reason)

        conv = self.get_or_create_conversation(sender_id, recipient_id)
        conv_id = conv["id"]

        # Verificar bloqueos mutuos
        is_a = conv["participant_a"] == sender_id
        if (is_a and conv.get("blocked_by_b")) or (not is_a and conv.get("blocked_by_a")):
            raise PermissionError("Este usuario te tiene bloqueado")

        preview = (content or "")[:60]

        msg = db.table("messages").insert({
            "conversation_id": conv_id,
            "sender_id":       sender_id,
            "content":         content,
            "type":            msg_type,
            "media_url":       media_url,
        }).execute().data[0]

        # Actualizar preview de la conversación
        db.table("conversations").update({
            "last_message_at":      datetime.now(timezone.utc).isoformat(),
            "last_message_preview": preview,
            "last_sender_id":       sender_id,
        }).eq("id", conv_id).execute()

        # Crear notificación para el destinatario
        create_notification(
            user_id=recipient_id,
            notif_type="new_message",
            title="Nuevo mensaje",
            body=preview,
            data={"conversation_id": conv_id, "sender_id": sender_id},
        )

        return msg

    def get_conversations(self, user_id: str) -> list:
        db = get_supabase()
        convs = db.table("conversations").select(
            "*, "
            "user_a:users!conversations_participant_a_fkey(id,first_name,last_name,profile_photo_url,profile_type),"
            "user_b:users!conversations_participant_b_fkey(id,first_name,last_name,profile_photo_url,profile_type)"
        ).or_(
            f"participant_a.eq.{user_id},participant_b.eq.{user_id}"
        ).order("last_message_at", desc=True).execute().data

        # Determinar quién es el "otro" en cada conversación
        result = []
        for c in convs:
            is_a  = c["participant_a"] == user_id
            other = c.get("user_b") if is_a else c.get("user_a")
            blocked_me = c.get("blocked_by_b") if is_a else c.get("blocked_by_a")

            # Contar no leídos
            unread = db.table("messages").select("id").eq(
                "conversation_id", c["id"]
            ).neq("sender_id", user_id).is_("read_at", "null").execute().data

            result.append({
                "id":                   c["id"],
                "other_user":           other,
                "last_message_preview": c.get("last_message_preview"),
                "last_message_at":      c.get("last_message_at"),
                "last_sender_id":       c.get("last_sender_id"),
                "is_last_sender":       c.get("last_sender_id") == user_id,
                "unread_count":         len(unread),
                "blocked_me":           blocked_me,
            })

        return result

    def get_messages(self, conversation_id: str, user_id: str, limit: int = 50, offset: int = 0) -> list:
        db = get_supabase()

        # Verificar que el usuario es participante
        conv = db.table("conversations").select("participant_a,participant_b").eq(
            "id", conversation_id
        ).execute().data
        if not conv or user_id not in (conv[0]["participant_a"], conv[0]["participant_b"]):
            raise PermissionError("No tenés acceso a esta conversación")

        msgs = db.table("messages").select("*").eq(
            "conversation_id", conversation_id
        ).is_("deleted_at", "null").order(
            "created_at", desc=False
        ).range(offset, offset + limit - 1).execute().data

        # Marcar como leídos los mensajes del otro
        unread_ids = [m["id"] for m in msgs if m["sender_id"] != user_id and not m["read_at"]]
        if unread_ids:
            now = datetime.now(timezone.utc).isoformat()
            for mid in unread_ids:
                db.table("messages").update({"read_at": now}).eq("id", mid).execute()

        return msgs

    def block_user(self, requester_id: str, conversation_id: str) -> None:
        db = get_supabase()
        conv = db.table("conversations").select("*").eq("id", conversation_id).execute().data[0]
        is_a = conv["participant_a"] == requester_id
        db.table("conversations").update(
            {"blocked_by_a": True} if is_a else {"blocked_by_b": True}
        ).eq("id", conversation_id).execute()


messaging_service = MessagingService()
