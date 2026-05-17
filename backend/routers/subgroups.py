from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import SubgroupCreate, AddSubgroupMember

router = APIRouter(prefix="/subgroups", tags=["subgroups"])


@router.post("")
async def create_subgroup(body: SubgroupCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can create subgroups")

    result = supabase.table("subgroups").insert({
        "team_id": body.team_id,
        "name": body.name,
        "created_by_user_id": current_user["user_id"],
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create subgroup")
    return result.data[0]


@router.get("/{subgroup_id}")
async def get_subgroup(subgroup_id: str, current_user: dict = Depends(get_current_user)):
    sg = supabase.table("subgroups").select("*").eq("subgroup_id", subgroup_id).maybe_single().execute()
    if not sg or not sg.data:
        raise HTTPException(status_code=404, detail="Subgroup not found")

    member_rows = supabase.table("subgroup_members") \
        .select("user_id, joined_at") \
        .eq("subgroup_id", subgroup_id) \
        .execute()

    user_ids = [m["user_id"] for m in (member_rows.data or [])]
    users = []
    if user_ids:
        users = supabase.table("users") \
            .select("user_id, full_name, email, username") \
            .in_("user_id", user_ids) \
            .execute().data or []

    users_map = {u["user_id"]: u for u in users}
    members = [{**m, "user": users_map.get(m["user_id"])} for m in (member_rows.data or [])]

    return {**sg.data, "members": members}


@router.post("/{subgroup_id}/members")
async def add_subgroup_member(subgroup_id: str, body: AddSubgroupMember, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can manage subgroup members")

    sg = supabase.table("subgroups").select("team_id").eq("subgroup_id", subgroup_id).maybe_single().execute()
    if not sg or not sg.data:
        raise HTTPException(status_code=404, detail="Subgroup not found")

    is_member = supabase.table("team_members") \
        .select("team_member_id") \
        .eq("team_id", sg.data["team_id"]) \
        .eq("user_id", body.user_id) \
        .limit(1) \
        .execute()
    if not is_member or not is_member.data:
        raise HTTPException(status_code=400, detail="User must be a team member before joining a subgroup")

    result = supabase.table("subgroup_members").insert({
        "subgroup_id": subgroup_id,
        "user_id": body.user_id,
    }).execute()
    return result.data[0]
