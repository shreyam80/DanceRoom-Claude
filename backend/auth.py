from fastapi import Header, HTTPException
from database import supabase


async def get_current_auth_user(authorization: str = Header(...)) -> dict:
    """Validates the JWT and returns the Supabase auth user — does NOT require a profile row."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization[7:]
    try:
        response = supabase.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return response.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


async def get_current_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    token = authorization[7:]
    try:
        response = supabase.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        auth_user = response.user
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    profile = supabase.table("users").select("*").eq("user_id", str(auth_user.id)).maybe_single().execute()
    if not profile or not profile.data:
        raise HTTPException(
            status_code=404,
            detail="User profile not found. Signup may not have completed — try logging out and back in.",
        )
    return profile.data
