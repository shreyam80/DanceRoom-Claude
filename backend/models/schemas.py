from pydantic import BaseModel
from typing import Optional


# ─── Users ─────────────────────────────────────────────────────────────────────

class UserUpsert(BaseModel):
    user_id: str
    email: str
    full_name: Optional[str] = None
    username: Optional[str] = None
    role: str  # "choreographer" | "dancer"


# ─── Organizations ─────────────────────────────────────────────────────────────

class OrganizationCreate(BaseModel):
    name: str
    type: Optional[str] = None


# ─── Teams ─────────────────────────────────────────────────────────────────────

class TeamCreate(BaseModel):
    organization_id: str
    name: str
    description: Optional[str] = None


class AddMemberByEmail(BaseModel):
    email: str


# ─── Subgroups ─────────────────────────────────────────────────────────────────

class SubgroupCreate(BaseModel):
    team_id: str
    name: str


class AddSubgroupMember(BaseModel):
    user_id: str


# ─── Routines ──────────────────────────────────────────────────────────────────

class RoutineCreate(BaseModel):
    team_id: str
    title: str


# ─── Videos ────────────────────────────────────────────────────────────────────

class VideoCreate(BaseModel):
    routine_id: str
    storage_path: str
    file_url: str
    duration_seconds: Optional[float] = None


# ─── Comments ──────────────────────────────────────────────────────────────────

class CommentCreate(BaseModel):
    video_id: str
    body: str
    video_timestamp_seconds: float
    target_type: str   # "individual" | "subgroup" | "team"
    target_id: str     # user_id, subgroup_id, or team_id depending on target_type
