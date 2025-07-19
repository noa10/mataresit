-- Migration: 20250717000001_create_embedding_metrics_tables.sql
-- Purpose: Create comprehensive embedding performance monitoring system
-- Phase 1: Embedding Success Rate Monitoring Dashboard

-- ============================================================================
-- EMBEDDING PERFORMANCE METRICS TABLE
-- ============================================================================

-- Main table for tracking individual embedding generation attempts
CREATE TABLE IF NOT EXISTS public.embedding_performance_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id UUID REFERENCES public.receipts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Processing context
  upload_context TEXT NOT NULL CHECK (upload_context IN ('single', 'batch')),
  model_used TEXT NOT NULL,
  
  -- Timing metrics
  embedding_start_time TIMESTAMPTZ NOT NULL,
  embedding_end_time TIMESTAMPTZ,
  total_duration_ms INTEGER,
  
  -- Success/failure tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'success', 'failed', 'timeout')),
  retry_count INTEGER DEFAULT 0,
  error_type TEXT, -- 'api_limit', 'network', 'validation', 'timeout', 'unknown'
  error_message TEXT,
  
  -- Content metrics
  content_types_processed TEXT[], -- ['merchant', 'full_text', 'items_description']
  total_content_types INTEGER DEFAULT 0,
  successful_content_types INTEGER DEFAULT 0,
  failed_content_types INTEGER DEFAULT 0,
  
  -- API metrics
  api_calls_made INTEGER DEFAULT 0,
  api_tokens_used INTEGER DEFAULT 0,
  api_rate_limited BOOLEAN DEFAULT FALSE,
  
  -- Quality metrics
  embedding_dimensions INTEGER,
  content_length INTEGER,
  synthetic_content_used BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- HOURLY AGGREGATED STATS TABLE
-- ============================================================================

-- Hourly aggregated metrics for dashboard performance
CREATE TABLE IF NOT EXISTS public.embedding_hourly_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hour_bucket TIMESTAMPTZ NOT NULL, -- Truncated to hour
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Volume metrics
  total_attempts INTEGER DEFAULT 0,
  successful_attempts INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  timeout_attempts INTEGER DEFAULT 0,
  
  -- Context breakdown
  single_upload_attempts INTEGER DEFAULT 0,
  batch_upload_attempts INTEGER DEFAULT 0,
  single_upload_success INTEGER DEFAULT 0,
  batch_upload_success INTEGER DEFAULT 0,
  
  -- Performance metrics
  avg_duration_ms NUMERIC(10,2),
  p95_duration_ms NUMERIC(10,2),
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  rate_limited_count INTEGER DEFAULT 0,
  
  -- Error breakdown
  api_limit_errors INTEGER DEFAULT 0,
  network_errors INTEGER DEFAULT 0,
  validation_errors INTEGER DEFAULT 0,
  timeout_errors INTEGER DEFAULT 0,
  unknown_errors INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(hour_bucket, team_id)
);

-- ============================================================================
-- DAILY AGGREGATED STATS TABLE
-- ============================================================================

-- Daily aggregated metrics for trend analysis
CREATE TABLE IF NOT EXISTS public.embedding_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_bucket DATE NOT NULL,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
  
  -- Volume metrics
  total_attempts INTEGER DEFAULT 0,
  successful_attempts INTEGER DEFAULT 0,
  failed_attempts INTEGER DEFAULT 0,
  success_rate NUMERIC(5,2), -- Percentage
  
  -- Performance metrics
  avg_duration_ms NUMERIC(10,2),
  p95_duration_ms NUMERIC(10,2),
  p99_duration_ms NUMERIC(10,2),
  
  -- Cost metrics
  total_api_calls INTEGER DEFAULT 0,
  total_tokens_used INTEGER DEFAULT 0,
  estimated_cost_usd NUMERIC(10,4),
  
  -- Quality metrics
  synthetic_content_percentage NUMERIC(5,2),
  avg_content_types_per_receipt NUMERIC(3,1),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(date_bucket, team_id)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for embedding_performance_metrics
CREATE INDEX IF NOT EXISTS idx_embedding_metrics_receipt_id 
ON public.embedding_performance_metrics(receipt_id);

CREATE INDEX IF NOT EXISTS idx_embedding_metrics_user_team 
ON public.embedding_performance_metrics(user_id, team_id);

