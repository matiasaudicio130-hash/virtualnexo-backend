"""
Sistema de moderación de contenido.
Requiere ejecutar backend/supabase/migration_content_reports.sql una vez en Supabase.
"""
from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel, Field
from typing import Optional, Literal
from datetime import datetime, timezone, timedelta

from app.core.security import require_auth as _require_auth
from app.db.supabase import get_supabase

router = APIRouter(prefix="/moderation", tags=["moderation"])

REPORT_REASONS = [
    "spam",
    "contenido_inapropiado",
    "acoso",
    "perfil_falso",
    "menor_de_edad",
    "violencia",
    "otro",
]

REASON_LABELS = {
    "spam":                  "Spam o publicidad",
    "contenido_inapropiado": "Contenido inapropiado",
    "acoso":                 "Acoso o bullying",
    "perfil_falso":          "Perfil falso / suplantación",
    "menor_de_edad":         "Posible menor de edad",
    "violencia":             "Violencia o amenazas",
    "otro":                  "Otro",
}


def _require_admin(request: Request) -> dict:
    payload = _require_auth(request)
    if payload.get("role") != "admin":
        raise HTTPException(403, "Solo admins")
    return payload


# ── Razones disponibles ──────────────────────────────────────────────────────
@router.get("/reasons")
async def get_reasons():
    return [{"id": k, "label": v} for k, v in REASON_LABELS.items()]


# ── Crear reporte ────────────────────────────────────────────────────────────
class ReportBody(BaseModel):
    target_type: Literal["post", "user"]
    target_id:   str
    reason:      str = Field(..., max_length=50)
    details:     str = Field("", max_length=500)


@router.post("/report", status_code=201)
async def create_report(body: ReportBody, request: Request):
    """Cualquier usuario autenticado puede reportar un post o usuario."""
    payload     = _require_auth(request)
    reporter_id = payload["sub"]
    db          = get_supabase()

    if body.reason not in REPORT_REASONS:
        raise HTTPException(400, f"Razón inválida. Opciones: {', '.join(REPORT_REASONS)}")

    # Evitar auto-reportes
    if body.target_type == "user" and body.target_id == reporter_id:
        raise HTTPException(400, "No podés reportarte a vos mismo")

    # Verificar que no haya un reporte reciente del mismo usuario sobre el mismo objeto
    recent = (
        db.table("content_reports")
        .select("id")
        .eq("reporter_id", reporter_id)
        .eq("target_id", body.target_id)
        .gte("created_at", (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat())
        .execute()
    )
    if recent.data:
        raise HTTPException(409, "Ya reportaste esto en las últimas 24 horas")

    result = db.table("content_reports").insert({
        "reporter_id": reporter_id,
        "target_type": body.target_type,
        "target_id":   body.target_id,
        "reason":      body.reason,
        "details":     body.details.strip(),
        "status":      "pending",
    }).execute()

    return {"reported": True, "id": result.data[0]["id"] if result.data else None}


# ── Listar reportes (admin) ──────────────────────────────────────────────────
@router.get("/reports")
async def list_reports(
    request:  Request,
    status:   Optional[str] = Query(None),
    target:   Optional[str] = Query(None),   # 'post' | 'user'
    limit:    int = Query(30, ge=1, le=100),
    offset:   int = Query(0,  ge=0),
):
    _require_admin(request)
    db = get_supabase()

    q = (
        db.table("content_reports")
        .select(
            "*, "
            "reporter:reporter_id(id, first_name, last_name, profile_photo_url), "
            "reviewer:reviewed_by(id, first_name, last_name)"
        )
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if status:
        q = q.eq("status", status)
    if target:
        q = q.eq("target_type", target)

    rows = q.execute().data or []

    # Enrich with target info (post caption or user name)
    for r in rows:
        r["reason_label"] = REASON_LABELS.get(r.get("reason", ""), r.get("reason", ""))
        try:
            if r["target_type"] == "post":
                p = db.table("posts").select("caption,media_url,user_id,users!posts_user_id_fkey(first_name,last_name)").eq("id", r["target_id"]).maybe_single().execute()
                r["target_info"] = p.data or {}
            else:
                u = db.table("users").select("first_name,last_name,profile_photo_url,status").eq("id", r["target_id"]).maybe_single().execute()
                r["target_info"] = u.data or {}
        except Exception:
            r["target_info"] = {}

    # Count pending
    pending_r = db.table("content_reports").select("id", count="exact").eq("status", "pending").execute()
    return {"reports": rows, "pending_count": pending_r.count or 0}


# ── Acciones del admin ───────────────────────────────────────────────────────
class ActionBody(BaseModel):
    action:     Literal["dismiss", "warn_user", "delete_post", "suspend_user"]
    admin_note: str = ""


@router.post("/reports/{report_id}/action")
async def take_action(report_id: str, body: ActionBody, request: Request):
    payload = _require_admin(request)
    admin_id = payload["sub"]
    db = get_supabase()

    # Get report
    rep_r = db.table("content_reports").select("*").eq("id", report_id).maybe_single().execute()
    if not rep_r.data:
        raise HTTPException(404, "Reporte no encontrado")
    rep = rep_r.data

    new_status = "actioned" if body.action != "dismiss" else "dismissed"
    now = datetime.now(timezone.utc).isoformat()

    # Update report
    db.table("content_reports").update({
        "status":      new_status,
        "admin_note":  body.admin_note.strip(),
        "reviewed_at": now,
        "reviewed_by": admin_id,
    }).eq("id", report_id).execute()

    # Execute the action
    if body.action == "warn_user":
        warned_id = rep["target_id"] if rep["target_type"] == "user" else None
        if not warned_id:
            # For post reports, warn the post author
            p = db.table("posts").select("user_id").eq("id", rep["target_id"]).maybe_single().execute()
            warned_id = p.data["user_id"] if p.data else None
        if warned_id:
            db.table("notifications").insert({
                "user_id": warned_id,
                "type":    "warning",
                "title":   "Advertencia de moderación",
                "body":    body.admin_note or "Tu contenido fue revisado y no cumple con las normas de la comunidad.",
            }).execute()

    elif body.action == "delete_post" and rep["target_type"] == "post":
        db.table("posts").update({"status": "deleted"}).eq("id", rep["target_id"]).execute()

    elif body.action == "suspend_user":
        uid = rep["target_id"] if rep["target_type"] == "user" else None
        if not uid:
            p = db.table("posts").select("user_id").eq("id", rep["target_id"]).maybe_single().execute()
            uid = p.data["user_id"] if p.data else None
        if uid:
            db.table("users").update({"status": "suspended"}).eq("id", uid).execute()
            db.table("notifications").insert({
                "user_id": uid,
                "type":    "suspension",
                "title":   "Cuenta suspendida",
                "body":    body.admin_note or "Tu cuenta fue suspendida por incumplir las normas de la comunidad.",
            }).execute()

    return {"actioned": True, "report_id": report_id, "action": body.action}
