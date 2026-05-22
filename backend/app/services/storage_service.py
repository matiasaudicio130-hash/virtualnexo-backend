"""
Servicio de almacenamiento en Supabase Storage.
Aplica watermarks antes de subir. Devuelve URLs públicas o firmadas.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Literal

from app.db.supabase import get_supabase
from app.services.watermark_service import watermark_service

logger = logging.getLogger(__name__)

BucketName = Literal["avatars", "media"]


class StorageService:

    def _supabase(self):
        return get_supabase()

    def _storage_path(self, user_id: str, bucket: BucketName, original_name: str) -> str:
        """Genera la ruta: user_id/timestamp_uuid.png"""
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        uid = uuid.uuid4().hex[:8]
        ext = "png"  # Siempre PNG para preservar LSB
        return f"{user_id}/{ts}_{uid}.{ext}"

    async def upload_avatar(self, image_bytes: bytes, user_id: str, original_name: str = "avatar") -> dict:
        """
        Aplica ambas marcas de agua y sube al bucket `avatars`.
        Devuelve la URL pública del avatar.
        """
        db = self._supabase()

        # 1. Watermarks
        processed, meta = watermark_service.process_avatar(image_bytes, user_id)

        # 2. Ruta de storage
        path = self._storage_path(user_id, "avatars", original_name)

        # 3. Upload a Supabase Storage
        db.storage.from_("avatars").upload(
            path=path,
            file=processed,
            file_options={"content-type": "image/png", "upsert": "true"},
        )

        # 4. URL pública (bucket es public)
        public_url = db.storage.from_("avatars").get_public_url(path)

        # 5. Actualizar perfil del usuario
        db.table("users").update({"profile_photo_url": public_url}).eq("id", user_id).execute()

        # 6. Guardar metadata
        db.table("media_uploads").insert({
            "user_id": user_id,
            "bucket": "avatars",
            "storage_path": path,
            "original_name": original_name,
            "mime_type": meta["mime_type"],
            "size_bytes": meta["size_bytes"],
            "width": meta["final_size"][0],
            "height": meta["final_size"][1],
            "has_visible_wm": meta["has_visible_wm"],
            "has_stealth_wm": meta["has_stealth_wm"],
            "wm_payload": meta["wm_payload"],
        }).execute()

        return {
            "url": public_url,
            "path": path,
            "width": meta["final_size"][0],
            "height": meta["final_size"][1],
            "size_bytes": meta["size_bytes"],
        }

    async def upload_post_image(self, image_bytes: bytes, user_id: str, original_name: str = "post") -> dict:
        """
        Aplica watermarks y sube al bucket `media` (privado).
        Devuelve una signed URL válida por 1 hora.
        """
        db = self._supabase()

        processed, meta = watermark_service.process_post_image(image_bytes, user_id)
        path = self._storage_path(user_id, "media", original_name)

        db.storage.from_("media").upload(
            path=path,
            file=processed,
            file_options={"content-type": "image/png", "upsert": "true"},
        )

        # Signed URL (3600 segundos = 1 hora)
        signed = db.storage.from_("media").create_signed_url(path, 3600)
        signed_url = signed["signedURL"] if isinstance(signed, dict) else signed.signed_url

        db.table("media_uploads").insert({
            "user_id": user_id,
            "bucket": "media",
            "storage_path": path,
            "original_name": original_name,
            "mime_type": meta["mime_type"],
            "size_bytes": meta["size_bytes"],
            "width": meta["final_size"][0],
            "height": meta["final_size"][1],
            "has_visible_wm": meta["has_visible_wm"],
            "has_stealth_wm": meta["has_stealth_wm"],
            "wm_payload": meta["wm_payload"],
        }).execute()

        return {
            "signed_url": signed_url,
            "path": path,
            "expires_in": 3600,
            "width": meta["final_size"][0],
            "height": meta["final_size"][1],
            "size_bytes": meta["size_bytes"],
        }

    def get_signed_url(self, path: str, bucket: BucketName = "media", expires: int = 3600) -> str:
        """Genera una nueva signed URL para una imagen ya subida."""
        db = self._supabase()
        signed = db.storage.from_(bucket).create_signed_url(path, expires)
        return signed["signedURL"] if isinstance(signed, dict) else signed.signed_url

    def delete_file(self, path: str, bucket: BucketName = "avatars") -> None:
        db = self._supabase()
        db.storage.from_(bucket).remove([path])
        db.table("media_uploads").delete().eq("storage_path", path).execute()

    async def verify_leak(self, image_bytes: bytes) -> dict:
        """Admin: analiza una imagen filtrada para identificar al responsable."""
        return watermark_service.verify_leak(image_bytes)


storage_service = StorageService()
