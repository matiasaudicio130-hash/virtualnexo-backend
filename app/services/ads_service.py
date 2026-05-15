"""
AdServer localizado.
- Sirve anuncios filtrados por provincia del usuario.
- Registra impresiones y clicks para reporte a anunciantes.
- Rotación por prioridad: mayor prioridad aparece primero.
"""
import uuid
from datetime import datetime, timezone
from typing import Optional

from app.db.supabase import get_supabase


class AdsService:

    def get_ads_for_user(
        self,
        user_province: Optional[str] = None,
        ad_type: Optional[str] = None,
        limit: int = 5,
    ) -> list:
        """
        Devuelve anuncios activos para la provincia del usuario.
        Combina anuncios nacionales (provinces=NULL) con los de la provincia.
        """
        db = get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        q = db.table("ads").select(
            "*, advertiser:advertisers!ads_advertiser_id_fkey(id,name,category,logo_url)"
        ).eq("is_active", True).lte("starts_at", now).or_(f"ends_at.is.null,ends_at.gt.{now}")

        if ad_type:
            q = q.eq("type", ad_type)

        ads = q.order("priority", desc=True).limit(limit * 3).execute().data

        # Filtrar por provincia: incluir nacionales (provinces IS NULL) y de la provincia del usuario
        filtered = []
        for ad in ads:
            provinces = ad.get("provinces")
            if provinces is None or not provinces:
                filtered.append(ad)  # Anuncio nacional
            elif user_province and user_province in provinces:
                filtered.append(ad)  # Anuncio específico de la provincia

            if len(filtered) >= limit:
                break

        return filtered

    def record_event(
        self,
        ad_id: str,
        action: str,
        user_id: Optional[str] = None,
        user_province: Optional[str] = None,
        session_id: Optional[str] = None,
    ) -> None:
        """Registra una impresión, click o evento de overlay."""
        db = get_supabase()

        db.table("ad_clicks").insert({
            "ad_id":         ad_id,
            "user_id":       user_id,
            "user_province": user_province,
            "action":        action,
            "session_id":    session_id or str(uuid.uuid4()),
        }).execute()

        # Actualizar contadores del anuncio
        if action == "impression":
            db.rpc("increment_ad_impressions", {"ad_id": ad_id}).execute()
        elif action == "click":
            db.rpc("increment_ad_clicks", {"ad_id": ad_id}).execute()

    def get_ad_stats(self, ad_id: Optional[str] = None) -> list:
        """Stats agregadas de anuncios para el admin."""
        db = get_supabase()
        q = db.table("ads").select(
            "id,title,type,impressions,clicks,is_active,"
            "advertiser:advertisers!ads_advertiser_id_fkey(name)"
        )
        if ad_id:
            q = q.eq("id", ad_id)
        ads = q.order("clicks", desc=True).execute().data

        result = []
        for ad in ads:
            ctr = (ad["clicks"] / ad["impressions"] * 100) if ad["impressions"] > 0 else 0
            result.append({
                **ad,
                "ctr_pct": round(ctr, 2),
            })
        return result

    # CRUD para el admin
    def create_advertiser(self, data: dict) -> dict:
        db = get_supabase()
        return db.table("advertisers").insert(data).execute().data[0]

    def create_ad(self, data: dict) -> dict:
        db = get_supabase()
        return db.table("ads").insert(data).execute().data[0]

    def update_ad(self, ad_id: str, data: dict) -> dict:
        db = get_supabase()
        return db.table("ads").update(data).eq("id", ad_id).execute().data[0]

    def list_advertisers(self) -> list:
        db = get_supabase()
        return db.table("advertisers").select("*").order("name").execute().data

    def list_ads(self, active_only: bool = False) -> list:
        db = get_supabase()
        q = db.table("ads").select(
            "*, advertiser:advertisers!ads_advertiser_id_fkey(name,category)"
        )
        if active_only:
            q = q.eq("is_active", True)
        return q.order("priority", desc=True).execute().data


ads_service = AdsService()
