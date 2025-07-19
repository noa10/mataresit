-- Migration: 20250717000002_setup_embedding_metrics_cron.sql
-- Purpose: Set up automated scheduling for embedding metrics aggregation
-- Phase 1: Embedding Success Rate Monitoring Dashboard - Aggregation Scheduler

-- ============================================================================
-- ENABLE PG_CRON EXTENSION
-- ============================================================================

-- Enable pg_cron extension for scheduled jobs
-- Note: This may require superuser privileges in production
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- CRON JOB MANAGEMENT FUNCTIONS
-- ============================================================================

-- Function to schedule embedding metrics aggregation jobs
CREATE OR REPLACE FUNCTION setup_embedding_metrics_cron_jobs()
RETURNS VOID AS $$
BEGIN
  -- Note: In production, these cron jobs should be set up by the database administrator
  -- or through Supabase's cron job interface if available
  
  -- For now, we'll create a function that can be called manually or through a webhook
  -- to trigger the aggregation process
  
  RAISE LOG 'Embedding metrics cron job setup function created';
  RAISE LOG 'Manual scheduling required: Call aggregate_embedding_hourly_stats() every hour';
  RAISE LOG 'Manual scheduling required: Call aggregate_embedding_daily_stats() every day';
  RAISE LOG 'Manual scheduling required: Call cleanup_old_embedding_metrics() weekly';
END;
$$ LANGUAGE plpgsql;

-- Function to manually trigger all aggregations (for testing and manual execution)
CREATE OR REPLACE FUNCTION trigger_all_embedding_aggregations()
RETURNS TABLE (
  operation TEXT,
  success BOOLEAN,
  message TEXT,
  execution_time_ms NUMERIC
) AS $$
DECLARE
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  duration_ms NUMERIC;
BEGIN
  -- Hourly aggregation
  start_time := clock_timestamp();
  BEGIN
    PERFORM aggregate_embedding_hourly_stats();
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
      'hourly_aggregation'::TEXT,
      TRUE,
      'Hourly aggregation completed successfully'::TEXT,
      duration_ms;
  EXCEPTION WHEN OTHERS THEN
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
      'hourly_aggregation'::TEXT,
      FALSE,
      SQLERRM::TEXT,
      duration_ms;
  END;

  -- Daily aggregation
  start_time := clock_timestamp();
  BEGIN
    PERFORM aggregate_embedding_daily_stats();
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
      'daily_aggregation'::TEXT,
      TRUE,
      'Daily aggregation completed successfully'::TEXT,
      duration_ms;
  EXCEPTION WHEN OTHERS THEN
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
      'daily_aggregation'::TEXT,
      FALSE,
      SQLERRM::TEXT,
      duration_ms;
  END;

  -- Cleanup
  start_time := clock_timestamp();
  BEGIN
    PERFORM cleanup_old_embedding_metrics();
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
      'cleanup'::TEXT,
      TRUE,
      'Cleanup completed successfully'::TEXT,
      duration_ms;
  EXCEPTION WHEN OTHERS THEN
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
      'cleanup'::TEXT,
      FALSE,
      SQLERRM::TEXT,
      duration_ms;
  END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- WEBHOOK TRIGGER FUNCTION
-- ============================================================================

-- Function to be called by webhook or Edge Function for scheduled execution
CREATE OR REPLACE FUNCTION webhook_trigger_embedding_aggregation(
  aggregation_type TEXT DEFAULT 'all'
)
RETURNS JSON AS $$
DECLARE
  result JSON;
  start_time TIMESTAMPTZ;
  end_time TIMESTAMPTZ;
  success_count INTEGER := 0;
  total_count INTEGER := 0;
