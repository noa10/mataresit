-- ============================================================================
-- ADVANCED ANALYTICS INFRASTRUCTURE
-- ============================================================================
-- This migration extends the existing analytics system with advanced features
-- including collaboration metrics, predictive analytics, and ROI analysis.
--
-- Features added:
-- - Enhanced materialized view combining member analytics with collaboration data
-- - Advanced analytics functions for predictive insights and ROI analysis
-- - Performance optimization for complex analytics queries
-- - Real-time analytics support with proper indexing

-- ============================================================================
-- 1. ENHANCED MATERIALIZED VIEW FOR ADVANCED ANALYTICS
-- ============================================================================

-- Drop existing view if it exists to recreate with enhanced structure
DROP MATERIALIZED VIEW IF EXISTS public.mv_advanced_analytics_summary CASCADE;

-- Create comprehensive analytics materialized view
CREATE MATERIALIZED VIEW public.mv_advanced_analytics_summary AS
SELECT
  -- Base member information
  tm.team_id,
  tm.user_id,
  tm.role,
  tm.joined_at,
  tm.last_active_at,

  -- Basic activity metrics (calculated from available data)
  COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') as activities_last_30_days,
  COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '7 days') as activities_last_7_days,
  COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '1 day') as activities_last_1_day,
  COUNT(DISTINCT DATE(tal.created_at)) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') as active_days_last_30_days,
  COUNT(DISTINCT r.id) as receipts_created,
  COUNT(DISTINCT r.id) FILTER (WHERE r.ai_suggestions IS NOT NULL) as receipts_ai_processed,
  COALESCE(SUM(r.total), 0) as total_receipt_amount,
  -- Basic engagement score calculation
  LEAST(100, GREATEST(0,
    (COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 2) +
    (COUNT(DISTINCT r.id) * 5) +
    (COUNT(DISTINCT DATE(tal.created_at)) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 3)
  )) as engagement_score,
  
  -- Collaboration metrics - Basic (using available tables)
  COUNT(DISTINCT c.id) FILTER (WHERE c.created_by = tm.user_id) as conversations_created,
  COUNT(DISTINCT c.id) FILTER (WHERE c.participants::jsonb ? tm.user_id::text) as conversations_participated,
  COUNT(DISTINCT c.id) FILTER (WHERE c.last_message_at >= NOW() - INTERVAL '30 days' AND c.participants::jsonb ? tm.user_id::text) as active_conversations_30_days,

  -- Placeholder collaboration metrics (will be populated when full collaboration system is deployed)
  0 as messages_sent_30_days,
  0 as messages_sent_7_days,
  0 as unique_message_recipients_30_days,
  0 as projects_involved,
  0 as projects_created,
  0 as projects_managed,
  0 as projects_completed,
  0 as tasks_assigned,
  0 as tasks_completed,
  0 as tasks_created,
  0 as avg_task_hours,
  0 as discussions_started,
  0 as discussion_messages_30_days,
  0 as discussions_participated_30_days,
  0 as files_shared,
  0 as total_file_downloads,
  0 as file_interactions_30_days,
  
  -- Performance indicators
  CASE
    WHEN COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '7 days') > COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 0.5 THEN 'increasing'
    WHEN COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '7 days') < COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 0.1 THEN 'decreasing'
    ELSE 'stable'
  END as activity_trend,

  -- Collaboration effectiveness score (0-100) - basic calculation with available data
  LEAST(100, GREATEST(0,
    (COUNT(DISTINCT c.id) FILTER (WHERE c.created_by = tm.user_id) * 10) +
    (COUNT(DISTINCT c.id) FILTER (WHERE c.participants::jsonb ? tm.user_id::text) * 5) +
    (COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 1) +
    (COUNT(DISTINCT r.id) * 3)
  )) as collaboration_score,

  -- Predictive indicators
  CASE
    WHEN LEAST(100, GREATEST(0,
      (COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 2) +
      (COUNT(DISTINCT r.id) * 5) +
      (COUNT(DISTINCT DATE(tal.created_at)) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 3)
    )) > 80 AND COUNT(DISTINCT c.id) FILTER (WHERE c.last_message_at >= NOW() - INTERVAL '7 days' AND c.participants::jsonb ? tm.user_id::text) > 0 THEN 'high_performer'
    WHEN LEAST(100, GREATEST(0,
      (COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 2) +
      (COUNT(DISTINCT r.id) * 5) +
      (COUNT(DISTINCT DATE(tal.created_at)) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 3)
    )) > 60 THEN 'solid_contributor'
    WHEN LEAST(100, GREATEST(0,
      (COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 2) +
      (COUNT(DISTINCT r.id) * 5) +
      (COUNT(DISTINCT DATE(tal.created_at)) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') * 3)
    )) > 40 THEN 'developing'
    WHEN COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '7 days') = 0 AND COUNT(DISTINCT tal.id) FILTER (WHERE tal.created_at >= NOW() - INTERVAL '30 days') < 5 THEN 'at_risk'
    ELSE 'needs_attention'
  END as performance_category,
  
  -- ROI indicators (placeholder for future implementation)
  NULL as avg_completion_time,
  0 as project_success_rate,

  -- Timestamps
  NOW() as last_updated,
  EXTRACT(EPOCH FROM NOW()) as last_updated_epoch

FROM public.team_members tm
-- Join with available tables
LEFT JOIN public.team_audit_logs tal ON tm.user_id = tal.performed_by AND tm.team_id = tal.team_id
LEFT JOIN public.receipts r ON tm.user_id = r.user_id AND r.deleted_at IS NULL
LEFT JOIN public.conversations c ON tm.team_id = c.team_id

WHERE tm.removal_scheduled_at IS NULL
GROUP BY
  tm.team_id, tm.user_id, tm.role, tm.joined_at, tm.last_active_at;

-- Create unique index for the materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_advanced_analytics_summary_unique
ON public.mv_advanced_analytics_summary(team_id, user_id);

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_mv_advanced_analytics_team_performance
ON public.mv_advanced_analytics_summary(team_id, performance_category, collaboration_score DESC);

CREATE INDEX IF NOT EXISTS idx_mv_advanced_analytics_activity_trend
ON public.mv_advanced_analytics_summary(team_id, activity_trend, last_updated);

-- ============================================================================
-- 2. TEAM-LEVEL ADVANCED ANALYTICS MATERIALIZED VIEW
-- ============================================================================

-- Create team-level analytics summary
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_team_advanced_analytics AS
SELECT 
  t.id as team_id,
  t.name as team_name,
  
  -- Team size and composition
  COUNT(tm.user_id) as total_members,
  COUNT(tm.user_id) FILTER (WHERE tm.role = 'owner') as owners_count,
  COUNT(tm.user_id) FILTER (WHERE tm.role = 'admin') as admins_count,
  COUNT(tm.user_id) FILTER (WHERE tm.role = 'member') as members_count,
  
  -- Activity aggregations
  COALESCE(SUM(aas.activities_last_30_days), 0) as team_activities_30_days,
  COALESCE(SUM(aas.activities_last_7_days), 0) as team_activities_7_days,
  COALESCE(AVG(aas.engagement_score), 0) as avg_engagement_score,

  -- Collaboration aggregations (basic with available data)
  COALESCE(SUM(aas.conversations_created), 0) as team_conversations_created,
  COALESCE(SUM(aas.conversations_participated), 0) as team_conversations_participated,
  COALESCE(SUM(aas.active_conversations_30_days), 0) as team_active_conversations_30_days,
  -- Placeholder metrics for future collaboration features
  0 as team_messages_30_days,
  0 as team_projects_total,
  0 as team_projects_completed,
  0 as team_tasks_completed,
  0 as team_files_shared,
  
  -- Performance distribution
  COUNT(*) FILTER (WHERE aas.performance_category = 'high_performer') as high_performers,
  COUNT(*) FILTER (WHERE aas.performance_category = 'solid_contributor') as solid_contributors,
  COUNT(*) FILTER (WHERE aas.performance_category = 'developing') as developing_members,
  COUNT(*) FILTER (WHERE aas.performance_category = 'needs_attention') as needs_attention,
  COUNT(*) FILTER (WHERE aas.performance_category = 'at_risk') as at_risk_members,
  
  -- Team health indicators
  CASE
    WHEN COUNT(*) FILTER (WHERE aas.performance_category IN ('high_performer', 'solid_contributor'))::FLOAT / NULLIF(COUNT(*), 0) > 0.7 THEN 'excellent'
    WHEN COUNT(*) FILTER (WHERE aas.performance_category IN ('high_performer', 'solid_contributor'))::FLOAT / NULLIF(COUNT(*), 0) > 0.5 THEN 'good'
    WHEN COUNT(*) FILTER (WHERE aas.performance_category = 'at_risk')::FLOAT / NULLIF(COUNT(*), 0) > 0.3 THEN 'concerning'
    ELSE 'needs_improvement'
  END as team_health_status,
  
  COALESCE(AVG(aas.collaboration_score), 0) as avg_collaboration_score,
  COALESCE(AVG(aas.project_success_rate), 0) as avg_project_success_rate,
  
  NOW() as last_updated

