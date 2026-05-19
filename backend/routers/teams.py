from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from database import supabase
from auth import get_current_user
from models.schemas import TeamCreate, AddMemberByEmail, ArchiveToggle

router = APIRouter(prefix="/teams", tags=["teams"])


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


def _unread_counts_by_team(team_ids: list, user_id: str) -> dict:
    """Returns {team_id: unread_comment_count} for a dancer."""
    unread_by_team = {tid: 0 for tid in team_ids}
    if not team_ids:
        return unread_by_team

    routine_res = supabase.table("routines") \
        .select("routine_id, team_id") \
        .in_("team_id", team_ids) \
        .is_("archived_at", "null") \
        .execute()
    routines = routine_res.data or []
    if not routines:
        return unread_by_team

    routine_to_team = {r["routine_id"]: r["team_id"] for r in routines}
    routine_ids = list(routine_to_team.keys())

    vid_res = supabase.table("videos") \
        .select("video_id, routine_id") \
        .in_("routine_id", routine_ids) \
        .execute()
    videos = vid_res.data or []
    if not videos:
        return unread_by_team

    video_to_team = {v["video_id"]: routine_to_team[v["routine_id"]] for v in videos}
    video_ids = list(video_to_team.keys())

    comment_res = supabase.table("comments") \
        .select("comment_id, video_id") \
        .in_("video_id", video_ids) \
        .execute()
    all_comments = comment_res.data or []
    if not all_comments:
        return unread_by_team

    comment_to_team = {c["comment_id"]: video_to_team[c["video_id"]] for c in all_comments}
    comment_ids = list(comment_to_team.keys())

    unread_res = supabase.table("comment_recipients") \
        .select("comment_id") \
        .eq("user_id", user_id) \
        .is_("acknowledged_at", "null") \
        .in_("comment_id", comment_ids) \
        .execute()
    for r in (unread_res.data or []):
        tid = comment_to_team.get(r["comment_id"])
        if tid:
            unread_by_team[tid] = unread_by_team.get(tid, 0) + 1

    return unread_by_team


@router.get("")
async def list_my_teams(
    organization_id: Optional[str] = Query(None),
    archived: bool = Query(False),
    current_user: dict = Depends(get_current_user),
):
    # Choreographer fetching archived teams for an org (used by ArchivedTeamsPage)
    if organization_id and archived:
        if current_user["role"] != "choreographer":
            raise HTTPException(status_code=403, detail="Only choreographers can view archived teams")
        result = supabase.table("teams") \
            .select("*") \
            .eq("organization_id", organization_id) \
            .not_.is_("archived_at", "null") \
            .execute()
        return result.data or []

    # Fetch teams the user is a member of (all statuses)
    rows = supabase.table("team_members") \
        .select("team_id") \
        .eq("user_id", current_user["user_id"]) \
        .eq("status", "active") \
        .execute()

    if not rows.data:
        return []

    team_ids = [r["team_id"] for r in rows.data]

    # Dancer fetching their own archived teams
    if archived:
        result = supabase.table("teams") \
            .select("*") \
            .in_("team_id", team_ids) \
            .not_.is_("archived_at", "null") \
            .execute()
        return result.data or []

    # Default: active teams only
    result = supabase.table("teams") \
        .select("*") \
        .in_("team_id", team_ids) \
        .is_("archived_at", "null") \
        .execute()
    teams = result.data or []

    if not teams:
        return []

    # Add unread_comment_count for dancers
    if current_user["role"] == "dancer":
        unread_by_team = _unread_counts_by_team(team_ids, current_user["user_id"])
        teams = [{**t, "unread_comment_count": unread_by_team.get(t["team_id"], 0)} for t in teams]

    return teams


