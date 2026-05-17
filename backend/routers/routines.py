from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import RoutineCreate

router = APIRouter(prefix="/routines", tags=["routines"])


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


@router.get("/{routine_id}")
async def get_routine(routine_id: str, current_user: dict = Depends(get_current_user)):
    routine = supabase.table("routines").select("*").eq("routine_id", routine_id).maybe_single().execute()
    if not routine or not routine.data:
        raise HTTPException(status_code=404, detail="Routine not found")

    videos = supabase.table("videos") \
        .select("*") \
        .eq("routine_id", routine_id) \
        .order("version_number") \
        .execute()

    return {**routine.data, "videos": videos.data or []}
