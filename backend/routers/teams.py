from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import TeamCreate, AddMemberByEmail

router = APIRouter(prefix="/teams", tags=["teams"])


@router.get("")
async def list_my_teams(current_user: dict = Depends(get_current_user)):
    rows = supabase.table("team_members") \
        .select("team_id") \
        .eq("user_id", current_user["user_id"]) \
        .eq("status", "active") \
        .execute()

    if not rows.data:
        return []

    team_ids = [r["team_id"] for r in rows.data]
    result = supabase.table("teams").select("*").in_("team_id", team_ids).execute()
    return result.data or []


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
    routines = supabase.table("routines").select("*").eq("team_id", team_id).execute()

    return {
        **team.data,
        "members": members,
        "subgroups": subgroups.data or [],
        "routines": routines.data or [],
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
