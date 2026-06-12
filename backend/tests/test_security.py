"""
Tests para el módulo de seguridad (hashing de passwords y JWT).

Cubre la capa más crítica de la app: si hash_password o los tokens fallan,
ningún usuario puede loguearse ni acceder a recursos protegidos.
"""
import pytest
from datetime import datetime, timezone, timedelta
from app.core.security import (
    hash_password, verify_password,
    create_access_token, decode_access_token,
)
from app.core.config import get_settings


class TestPasswordHashing:

    def test_hash_no_es_texto_plano(self):
        h = hash_password("mi_password_segura")
        assert h != "mi_password_segura"
        assert len(h) > 20

    def test_verificacion_password_correcto(self):
        h = hash_password("abc123")
        assert verify_password("abc123", h) is True

    def test_verificacion_password_erroneo(self):
        h = hash_password("abc123")
        assert verify_password("hackeado", h) is False

    def test_mismo_password_genera_hashes_distintos(self):
        """bcrypt usa salt aleatorio — dos hashes del mismo password nunca son iguales."""
        h1 = hash_password("password")
        h2 = hash_password("password")
        assert h1 != h2

    def test_password_vacio_se_puede_hashear_pero_falla_verificacion(self):
        h = hash_password("")
        assert verify_password("algo", h) is False


class TestJWT:

    def test_crear_y_decodificar_token_basico(self):
        token = create_access_token({"sub": "user-123"})
        payload = decode_access_token(token)
        assert payload is not None
        assert payload["sub"] == "user-123"
        assert payload["type"] == "access"

    def test_token_invalido_retorna_none(self):
        assert decode_access_token("no.es.un.jwt") is None

    def test_cadena_vacia_retorna_none(self):
        assert decode_access_token("") is None

    def test_token_adulterado_retorna_none(self):
        token = create_access_token({"sub": "user-abc"})
        adulterado = token[:-6] + "XXXXXX"
        assert decode_access_token(adulterado) is None

    def test_token_con_tipo_incorrecto_rechazado(self):
        """Un token de tipo 'refresh' no debe pasar la validación de endpoints."""
        from jose import jwt as jose_jwt
        settings = get_settings()
        bad_token = jose_jwt.encode(
            {
                "sub": "user-x",
                "type": "refresh",
                "exp": datetime.now(timezone.utc) + timedelta(hours=1),
            },
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        assert decode_access_token(bad_token) is None

    def test_token_expirado_retorna_none(self):
        """Un token con exp en el pasado debe ser rechazado."""
        from jose import jwt as jose_jwt
        settings = get_settings()
        expired = jose_jwt.encode(
            {
                "sub": "user-x",
                "type": "access",
                "exp": datetime.now(timezone.utc) - timedelta(seconds=1),
            },
            settings.JWT_SECRET_KEY,
            algorithm=settings.JWT_ALGORITHM,
        )
        assert decode_access_token(expired) is None

    def test_sub_se_preserva_en_el_token(self):
        """El user_id debe llegar intacto al payload decodificado."""
        uid = "550e8400-e29b-41d4-a716-446655440000"
        token = create_access_token({"sub": uid})
        payload = decode_access_token(token)
        assert payload["sub"] == uid
