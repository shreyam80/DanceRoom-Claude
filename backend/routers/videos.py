from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import VideoCreate

router = APIRouter(prefix="/videos", tags=["videos"])


@router.post("")
async def create_video(body: VideoCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can upload videos")

    existing = supabase.table("videos") \
        .select("version_number") \
        .eq("routine_id", body.routine_id) \
        .execute()

    version = 1
    if existing.data:
        version = max(v["version_number"] for v in existing.data) + 1

    result = supabase.table("videos").insert({
        "routine_id": body.routine_id,
        "uploaded_by_user_id": current_user["user_id"],
        "file_url": body.file_url,
        "storage_path": body.storage_path,
        "version_number": version,
        "duration_seconds": body.duration_seconds,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save video")
    return result.data[0]


@router.get("/{video_id}")
async def get_video(video_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("videos").select("*").eq("video_id", video_id).maybe_single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Video not found")

    routine = supabase.table("routines") \
        .select("routine_id, title, team_id") \
        .eq("routine_id", result.data["routine_id"]) \
        .maybe_single() \
        .execute()

    return {**result.data, "routine": routine.data}


@router.get("/{video_id}/comments")
async def get_video_comments(video_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("comments") \
        .select("*") \
        .eq("video_id", video_id) \
        .order("video_timestamp_seconds") \
        .execute()
    return result.data or []


@router.get("/{video_id}/comments/my")
async def get_my_video_comments(video_id: str, current_user: dict = Depends(get_current_user)):
    comments = supabase.table("comments") \
        .select("*") \
        .eq("video_id", video_id) \
        .order("video_timestamp_seconds") \
        .execute()

    if not comments.data:
        return []

    comment_ids = [c["comment_id"] for c in comments.data]
    recipients = supabase.table("comment_recipients") \
        .select("comment_id, seen_at, acknowledged_at, status") \
        .eq("user_id", current_user["user_id"]) \
        .in_("comment_id", comment_ids) \
        .execute()

    recipient_map = {r["comment_id"]: r for r in (recipients.data or [])}

    return [
        {
            **c,
            "acknowledged_at": recipient_map[c["comment_id"]]["acknowledged_at"],
            "recipient_status": recipient_map[c["comment_id"]]["status"],
        }
        for c in comments.data
        if c["comment_id"] in recipient_map
    ]
