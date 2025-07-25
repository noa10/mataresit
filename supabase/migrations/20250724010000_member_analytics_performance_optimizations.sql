-- ============================================================================
-- MEMBER ANALYTICS PERFORMANCE OPTIMIZATIONS
-- ============================================================================
-- This migration adds advanced database optimizations for member analytics,
-- including specialized indexes, materialized views, and performance monitoring
-- for the Enhanced Member Management system.
--
-- Features:
-- - Advanced composite indexes for analytics queries
-- - Materialized views for pre-computed analytics data
-- - Performance monitoring and query optimization
-- - Automated maintenance procedures
-- ============================================================================

-- ============================================================================
-- 1. ADVANCED INDEXES FOR MEMBER ANALYTICS
-- ============================================================================

-- Composite indexes for member analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_analytics_composite
ON public.team_members(team_id, last_active_at DESC, role, joined_at)
WHERE removal_scheduled_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_members_activity_status
ON public.team_members(team_id, 
  CASE 
    WHEN last_active_at >= NOW() - INTERVAL '1 day' THEN 'very_active'
    WHEN last_active_at >= NOW() - INTERVAL '7 days' THEN 'active'
    WHEN last_active_at >= NOW() - INTERVAL '30 days' THEN 'moderate'
    WHEN last_active_at >= NOW() - INTERVAL '90 days' THEN 'inactive'
    ELSE 'dormant'
  END
);

-- Indexes for receipt analytics by team members
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_team_member_analytics
ON public.receipts(user_id, team_id, date DESC, total, category)
WHERE deleted_at IS NULL AND team_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_receipts_ai_processing_analytics
ON public.receipts(user_id, team_id, ai_processed, date DESC)
WHERE deleted_at IS NULL AND team_id IS NOT NULL;

-- Indexes for audit log analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_member_activity
ON public.team_audit_logs(team_id, target_user_id, action, created_at DESC)
WHERE target_user_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_audit_logs_performer_activity
ON public.team_audit_logs(team_id, performed_by, action, created_at DESC);

-- Indexes for invitation analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_invitations_team_analytics
ON public.team_invitations(team_id, status, created_at DESC, invited_by);

-- ============================================================================
-- 2. MATERIALIZED VIEWS FOR ANALYTICS DATA
-- ============================================================================

