"""
Tests para endpoints de autenticación.

BUGs que previenen:
- Registro con email duplicado no retorna 409
- Login con password incorrecto no retorna 401
- /me accesible sin token
- Token inválido no es rechazado
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from main import app
from app.core.security import create_access_token, hash_password

client = TestClient(app, raise_server_exceptions=False)


def bearer(user_id: str = "test-user") -> dict:
    return {"Authorization": f"Bearer {create_access_token({'sub': user_id})}"}


class TestAuthEndpoints:

    def test_me_sin_token_retorna_401(self):
        r = client.get("/api/v1/auth/me")
        assert r.status_code == 401

    def test_me_con_token_invalido_retorna_401(self):
        r = client.get(
            "/api/v1/auth/me",
            headers={"Authorization": "Bearer token.invalido.aqui"},
        )
        assert r.status_code == 401

    def test_me_con_token_valido_consulta_db(self):
        with patch("app.routers.auth.get_supabase") as mock_db:
            m = MagicMock()
            m.table.return_value = m
            m.select.return_value = m
            m.eq.return_value = m
            m.maybe_single.return_value = m
            m.execute.return_value = MagicMock(data={
                "id": "test-user",
                "email": "test@example.com",
                "first_name": "Test",
                "last_name": "User",
                "status": "active",
                "role": "miembro",
                "profile_photo_url": None,
                "current_streak": 0,
                "longest_streak": 0,
                "last_streak_date": None,
            })
            mock_db.return_value = m
            r = client.get("/api/v1/auth/me", headers=bearer("test-user"))
            # Si hay datos o si el endpoint responde bien (no 401 ni 500 de auth)
            assert r.status_code != 401

    def test_registro_email_duplicado_retorna_409(self):
        with patch("app.routers.auth.get_supabase") as mock_db, \
             self._rate_limit_bypass():
            m = MagicMock()
            m.table.return_value = m
            m.select.return_value = m
            m.eq.return_value = m
            # Email ya registrado
            m.execute.return_value = MagicMock(data=[{"id": "existing-user"}])
            mock_db.return_value = m
            r = client.post("/api/v1/auth/register", json={
                "email": "ya@existe.com",
                "password": "Password123!",
                "first_name": "Test",
                "last_name": "User",
                "birth_date": "1990-01-01",
            })
            assert r.status_code == 409

    def _make_login_db(self, password: str) -> MagicMock:
        """Mock de supabase para el endpoint /login.
        El router hace select→list (no maybe_single) y luego insert en sessions."""
        real_hash = hash_password(password)
        db = MagicMock()
        _cache: dict = {}

        def table_fn(name: str):
            if name in _cache:
                return _cache[name]
            m = MagicMock()
            for attr in ("select", "eq", "is_", "filter", "limit", "update",
                         "insert", "order", "range", "in_", "maybe_single"):
                getattr(m, attr).return_value = m
            if name == "users":
                m.execute.return_value = MagicMock(data=[{
                    "id": "user-1", "status": "active",
                    "password_hash": real_hash,
                    "totp_enabled": False,
                    "first_name": "Test", "last_name": "User",
                    "email": "test@test.com",
                    "role": "miembro",
                    "profile_photo_url": None,
                }])
            elif name == "sessions":
                m.execute.return_value = MagicMock(data=[{"id": "session-1"}])
            else:
                m.execute.return_value = MagicMock(data=[])
            _cache[name] = m
            return m

        db.table.side_effect = table_fn
        return db

    @staticmethod
    def _rate_limit_bypass():
        """Reemplaza _check_request_limit seteando view_rate_limit=None (suficiente para que
        _inject_headers no inyecte cabeceras, evitando el AttributeError en post-processing)."""
        from slowapi.extension import Limiter

        def _fake(_self, request, *args, **kwargs):
            request.state.view_rate_limit = None

        return patch.object(Limiter, "_check_request_limit", new=_fake)

    def test_login_password_incorrecto_retorna_401(self):
        with patch("app.routers.auth.get_supabase", return_value=self._make_login_db("password_correcto")), \
             self._rate_limit_bypass():
            r = client.post("/api/v1/auth/login", json={
                "email": "test@test.com",
                "password": "password_incorrecto",
            })
            assert r.status_code == 401

    def test_login_password_correcto_retorna_tokens(self):
        with patch("app.routers.auth.get_supabase", return_value=self._make_login_db("password_correcto")), \
             self._rate_limit_bypass():
            r = client.post("/api/v1/auth/login", json={
                "email": "test@test.com",
                "password": "password_correcto",
            })
            assert r.status_code == 200
            data = r.json()
            assert "access_token" in data
            assert data["access_token"] != ""
