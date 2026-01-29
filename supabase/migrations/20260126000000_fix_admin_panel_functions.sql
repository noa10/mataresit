-- Migration: Fix Admin Panel Functions
-- Creates missing get_admin_system_stats() function and updates get_feedback_analytics()
-- to use proper admin role check via user_roles table

-- ============================================================================
-- 0. ENSURE DEPENDENCIES EXIST (app_role, has_role)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role') THEN
    CREATE TYPE public.app_role AS ENUM ('admin', 'user');
  END IF;
END$$;

-- Create helper function to check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(
  _user_id UUID          DEFAULT auth.uid(),
  _role    public.app_role DEFAULT 'user'::public.app_role
) RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- ============================================================================
-- 1. CREATE GET_ADMIN_SYSTEM_STATS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION get_admin_system_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin BOOLEAN;
  result JSON;
  v_user_count BIGINT;
  v_receipt_count BIGINT;
  v_active_users_count BIGINT;
  v_recent_activity JSONB;
BEGIN
  -- Check if user is admin using the user_roles table
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  -- Get total user count from auth.users
  SELECT COUNT(*) INTO v_user_count FROM auth.users;

  -- Get total receipt count
  SELECT COUNT(*) INTO v_receipt_count FROM public.receipts;

  -- Get active users count (signed in within last 30 days)
  SELECT COUNT(*) INTO v_active_users_count 
  FROM auth.users 
  WHERE last_sign_in_at >= NOW() - INTERVAL '30 days';

  -- Get recent activity (last 10 receipts with user email)
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', r.id,
        'merchant', r.merchant,
        'total', r.total,
        'currency', r.currency,
        'date', r.date,
        'created_at', r.created_at,
        'user_id', r.user_id,
        'user_email', u.email
      ) ORDER BY r.created_at DESC
    ),
    '[]'::jsonb
  ) INTO v_recent_activity
  FROM (
    SELECT * FROM public.receipts 
    ORDER BY created_at DESC 
    LIMIT 10
  ) r
  LEFT JOIN auth.users u ON r.user_id = u.id;

  -- Build result JSON
  result := json_build_object(
    'userCount', v_user_count,
    'receiptCount', v_receipt_count,
    'activeUsersCount', v_active_users_count,
    'recentActivity', v_recent_activity,
    'lastUpdated', NOW()
  );

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users (admin check is done inside the function)
GRANT EXECUTE ON FUNCTION get_admin_system_stats TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_admin_system_stats IS 'Returns system stats for admin dashboard. Uses user_roles table for admin verification.';

-- ============================================================================
-- 2. UPDATE GET_FEEDBACK_ANALYTICS TO USE PROPER ADMIN CHECK
-- ============================================================================

CREATE OR REPLACE FUNCTION get_feedback_analytics(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
  total_feedback BIGINT,
  positive_feedback BIGINT,
  negative_feedback BIGINT,
  positive_percentage NUMERIC,
  feedback_by_day JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  is_admin BOOLEAN;
BEGIN
  -- Check if user is admin using the user_roles table (FIXED)
  SELECT public.has_role(auth.uid(), 'admin'::public.app_role) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Access denied. Admin role required.';
  END IF;

  RETURN QUERY
  WITH feedback_stats AS (
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE feedback_type = 'positive') as positive,
      COUNT(*) FILTER (WHERE feedback_type = 'negative') as negative
    FROM message_feedback
    WHERE created_at BETWEEN p_start_date AND p_end_date
  ),
  daily_feedback AS (
    SELECT 
      DATE(created_at) as feedback_date,
      COUNT(*) as daily_count,
      COUNT(*) FILTER (WHERE feedback_type = 'positive') as daily_positive,
      COUNT(*) FILTER (WHERE feedback_type = 'negative') as daily_negative
    FROM message_feedback
    WHERE created_at BETWEEN p_start_date AND p_end_date
    GROUP BY DATE(created_at)
    ORDER BY feedback_date
  )
  SELECT 
    fs.total,
    fs.positive,
    fs.negative,
    CASE 
      WHEN fs.total > 0 THEN ROUND((fs.positive::NUMERIC / fs.total::NUMERIC) * 100, 2)
      ELSE 0
    END as positive_percentage,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', df.feedback_date,
          'total', df.daily_count,
          'positive', df.daily_positive,
          'negative', df.daily_negative
        ) ORDER BY df.feedback_date
      ) FILTER (WHERE df.feedback_date IS NOT NULL),
      '[]'::jsonb
    ) as feedback_by_day
  FROM feedback_stats fs
  LEFT JOIN daily_feedback df ON true
  GROUP BY fs.total, fs.positive, fs.negative;
END;
$$;

-- Grant execute permission to authenticated users (admin check is done inside the function)
GRANT EXECUTE ON FUNCTION get_feedback_analytics TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_feedback_analytics IS 'Returns feedback analytics for admin users only. Uses user_roles table for admin verification.';