-- Materialized view for team member activity summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_team_member_activity_summary AS
SELECT 
  tm.team_id,
  tm.user_id,
  tm.role,
  tm.joined_at,
  tm.last_active_at,
  tm.invitation_accepted_at,
  
  -- Activity metrics
  COUNT(tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') as activities_last_30_days,
  COUNT(tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '7 days') as activities_last_7_days,
  COUNT(tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '1 day') as activities_last_1_day,
  COUNT(DISTINCT DATE(tal.created_at)) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') as active_days_last_30_days,
  
  -- Receipt metrics
  COUNT(r.id) FILTER (WHERE r.date >= NOW() - INTERVAL '30 days') as receipts_last_30_days,
  COUNT(r.id) FILTER (WHERE r.date >= NOW() - INTERVAL '7 days') as receipts_last_7_days,
  SUM(r.total) FILTER (WHERE r.date >= NOW() - INTERVAL '30 days') as total_amount_last_30_days,
  COUNT(DISTINCT r.category) FILTER (WHERE r.date >= NOW() - INTERVAL '30 days') as categories_used_last_30_days,
  COUNT(r.id) FILTER (WHERE r.date >= NOW() - INTERVAL '30 days' AND r.ai_processed = true) as ai_receipts_last_30_days,
  
  -- Calculated metrics
  CASE 
    WHEN tm.last_active_at >= NOW() - INTERVAL '1 day' THEN 'very_active'
    WHEN tm.last_active_at >= NOW() - INTERVAL '7 days' THEN 'active'
    WHEN tm.last_active_at >= NOW() - INTERVAL '30 days' THEN 'moderate'
    WHEN tm.last_active_at >= NOW() - INTERVAL '90 days' THEN 'inactive'
    ELSE 'dormant'
  END as activity_status,
  
  EXTRACT(DAYS FROM (NOW() - tm.joined_at)) as days_since_joined,
  EXTRACT(DAYS FROM (NOW() - COALESCE(tm.last_active_at, tm.joined_at))) as days_since_last_active,
  
  -- Engagement score (0-100)
  LEAST(100, GREATEST(0, 
    (COUNT(tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 2) +
    (COUNT(r.id) FILTER (WHERE r.date >= NOW() - INTERVAL '30 days') * 3) +
    (COUNT(DISTINCT DATE(tal.created_at)) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 5) +
    CASE WHEN tm.last_active_at >= NOW() - INTERVAL '7 days' THEN 20 ELSE 0 END
  )) as engagement_score,
  
  NOW() as last_updated
FROM public.team_members tm
LEFT JOIN public.team_audit_logs tal ON tm.user_id = tal.performed_by AND tm.team_id = tal.team_id
LEFT JOIN public.receipts r ON tm.user_id = r.user_id AND tm.team_id = r.team_id AND r.deleted_at IS NULL
WHERE tm.removal_scheduled_at IS NULL
GROUP BY tm.team_id, tm.user_id, tm.role, tm.joined_at, tm.last_active_at, tm.invitation_accepted_at;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_team_member_activity_summary_unique
ON public.mv_team_member_activity_summary(team_id, user_id);

-- Materialized view for team engagement metrics
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_team_engagement_metrics AS
SELECT 
  t.id as team_id,
  t.name as team_name,
  
  -- Team overview
  COUNT(tm.id) as total_members,
  COUNT(tm.id) FILTER (WHERE tmas.activity_status = 'very_active') as very_active_members,
  COUNT(tm.id) FILTER (WHERE tmas.activity_status = 'active') as active_members,
  COUNT(tm.id) FILTER (WHERE tmas.activity_status = 'moderate') as moderate_members,
  COUNT(tm.id) FILTER (WHERE tmas.activity_status = 'inactive') as inactive_members,
  COUNT(tm.id) FILTER (WHERE tmas.activity_status = 'dormant') as dormant_members,
  COUNT(tm.id) FILTER (WHERE tm.removal_scheduled_at IS NOT NULL) as scheduled_removals,
  AVG(tmas.days_since_joined) as avg_member_tenure_days,
  
  -- Activity metrics
  SUM(tmas.activities_last_30_days) as total_activities_last_30_days,
  SUM(tmas.activities_last_7_days) as total_activities_last_7_days,
  COUNT(tm.id) FILTER (WHERE tmas.activities_last_7_days > 0) as active_contributors_last_7_days,
  AVG(tmas.activities_last_30_days) as avg_activities_per_member,
  
  -- Receipt metrics
  SUM(tmas.receipts_last_30_days) as total_receipts_last_30_days,
  SUM(tmas.total_amount_last_30_days) as total_amount_last_30_days,
  SUM(tmas.ai_receipts_last_30_days) as ai_receipts_last_30_days,
  COUNT(tm.id) FILTER (WHERE tmas.receipts_last_30_days > 0) as contributing_members,
  AVG(tmas.receipts_last_30_days) as avg_receipts_per_member,
  
  -- Engagement metrics
  AVG(tmas.engagement_score) as avg_engagement_score,
  COUNT(tm.id) FILTER (WHERE tmas.engagement_score >= 80) as high_engagement_members,
  COUNT(tm.id) FILTER (WHERE tmas.engagement_score >= 50) as medium_engagement_members,
  COUNT(tm.id) FILTER (WHERE tmas.engagement_score < 30) as low_engagement_members,
  
  -- AI adoption
  CASE 
    WHEN SUM(tmas.receipts_last_30_days) > 0 
    THEN (SUM(tmas.ai_receipts_last_30_days)::FLOAT / SUM(tmas.receipts_last_30_days) * 100)
    ELSE 0 
  END as ai_adoption_rate,
  
  -- Team health score (0-100)
  LEAST(100, GREATEST(0,
    (COUNT(tm.id) FILTER (WHERE tmas.activity_status IN ('very_active', 'active'))::FLOAT / NULLIF(COUNT(tm.id), 0) * 40) +
    (AVG(tmas.engagement_score) * 0.3) +
    (CASE 
      WHEN SUM(tmas.receipts_last_30_days) > 0 
      THEN (SUM(tmas.ai_receipts_last_30_days)::FLOAT / SUM(tmas.receipts_last_30_days) * 20)
      ELSE 0 
    END) +
    (COUNT(tm.id) FILTER (WHERE tmas.activities_last_7_days > 0)::FLOAT / NULLIF(COUNT(tm.id), 0) * 10)
  )) as team_health_score,
  
  NOW() as last_updated
FROM public.teams t
LEFT JOIN public.team_members tm ON t.id = tm.team_id AND tm.removal_scheduled_at IS NULL
LEFT JOIN public.mv_team_member_activity_summary tmas ON tm.team_id = tmas.team_id AND tm.user_id = tmas.user_id
WHERE t.status = 'active'
GROUP BY t.id, t.name;

-- Create unique index for team engagement metrics
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_team_engagement_metrics_unique
ON public.mv_team_engagement_metrics(team_id);

-- ============================================================================
-- 3. PERFORMANCE MONITORING TABLES
-- ============================================================================

-- Table for tracking member analytics query performance
CREATE TABLE IF NOT EXISTS public.member_analytics_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Query identification
  function_name VARCHAR(100) NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Performance metrics
  execution_time_ms INTEGER NOT NULL,
  rows_processed INTEGER,
  rows_returned INTEGER,
  cache_hit BOOLEAN DEFAULT false,
  
  -- Query parameters
  date_range_days INTEGER,
  filters_applied JSONB DEFAULT '{}',
  
  -- System context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  database_load_avg FLOAT,
  concurrent_queries INTEGER,
  
  -- Metadata
  query_hash VARCHAR(64), -- For identifying similar queries
  optimization_applied TEXT[],
  error_message TEXT
);

-- Indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_member_analytics_performance_function_time
ON public.member_analytics_performance_metrics(function_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_analytics_performance_team_time
ON public.member_analytics_performance_metrics(team_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_member_analytics_performance_execution_time
ON public.member_analytics_performance_metrics(execution_time_ms DESC, created_at DESC);

-- ============================================================================
-- 4. AUTOMATED MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to refresh member analytics materialized views
CREATE OR REPLACE FUNCTION public.refresh_member_analytics_views()
RETURNS VOID
LANGUAGE plpgsql
AS $function$
DECLARE
  _start_time TIMESTAMP WITH TIME ZONE := NOW();
  _rows_affected INTEGER;
BEGIN
  -- Refresh member activity summary
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_team_member_activity_summary;
  GET DIAGNOSTICS _rows_affected = ROW_COUNT;
  
  -- Log performance metric
  INSERT INTO public.member_analytics_performance_metrics (
    function_name, execution_time_ms, rows_processed, 
    filters_applied, optimization_applied
  ) VALUES (
    'refresh_member_activity_summary',
    EXTRACT(MILLISECONDS FROM (NOW() - _start_time))::INTEGER,
    _rows_affected,
    jsonb_build_object('refresh_type', 'concurrent'),
    ARRAY['materialized_view_refresh']
  );
  
  -- Reset start time for next view
  _start_time := NOW();
  
  -- Refresh team engagement metrics
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_team_engagement_metrics;
  GET DIAGNOSTICS _rows_affected = ROW_COUNT;
  
  -- Log performance metric
  INSERT INTO public.member_analytics_performance_metrics (
    function_name, execution_time_ms, rows_processed,
    filters_applied, optimization_applied
  ) VALUES (
    'refresh_team_engagement_metrics',
    EXTRACT(MILLISECONDS FROM (NOW() - _start_time))::INTEGER,
    _rows_affected,
    jsonb_build_object('refresh_type', 'concurrent'),
    ARRAY['materialized_view_refresh']
  );
  
  -- Clean up old performance metrics (keep last 30 days)
  DELETE FROM public.member_analytics_performance_metrics 
  WHERE created_at < NOW() - INTERVAL '30 days';
  
END;
$function$;

-- Function to analyze member analytics query performance
CREATE OR REPLACE FUNCTION public.analyze_member_analytics_performance(
  _hours_back INTEGER DEFAULT 24
)
RETURNS TABLE(
  function_name VARCHAR(100),
  avg_execution_time_ms FLOAT,
  max_execution_time_ms INTEGER,
  total_queries INTEGER,
  cache_hit_rate FLOAT,
  performance_grade CHAR(1)
) 
LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    mpm.function_name,
    AVG(mpm.execution_time_ms) as avg_execution_time_ms,
    MAX(mpm.execution_time_ms) as max_execution_time_ms,
    COUNT(*)::INTEGER as total_queries,
    (COUNT(*) FILTER (WHERE mpm.cache_hit = true)::FLOAT / COUNT(*) * 100) as cache_hit_rate,
    CASE 
      WHEN AVG(mpm.execution_time_ms) < 100 THEN 'A'
      WHEN AVG(mpm.execution_time_ms) < 500 THEN 'B'
      WHEN AVG(mpm.execution_time_ms) < 1000 THEN 'C'
      WHEN AVG(mpm.execution_time_ms) < 2000 THEN 'D'
      ELSE 'F'
    END as performance_grade
  FROM public.member_analytics_performance_metrics mpm
  WHERE mpm.created_at >= NOW() - INTERVAL '1 hour' * _hours_back
    AND mpm.error_message IS NULL
  GROUP BY mpm.function_name
  ORDER BY avg_execution_time_ms DESC;
END;
$function$;

-- ============================================================================
-- 5. OPTIMIZED ANALYTICS QUERY FUNCTIONS
-- ============================================================================

-- Optimized function for getting member analytics using materialized views
CREATE OR REPLACE FUNCTION public.get_member_analytics_optimized(
  _team_id UUID,
  _user_id UUID DEFAULT NULL,
  _use_cache BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  _result JSONB := '{}';
  _start_time TIMESTAMP WITH TIME ZONE := NOW();
  _execution_time INTEGER;
  _cache_hit BOOLEAN := false;
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

  -- Use materialized view for faster queries when cache is enabled
  IF _use_cache THEN
    _cache_hit := true;

    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'member_info', jsonb_build_object(
          'user_id', tmas.user_id,
          'role', tmas.role,
          'joined_at', tmas.joined_at,
          'last_active_at', tmas.last_active_at,
          'days_since_joined', tmas.days_since_joined,
          'days_since_last_active', tmas.days_since_last_active
        ),
        'activity_stats', jsonb_build_object(
          'total_activities_30_days', tmas.activities_last_30_days,
          'total_activities_7_days', tmas.activities_last_7_days,
          'total_activities_1_day', tmas.activities_last_1_day,
          'active_days_30_days', tmas.active_days_last_30_days,
          'activity_status', tmas.activity_status
        ),
        'engagement_metrics', jsonb_build_object(
          'receipts_30_days', tmas.receipts_last_30_days,
          'receipts_7_days', tmas.receipts_last_7_days,
          'total_amount_30_days', tmas.total_amount_last_30_days,
          'categories_used_30_days', tmas.categories_used_last_30_days,
          'ai_receipts_30_days', tmas.ai_receipts_last_30_days,
          'ai_adoption_rate', CASE
            WHEN tmas.receipts_last_30_days > 0
            THEN (tmas.ai_receipts_last_30_days::FLOAT / tmas.receipts_last_30_days * 100)
            ELSE 0
          END,
          'engagement_score', tmas.engagement_score
        ),
        'performance_data', jsonb_build_object(
          'engagement_score', tmas.engagement_score,
          'activity_status', tmas.activity_status,
          'last_updated', tmas.last_updated
        )
      ),
      'metadata', jsonb_build_object(
        'cache_used', true,
        'data_freshness', EXTRACT(MINUTES FROM (NOW() - tmas.last_updated))
      )
    ) INTO _result
    FROM public.mv_team_member_activity_summary tmas
    WHERE tmas.team_id = _team_id
      AND (_user_id IS NULL OR tmas.user_id = _user_id);

    -- If no data found in materialized view, fall back to real-time query
    IF _result IS NULL OR _result = '{}' THEN
      _cache_hit := false;
      -- Fall back to original function (simplified for performance)
      SELECT public.get_member_analytics(_team_id, _user_id) INTO _result;
    END IF;
  ELSE
    _cache_hit := false;
    -- Use real-time query
    SELECT public.get_member_analytics(_team_id, _user_id) INTO _result;
  END IF;

  -- Record performance metrics
  _execution_time := EXTRACT(MILLISECONDS FROM (NOW() - _start_time))::INTEGER;

  INSERT INTO public.member_analytics_performance_metrics (
    function_name, team_id, user_id, execution_time_ms,
    cache_hit, filters_applied, optimization_applied
  ) VALUES (
    'get_member_analytics_optimized', _team_id, _user_id, _execution_time,
    _cache_hit,
    jsonb_build_object('use_cache', _use_cache, 'user_specific', _user_id IS NOT NULL),
    CASE WHEN _cache_hit THEN ARRAY['materialized_view'] ELSE ARRAY['real_time_query'] END
  );

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optimized function for team engagement metrics
CREATE OR REPLACE FUNCTION public.get_team_engagement_metrics_optimized(
  _team_id UUID,
  _use_cache BOOLEAN DEFAULT true
) RETURNS JSONB AS $$
DECLARE
  _result JSONB := '{}';
  _start_time TIMESTAMP WITH TIME ZONE := NOW();
  _execution_time INTEGER;
  _cache_hit BOOLEAN := false;
  _current_user_id UUID := auth.uid();
  _current_user_role public.team_member_role;
BEGIN
  -- Verify team access (admin/owner only)
  SELECT role INTO _current_user_role
  FROM public.team_members
  WHERE team_id = _team_id AND user_id = _current_user_id;

  IF _current_user_role IS NULL OR _current_user_role NOT IN ('admin', 'owner') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Access denied - admin/owner role required',
      'error_code', 'INSUFFICIENT_PERMISSIONS'
    );
  END IF;

  -- Use materialized view for faster queries when cache is enabled
  IF _use_cache THEN
    _cache_hit := true;

    SELECT jsonb_build_object(
      'success', true,
      'data', jsonb_build_object(
        'team_overview', jsonb_build_object(
          'total_members', tem.total_members,
          'very_active_members', tem.very_active_members,
          'active_members', tem.active_members,
          'moderate_members', tem.moderate_members,
          'inactive_members', tem.inactive_members,
          'dormant_members', tem.dormant_members,
          'scheduled_removals', tem.scheduled_removals,
          'avg_member_tenure_days', tem.avg_member_tenure_days
        ),
        'activity_metrics', jsonb_build_object(
          'total_activities_30_days', tem.total_activities_last_30_days,
          'total_activities_7_days', tem.total_activities_last_7_days,
          'active_contributors_7_days', tem.active_contributors_last_7_days,
          'avg_activities_per_member', tem.avg_activities_per_member
        ),
        'receipt_metrics', jsonb_build_object(
          'total_receipts_30_days', tem.total_receipts_last_30_days,
          'total_amount_30_days', tem.total_amount_last_30_days,
          'ai_receipts_30_days', tem.ai_receipts_last_30_days,
          'contributing_members', tem.contributing_members,
          'avg_receipts_per_member', tem.avg_receipts_per_member,
          'ai_adoption_rate', tem.ai_adoption_rate
        ),
        'engagement_metrics', jsonb_build_object(
          'avg_engagement_score', tem.avg_engagement_score,
          'high_engagement_members', tem.high_engagement_members,
          'medium_engagement_members', tem.medium_engagement_members,
          'low_engagement_members', tem.low_engagement_members
        ),
        'team_health_score', tem.team_health_score,
        'last_updated', tem.last_updated
      ),
      'metadata', jsonb_build_object(
        'cache_used', true,
        'data_freshness', EXTRACT(MINUTES FROM (NOW() - tem.last_updated))
      )
    ) INTO _result
    FROM public.mv_team_engagement_metrics tem
    WHERE tem.team_id = _team_id;

    -- If no data found in materialized view, fall back to real-time query
    IF _result IS NULL OR _result = '{}' THEN
      _cache_hit := false;
      -- Fall back to original function
      SELECT public.get_team_member_engagement_metrics(_team_id) INTO _result;
    END IF;
  ELSE
    _cache_hit := false;
    -- Use real-time query
    SELECT public.get_team_member_engagement_metrics(_team_id) INTO _result;
  END IF;

  -- Record performance metrics
  _execution_time := EXTRACT(MILLISECONDS FROM (NOW() - _start_time))::INTEGER;

  INSERT INTO public.member_analytics_performance_metrics (
    function_name, team_id, execution_time_ms,
    cache_hit, filters_applied, optimization_applied
  ) VALUES (
    'get_team_engagement_metrics_optimized', _team_id, _execution_time,
    _cache_hit,
    jsonb_build_object('use_cache', _use_cache),
    CASE WHEN _cache_hit THEN ARRAY['materialized_view'] ELSE ARRAY['real_time_query'] END
  );

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. MAINTENANCE AND MONITORING PROCEDURES
-- ============================================================================

-- Function to get database performance recommendations
CREATE OR REPLACE FUNCTION public.get_member_analytics_performance_recommendations()
RETURNS TABLE(
  recommendation_type VARCHAR(50),
  priority VARCHAR(10),
  description TEXT,
  action_required TEXT,
  estimated_impact VARCHAR(20)
)
LANGUAGE plpgsql
AS $function$
DECLARE
  _slow_queries INTEGER;
  _cache_hit_rate FLOAT;
  _materialized_view_age INTERVAL;
BEGIN
  -- Check for slow queries
  SELECT COUNT(*) INTO _slow_queries
  FROM public.member_analytics_performance_metrics
  WHERE execution_time_ms > 2000
    AND created_at >= NOW() - INTERVAL '24 hours';

  -- Check cache hit rate
  SELECT AVG(CASE WHEN cache_hit THEN 1.0 ELSE 0.0 END) * 100 INTO _cache_hit_rate
  FROM public.member_analytics_performance_metrics
  WHERE created_at >= NOW() - INTERVAL '24 hours';

  -- Check materialized view freshness
  SELECT NOW() - MAX(last_updated) INTO _materialized_view_age
  FROM public.mv_team_member_activity_summary;

  -- Generate recommendations
  IF _slow_queries > 10 THEN
    RETURN QUERY SELECT
      'performance'::VARCHAR(50), 'high'::VARCHAR(10),
      'High number of slow queries detected'::TEXT,
      'Consider refreshing materialized views or adding more indexes'::TEXT,
      'high'::VARCHAR(20);
  END IF;

  IF _cache_hit_rate < 70 THEN
    RETURN QUERY SELECT
      'caching'::VARCHAR(50), 'medium'::VARCHAR(10),
      'Low cache hit rate detected'::TEXT,
      'Enable caching for analytics functions or refresh materialized views'::TEXT,
      'medium'::VARCHAR(20);
  END IF;

  IF _materialized_view_age > INTERVAL '2 hours' THEN
    RETURN QUERY SELECT
      'maintenance'::VARCHAR(50), 'medium'::VARCHAR(10),
      'Materialized views are stale'::TEXT,
      'Run refresh_member_analytics_views() function'::TEXT,
      'medium'::VARCHAR(20);
  END IF;

  -- If no issues found
  IF NOT FOUND THEN
    RETURN QUERY SELECT
      'status'::VARCHAR(50), 'info'::VARCHAR(10),
      'Member analytics performance is optimal'::TEXT,
      'No action required'::TEXT,
      'none'::VARCHAR(20);
  END IF;
END;
$function$;

-- ============================================================================
-- 7. SCHEDULED MAINTENANCE SETUP
-- ============================================================================

-- Note: These would typically be set up with pg_cron in production
-- Example cron jobs (commented out for manual setup):

-- Refresh materialized views every 2 hours
-- SELECT cron.schedule('refresh-member-analytics', '0 */2 * * *', 'SELECT public.refresh_member_analytics_views();');

-- Clean up old performance metrics daily
-- SELECT cron.schedule('cleanup-analytics-metrics', '0 1 * * *', 'DELETE FROM public.member_analytics_performance_metrics WHERE created_at < NOW() - INTERVAL ''30 days'';');

-- Generate performance reports weekly
-- SELECT cron.schedule('analytics-performance-report', '0 9 * * 1', 'SELECT public.analyze_member_analytics_performance(168);');

-- ============================================================================
-- 8. COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.member_analytics_performance_metrics IS 'Performance monitoring for member analytics queries with execution times and optimization tracking';
COMMENT ON MATERIALIZED VIEW public.mv_team_member_activity_summary IS 'Pre-computed member activity metrics for fast analytics queries';
COMMENT ON MATERIALIZED VIEW public.mv_team_engagement_metrics IS 'Pre-computed team engagement metrics for dashboard performance';

COMMENT ON FUNCTION public.refresh_member_analytics_views IS 'Refreshes all member analytics materialized views and logs performance metrics';
COMMENT ON FUNCTION public.analyze_member_analytics_performance IS 'Analyzes query performance over specified time period and provides performance grades';
COMMENT ON FUNCTION public.get_member_analytics_optimized IS 'Optimized member analytics function using materialized views for improved performance';
COMMENT ON FUNCTION public.get_team_engagement_metrics_optimized IS 'Optimized team engagement metrics function with caching support';
COMMENT ON FUNCTION public.get_member_analytics_performance_recommendations IS 'Provides automated performance recommendations based on query metrics';

-- ============================================================================
-- 9. INITIAL DATA POPULATION
-- ============================================================================

-- Populate materialized views with initial data
SELECT public.refresh_member_analytics_views();

-- Create initial performance baseline
INSERT INTO public.member_analytics_performance_metrics (
  function_name, execution_time_ms, rows_processed,
  filters_applied, optimization_applied
) VALUES (
  'initial_setup', 0, 0,
  jsonb_build_object('setup_type', 'migration'),
  ARRAY['materialized_views_created', 'indexes_created', 'functions_optimized']
);
