-- Migration: Add Team Categories Support
-- Date: 2025-07-05
-- Purpose: Enable team-shared categories while maintaining personal categories

-- =============================================
-- 1. ADD TEAM_ID COLUMN TO CUSTOM_CATEGORIES
-- =============================================

-- Add team_id column to custom_categories table
ALTER TABLE public.custom_categories 
ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

-- Add index for team categories
CREATE INDEX idx_custom_categories_team_id ON public.custom_categories(team_id);

-- Add composite index for user and team categories
CREATE INDEX idx_custom_categories_user_team ON public.custom_categories(user_id, team_id);

-- =============================================
-- 2. UPDATE RLS POLICIES FOR TEAM CATEGORIES
-- =============================================

-- Drop existing RLS policies
DROP POLICY IF EXISTS "Users can view their own categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON public.custom_categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON public.custom_categories;

-- Create new RLS policies that support both personal and team categories
CREATE POLICY "Users can view accessible categories" ON public.custom_categories
  FOR SELECT USING (
    -- Personal categories (user owns them)
    (auth.uid() = user_id AND team_id IS NULL)
    OR
    -- Team categories (user is team member)
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = custom_categories.team_id
      AND user_id = auth.uid()
    ))
  );

CREATE POLICY "Users can insert personal categories" ON public.custom_categories
  FOR INSERT WITH CHECK (
    -- Personal categories only
    auth.uid() = user_id AND team_id IS NULL
  );

CREATE POLICY "Team members can insert team categories" ON public.custom_categories
  FOR INSERT WITH CHECK (
    -- Team categories (user must be team member with appropriate role)
    team_id IS NOT NULL
    AND auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = custom_categories.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Users can update their personal categories" ON public.custom_categories
  FOR UPDATE USING (
    -- Personal categories only
    auth.uid() = user_id AND team_id IS NULL
  ) WITH CHECK (
    auth.uid() = user_id AND team_id IS NULL
  );

CREATE POLICY "Team members can update team categories" ON public.custom_categories
  FOR UPDATE USING (
    -- Team categories (user must be team member)
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = custom_categories.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  ) WITH CHECK (
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = custom_categories.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Users can delete their personal categories" ON public.custom_categories
  FOR DELETE USING (
    -- Personal categories only
    auth.uid() = user_id AND team_id IS NULL
  );

CREATE POLICY "Team admins can delete team categories" ON public.custom_categories
  FOR DELETE USING (
    -- Team categories (user must be team admin/owner)
    team_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = custom_categories.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'admin')
    )
  );

-- =============================================
-- 3. CREATE TEAM-AWARE CATEGORY FUNCTIONS
-- =============================================

-- Drop existing function
DROP FUNCTION IF EXISTS public.get_user_categories_with_counts(uuid);

-- Create new team-aware function
CREATE OR REPLACE FUNCTION public.get_user_categories_with_counts(
  p_user_id uuid DEFAULT auth.uid(),
  p_team_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid, 
  name text, 
  color text, 
  icon text, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  receipt_count bigint,
  team_id uuid,
  is_team_category boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user can access their own data
  IF p_user_id != auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  -- If team_id is provided, verify user is team member
  IF p_team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = p_team_id
      AND user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Access denied to team categories';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    c.id,
    c.name,
    c.color,
    c.icon,
    c.created_at,
    c.updated_at,
    COALESCE(receipt_counts.count, 0) as receipt_count,
    c.team_id,
    (c.team_id IS NOT NULL) as is_team_category
  FROM public.custom_categories c
  LEFT JOIN (
    SELECT 
      category_id,
      COUNT(*) as count
    FROM public.receipts r
    WHERE 
      r.category_id IS NOT NULL
      AND (
        -- Personal receipts
        (p_team_id IS NULL AND r.user_id = p_user_id AND r.team_id IS NULL)
        OR
        -- Team receipts
        (p_team_id IS NOT NULL AND r.team_id = p_team_id)
      )
    GROUP BY category_id
  ) receipt_counts ON c.id = receipt_counts.category_id
  WHERE 
    -- Personal categories when no team context
    (p_team_id IS NULL AND c.user_id = p_user_id AND c.team_id IS NULL)
    OR
    -- Team categories when in team context
    (p_team_id IS NOT NULL AND c.team_id = p_team_id)
  ORDER BY c.name;
END;
$$;

-- =============================================
-- 4. CREATE DEFAULT TEAM CATEGORIES FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.create_default_team_categories(
  p_team_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify user can create team categories
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id
    AND user_id = p_user_id
    AND role IN ('owner', 'admin')
  ) THEN
    RAISE EXCEPTION 'Access denied to create team categories';
  END IF;

  -- Insert default team categories
  INSERT INTO public.custom_categories (user_id, team_id, name, color, icon)
  VALUES 
    (p_user_id, p_team_id, 'Office Supplies', '#3B82F6', 'briefcase'),
    (p_user_id, p_team_id, 'Travel & Transport', '#10B981', 'car'),
    (p_user_id, p_team_id, 'Meals & Entertainment', '#F59E0B', 'utensils'),
    (p_user_id, p_team_id, 'Equipment', '#8B5CF6', 'laptop'),
    (p_user_id, p_team_id, 'Marketing', '#EF4444', 'megaphone'),
    (p_user_id, p_team_id, 'Utilities', '#6B7280', 'zap')
  ON CONFLICT DO NOTHING;
END;
$$;

-- =============================================
-- 5. ADD COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON COLUMN public.custom_categories.team_id IS 'Team ID for team-shared categories. NULL for personal categories.';
COMMENT ON FUNCTION public.get_user_categories_with_counts(uuid, uuid) IS 'Fetch categories with receipt counts. Supports both personal (team_id=NULL) and team categories.';
COMMENT ON FUNCTION public.create_default_team_categories(uuid, uuid) IS 'Create default categories for a team. Only team admins/owners can call this.';
