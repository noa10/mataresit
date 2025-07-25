-- ============================================================================
-- ENHANCED MEMBER ANALYTICS FUNCTIONS
-- ============================================================================
-- This migration adds comprehensive member analytics functions for the
-- Enhanced Member Management system in Mataresit.
--
-- Functions included:
-- - get_member_analytics: Comprehensive member analytics and metrics
-- - get_member_activity_timeline: Detailed member activity history
-- - get_member_performance_insights: Performance and engagement insights
-- - search_members_advanced: Advanced member search with filtering
-- - get_team_member_engagement_metrics: Team-wide engagement analytics
-- ============================================================================

-- ============================================================================
-- 1. MEMBER ANALYTICS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_member_analytics(
  _team_id UUID,
  _user_id UUID DEFAULT NULL,
  _start_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() - INTERVAL '30 days'),
  _end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  _result JSONB := '{}';
  _member_info JSONB;
  _activity_stats JSONB;
  _engagement_metrics JSONB;
  _performance_data JSONB;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
BEGIN
  -- Verify team access
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  -- If specific user requested, verify access permissions
  IF _user_id IS NOT NULL AND _current_user_role NOT IN ('admin', 'owner') AND _user_id != _current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to view member analytics',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Get member basic information
  SELECT jsonb_build_object(
    'user_id', tm.user_id,
    'role', tm.role,
    'joined_at', tm.joined_at,
    'last_active_at', tm.last_active_at,
    'invitation_accepted_at', tm.invitation_accepted_at,
    'member_metadata', tm.member_metadata,
    'email', au.email,
    'first_name', p.first_name,
    'last_name', p.last_name,
    'full_name', COALESCE(p.first_name || ' ' || p.last_name, au.email),
    'avatar_url', p.avatar_url,
    'timezone', p.timezone
  ) INTO _member_info
  FROM public.team_members tm
  JOIN auth.users au ON tm.user_id = au.id
  LEFT JOIN public.profiles p ON au.id = p.id
  WHERE tm.team_id = _team_id 
    AND (CASE WHEN _user_id IS NOT NULL THEN tm.user_id = _user_id ELSE TRUE END)
  LIMIT 1;

  IF _member_info IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Member not found',
      'error_code', 'MEMBER_NOT_FOUND'
    );
  END IF;

  -- Get activity statistics
  WITH activity_data AS (
    SELECT
      COUNT(*) as total_activities,
      COUNT(DISTINCT DATE(tal.created_at)) as active_days,
      COUNT(*) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '7 days') as activities_last_week,
      COUNT(*) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') as activities_last_month,
      COUNT(*) FILTER (WHERE tal.action IN ('receipt_created', 'receipt_updated', 'receipt_deleted')) as receipt_activities,
      COUNT(*) FILTER (WHERE tal.action LIKE '%team%') as team_activities,
      AVG(EXTRACT(EPOCH FROM (tal.created_at - LAG(tal.created_at) OVER (ORDER BY tal.created_at)))) as avg_activity_interval
    FROM public.team_audit_logs tal
    WHERE tal.team_id = _team_id
      AND tal.performed_by = COALESCE(_user_id, _member_info->>'user_id')::UUID
      AND tal.created_at BETWEEN _start_date AND _end_date
  )
  SELECT jsonb_build_object(
    'total_activities', COALESCE(total_activities, 0),
    'active_days', COALESCE(active_days, 0),
    'activities_last_week', COALESCE(activities_last_week, 0),
    'activities_last_month', COALESCE(activities_last_month, 0),
    'receipt_activities', COALESCE(receipt_activities, 0),
    'team_activities', COALESCE(team_activities, 0),
    'avg_activity_interval_minutes', ROUND(COALESCE(avg_activity_interval, 0) / 60, 2),
    'activity_frequency', 
      CASE 
        WHEN COALESCE(total_activities, 0) = 0 THEN 'inactive'
        WHEN COALESCE(total_activities, 0) / GREATEST(EXTRACT(DAYS FROM (_end_date - _start_date)), 1) >= 5 THEN 'very_active'
        WHEN COALESCE(total_activities, 0) / GREATEST(EXTRACT(DAYS FROM (_end_date - _start_date)), 1) >= 2 THEN 'active'
        WHEN COALESCE(total_activities, 0) / GREATEST(EXTRACT(DAYS FROM (_end_date - _start_date)), 1) >= 0.5 THEN 'moderate'
        ELSE 'low'
      END
  ) INTO _activity_stats
  FROM activity_data;

  -- Get engagement metrics
  WITH engagement_data AS (
    SELECT
      COUNT(*) FILTER (WHERE r.created_at BETWEEN _start_date AND _end_date) as receipts_created,
      SUM(r.total) FILTER (WHERE r.created_at BETWEEN _start_date AND _end_date) as total_amount_processed,
      COUNT(DISTINCT r.category) FILTER (WHERE r.created_at BETWEEN _start_date AND _end_date) as categories_used,
      AVG(r.total) FILTER (WHERE r.created_at BETWEEN _start_date AND _end_date) as avg_receipt_amount,
      COUNT(*) FILTER (WHERE r.ai_processed = true AND r.created_at BETWEEN _start_date AND _end_date) as ai_processed_receipts,
      COUNT(*) FILTER (WHERE r.created_at >= NOW() - INTERVAL '7 days') as recent_receipts
    FROM public.receipts r
    WHERE r.team_id = _team_id
      AND r.user_id = COALESCE(_user_id, _member_info->>'user_id')::UUID
  )
  SELECT jsonb_build_object(
    'receipts_created', COALESCE(receipts_created, 0),
    'total_amount_processed', COALESCE(total_amount_processed, 0),
    'categories_used', COALESCE(categories_used, 0),
    'avg_receipt_amount', ROUND(COALESCE(avg_receipt_amount, 0), 2),
    'ai_processed_receipts', COALESCE(ai_processed_receipts, 0),
    'recent_receipts', COALESCE(recent_receipts, 0),
    'ai_adoption_rate', 
      CASE 
        WHEN COALESCE(receipts_created, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(ai_processed_receipts, 0)::float / receipts_created) * 100, 1)
      END,
    'engagement_level',
      CASE 
        WHEN COALESCE(receipts_created, 0) = 0 THEN 'none'
        WHEN COALESCE(receipts_created, 0) >= 50 THEN 'high'
        WHEN COALESCE(receipts_created, 0) >= 20 THEN 'medium'
        WHEN COALESCE(receipts_created, 0) >= 5 THEN 'low'
        ELSE 'minimal'
      END
  ) INTO _engagement_metrics
  FROM engagement_data;

  -- Get performance insights
  WITH performance_data AS (
    SELECT
      EXTRACT(DAYS FROM (NOW() - tm.joined_at)) as days_since_joined,
      EXTRACT(DAYS FROM (NOW() - COALESCE(tm.last_active_at, tm.joined_at))) as days_since_last_active,
      COUNT(tal.*) as total_logged_actions,
      COUNT(DISTINCT DATE(tal.created_at)) as active_days_logged
    FROM public.team_members tm
    LEFT JOIN public.team_audit_logs tal ON tal.performed_by = tm.user_id AND tal.team_id = tm.team_id
    WHERE tm.team_id = _team_id
      AND tm.user_id = COALESCE(_user_id, _member_info->>'user_id')::UUID
    GROUP BY tm.user_id, tm.joined_at, tm.last_active_at
  )
  SELECT jsonb_build_object(
    'days_since_joined', COALESCE(days_since_joined, 0),
    'days_since_last_active', COALESCE(days_since_last_active, 0),
    'total_logged_actions', COALESCE(total_logged_actions, 0),
    'active_days_logged', COALESCE(active_days_logged, 0),
    'activity_consistency', 
      CASE 
        WHEN COALESCE(days_since_joined, 0) = 0 THEN 0
        ELSE ROUND((COALESCE(active_days_logged, 0)::float / GREATEST(days_since_joined, 1)) * 100, 1)
      END,
    'member_status',
      CASE 
        WHEN COALESCE(days_since_last_active, 0) <= 1 THEN 'very_active'
        WHEN COALESCE(days_since_last_active, 0) <= 7 THEN 'active'
        WHEN COALESCE(days_since_last_active, 0) <= 30 THEN 'moderate'
        WHEN COALESCE(days_since_last_active, 0) <= 90 THEN 'inactive'
        ELSE 'dormant'
      END
  ) INTO _performance_data
  FROM performance_data;

  -- Build final result
  _result := jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'member_info', _member_info,
      'activity_stats', _activity_stats,
      'engagement_metrics', _engagement_metrics,
      'performance_data', _performance_data,
      'analysis_period', jsonb_build_object(
        'start_date', _start_date,
        'end_date', _end_date,
        'days_analyzed', EXTRACT(DAYS FROM (_end_date - _start_date))
      )
    ),
    'metadata', jsonb_build_object(
      'generated_at', NOW(),
      'generated_by', _current_user_id,
      'team_id', _team_id,
      'target_user_id', COALESCE(_user_id, _member_info->>'user_id')
    )
  );

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. MEMBER ACTIVITY TIMELINE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_member_activity_timeline(
  _team_id UUID,
  _user_id UUID DEFAULT NULL,
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0,
  _activity_types TEXT[] DEFAULT NULL,
  _start_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() - INTERVAL '30 days'),
  _end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _total_count INTEGER;