FROM public.teams t
LEFT JOIN public.team_members tm ON t.id = tm.team_id AND tm.removal_scheduled_at IS NULL
LEFT JOIN public.mv_advanced_analytics_summary aas ON tm.team_id = aas.team_id AND tm.user_id = aas.user_id
GROUP BY t.id, t.name;

-- Create index for team analytics
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_team_advanced_analytics_unique
ON public.mv_team_advanced_analytics(team_id);

CREATE INDEX IF NOT EXISTS idx_mv_team_advanced_analytics_health
ON public.mv_team_advanced_analytics(team_health_status, avg_collaboration_score DESC);

-- ============================================================================
-- 3. ADVANCED ANALYTICS FUNCTIONS
-- ============================================================================

-- Function to get comprehensive advanced analytics for a team member
CREATE OR REPLACE FUNCTION public.get_advanced_member_analytics(
  _team_id UUID,
  _user_id UUID DEFAULT NULL,
  _period_days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID;
BEGIN
  -- Get current user
  _current_user_id := auth.uid();

  -- Verify team access
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
    AND user_id = _current_user_id
    AND removal_scheduled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not a member of this team';
  END IF;

  -- If no specific user provided, get current user's analytics
  IF _user_id IS NULL THEN
    _user_id := _current_user_id;
  END IF;

  -- Verify target user access (non-admins can only view their own analytics)
  IF _user_id != _current_user_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.team_members
      WHERE team_id = _team_id
      AND user_id = _current_user_id
      AND role IN ('owner', 'admin')
      AND removal_scheduled_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Access denied: Only team admins can view other members analytics';
    END IF;
  END IF;

  -- Get comprehensive analytics data
  SELECT jsonb_build_object(
    'member_info', jsonb_build_object(
      'user_id', aas.user_id,
      'role', aas.role,
      'joined_at', aas.joined_at,
      'last_active_at', aas.last_active_at,
      'performance_category', aas.performance_category,
      'activity_trend', aas.activity_trend
    ),
    'activity_metrics', jsonb_build_object(
      'activities_30_days', aas.activities_last_30_days,
      'activities_7_days', aas.activities_last_7_days,
      'activities_1_day', aas.activities_last_1_day,
      'active_days_30_days', aas.active_days_last_30_days,
      'receipts_created', aas.receipts_created,
      'receipts_ai_processed', aas.receipts_ai_processed,
      'total_receipt_amount', aas.total_receipt_amount,
      'engagement_score', aas.engagement_score
    ),
    'collaboration_metrics', jsonb_build_object(
      'messages_sent_30_days', aas.messages_sent_30_days,
      'messages_sent_7_days', aas.messages_sent_7_days,
      'conversations_participated_30_days', aas.conversations_participated_30_days,
      'unique_message_recipients_30_days', aas.unique_message_recipients_30_days,
      'projects_involved', aas.projects_involved,
      'projects_created', aas.projects_created,
      'projects_managed', aas.projects_managed,
      'projects_completed', aas.projects_completed,
      'tasks_assigned', aas.tasks_assigned,
      'tasks_completed', aas.tasks_completed,
      'tasks_created', aas.tasks_created,
      'avg_task_hours', aas.avg_task_hours,
      'discussions_started', aas.discussions_started,
      'discussion_messages_30_days', aas.discussion_messages_30_days,
      'discussions_participated_30_days', aas.discussions_participated_30_days,
      'files_shared', aas.files_shared,
      'total_file_downloads', aas.total_file_downloads,
      'file_interactions_30_days', aas.file_interactions_30_days,
      'collaboration_score', aas.collaboration_score
    ),
    'performance_indicators', jsonb_build_object(
      'avg_completion_time', aas.avg_completion_time,
      'project_success_rate', aas.project_success_rate,
      'productivity_trend', CASE
        WHEN aas.activity_trend = 'increasing' AND aas.collaboration_score > 50 THEN 'improving'
        WHEN aas.activity_trend = 'decreasing' OR aas.collaboration_score < 30 THEN 'declining'
        ELSE 'stable'
      END,
      'collaboration_effectiveness', CASE
        WHEN aas.collaboration_score > 80 THEN 'excellent'
        WHEN aas.collaboration_score > 60 THEN 'good'
        WHEN aas.collaboration_score > 40 THEN 'average'
        ELSE 'needs_improvement'
      END
    ),
    'predictive_insights', jsonb_build_object(
      'performance_forecast', CASE
        WHEN aas.performance_category = 'high_performer' AND aas.activity_trend = 'increasing' THEN 'continued_excellence'
        WHEN aas.performance_category IN ('solid_contributor', 'developing') AND aas.activity_trend = 'increasing' THEN 'improvement_likely'
        WHEN aas.performance_category = 'at_risk' AND aas.activity_trend = 'stable' THEN 'intervention_needed'
        WHEN aas.activity_trend = 'decreasing' THEN 'decline_risk'
        ELSE 'stable_performance'
      END,
      'recommended_actions', CASE
        WHEN aas.performance_category = 'at_risk' THEN ARRAY['Schedule 1-on-1 meeting', 'Provide additional training', 'Assign mentor']
        WHEN aas.collaboration_score < 30 THEN ARRAY['Encourage team participation', 'Assign collaborative projects', 'Team building activities']
        WHEN aas.project_success_rate < 0.5 THEN ARRAY['Review project management skills', 'Provide project training', 'Adjust project complexity']
        WHEN aas.performance_category = 'high_performer' THEN ARRAY['Consider leadership opportunities', 'Mentor other team members', 'Lead strategic projects']
        ELSE ARRAY['Continue current development path', 'Regular check-ins', 'Skill development opportunities']
      END,
      'growth_potential', CASE
        WHEN aas.performance_category = 'developing' AND aas.activity_trend = 'increasing' THEN 'high'
        WHEN aas.performance_category IN ('solid_contributor', 'high_performer') THEN 'moderate'
        WHEN aas.performance_category = 'at_risk' THEN 'requires_support'
        ELSE 'stable'
      END
    ),
    'metadata', jsonb_build_object(
      'generated_at', NOW(),
      'generated_by', _current_user_id,
      'team_id', _team_id,
      'period_days', _period_days,
      'data_freshness', EXTRACT(EPOCH FROM (NOW() - aas.last_updated)) / 3600 -- Hours since last update
    )
  ) INTO _result
  FROM public.mv_advanced_analytics_summary aas
  WHERE aas.team_id = _team_id AND aas.user_id = _user_id;

  -- Return empty result if member not found
  IF _result IS NULL THEN
    _result := jsonb_build_object(
      'error', 'Member not found or no analytics data available',
      'team_id', _team_id,
      'user_id', _user_id
    );
  END IF;

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get team-wide advanced analytics
CREATE OR REPLACE FUNCTION public.get_team_advanced_analytics(
  _team_id UUID,
  _period_days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID;
BEGIN
  -- Get current user
  _current_user_id := auth.uid();

  -- Verify team access
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
    AND user_id = _current_user_id
    AND removal_scheduled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: User is not a member of this team';
  END IF;

  -- Get team analytics data
  SELECT jsonb_build_object(
    'team_info', jsonb_build_object(
      'team_id', taa.team_id,
      'team_name', taa.team_name,
      'total_members', taa.total_members,
      'team_health_status', taa.team_health_status,
      'last_updated', taa.last_updated
    ),
    'member_composition', jsonb_build_object(
      'owners_count', taa.owners_count,
      'admins_count', taa.admins_count,
      'members_count', taa.members_count,
      'composition_ratio', jsonb_build_object(
        'leadership_ratio', ROUND((taa.owners_count + taa.admins_count)::NUMERIC / NULLIF(taa.total_members, 0) * 100, 2),
        'member_ratio', ROUND(taa.members_count::NUMERIC / NULLIF(taa.total_members, 0) * 100, 2)
      )
    ),
    'activity_summary', jsonb_build_object(
      'team_activities_30_days', taa.team_activities_30_days,
      'team_activities_7_days', taa.team_activities_7_days,
      'avg_engagement_score', ROUND(taa.avg_engagement_score, 2),
      'activity_per_member', ROUND(taa.team_activities_30_days::NUMERIC / NULLIF(taa.total_members, 0), 2)
    ),
    'collaboration_summary', jsonb_build_object(
      'team_messages_30_days', taa.team_messages_30_days,
      'team_conversations_30_days', taa.team_conversations_30_days,
      'team_projects_total', taa.team_projects_total,
      'team_projects_completed', taa.team_projects_completed,
      'team_tasks_completed', taa.team_tasks_completed,
      'team_files_shared', taa.team_files_shared,
      'avg_collaboration_score', ROUND(taa.avg_collaboration_score, 2),
      'project_completion_rate', ROUND(taa.team_projects_completed::NUMERIC / NULLIF(taa.team_projects_total, 0) * 100, 2)
    ),
    'performance_distribution', jsonb_build_object(
      'high_performers', taa.high_performers,
      'solid_contributors', taa.solid_contributors,
      'developing_members', taa.developing_members,
      'needs_attention', taa.needs_attention,
      'at_risk_members', taa.at_risk_members,
      'performance_percentages', jsonb_build_object(
        'high_performers_pct', ROUND(taa.high_performers::NUMERIC / NULLIF(taa.total_members, 0) * 100, 2),
        'solid_contributors_pct', ROUND(taa.solid_contributors::NUMERIC / NULLIF(taa.total_members, 0) * 100, 2),
        'at_risk_pct', ROUND(taa.at_risk_members::NUMERIC / NULLIF(taa.total_members, 0) * 100, 2)
      )
    ),
    'team_insights', jsonb_build_object(
      'strengths', CASE
        WHEN taa.avg_collaboration_score > 70 THEN ARRAY['Strong collaboration', 'Active communication', 'Good project engagement']
        WHEN taa.avg_engagement_score > 70 THEN ARRAY['High individual engagement', 'Active receipt management', 'Good platform adoption']
        WHEN taa.team_projects_completed::NUMERIC / NULLIF(taa.team_projects_total, 0) > 0.8 THEN ARRAY['Excellent project completion', 'Strong execution', 'Reliable delivery']
        ELSE ARRAY['Consistent team participation', 'Regular activity levels']
      END,
      'areas_for_improvement', CASE
        WHEN taa.at_risk_members::NUMERIC / NULLIF(taa.total_members, 0) > 0.3 THEN ARRAY['High number of at-risk members', 'Need engagement strategies', 'Consider individual support']
        WHEN taa.avg_collaboration_score < 40 THEN ARRAY['Low collaboration levels', 'Improve team communication', 'Encourage project participation']
        WHEN taa.team_projects_completed::NUMERIC / NULLIF(taa.team_projects_total, 0) < 0.5 THEN ARRAY['Low project completion rate', 'Review project management', 'Improve task allocation']
        ELSE ARRAY['Continue current development', 'Monitor performance trends', 'Regular team check-ins']
      END,
      'recommended_actions', CASE
        WHEN taa.team_health_status = 'concerning' THEN ARRAY['Immediate team intervention', 'Individual member assessments', 'Restructure team processes']
        WHEN taa.team_health_status = 'needs_improvement' THEN ARRAY['Team building activities', 'Skill development programs', 'Improve communication channels']
        WHEN taa.team_health_status = 'excellent' THEN ARRAY['Maintain current practices', 'Share best practices', 'Consider team expansion']
        ELSE ARRAY['Regular monitoring', 'Gradual improvements', 'Focus on member development']
      END
    ),
    'predictive_analytics', jsonb_build_object(
      'team_trajectory', CASE
        WHEN taa.team_health_status = 'excellent' AND taa.avg_collaboration_score > 70 THEN 'high_growth_potential'
        WHEN taa.team_health_status = 'good' AND taa.at_risk_members = 0 THEN 'stable_growth'
        WHEN taa.at_risk_members::NUMERIC / NULLIF(taa.total_members, 0) > 0.2 THEN 'intervention_required'
        ELSE 'monitoring_needed'
      END,
      'success_probability', CASE
        WHEN taa.avg_project_success_rate > 0.8 THEN 'high'
        WHEN taa.avg_project_success_rate > 0.6 THEN 'moderate'
        WHEN taa.avg_project_success_rate > 0.4 THEN 'low'
        ELSE 'very_low'
      END,
      'growth_forecast', CASE
        WHEN taa.high_performers + taa.solid_contributors > taa.total_members * 0.7 THEN 'positive'
        WHEN taa.at_risk_members > taa.total_members * 0.3 THEN 'negative'
        ELSE 'neutral'
      END
    ),
    'metadata', jsonb_build_object(
      'generated_at', NOW(),
      'generated_by', _current_user_id,
      'team_id', _team_id,
      'period_days', _period_days,
      'data_freshness', EXTRACT(EPOCH FROM (NOW() - taa.last_updated)) / 3600
    )
  ) INTO _result
  FROM public.mv_team_advanced_analytics taa
  WHERE taa.team_id = _team_id;

  -- Return empty result if team not found
  IF _result IS NULL THEN
    _result := jsonb_build_object(
      'error', 'Team not found or no analytics data available',
      'team_id', _team_id
    );
  END IF;

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to refresh materialized views
CREATE OR REPLACE FUNCTION public.refresh_advanced_analytics_views()
RETURNS VOID AS $$
BEGIN
  -- Refresh base analytics view first
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_team_member_activity_summary;

  -- Refresh advanced analytics views
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_advanced_analytics_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_team_advanced_analytics;

  -- Log the refresh
  INSERT INTO public.member_analytics_performance_metrics (
    function_name,
    execution_time_ms,
    rows_processed,
    rows_returned,
    cache_hit,
    filters_applied
  ) VALUES (
    'refresh_advanced_analytics_views',
    0, -- Will be updated by calling function
    (SELECT COUNT(*) FROM public.mv_advanced_analytics_summary),
    (SELECT COUNT(*) FROM public.mv_team_advanced_analytics),
    false,
    '{"operation": "materialized_view_refresh"}'::jsonb
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get predictive analytics for team performance
CREATE OR REPLACE FUNCTION public.get_predictive_team_analytics(
  _team_id UUID,
  _forecast_days INTEGER DEFAULT 30
) RETURNS JSONB AS $$
DECLARE
  _result JSONB;
  _current_user_id UUID;
  _historical_data RECORD;
  _trend_analysis RECORD;
BEGIN
  -- Get current user and verify access
  _current_user_id := auth.uid();

  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = _team_id
    AND user_id = _current_user_id
    AND role IN ('owner', 'admin')
    AND removal_scheduled_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Access denied: Only team admins can access predictive analytics';
  END IF;

  -- Get historical trend data
  SELECT
    AVG(activities_last_7_days) as avg_weekly_activities,
    AVG(collaboration_score) as avg_collaboration,
    AVG(engagement_score) as avg_engagement,
    COUNT(*) FILTER (WHERE performance_category = 'high_performer') as high_performers,
    COUNT(*) FILTER (WHERE performance_category = 'at_risk') as at_risk_count,
    COUNT(*) as total_members
  INTO _historical_data
  FROM public.mv_advanced_analytics_summary
  WHERE team_id = _team_id;

  -- Calculate trend analysis
  SELECT
    CASE
      WHEN _historical_data.avg_weekly_activities > 50 THEN 'increasing'
      WHEN _historical_data.avg_weekly_activities < 20 THEN 'decreasing'
      ELSE 'stable'
    END as activity_trend,
    CASE
      WHEN _historical_data.avg_collaboration > 70 THEN 'improving'
      WHEN _historical_data.avg_collaboration < 40 THEN 'declining'
      ELSE 'stable'
    END as collaboration_trend
  INTO _trend_analysis;

  -- Build predictive analytics result
  SELECT jsonb_build_object(
    'forecast_period', jsonb_build_object(
      'start_date', CURRENT_DATE,
      'end_date', CURRENT_DATE + _forecast_days,
      'forecast_days', _forecast_days
    ),
    'performance_forecast', jsonb_build_object(
      'predicted_activity_level', CASE
        WHEN _trend_analysis.activity_trend = 'increasing' THEN _historical_data.avg_weekly_activities * 1.1
        WHEN _trend_analysis.activity_trend = 'decreasing' THEN _historical_data.avg_weekly_activities * 0.9
        ELSE _historical_data.avg_weekly_activities
      END,
      'predicted_collaboration_score', CASE
        WHEN _trend_analysis.collaboration_trend = 'improving' THEN LEAST(100, _historical_data.avg_collaboration * 1.05)
        WHEN _trend_analysis.collaboration_trend = 'declining' THEN GREATEST(0, _historical_data.avg_collaboration * 0.95)
        ELSE _historical_data.avg_collaboration
      END,
      'team_health_forecast', CASE
        WHEN _historical_data.at_risk_count::NUMERIC / NULLIF(_historical_data.total_members, 0) > 0.3 THEN 'declining'
        WHEN _historical_data.high_performers::NUMERIC / NULLIF(_historical_data.total_members, 0) > 0.5 THEN 'improving'
        ELSE 'stable'
      END
    ),
    'risk_assessment', jsonb_build_object(
      'member_attrition_risk', CASE
        WHEN _historical_data.at_risk_count > _historical_data.total_members * 0.4 THEN 'high'
        WHEN _historical_data.at_risk_count > _historical_data.total_members * 0.2 THEN 'medium'
        ELSE 'low'
      END,
      'productivity_decline_risk', CASE
        WHEN _trend_analysis.activity_trend = 'decreasing' AND _trend_analysis.collaboration_trend = 'declining' THEN 'high'
        WHEN _trend_analysis.activity_trend = 'decreasing' OR _trend_analysis.collaboration_trend = 'declining' THEN 'medium'
        ELSE 'low'
      END,
      'team_cohesion_risk', CASE
        WHEN _historical_data.avg_collaboration < 30 THEN 'high'
        WHEN _historical_data.avg_collaboration < 50 THEN 'medium'
        ELSE 'low'
      END
    ),
    'recommendations', jsonb_build_object(
      'immediate_actions', CASE
        WHEN _historical_data.at_risk_count > _historical_data.total_members * 0.3 THEN
          ARRAY['Conduct individual member assessments', 'Implement retention strategies', 'Review team workload distribution']
        WHEN _historical_data.avg_collaboration < 40 THEN
          ARRAY['Organize team building activities', 'Improve communication channels', 'Create collaborative projects']
        ELSE
          ARRAY['Continue monitoring', 'Maintain current practices', 'Regular team check-ins']
      END,
      'strategic_initiatives', CASE
        WHEN _trend_analysis.activity_trend = 'increasing' AND _historical_data.high_performers > _historical_data.total_members * 0.5 THEN
          ARRAY['Consider team expansion', 'Implement mentorship programs', 'Share best practices across teams']
        WHEN _trend_analysis.collaboration_trend = 'declining' THEN
          ARRAY['Restructure collaboration processes', 'Invest in collaboration tools', 'Training on teamwork skills']
        ELSE
          ARRAY['Gradual process improvements', 'Skill development programs', 'Performance optimization']
      END
    ),
    'success_indicators', jsonb_build_object(
      'key_metrics_to_watch', ARRAY[
        'Weekly activity levels',
        'Collaboration score trends',
        'Member engagement patterns',
        'Project completion rates',
        'At-risk member count'
      ],
      'target_improvements', jsonb_build_object(
        'activity_increase_target', GREATEST(0, _historical_data.avg_weekly_activities * 1.1),
        'collaboration_score_target', LEAST(100, _historical_data.avg_collaboration * 1.1),
        'at_risk_reduction_target', GREATEST(0, _historical_data.at_risk_count - 1)
      )
    ),
    'metadata', jsonb_build_object(
      'generated_at', NOW(),
      'generated_by', _current_user_id,
      'team_id', _team_id,
      'forecast_confidence', CASE
        WHEN _historical_data.total_members > 10 AND _historical_data.avg_weekly_activities > 20 THEN 'high'
        WHEN _historical_data.total_members > 5 THEN 'medium'
        ELSE 'low'
      END,
      'data_points_analyzed', _historical_data.total_members
    )
  ) INTO _result;

  RETURN _result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. REFRESH TRIGGERS AND AUTOMATION
-- ============================================================================

-- Function to automatically refresh analytics views when data changes
CREATE OR REPLACE FUNCTION public.trigger_analytics_refresh()
RETURNS TRIGGER AS $$
BEGIN
  -- Schedule a refresh of materialized views (async)
  PERFORM pg_notify('analytics_refresh_needed', json_build_object(
    'table', TG_TABLE_NAME,
    'operation', TG_OP,
    'timestamp', NOW()
  )::text);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic refresh on data changes
DROP TRIGGER IF EXISTS trigger_analytics_refresh_messages ON public.messages;
CREATE TRIGGER trigger_analytics_refresh_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.messages
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_analytics_refresh();

DROP TRIGGER IF EXISTS trigger_analytics_refresh_projects ON public.projects;
CREATE TRIGGER trigger_analytics_refresh_projects
  AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_analytics_refresh();

DROP TRIGGER IF EXISTS trigger_analytics_refresh_tasks ON public.project_tasks;
CREATE TRIGGER trigger_analytics_refresh_tasks
  AFTER INSERT OR UPDATE OR DELETE ON public.project_tasks
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.trigger_analytics_refresh();

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- Enable RLS on materialized views (note: limited RLS support for materialized views)
-- Access control is handled in the functions instead

-- ============================================================================
-- 6. COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON MATERIALIZED VIEW public.mv_advanced_analytics_summary IS
'Comprehensive analytics combining member activity, collaboration metrics, and performance indicators for advanced team analytics';

COMMENT ON MATERIALIZED VIEW public.mv_team_advanced_analytics IS
'Team-level aggregated analytics including health indicators, performance distribution, and collaboration metrics';

COMMENT ON FUNCTION public.get_advanced_member_analytics IS
'Get comprehensive advanced analytics for a team member including collaboration metrics, predictive insights, and performance indicators';

COMMENT ON FUNCTION public.get_team_advanced_analytics IS
'Get team-wide advanced analytics with performance distribution, collaboration summary, and predictive insights';

COMMENT ON FUNCTION public.get_predictive_team_analytics IS
'Generate predictive analytics and forecasting for team performance, risk assessment, and strategic recommendations';

COMMENT ON FUNCTION public.refresh_advanced_analytics_views IS
'Refresh all advanced analytics materialized views and log performance metrics';

-- ============================================================================
-- 7. INITIAL DATA REFRESH
-- ============================================================================

-- Refresh the materialized views to populate initial data
SELECT public.refresh_advanced_analytics_views();

-- ============================================================================
-- 8. PERFORMANCE MONITORING SETUP
-- ============================================================================

-- Insert initial performance baseline
INSERT INTO public.member_analytics_performance_metrics (
  function_name,
  execution_time_ms,
  rows_processed,
  rows_returned,
  cache_hit,
  filters_applied,
  database_load_avg,
  concurrent_queries
) VALUES (
  'advanced_analytics_infrastructure_setup',
  0,
  (SELECT COUNT(*) FROM public.mv_advanced_analytics_summary),
  (SELECT COUNT(*) FROM public.mv_team_advanced_analytics),
  false,
  '{"operation": "initial_setup", "migration": "20250725010000"}'::jsonb,
  0.0,
  1
);

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Advanced Analytics Infrastructure successfully deployed!';
  RAISE NOTICE 'Materialized views created: mv_advanced_analytics_summary, mv_team_advanced_analytics';
  RAISE NOTICE 'Functions available: get_advanced_member_analytics, get_team_advanced_analytics, get_predictive_team_analytics';
  RAISE NOTICE 'Auto-refresh triggers enabled for real-time analytics updates';
END $$;
