from fastapi import APIRouter, Depends, HTTPException
from database import supabase
from auth import get_current_user
from models.schemas import UserUpsert

router = APIRouter(prefix="/users", tags=["users"])


@router.post("")
async def upsert_user(body: UserUpsert, current_user: dict = Depends(get_current_user)):
    result = supabase.table("users").upsert(
        {
            "user_id": body.user_id,
            "email": body.email,
            "full_name": body.full_name,
            "username": body.username,
            "role": body.role,
        },
        on_conflict="user_id",
    ).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to save user profile")
    return result.data[0]


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return current_user
