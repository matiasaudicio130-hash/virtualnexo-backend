"""
Constantes de tipos de perfil y atracción.
Módulo independiente para evitar imports circulares entre servicios.
"""

SOLO_TYPES: set[str] = {"solo_h", "solo_m", "trans_m", "trans_f", "nb"}

ATTRACTION_MAP: dict[str, set[str]] = {
    "hombres": {"solo_h", "trans_m"},
    "mujeres": {"solo_m", "trans_f"},
    "nb":      {"nb"},
    "parejas": {"pareja"},
    "grupos":  {"trio_grupo"},
}


def resolve_interested_types(categories: list[str]) -> set[str]:
    """Convierte categorías de atracción a tipos de perfil concretos."""
    types: set[str] = set()
    for cat in categories:
        types |= ATTRACTION_MAP.get(cat, set())
    return types