@router.post("")
async def create_team(body: TeamCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can create teams")

    team = supabase.table("teams").insert({
        "organization_id": body.organization_id,
        "name": body.name,
        "description": body.description,
        "created_by_user_id": current_user["user_id"],
    }).execute()
    if not team.data:
        raise HTTPException(status_code=500, detail="Failed to create team")

    team_data = team.data[0]

    supabase.table("team_members").insert({
        "team_id": team_data["team_id"],
        "user_id": current_user["user_id"],
        "role": "choreographer",
        "status": "active",
    }).execute()

    return team_data


@router.patch("/{team_id}")
async def archive_team(team_id: str, body: ArchiveToggle, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can archive teams")

    team = supabase.table("teams").select("team_id").eq("team_id", team_id).maybe_single().execute()
    if not team or not team.data:
        raise HTTPException(status_code=404, detail="Team not found")

    _assert_choreographer_on_team(team_id, current_user["user_id"])

    archived_at = datetime.now(timezone.utc).isoformat() if body.archived else None
    supabase.table("teams").update({"archived_at": archived_at}).eq("team_id", team_id).execute()
    return {"ok": True}


@router.delete("/{team_id}")
async def delete_team(team_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can delete teams")

    team = supabase.table("teams").select("team_id").eq("team_id", team_id).maybe_single().execute()
    if not team or not team.data:
        raise HTTPException(status_code=404, detail="Team not found")

    _assert_choreographer_on_team(team_id, current_user["user_id"])

    # Collect all video storage paths under this team before deleting
    routines_res = supabase.table("routines").select("routine_id").eq("team_id", team_id).execute()
    routine_ids = [r["routine_id"] for r in (routines_res.data or [])]
    if routine_ids:
        videos_res = supabase.table("videos").select("storage_path").in_("routine_id", routine_ids).execute()
        storage_paths = [v["storage_path"] for v in (videos_res.data or []) if v.get("storage_path")]
        if storage_paths:
            try:
                supabase.storage.from_("rehearsal-videos").remove(storage_paths)
            except Exception:
                pass

    # Hard delete — cascades to team_members, subgroups, routines, videos, comments
    supabase.table("teams").delete().eq("team_id", team_id).execute()
    return {"ok": True}


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(team_id: str, user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can remove team members")

    _assert_choreographer_on_team(team_id, current_user["user_id"])

    # Prevent removing the choreographer themselves
    if user_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot remove yourself from the team")

    supabase.table("team_members") \
        .delete() \
        .eq("team_id", team_id) \
        .eq("user_id", user_id) \
        .execute()
    return {"ok": True}


@router.get("/{team_id}")
async def get_team(team_id: str, current_user: dict = Depends(get_current_user)):
    team = supabase.table("teams").select("*").eq("team_id", team_id).maybe_single().execute()
    if not team or not team.data:
        raise HTTPException(status_code=404, detail="Team not found")

    members_rows = supabase.table("team_members") \
        .select("team_member_id, user_id, role, status, joined_at") \
        .eq("team_id", team_id) \
        .eq("status", "active") \
        .execute()

    member_ids = [m["user_id"] for m in (members_rows.data or [])]
    users_rows = []
    if member_ids:
        users_rows = supabase.table("users") \
            .select("user_id, full_name, email, username, role") \
            .in_("user_id", member_ids) \
            .execute().data or []

    users_map = {u["user_id"]: u for u in users_rows}
    members = [
        {**m, "user": users_map.get(m["user_id"])}
        for m in (members_rows.data or [])
    ]

    subgroups = supabase.table("subgroups").select("*").eq("team_id", team_id).execute()

    # Active routines
    active_routines_res = supabase.table("routines") \
        .select("*") \
        .eq("team_id", team_id) \
        .is_("archived_at", "null") \
        .execute()
    active_routines = active_routines_res.data or []

    # Archived routines (only returned so choreographers can manage them)
    archived_routines_res = supabase.table("routines") \
        .select("*") \
        .eq("team_id", team_id) \
        .not_.is_("archived_at", "null") \
        .execute()
    archived_routines = archived_routines_res.data or []

    # Enrich active routines with unread_comment_count and has_unwatched_video
    all_routine_ids = [r["routine_id"] for r in active_routines]
    if all_routine_ids:
        vid_res = supabase.table("videos") \
            .select("video_id, routine_id") \
            .in_("routine_id", all_routine_ids) \
            .execute()
        vid_rows = vid_res.data or []
        video_ids = [v["video_id"] for v in vid_rows]
        video_to_routine = {v["video_id"]: v["routine_id"] for v in vid_rows}
        routine_to_video_ids: dict = {}
        for v in vid_rows:
            routine_to_video_ids.setdefault(v["routine_id"], []).append(v["video_id"])

        # Watched videos for current user
        watched_ids: set = set()
        if video_ids:
            views_res = supabase.table("video_views") \
                .select("video_id") \
                .eq("user_id", current_user["user_id"]) \
                .in_("video_id", video_ids) \
                .execute()
            watched_ids = {v["video_id"] for v in (views_res.data or [])}

        # Unread counts per routine (dancers only)
        routine_unread: dict = {}
        if video_ids and current_user["role"] == "dancer":
            comment_res = supabase.table("comments") \
                .select("comment_id, video_id") \
                .in_("video_id", video_ids) \
                .execute()
            all_coms = comment_res.data or []
            if all_coms:
                cids = [c["comment_id"] for c in all_coms]
                comment_to_routine = {
                    c["comment_id"]: video_to_routine[c["video_id"]]
                    for c in all_coms
                }
                unread_res = supabase.table("comment_recipients") \
                    .select("comment_id") \
                    .eq("user_id", current_user["user_id"]) \
                    .is_("acknowledged_at", "null") \
                    .in_("comment_id", cids) \
                    .execute()
                for r in (unread_res.data or []):
                    rid = comment_to_routine.get(r["comment_id"])
                    if rid:
                        routine_unread[rid] = routine_unread.get(rid, 0) + 1

        active_routines = [
            {
                **r,
                "unread_comment_count": routine_unread.get(r["routine_id"], 0),
                "has_unwatched_video": any(
                    vid not in watched_ids
                    for vid in routine_to_video_ids.get(r["routine_id"], [])
                ),
            }
            for r in active_routines
        ]

    return {
        **team.data,
        "members": members,
        "subgroups": subgroups.data or [],
        "routines": active_routines,
        "archived_routines": archived_routines,
    }


@router.get("/{team_id}/members")
async def get_team_members(team_id: str, current_user: dict = Depends(get_current_user)):
    rows = supabase.table("team_members") \
        .select("user_id, role, status") \
        .eq("team_id", team_id) \
        .eq("status", "active") \
        .execute()

    if not rows.data:
        return []

    user_ids = [r["user_id"] for r in rows.data]
    users = supabase.table("users") \
        .select("user_id, full_name, email, username, role") \
        .in_("user_id", user_ids) \
        .execute().data or []

    users_map = {u["user_id"]: u for u in users}
    return [{**r, "user": users_map.get(r["user_id"])} for r in rows.data]


@router.post("/{team_id}/members")
async def add_team_member(team_id: str, body: AddMemberByEmail, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can add team members")

    try:
        user_res = supabase.table("users").select("*").eq("email", body.email).maybe_single().execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"User lookup failed: {e}")

    if not user_res or not user_res.data:
        raise HTTPException(
            status_code=404,
            detail=f"No account found for {body.email}. They must sign up first.",
        )

    try:
        existing = supabase.table("team_members") \
            .select("team_member_id") \
            .eq("team_id", team_id) \
            .eq("user_id", user_res.data["user_id"]) \
            .limit(1) \
            .execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Membership check failed: {e}")

    if existing and existing.data:
        raise HTTPException(status_code=400, detail="This person is already a team member")

    try:
        result = supabase.table("team_members").insert({
            "team_id": team_id,
            "user_id": user_res.data["user_id"],
            "role": "dancer",
            "status": "active",
        }).execute()
        if not result.data:
            raise HTTPException(status_code=500, detail="Insert returned no data — check team_members constraints")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Insert failed: {e}")

    return {**result.data[0], "user": user_res.data}


@router.get("/{team_id}/subgroups")
async def get_team_subgroups(team_id: str, current_user: dict = Depends(get_current_user)):
    result = supabase.table("subgroups").select("*").eq("team_id", team_id).execute()
    return result.data or []
