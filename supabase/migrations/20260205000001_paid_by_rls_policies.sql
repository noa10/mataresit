-- Migration: RLS policies for paid_by table
-- Date: 2026-02-05
-- Purpose: Enable row-level security for paid_by table following custom_categories pattern

-- =============================================
-- 1. ENABLE RLS
-- =============================================

ALTER TABLE public.paid_by ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. SELECT POLICIES
-- =============================================

-- Users can view their personal payers and team payers they have access to
CREATE POLICY "Users can view accessible payers" ON public.paid_by
  FOR SELECT USING (
    -- Personal payers (user owns them)
    (auth.uid() = user_id AND team_id IS NULL)
    OR
    -- Team payers (user is team member)
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = paid_by.team_id
      AND user_id = auth.uid()
    ))
  );

-- =============================================
-- 3. INSERT POLICIES
-- =============================================

-- Users can insert personal payers
CREATE POLICY "Users can insert personal payers" ON public.paid_by
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND team_id IS NULL
  );

-- Team members can insert team payers
CREATE POLICY "Team members can insert team payers" ON public.paid_by
  FOR INSERT WITH CHECK (
    team_id IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = paid_by.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

-- =============================================
-- 4. UPDATE POLICIES
-- =============================================

-- Users can update their personal payers
CREATE POLICY "Users can update their personal payers" ON public.paid_by
  FOR UPDATE USING (
    auth.uid() = user_id AND team_id IS NULL
  ) WITH CHECK (
    auth.uid() = user_id AND team_id IS NULL
  );

-- Team members can update team payers
CREATE POLICY "Team members can update team payers" ON public.paid_by
  FOR UPDATE USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = paid_by.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  ) WITH CHECK (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = paid_by.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

-- =============================================
-- 5. DELETE POLICIES
-- =============================================

-- Users can delete their personal payers
CREATE POLICY "Users can delete their personal payers" ON public.paid_by
  FOR DELETE USING (
    auth.uid() = user_id AND team_id IS NULL
  );

-- Team admins/owners can delete team payers
CREATE POLICY "Team admins can delete team payers" ON public.paid_by
  FOR DELETE USING (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = paid_by.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );
