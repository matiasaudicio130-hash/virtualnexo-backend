from supabase import create_client, Client
from app.core.config import get_settings
from functools import lru_cache

settings = get_settings()


@lru_cache()
def get_supabase() -> Client:
    """
    Cliente con service_role key → bypasses RLS.
    NUNCA exponer esta key al frontend.
    """
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,
    )
