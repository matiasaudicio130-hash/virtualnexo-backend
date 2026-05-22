"""Instancia central de rate limiter. Importar desde aquí en todos los routers."""
from slowapi import Limiter
from slowapi.util import get_remote_address

# 200 req/min por IP como límite global por defecto
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