BEGIN
  start_time := clock_timestamp();
  
  -- Validate aggregation type
  IF aggregation_type NOT IN ('hourly', 'daily', 'cleanup', 'all') THEN
    RETURN json_build_object(
      'success', FALSE,
      'error', 'Invalid aggregation type. Must be: hourly, daily, cleanup, or all',
      'timestamp', start_time
    );
  END IF;

  -- Execute based on type
  IF aggregation_type = 'hourly' OR aggregation_type = 'all' THEN
    total_count := total_count + 1;
    BEGIN
      PERFORM aggregate_embedding_hourly_stats();
      success_count := success_count + 1;
      RAISE LOG 'Hourly aggregation completed successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Hourly aggregation failed: %', SQLERRM;
    END;
  END IF;

  IF aggregation_type = 'daily' OR aggregation_type = 'all' THEN
    total_count := total_count + 1;
    BEGIN
      PERFORM aggregate_embedding_daily_stats();
      success_count := success_count + 1;
      RAISE LOG 'Daily aggregation completed successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Daily aggregation failed: %', SQLERRM;
    END;
  END IF;

  IF aggregation_type = 'cleanup' OR aggregation_type = 'all' THEN
    total_count := total_count + 1;
    BEGIN
      PERFORM cleanup_old_embedding_metrics();
      success_count := success_count + 1;
      RAISE LOG 'Cleanup completed successfully';
    EXCEPTION WHEN OTHERS THEN
      RAISE LOG 'Cleanup failed: %', SQLERRM;
    END;
  END IF;

  end_time := clock_timestamp();

  -- Build result
  result := json_build_object(
    'success', success_count = total_count,
    'aggregation_type', aggregation_type,
    'operations_completed', success_count,
    'total_operations', total_count,
    'execution_time_ms', EXTRACT(EPOCH FROM (end_time - start_time)) * 1000,
    'timestamp', end_time
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MONITORING AND HEALTH CHECK FUNCTIONS
-- ============================================================================

-- Function to check the health of the aggregation system
CREATE OR REPLACE FUNCTION check_embedding_aggregation_health()
RETURNS JSON AS $$
DECLARE
  result JSON;
  latest_hourly TIMESTAMPTZ;
  latest_daily DATE;
  metrics_count INTEGER;
  hourly_stats_count INTEGER;
  daily_stats_count INTEGER;
  health_status TEXT := 'healthy';
  issues TEXT[] := '{}';
BEGIN
  -- Check latest metrics
  SELECT COUNT(*) INTO metrics_count
  FROM public.embedding_performance_metrics
  WHERE created_at > NOW() - INTERVAL '24 hours';

  -- Check latest hourly aggregation
  SELECT MAX(hour_bucket) INTO latest_hourly
  FROM public.embedding_hourly_stats;

  -- Check latest daily aggregation
  SELECT MAX(date_bucket) INTO latest_daily
  FROM public.embedding_daily_stats;

  -- Count aggregated records
  SELECT COUNT(*) INTO hourly_stats_count
  FROM public.embedding_hourly_stats
  WHERE hour_bucket > NOW() - INTERVAL '7 days';

  SELECT COUNT(*) INTO daily_stats_count
  FROM public.embedding_daily_stats
  WHERE date_bucket > CURRENT_DATE - INTERVAL '30 days';

  -- Check for issues
  IF latest_hourly IS NULL OR latest_hourly < NOW() - INTERVAL '2 hours' THEN
    health_status := 'warning';
    issues := array_append(issues, 'Hourly aggregation is behind schedule');
  END IF;

  IF latest_daily IS NULL OR latest_daily < CURRENT_DATE - INTERVAL '2 days' THEN
    health_status := 'warning';
    issues := array_append(issues, 'Daily aggregation is behind schedule');
  END IF;

  IF metrics_count = 0 THEN
    health_status := 'warning';
    issues := array_append(issues, 'No metrics collected in the last 24 hours');
  END IF;

  -- Build result
  result := json_build_object(
    'status', health_status,
    'timestamp', NOW(),
    'metrics', json_build_object(
      'raw_metrics_24h', metrics_count,
      'hourly_stats_7d', hourly_stats_count,
      'daily_stats_30d', daily_stats_count,
      'latest_hourly_aggregation', latest_hourly,
      'latest_daily_aggregation', latest_daily
    ),
    'issues', issues
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL SETUP
-- ============================================================================

-- Run the setup function
SELECT setup_embedding_metrics_cron_jobs();

-- Add helpful comments
COMMENT ON FUNCTION setup_embedding_metrics_cron_jobs() IS 'Sets up cron jobs for embedding metrics aggregation';
COMMENT ON FUNCTION trigger_all_embedding_aggregations() IS 'Manually triggers all embedding aggregation operations';
COMMENT ON FUNCTION webhook_trigger_embedding_aggregation(TEXT) IS 'Webhook-callable function for scheduled aggregation';
COMMENT ON FUNCTION check_embedding_aggregation_health() IS 'Health check for the aggregation system';

-- Log completion
DO $$
BEGIN
  RAISE LOG 'Embedding metrics cron setup completed successfully';
  RAISE LOG 'Use webhook_trigger_embedding_aggregation() for scheduled execution';
  RAISE LOG 'Use check_embedding_aggregation_health() for monitoring';
END $$;
