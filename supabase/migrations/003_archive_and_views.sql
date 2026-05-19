-- Archiving support for routines and teams
ALTER TABLE public.routines ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE public.teams    ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Video watch tracking: one row per (user, video) once they've played it
CREATE TABLE IF NOT EXISTS public.video_views (
  view_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id        UUID NOT NULL REFERENCES public.videos(video_id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(user_id)  ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (video_id, user_id)
);
