-- ============================================================================
-- ADMIN ACCESS FIX SCRIPT
-- Run this in the Supabase SQL Editor to fix admin access issues
-- ============================================================================

-- 1. Fix get_feedback_analytics function to use proper admin role check
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

-- 2. Assign admin role to the first user (likely the developer)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE id = (
  SELECT id 
  FROM auth.users 
  ORDER BY created_at ASC 
  LIMIT 1
)
AND NOT EXISTS (
  SELECT 1 FROM public.user_roles 
  WHERE user_id = auth.users.id AND role = 'admin'
);

-- 3. Show current admin users
SELECT 
  au.email,
  au.created_at as user_created,
  ur.role,
  ur.created_at as role_assigned
FROM auth.users au
JOIN public.user_roles ur ON au.id = ur.user_id
WHERE ur.role = 'admin'
ORDER BY au.created_at;

-- 4. Test the fixed function (this should work now for admin users)
-- SELECT * FROM get_feedback_analytics();

-- ============================================================================
-- ADDITIONAL FIXES FOR OTHER ADMIN POLICIES
-- ============================================================================

-- Fix admin policies that were using the old auth.users.raw_user_meta_data check

-- Fix conversations table policy
DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
CREATE POLICY "Admins can view all conversations" ON conversations
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix conversation_context table policy (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_context') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all conversation context" ON conversation_context';
    EXECUTE 'CREATE POLICY "Admins can view all conversation context" ON conversation_context
      FOR SELECT USING (
        public.has_role(auth.uid(), ''admin''::public.app_role)
      )';
  END IF;
END $$;

-- Fix conversation_memory table policy (if it exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conversation_memory') THEN
    EXECUTE 'DROP POLICY IF EXISTS "Admins can view all conversation memory" ON conversation_memory';
    EXECUTE 'CREATE POLICY "Admins can view all conversation memory" ON conversation_memory
      FOR SELECT USING (
        public.has_role(auth.uid(), ''admin''::public.app_role)
      )';
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check if the has_role function exists and works
SELECT public.has_role(auth.uid(), 'admin'::public.app_role) as is_current_user_admin;

-- Check all user roles
SELECT 
  au.email,
  ur.role,
  ur.created_at
FROM auth.users au
LEFT JOIN public.user_roles ur ON au.id = ur.user_id
ORDER BY au.created_at;

-- Success message
SELECT 'Admin access fix completed successfully!' as status;
