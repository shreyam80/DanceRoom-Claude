# DanceRoom — Claude Context

## What This Project Is

DanceRoom is a desktop-first web MVP for dance studio pilots. Choreographers upload rehearsal videos, leave timestamped targeted feedback comments, and dancers watch the videos with auto-pausing playback and acknowledgement. The MVP is fully built and functional.

**Core workflow:**
1. Choreographer creates org → team → adds dancers by email → creates subgroups → creates routine
2. Choreographer uploads video to routine (direct to Supabase Storage)
3. Choreographer opens review page, watches video, clicks "+ Add feedback at M:SS", picks target (individual dancer / subgroup / whole team), writes comment
4. Dancer logs in, sees their teams, opens routine, clicks "Watch"
5. Video auto-pauses at each feedback timestamp, dancer reads it and clicks "Acknowledge"
6. Either side can "Resolve" a comment to mark it done

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TypeScript + Tailwind CSS v3 |
| Backend | FastAPI (Python 3.9) + uvicorn |
| Auth | Supabase Auth (email/password, no email confirmation) |
| Database | Supabase (PostgreSQL) with RLS |
| Storage | Supabase Storage — public bucket `rehearsal-videos` |
| HTTP client | Axios with Bearer token interceptor |
| Router | React Router v7 |

---

## How to Run

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
# Runs on http://localhost:8000
```

**Frontend:**
```bash
cd frontend
npm run dev
# Runs on http://localhost:5173
```

---

## Environment Variables

**`backend/.env`** (never commit):
```
SUPABASE_URL=https://hfupatqnbgtxjsbuczgq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service role JWT>
FRONTEND_URL=http://localhost:5173
```

**`frontend/.env`** (never commit):
```
VITE_SUPABASE_URL=https://hfupatqnbgtxjsbuczgq.supabase.co
VITE_SUPABASE_ANON_KEY=<anon JWT>
VITE_API_BASE_URL=http://localhost:8000
```

**Critical:** The backend uses the **service role key** (bypasses RLS). The frontend uses the **anon key** (for Supabase Auth only). Never mix them up. The SUPABASE_URL must be the base URL only — no `/rest/v1/` suffix.

---

## Project Structure

```
DanceRoom-Claude/
├── backend/
│   ├── main.py              # FastAPI app, CORS, all routers registered
│   ├── config.py            # pydantic BaseSettings, loads .env
│   ├── database.py          # supabase client (service role key)
│   ├── auth.py              # get_current_user + get_current_auth_user dependencies
│   ├── models/
│   │   └── schemas.py       # All Pydantic request models
│   └── routers/
│       ├── users.py         # POST /users, GET /users/me
│       ├── organizations.py # POST /organizations, GET /organizations, GET /organizations/{id}
│       ├── teams.py         # GET /teams, POST /teams, GET /teams/{id}, POST /teams/{id}/members, GET /teams/{id}/subgroups
│       ├── subgroups.py     # POST /subgroups, GET /subgroups/{id}, POST /subgroups/{id}/members
│       ├── routines.py      # POST /routines, GET /routines/{id}
│       ├── videos.py        # POST /videos, GET /videos/{id}, GET /videos/{id}/comments, GET /videos/{id}/comments/my
│       └── comments.py      # POST /comments, POST /comments/{id}/acknowledge, POST /comments/{id}/resolve
├── frontend/src/
│   ├── App.tsx              # All routes wired up
│   ├── lib/
│   │   ├── supabase.ts      # Supabase JS client (anon key)
│   │   └── api.ts           # Axios instance with Bearer token interceptor
│   ├── contexts/
│   │   └── AuthContext.tsx  # session, profile, signUp, signIn, signOut, refreshProfile
│   ├── components/
│   │   ├── ProtectedRoute.tsx       # Redirects to /login if no session
│   │   └── AddFeedbackModal.tsx     # Modal for choreographer to add timestamped feedback
│   └── pages/
│       ├── Login.tsx
│       ├── Signup.tsx
│       ├── Dashboard.tsx            # Org list (choreographer) or team list (dancer)
│       ├── OrganizationNewPage.tsx  # Create org form
│       ├── OrganizationPage.tsx     # Org detail + team list + create team
│       ├── TeamPage.tsx             # Team detail + members + subgroups + routines
│       ├── RoutinePage.tsx          # Routine detail + video list + upload
│       ├── VideoReviewPage.tsx      # Choreographer: video player + timeline + feedback sidebar
│       └── VideoWatchPage.tsx       # Dancer: video player + auto-pause modal + acknowledge
└── supabase/
    └── migrations/
        ├── 001_create_tables.sql        # All 12 tables + handle_new_user trigger
        ├── 001b_patch_existing_users.sql # Adds role/username/full_name to pre-existing users table
        └── 002_rls_policies.sql         # RLS policies for all tables
