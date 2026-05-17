# DanceRoom

A video-based rehearsal feedback platform. Choreographers upload videos, leave timestamped targeted comments, and dancers watch with auto-pausing playback and acknowledgement.

---

## Prerequisites

- Node.js 18+
- Python 3.11+
- A [Supabase](https://supabase.com) project (URL, anon key, service role key)

---

## Environment Setup

Copy the example env file and fill in your Supabase credentials:

```bash
# Root .env is not used directly — set per-service below
```

**Backend** — create `backend/.env`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
FRONTEND_URL=http://localhost:5173
```

**Frontend** — create `frontend/.env`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_BASE_URL=http://localhost:8000
```

---

## Database Setup

Run the SQL migrations in order against your Supabase project (SQL Editor → paste and run):

1. `supabase/migrations/001_create_tables.sql`
2. `supabase/migrations/002_rls_policies.sql`

See `supabase/README.md` for storage bucket setup instructions.

---

## Running Locally

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```
API available at `http://localhost:8000`

### Frontend
```bash
cd frontend
npm install
npm run dev
```
App available at `http://localhost:5173`

---

## Project Structure

```
DanceRoom-Claude/
  frontend/        React + Vite + TypeScript + Tailwind
  backend/         FastAPI + Python + Supabase
  supabase/        SQL migrations and storage docs
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.11, Pydantic |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| Storage | Supabase Storage |