CREATE INDEX IF NOT EXISTS idx_embedding_metrics_status_time 
ON public.embedding_performance_metrics(status, created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_metrics_upload_context 
ON public.embedding_performance_metrics(upload_context, created_at);

CREATE INDEX IF NOT EXISTS idx_embedding_metrics_team_time 
ON public.embedding_performance_metrics(team_id, embedding_start_time);

-- Indexes for hourly stats
CREATE INDEX IF NOT EXISTS idx_embedding_hourly_stats_time_team 
ON public.embedding_hourly_stats(hour_bucket, team_id);

CREATE INDEX IF NOT EXISTS idx_embedding_hourly_stats_team_recent 
ON public.embedding_hourly_stats(team_id, hour_bucket DESC);

-- Indexes for daily stats
CREATE INDEX IF NOT EXISTS idx_embedding_daily_stats_date_team 
ON public.embedding_daily_stats(date_bucket, team_id);

CREATE INDEX IF NOT EXISTS idx_embedding_daily_stats_team_recent 
ON public.embedding_daily_stats(team_id, date_bucket DESC);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.embedding_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_hourly_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embedding_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS Policies for embedding_performance_metrics
CREATE POLICY embedding_metrics_team_access ON public.embedding_performance_metrics
FOR ALL USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for embedding_hourly_stats
CREATE POLICY embedding_hourly_stats_team_access ON public.embedding_hourly_stats
FOR ALL USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);

-- RLS Policies for embedding_daily_stats
CREATE POLICY embedding_daily_stats_team_access ON public.embedding_daily_stats
FOR ALL USING (
  team_id IN (
    SELECT team_id FROM public.team_members 
    WHERE user_id = auth.uid()
  )
);

-- ============================================================================
-- AGGREGATION FUNCTIONS
-- ============================================================================

-- Function to aggregate hourly stats
CREATE OR REPLACE FUNCTION aggregate_embedding_hourly_stats()
RETURNS VOID AS $$
DECLARE
  current_hour TIMESTAMPTZ;
BEGIN
  -- Get the current hour bucket (previous hour)
  current_hour := date_trunc('hour', NOW() - INTERVAL '1 hour');
  
  -- Aggregate metrics for the previous hour
  INSERT INTO public.embedding_hourly_stats (
    hour_bucket,
    team_id,
    total_attempts,
    successful_attempts,
    failed_attempts,
    timeout_attempts,
    single_upload_attempts,
    batch_upload_attempts,
    single_upload_success,
    batch_upload_success,
    avg_duration_ms,
    p95_duration_ms,
    total_api_calls,
    total_tokens_used,
    rate_limited_count,
    api_limit_errors,
    network_errors,
    validation_errors,
    timeout_errors,
    unknown_errors
  )
  SELECT 
    current_hour,
    team_id,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE status = 'success') as successful_attempts,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_attempts,
    COUNT(*) FILTER (WHERE status = 'timeout') as timeout_attempts,
    COUNT(*) FILTER (WHERE upload_context = 'single') as single_upload_attempts,
    COUNT(*) FILTER (WHERE upload_context = 'batch') as batch_upload_attempts,
    COUNT(*) FILTER (WHERE upload_context = 'single' AND status = 'success') as single_upload_success,
    COUNT(*) FILTER (WHERE upload_context = 'batch' AND status = 'success') as batch_upload_success,
    AVG(total_duration_ms) as avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) as p95_duration_ms,
    SUM(api_calls_made) as total_api_calls,
    SUM(api_tokens_used) as total_tokens_used,
    COUNT(*) FILTER (WHERE api_rate_limited = TRUE) as rate_limited_count,
    COUNT(*) FILTER (WHERE error_type = 'api_limit') as api_limit_errors,
    COUNT(*) FILTER (WHERE error_type = 'network') as network_errors,
    COUNT(*) FILTER (WHERE error_type = 'validation') as validation_errors,
    COUNT(*) FILTER (WHERE error_type = 'timeout') as timeout_errors,
    COUNT(*) FILTER (WHERE error_type = 'unknown') as unknown_errors
  FROM public.embedding_performance_metrics
  WHERE embedding_start_time >= current_hour 
    AND embedding_start_time < current_hour + INTERVAL '1 hour'
    AND team_id IS NOT NULL
  GROUP BY team_id
  ON CONFLICT (hour_bucket, team_id) DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    successful_attempts = EXCLUDED.successful_attempts,
    failed_attempts = EXCLUDED.failed_attempts,
    timeout_attempts = EXCLUDED.timeout_attempts,
    single_upload_attempts = EXCLUDED.single_upload_attempts,
    batch_upload_attempts = EXCLUDED.batch_upload_attempts,
    single_upload_success = EXCLUDED.single_upload_success,
    batch_upload_success = EXCLUDED.batch_upload_success,
    avg_duration_ms = EXCLUDED.avg_duration_ms,
    p95_duration_ms = EXCLUDED.p95_duration_ms,
    total_api_calls = EXCLUDED.total_api_calls,
    total_tokens_used = EXCLUDED.total_tokens_used,
    rate_limited_count = EXCLUDED.rate_limited_count,
    api_limit_errors = EXCLUDED.api_limit_errors,
    network_errors = EXCLUDED.network_errors,
    validation_errors = EXCLUDED.validation_errors,
    timeout_errors = EXCLUDED.timeout_errors,
    unknown_errors = EXCLUDED.unknown_errors;
    
  -- Log aggregation completion
  RAISE LOG 'Hourly embedding stats aggregated for hour: %', current_hour;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate daily stats
