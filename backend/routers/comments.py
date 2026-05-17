from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import CommentCreate

router = APIRouter(prefix="/comments", tags=["comments"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("")
async def create_comment(body: CommentCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can add comments")

    if body.target_type not in ("individual", "subgroup", "team"):
        raise HTTPException(status_code=400, detail="target_type must be individual, subgroup, or team")

    # Create comment row
    comment_res = supabase.table("comments").insert({
        "video_id": body.video_id,
        "author_user_id": current_user["user_id"],
        "body": body.body,
        "video_timestamp_seconds": body.video_timestamp_seconds,
        "target_type": body.target_type,
        "status": "open",
    }).execute()
    if not comment_res.data:
        raise HTTPException(status_code=500, detail="Failed to create comment")

    comment = comment_res.data[0]
    comment_id = comment["comment_id"]

    # Create comment_targets row
    target_row: dict = {"comment_id": comment_id}
    if body.target_type == "individual":
        target_row["user_id"] = body.target_id
    elif body.target_type == "subgroup":
        target_row["subgroup_id"] = body.target_id
    else:
        target_row["team_id"] = body.target_id
    supabase.table("comment_targets").insert(target_row).execute()

    # Expand to comment_recipients
    recipient_ids: list[str] = []
    if body.target_type == "individual":
        recipient_ids = [body.target_id]
    elif body.target_type == "subgroup":
        rows = supabase.table("subgroup_members") \
            .select("user_id") \
            .eq("subgroup_id", body.target_id) \
            .execute()
        recipient_ids = [r["user_id"] for r in (rows.data or [])]
    else:
        rows = supabase.table("team_members") \
            .select("user_id") \
            .eq("team_id", body.target_id) \
            .eq("status", "active") \
            .execute()
        # Exclude the author (choreographer)
        recipient_ids = [r["user_id"] for r in (rows.data or []) if r["user_id"] != current_user["user_id"]]

    if recipient_ids:
        supabase.table("comment_recipients").insert([
            {"comment_id": comment_id, "user_id": uid, "status": "pending"}
            for uid in recipient_ids
        ]).execute()

    return {**comment, "recipient_count": len(recipient_ids)}


@router.post("/{comment_id}/acknowledge")
async def acknowledge_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("comment_recipients").update({
        "acknowledged_at": _now(),
        "status": "acknowledged",
    }).eq("comment_id", comment_id).eq("user_id", current_user["user_id"]).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="No recipient record found for this comment")
    return result.data[0]


@router.post("/{comment_id}/resolve")
async def resolve_comment(comment_id: str, current_user: dict = Depends(get_current_user)):
    comment = supabase.table("comments").select("author_user_id, status") \
        .eq("comment_id", comment_id).maybe_single().execute()
    if not comment or not comment.data:
        raise HTTPException(status_code=404, detail="Comment not found")

    is_author = comment.data["author_user_id"] == current_user["user_id"]
    is_recipient = supabase.table("comment_recipients") \
        .select("comment_recipient_id") \
        .eq("comment_id", comment_id) \
        .eq("user_id", current_user["user_id"]) \
        .limit(1) \
        .execute()

    if not is_author and not (is_recipient and is_recipient.data):
        raise HTTPException(status_code=403, detail="Not authorized to resolve this comment")

    result = supabase.table("comments").update({
        "status": "resolved",
        "resolved_by_user_id": current_user["user_id"],
        "resolved_at": _now(),
        "updated_at": _now(),
    }).eq("comment_id", comment_id).execute()

    return result.data[0]