```

---

## Database Schema (12 tables)

```
users                  — mirrors auth.users, adds role/username/full_name
organizations          — created by choreographers
organization_memberships — user ↔ org (role: admin/member, status: active)
teams                  — belong to an org
team_members           — user ↔ team (role: choreographer/dancer, status: active)
subgroups              — sub-grouping within a team
subgroup_members       — user ↔ subgroup
routines               — belong to a team
videos                 — belong to a routine, have file_url + storage_path + version_number
comments               — on a video, with video_timestamp_seconds and target_type (individual/subgroup/team)
comment_targets        — one row per comment, records the specific target (user_id / subgroup_id / team_id)
comment_recipients     — expanded per-dancer rows; tracks acknowledged_at and status
```

**Important:** `organizations.type` has a NOT NULL constraint in the DB (even though the migration says nullable). Always send `body.type or ""` — never send null.

---

## Auth Architecture

### Two auth dependencies (backend/auth.py)

- **`get_current_auth_user`** — validates JWT only, does NOT require a profile row in `public.users`. Used only by `POST /users` (the profile creation endpoint itself).
- **`get_current_user`** — validates JWT AND fetches the `public.users` profile row. Returns the full profile dict. Used by all other protected routes.

### Why two dependencies exist
`POST /users` is the profile creation endpoint. If it used `get_current_user`, it would require the profile to already exist — a circular dependency. The fix was `get_current_auth_user` which only validates the JWT.

### Signup flow (frontend/src/contexts/AuthContext.tsx)
1. `supabase.auth.signUp()` → returns `data.user` and `data.session`
2. Immediately `POST /users` with the token from `data.session.access_token` passed **directly** in headers (not via interceptor), because `getSession()` may lag behind the new session
3. `fetchProfile()` to populate context

### Login flow
1. `supabase.auth.signInWithPassword()`
2. Try `GET /users/me` — if 404, auto-create profile from `data.user.user_metadata`
3. Profile is set in context

### Axios interceptor (frontend/src/lib/api.ts)
Every request gets `Authorization: Bearer <token>` injected from `supabase.auth.getSession()`. No manual token handling in components.

---

## Supabase Storage

- Bucket name: `rehearsal-videos` (public bucket)
- Upload path: `{user_id}/{routine_id}/{timestamp}.{ext}`
- Files uploaded directly from the frontend using the Supabase JS client
- Public URL retrieved via `supabase.storage.from('rehearsal-videos').getPublicUrl(path)`
- URL stored permanently in `videos.file_url` — no signed URLs, no expiry
- Required storage policies (run once in Supabase SQL editor):
  ```sql
  CREATE POLICY "Authenticated users can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rehearsal-videos');

  CREATE POLICY "Public read access"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'rehearsal-videos');
  ```

---

## Critical Bugs Fixed (do not reintroduce)

### 1. `maybe_single()` returns `None` when no row found
In supabase-py v2.4.2, `maybe_single().execute()` returns `None` (not an object with `data=None`) when no row matches. Accessing `.data` on `None` crashes with AttributeError → 500.

**Pattern used everywhere:**
```python
result = supabase.table(...).maybe_single().execute()
if not result or not result.data:
    raise HTTPException(status_code=404, ...)
```

For "does this membership exist?" checks, use `.limit(1)` instead:
```python
existing = supabase.table(...).limit(1).execute()
if existing and existing.data:
    raise HTTPException(status_code=400, detail="Already a member")
