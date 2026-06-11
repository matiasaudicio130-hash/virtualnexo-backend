from fastapi import APIRouter, HTTPException, Request, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone

from app.core.security import require_auth as _require_auth

router = APIRouter(prefix="/events", tags=["events"])


class CreateEventBody(BaseModel):
    title:          str
    description:    Optional[str] = None
    event_date:     str           # ISO datetime
    location_name:  Optional[str] = None
    province:       Optional[str] = None
    city:           Optional[str] = None
    lat:            Optional[float] = None
    lng:            Optional[float] = None
    max_participants: Optional[int] = None
    is_private:     bool = False
    image_url:      Optional[str] = None


class RsvpBody(BaseModel):
    status: str = "going"   # going | interested | not_going


@router.get("/")
async def list_events(
    request: Request,
    province: Optional[str] = Query(None),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0),
    upcoming_only: bool = Query(True),
):
    payload = _require_auth(request)
    me = payload["sub"]
    from app.db.supabase import get_supabase
    db  = get_supabase()
    q   = db.table("events").select(
        "*, creator:users!events_creator_id_fkey(id,first_name,last_name,profile_photo_url)"
    ).eq("is_active", True)

    if upcoming_only:
        q = q.gte("event_date", datetime.now(timezone.utc).isoformat())
    if province:
        q = q.eq("province", province)

    events = q.order("event_date").range(offset, offset + limit - 1).execute().data
    if not events:
        return {"events": [], "total": 0}

    event_ids = [e["id"] for e in events]

    # Batch: going counts + user's own RSVP + attendee previews
    attendees_r = db.table("event_attendees").select(
        "event_id, user_id, status, users!event_attendees_user_id_fkey(id,first_name,profile_photo_url)"
    ).in_("event_id", event_ids).eq("status", "going").execute().data

    # Build maps
    going_counts: dict = {}
    my_rsvp_map: dict = {}
    preview_map: dict = {}

    for row in attendees_r:
        eid = row["event_id"]
        going_counts[eid] = going_counts.get(eid, 0) + 1
        if row["user_id"] == me:
            my_rsvp_map[eid] = row["status"]
        if eid not in preview_map:
            preview_map[eid] = []
        if len(preview_map[eid]) < 4 and row.get("users"):
            preview_map[eid].append(row["users"])

    for e in events:
        eid = e["id"]
        e["going_count"]      = going_counts.get(eid, 0)
        e["my_rsvp"]          = my_rsvp_map.get(eid)
        e["attendee_preview"] = preview_map.get(eid, [])

    return {"events": events, "total": len(events)}


@router.get("/mine")
async def my_events(request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    created = db.table("events").select("*").eq(
        "creator_id", payload["sub"]
    ).order("event_date", desc=True).execute().data
    attending = db.table("event_attendees").select(
        "status, events(*)"
    ).eq("user_id", payload["sub"]).eq("status", "going").execute().data
    return {
        "created":   created,
        "attending": [a["events"] for a in attending if a.get("events")],
    }


@router.post("/", status_code=201)
async def create_event(body: CreateEventBody, request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    result = db.table("events").insert({
        "creator_id":      payload["sub"],
        "title":           body.title,
        "description":     body.description,
        "event_date":      body.event_date,
        "location_name":   body.location_name,
        "province":        body.province,
        "city":            body.city,
        "lat":             body.lat,
        "lng":             body.lng,
        "max_participants": body.max_participants,
        "is_private":      body.is_private,
        "image_url":       body.image_url,
    }).execute()
    return result.data[0]


@router.post("/{event_id}/rsvp")
async def rsvp(event_id: str, body: RsvpBody, request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    db.table("event_attendees").upsert({
        "event_id": event_id,
        "user_id":  payload["sub"],
        "status":   body.status,
    }, on_conflict="event_id,user_id").execute()
    # Update going_count
    cnt = db.table("event_attendees").select("id", count="exact").eq(
        "event_id", event_id
    ).eq("status", "going").execute()
    db.table("events").update({"going_count": cnt.count or 0}).eq("id", event_id).execute()
    return {"status": body.status}


@router.get("/{event_id}/attendees")
async def get_attendees(event_id: str, request: Request):
    _require_auth(request)
    from app.db.supabase import get_supabase
    r = get_supabase().table("event_attendees").select(
        "status, users!event_attendees_user_id_fkey(id,first_name,last_name,profile_photo_url,profile_type)"
    ).eq("event_id", event_id).execute()
    return r.data


@router.delete("/{event_id}")
async def delete_event(event_id: str, request: Request):
    payload = _require_auth(request)
    from app.db.supabase import get_supabase
    db = get_supabase()
    e = db.table("events").select("creator_id").eq("id", event_id).execute()
    if not e.data or e.data[0]["creator_id"] != payload["sub"]:
        raise HTTPException(403, "Sin permisos")
    db.table("events").update({"is_active": False}).eq("id", event_id).execute()
    return {"deleted": True}
