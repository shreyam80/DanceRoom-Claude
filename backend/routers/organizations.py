from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import OrganizationCreate

router = APIRouter(prefix="/organizations", tags=["organizations"])


@router.post("")
async def create_organization(body: OrganizationCreate, current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "choreographer":
        raise HTTPException(status_code=403, detail="Only choreographers can create organizations")

    org = supabase.table("organizations").insert({
        "name": body.name,
        "type": body.type or "",
        "created_by_user_id": current_user["user_id"],
    }).execute()
    if not org.data:
        raise HTTPException(status_code=500, detail="Failed to create organization")

    org_data = org.data[0]

    supabase.table("organization_memberships").insert({
        "organization_id": org_data["organization_id"],
        "user_id": current_user["user_id"],
        "role": "admin",
        "status": "active",
    }).execute()

    return org_data


@router.get("")
async def list_organizations(current_user: dict = Depends(get_current_user)):
    memberships = supabase.table("organization_memberships") \
        .select("organization_id") \
        .eq("user_id", current_user["user_id"]) \
        .eq("status", "active") \
        .execute()

    if not memberships.data:
        return []

    org_ids = [m["organization_id"] for m in memberships.data]
    result = supabase.table("organizations").select("*").in_("organization_id", org_ids).execute()
    return result.data or []


@router.get("/{organization_id}")
async def get_organization(organization_id: str, current_user: dict = Depends(get_current_user)):
    org = supabase.table("organizations") \
        .select("*") \
        .eq("organization_id", organization_id) \
        .maybe_single() \
        .execute()
    if not org or not org.data:
        raise HTTPException(status_code=404, detail="Organization not found")

    teams = supabase.table("teams").select("*").eq("organization_id", organization_id).execute()

    return {**org.data, "teams": teams.data or []}