BEGIN
  -- Verify team access
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  -- If specific user requested, verify access permissions
  IF _user_id IS NOT NULL AND _current_user_role NOT IN ('admin', 'owner') AND _user_id != _current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to view member activity',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Get total count for pagination
  SELECT COUNT(*) INTO _total_count
  FROM public.team_audit_logs tal
  WHERE tal.team_id = _team_id
    AND (CASE WHEN _user_id IS NOT NULL THEN tal.performed_by = _user_id ELSE TRUE END)
    AND tal.created_at BETWEEN _start_date AND _end_date
    AND (CASE WHEN _activity_types IS NOT NULL THEN tal.action = ANY(_activity_types) ELSE TRUE END);

  -- Get activity timeline data
  WITH activity_timeline AS (
    SELECT
      tal.id,
      tal.action,
      tal.action_description,
      tal.created_at,
      tal.performed_by,
      tal.performed_by_email,
      tal.performed_by_name,
      tal.target_user_id,
      tal.target_user_email,
      tal.target_user_name,
      tal.old_values,
      tal.new_values,
      tal.metadata,
      tal.ip_address,
      tal.user_agent,
      -- Add context from related tables
      CASE 
        WHEN tal.action LIKE '%receipt%' THEN (
          SELECT jsonb_build_object(
            'receipt_id', r.id,
            'receipt_total', r.total,
            'receipt_category', r.category,
            'receipt_merchant', r.merchant_name
          )
          FROM public.receipts r
          WHERE r.id = (tal.metadata->>'receipt_id')::UUID
          LIMIT 1
        )
        ELSE '{}'::jsonb
      END as context_data
    FROM public.team_audit_logs tal
    WHERE tal.team_id = _team_id
      AND (CASE WHEN _user_id IS NOT NULL THEN tal.performed_by = _user_id ELSE TRUE END)
      AND tal.created_at BETWEEN _start_date AND _end_date
      AND (CASE WHEN _activity_types IS NOT NULL THEN tal.action = ANY(_activity_types) ELSE TRUE END)
    ORDER BY tal.created_at DESC
    LIMIT _limit OFFSET _offset
  )
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'activities', jsonb_agg(
        jsonb_build_object(
          'id', id,
          'action', action,
          'action_description', action_description,
          'created_at', created_at,
          'performed_by', performed_by,
          'performed_by_email', performed_by_email,
          'performed_by_name', performed_by_name,
          'target_user_id', target_user_id,
          'target_user_email', target_user_email,
          'target_user_name', target_user_name,
          'old_values', old_values,
          'new_values', new_values,
          'metadata', metadata,
          'context_data', context_data,
          'ip_address', ip_address,
          'user_agent', user_agent
        ) ORDER BY created_at DESC
      ),
      'pagination', jsonb_build_object(
        'total_count', _total_count,
        'limit', _limit,
        'offset', _offset,
        'has_more', (_offset + _limit) < _total_count
      ),
      'filters', jsonb_build_object(
        'user_id', _user_id,
        'activity_types', _activity_types,
        'start_date', _start_date,
        'end_date', _end_date
      )
    ),
    'metadata', jsonb_build_object(
      'generated_at', NOW(),
      'generated_by', _current_user_id,
      'team_id', _team_id
    )
  ) INTO _result
  FROM activity_timeline;

  RETURN COALESCE(_result, jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'activities', '[]'::jsonb,
      'pagination', jsonb_build_object(
        'total_count', 0,
        'limit', _limit,
        'offset', _offset,
        'has_more', false
      )
    )
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 3. MEMBER PERFORMANCE INSIGHTS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_member_performance_insights(
  _team_id UUID,
  _user_id UUID DEFAULT NULL,
  _comparison_period_days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _current_period_start TIMESTAMP WITH TIME ZONE := NOW() - (_comparison_period_days || ' days')::INTERVAL;
  _previous_period_start TIMESTAMP WITH TIME ZONE := NOW() - (2 * _comparison_period_days || ' days')::INTERVAL;
  _previous_period_end TIMESTAMP WITH TIME ZONE := NOW() - (_comparison_period_days || ' days')::INTERVAL;
BEGIN
  -- Verify team access
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  -- If specific user requested, verify access permissions
  IF _user_id IS NOT NULL AND _current_user_role NOT IN ('admin', 'owner') AND _user_id != _current_user_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to view member insights',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Get performance insights with comparison
  WITH current_period AS (
    SELECT
      COUNT(*) FILTER (WHERE r.created_at >= _current_period_start) as receipts_current,
      SUM(r.total) FILTER (WHERE r.created_at >= _current_period_start) as amount_current,
      COUNT(DISTINCT r.category) FILTER (WHERE r.created_at >= _current_period_start) as categories_current,
      COUNT(*) FILTER (WHERE r.ai_processed = true AND r.created_at >= _current_period_start) as ai_receipts_current,
      COUNT(DISTINCT DATE(r.created_at)) FILTER (WHERE r.created_at >= _current_period_start) as active_days_current
    FROM public.receipts r
    WHERE r.team_id = _team_id
      AND r.user_id = COALESCE(_user_id, _current_user_id)
  ),
  previous_period AS (
    SELECT
      COUNT(*) FILTER (WHERE r.created_at BETWEEN _previous_period_start AND _previous_period_end) as receipts_previous,
      SUM(r.total) FILTER (WHERE r.created_at BETWEEN _previous_period_start AND _previous_period_end) as amount_previous,
      COUNT(DISTINCT r.category) FILTER (WHERE r.created_at BETWEEN _previous_period_start AND _previous_period_end) as categories_previous,
      COUNT(*) FILTER (WHERE r.ai_processed = true AND r.created_at BETWEEN _previous_period_start AND _previous_period_end) as ai_receipts_previous,
      COUNT(DISTINCT DATE(r.created_at)) FILTER (WHERE r.created_at BETWEEN _previous_period_start AND _previous_period_end) as active_days_previous
    FROM public.receipts r
    WHERE r.team_id = _team_id
      AND r.user_id = COALESCE(_user_id, _current_user_id)
  ),
  team_averages AS (
    SELECT
      AVG(member_receipts) as avg_receipts_per_member,
      AVG(member_amount) as avg_amount_per_member,
      AVG(member_categories) as avg_categories_per_member
    FROM (
      SELECT
        tm.user_id,
        COUNT(*) FILTER (WHERE r.created_at >= _current_period_start) as member_receipts,
        SUM(r.total) FILTER (WHERE r.created_at >= _current_period_start) as member_amount,
        COUNT(DISTINCT r.category) FILTER (WHERE r.created_at >= _current_period_start) as member_categories
      FROM public.team_members tm
      LEFT JOIN public.receipts r ON r.user_id = tm.user_id AND r.team_id = tm.team_id
      WHERE tm.team_id = _team_id
      GROUP BY tm.user_id
    ) member_stats
  ),
  engagement_trends AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'date', date,
          'receipts', receipts,
          'amount', amount,
          'categories', categories
        ) ORDER BY date
      ) as daily_trends
    FROM (
      SELECT
        DATE(r.created_at) as date,
        COUNT(*) as receipts,
        SUM(r.total) as amount,
        COUNT(DISTINCT r.category) as categories
      FROM public.receipts r
      WHERE r.team_id = _team_id
        AND r.user_id = COALESCE(_user_id, _current_user_id)
        AND r.created_at >= _current_period_start
      GROUP BY DATE(r.created_at)
      ORDER BY date
    ) daily_data
  )
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'current_period', jsonb_build_object(
        'receipts', COALESCE(cp.receipts_current, 0),
        'amount', COALESCE(cp.amount_current, 0),
        'categories', COALESCE(cp.categories_current, 0),
        'ai_receipts', COALESCE(cp.ai_receipts_current, 0),
        'active_days', COALESCE(cp.active_days_current, 0),
        'ai_adoption_rate',
          CASE
            WHEN COALESCE(cp.receipts_current, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(cp.ai_receipts_current, 0)::float / cp.receipts_current) * 100, 1)
          END
      ),
      'previous_period', jsonb_build_object(
        'receipts', COALESCE(pp.receipts_previous, 0),
        'amount', COALESCE(pp.amount_previous, 0),
        'categories', COALESCE(pp.categories_previous, 0),
        'ai_receipts', COALESCE(pp.ai_receipts_previous, 0),
        'active_days', COALESCE(pp.active_days_previous, 0)
      ),
      'changes', jsonb_build_object(
        'receipts_change', COALESCE(cp.receipts_current, 0) - COALESCE(pp.receipts_previous, 0),
        'amount_change', COALESCE(cp.amount_current, 0) - COALESCE(pp.amount_previous, 0),
        'categories_change', COALESCE(cp.categories_current, 0) - COALESCE(pp.categories_previous, 0),
        'receipts_change_percent',
          CASE
            WHEN COALESCE(pp.receipts_previous, 0) = 0 THEN
              CASE WHEN COALESCE(cp.receipts_current, 0) > 0 THEN 100 ELSE 0 END
            ELSE ROUND(((COALESCE(cp.receipts_current, 0) - pp.receipts_previous)::float / pp.receipts_previous) * 100, 1)
          END,
        'amount_change_percent',
          CASE
            WHEN COALESCE(pp.amount_previous, 0) = 0 THEN
              CASE WHEN COALESCE(cp.amount_current, 0) > 0 THEN 100 ELSE 0 END
            ELSE ROUND(((COALESCE(cp.amount_current, 0) - pp.amount_previous)::float / pp.amount_previous) * 100, 1)
          END
      ),
      'team_comparison', jsonb_build_object(
        'receipts_vs_avg',
          CASE
            WHEN COALESCE(ta.avg_receipts_per_member, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(cp.receipts_current, 0)::float / ta.avg_receipts_per_member) * 100, 1)
          END,
        'amount_vs_avg',
          CASE
            WHEN COALESCE(ta.avg_amount_per_member, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(cp.amount_current, 0)::float / ta.avg_amount_per_member) * 100, 1)
          END,
        'categories_vs_avg',
          CASE
            WHEN COALESCE(ta.avg_categories_per_member, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(cp.categories_current, 0)::float / ta.avg_categories_per_member) * 100, 1)
          END
      ),
      'engagement_trends', COALESCE(et.daily_trends, '[]'::jsonb)
    )
  ) INTO _result
  FROM current_period cp, previous_period pp, team_averages ta, engagement_trends et;

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. ADVANCED MEMBER SEARCH FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.search_members_advanced(
  _team_id UUID,
  _search_query TEXT DEFAULT NULL,
  _role_filter public.team_member_role[] DEFAULT NULL,
  _status_filter TEXT[] DEFAULT NULL, -- 'active', 'inactive', 'scheduled_removal'
  _activity_filter TEXT DEFAULT NULL, -- 'very_active', 'active', 'moderate', 'inactive', 'dormant'
  _sort_by TEXT DEFAULT 'name', -- 'name', 'role', 'joined_at', 'last_active', 'activity_score'
  _sort_order TEXT DEFAULT 'asc', -- 'asc', 'desc'
  _limit INTEGER DEFAULT 50,
  _offset INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _total_count INTEGER;
  _sort_clause TEXT;
BEGIN
  -- Verify team access
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  -- Build sort clause
  _sort_clause := CASE _sort_by
    WHEN 'name' THEN 'COALESCE(p.first_name || '' '' || p.last_name, au.email)'
    WHEN 'role' THEN 'CASE tm.role WHEN ''owner'' THEN 1 WHEN ''admin'' THEN 2 WHEN ''member'' THEN 3 WHEN ''viewer'' THEN 4 END'
    WHEN 'joined_at' THEN 'tm.joined_at'
    WHEN 'last_active' THEN 'COALESCE(tm.last_active_at, tm.joined_at)'
    WHEN 'activity_score' THEN 'activity_score'
    ELSE 'COALESCE(p.first_name || '' '' || p.last_name, au.email)'
  END;

  -- Get total count for pagination
  EXECUTE format('
    SELECT COUNT(*)
    FROM public.team_members tm
    JOIN auth.users au ON tm.user_id = au.id
    LEFT JOIN public.profiles p ON au.id = p.id
    WHERE tm.team_id = $1
      AND (CASE WHEN $2 IS NOT NULL THEN
        (LOWER(COALESCE(p.first_name || '' '' || p.last_name, au.email)) LIKE LOWER(''%%'' || $2 || ''%%'')
         OR LOWER(au.email) LIKE LOWER(''%%'' || $2 || ''%%''))
        ELSE TRUE END)
      AND (CASE WHEN $3 IS NOT NULL THEN tm.role = ANY($3) ELSE TRUE END)
      AND (CASE WHEN $4 IS NOT NULL THEN
        (CASE
          WHEN ''active'' = ANY($4) AND COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''7 days'' THEN TRUE
          WHEN ''inactive'' = ANY($4) AND COALESCE(tm.last_active_at, tm.joined_at) < NOW() - INTERVAL ''30 days'' THEN TRUE
          WHEN ''scheduled_removal'' = ANY($4) AND tm.removal_scheduled_at IS NOT NULL THEN TRUE
          ELSE FALSE
        END)
        ELSE TRUE END)
  ') INTO _total_count USING _team_id, _search_query, _role_filter, _status_filter;

  -- Get search results with enhanced member data
  EXECUTE format('
    WITH member_activity AS (
      SELECT
        tm.user_id,
        COUNT(tal.*) as total_activities,
        COUNT(*) FILTER (WHERE tal.created_at >= NOW() - INTERVAL ''7 days'') as recent_activities,
        MAX(tal.created_at) as last_activity_date,
        COUNT(DISTINCT DATE(tal.created_at)) as active_days,
        -- Calculate activity score
        LEAST(100,
          COUNT(*) * 2 +
          COUNT(*) FILTER (WHERE tal.created_at >= NOW() - INTERVAL ''7 days'') * 5 +
          COUNT(DISTINCT DATE(tal.created_at)) * 3
        ) as activity_score
      FROM public.team_members tm
      LEFT JOIN public.team_audit_logs tal ON tal.performed_by = tm.user_id AND tal.team_id = tm.team_id
      WHERE tm.team_id = $1
      GROUP BY tm.user_id
    ),
    receipt_stats AS (
      SELECT
        tm.user_id,
        COUNT(r.*) as total_receipts,
        SUM(r.total) as total_amount,
        COUNT(*) FILTER (WHERE r.created_at >= NOW() - INTERVAL ''30 days'') as recent_receipts,
        COUNT(DISTINCT r.category) as categories_used
      FROM public.team_members tm
      LEFT JOIN public.receipts r ON r.user_id = tm.user_id AND r.team_id = tm.team_id
      WHERE tm.team_id = $1
      GROUP BY tm.user_id
    ),
    member_search AS (
      SELECT
        tm.id,
        tm.user_id,
        tm.role,
        tm.permissions,
        tm.joined_at,
        tm.updated_at,
        tm.last_active_at,
        tm.invitation_accepted_at,
        tm.added_by,
        tm.removal_scheduled_at,
        tm.removal_scheduled_by,
        tm.member_metadata,
        au.email,
        p.first_name,
        p.last_name,
        p.avatar_url,
        p.timezone,
        COALESCE(p.first_name || '' '' || p.last_name, au.email) as full_name,
        -- Activity metrics
        COALESCE(ma.total_activities, 0) as total_activities,
        COALESCE(ma.recent_activities, 0) as recent_activities,
        ma.last_activity_date,
        COALESCE(ma.active_days, 0) as active_days,
        COALESCE(ma.activity_score, 0) as activity_score,
        -- Receipt metrics
        COALESCE(rs.total_receipts, 0) as total_receipts,
        COALESCE(rs.total_amount, 0) as total_amount,
        COALESCE(rs.recent_receipts, 0) as recent_receipts,
        COALESCE(rs.categories_used, 0) as categories_used,
        -- Status calculation
        CASE
          WHEN tm.removal_scheduled_at IS NOT NULL THEN ''scheduled_removal''
          WHEN COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''1 day'' THEN ''very_active''
          WHEN COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''7 days'' THEN ''active''
          WHEN COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''30 days'' THEN ''moderate''
          WHEN COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''90 days'' THEN ''inactive''
          ELSE ''dormant''
        END as member_status
      FROM public.team_members tm
      JOIN auth.users au ON tm.user_id = au.id
      LEFT JOIN public.profiles p ON au.id = p.id
      LEFT JOIN member_activity ma ON ma.user_id = tm.user_id
      LEFT JOIN receipt_stats rs ON rs.user_id = tm.user_id
      WHERE tm.team_id = $1
        AND (CASE WHEN $2 IS NOT NULL THEN
          (LOWER(COALESCE(p.first_name || '' '' || p.last_name, au.email)) LIKE LOWER(''%%'' || $2 || ''%%'')
           OR LOWER(au.email) LIKE LOWER(''%%'' || $2 || ''%%''))
          ELSE TRUE END)
        AND (CASE WHEN $3 IS NOT NULL THEN tm.role = ANY($3) ELSE TRUE END)
        AND (CASE WHEN $4 IS NOT NULL THEN
          (CASE
            WHEN ''active'' = ANY($4) AND COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''7 days'' THEN TRUE
            WHEN ''inactive'' = ANY($4) AND COALESCE(tm.last_active_at, tm.joined_at) < NOW() - INTERVAL ''30 days'' THEN TRUE
            WHEN ''scheduled_removal'' = ANY($4) AND tm.removal_scheduled_at IS NOT NULL THEN TRUE
            ELSE FALSE
          END)
          ELSE TRUE END)
        AND (CASE WHEN $5 IS NOT NULL THEN
          (CASE
            WHEN $5 = ''very_active'' AND COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''1 day'' THEN TRUE
            WHEN $5 = ''active'' AND COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''7 days'' THEN TRUE
            WHEN $5 = ''moderate'' AND COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''30 days'' THEN TRUE
            WHEN $5 = ''inactive'' AND COALESCE(tm.last_active_at, tm.joined_at) >= NOW() - INTERVAL ''90 days'' THEN TRUE
            WHEN $5 = ''dormant'' AND COALESCE(tm.last_active_at, tm.joined_at) < NOW() - INTERVAL ''90 days'' THEN TRUE
            ELSE FALSE
          END)
          ELSE TRUE END)
      ORDER BY %s %s
      LIMIT $8 OFFSET $9
    )
    SELECT jsonb_build_object(
      ''success'', true,
      ''data'', jsonb_build_object(
        ''members'', jsonb_agg(
          jsonb_build_object(
            ''id'', id,
            ''user_id'', user_id,
            ''role'', role,
            ''permissions'', permissions,
            ''joined_at'', joined_at,
            ''updated_at'', updated_at,
            ''last_active_at'', last_active_at,
            ''invitation_accepted_at'', invitation_accepted_at,
            ''added_by'', added_by,
            ''removal_scheduled_at'', removal_scheduled_at,
            ''removal_scheduled_by'', removal_scheduled_by,
            ''member_metadata'', member_metadata,
            ''email'', email,
            ''first_name'', first_name,
            ''last_name'', last_name,
            ''full_name'', full_name,
            ''avatar_url'', avatar_url,
            ''timezone'', timezone,
            ''member_status'', member_status,
            ''activity_metrics'', jsonb_build_object(
              ''total_activities'', total_activities,
              ''recent_activities'', recent_activities,
              ''last_activity_date'', last_activity_date,
              ''active_days'', active_days,
              ''activity_score'', activity_score
            ),
            ''receipt_metrics'', jsonb_build_object(
              ''total_receipts'', total_receipts,
              ''total_amount'', total_amount,
              ''recent_receipts'', recent_receipts,
              ''categories_used'', categories_used
            )
          ) ORDER BY %s %s
        ),
        ''pagination'', jsonb_build_object(
          ''total_count'', $10,
          ''limit'', $8,
          ''offset'', $9,
          ''has_more'', ($9 + $8) < $10
        ),
        ''filters'', jsonb_build_object(
          ''search_query'', $2,
          ''role_filter'', $3,
          ''status_filter'', $4,
          ''activity_filter'', $5,
          ''sort_by'', $6,
          ''sort_order'', $7
        )
      ),
      ''metadata'', jsonb_build_object(
        ''generated_at'', NOW(),
        ''generated_by'', $11,
        ''team_id'', $1
      )
    )
    FROM member_search
  ', _sort_clause, _sort_order, _sort_clause, _sort_order)
  INTO _result
  USING _team_id, _search_query, _role_filter, _status_filter, _activity_filter, _sort_by, _sort_order, _limit, _offset, _total_count, _current_user_id;

  RETURN COALESCE(_result, jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'members', '[]'::jsonb,
      'pagination', jsonb_build_object(
        'total_count', 0,
        'limit', _limit,
        'offset', _offset,
        'has_more', false
      )
    )
  ));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. TEAM MEMBER ENGAGEMENT METRICS FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_team_member_engagement_metrics(
  _team_id UUID,
  _period_days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
  _period_start TIMESTAMP WITH TIME ZONE := NOW() - (_period_days || ' days')::INTERVAL;
BEGIN
  -- Verify team access
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied to team',
      'error_code', 'TEAM_ACCESS_DENIED'
    );
  END IF;

  -- Only admins and owners can view team-wide engagement metrics
  IF _current_user_role NOT IN ('admin', 'owner') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient permissions to view team engagement metrics',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Get comprehensive team engagement metrics
  WITH team_overview AS (
    SELECT
      COUNT(*) as total_members,
      COUNT(*) FILTER (WHERE tm.last_active_at >= NOW() - INTERVAL '1 day') as very_active_members,
      COUNT(*) FILTER (WHERE tm.last_active_at >= NOW() - INTERVAL '7 days') as active_members,
      COUNT(*) FILTER (WHERE tm.last_active_at >= NOW() - INTERVAL '30 days') as moderate_members,
      COUNT(*) FILTER (WHERE tm.last_active_at < NOW() - INTERVAL '30 days' OR tm.last_active_at IS NULL) as inactive_members,
      COUNT(*) FILTER (WHERE tm.removal_scheduled_at IS NOT NULL) as scheduled_removals,
      AVG(EXTRACT(DAYS FROM (NOW() - tm.joined_at))) as avg_member_tenure_days
    FROM public.team_members tm
    WHERE tm.team_id = _team_id
  ),
  activity_metrics AS (
    SELECT
      COUNT(*) as total_activities,
      COUNT(DISTINCT tal.performed_by) as active_contributors,
      COUNT(*) FILTER (WHERE tal.created_at >= _period_start) as recent_activities,
      COUNT(DISTINCT tal.performed_by) FILTER (WHERE tal.created_at >= _period_start) as recent_contributors,
      COUNT(*) FILTER (WHERE tal.action LIKE '%receipt%') as receipt_activities,
      COUNT(*) FILTER (WHERE tal.action LIKE '%team%') as team_management_activities,
      AVG(daily_activities.activity_count) as avg_daily_activities
    FROM public.team_audit_logs tal
    LEFT JOIN (
      SELECT
        DATE(created_at) as activity_date,
        COUNT(*) as activity_count
      FROM public.team_audit_logs
      WHERE team_id = _team_id AND created_at >= _period_start
      GROUP BY DATE(created_at)
    ) daily_activities ON DATE(tal.created_at) = daily_activities.activity_date
    WHERE tal.team_id = _team_id
  ),
  receipt_metrics AS (
    SELECT
      COUNT(*) as total_receipts,
      SUM(r.total) as total_amount,
      COUNT(DISTINCT r.user_id) as contributing_members,
      COUNT(*) FILTER (WHERE r.created_at >= _period_start) as recent_receipts,
      SUM(r.total) FILTER (WHERE r.created_at >= _period_start) as recent_amount,
      COUNT(DISTINCT r.user_id) FILTER (WHERE r.created_at >= _period_start) as recent_contributors,
      COUNT(DISTINCT r.category) as categories_used,
      COUNT(*) FILTER (WHERE r.ai_processed = true) as ai_processed_receipts,
      AVG(r.total) as avg_receipt_amount
    FROM public.receipts r
    WHERE r.team_id = _team_id
  ),
  member_performance AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'user_id', tm.user_id,
          'full_name', COALESCE(p.first_name || ' ' || p.last_name, au.email),
          'role', tm.role,
          'joined_at', tm.joined_at,
          'last_active_at', tm.last_active_at,
          'activity_score', COALESCE(member_stats.activity_score, 0),
          'receipt_count', COALESCE(member_stats.receipt_count, 0),
          'total_amount', COALESCE(member_stats.total_amount, 0),
          'engagement_level',
            CASE
              WHEN COALESCE(member_stats.activity_score, 0) >= 80 THEN 'high'
              WHEN COALESCE(member_stats.activity_score, 0) >= 50 THEN 'medium'
              WHEN COALESCE(member_stats.activity_score, 0) >= 20 THEN 'low'
              ELSE 'minimal'
            END
        ) ORDER BY COALESCE(member_stats.activity_score, 0) DESC
      ) as top_performers
    FROM public.team_members tm
    JOIN auth.users au ON tm.user_id = au.id
    LEFT JOIN public.profiles p ON au.id = p.id
    LEFT JOIN (
      SELECT
        tm_inner.user_id,
        COUNT(tal.*) * 2 +
        COUNT(r.*) * 3 +
        COUNT(DISTINCT DATE(tal.created_at)) * 5 as activity_score,
        COUNT(r.*) as receipt_count,
        SUM(r.total) as total_amount
      FROM public.team_members tm_inner
      LEFT JOIN public.team_audit_logs tal ON tal.performed_by = tm_inner.user_id AND tal.team_id = tm_inner.team_id AND tal.created_at >= _period_start
      LEFT JOIN public.receipts r ON r.user_id = tm_inner.user_id AND r.team_id = tm_inner.team_id AND r.created_at >= _period_start
      WHERE tm_inner.team_id = _team_id
      GROUP BY tm_inner.user_id
    ) member_stats ON member_stats.user_id = tm.user_id
    WHERE tm.team_id = _team_id
  ),
  engagement_trends AS (
    SELECT
      jsonb_agg(
        jsonb_build_object(
          'date', trend_date,
          'active_members', active_members,
          'activities', activities,
          'receipts', receipts,
          'amount', amount
        ) ORDER BY trend_date
      ) as daily_trends
    FROM (
      SELECT
        DATE(activity_date) as trend_date,
        COUNT(DISTINCT tal.performed_by) as active_members,
        COUNT(tal.*) as activities,
        COUNT(r.*) as receipts,
        SUM(r.total) as amount
      FROM generate_series(_period_start::date, NOW()::date, '1 day'::interval) activity_date
      LEFT JOIN public.team_audit_logs tal ON DATE(tal.created_at) = DATE(activity_date) AND tal.team_id = _team_id
      LEFT JOIN public.receipts r ON DATE(r.created_at) = DATE(activity_date) AND r.team_id = _team_id
      GROUP BY DATE(activity_date)
      ORDER BY DATE(activity_date)
    ) trends
  )
  SELECT jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'team_overview', jsonb_build_object(
        'total_members', to.total_members,
        'very_active_members', to.very_active_members,
        'active_members', to.active_members,
        'moderate_members', to.moderate_members,
        'inactive_members', to.inactive_members,
        'scheduled_removals', to.scheduled_removals,
        'avg_member_tenure_days', ROUND(COALESCE(to.avg_member_tenure_days, 0), 1),
        'engagement_distribution', jsonb_build_object(
          'very_active_percent', ROUND((to.very_active_members::float / GREATEST(to.total_members, 1)) * 100, 1),
          'active_percent', ROUND((to.active_members::float / GREATEST(to.total_members, 1)) * 100, 1),
          'moderate_percent', ROUND((to.moderate_members::float / GREATEST(to.total_members, 1)) * 100, 1),
          'inactive_percent', ROUND((to.inactive_members::float / GREATEST(to.total_members, 1)) * 100, 1)
        )
      ),
      'activity_metrics', jsonb_build_object(
        'total_activities', am.total_activities,
        'active_contributors', am.active_contributors,
        'recent_activities', am.recent_activities,
        'recent_contributors', am.recent_contributors,
        'receipt_activities', am.receipt_activities,
        'team_management_activities', am.team_management_activities,
        'avg_daily_activities', ROUND(COALESCE(am.avg_daily_activities, 0), 1),
        'contributor_participation_rate', ROUND((am.recent_contributors::float / GREATEST(to.total_members, 1)) * 100, 1)
      ),
      'receipt_metrics', jsonb_build_object(
        'total_receipts', rm.total_receipts,
        'total_amount', rm.total_amount,
        'contributing_members', rm.contributing_members,
        'recent_receipts', rm.recent_receipts,
        'recent_amount', rm.recent_amount,
        'recent_contributors', rm.recent_contributors,
        'categories_used', rm.categories_used,
        'ai_processed_receipts', rm.ai_processed_receipts,
        'avg_receipt_amount', ROUND(COALESCE(rm.avg_receipt_amount, 0), 2),
        'ai_adoption_rate', ROUND((rm.ai_processed_receipts::float / GREATEST(rm.total_receipts, 1)) * 100, 1),
        'member_contribution_rate', ROUND((rm.recent_contributors::float / GREATEST(to.total_members, 1)) * 100, 1)
      ),
      'top_performers', mp.top_performers,
      'engagement_trends', COALESCE(et.daily_trends, '[]'::jsonb),
      'team_health_score',
        LEAST(100, GREATEST(0,
          (to.active_members::float / GREATEST(to.total_members, 1)) * 40 +
          (am.recent_contributors::float / GREATEST(to.total_members, 1)) * 30 +
          (rm.recent_contributors::float / GREATEST(to.total_members, 1)) * 20 +
          (CASE WHEN rm.total_receipts > 0 THEN 10 ELSE 0 END)
        )),
      'insights', jsonb_build_array(
        CASE
          WHEN (to.active_members::float / GREATEST(to.total_members, 1)) > 0.7 THEN
            'Excellent team engagement - most members are actively participating'
          WHEN (to.active_members::float / GREATEST(to.total_members, 1)) > 0.4 THEN
            'Good team engagement - consider strategies to activate inactive members'
          ELSE 'Low team engagement - focus on member activation and retention'
        END,
        CASE
          WHEN (rm.ai_processed_receipts::float / GREATEST(rm.total_receipts, 1)) > 0.8 THEN
            'High AI adoption rate - team is effectively using automation features'
          WHEN (rm.ai_processed_receipts::float / GREATEST(rm.total_receipts, 1)) > 0.5 THEN
            'Moderate AI adoption - encourage more use of AI processing features'
          ELSE 'Low AI adoption - provide training on AI features to improve efficiency'
        END,
        CASE
          WHEN am.avg_daily_activities > 10 THEN
            'High daily activity levels - team is very engaged with the platform'
          WHEN am.avg_daily_activities > 5 THEN
            'Moderate daily activity - consistent usage patterns'
          ELSE 'Low daily activity - consider engagement strategies and feature adoption'
        END
      )
    ),
    'metadata', jsonb_build_object(
      'generated_at', NOW(),
      'generated_by', _current_user_id,
      'team_id', _team_id,
      'period_days', _period_days,
      'period_start', _period_start
    )
  ) INTO _result
  FROM team_overview to, activity_metrics am, receipt_metrics rm, member_performance mp, engagement_trends et;

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION COMMENTS AND PERMISSIONS
-- ============================================================================

COMMENT ON FUNCTION public.get_member_analytics IS 'Get comprehensive analytics for a specific team member including activity stats, engagement metrics, and performance data';
COMMENT ON FUNCTION public.get_member_activity_timeline IS 'Get detailed activity timeline for a team member with filtering and pagination';
COMMENT ON FUNCTION public.get_member_performance_insights IS 'Get performance insights with period-over-period comparison and team benchmarking';
COMMENT ON FUNCTION public.search_members_advanced IS 'Advanced member search with filtering, sorting, and enhanced member data';
COMMENT ON FUNCTION public.get_team_member_engagement_metrics IS 'Get team-wide member engagement metrics and analytics (admin/owner only)';

-- Grant execute permissions to authenticated users (RLS will handle team access)
GRANT EXECUTE ON FUNCTION public.get_member_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_activity_timeline TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_member_performance_insights TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_members_advanced TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_member_engagement_metrics TO authenticated;
