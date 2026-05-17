from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import FRONTEND_URL
from routers import users, organizations, teams, subgroups, routines, videos, comments

app = FastAPI(title="DanceRoom API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(users.router)
app.include_router(organizations.router)
app.include_router(teams.router)
app.include_router(subgroups.router)
app.include_router(routines.router)
app.include_router(videos.router)
app.include_router(comments.router)


@app.get("/health")
def health():
    return {"status": "ok"}
