-- DanceRoom: Patch existing users table to add missing columns.
-- Run this if 001_create_tables.sql skipped the users table because it already existed.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS username   TEXT,
  ADD COLUMN IF NOT EXISTS full_name  TEXT,
  ADD COLUMN IF NOT EXISTS role       TEXT NOT NULL DEFAULT 'dancer',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Add the CHECK constraint on role if it isn't already there.
-- Safe to run: DO block catches the duplicate-constraint error silently.
DO $$
BEGIN
  ALTER TABLE public.users
    ADD CONSTRAINT users_role_check CHECK (role IN ('choreographer', 'dancer'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
