-- Fix get_feedback_analytics function to use proper admin role check
-- This fixes the "Access denied. Admin role required" error by using the user_roles table
-- instead of checking auth.users.raw_user_meta_data

-- Function to get feedback analytics (admin only) - FIXED VERSION
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

-- ============================================================================
-- FIX ALL ADMIN ROLE CHECKS TO USE user_roles TABLE
-- ============================================================================

-- Fix admin policies for conversations table
DROP POLICY IF EXISTS "Admins can view all conversations" ON conversations;
CREATE POLICY "Admins can view all conversations" ON conversations
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix admin policies for conversation_context table
DROP POLICY IF EXISTS "Admins can view all conversation context" ON conversation_context;
CREATE POLICY "Admins can view all conversation context" ON conversation_context
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix admin policies for conversation_memory table
DROP POLICY IF EXISTS "Admins can view all conversation memory" ON conversation_memory;
CREATE POLICY "Admins can view all conversation memory" ON conversation_memory
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix admin policies for malaysian_public_holidays table
DROP POLICY IF EXISTS "Only admins can manage public holidays" ON malaysian_public_holidays;
CREATE POLICY "Only admins can manage public holidays" ON malaysian_public_holidays
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix admin policies for malaysian_cultural_preferences table
DROP POLICY IF EXISTS "Only admins can manage cultural preferences" ON malaysian_cultural_preferences;
CREATE POLICY "Only admins can manage cultural preferences" ON malaysian_cultural_preferences
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix admin policies for malaysian_tax_categories table
DROP POLICY IF EXISTS "Only admins can manage tax categories" ON malaysian_tax_categories;
CREATE POLICY "Only admins can manage tax categories" ON malaysian_tax_categories
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );

-- Fix admin policies for malaysian_business_categories table
DROP POLICY IF EXISTS "Only admins can manage business categories" ON malaysian_business_categories;
CREATE POLICY "Only admins can manage business categories" ON malaysian_business_categories
  FOR ALL USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
  );
