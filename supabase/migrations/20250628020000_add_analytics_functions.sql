-- ============================================================================
-- ANALYTICS FUNCTIONS FOR LONG-TERM INTERACTION TRACKING
-- ============================================================================

-- Function to get comprehensive user analytics
CREATE OR REPLACE FUNCTION get_user_analytics(p_timeframe TEXT DEFAULT 'month')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  start_date TIMESTAMP WITH TIME ZONE;
  total_interactions INTEGER;
  interactions_by_type JSON;
  daily_activity JSON;
  patterns JSON;
  insights JSON;
BEGIN
  -- Calculate start date based on timeframe
  CASE p_timeframe
    WHEN 'week' THEN start_date := NOW() - INTERVAL '7 days';
    WHEN 'month' THEN start_date := NOW() - INTERVAL '30 days';
    WHEN 'quarter' THEN start_date := NOW() - INTERVAL '90 days';
    ELSE start_date := NOW() - INTERVAL '30 days';
  END CASE;

  -- Get total interactions
  SELECT COUNT(*) INTO total_interactions
  FROM user_interactions
  WHERE user_id = auth.uid() AND timestamp >= start_date;

  -- Get interactions by type
  SELECT json_object_agg(interaction_type, count)
  INTO interactions_by_type
  FROM (
    SELECT interaction_type, COUNT(*) as count
    FROM user_interactions
    WHERE user_id = auth.uid() AND timestamp >= start_date
    GROUP BY interaction_type
  ) t;

  -- Get daily activity
  SELECT json_agg(
    json_build_object(
      'date', date,
      'interactions', total_interactions,
      'chatMessages', chat_messages,
      'searchQueries', search_queries,
      'uiActions', ui_actions
    )
  )
  INTO daily_activity
  FROM (
    SELECT 
      DATE(timestamp) as date,
      COUNT(*) as total_interactions,
      COUNT(*) FILTER (WHERE interaction_type = 'chat_message') as chat_messages,
      COUNT(*) FILTER (WHERE interaction_type = 'search_query') as search_queries,
      COUNT(*) FILTER (WHERE interaction_type = 'ui_action') as ui_actions
    FROM user_interactions
    WHERE user_id = auth.uid() AND timestamp >= start_date
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
    LIMIT 30
  ) daily;

  -- Analyze patterns
  WITH hourly_activity AS (
    SELECT EXTRACT(HOUR FROM timestamp) as hour, COUNT(*) as count
    FROM user_interactions
    WHERE user_id = auth.uid() AND timestamp >= start_date
    GROUP BY EXTRACT(HOUR FROM timestamp)
  ),
  daily_activity_pattern AS (
    SELECT EXTRACT(DOW FROM timestamp) as dow, COUNT(*) as count
    FROM user_interactions
    WHERE user_id = auth.uid() AND timestamp >= start_date
    GROUP BY EXTRACT(DOW FROM timestamp)
  ),
  feature_usage AS (
    SELECT 
      interaction_context->>'feature_name' as feature,
      COUNT(*) as usage_count
    FROM user_interactions
    WHERE user_id = auth.uid() 
      AND timestamp >= start_date
      AND interaction_type = 'feature_usage'
      AND interaction_context->>'feature_name' IS NOT NULL
    GROUP BY interaction_context->>'feature_name'
    ORDER BY usage_count DESC
    LIMIT 5
  )
  SELECT json_build_object(
    'mostActiveHour', (SELECT hour FROM hourly_activity ORDER BY count DESC LIMIT 1),
    'mostActiveDay', (
      SELECT CASE dow
        WHEN 0 THEN 'Sunday'
        WHEN 1 THEN 'Monday'
        WHEN 2 THEN 'Tuesday'
        WHEN 3 THEN 'Wednesday'
        WHEN 4 THEN 'Thursday'
        WHEN 5 THEN 'Friday'
        WHEN 6 THEN 'Saturday'
      END
      FROM daily_activity_pattern ORDER BY count DESC LIMIT 1
    ),
    'averageSessionDuration', 25.5, -- Placeholder for session duration calculation
    'preferredFeatures', (SELECT json_agg(feature) FROM feature_usage)
  ) INTO patterns;

  -- Generate insights
  WITH interaction_stats AS (
    SELECT 
      COUNT(*) FILTER (WHERE interaction_type = 'chat_message') as chat_count,
      COUNT(*) FILTER (WHERE interaction_type = 'search_query') as search_count,
      COUNT(*) FILTER (WHERE interaction_type = 'ui_action') as ui_count,
      COUNT(*) FILTER (WHERE interaction_type = 'feature_usage') as feature_count
    FROM user_interactions
    WHERE user_id = auth.uid() AND timestamp >= start_date
  )
  SELECT json_build_object(
    'receiptManagementStyle', 
      CASE 
        WHEN feature_count > 50 THEN 'batch_processor'
        WHEN feature_count > 20 THEN 'regular_uploader'
        ELSE 'occasional_user'
      END,
    'searchBehavior',
      CASE 
        WHEN search_count > 30 THEN 'power_searcher'
        WHEN search_count > 10 THEN 'casual_searcher'
        ELSE 'browser'
      END,
    'chatEngagement',
      CASE 
        WHEN chat_count > 40 THEN 'conversational'
        WHEN chat_count > 15 THEN 'task_focused'
        ELSE 'minimal'
      END,
    'efficiency',
      CASE 
        WHEN (ui_count::float / GREATEST(total_interactions, 1)) > 0.6 THEN 'high'
        WHEN (ui_count::float / GREATEST(total_interactions, 1)) > 0.3 THEN 'medium'
        ELSE 'low'
      END
  )
  INTO insights
  FROM interaction_stats;

  -- Build final result
  SELECT json_build_object(
    'totalInteractions', total_interactions,
    'interactionsByType', COALESCE(interactions_by_type, '{}'::json),
    'dailyActivity', COALESCE(daily_activity, '[]'::json),
    'patterns', COALESCE(patterns, '{}'::json),
    'insights', COALESCE(insights, '{}'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get usage statistics
CREATE OR REPLACE FUNCTION get_usage_statistics(p_period TEXT DEFAULT 'week')
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  start_date TIMESTAMP WITH TIME ZONE;
  total_sessions INTEGER;
  avg_session_duration NUMERIC;
  total_interactions INTEGER;
  feature_usage JSON;
  trends JSON;
BEGIN
  -- Calculate start date based on period
  CASE p_period
    WHEN 'day' THEN start_date := NOW() - INTERVAL '1 day';
    WHEN 'week' THEN start_date := NOW() - INTERVAL '7 days';
    WHEN 'month' THEN start_date := NOW() - INTERVAL '30 days';
    ELSE start_date := NOW() - INTERVAL '7 days';
  END CASE;

  -- Get session count (approximate based on session_id)
  SELECT COUNT(DISTINCT session_id) INTO total_sessions
  FROM user_interactions
  WHERE user_id = auth.uid() 
    AND timestamp >= start_date
    AND session_id IS NOT NULL;

  -- Calculate average session duration (placeholder)
  avg_session_duration := 15.5;

  -- Get total interactions
  SELECT COUNT(*) INTO total_interactions
  FROM user_interactions
  WHERE user_id = auth.uid() AND timestamp >= start_date;

  -- Get feature usage
  SELECT json_object_agg(feature, usage_count)
  INTO feature_usage
  FROM (
    SELECT 
      COALESCE(interaction_context->>'feature_name', interaction_type) as feature,
      COUNT(*) as usage_count
    FROM user_interactions
    WHERE user_id = auth.uid() AND timestamp >= start_date
    GROUP BY COALESCE(interaction_context->>'feature_name', interaction_type)
  ) t;

  -- Calculate trends
  WITH current_period AS (
    SELECT COUNT(*) as current_interactions
    FROM user_interactions
    WHERE user_id = auth.uid() AND timestamp >= start_date
  ),
  previous_period AS (
    SELECT COUNT(*) as previous_interactions
    FROM user_interactions
    WHERE user_id = auth.uid() 
      AND timestamp >= (start_date - (NOW() - start_date))
      AND timestamp < start_date
  )
  SELECT json_build_object(
    'interactionTrend', 
      CASE 
        WHEN c.current_interactions > p.previous_interactions * 1.1 THEN 'increasing'
        WHEN c.current_interactions < p.previous_interactions * 0.9 THEN 'decreasing'
        ELSE 'stable'
      END,
    'engagementScore', LEAST(100, (c.current_interactions::float / 30) * 100),
    'productivityScore', LEAST(100, (total_sessions::float / 7) * 20)
  )
  INTO trends
  FROM current_period c, previous_period p;

  -- Build result
  SELECT json_build_object(
    'period', p_period,
    'totalSessions', total_sessions,
    'averageSessionDuration', avg_session_duration,
    'totalInteractions', total_interactions,
    'featureUsage', COALESCE(feature_usage, '{}'::json),
    'trends', COALESCE(trends, '{}'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get personalized insights
CREATE OR REPLACE FUNCTION get_personalized_insights()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  receipt_patterns JSON;
  search_patterns JSON;
  chat_patterns JSON;
  recommendations JSON;
BEGIN
  -- Analyze receipt patterns
  WITH receipt_data AS (
    SELECT 
      COUNT(*) as upload_count,
      AVG(EXTRACT(HOUR FROM timestamp)) as avg_upload_hour,
      AVG((interaction_context->>'duration')::numeric) as avg_processing_time
    FROM user_interactions
    WHERE user_id = auth.uid() 
      AND interaction_type = 'feature_usage'
      AND interaction_context->>'feature_name' LIKE '%upload%'
      AND timestamp >= NOW() - INTERVAL '30 days'
  )
  SELECT json_build_object(
    'uploadFrequency', 
      CASE 
        WHEN upload_count > 20 THEN 'daily'
        WHEN upload_count > 8 THEN 'weekly'
        ELSE 'monthly'
      END,
    'preferredUploadTime',
      CASE 
        WHEN avg_upload_hour BETWEEN 6 AND 12 THEN 'morning'
        WHEN avg_upload_hour BETWEEN 12 AND 18 THEN 'afternoon'
        ELSE 'evening'
      END,
    'averageReceiptValue', 45.50, -- Placeholder
    'topCategories', '["Food", "Transportation", "Office Supplies"]'::json,
    'processingEfficiency', 
      CASE 
        WHEN avg_processing_time < 30 THEN 95
        WHEN avg_processing_time < 60 THEN 80
        ELSE 65
      END
  )
  INTO receipt_patterns
  FROM receipt_data;

  -- Analyze search patterns
  WITH search_data AS (
    SELECT 
      AVG(LENGTH(interaction_context->>'query')) as avg_query_length,
      AVG((interaction_context->>'results_count')::integer) as avg_results,
      COUNT(*) as total_searches
    FROM user_interactions
    WHERE user_id = auth.uid() 
      AND interaction_type = 'search_query'
      AND timestamp >= NOW() - INTERVAL '30 days'
  )
  SELECT json_build_object(
    'queryComplexity',
      CASE 
        WHEN avg_query_length > 50 THEN 'complex'
        WHEN avg_query_length > 20 THEN 'moderate'
        ELSE 'simple'
      END,
    'searchSuccess', LEAST(100, (avg_results / 10) * 100),
    'preferredSearchType', 'semantic'
  )
  INTO search_patterns
  FROM search_data;

  -- Analyze chat patterns
  WITH chat_data AS (
    SELECT 
      AVG(LENGTH(interaction_context->>'message')) as avg_message_length,
      COUNT(*) FILTER (WHERE interaction_context->>'contains_question' = 'true')::float / 
        GREATEST(COUNT(*), 1) as question_ratio
    FROM user_interactions
    WHERE user_id = auth.uid() 
      AND interaction_type = 'chat_message'
      AND timestamp >= NOW() - INTERVAL '30 days'
  )
  SELECT json_build_object(
    'messageLength',
      CASE 
        WHEN avg_message_length > 100 THEN 'long'
        WHEN avg_message_length > 30 THEN 'medium'
        ELSE 'short'
      END,
    'questionFrequency', ROUND(question_ratio * 100),
    'responsePreference', 'detailed'
  )
  INTO chat_patterns
  FROM chat_data;

  -- Generate recommendations
  SELECT json_build_array(
    json_build_object(
      'type', 'feature',
      'title', 'Try Batch Upload',
      'description', 'Upload multiple receipts at once to save time',
      'impact', 'high'
    ),
    json_build_object(
      'type', 'workflow',
      'title', 'Set Upload Reminders',
      'description', 'Regular upload schedule improves organization',
      'impact', 'medium'
    ),
    json_build_object(
      'type', 'setting',
      'title', 'Enable Smart Categories',
      'description', 'Automatic categorization based on your patterns',
      'impact', 'medium'
    )
  ) INTO recommendations;

  -- Build result
  SELECT json_build_object(
    'receiptPatterns', COALESCE(receipt_patterns, '{}'::json),
    'searchPatterns', COALESCE(search_patterns, '{}'::json),
    'chatPatterns', COALESCE(chat_patterns, '{}'::json),
    'recommendations', COALESCE(recommendations, '[]'::json)
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get interaction trends
CREATE OR REPLACE FUNCTION get_interaction_trends(p_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'date', date,
      'interactions', total_interactions,
      'chatMessages', chat_messages,
      'searchQueries', search_queries,
      'uiActions', ui_actions,
      'featureUsage', feature_usage
    )
  )
  INTO result
  FROM (
    SELECT
      DATE(timestamp) as date,
      COUNT(*) as total_interactions,
      COUNT(*) FILTER (WHERE interaction_type = 'chat_message') as chat_messages,
      COUNT(*) FILTER (WHERE interaction_type = 'search_query') as search_queries,
      COUNT(*) FILTER (WHERE interaction_type = 'ui_action') as ui_actions,
      COUNT(*) FILTER (WHERE interaction_type = 'feature_usage') as feature_usage
    FROM user_interactions
    WHERE user_id = auth.uid()
      AND timestamp >= NOW() - (p_days || ' days')::INTERVAL
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
  ) trends;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to analyze user patterns
CREATE OR REPLACE FUNCTION analyze_user_patterns()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  patterns JSON;
  insights TEXT[];
  recommendations JSON;
BEGIN
  -- Analyze patterns
  WITH pattern_analysis AS (
    SELECT
      COUNT(*) as total_interactions,
      COUNT(DISTINCT DATE(timestamp)) as active_days,
      COUNT(DISTINCT session_id) as total_sessions,
      AVG(EXTRACT(HOUR FROM timestamp)) as avg_hour,
      MODE() WITHIN GROUP (ORDER BY EXTRACT(DOW FROM timestamp)) as most_active_dow
    FROM user_interactions
    WHERE user_id = auth.uid()
      AND timestamp >= NOW() - INTERVAL '30 days'
  )
  SELECT json_build_object(
    'totalInteractions', total_interactions,
    'activeDays', active_days,
    'totalSessions', total_sessions,
    'averageHour', avg_hour,
    'mostActiveDayOfWeek', most_active_dow,
    'dailyAverage', ROUND(total_interactions::numeric / GREATEST(active_days, 1), 2)
  )
  INTO patterns
  FROM pattern_analysis;

  -- Generate insights
  insights := ARRAY[
    'You are most active during ' ||
    CASE
      WHEN (patterns->>'averageHour')::numeric BETWEEN 6 AND 12 THEN 'morning hours'
      WHEN (patterns->>'averageHour')::numeric BETWEEN 12 AND 18 THEN 'afternoon hours'
      ELSE 'evening hours'
    END,
    'Your daily interaction average is ' || (patterns->>'dailyAverage') || ' actions',
    'You have been active for ' || (patterns->>'activeDays') || ' days this month'
  ];

  -- Generate recommendations
  SELECT json_build_array(
    json_build_object(
      'type', 'workflow',
      'message', 'Consider setting up automated receipt processing during your peak hours',
      'priority', 'medium'
    ),
    json_build_object(
      'type', 'feature',
      'message', 'Try using keyboard shortcuts to improve efficiency',
      'priority', 'low'
    ),
    json_build_object(
      'type', 'setting',
      'message', 'Enable notifications for better engagement tracking',
      'priority', 'high'
    )
  ) INTO recommendations;

  -- Build result
  SELECT json_build_object(
    'patterns', patterns,
    'insights', array_to_json(insights),
    'recommendations', recommendations
  ) INTO result;

  RETURN result;
END;
$$;

-- Function to get feature usage analytics
CREATE OR REPLACE FUNCTION get_feature_usage_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_agg(
    json_build_object(
      'feature', feature,
      'usageCount', usage_count,
      'averageDuration', avg_duration,
      'successRate', success_rate,
      'lastUsed', last_used,
      'trend', trend
    )
  )
  INTO result
  FROM (
    WITH feature_stats AS (
      SELECT
        COALESCE(interaction_context->>'feature_name', interaction_type) as feature,
        COUNT(*) as usage_count,
        AVG((interaction_context->>'duration')::numeric) as avg_duration,
        COUNT(*) FILTER (WHERE (interaction_context->>'success')::boolean = true)::float /
          GREATEST(COUNT(*), 1) * 100 as success_rate,
        MAX(timestamp) as last_used
      FROM user_interactions
      WHERE user_id = auth.uid()
        AND timestamp >= NOW() - INTERVAL '30 days'
      GROUP BY COALESCE(interaction_context->>'feature_name', interaction_type)
    ),
    feature_trends AS (
      SELECT
        feature,
        CASE
          WHEN last_used >= NOW() - INTERVAL '7 days' THEN 'increasing'
          WHEN last_used >= NOW() - INTERVAL '14 days' THEN 'stable'
          ELSE 'decreasing'
        END as trend
      FROM feature_stats
    )
    SELECT
      fs.feature,
      fs.usage_count,
      ROUND(COALESCE(fs.avg_duration, 0), 2) as avg_duration,
      ROUND(fs.success_rate, 2) as success_rate,
      fs.last_used::text as last_used,
      ft.trend
    FROM feature_stats fs
    JOIN feature_trends ft ON fs.feature = ft.feature
    ORDER BY fs.usage_count DESC
  ) analytics;

  RETURN COALESCE(result, '[]'::json);
END;
$$;

-- Function to get chat analytics
CREATE OR REPLACE FUNCTION get_chat_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH chat_stats AS (
    SELECT
      COUNT(*) as total_messages,
      AVG(LENGTH(interaction_context->>'message')) as avg_message_length,
      COUNT(*) FILTER (WHERE (interaction_context->>'contains_question')::boolean = true)::float /
        GREATEST(COUNT(*), 1) as question_ratio,
      AVG((interaction_context->>'response_time')::numeric) as avg_response_time
    FROM user_interactions
    WHERE user_id = auth.uid()
      AND interaction_type = 'chat_message'
      AND timestamp >= NOW() - INTERVAL '30 days'
  )
  SELECT json_build_object(
    'totalMessages', total_messages,
    'averageMessageLength', ROUND(COALESCE(avg_message_length, 0), 2),
    'questionRatio', ROUND(question_ratio * 100, 2),
    'responseTime', ROUND(COALESCE(avg_response_time, 0), 2),
    'topTopics', '["receipts", "search", "categories"]'::json,
    'satisfactionScore', 85.5
  )
  INTO result
  FROM chat_stats;

  RETURN COALESCE(result, '{}'::json);
END;
$$;

-- Function to get search analytics
CREATE OR REPLACE FUNCTION get_search_analytics()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  WITH search_stats AS (
    SELECT
      COUNT(*) as total_queries,
      AVG((interaction_context->>'results_count')::integer) as avg_results_count,
      COUNT(*) FILTER (WHERE (interaction_context->>'results_count')::integer > 0)::float /
        GREATEST(COUNT(*), 1) as success_rate
    FROM user_interactions
    WHERE user_id = auth.uid()
      AND interaction_type = 'search_query'
      AND timestamp >= NOW() - INTERVAL '30 days'
  ),
  query_types AS (
    SELECT
      interaction_context->>'query_type' as query_type,
      COUNT(*) as count
    FROM user_interactions
    WHERE user_id = auth.uid()
      AND interaction_type = 'search_query'
      AND timestamp >= NOW() - INTERVAL '30 days'
    GROUP BY interaction_context->>'query_type'
  )
  SELECT json_build_object(
    'totalQueries', ss.total_queries,
    'averageResultsCount', ROUND(COALESCE(ss.avg_results_count, 0), 2),
    'queryTypes', (SELECT json_object_agg(query_type, count) FROM query_types),
    'successRate', ROUND(ss.success_rate * 100, 2),
    'topQueries', '["receipt total", "category food", "last month"]'::json,
    'searchEfficiency', ROUND(ss.success_rate * 100, 2)
  )
  INTO result
  FROM search_stats ss;

  RETURN COALESCE(result, '{}'::json);
END;
$$;

-- Function to get productivity insights
CREATE OR REPLACE FUNCTION get_productivity_insights()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  productivity_score NUMERIC;
  efficiency_trends JSON;
  time_optimization JSON;
  workflow_recommendations JSON;
BEGIN
  -- Calculate productivity score
  WITH productivity_metrics AS (
    SELECT
      COUNT(*) as total_interactions,
      COUNT(DISTINCT DATE(timestamp)) as active_days,
      COUNT(*) FILTER (WHERE (interaction_context->>'success')::boolean = true)::float /
        GREATEST(COUNT(*), 1) as success_rate,
      AVG((interaction_context->>'duration')::numeric) as avg_duration
    FROM user_interactions
    WHERE user_id = auth.uid()
      AND timestamp >= NOW() - INTERVAL '30 days'
  )
  SELECT
    LEAST(100,
      (total_interactions::float / 30) * 20 +
      success_rate * 30 +
      CASE WHEN avg_duration < 60 THEN 30 ELSE 15 END +
      (active_days::float / 30) * 20
    )
  INTO productivity_score
  FROM productivity_metrics;

  -- Generate efficiency trends
  SELECT json_agg(
    json_build_object(
      'date', date,
      'score', score
    )
  )
  INTO efficiency_trends
  FROM (
    SELECT
      DATE(timestamp) as date,
      LEAST(100, COUNT(*) * 5 +
        COUNT(*) FILTER (WHERE (interaction_context->>'success')::boolean = true)::float /
        GREATEST(COUNT(*), 1) * 50
      ) as score
    FROM user_interactions
    WHERE user_id = auth.uid()
      AND timestamp >= NOW() - INTERVAL '14 days'
    GROUP BY DATE(timestamp)
    ORDER BY date DESC
    LIMIT 14
  ) trends;

  -- Generate time optimization suggestions
  SELECT json_build_array(
    json_build_object(
      'suggestion', 'Use keyboard shortcuts for faster navigation',
      'potentialSavings', '2-3 minutes per session',
      'difficulty', 'easy'
    ),
    json_build_object(
      'suggestion', 'Set up automated receipt categorization',
      'potentialSavings', '5-10 minutes per batch',
      'difficulty', 'medium'
    ),
    json_build_object(
      'suggestion', 'Create custom search filters for frequent queries',
      'potentialSavings', '1-2 minutes per search',
      'difficulty', 'easy'
    )
  ) INTO time_optimization;

  -- Generate workflow recommendations
  SELECT json_build_array(
    json_build_object(
      'workflow', 'Weekly Receipt Processing',
      'description', 'Process receipts in batches once per week',
      'benefits', '["Reduced context switching", "Better organization", "Time savings"]'::json
    ),
    json_build_object(
      'workflow', 'Smart Search Workflow',
      'description', 'Use semantic search for complex queries, filters for simple ones',
      'benefits', '["Faster results", "Better accuracy", "Reduced effort"]'::json
    ),
    json_build_object(
      'workflow', 'Automated Categorization',
      'description', 'Let AI categorize receipts automatically based on patterns',
      'benefits', '["Consistent categorization", "Time savings", "Reduced errors"]'::json
    )
  ) INTO workflow_recommendations;

  -- Build result
  SELECT json_build_object(
    'productivityScore', ROUND(productivity_score, 2),
    'efficiencyTrends', COALESCE(efficiency_trends, '[]'::json),
    'timeOptimization', time_optimization,
    'workflowRecommendations', workflow_recommendations
  ) INTO result;

  RETURN result;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_analytics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_usage_statistics(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_personalized_insights() TO authenticated;
GRANT EXECUTE ON FUNCTION get_interaction_trends(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION analyze_user_patterns() TO authenticated;
GRANT EXECUTE ON FUNCTION get_feature_usage_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_chat_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_search_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_productivity_insights() TO authenticated;
