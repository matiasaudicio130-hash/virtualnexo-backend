"""
Constantes de tipos de perfil y atracción.
Módulo independiente para evitar imports circulares entre servicios.
"""

VALID_PROFILE_TYPES: set[str] = {"solo_h", "solo_m", "id_div", "pareja", "trio_grupo"}

SOLO_TYPES: set[str] = {"solo_h", "solo_m", "id_div"}

VALID_CATEGORIES: set[str] = {"hombres", "mujeres", "id_div", "parejas", "grupos"}

ATTRACTION_MAP: dict[str, set[str]] = {
    "hombres": {"solo_h"},
    "mujeres": {"solo_m"},
    "id_div":  {"id_div"},
    "parejas": {"pareja"},
    "grupos":  {"trio_grupo"},
}


def resolve_interested_types(categories: list[str]) -> set[str]:
    """Convierte categorías de atracción a tipos de perfil concretos."""
    types: set[str] = set()
    for cat in categories:
        types |= ATTRACTION_MAP.get(cat, set())
    return types
