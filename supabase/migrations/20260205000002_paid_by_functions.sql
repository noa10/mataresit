-- Migration: RPC functions for paid_by management
-- Date: 2026-02-05
-- Purpose: Create functions for fetching payers with receipt counts

-- =============================================
-- 1. GET USER PAYERS WITH COUNTS
-- =============================================

CREATE OR REPLACE FUNCTION public.get_user_payers_with_counts(
  p_user_id uuid DEFAULT auth.uid(),
  p_team_id uuid DEFAULT NULL
)
RETURNS TABLE(
  id uuid, 
  name text, 
  created_at timestamp with time zone, 
  updated_at timestamp with time zone, 
  receipt_count bigint,
  team_id uuid,
  is_team_payer boolean
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
      RAISE EXCEPTION 'Access denied to team payers';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    pb.id,
    pb.name,
    pb.created_at,
    pb.updated_at,
    COALESCE(receipt_counts.count, 0) as receipt_count,
    pb.team_id,
    (pb.team_id IS NOT NULL) as is_team_payer
  FROM public.paid_by pb
  LEFT JOIN (
    SELECT 
      paid_by_id,
      COUNT(*) as count
    FROM public.receipts r
    WHERE 
      r.paid_by_id IS NOT NULL
      AND (
        -- Personal receipts
        (p_team_id IS NULL AND r.user_id = p_user_id AND r.team_id IS NULL)
        OR
        -- Team receipts
        (p_team_id IS NOT NULL AND r.team_id = p_team_id)
      )
    GROUP BY paid_by_id
  ) receipt_counts ON pb.id = receipt_counts.paid_by_id
  WHERE 
    -- Exclude archived payers
    pb.archived = false
    AND (
      -- Personal payers when no team context
      (p_team_id IS NULL AND pb.user_id = p_user_id AND pb.team_id IS NULL)
      OR
      -- Team payers when in team context
      (p_team_id IS NOT NULL AND pb.team_id = p_team_id)
    )
  ORDER BY pb.name;
END;
$$;

COMMENT ON FUNCTION public.get_user_payers_with_counts(uuid, uuid) IS 'Fetch payers with receipt counts. Supports both personal (team_id=NULL) and team payers.';

-- =============================================
-- 2. CREATE PAYER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.create_payer(
  p_name text,
  p_team_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_payer_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- If team_id is provided, verify user is team member with appropriate role
  IF p_team_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = p_team_id
      AND user_id = v_user_id
      AND role IN ('owner', 'admin', 'member')
    ) THEN
      RAISE EXCEPTION 'Access denied to create team payers';
    END IF;
  END IF;

  -- Insert the payer
  INSERT INTO public.paid_by (user_id, team_id, name)
  VALUES (v_user_id, p_team_id, p_name)
  RETURNING id INTO v_payer_id;

  RETURN v_payer_id;
END;
$$;

COMMENT ON FUNCTION public.create_payer(text, uuid) IS 'Create a new payer. Pass team_id for team payers.';

-- =============================================
-- 3. UPDATE PAYER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.update_payer(
  p_payer_id uuid,
  p_name text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_payer record;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Get payer details
  SELECT * INTO v_payer FROM public.paid_by WHERE id = p_payer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payer not found';
  END IF;

  -- Check access
  IF v_payer.team_id IS NULL THEN
    -- Personal payer - must be owner
    IF v_payer.user_id != v_user_id THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSE
    -- Team payer - must be team member
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = v_payer.team_id
      AND user_id = v_user_id
      AND role IN ('owner', 'admin', 'member')
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  -- Update the payer
  UPDATE public.paid_by
  SET name = p_name, updated_at = now()
  WHERE id = p_payer_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.update_payer(uuid, text) IS 'Update a payer name.';

-- =============================================
-- 4. ARCHIVE PAYER FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION public.archive_payer(
  p_payer_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_payer record;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Get payer details
  SELECT * INTO v_payer FROM public.paid_by WHERE id = p_payer_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payer not found';
  END IF;

  -- Check access
  IF v_payer.team_id IS NULL THEN
    -- Personal payer - must be owner
    IF v_payer.user_id != v_user_id THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  ELSE
    -- Team payer - must be team admin/owner
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = v_payer.team_id
      AND user_id = v_user_id
      AND role IN ('owner', 'admin')
    ) THEN
      RAISE EXCEPTION 'Access denied';
    END IF;
  END IF;

  -- Archive the payer (soft delete)
  UPDATE public.paid_by
  SET archived = true, updated_at = now()
  WHERE id = p_payer_id;

  RETURN true;
END;
$$;

COMMENT ON FUNCTION public.archive_payer(uuid) IS 'Soft delete a payer by setting archived = true.';
