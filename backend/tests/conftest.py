"""
Fixtures compartidos para todos los tests de backend.
El mock de supabase distingue el nombre de la tabla para devolver
datos diferentes según qué query se hace.
"""
import pytest
from unittest.mock import MagicMock, patch


def make_supabase_mock(notifications_data=None, users_data=None, posts_data=None):
    """
    Crea un mock del cliente supabase donde cada tabla puede tener
    datos de respuesta distintos.
    Cachea el mock por nombre de tabla para que las aserciones en tests
    reciban el mismo objeto que fue usado dentro de la función bajo prueba.
    """
    db = MagicMock()
    _cache: dict = {}

    def _make_table_mock(name: str):
        m = MagicMock()
        # Todas las operaciones retornan el mismo mock (chainable)
        for attr in ("select", "eq", "is_", "filter", "limit", "update",
                     "insert", "order", "range", "in_", "ilike", "or_"):
            getattr(m, attr).return_value = m

        if name == "notifications":
            m.execute.return_value = MagicMock(data=list(notifications_data) if notifications_data is not None else [])
        elif name == "users":
            m.execute.return_value = MagicMock(data=list(users_data) if users_data is not None else [])
        elif name == "posts":
            m.execute.return_value = MagicMock(data=list(posts_data) if posts_data is not None else [])
        else:
            m.execute.return_value = MagicMock(data=[])
        return m

    def table_fn(name: str):
        if name not in _cache:
            _cache[name] = _make_table_mock(name)
        return _cache[name]

    db.table.side_effect = table_fn
    return db


@pytest.fixture
def mock_db():
    return make_supabase_mock()


@pytest.fixture
def patch_supabase(mock_db):
    """Reemplaza get_supabase() en todos los módulos que lo usan."""
    with patch("app.db.supabase.get_supabase", return_value=mock_db), \
         patch("app.services.notifications_service.get_supabase", return_value=mock_db), \
         patch("app.services.feed_service.get_supabase", return_value=mock_db):
        yield mock_db
