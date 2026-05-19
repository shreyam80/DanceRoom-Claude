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


@router.delete("/{video_id}")
async def delete_video(video_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can delete videos")

    video = supabase.table("videos").select("*").eq("video_id", video_id).maybe_single().execute()
    if not video or not video.data:
        raise HTTPException(status_code=404, detail="Video not found")

    # Verify caller is a choreographer on this video's team
    routine = supabase.table("routines") \
        .select("team_id") \
        .eq("routine_id", video.data["routine_id"]) \
        .maybe_single() \
        .execute()
    if not routine or not routine.data:
        raise HTTPException(status_code=404, detail="Routine not found")

    membership = supabase.table("team_members") \
        .select("team_member_id") \
        .eq("team_id", routine.data["team_id"]) \
        .eq("user_id", current_user["user_id"]) \
        .eq("role", "choreographer") \
        .limit(1) \
        .execute()
    if not membership or not membership.data:
        raise HTTPException(status_code=403, detail="Not authorized to delete this video")

    # Delete from Supabase Storage
    if video.data.get("storage_path"):
        try:
            supabase.storage.from_("rehearsal-videos").remove([video.data["storage_path"]])
        except Exception:
            pass  # Continue even if storage delete fails; DB row is the source of truth

    # Delete from DB (cascades to comments, comment_targets, comment_recipients)
    supabase.table("videos").delete().eq("video_id", video_id).execute()
    return {"ok": True}


@router.post("/{video_id}/viewed")
async def mark_video_viewed(video_id: str, current_user: dict = Depends(get_current_user)):
    # Upsert: ignore conflict if already viewed
    supabase.table("video_views").upsert(
        {"video_id": video_id, "user_id": current_user["user_id"]},
        on_conflict="video_id,user_id",
    ).execute()
    return {"ok": True}


@router.get("/{video_id}")
async def get_video(video_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("videos").select("*").eq("video_id", video_id).maybe_single().execute()
    if not result or not result.data:
        raise HTTPException(status_code=404, detail="Video not found")

    routine = supabase.table("routines") \
        .select("routine_id, title, team_id") \
        .eq("routine_id", result.data["routine_id"]) \
        .maybe_single() \
        .execute()

    return {**result.data, "routine": routine.data if routine else None}


@router.get("/{video_id}/comments")
async def get_video_comments(video_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("comments") \
        .select("*") \
        .eq("video_id", video_id) \
        .order("video_timestamp_seconds") \
        .execute()
    comments = result.data or []
    if not comments:
        return []

    # Enrich with target labels so the frontend can display them without extra fetches
    comment_ids = [c["comment_id"] for c in comments]
    targets_res = supabase.table("comment_targets") \
        .select("comment_id, user_id, subgroup_id, team_id") \
        .in_("comment_id", comment_ids) \
        .execute()
    target_map = {t["comment_id"]: t for t in (targets_res.data or [])}

    user_ids = [t["user_id"] for t in (targets_res.data or []) if t.get("user_id")]
    users_map: dict = {}
    if user_ids:
        rows = supabase.table("users").select("user_id, full_name").in_("user_id", user_ids).execute()
        users_map = {u["user_id"]: u["full_name"] for u in (rows.data or [])}

    subgroup_ids = [t["subgroup_id"] for t in (targets_res.data or []) if t.get("subgroup_id")]
    subgroups_map: dict = {}
    if subgroup_ids:
        rows = supabase.table("subgroups").select("subgroup_id, name").in_("subgroup_id", subgroup_ids).execute()
        subgroups_map = {s["subgroup_id"]: s["name"] for s in (rows.data or [])}

    for c in comments:
        t = target_map.get(c["comment_id"], {})
        if c["target_type"] == "individual" and t.get("user_id"):
            c["target_label"] = users_map.get(t["user_id"], "Unknown")
            c["target_id"] = t["user_id"]
        elif c["target_type"] == "subgroup" and t.get("subgroup_id"):
            c["target_label"] = subgroups_map.get(t["subgroup_id"], "Unknown subgroup")
            c["target_id"] = t["subgroup_id"]
        else:
            c["target_label"] = "Whole team"
            c["target_id"] = t.get("team_id", "")

    return comments


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
