"""
Helpers de bloqueo entre usuarios (tabla user_blocks).

Fuente única para resolver bloqueos — antes esta lógica (el `or_` de PostgREST
+ derivar "el otro" / el blocker) estaba copiada en feed_service, profile_service
y los chequeos de DMs y de posts de perfil. Todas las funciones fallan en
"abierto" (no bloqueado) si la tabla no existe, igual que el código original.
"""
from typing import Optional


def blocked_user_ids(db, user_id: str) -> set:
    """IDs bloqueados en cualquier dirección respecto a `user_id` (mutuo)."""
    try:
        r = db.table("user_blocks").select("blocker_id,blocked_id").or_(
            f"blocker_id.eq.{user_id},blocked_id.eq.{user_id}"
        ).execute()
    except Exception:
        return set()
    ids: set = set()
    for row in r.data:
        other = row["blocked_id"] if row["blocker_id"] == user_id else row["blocker_id"]
        ids.add(other)
    return ids


def block_between(db, a: str, b: str) -> Optional[str]:
    """
    Si existe un bloqueo entre `a` y `b` (en cualquier dirección) devuelve el
    `blocker_id`; si no hay bloqueo (o la tabla no existe) devuelve None.
    """
    try:
        r = db.table("user_blocks").select("blocker_id").or_(
            f"and(blocker_id.eq.{a},blocked_id.eq.{b}),"
            f"and(blocker_id.eq.{b},blocked_id.eq.{a})"
        ).limit(1).execute()
    except Exception:
        return None
    return r.data[0]["blocker_id"] if r.data else None
