-- DanceRoom: Create all tables
-- Run this in: Supabase Dashboard → SQL Editor → New Query

-- ─── Users ─────────────────────────────────────────────────────────────────────
-- Mirrors auth.users with additional profile fields (role, username, full_name).
-- Populated automatically by the trigger below on every signup.
CREATE TABLE IF NOT EXISTS public.users (
  user_id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   TEXT,
  full_name  TEXT,
  email      TEXT,
  role       TEXT NOT NULL DEFAULT 'dancer' CHECK (role IN ('choreographer', 'dancer')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Organizations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organizations (
  organization_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  type               TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- ─── Organization Memberships ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.organization_memberships (
  membership_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member',
  status          TEXT NOT NULL DEFAULT 'active',
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

-- ─── Teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  team_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES public.organizations(organization_id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  description        TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- ─── Team Members ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.team_members (
  team_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id        UUID NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  role           TEXT NOT NULL DEFAULT 'dancer',
  status         TEXT NOT NULL DEFAULT 'active',
  joined_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (team_id, user_id)
);

-- ─── Subgroups ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subgroups (
  subgroup_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- ─── Subgroup Members ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subgroup_members (
  subgroup_member_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subgroup_id        UUID NOT NULL REFERENCES public.subgroups(subgroup_id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subgroup_id, user_id)
);

-- ─── Routines ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.routines (
  routine_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id            UUID NOT NULL REFERENCES public.teams(team_id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

-- ─── Videos ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.videos (
  video_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id          UUID NOT NULL REFERENCES public.routines(routine_id) ON DELETE CASCADE,
  uploaded_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  file_url            TEXT,
  storage_path        TEXT,
  version_number      INTEGER NOT NULL DEFAULT 1,
  recorded_at         TIMESTAMPTZ,
  uploaded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  duration_seconds    FLOAT
);

-- ─── Comments ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  comment_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id                UUID NOT NULL REFERENCES public.videos(video_id) ON DELETE CASCADE,
  author_user_id          UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  body                    TEXT NOT NULL,
  video_timestamp_seconds FLOAT NOT NULL,
  target_type             TEXT NOT NULL CHECK (target_type IN ('individual', 'subgroup', 'team')),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status                  TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by_user_id     UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  resolved_at             TIMESTAMPTZ
);

-- ─── Comment Targets ───────────────────────────────────────────────────────────
-- Records the intended audience (individual, subgroup, or team).
CREATE TABLE IF NOT EXISTS public.comment_targets (
  comment_target_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id        UUID NOT NULL REFERENCES public.comments(comment_id) ON DELETE CASCADE,
  user_id           UUID REFERENCES public.users(user_id) ON DELETE CASCADE,
  subgroup_id       UUID REFERENCES public.subgroups(subgroup_id) ON DELETE CASCADE,
  team_id           UUID REFERENCES public.teams(team_id) ON DELETE CASCADE
);

-- ─── Comment Recipients ────────────────────────────────────────────────────────
-- Expanded per-dancer rows derived from comment_targets.
-- Drives fast dancer dashboard queries and acknowledgement tracking.
CREATE TABLE IF NOT EXISTS public.comment_recipients (
  comment_recipient_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id           UUID NOT NULL REFERENCES public.comments(comment_id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  seen_at              TIMESTAMPTZ,
  acknowledged_at      TIMESTAMPTZ,
  status               TEXT NOT NULL DEFAULT 'pending',
  UNIQUE (comment_id, user_id)
);

-- ─── Auto-create user profile on signup ────────────────────────────────────────
-- Reads role, username, and full_name from Supabase Auth user metadata.
-- The frontend must pass these as options.data when calling supabase.auth.signUp().
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (user_id, email, full_name, username, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'dancer'),
    NOW()
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