CREATE OR REPLACE FUNCTION aggregate_embedding_daily_stats()
RETURNS VOID AS $$
DECLARE
  current_date DATE;
BEGIN
  current_date := (NOW() - INTERVAL '1 day')::DATE;

  INSERT INTO public.embedding_daily_stats (
    date_bucket,
    team_id,
    total_attempts,
    successful_attempts,
    failed_attempts,
    success_rate,
    avg_duration_ms,
    p95_duration_ms,
    p99_duration_ms,
    total_api_calls,
    total_tokens_used,
    estimated_cost_usd,
    synthetic_content_percentage,
    avg_content_types_per_receipt
  )
  SELECT
    current_date,
    team_id,
    COUNT(*) as total_attempts,
    COUNT(*) FILTER (WHERE status = 'success') as successful_attempts,
    COUNT(*) FILTER (WHERE status = 'failed') as failed_attempts,
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'success')::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as success_rate,
    AVG(total_duration_ms) as avg_duration_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY total_duration_ms) as p95_duration_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY total_duration_ms) as p99_duration_ms,
    SUM(api_calls_made) as total_api_calls,
    SUM(api_tokens_used) as total_tokens_used,
    -- Estimate cost based on Gemini pricing: $0.00015 per 1K tokens
    ROUND((SUM(api_tokens_used) / 1000.0) * 0.00015, 4) as estimated_cost_usd,
    ROUND(
      (COUNT(*) FILTER (WHERE synthetic_content_used = TRUE)::NUMERIC / NULLIF(COUNT(*), 0)) * 100,
      2
    ) as synthetic_content_percentage,
    AVG(total_content_types) as avg_content_types_per_receipt
  FROM public.embedding_performance_metrics
  WHERE embedding_start_time::DATE = current_date
    AND team_id IS NOT NULL
  GROUP BY team_id
  ON CONFLICT (date_bucket, team_id) DO UPDATE SET
    total_attempts = EXCLUDED.total_attempts,
    successful_attempts = EXCLUDED.successful_attempts,
    failed_attempts = EXCLUDED.failed_attempts,
    success_rate = EXCLUDED.success_rate,
    avg_duration_ms = EXCLUDED.avg_duration_ms,
    p95_duration_ms = EXCLUDED.p95_duration_ms,
    p99_duration_ms = EXCLUDED.p99_duration_ms,
    total_api_calls = EXCLUDED.total_api_calls,
    total_tokens_used = EXCLUDED.total_tokens_used,
    estimated_cost_usd = EXCLUDED.estimated_cost_usd,
    synthetic_content_percentage = EXCLUDED.synthetic_content_percentage,
    avg_content_types_per_receipt = EXCLUDED.avg_content_types_per_receipt;

  -- Log aggregation completion
  RAISE LOG 'Daily embedding stats aggregated for date: %', current_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to record embedding metrics (called from Edge Functions)