```

### 2. `POST /users` circular dependency
Using `get_current_user` on `POST /users` caused a 404 loop (profile doesn't exist → can't create profile). Fixed by using `get_current_auth_user` (JWT-only validation) on that one endpoint.

### 3. Signup token lag
After `supabase.auth.signUp()`, calling `supabase.auth.getSession()` via the axios interceptor may not have the new session yet. Fixed by passing `data.session.access_token` directly in the `POST /users` call headers.

### 4. org type NOT NULL
The `organizations` table has `type TEXT NOT NULL` in the DB. The backend always sends `body.type or ""` to avoid null violations.

### 5. Supabase email confirmation
Email confirmation must be **disabled** in Supabase Dashboard → Authentication → Providers → Email → "Confirm email" toggle OFF. Otherwise signup returns "Email not confirmed" error.

---

## Comment System

### Creating a comment (POST /comments)
1. Insert into `comments` (has `target_type`: individual/subgroup/team)
2. Insert into `comment_targets` (records the specific target ID)
3. Expand to `comment_recipients`:
   - `individual` → 1 row
   - `subgroup` → one row per `subgroup_members` row
   - `team` → one row per active `team_members` row (excluding the author)

### GET /videos/{id}/comments (choreographer)
Returns all comments enriched with `target_label` and `target_id` (fetched from `comment_targets` + users/subgroups tables).

### GET /videos/{id}/comments/my (dancer)
Returns only comments where the caller has a `comment_recipients` row. Includes `acknowledged_at`.

### Acknowledge flow
`POST /comments/{id}/acknowledge` → sets `acknowledged_at` and `status = 'acknowledged'` on the `comment_recipients` row.

### Dancer auto-pause invariant
The `acknowledgedIds` ref (a `Set<string>`) is pre-populated on load from comments where `acknowledged_at` is non-null. Once in the set, a comment never triggers again — even if the dancer scrubs back past that timestamp.

```typescript
const hit = comments.find(
  c => !acknowledgedIds.current.has(c.comment_id) &&
       Math.abs(time - c.video_timestamp_seconds) < 0.5
)
if (hit && !activeComment) {
  videoRef.current.pause()
  setActiveComment(hit)
}
```

---

## Tailwind Brand Colors

Primary color: `brand-600` = `#7c3aed` (purple). Scale: `brand-50` through `brand-900`. Defined in `frontend/tailwind.config.js`. The review/watch pages use a dark theme (`bg-gray-900`, `bg-gray-800`) while all other pages use light theme (`bg-gray-50`, `bg-white`).

---

## Git History (all commits on `main`)

```
fdb094a feat: resolve comments for choreographers and dancers
78f9ce5 feat: dancer watch page — filtered comments, auto-pause on timestamp, acknowledge
9e35bb8 feat: choreographer review page — video player, timeline markers, feedback modal, sidebar
d86419d feat: routines and video upload to supabase storage (public bucket)
8ff16e4 feat: orgs, teams, subgroups — create and add members
611f232 fix: explicitly create profile on signup; recover missing profile on login
951c380 feat: auth — login, signup with role, protected routes, dashboard landing
5322a0e feat: fastapi backend — supabase client, auth middleware, all routes
04bdbeb fix: patch pre-existing users table to add role, username, full_name columns
e476863 feat: supabase SQL migrations for all tables and RLS policies
4d1b9d6 feat: initial project scaffold
```

---

## What Is NOT Done (potential next steps)

- **Deployment** — not deployed anywhere yet; runs fully local
- **Video duration** — `duration_seconds` is saved as `null`; the frontend doesn't extract it from the video element before uploading
- **Version numbering** — currently counts existing videos for the routine and increments; this could race if two uploads happen simultaneously
- **Dancer subgroup visibility** — dancers see all subgroups on the team page, not just their own
- **Email notifications** — no notifications when feedback is added
- **Mobile responsiveness** — built desktop-first; review/watch pages have a fixed 320px sidebar that breaks on small screens
- **Video format support** — `.mov` files work but may not play in all browsers (codec dependent); no transcoding
- **Delete / edit** — no way to delete orgs, teams, routines, videos, or comments
- **Pagination** — no limits on any list queries
