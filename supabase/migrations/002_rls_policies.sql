-- DanceRoom: Row Level Security policies
-- Run this AFTER 001_create_tables.sql
-- Note: the FastAPI backend uses the service role key and bypasses RLS.
-- These policies protect against any direct Supabase client calls.

-- ─── Enable RLS on all tables ──────────────────────────────────────────────────
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subgroups              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subgroup_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routines               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.videos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_targets        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_recipients     ENABLE ROW LEVEL SECURITY;

-- ─── USERS ─────────────────────────────────────────────────────────────────────
-- All authenticated users can read profiles (needed for email lookups and display names).
CREATE POLICY "users_select_all"
  ON public.users FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "users_insert_own"
  ON public.users FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- ─── ORGANIZATIONS ─────────────────────────────────────────────────────────────
CREATE POLICY "orgs_select_members"
  ON public.organizations FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR created_by_user_id = auth.uid()
  );

CREATE POLICY "orgs_insert_choreographers"
  ON public.organizations FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'choreographer')
  );

CREATE POLICY "orgs_update_creator"
  ON public.organizations FOR UPDATE TO authenticated
  USING (created_by_user_id = auth.uid());

-- ─── ORGANIZATION MEMBERSHIPS ──────────────────────────────────────────────────
CREATE POLICY "org_memberships_select"
  ON public.organization_memberships FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR organization_id IN (
      SELECT organization_id FROM public.organization_memberships
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "org_memberships_insert_creator"
  ON public.organization_memberships FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organizations
      WHERE organization_id = organization_id AND created_by_user_id = auth.uid()
    )
  );

-- ─── TEAMS ─────────────────────────────────────────────────────────────────────
CREATE POLICY "teams_select_members"
  ON public.teams FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR created_by_user_id = auth.uid()
  );

CREATE POLICY "teams_insert_choreographers"
  ON public.teams FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'choreographer')
  );

CREATE POLICY "teams_update_creator"
  ON public.teams FOR UPDATE TO authenticated
  USING (created_by_user_id = auth.uid());

-- ─── TEAM MEMBERS ──────────────────────────────────────────────────────────────
CREATE POLICY "team_members_select"
  ON public.team_members FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "team_members_insert_creator"
  ON public.team_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE team_id = team_id AND created_by_user_id = auth.uid()
    )
  );

-- ─── SUBGROUPS ─────────────────────────────────────────────────────────────────
CREATE POLICY "subgroups_select_team_members"
  ON public.subgroups FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR created_by_user_id = auth.uid()
  );

CREATE POLICY "subgroups_insert_creator"
  ON public.subgroups FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE team_id = team_id AND created_by_user_id = auth.uid()
    )
  );

-- ─── SUBGROUP MEMBERS ──────────────────────────────────────────────────────────
CREATE POLICY "subgroup_members_select"
  ON public.subgroup_members FOR SELECT TO authenticated
  USING (
    subgroup_id IN (
      SELECT sg.subgroup_id FROM public.subgroups sg
      JOIN public.team_members tm ON tm.team_id = sg.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "subgroup_members_insert_creator"
  ON public.subgroup_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.subgroups sg
      JOIN public.teams t ON t.team_id = sg.team_id
      WHERE sg.subgroup_id = subgroup_id AND t.created_by_user_id = auth.uid()
    )
  );

-- ─── ROUTINES ──────────────────────────────────────────────────────────────────
CREATE POLICY "routines_select_team_members"
  ON public.routines FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT team_id FROM public.team_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
    OR created_by_user_id = auth.uid()
  );

CREATE POLICY "routines_insert_choreographers"
  ON public.routines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'choreographer')
  );

-- ─── VIDEOS ────────────────────────────────────────────────────────────────────
CREATE POLICY "videos_select_team_members"
  ON public.videos FOR SELECT TO authenticated
  USING (
    routine_id IN (
      SELECT r.routine_id FROM public.routines r
      JOIN public.team_members tm ON tm.team_id = r.team_id
      WHERE tm.user_id = auth.uid()
    )
    OR uploaded_by_user_id = auth.uid()
  );

CREATE POLICY "videos_insert_choreographers"
  ON public.videos FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'choreographer')
  );

-- ─── COMMENTS ──────────────────────────────────────────────────────────────────
CREATE POLICY "comments_select_author_or_recipient"
  ON public.comments FOR SELECT TO authenticated
  USING (
    author_user_id = auth.uid()
    OR comment_id IN (
      SELECT comment_id FROM public.comment_recipients WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "comments_insert_choreographers"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.users WHERE user_id = auth.uid() AND role = 'choreographer')
  );

CREATE POLICY "comments_update_author_or_recipient"
  ON public.comments FOR UPDATE TO authenticated
  USING (
    author_user_id = auth.uid()
    OR comment_id IN (
      SELECT comment_id FROM public.comment_recipients WHERE user_id = auth.uid()
    )
  );

-- ─── COMMENT TARGETS ───────────────────────────────────────────────────────────
CREATE POLICY "comment_targets_select_author"
  ON public.comment_targets FOR SELECT TO authenticated
  USING (
    comment_id IN (
      SELECT comment_id FROM public.comments WHERE author_user_id = auth.uid()
    )
  );

CREATE POLICY "comment_targets_insert_author"
  ON public.comment_targets FOR INSERT TO authenticated
  WITH CHECK (
    comment_id IN (
      SELECT comment_id FROM public.comments WHERE author_user_id = auth.uid()
    )
  );

-- ─── COMMENT RECIPIENTS ────────────────────────────────────────────────────────
CREATE POLICY "comment_recipients_select"
  ON public.comment_recipients FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR comment_id IN (
      SELECT comment_id FROM public.comments WHERE author_user_id = auth.uid()
    )
  );

CREATE POLICY "comment_recipients_update_own"
  ON public.comment_recipients FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
