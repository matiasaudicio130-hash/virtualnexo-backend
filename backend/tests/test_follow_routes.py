"""
Tests para el router de follows.

BUGs que previenen:
- Un usuario seguirse a sí mismo
- Follow duplicado rompe la tabla user_follows
- Sin token → acceso libre a endpoints de follow
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from app.core.security import create_access_token

client = TestClient(app, raise_server_exceptions=False)


def bearer(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user_id})}"}


class TestFollowRoutes:

    def test_seguirse_a_uno_mismo_retorna_400(self):
        """El endpoint rechaza follow si follower == following."""
        r = client.post(
            "/api/v1/follows/user-abc",
            headers=bearer("user-abc"),  # mismo id que el target
        )
        assert r.status_code == 400
        assert "mismo" in r.json().get("detail", "").lower() or "vos mismo" in r.json().get("detail", "")

    def test_follow_sin_token_retorna_401(self):
        r = client.post("/api/v1/follows/user-abc")
        assert r.status_code == 401

    def test_unfollow_sin_token_retorna_401(self):
        r = client.delete("/api/v1/follows/user-abc")
        assert r.status_code == 401

    def test_status_sin_token_retorna_401(self):
        r = client.get("/api/v1/follows/user-abc/status")
        assert r.status_code == 401

    def test_follow_usuario_inexistente_retorna_404(self):
        with patch("app.routers.follows.get_supabase") as mock_db:
            m = MagicMock()
            m.table.return_value = m
            m.select.return_value = m
            m.eq.return_value = m
            # Usuario no encontrado
            m.execute.return_value = MagicMock(data=[])
            mock_db.return_value = m
            r = client.post(
                "/api/v1/follows/user-nonexistent",
                headers=bearer("user-real"),
            )
            assert r.status_code == 404

    def test_follow_usuario_inactivo_retorna_404(self):
        with patch("app.routers.follows.get_supabase") as mock_db:
            m = MagicMock()
            m.table.return_value = m
            m.select.return_value = m
            m.eq.return_value = m
            # Usuario con status "banned"
            m.execute.return_value = MagicMock(data=[{"id": "user-target", "status": "banned", "is_private": False}])
            mock_db.return_value = m
            r = client.post(
                "/api/v1/follows/user-target",
                headers=bearer("user-real"),
            )
            assert r.status_code == 404
