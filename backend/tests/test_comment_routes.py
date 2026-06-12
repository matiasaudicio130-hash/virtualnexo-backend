"""
Tests para validación del router de comentarios.

BUGs que previenen:
- Comentario vacío o sólo espacios insertado en DB
- Comentario de 501+ chars que excede el límite
- Bypass de autenticación en endpoints de comentarios
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from app.core.security import create_access_token

client = TestClient(app, raise_server_exceptions=False)


def bearer(user_id: str = "user-test-1") -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user_id})}"}


class TestCommentValidation:

    def test_comentario_vacio_retorna_400(self):
        r = client.post(
            "/api/v1/comments/post/post-1",
            json={"content": ""},
            headers=bearer(),
        )
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "vac" in detail.lower()

    def test_comentario_solo_espacios_retorna_400(self):
        r = client.post(
            "/api/v1/comments/post/post-1",
            json={"content": "    "},
            headers=bearer(),
        )
        assert r.status_code == 400

    def test_comentario_mas_de_500_chars_retorna_400(self):
        r = client.post(
            "/api/v1/comments/post/post-1",
            json={"content": "x" * 501},
            headers=bearer(),
        )
        assert r.status_code == 400
        detail = r.json().get("detail", "")
        assert "500" in detail or "caract" in detail.lower()

    def test_exactamente_500_chars_no_es_rechazado_por_longitud(self):
        """El límite es > 500, no >= 500; 500 chars exactos debe pasar la validación de longitud."""
        with patch("app.routers.comments.comments_service") as mock_svc:
            mock_svc.add_comment.return_value = {
                "id": "cmt-1", "content": "x" * 500,
                "author": {"id": "user-1", "name": "Test", "avatar": None},
                "created_at": "2024-01-01T00:00:00Z",
                "parent_id": None,
                "can_delete": True,
                "is_deleted": False,
            }
            r = client.post(
                "/api/v1/comments/post/post-1",
                json={"content": "x" * 500},
                headers=bearer(),
            )
            # No debe ser rechazado por longitud (puede fallar por DB mock pero no por validación)
            assert r.status_code != 400 or "500" not in (r.json().get("detail") or "")

    def test_sin_token_retorna_401(self):
        r = client.post(
            "/api/v1/comments/post/post-1",
            json={"content": "Hola"},
        )
        assert r.status_code == 401

    def test_comentario_valido_llama_al_servicio(self):
        with patch("app.routers.comments.comments_service") as mock_svc:
            mock_svc.add_comment.return_value = {
                "id": "cmt-new", "content": "Qué buena foto!",
                "author": {"id": "user-1", "name": "Test", "avatar": None},
                "created_at": "2024-01-01T00:00:00Z",
                "parent_id": None,
                "can_delete": True,
                "is_deleted": False,
            }
            r = client.post(
                "/api/v1/comments/post/post-123",
                json={"content": "Qué buena foto!"},
                headers=bearer("user-1"),
            )
            mock_svc.add_comment.assert_called_once()
            call_args = mock_svc.add_comment.call_args
            assert call_args[0][2] == "Qué buena foto!"  # content en tercer arg

    def test_reply_pasa_parent_id_al_servicio(self):
        with patch("app.routers.comments.comments_service") as mock_svc:
            mock_svc.add_comment.return_value = {
                "id": "cmt-reply", "content": "Respuesta",
                "author": {"id": "user-1", "name": "Test", "avatar": None},
                "created_at": "2024-01-01T00:00:00Z",
                "parent_id": "parent-123",
                "can_delete": True,
                "is_deleted": False,
            }
            client.post(
                "/api/v1/comments/post/post-1",
                json={"content": "Respuesta", "parent_id": "parent-123"},
                headers=bearer(),
            )
            call_args = mock_svc.add_comment.call_args
            assert call_args[0][3] == "parent-123"  # parent_id en cuarto arg
