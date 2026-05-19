from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import RoutineCreate, ArchiveToggle

router = APIRouter(prefix="/routines", tags=["routines"])


def _assert_choreographer_on_team(team_id: str, user_id: str):
    membership = supabase.table("team_members") \
        .select("team_member_id") \
        .eq("team_id", team_id) \
        .eq("user_id", user_id) \
        .eq("role", "choreographer") \
        .limit(1) \
        .execute()
    if not membership or not membership.data:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.post("")
async def create_routine(body: RoutineCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can create routines")

    result = supabase.table("routines").insert({
        "team_id": body.team_id,
        "title": body.title,
        "created_by_user_id": current_user["user_id"],
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create routine")
    return result.data[0]


@router.patch("/{routine_id}")
async def archive_routine(routine_id: str, body: ArchiveToggle, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can archive routines")

    routine = supabase.table("routines").select("team_id").eq("routine_id", routine_id).maybe_single().execute()
    if not routine or not routine.data:
        raise HTTPException(status_code=404, detail="Routine not found")

    _assert_choreographer_on_team(routine.data["team_id"], current_user["user_id"])

    archived_at = datetime.now(timezone.utc).isoformat() if body.archived else None
    supabase.table("routines").update({"archived_at": archived_at}).eq("routine_id", routine_id).execute()
    return {"ok": True}


@router.delete("/{routine_id}")
async def delete_routine(routine_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can delete routines")

    routine = supabase.table("routines").select("team_id").eq("routine_id", routine_id).maybe_single().execute()
    if not routine or not routine.data:
        raise HTTPException(status_code=404, detail="Routine not found")

    _assert_choreographer_on_team(routine.data["team_id"], current_user["user_id"])

    # Delete storage files for all videos in this routine before dropping the DB rows
    videos = supabase.table("videos").select("storage_path").eq("routine_id", routine_id).execute()
    storage_paths = [v["storage_path"] for v in (videos.data or []) if v.get("storage_path")]
    if storage_paths:
        try:
            supabase.storage.from_("rehearsal-videos").remove(storage_paths)
        except Exception:
            pass

    # Hard delete — cascades to videos, comments, comment_targets, comment_recipients
    supabase.table("routines").delete().eq("routine_id", routine_id).execute()
    return {"ok": True}


@router.get("/{routine_id}")
async def get_routine(routine_id: str, current_user: dict = Depends(get_current_user)):
    routine = supabase.table("routines").select("*").eq("routine_id", routine_id).maybe_single().execute()
    if not routine or not routine.data:
        raise HTTPException(status_code=404, detail="Routine not found")

    videos_res = supabase.table("videos") \
        .select("*") \
        .eq("routine_id", routine_id) \
        .order("version_number") \
        .execute()
    videos = videos_res.data or []

    # Enrich each video with is_watched for the current user
    if videos:
        video_ids = [v["video_id"] for v in videos]
        views_res = supabase.table("video_views") \
            .select("video_id") \
            .eq("user_id", current_user["user_id"]) \
            .in_("video_id", video_ids) \
            .execute()
        watched = {v["video_id"] for v in (views_res.data or [])}
        videos = [{**v, "is_watched": v["video_id"] in watched} for v in videos]

    return {**routine.data, "videos": videos}
