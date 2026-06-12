"""
Tests para la lógica de agrupado de notificaciones de mensajes.

BUG original: cada mensaje de un mismo remitente creaba una notificación
nueva, resultando en 10+ notificaciones en el panel del usuario.

FIX: create_notification busca si hay una notificación no leída del mismo
sender y la actualiza en lugar de insertar una nueva.
"""
import pytest
from unittest.mock import MagicMock, patch, call
from tests.conftest import make_supabase_mock


def _patch_and_call(db, **kwargs):
    """Helper: parchea get_supabase y llama create_notification."""
    with patch("app.services.notifications_service.get_supabase", return_value=db):
        from app.services.notifications_service import create_notification
        create_notification(**kwargs)


class TestNotificationGrouping:

    def test_primer_mensaje_inserta_notificacion_nueva(self):
        """Cuando no hay notificación existente, se inserta una nueva."""
        db = make_supabase_mock(notifications_data=[], users_data=[
            {"first_name": "Ana", "last_name": "García", "profile_photo_url": "url"}
        ])
        _patch_and_call(db,
            user_id="recipient-1",
            notif_type="new_message",
            title="Nuevo mensaje",
            body="Hola!",
            data={"conversation_id": "conv-1", "sender_id": "sender-1"},
            actor_id="sender-1",
        )

        notif_table = db.table("notifications")
        notif_table.insert.assert_called_once()
        notif_table.update.assert_not_called()

    def test_segundo_mensaje_del_mismo_sender_actualiza_existente(self):
        """Si ya hay notificación no leída del mismo sender, se actualiza."""
        existing = [{
            "id": "notif-existing",
            "data": {"sender_id": "sender-1", "msg_count": 1, "actor_name": "Ana García"},
        }]
        db = make_supabase_mock(notifications_data=existing, users_data=[
            {"first_name": "Ana", "last_name": "García", "profile_photo_url": "url"}
        ])
        _patch_and_call(db,
            user_id="recipient-1",
            notif_type="new_message",
            title="Nuevo mensaje",
            body="Como estás?",
            data={"conversation_id": "conv-1", "sender_id": "sender-1"},
            actor_id="sender-1",
        )

        notif_table = db.table("notifications")
        notif_table.update.assert_called_once()
        notif_table.insert.assert_not_called()

        # El update debe incluir el contador incrementado
        update_call_args = notif_table.update.call_args[0][0]
        assert update_call_args["data"]["msg_count"] == 2
        assert "Ana García te mandó 2 mensajes" in update_call_args["title"]

    def test_titulo_refleja_contador_correcto(self):
        """Con 5 mensajes previos, el título debe decir 'te mandó 6 mensajes'."""
        existing = [{
            "id": "notif-x",
            "data": {"sender_id": "sender-1", "msg_count": 5, "actor_name": "Carlos"},
        }]
        db = make_supabase_mock(notifications_data=existing, users_data=[
            {"first_name": "Carlos", "last_name": "Pérez", "profile_photo_url": ""}
        ])
        _patch_and_call(db,
            user_id="recipient-1",
            notif_type="new_message",
            title="Nuevo mensaje",
            body="Séptimo intento",
            data={"conversation_id": "conv-2", "sender_id": "sender-1"},
            actor_id="sender-1",
        )

        update_args = db.table("notifications").update.call_args[0][0]
        assert update_args["data"]["msg_count"] == 6
        assert "6 mensajes" in update_args["title"]

    def test_sender_distinto_crea_notificacion_nueva(self):
        """Notificaciones de senders distintos NO se agrupan entre sí."""
        # Hay una notif de sender-A, llega un msj de sender-B
        existing = [{
            "id": "notif-a",
            "data": {"sender_id": "sender-A", "msg_count": 1, "actor_name": "Ana"},
        }]
        db = make_supabase_mock(notifications_data=existing, users_data=[
            {"first_name": "Bruno", "last_name": "López", "profile_photo_url": ""}
        ])
        _patch_and_call(db,
            user_id="recipient-1",
            notif_type="new_message",
            title="Nuevo mensaje",
            body="Hola de Bruno",
            data={"conversation_id": "conv-b", "sender_id": "sender-B"},
            actor_id="sender-B",
        )

        notif_table = db.table("notifications")
        notif_table.insert.assert_called_once()
        notif_table.update.assert_not_called()

    def test_notificaciones_no_message_no_se_agrupan(self):
        """El agrupado sólo aplica a new_message, no a new_reaction etc."""
        db = make_supabase_mock(notifications_data=[], users_data=[
            {"first_name": "Diana", "last_name": "Torres", "profile_photo_url": ""}
        ])
        _patch_and_call(db,
            user_id="recipient-1",
            notif_type="new_reaction",
            title="Nueva reacción",
            body="",
            data={"post_id": "post-1"},
            actor_id="actor-1",
        )

        notif_table = db.table("notifications")
        notif_table.insert.assert_called_once()
        # No debe haber intentado buscar notificaciones previas para agrupar
        notif_table.update.assert_not_called()