CREATE OR REPLACE FUNCTION record_embedding_metrics(
  p_receipt_id UUID,
  p_user_id UUID,
  p_team_id UUID,
  p_upload_context TEXT,
  p_model_used TEXT,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ DEFAULT NULL,
  p_status TEXT DEFAULT 'pending',
  p_error_type TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_content_types TEXT[] DEFAULT '{}',
  p_api_calls INTEGER DEFAULT 0,
  p_api_tokens INTEGER DEFAULT 0,
  p_rate_limited BOOLEAN DEFAULT FALSE,
  p_content_length INTEGER DEFAULT 0,
  p_synthetic_content BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
  metric_id UUID;
  duration_ms INTEGER;
BEGIN
  -- Calculate duration if end time provided
  IF p_end_time IS NOT NULL THEN
    duration_ms := EXTRACT(EPOCH FROM (p_end_time - p_start_time)) * 1000;
  END IF;

  INSERT INTO public.embedding_performance_metrics (
    receipt_id,
    user_id,
    team_id,
    upload_context,
    model_used,
    embedding_start_time,
    embedding_end_time,
    total_duration_ms,
    status,
    error_type,
    error_message,
    content_types_processed,
    total_content_types,
    successful_content_types,
    failed_content_types,
    api_calls_made,
    api_tokens_used,
    api_rate_limited,
    content_length,
    synthetic_content_used
  ) VALUES (
    p_receipt_id,
    p_user_id,
    p_team_id,
    p_upload_context,
    p_model_used,
    p_start_time,
    p_end_time,
    duration_ms,
    p_status,
    p_error_type,
    p_error_message,
    p_content_types,
    array_length(p_content_types, 1),
    CASE WHEN p_status = 'success' THEN array_length(p_content_types, 1) ELSE 0 END,
    CASE WHEN p_status = 'failed' THEN array_length(p_content_types, 1) ELSE 0 END,
    p_api_calls,
    p_api_tokens,
    p_rate_limited,
    p_content_length,
    p_synthetic_content
  ) RETURNING id INTO metric_id;

  RETURN metric_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update existing metrics record
CREATE OR REPLACE FUNCTION update_embedding_metrics(
  p_metric_id UUID,
  p_end_time TIMESTAMPTZ,
  p_status TEXT,
  p_error_type TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_api_calls INTEGER DEFAULT NULL,
  p_api_tokens INTEGER DEFAULT NULL,
  p_rate_limited BOOLEAN DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  start_time TIMESTAMPTZ;
  duration_ms INTEGER;
BEGIN
  -- Get start time to calculate duration
  SELECT embedding_start_time INTO start_time
  FROM public.embedding_performance_metrics
  WHERE id = p_metric_id;

  IF start_time IS NOT NULL THEN
    duration_ms := EXTRACT(EPOCH FROM (p_end_time - start_time)) * 1000;
  END IF;

  UPDATE public.embedding_performance_metrics
  SET
    embedding_end_time = p_end_time,
    total_duration_ms = duration_ms,
    status = p_status,
    error_type = p_error_type,
    error_message = p_error_message,
    api_calls_made = COALESCE(p_api_calls, api_calls_made),
    api_tokens_used = COALESCE(p_api_tokens, api_tokens_used),
    api_rate_limited = COALESCE(p_rate_limited, api_rate_limited),
    updated_at = NOW()
  WHERE id = p_metric_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old metrics (retention policy)
CREATE OR REPLACE FUNCTION cleanup_old_embedding_metrics()
RETURNS VOID AS $$
BEGIN
  -- Delete metrics older than 90 days
  DELETE FROM public.embedding_performance_metrics
  WHERE created_at < NOW() - INTERVAL '90 days';

  -- Delete hourly stats older than 30 days
  DELETE FROM public.embedding_hourly_stats
  WHERE hour_bucket < NOW() - INTERVAL '30 days';

  -- Delete daily stats older than 1 year
  DELETE FROM public.embedding_daily_stats
  WHERE date_bucket < CURRENT_DATE - INTERVAL '1 year';

  -- Log cleanup completion
  RAISE LOG 'Old embedding metrics cleaned up';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INITIAL DATA AND COMMENTS
-- ============================================================================

-- Add helpful comments to tables
COMMENT ON TABLE public.embedding_performance_metrics IS 'Tracks individual embedding generation attempts with detailed metrics';
COMMENT ON TABLE public.embedding_hourly_stats IS 'Hourly aggregated embedding performance statistics';
COMMENT ON TABLE public.embedding_daily_stats IS 'Daily aggregated embedding performance statistics';

-- Add column comments for key fields
COMMENT ON COLUMN public.embedding_performance_metrics.upload_context IS 'Context of upload: single or batch';
COMMENT ON COLUMN public.embedding_performance_metrics.error_type IS 'Classification of error: api_limit, network, validation, timeout, unknown';
COMMENT ON COLUMN public.embedding_performance_metrics.content_types_processed IS 'Array of content types processed: merchant, full_text, items_description';
COMMENT ON COLUMN public.embedding_performance_metrics.synthetic_content_used IS 'Whether synthetic content was generated due to missing fullText';

-- Migration completion log
DO $$
BEGIN
  RAISE LOG 'Embedding metrics tables migration completed successfully';
END $$;
