-- Fix ambiguous column references in get_user_payers_with_counts function
-- The issue: RETURNS TABLE defines column names that conflict with table columns in the query
-- Solution: Explicitly alias all SELECT columns to match RETURNS TABLE columns

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
      WHERE team_members.team_id = p_team_id
      AND team_members.user_id = p_user_id
    ) THEN
      RAISE EXCEPTION 'Access denied to team payers';
    END IF;
  END IF;

  RETURN QUERY
  SELECT 
    pb.id AS id,
    pb.name AS name,
    pb.created_at AS created_at,
    pb.updated_at AS updated_at,
    COALESCE(receipt_counts.count, 0) AS receipt_count,
    pb.team_id AS team_id,
    (pb.team_id IS NOT NULL) AS is_team_payer
  FROM public.paid_by pb
  LEFT JOIN (
    SELECT 
      r.paid_by_id,
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
    GROUP BY r.paid_by_id
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

COMMENT ON FUNCTION public.get_user_payers_with_counts(uuid, uuid) IS 'Fetch payers with receipt counts. Supports both personal (team_id=NULL) and team payers. Fixed ambiguous column references.';
